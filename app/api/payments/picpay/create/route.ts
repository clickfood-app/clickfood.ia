import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { createPicPayProvider } from "@/lib/payments/providers/picpay.provider"

type CreatePicPayPaymentBody = {
  orderId?: string
  customerDocument?: string | null
  customerEmail?: string | null
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

function onlyDigits(value?: string | null) {
  return (value || "").replace(/\D/g, "")
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreatePicPayPaymentBody
    const orderId = String(body.orderId || "").trim()

    if (!orderId) {
      return jsonError("orderId é obrigatório.", 400)
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, restaurant_id, public_order_number, customer_name, customer_phone, total, payment_method, payment_status, status"
      )
      .eq("id", orderId)
      .maybeSingle()

    if (orderError) {
      console.error("Erro ao buscar pedido para PicPay:", orderError)
      return jsonError("Erro ao buscar pedido.", 500)
    }

    if (!order) {
      return jsonError("Pedido não encontrado.", 404)
    }

    const typedOrder = order as {
      id: string
      restaurant_id: string
      public_order_number?: string | null
      customer_name?: string | null
      customer_phone?: string | null
      total?: number | string | null
      payment_method?: string | null
      payment_status?: string | null
      status?: string | null
    }

    if (typedOrder.payment_method !== "picpay_pix") {
      return jsonError("Este pedido não usa pagamento PicPay.", 400)
    }

    if (typedOrder.payment_status === "paid") {
      return jsonError("Este pedido já está pago.", 400)
    }

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, picpay_enabled")
      .eq("id", typedOrder.restaurant_id)
      .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao buscar restaurante para PicPay:", restaurantError)
      return jsonError("Erro ao buscar restaurante.", 500)
    }

    if (!restaurant || !Boolean(restaurant.picpay_enabled)) {
      return jsonError("PicPay não está ativo para este restaurante.", 400)
    }

    const { data: integration, error: integrationError } = await supabaseAdmin
      .from("restaurant_payment_integrations")
      .select("client_id, client_secret, environment, enabled")
      .eq("restaurant_id", typedOrder.restaurant_id)
      .eq("provider", "picpay")
      .maybeSingle()

    if (integrationError) {
      console.error("Erro ao buscar integração PicPay:", integrationError)
      return jsonError("Erro ao buscar integração PicPay.", 500)
    }

    if (!integration || !integration.enabled) {
      return jsonError("Integração PicPay não configurada.", 400)
    }

    if (!integration.client_id || !integration.client_secret) {
      return jsonError("Credenciais PicPay incompletas.", 400)
    }

    const amountCents = Math.round(Number(typedOrder.total || 0) * 100)

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return jsonError("Valor do pedido inválido.", 400)
    }

    const document = onlyDigits(body.customerDocument)

    if (document.length !== 11 && document.length !== 14) {
      return jsonError("CPF/CNPJ válido é obrigatório para pagar com PicPay.", 400)
    }

    const provider = createPicPayProvider({
      clientId: integration.client_id,
      clientSecret: integration.client_secret,
      environment:
        integration.environment === "sandbox" ? "sandbox" : "production",
    })

    const charge = await provider.createCharge({
      restaurantId: typedOrder.restaurant_id,
      orderId: typedOrder.id,
      amountCents,
      customer: {
        name: typedOrder.customer_name || "Cliente ClickFood",
        phone: typedOrder.customer_phone || null,
        email: body.customerEmail || "cliente@clickfoodbr.com",
        document,
      },
      description: `Pedido #${typedOrder.public_order_number || typedOrder.id.slice(0, 8)}`,
      expiresInSeconds: 900,
    })

    const { error: transactionError } = await supabaseAdmin
      .from("payment_transactions")
      .insert({
        restaurant_id: typedOrder.restaurant_id,
        order_id: typedOrder.id,
        provider: "picpay",
        provider_charge_id: charge.providerChargeId,
        provider_transaction_id: charge.providerTransactionId,
        amount_cents: amountCents,
        status: charge.status,
        qr_code: charge.qrCode,
        qr_code_base64: charge.qrCodeBase64,
        copy_paste: charge.copyPaste,
        raw_response: charge.raw,
        expires_at: charge.expiresAt,
      })

    if (transactionError) {
      console.error("Erro ao salvar transação PicPay:", transactionError)
      return jsonError("Cobrança criada, mas erro ao salvar transação.", 500)
    }

    await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "pending",
        status: "awaiting_payment",
      })
      .eq("id", typedOrder.id)

    return NextResponse.json({
      success: true,
      payment: {
        orderId: typedOrder.id,
        provider: "picpay",
        providerChargeId: charge.providerChargeId,
        providerTransactionId: charge.providerTransactionId,
        qrCode: charge.qrCode,
        qrCodeBase64: charge.qrCodeBase64,
        pixCopyPaste: charge.copyPaste,
        expiresAt: charge.expiresAt,
        status: charge.status,
        publicOrderNumber: typedOrder.public_order_number ?? null,
      },
    })
  } catch (error) {
    console.error("POST /api/payments/picpay/create error:", error)

    return jsonError(
      error instanceof Error ? error.message : "Erro ao criar pagamento PicPay.",
      500
    )
  }
}
