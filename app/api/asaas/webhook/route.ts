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
  payment_status: string | null
}

type RestaurantAsaasAccountRow = {
  webhook_token_encrypted: string | null
  is_active: boolean
}

const PAID_EVENTS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"])

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AsaasWebhookBody

    const receivedToken = req.headers.get("asaas-access-token")
    const event = body.event || null
    const paymentId = body.payment?.id || null
    const paymentStatus = body.payment?.status || null
    const externalReference = body.payment?.externalReference || null

    const shouldMarkAsPaid = !!event && PAID_EVENTS.has(event)

    if (!shouldMarkAsPaid) {
      return NextResponse.json({
        success: true,
        received: true,
        ignored: true,
        event,
        paymentId,
        paymentStatus,
        externalReference,
      })
    }

    if (!externalReference) {
      return NextResponse.json(
        {
          success: false,
          step: "external_reference_ausente",
          error: "externalReference não enviado no webhook.",
        },
        { status: 400 }
      )
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, restaurant_id, payment_status")
      .eq("id", externalReference)
      .maybeSingle()

    if (orderError) {
      return NextResponse.json(
        {
          success: false,
          step: "buscar_pedido",
          error: orderError.message || "Erro ao buscar pedido do webhook.",
          details: orderError.details || null,
          hint: orderError.hint || null,
          code: orderError.code || null,
        },
        { status: 500 }
      )
    }

    const typedOrder = order as OrderRow | null

    if (!typedOrder) {
      return NextResponse.json(
        {
          success: false,
          step: "pedido_nao_encontrado",
          error: "Pedido do webhook não encontrado.",
          externalReference,
        },
        { status: 404 }
      )
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("restaurant_asaas_accounts")
      .select("webhook_token_encrypted, is_active")
      .eq("restaurant_id", typedOrder.restaurant_id)
      .maybeSingle()

    if (accountError) {
      return NextResponse.json(
        {
          success: false,
          step: "buscar_conta_asaas",
          error:
            accountError.message ||
            "Erro ao buscar conta Asaas do restaurante.",
          details: accountError.details || null,
          hint: accountError.hint || null,
          code: accountError.code || null,
        },
        { status: 500 }
      )
    }

    const typedAccount = account as RestaurantAsaasAccountRow | null

    if (!typedAccount || !typedAccount.is_active) {
      return NextResponse.json(
        {
          success: false,
          step: "conta_asaas_inativa",
          error: "Conta Asaas do restaurante não encontrada ou inativa.",
        },
        { status: 404 }
      )
    }

    if (!typedAccount.webhook_token_encrypted) {
      return NextResponse.json(
        {
          success: false,
          step: "token_nao_configurado",
          error: "Token do webhook do restaurante não configurado.",
        },
        { status: 400 }
      )
    }

    const expectedToken = decryptText(typedAccount.webhook_token_encrypted)

    if (!receivedToken || receivedToken !== expectedToken) {
      return NextResponse.json(
        {
          success: false,
          step: "token_invalido",
          error: "Token do webhook inválido.",
        },
        { status: 401 }
      )
    }

    if (typedOrder.payment_status === "paid") {
      return NextResponse.json({
        success: true,
        received: true,
        processed: true,
        alreadyPaid: true,
        updatedOrder: false,
        event,
        paymentId,
        paymentStatus,
        externalReference,
      })
    }

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "paid",
      })
      .eq("id", typedOrder.id)
      .select("id, payment_status")
      .maybeSingle()

    if (updateError) {
      return NextResponse.json(
        {
          success: false,
          step: "atualizar_pedido",
          error: updateError.message || "Erro ao atualizar pedido.",
          details: updateError.details || null,
          hint: updateError.hint || null,
          code: updateError.code || null,
        },
        { status: 500 }
      )
    }

    const { data: loyaltyStampResult, error: loyaltyStampError } =
      await supabaseAdmin.rpc("process_loyalty_stamp_for_order", {
        p_order_id: typedOrder.id,
      })

    if (loyaltyStampError) {
      console.error("Erro ao processar selo de fidelidade:", loyaltyStampError)
    }

    return NextResponse.json({
      success: true,
      received: true,
      processed: true,
      updatedOrder: true,
      shouldMarkAsPaid: true,
      event,
      paymentId,
      paymentStatus,
      externalReference,
      order: updatedOrder,
      loyaltyStamp: {
        processed: !loyaltyStampError,
        result: loyaltyStampResult || null,
        error: loyaltyStampError?.message || null,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        step: "erro_geral",
        error:
          error instanceof Error
            ? error.message
            : "Erro ao processar webhook do Asaas.",
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Webhook Asaas online.",
  })
}