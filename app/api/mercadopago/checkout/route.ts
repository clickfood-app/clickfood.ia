import { NextRequest, NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

interface CheckoutItem {
  product_id: string
  quantity: number
}

interface CheckoutRequest {
  restaurantId: string
  orderId: string
  publicOrderNumber?: string | null
  items?: CheckoutItem[]
  customerName: string
  customerPhone: string
  customerEmail: string
  customerDocument: string
  customerDocumentType?: string
  customerAddress?: string
  customerNeighborhood?: string | null
  customerNote?: string | null
  orderType: "delivery" | "pickup"
  deliveryFee?: number
  serviceFee?: number
  couponCode?: string | null
}

interface MercadoPagoConnectionRow {
  restaurant_id: string
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  mp_user_id: string | null
}

interface OrderRow {
  id: string
  public_order_number: string | null
  total: number | string
  customer_id: string | null
  delivery_address: string | null
  delivery_neighborhood: string | null
  payment_status: string | null
  status: string | null
  coupon_id: string | null
  coupon_code: string | null
  coupon_discount: number | string | null
  delivery_fee: number | string | null
  mercadopago_payment_id: string | null
}

function getSupabaseAdmin(): SupabaseClient {
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

async function getRestaurantMercadoPagoToken(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("mercadopago_connections")
    .select("restaurant_id, access_token, refresh_token, expires_at, mp_user_id")
    .eq("restaurant_id", restaurantId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || "Erro ao buscar conexão do Mercado Pago.")
  }

  const connection = data as MercadoPagoConnectionRow | null

  if (!connection?.access_token) {
    return null
  }

  return connection.access_token
}

function normalizeText(value?: string | null) {
  return value?.trim() || null
}

function normalizeDocument(value?: string | null) {
  return value?.replace(/\D/g, "") || ""
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function splitCustomerName(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  const firstName = parts.shift() || fullName.trim()
  const lastName = parts.join(" ") || firstName

  return { firstName, lastName }
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://clickfood.vercel.app"
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutRequest = await request.json()

    const {
      restaurantId,
      orderId,
      publicOrderNumber,
      customerName,
      customerPhone,
      customerEmail,
      customerDocument,
      customerDocumentType = "CPF",
      customerAddress,
      customerNeighborhood,
      orderType,
    } = body

    if (!restaurantId) {
      return NextResponse.json(
        { error: "Restaurante inválido" },
        { status: 400 }
      )
    }

    if (!orderId) {
      return NextResponse.json(
        { error: "Pedido inválido" },
        { status: 400 }
      )
    }

    if (!customerName?.trim()) {
      return NextResponse.json(
        { error: "Nome do cliente é obrigatório" },
        { status: 400 }
      )
    }

    if (!customerPhone?.trim()) {
      return NextResponse.json(
        { error: "Telefone do cliente é obrigatório" },
        { status: 400 }
      )
    }

    if (!customerEmail?.trim() || !isValidEmail(customerEmail.trim())) {
      return NextResponse.json(
        { error: "E-mail do cliente é obrigatório" },
        { status: 400 }
      )
    }

    const sanitizedDocument = normalizeDocument(customerDocument)

    if (!sanitizedDocument) {
      return NextResponse.json(
        { error: "Documento do cliente é obrigatório" },
        { status: 400 }
      )
    }

    if (customerDocumentType === "CPF" && sanitizedDocument.length !== 11) {
      return NextResponse.json(
        { error: "CPF inválido" },
        { status: 400 }
      )
    }

    if (customerDocumentType === "CNPJ" && sanitizedDocument.length !== 14) {
      return NextResponse.json(
        { error: "CNPJ inválido" },
        { status: 400 }
      )
    }

    if (orderType !== "delivery" && orderType !== "pickup") {
      return NextResponse.json(
        { error: "Tipo de pedido inválido" },
        { status: 400 }
      )
    }

    const normalizedAddress = normalizeText(customerAddress)
    const normalizedNeighborhood = normalizeText(customerNeighborhood)
    const normalizedEmail = customerEmail.trim().toLowerCase()

    if (orderType === "delivery" && !normalizedAddress) {
      return NextResponse.json(
        { error: "Endereço é obrigatório para entrega" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    const mpAccessToken = await getRestaurantMercadoPagoToken(
      supabase,
      restaurantId
    )

    if (!mpAccessToken) {
      return NextResponse.json(
        { error: "Restaurante nao configurado para pagamentos online" },
        { status: 400 }
      )
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,
        public_order_number,
        total,
        customer_id,
        delivery_address,
        delivery_neighborhood,
        payment_status,
        status,
        coupon_id,
        coupon_code,
        coupon_discount,
        delivery_fee,
        mercadopago_payment_id
      `)
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle()

    if (orderError) {
      console.error("Order fetch error:", orderError)
      return NextResponse.json(
        { error: "Erro ao buscar pedido" },
        { status: 500 }
      )
    }

    const order = orderData as OrderRow | null

    if (!order) {
      return NextResponse.json(
        { error: "Pedido nao encontrado" },
        { status: 404 }
      )
    }

    if (order.status === "cancelled") {
      return NextResponse.json(
        { error: "Este pedido foi cancelado" },
        { status: 400 }
      )
    }

    if (order.payment_status === "approved") {
      return NextResponse.json(
        { error: "Este pedido ja foi pago" },
        { status: 400 }
      )
    }

    const total = Number(order.total ?? 0)

    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json(
        { error: "Valor do pedido invalido para pagamento Pix" },
        { status: 400 }
      )
    }

    const { firstName, lastName } = splitCustomerName(customerName)
    const notificationUrl = `${getAppUrl()}/api/mercadopago/webhook`
    const idempotencyKey = `pix-${order.id}`

    const payload = {
      transaction_amount: Number(total.toFixed(2)),
      description: `Pedido #${order.public_order_number || publicOrderNumber || order.id}`,
      payment_method_id: "pix",
      payer: {
        email: normalizedEmail,
        first_name: firstName,
        last_name: lastName,
        identification: {
          type: customerDocumentType,
          number: sanitizedDocument,
        },
      },
      external_reference: order.id,
      notification_url: notificationUrl,
      metadata: {
        order_id: order.id,
        public_order_number: order.public_order_number || publicOrderNumber || null,
        restaurant_id: restaurantId,
        customer_id: order.customer_id ?? null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: normalizedEmail,
        customer_address: order.delivery_address || normalizedAddress,
        customer_neighborhood:
          order.delivery_neighborhood || normalizedNeighborhood,
        order_type: orderType,
        coupon_id: order.coupon_id ?? null,
        coupon_code: order.coupon_code ?? null,
        coupon_discount: Number(order.coupon_discount ?? 0),
        delivery_fee: Number(order.delivery_fee ?? 0),
      },
    }

    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpAccessToken}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Mercado Pago PIX error:", errorText)

      await supabase
        .from("orders")
        .update({
          payment_method: "pix",
          payment_status: "failed",
        })
        .eq("id", order.id)

      return NextResponse.json(
        { error: "Erro ao criar pagamento Pix" },
        { status: 500 }
      )
    }

    const data = await response.json()

    const transactionData = data?.point_of_interaction?.transaction_data
    const qrCodeBase64 = transactionData?.qr_code_base64 || null
    const qrCode = transactionData?.qr_code || null
    const ticketUrl = transactionData?.ticket_url || null

    if (!data?.id) {
      console.error("Mercado Pago response sem payment id:", data)

      return NextResponse.json(
        { error: "Mercado Pago nao retornou um paymentId valido." },
        { status: 500 }
      )
    }

    if (!qrCodeBase64 && !qrCode && !ticketUrl) {
      console.error("Mercado Pago response sem dados do Pix:", data)

      return NextResponse.json(
        { error: "Mercado Pago nao retornou os dados do Pix." },
        { status: 500 }
      )
    }

    const { error: updateOrderError } = await supabase
      .from("orders")
      .update({
        payment_method: "pix",
        payment_status: "pending",
        mercadopago_payment_id: String(data.id),
      })
      .eq("id", order.id)

    if (updateOrderError) {
      console.error("Order update error after Pix creation:", updateOrderError)
    }

    return NextResponse.json({
      orderId: order.id,
      publicOrderNumber: order.public_order_number,
      paymentId: String(data.id),
      status: data.status || "pending",
      qrCodeBase64,
      qrCode,
      pixCopyPaste: qrCode,
      ticketUrl,
      expiresAt: data.date_of_expiration || null,
    })
  } catch (error) {
    console.error("Checkout error:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno do servidor",
      },
      { status: 500 }
    )
  }
}