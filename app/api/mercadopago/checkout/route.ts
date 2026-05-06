import { NextRequest, NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

interface CheckoutItem {
  product_id: string
  quantity: number
}

interface CheckoutRequest {
  restaurantId: string
  items: CheckoutItem[]
  customerName: string
  customerPhone: string
  customerAddress?: string
  neighborhood?: string
  customerNote?: string | null
  orderType: "delivery" | "pickup"
  deliveryFee?: number
  serviceFee?: number
  couponCode?: string | null
}

interface ProductRow {
  id: string
  name: string
  price: number
  restaurant_id: string
}

interface MercadoPagoConnectionRow {
  restaurant_id: string
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  mp_user_id: string | null
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

function generatePublicOrderNumber() {
  return `PD-${Date.now().toString().slice(-6)}`
}

function normalizeCouponCode(code?: string | null) {
  return code?.trim().toUpperCase() || null
}

function normalizeText(value?: string | null) {
  return value?.trim() || null
}

function calculateCouponDiscount({
  type,
  value,
  subtotal,
}: {
  type: "percentage" | "fixed"
  value: number
  subtotal: number
}) {
  if (type === "percentage") {
    return Number(((subtotal * value) / 100).toFixed(2))
  }

  return Math.min(subtotal, value)
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutRequest = await request.json()

    const {
      restaurantId,
      items,
      customerName,
      customerPhone,
      customerAddress,
      neighborhood,
      customerNote,
      orderType,
      deliveryFee = 0,
      serviceFee = 0,
      couponCode,
    } = body

    if (!restaurantId) {
      return NextResponse.json(
        { error: "Restaurante inválido" },
        { status: 400 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Carrinho vazio" }, { status: 400 })
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

    if (orderType !== "delivery" && orderType !== "pickup") {
      return NextResponse.json(
        { error: "Tipo de pedido inválido" },
        { status: 400 }
      )
    }

    const parsedDeliveryFee = Number(deliveryFee)
    const parsedServiceFee = Number(serviceFee)
    const normalizedAddress = normalizeText(customerAddress)
    const normalizedNeighborhood = normalizeText(neighborhood)
    const normalizedCustomerNote = normalizeText(customerNote)

    if (orderType === "delivery" && !normalizedAddress) {
      return NextResponse.json(
        { error: "Endereço é obrigatório para entrega" },
        { status: 400 }
      )
    }

    if (Number.isNaN(parsedDeliveryFee) || parsedDeliveryFee < 0) {
      return NextResponse.json(
        { error: "Taxa de entrega inválida" },
        { status: 400 }
      )
    }

    if (Number.isNaN(parsedServiceFee) || parsedServiceFee < 0) {
      return NextResponse.json(
        { error: "Taxa de serviço inválida" },
        { status: 400 }
      )
    }

    const normalizedRequestItems = items.map((item) => ({
      product_id: String(item.product_id || "").trim(),
      quantity: Number(item.quantity ?? 0),
    }))

    if (
      normalizedRequestItems.some(
        (item) =>
          !item.product_id ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0
      )
    ) {
      return NextResponse.json(
        { error: "Itens do pedido inválidos" },
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

    const uniqueProductIds = [
      ...new Set(normalizedRequestItems.map((item) => item.product_id)),
    ]

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, restaurant_id")
      .eq("restaurant_id", restaurantId)
      .in("id", uniqueProductIds)

    if (productsError) {
      console.error("Products fetch error:", productsError)
      return NextResponse.json(
        { error: "Erro ao validar produtos do pedido" },
        { status: 500 }
      )
    }

    if (!products || products.length !== uniqueProductIds.length) {
      return NextResponse.json(
        { error: "Um ou mais produtos são inválidos para este restaurante" },
        { status: 400 }
      )
    }

    const productMap = new Map(
      (products as ProductRow[]).map((product) => [String(product.id), product])
    )

    const normalizedItems = normalizedRequestItems.map((item) => {
      const product = productMap.get(item.product_id)

      if (!product) {
        throw new Error("Produto não encontrado para este restaurante")
      }

      const unitPrice = Number(product.price ?? 0)

      return {
        product_id: String(product.id),
        title: product.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: Number((unitPrice * item.quantity).toFixed(2)),
      }
    })

    const subtotal = Number(
      normalizedItems
        .reduce((sum, item) => sum + item.total_price, 0)
        .toFixed(2)
    )

    const { data: customerId, error: customerError } = await supabase.rpc(
      "find_or_create_customer",
      {
        p_restaurant_id: restaurantId,
        p_name: customerName,
        p_phone: customerPhone,
        p_email: null,
      }
    )

    if (customerError || !customerId) {
      throw new Error("Erro ao criar/buscar cliente")
    }

    const normalizedCouponCode = normalizeCouponCode(couponCode)

    let resolvedCouponId: string | null = null
    let resolvedCouponCode: string | null = null
    let discount = 0

    if (normalizedCouponCode) {
      const { data: coupon, error: couponError } = await supabase
        .from("coupons")
        .select(
          "id, code, type, value, minimum_order, valid_until, status, usage_limit, used_count"
        )
        .eq("restaurant_id", restaurantId)
        .eq("code", normalizedCouponCode)
        .single()

      if (couponError || !coupon) {
        return NextResponse.json({ error: "Cupom inválido" }, { status: 400 })
      }

      if (coupon.status !== "active") {
        return NextResponse.json({ error: "Cupom inativo" }, { status: 400 })
      }

      const validUntil = new Date(`${coupon.valid_until}T23:59:59`)
      if (validUntil < new Date()) {
        return NextResponse.json({ error: "Cupom expirado" }, { status: 400 })
      }

      if (subtotal < Number(coupon.minimum_order || 0)) {
        return NextResponse.json(
          { error: "Pedido mínimo não atingido para este cupom" },
          { status: 400 }
        )
      }

      if (Number(coupon.used_count || 0) >= Number(coupon.usage_limit || 0)) {
        return NextResponse.json({ error: "Cupom esgotado" }, { status: 400 })
      }

      discount = calculateCouponDiscount({
        type: coupon.type as "percentage" | "fixed",
        value: Number(coupon.value),
        subtotal,
      })

      resolvedCouponId = coupon.id
      resolvedCouponCode = coupon.code
    }

    const total = Math.max(
      Number((subtotal + parsedServiceFee + parsedDeliveryFee - discount).toFixed(2)),
      0
    )

    const publicOrderNumber = generatePublicOrderNumber()

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurantId,
        public_order_number: publicOrderNumber,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        status: "pending",
        subtotal,
        discount,
        delivery_fee: parsedDeliveryFee,
        total,
        payment_method: "mercadopago",
        payment_status: "pending",
        notes: normalizedCustomerNote,
        order_type: orderType,
        delivery_address: orderType === "delivery" ? normalizedAddress : null,
        delivery_neighborhood:
          orderType === "delivery" ? normalizedNeighborhood : null,
        coupon_id: resolvedCouponId,
        coupon_code: resolvedCouponCode,
        coupon_discount: discount,
      })
      .select("id, public_order_number")
      .single()

    if (orderError || !order) {
      console.error("Order insert error:", orderError)
      return NextResponse.json(
        { error: "Erro ao salvar pedido" },
        { status: 500 }
      )
    }

    const orderItemsPayload = normalizedItems.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.title,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }))

    const { error: orderItemsError } = await supabase
      .from("order_items")
      .insert(orderItemsPayload)

    if (orderItemsError) {
      console.error("Order items insert error:", orderItemsError)

      await supabase.from("orders").delete().eq("id", order.id)

      return NextResponse.json(
        { error: "Erro ao salvar itens do pedido" },
        { status: 500 }
      )
    }

    const preferenceItems = normalizedItems.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      unit_price: item.unit_price,
      currency_id: "BRL",
      description: "",
    }))

    if (parsedServiceFee > 0) {
      preferenceItems.push({
        title: "Taxa de servico",
        quantity: 1,
        unit_price: parsedServiceFee,
        currency_id: "BRL",
        description: "Taxa de servico do pedido",
      })
    }

    if (orderType === "delivery" && parsedDeliveryFee > 0) {
      preferenceItems.push({
        title: "Taxa de entrega",
        quantity: 1,
        unit_price: parsedDeliveryFee,
        currency_id: "BRL",
        description: "Taxa de entrega",
      })
    }

    if (discount > 0) {
      preferenceItems.push({
        title: "Desconto aplicado",
        quantity: 1,
        unit_price: -discount,
        currency_id: "BRL",
        description: resolvedCouponCode
          ? `Cupom ${resolvedCouponCode}`
          : "Desconto promocional",
      })
    }

    const preference = {
      items: preferenceItems,
      payer: {
        name: customerName,
        phone: {
          number: customerPhone.replace(/\D/g, ""),
        },
        address: normalizedAddress
          ? {
              street_name: normalizedAddress,
            }
          : undefined,
      },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL || "https://clickfood.vercel.app"}/cardapio/pedido-confirmado`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL || "https://clickfood.vercel.app"}/cardapio/pedido-falhou`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL || "https://clickfood.vercel.app"}/cardapio/pedido-pendente`,
      },
      auto_return: "approved",
      statement_descriptor: "CLICKFOOD",
      external_reference: order.id,
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://clickfood.vercel.app"}/api/mercadopago/webhook`,
      metadata: {
        order_id: order.id,
        public_order_number: order.public_order_number,
        restaurant_id: restaurantId,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: normalizedAddress,
        customer_neighborhood: normalizedNeighborhood,
        order_type: orderType,
        coupon_id: resolvedCouponId,
        coupon_code: resolvedCouponCode,
        coupon_discount: discount,
      },
    }

    const response = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mpAccessToken}`,
        },
        body: JSON.stringify(preference),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error("Mercado Pago error:", error)

      await supabase.from("orders").delete().eq("id", order.id)

      return NextResponse.json(
        { error: "Erro ao criar checkout" },
        { status: 500 }
      )
    }

   const data = await response.json()

const checkoutUrl =
  data.init_point ||
  data.sandbox_init_point ||
  data?.point_of_interaction?.transaction_data?.ticket_url ||
  null

if (!checkoutUrl) {
  console.error("Mercado Pago response sem URL de checkout:", data)

  await supabase.from("orders").delete().eq("id", order.id)

  return NextResponse.json(
    { error: "Mercado Pago nao retornou uma URL de checkout valida." },
    { status: 500 }
  )
}

return NextResponse.json({
  checkoutUrl,
  preferenceId: data.id,
  orderId: order.id,
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