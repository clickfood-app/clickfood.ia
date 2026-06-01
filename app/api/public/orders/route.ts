import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

const DEFAULT_ONLINE_SERVICE_FEE = 1.5

type CreateOrderItemInput = {
  product_id: string
  quantity: number
  unit_price?: number
  notes?: string
  modifiers?: Array<{
    groupId?: string
    groupName?: string
    option?: {
      id?: string
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
  couponCode?: string | null
  customerNote?: string | null
  items: CreateOrderItemInput[]
}

type RestaurantRow = {
  id: string
  name: string | null
  slug: string | null
  is_active: boolean | null
  delivery_fee: number | string | null
  delivery_enabled: boolean | null
  pickup_enabled: boolean | null
  minimum_order: number | string | null
}

type ProductRow = {
  id: string
  restaurant_id: string
  name: string
  price: number | string | null
  is_available: boolean | null
}

type DeliveryFeeRuleRow = {
  id: string
  restaurant_id: string
  label: string | null
  fee: number | string | null
  neighborhoods: string[] | null
  is_active: boolean | null
  sort_order: number | null
}

type PaymentSettingsRow = {
  service_fee_amount: number | string | null
}

type NormalizedModifier = {
  groupId: string | null
  groupName: string
  optionId: string | null
  optionName: string
  optionPrice: number
}

type ValidatedOrderItem = {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  notes: string | null
  modifiers: NormalizedModifier[]
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function normalizeModifiers(
  modifiers: CreateOrderItemInput["modifiers"]
): NormalizedModifier[] {
  if (!Array.isArray(modifiers)) return []

  return modifiers
    .map((modifier) => {
      const groupName = normalizeText(modifier.groupName)
      const optionName = normalizeText(modifier.option?.name)

      if (!groupName || !optionName) return null

      return {
        groupId: normalizeText(modifier.groupId) || null,
        groupName,
        optionId: normalizeText(modifier.option?.id) || null,
        optionName,
        optionPrice: roundMoney(Math.max(0, normalizeNumber(modifier.option?.price, 0))),
      }
    })
    .filter((modifier): modifier is NormalizedModifier => Boolean(modifier))
}

function mapPaymentMethod(value: string) {
  const normalized = value.trim().toLowerCase()

  if (normalized === "pix") return "pix"
  if (normalized === "dinheiro") return "cash"

  if (
    normalized === "cartao" ||
    normalized === "cartão" ||
    normalized === "cartao na entrega" ||
    normalized === "cartão na entrega"
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

function findDeliveryRuleByNeighborhood(
  deliveryRules: DeliveryFeeRuleRow[],
  neighborhood: string
) {
  const selectedNeighborhood = normalizeSearchText(neighborhood)

  return deliveryRules.find((rule) => {
    if (rule.is_active === false) return false
    if (!Array.isArray(rule.neighborhoods)) return false

    return rule.neighborhoods.some(
      (item) => normalizeSearchText(item) === selectedNeighborhood
    )
  })
}

async function getServiceFeeAmount(restaurantId: string) {
  const { data, error } = await supabaseAdmin
    .from("restaurant_payment_settings")
    .select("service_fee_amount")
    .eq("restaurant_id", restaurantId)
    .maybeSingle()

  if (error) {
    console.warn("Erro ao buscar taxa de serviço. Usando valor padrão:", {
      restaurantId,
      message: error.message,
      code: error.code,
    })

    return DEFAULT_ONLINE_SERVICE_FEE
  }

  const paymentSettings = data as PaymentSettingsRow | null
  const serviceFee = normalizeNumber(
    paymentSettings?.service_fee_amount,
    DEFAULT_ONLINE_SERVICE_FEE
  )

  return Math.max(0, roundMoney(serviceFee))
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
      .select(
        "id, name, slug, is_active, delivery_fee, delivery_enabled, pickup_enabled, minimum_order"
      )
      .eq("id", restaurantId)
      .maybeSingle()

    if (restaurantError) {
      return NextResponse.json(
        { error: restaurantError.message || "Erro ao buscar restaurante." },
        { status: 500 }
      )
    }

    const typedRestaurant = restaurant as RestaurantRow | null

    if (!typedRestaurant || typedRestaurant.is_active === false) {
      return NextResponse.json(
        { error: "Restaurante não encontrado ou inativo." },
        { status: 404 }
      )
    }

    if (orderType === "delivery" && typedRestaurant.delivery_enabled === false) {
      return NextResponse.json(
        { error: "Este restaurante não está aceitando pedidos para entrega." },
        { status: 400 }
      )
    }

    if (orderType === "pickup" && typedRestaurant.pickup_enabled === false) {
      return NextResponse.json(
        { error: "Este restaurante não está aceitando pedidos para retirada." },
        { status: 400 }
      )
    }

    const productIds = Array.from(
      new Set(items.map((item) => normalizeText(item.product_id)).filter(Boolean))
    )

    if (productIds.length === 0) {
      return NextResponse.json(
        { error: "Nenhum produto válido foi enviado no pedido." },
        { status: 400 }
      )
    }

    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id, restaurant_id, name, price, is_available")
      .eq("restaurant_id", restaurantId)
      .in("id", productIds)

    if (productsError) {
      return NextResponse.json(
        { error: productsError.message || "Erro ao buscar produtos." },
        { status: 500 }
      )
    }

    const productMap = new Map(
      ((products || []) as ProductRow[]).map((product) => [
        product.id,
        product,
      ])
    )

    let subtotal = 0
    const validatedOrderItems: ValidatedOrderItem[] = []

    for (const item of items) {
      const productId = normalizeText(item.product_id)
      const quantity = Math.max(1, Math.floor(normalizeNumber(item.quantity, 1)))
      const product = productMap.get(productId)
      const itemNotes = normalizeText(item.notes)
      const itemModifiers = normalizeModifiers(item.modifiers)

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
        Segurança:
        - preço oficial vem do banco;
        - se o cliente tentar mandar preço menor, o backend ignora;
        - se vier maior por causa de adicional/modificador, mantém o maior valor.
      */
      const safeUnitPrice = roundMoney(Math.max(basePrice, clientUnitPrice))
      const lineTotal = roundMoney(safeUnitPrice * quantity)

      subtotal = roundMoney(subtotal + lineTotal)

      validatedOrderItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: safeUnitPrice,
        total_price: lineTotal,
        notes: itemNotes || null,
        modifiers: itemModifiers,
      })
    }

    const minimumOrder = normalizeNumber(typedRestaurant.minimum_order, 0)

    if (minimumOrder > 0 && subtotal < minimumOrder) {
      return NextResponse.json(
        {
          error: `Pedido mínimo de R$ ${minimumOrder.toFixed(2).replace(".", ",")}.`,
        },
        { status: 400 }
      )
    }

    const [{ data: deliveryRulesData, error: deliveryRulesError }, serviceFee] =
      await Promise.all([
        supabaseAdmin
          .from("delivery_fee_rules")
          .select(
            "id, restaurant_id, label, fee, neighborhoods, is_active, sort_order"
          )
          .eq("restaurant_id", restaurantId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        getServiceFeeAmount(restaurantId),
      ])

    if (deliveryRulesError) {
      return NextResponse.json(
        {
          error:
            deliveryRulesError.message ||
            "Erro ao buscar regras de taxa de entrega.",
        },
        { status: 500 }
      )
    }

    const deliveryRules = (deliveryRulesData || []) as DeliveryFeeRuleRow[]

    let deliveryFee = 0

    if (orderType === "delivery") {
      const matchedRule = findDeliveryRuleByNeighborhood(
        deliveryRules,
        neighborhood
      )

      if (deliveryRules.length > 0 && !matchedRule) {
        return NextResponse.json(
          { error: "Bairro não atendido por este restaurante." },
          { status: 400 }
        )
      }

      deliveryFee = matchedRule
        ? normalizeNumber(matchedRule.fee, 0)
        : normalizeNumber(typedRestaurant.delivery_fee, 0)

      deliveryFee = Math.max(0, roundMoney(deliveryFee))
    }

    const safeServiceFee = subtotal > 0 ? serviceFee : 0
    const discount = 0
    const total = roundMoney(subtotal + safeServiceFee + deliveryFee - discount)
    const publicOrderNumber = buildPublicOrderNumber()

    const orderPayload = {
      restaurant_id: restaurantId,
      public_order_number: publicOrderNumber,
      customer_name: customerName,
      customer_phone: customerPhone,
      status: paymentMethod === "pix" ? "awaiting_payment" : "pending",
      subtotal,
      discount,
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
      notes: item.notes,
      modifiers: item.modifiers,
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
        serviceFee: safeServiceFee,
        deliveryFee,
        discount,
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