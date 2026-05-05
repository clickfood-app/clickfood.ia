import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createHmac, timingSafeEqual } from "crypto"

type MercadoPagoWebhookBody = {
  action?: string
  api_version?: string
  data?: {
    id?: string | number
  }
  id?: string | number
  live_mode?: boolean
  type?: string
  user_id?: string | number
}

type MercadoPagoPayment = {
  id: number
  status: string
  external_reference?: string | null
  metadata?: {
    order_id?: string
    restaurant_id?: string
    coupon_id?: string | null
    coupon_code?: string | null
    coupon_discount?: number
  }
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase nao configurado no servidor.")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function getMercadoPagoAccessToken() {
  const token = process.env.MERCADOPAGO_RESTAURANT_ACCESS_TOKEN

  if (!token) {
    throw new Error("Token do Mercado Pago nao configurado.")
  }

  return token
}

function getMercadoPagoWebhookSecret() {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET

  if (!secret) {
    throw new Error("Secret do webhook do Mercado Pago nao configurado.")
  }

  return secret
}

function parseSignatureHeader(signatureHeader: string | null) {
  if (!signatureHeader) {
    return null
  }

  const parts = signatureHeader.split(",").map((part) => part.trim())
  const values: Record<string, string> = {}

  for (const part of parts) {
    const [key, value] = part.split("=")
    if (key && value) {
      values[key] = value
    }
  }

  if (!values.ts || !values.v1) {
    return null
  }

  return {
    ts: values.ts,
    v1: values.v1,
  }
}

function safeCompareHex(a: string, b: string) {
  try {
    const aBuffer = Buffer.from(a, "hex")
    const bBuffer = Buffer.from(b, "hex")

    if (aBuffer.length !== bBuffer.length) {
      return false
    }

    return timingSafeEqual(aBuffer, bBuffer)
  } catch {
    return false
  }
}

function isValidMercadoPagoWebhookSignature(
  request: NextRequest,
  paymentId: string
) {
  const signatureHeader = request.headers.get("x-signature")
  const requestId = request.headers.get("x-request-id")
  const parsedSignature = parseSignatureHeader(signatureHeader)

  if (!parsedSignature || !requestId) {
    return false
  }

  const secret = getMercadoPagoWebhookSecret()

  const manifest = `id:${paymentId};request-id:${requestId};ts:${parsedSignature.ts};`

  const expectedSignature = createHmac("sha256", secret)
    .update(manifest)
    .digest("hex")

  return safeCompareHex(expectedSignature, parsedSignature.v1)
}

async function fetchMercadoPagoPayment(paymentId: string) {
  const accessToken = getMercadoPagoAccessToken()

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Erro ao consultar pagamento no Mercado Pago: ${errorText}`)
  }

  return (await response.json()) as MercadoPagoPayment
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MercadoPagoWebhookBody
    const url = new URL(request.url)

    const paymentId =
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      body?.data?.id?.toString() ||
      body?.id?.toString()

    if (!paymentId) {
      return NextResponse.json({ received: true, ignored: true })
    }

    const isValidSignature = isValidMercadoPagoWebhookSignature(request, paymentId)

    if (!isValidSignature) {
      return NextResponse.json(
        { error: "Webhook do Mercado Pago invalido" },
        { status: 401 }
      )
    }

    if (body.type && body.type !== "payment") {
      return NextResponse.json({ received: true, ignored: true })
    }

    const payment = await fetchMercadoPagoPayment(paymentId)
    const orderId = payment.external_reference || payment.metadata?.order_id || null

    if (!orderId) {
      return NextResponse.json({ received: true, ignored: true })
    }

    const supabase = getSupabaseAdmin()

    const paymentStatus = String(payment.status || "").toLowerCase()
    const paymentIdAsText = String(payment.id)

    if (paymentStatus === "approved") {
      const { data: updatedOrders, error: updateError } = await supabase
        .from("orders")
        .update({
          payment_status: "approved",
          status: "confirmed",
          mercadopago_payment_id: paymentIdAsText,
        })
        .eq("id", orderId)
        .neq("payment_status", "approved")
        .select("id, coupon_id")

      if (updateError) {
        throw updateError
      }

      const updatedOrder = updatedOrders?.[0]

      if (updatedOrder?.coupon_id) {
        const { data: coupon, error: couponError } = await supabase
          .from("coupons")
          .select("id, used_count")
          .eq("id", updatedOrder.coupon_id)
          .single()

        if (couponError) {
          throw couponError
        }

        const { error: incrementError } = await supabase
          .from("coupons")
          .update({
            used_count: Number(coupon.used_count ?? 0) + 1,
          })
          .eq("id", updatedOrder.coupon_id)

        if (incrementError) {
          throw incrementError
        }
      }

      return NextResponse.json({ received: true, processed: true })
    }

    if (paymentStatus === "rejected" || paymentStatus === "cancelled") {
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          payment_status: paymentStatus,
          status: "cancelled",
          mercadopago_payment_id: paymentIdAsText,
        })
        .eq("id", orderId)

      if (updateError) {
        throw updateError
      }

      return NextResponse.json({ received: true, processed: true })
    }

    const { error: pendingUpdateError } = await supabase
      .from("orders")
      .update({
        payment_status: paymentStatus || "pending",
        mercadopago_payment_id: paymentIdAsText,
      })
      .eq("id", orderId)

    if (pendingUpdateError) {
      throw pendingUpdateError
    }

    return NextResponse.json({ received: true, processed: true })
  } catch (error) {
    console.error("Mercado Pago webhook error:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro interno no webhook",
      },
      { status: 500 }
    )
  }
}