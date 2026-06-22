import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type CreateOrderItemInput = {
  product_id: string
  quantity: number | string
}

type CreateOrderBody = {
  customer_name?: string
  customer_phone?: string
  status?: string
  payment_method?: string
  payment_status?: string
  notes?: string
  source?: string
  order_source?: string
  order_type?: string
  table_number?: string
  delivery_address?: string
  discount_amount?: number | string
  delivery_fee?: number | string
  coupon_code?: string
  items?: CreateOrderItemInput[]
}

type ProductRow = {
  id: string
  restaurant_id: string
  name: string
  price: number | string | null
  is_available: boolean | null
}

const MAX_ITEMS_PER_ORDER = 50
const MAX_QUANTITY_PER_ITEM = 99

function normalizeText(value: unknown, maxLength = 250) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function normalizeNumber(value: unknown, fallback = 0) {
  const number = Number(value)

  return Number.isFinite(number) ? number : fallback
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function buildPublicOrderNumber() {
  const now = Date.now().toString()
  const random = Math.floor(10 + Math.random() * 90).toString()

  return `${now.slice(-6)}${random}`
}

function normalizeOrderStatus(value: unknown) {
  const status = normalizeText(value, 40) || "pending"

  const allowedStatuses = [
    "pending",
    "accepted",
    "preparing",
    "ready",
    "delivering",
    "completed",
    "cancelled",
    "waiting_pix_confirmation",
    "awaiting_payment",
  ]

  return allowedStatuses.includes(status) ? status : "pending"
}

function normalizePaymentMethod(value: unknown) {
  const paymentMethod = normalizeText(value, 80).toLowerCase()

  if (paymentMethod === "dinheiro" || paymentMethod === "cash") return "cash"
  if (paymentMethod === "pix" || paymentMethod === "pix_manual") return paymentMethod

  if (
    paymentMethod === "cartao" ||
    paymentMethod === "cartão" ||
    paymentMethod === "card" ||
    paymentMethod === "card_on_delivery"
  ) {
    return "card_on_delivery"
  }

  return paymentMethod || null
}

function normalizeOrderType(value: unknown) {
  const orderType = normalizeText(value, 40).toLowerCase()

  if (orderType === "pickup" || orderType === "retirada") return "pickup"

  return "delivery"
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return jsonError("Não autorizado.", 401)
    }

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, owner_id, name")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao buscar restaurante em /api/pedidos:", {
        message: restaurantError.message,
        code: restaurantError.code,
      })

      return jsonError("Erro ao buscar restaurante.", 500)
    }

    if (!restaurant) {
      return jsonError("Restaurante não encontrado para este usuário.", 404)
    }

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        restaurant_id,
        public_order_number,
        customer_name,
        customer_phone,
        status,
        total,
        payment_method,
        payment_status,
        notes,
source,
order_source,
order_type,
        table_number,
        delivery_address,
        delivery_neighborhood,
        subtotal,
        discount,
        discount_amount,
        delivery_fee,
        coupon_code,
        created_at
      `)
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })

    if (ordersError) {
      console.error("Erro ao buscar pedidos:", {
        message: ordersError.message,
        code: ordersError.code,
      })

      return jsonError("Erro ao buscar pedidos.", 500)
    }

    const visibleOrders = (orders ?? []).filter((order) => {
      const paymentMethod = String(order.payment_method || "").toLowerCase()
      const paymentStatus = String(order.payment_status || "").toLowerCase()

      if (paymentMethod === "pix" || paymentMethod === "efi_pix") {
        return paymentStatus === "paid"
      }

      return true
    })

    return NextResponse.json({
      restaurant,
      orders: visibleOrders,
    })
  } catch (error) {
    console.error("GET /api/pedidos error:", error)

    return jsonError("Erro interno do servidor.", 500)
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return jsonError("Não autorizado.", 401)
    }

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, owner_id")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao buscar restaurante:", {
        message: restaurantError.message,
        code: restaurantError.code,
      })

      return jsonError("Erro ao buscar restaurante.", 500)
    }

    if (!restaurant) {
      return jsonError("Restaurante não encontrado para este usuário.", 404)
    }

    let body: CreateOrderBody

    try {
      body = (await req.json()) as CreateOrderBody
    } catch {
      return jsonError("Corpo da requisição inválido.", 400)
    }

    const customerName =
      normalizeText(body.customer_name, 120) || "Cliente balcão"
    const customerPhone =
      normalizeText(body.customer_phone, 30) || "Não informado"
    const status = normalizeOrderStatus(body.status)
    const paymentMethod = normalizePaymentMethod(body.payment_method)
    const paymentStatus =
      normalizeText(body.payment_status, 40) ||
      (paymentMethod === "pix_manual" || paymentMethod === "pix"
        ? "pending"
        : "pending")
    const notes = normalizeText(body.notes, 500) || null
    const source = normalizeText(body.source, 40) || "admin"
    const orderType = normalizeOrderType(body.order_type)
    const tableNumber = normalizeText(body.table_number, 40) || null
    const deliveryAddress = normalizeText(body.delivery_address, 250) || null
    const couponCode = normalizeText(body.coupon_code, 80) || null
    const discountAmount = Math.max(0, normalizeNumber(body.discount_amount, 0))
    const deliveryFee = Math.max(0, normalizeNumber(body.delivery_fee, 0))
    const items = Array.isArray(body.items) ? body.items : []

    if (items.length === 0) {
      return jsonError("Adicione ao menos um item ao pedido.", 400)
    }

    if (items.length > MAX_ITEMS_PER_ORDER) {
      return jsonError(
        `O pedido não pode ter mais de ${MAX_ITEMS_PER_ORDER} itens diferentes.`,
        400
      )
    }

    const productIds = Array.from(
      new Set(
        items
          .map((item) => normalizeText(item.product_id, 80))
          .filter(Boolean)
      )
    )

    if (productIds.length === 0) {
      return jsonError("Itens inválidos.", 400)
    }

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, restaurant_id, name, price, is_available")
      .eq("restaurant_id", restaurant.id)
      .in("id", productIds)

    if (productsError) {
      console.error("Erro ao buscar produtos:", {
        message: productsError.message,
        code: productsError.code,
      })

      return jsonError("Erro ao buscar produtos.", 500)
    }

    if (!products || products.length === 0) {
      return jsonError("Nenhum produto válido encontrado.", 400)
    }

    const productMap = new Map(
      (products as ProductRow[]).map((product) => [product.id, product])
    )

    const validOrderItems = items
      .map((item) => {
        const productId = normalizeText(item.product_id, 80)
        const product = productMap.get(productId)
        const quantity = Math.min(
          MAX_QUANTITY_PER_ITEM,
          Math.max(1, Math.floor(normalizeNumber(item.quantity, 1)))
        )

        if (!product) return null
        if (product.restaurant_id !== restaurant.id) return null
        if (product.is_available === false) return null

        const unitPrice = Math.max(0, normalizeNumber(product.price, 0))
        const totalPrice = roundMoney(unitPrice * quantity)

        return {
          product_id: product.id,
          product_name: product.name,
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
        }
      })
      .filter(
        (
          item
        ): item is {
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
          total_price: number
        } => Boolean(item)
      )

    if (validOrderItems.length === 0) {
      return jsonError("Os itens do pedido são inválidos.", 400)
    }

    const subtotal = roundMoney(
      validOrderItems.reduce((acc, item) => acc + item.total_price, 0)
    )

    const total = roundMoney(subtotal - discountAmount + deliveryFee)

    if (total < 0) {
      return jsonError("Total do pedido inválido.", 400)
    }

    const publicOrderNumber = buildPublicOrderNumber()

    const { data: createdOrder, error: createOrderError } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurant.id,
        public_order_number: publicOrderNumber,
        customer_name: customerName,
        customer_phone: customerPhone,
        status,
        subtotal,
        discount: discountAmount,
        discount_amount: discountAmount,
        delivery_fee: deliveryFee,
        total,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        notes,
        source,
        order_source: source,
        order_type: orderType,
        table_number: tableNumber,
        delivery_address: deliveryAddress,
        coupon_code: couponCode,
      })
      .select(
  "id, restaurant_id, public_order_number, customer_name, customer_phone, status, subtotal, discount, delivery_fee, total, payment_method, payment_status, notes, source, order_source, order_type, table_number, delivery_address, coupon_code, created_at"
)
      .single()

    if (createOrderError || !createdOrder) {
      console.error("Erro ao criar pedido:", {
        message: createOrderError?.message,
        code: createOrderError?.code,
      })

      return jsonError("Erro ao criar pedido.", 500)
    }

    const orderItemsToInsert = validOrderItems.map((item) => ({
      order_id: createdOrder.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }))

    const { error: orderItemsError } = await supabase
      .from("order_items")
      .insert(orderItemsToInsert)

    if (orderItemsError) {
      console.error("Erro ao criar itens do pedido:", {
        message: orderItemsError.message,
        code: orderItemsError.code,
      })

      await supabase.from("orders").delete().eq("id", createdOrder.id)

      return jsonError("Erro ao salvar os itens do pedido.", 500)
    }

    return NextResponse.json(
      {
        order: createdOrder,
        items: orderItemsToInsert,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/pedidos error:", error)

    return jsonError("Erro interno do servidor.", 500)
  }
}