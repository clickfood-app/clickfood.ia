import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { stripe } from "@/lib/stripe"

type StripePixCheckoutRequest = {
  restaurantId: string
  orderId: string
  publicOrderNumber?: string | null
  customerName: string
  customerPhone: string
  customerEmail: string
  customerDocument?: string | null
  customerAddress?: string
  customerNeighborhood?: string | null
  orderType: "delivery" | "pickup"
  deliveryFee?: number
  serviceFee?: number
  couponCode?: string | null
}

type RestaurantRow = {
  id: string
  name: string | null
  stripe_account_id: string | null
  stripe_onboarding_completed: boolean | null
  stripe_charges_enabled: boolean | null
  stripe_payouts_enabled: boolean | null
}

type OrderRow = {
  id: string
  public_order_number: string | null
  total: number | string
  status: string | null
  payment_status: string | null
  payment_method: string | null
}

function normalizeText(value?: string | null) {
  return value?.trim() || null
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || ""
}

function normalizePhone(value?: string | null) {
  return value?.replace(/\D/g, "") || ""
}

function normalizeDocument(value?: string | null) {
  return value?.replace(/\D/g, "") || ""
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StripePixCheckoutRequest

    const restaurantId = normalizeText(body.restaurantId)
    const orderId = normalizeText(body.orderId)
    const customerName = normalizeText(body.customerName)
    const customerPhone = normalizePhone(body.customerPhone)
    const customerEmail = normalizeEmail(body.customerEmail)
    const customerDocument = normalizeDocument(body.customerDocument)
    const customerAddress = normalizeText(body.customerAddress)
    const customerNeighborhood = normalizeText(body.customerNeighborhood)
    const orderType = body.orderType

    if (!restaurantId) {
      return NextResponse.json(
        { error: "restaurantId é obrigatório." },
        { status: 400 }
      )
    }

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId é obrigatório." },
        { status: 400 }
      )
    }

    if (!customerName) {
      return NextResponse.json(
        { error: "Nome do cliente é obrigatório." },
        { status: 400 }
      )
    }

    if (!customerPhone) {
      return NextResponse.json(
        { error: "Telefone do cliente é obrigatório." },
        { status: 400 }
      )
    }

    if (!customerEmail || !isValidEmail(customerEmail)) {
      return NextResponse.json(
        { error: "E-mail do cliente é obrigatório." },
        { status: 400 }
      )
    }

    if (orderType !== "delivery" && orderType !== "pickup") {
      return NextResponse.json(
        { error: "Tipo de pedido inválido." },
        { status: 400 }
      )
    }

    const { data: restaurantData, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select(`
        id,
        name,
        stripe_account_id,
        stripe_onboarding_completed,
        stripe_charges_enabled,
        stripe_payouts_enabled
      `)
      .eq("id", restaurantId)
      .maybeSingle()

    if (restaurantError) {
      return NextResponse.json(
        { error: restaurantError.message || "Erro ao buscar restaurante." },
        { status: 500 }
      )
    }

    const restaurant = restaurantData as RestaurantRow | null

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurante não encontrado." },
        { status: 404 }
      )
    }

    if (
      !restaurant.stripe_account_id ||
      !restaurant.stripe_onboarding_completed ||
      !restaurant.stripe_charges_enabled ||
      !restaurant.stripe_payouts_enabled
    ) {
      return NextResponse.json(
        { error: "Restaurante sem Stripe ativa para receber Pix." },
        { status: 400 }
      )
    }

    const { data: orderData, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(`
        id,
        public_order_number,
        total,
        status,
        payment_status,
        payment_method
      `)
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle()

    if (orderError) {
      return NextResponse.json(
        { error: orderError.message || "Erro ao buscar pedido." },
        { status: 500 }
      )
    }

    const order = orderData as OrderRow | null

    if (!order) {
      return NextResponse.json(
        { error: "Pedido não encontrado." },
        { status: 404 }
      )
    }

    if (order.payment_status === "approved" || order.payment_status === "paid") {
      return NextResponse.json(
        { error: "Este pedido já foi pago." },
        { status: 400 }
      )
    }

    if (order.status === "cancelled") {
      return NextResponse.json(
        { error: "Este pedido foi cancelado." },
        { status: 400 }
      )
    }

    const total = Number(order.total ?? 0)

    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json(
        { error: "Valor do pedido inválido." },
        { status: 400 }
      )
    }

    const amountInCents = Math.round(total * 100)

    if (amountInCents < 50) {
      return NextResponse.json(
        { error: "O valor mínimo para Pix é R$ 0,50." },
        { status: 400 }
      )
    }

    if (amountInCents > 300000) {
      return NextResponse.json(
        { error: "O valor máximo para Pix é R$ 3.000,00." },
        { status: 400 }
      )
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountInCents,
        currency: "brl",
        confirm: true,
        payment_method_types: ["pix"],
        payment_method_data: {
          type: "pix",
          billing_details: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone || undefined,
            address: customerAddress
              ? {
                  line1: customerAddress,
                }
              : undefined,
          },
        },
        receipt_email: customerEmail,
        description: `Pedido #${order.public_order_number || body.publicOrderNumber || order.id} - ${restaurant.name || "Restaurante"}`,
        metadata: {
          order_id: order.id,
          restaurant_id: restaurant.id,
          restaurant_name: restaurant.name || "",
          public_order_number:
            order.public_order_number || body.publicOrderNumber || "",
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          customer_document: customerDocument || "",
          customer_address: customerAddress || "",
          customer_neighborhood: customerNeighborhood || "",
          order_type: orderType,
          delivery_fee: String(body.deliveryFee ?? 0),
          service_fee: String(body.serviceFee ?? 0),
          coupon_code: body.couponCode || "",
        },
      },
      {
        stripeAccount: restaurant.stripe_account_id,
      }
    )

    const pixData =
      paymentIntent.next_action?.type === "pix_display_qr_code"
        ? paymentIntent.next_action.pix_display_qr_code
        : null

    if (!pixData) {
      return NextResponse.json(
        { error: "A Stripe não retornou os dados do Pix." },
        { status: 500 }
      )
    }

    const { error: updateOrderError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_method: "pix",
        payment_status: "pending",
      })
      .eq("id", order.id)

    if (updateOrderError) {
      return NextResponse.json(
        { error: updateOrderError.message || "Erro ao atualizar pedido." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      paymentId: paymentIntent.id,
      status: paymentIntent.status,
      publicOrderNumber:
        order.public_order_number || body.publicOrderNumber || null,
      qrCode: pixData.data ?? null,
      pixCopyPaste: pixData.data ?? null,
      qrCodeBase64: null,
      qrCodeUrl: pixData.image_url_png ?? null,
      ticketUrl: pixData.hosted_instructions_url ?? null,
      expiresAt: pixData.expires_at ?? null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao gerar Pix Stripe.",
      },
      { status: 500 }
    )
  }
}