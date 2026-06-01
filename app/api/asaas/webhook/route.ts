import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { decryptText } from "@/lib/crypto"

type AsaasWebhookBody = {
  event?: string
  payment?: {
    id?: string
    status?: string
    value?: number
    netValue?: number
    billingType?: string
    externalReference?: string | null
    description?: string | null
  }
}

type OrderRow = {
  id: string
  restaurant_id: string
  status: string | null
  payment_status: string | null
  asaas_payment_id: string | null
  asaas_payment_status: string | null
}

type RestaurantAsaasAccountRow = {
  webhook_token_encrypted: string | null
  is_active: boolean
}

const PAID_EVENTS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"])

function normalizeText(value: unknown, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function isPaidPaymentStatus(paymentStatus: string | null) {
  const normalizedPaymentStatus = String(paymentStatus || "")
    .trim()
    .toLowerCase()

  return ["paid", "received", "confirmed"].includes(normalizedPaymentStatus)
}

function getNextOperationalStatus(currentStatus: string | null) {
  if (currentStatus === "awaiting_payment") {
    return "pending"
  }

  return currentStatus || "pending"
}

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  )
}

function jsonOk(payload: Record<string, unknown>) {
  return NextResponse.json({
    success: true,
    ...payload,
  })
}

export async function POST(req: NextRequest) {
  try {
    let body: AsaasWebhookBody

    try {
      body = (await req.json()) as AsaasWebhookBody
    } catch {
      return jsonError("Payload inválido.", 400)
    }

    const receivedToken = normalizeText(req.headers.get("asaas-access-token"), 500)
    const event = normalizeText(body.event, 80)
    const paymentId = normalizeText(body.payment?.id, 120)
    const paymentStatus = normalizeText(body.payment?.status, 80)
    const externalReference = normalizeText(
      body.payment?.externalReference,
      120
    )

    const shouldMarkAsPaid = Boolean(event) && PAID_EVENTS.has(event)

    if (!externalReference) {
      if (!shouldMarkAsPaid) {
        return jsonOk({
          received: true,
          ignored: true,
          reason: "Evento sem referência externa ignorado.",
        })
      }

      console.error("Webhook Asaas pago sem externalReference:", {
        event,
        paymentId,
        paymentStatus,
      })

      return jsonError("Referência externa ausente.", 400)
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, restaurant_id, status, payment_status, asaas_payment_id, asaas_payment_status"
      )
      .eq("id", externalReference)
      .maybeSingle()

    if (orderError) {
      console.error("Erro ao buscar pedido no webhook Asaas:", {
        externalReference,
        event,
        paymentId,
        paymentStatus,
        message: orderError.message,
        code: orderError.code,
      })

      return jsonError("Erro ao buscar pedido do webhook.", 500)
    }

    const typedOrder = order as OrderRow | null

    if (!typedOrder) {
      console.warn("Pedido do webhook Asaas não encontrado:", {
        externalReference,
        event,
        paymentId,
        paymentStatus,
      })

      return jsonOk({
        received: true,
        ignored: true,
        reason: "Pedido não encontrado.",
      })
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("restaurant_asaas_accounts")
      .select("webhook_token_encrypted, is_active")
      .eq("restaurant_id", typedOrder.restaurant_id)
      .maybeSingle()

    if (accountError) {
      console.error("Erro ao buscar conta Asaas no webhook:", {
        restaurantId: typedOrder.restaurant_id,
        orderId: typedOrder.id,
        message: accountError.message,
        code: accountError.code,
      })

      return jsonError("Erro ao validar conta Asaas.", 500)
    }

    const typedAccount = account as RestaurantAsaasAccountRow | null

    if (!typedAccount || !typedAccount.is_active) {
      console.warn("Webhook recebido para conta Asaas inativa/inexistente:", {
        restaurantId: typedOrder.restaurant_id,
        orderId: typedOrder.id,
        event,
        paymentId,
      })

      return jsonError("Conta Asaas não encontrada ou inativa.", 404)
    }

    if (!typedAccount.webhook_token_encrypted) {
      console.error("Webhook token Asaas não configurado:", {
        restaurantId: typedOrder.restaurant_id,
        orderId: typedOrder.id,
      })

      return jsonError("Token do webhook não configurado.", 400)
    }

    const expectedToken = decryptText(typedAccount.webhook_token_encrypted)

    if (!receivedToken || receivedToken !== expectedToken) {
      console.warn("Token inválido no webhook Asaas:", {
        restaurantId: typedOrder.restaurant_id,
        orderId: typedOrder.id,
        event,
        paymentId,
      })

      return jsonError("Token do webhook inválido.", 401)
    }

    if (
      typedOrder.asaas_payment_id &&
      paymentId &&
      typedOrder.asaas_payment_id !== paymentId
    ) {
      console.warn("Payment ID divergente no webhook Asaas:", {
        orderId: typedOrder.id,
        expectedPaymentId: typedOrder.asaas_payment_id,
        receivedPaymentId: paymentId,
        event,
        paymentStatus,
      })

      return jsonError("Pagamento não pertence a este pedido.", 409)
    }

    if (!shouldMarkAsPaid) {
      const { error: ignoredUpdateError } = await supabaseAdmin
        .from("orders")
        .update({
          asaas_payment_status:
            paymentStatus || typedOrder.asaas_payment_status,
          asaas_payment_id: typedOrder.asaas_payment_id || paymentId || null,
        })
        .eq("id", typedOrder.id)

      if (ignoredUpdateError) {
        console.error("Erro ao atualizar evento Asaas ignorado:", {
          orderId: typedOrder.id,
          event,
          paymentId,
          paymentStatus,
          message: ignoredUpdateError.message,
          code: ignoredUpdateError.code,
        })

        return jsonError("Erro ao atualizar status do pedido.", 500)
      }

      return jsonOk({
        received: true,
        ignored: true,
        event,
      })
    }

    const nextOperationalStatus = getNextOperationalStatus(typedOrder.status)

    if (isPaidPaymentStatus(typedOrder.payment_status)) {
      const { error: alreadyPaidUpdateError } = await supabaseAdmin
        .from("orders")
        .update({
          status: nextOperationalStatus,
          asaas_payment_status: paymentStatus || "RECEIVED",
          asaas_payment_id: typedOrder.asaas_payment_id || paymentId || null,
        })
        .eq("id", typedOrder.id)

      if (alreadyPaidUpdateError) {
        console.error("Erro ao atualizar pedido já pago no webhook Asaas:", {
          orderId: typedOrder.id,
          event,
          paymentId,
          paymentStatus,
          message: alreadyPaidUpdateError.message,
          code: alreadyPaidUpdateError.code,
        })

        return jsonError("Erro ao atualizar pedido já pago.", 500)
      }

      return jsonOk({
        received: true,
        processed: true,
        alreadyPaid: true,
        updatedOrder: false,
        event,
      })
    }

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: nextOperationalStatus,
        payment_status: "paid",
        asaas_payment_status: paymentStatus || "RECEIVED",
        asaas_payment_id: typedOrder.asaas_payment_id || paymentId || null,
      })
      .eq("id", typedOrder.id)
      .select("id, status, payment_status, asaas_payment_id, asaas_payment_status")
      .maybeSingle()

    if (updateError) {
      console.error("Erro ao marcar pedido como pago pelo webhook Asaas:", {
        orderId: typedOrder.id,
        event,
        paymentId,
        paymentStatus,
        message: updateError.message,
        code: updateError.code,
      })

      return jsonError("Erro ao atualizar pedido.", 500)
    }

    const { data: loyaltyStampResult, error: loyaltyStampError } =
      await supabaseAdmin.rpc("process_loyalty_stamp_for_order", {
        p_order_id: typedOrder.id,
      })

    if (loyaltyStampError) {
      console.error("Erro ao processar selo de fidelidade:", {
        orderId: typedOrder.id,
        message: loyaltyStampError.message,
        code: loyaltyStampError.code,
      })
    }

    return jsonOk({
      received: true,
      processed: true,
      updatedOrder: true,
      event,
      order: updatedOrder,
      loyaltyStamp: {
        processed: !loyaltyStampError,
        result: loyaltyStampResult || null,
      },
    })
  } catch (error) {
    console.error("POST /api/asaas/webhook error:", error)

    return jsonError("Erro ao processar webhook do Asaas.", 500)
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Webhook Asaas online.",
  })
}