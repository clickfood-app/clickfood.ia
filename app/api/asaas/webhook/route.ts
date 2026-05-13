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
  status: string | null
  mercadopago_payment_id: string | null
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
          error: "externalReference não enviado no webhook.",
        },
        { status: 400 }
      )
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, restaurant_id, payment_status, status, mercadopago_payment_id"
      )
      .eq("id", externalReference)
      .maybeSingle()

    if (orderError) {
      return NextResponse.json(
        {
          success: false,
          error: orderError.message || "Erro ao buscar pedido do webhook.",
        },
        { status: 500 }
      )
    }

    const typedOrder = order as OrderRow | null

    if (!typedOrder) {
      return NextResponse.json(
        {
          success: false,
          error: "Pedido do webhook não encontrado.",
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
          error:
            accountError.message ||
            "Erro ao buscar conta Asaas do restaurante.",
        },
        { status: 500 }
      )
    }

    const typedAccount = account as RestaurantAsaasAccountRow | null

    if (!typedAccount || !typedAccount.is_active) {
      return NextResponse.json(
        {
          success: false,
          error: "Conta Asaas do restaurante não encontrada ou inativa.",
        },
        { status: 404 }
      )
    }

    if (!typedAccount.webhook_token_encrypted) {
      return NextResponse.json(
        {
          success: false,
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
          error: "Token do webhook inválido.",
        },
        { status: 401 }
      )
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "paid",
        status: "pending",
        mercadopago_payment_id: paymentId || typedOrder.mercadopago_payment_id,
      })
      .eq("id", typedOrder.id)

    if (updateError) {
      return NextResponse.json(
        {
          success: false,
          error: updateError.message || "Erro ao atualizar pedido.",
        },
        { status: 500 }
      )
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
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
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