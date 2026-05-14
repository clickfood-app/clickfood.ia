import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

type CreateOrderItemInput = {
  product_id: string
  quantity: number
  unit_price?: number
  notes?: string
  modifiers?: Array<{
    groupName?: string
    option?: {
      name?: string
      price?: number
    }
  }>
}

type CreateOrderBody = {
  restaurantId: string
  customerName: string
  customerPhone: string
  customerAddress?: string
  neighborhood?: string
  orderType: "delivery" | "pickup"
  paymentMethod: string
  deliveryFee?: number
  serviceFee?: number
  couponCode?: string | null
  customerNote?: string | null
  items: CreateOrderItemInput[]
}

type ValidatedOrderItem = {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function mapPaymentMethod(value: string) {
  const normalized = value.trim().toLowerCase()

  if (normalized === "pix") return "pix"
  if (normalized === "dinheiro") return "cash"

  if (
    normalized === "cartao" ||
    normalized === "cartão" ||
    normalized === "cartao na entrega"
  ) {
    return "card_on_delivery"
  }

  return normalized || "cash"
}

function buildPublicOrderNumber() {
  const now = Date.now().toString()
  const random = Math.floor(10 + Math.random() * 90).toString()

  return `${now.slice(-6)}${random}`
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateOrderBody

    const restaurantId = normalizeText(body.restaurantId)
    const customerName = normalizeText(body.customerName)
    const customerPhone = normalizeText(body.customerPhone)
    const customerAddress = normalizeText(body.customerAddress)
    const neighborhood = normalizeText(body.neighborhood)
    const orderType = body.orderType === "pickup" ? "pickup" : "delivery"
    const paymentMethodLabel = normalizeText(body.paymentMethod)
    const paymentMethod = mapPaymentMethod(paymentMethodLabel)
    const deliveryFee =
      orderType === "delivery" ? normalizeNumber(body.deliveryFee, 0) : 0
    const serviceFee = normalizeNumber(body.serviceFee, 0)
    const customerNote = normalizeText(body.customerNote)
    const items = Array.isArray(body.items) ? body.items : []

    if (!restaurantId) {
      return NextResponse.json(
        { error: "restaurantId é obrigatório." },
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

    if (orderType === "delivery" && !customerAddress) {
      return NextResponse.json(
        { error: "Endereço é obrigatório para entrega." },
        { status: 400 }
      )
    }

    if (orderType === "delivery" && !neighborhood) {
      return NextResponse.json(
        { error: "Bairro é obrigatório para entrega." },
        { status: 400 }
      )
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: "O pedido precisa ter pelo menos 1 item." },
        { status: 400 }
      )
    }

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, slug, is_active")
      .eq("id", restaurantId)
      .maybeSingle()

    if (restaurantError) {
      return NextResponse.json(
        { error: restaurantError.message || "Erro ao buscar restaurante." },
        { status: 500 }
      )
    }

    if (!restaurant || restaurant.is_active === false) {
      return NextResponse.json(
        { error: "Restaurante não encontrado ou inativo." },
        { status: 404 }
      )
    }

    const productIds = Array.from(
      new Set(items.map((item) => normalizeText(item.product_id)).filter(Boolean))
    )

    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id, restaurant_id, name, price, is_available")
      .in("id", productIds)

    if (productsError) {
      return NextResponse.json(
        { error: productsError.message || "Erro ao buscar produtos." },
        { status: 500 }
      )
    }

    const productMap = new Map(
      (products || []).map((product) => [product.id, product])
    )

    let subtotal = 0
    const validatedOrderItems: ValidatedOrderItem[] = []

    for (const item of items) {
      const productId = normalizeText(item.product_id)
      const quantity = Math.max(1, Math.floor(normalizeNumber(item.quantity, 1)))
      const product = productMap.get(productId)

      if (!product) {
        return NextResponse.json(
          { error: "Um dos produtos do pedido não foi encontrado." },
          { status: 400 }
        )
      }

      if (product.restaurant_id !== restaurantId) {
        return NextResponse.json(
          { error: "Produto não pertence a este restaurante." },
          { status: 400 }
        )
      }

      if (product.is_available === false) {
        return NextResponse.json(
          { error: `O produto "${product.name}" está indisponível.` },
          { status: 400 }
        )
      }

      const basePrice = normalizeNumber(product.price, 0)
      const clientUnitPrice = normalizeNumber(item.unit_price, basePrice)

      /*
        Mantém segurança:
        - se o cliente tentar mandar preço menor, usa o preço do banco
        - se tiver adicional/modificador e o unit_price vier maior, respeita o valor maior
      */
      const safeUnitPrice = Math.max(basePrice, clientUnitPrice)
      const lineTotal = safeUnitPrice * quantity

      subtotal += lineTotal

      validatedOrderItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: safeUnitPrice,
        total_price: lineTotal,
      })
    }

    const total = subtotal + serviceFee + deliveryFee
    const publicOrderNumber = buildPublicOrderNumber()

    const orderPayload = {
      restaurant_id: restaurantId,
      public_order_number: publicOrderNumber,
      customer_name: customerName,
      customer_phone: customerPhone,
      status: paymentMethod === "pix" ? "awaiting_payment" : "pending",
      subtotal,
      discount: 0,
      delivery_fee: deliveryFee,
      total,
      payment_method: paymentMethod,
      payment_status: "pending",
      notes: customerNote || null,
      order_type: orderType,
      delivery_address: orderType === "delivery" ? customerAddress : null,
      delivery_neighborhood: orderType === "delivery" ? neighborhood : null,
    }

    const { data: createdOrder, error: createOrderError } = await supabaseAdmin
      .from("orders")
      .insert(orderPayload)
      .select(
        "id, public_order_number, status, total, payment_method, payment_status, created_at, order_type, delivery_address, delivery_neighborhood, notes"
      )
      .single()

    if (createOrderError || !createdOrder) {
      return NextResponse.json(
        { error: createOrderError?.message || "Erro ao criar pedido." },
        { status: 500 }
      )
    }

    const orderItemsPayload = validatedOrderItems.map((item) => ({
      order_id: createdOrder.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }))

    const { error: createOrderItemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsPayload)

    if (createOrderItemsError) {
      await supabaseAdmin.from("orders").delete().eq("id", createdOrder.id)

      return NextResponse.json(
        {
          error:
            createOrderItemsError.message ||
            "Erro ao salvar os itens do pedido.",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      order: createdOrder,
      summary: {
        subtotal,
        serviceFee,
        deliveryFee,
        total,
        neighborhood,
        orderType,
      },
    })
  } catch (error) {
    console.error("POST /api/public/orders error:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao criar pedido.",
      },
      { status: 500 }
    )
  }
}