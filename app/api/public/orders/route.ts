import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

const DEFAULT_ONLINE_SERVICE_FEE = 1.5
const MAX_ITEMS_PER_ORDER = 50
const MAX_QUANTITY_PER_ITEM = 99
const MAX_CUSTOMER_NAME_LENGTH = 120
const MAX_CUSTOMER_PHONE_LENGTH = 20
const MAX_ADDRESS_LENGTH = 250
const MAX_NEIGHBORHOOD_LENGTH = 120
const MAX_NOTE_LENGTH = 500
const MAX_ITEM_NOTE_LENGTH = 250

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

function normalizeText(value: unknown, maxLength?: number) {
  const text = typeof value === "string" ? value.trim() : ""

  if (!maxLength) return text

  return text.slice(0, maxLength)
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

function normalizePhone(value: unknown) {
  return String(value || "").replace(/\D/g, "")
}

function normalizeModifiers(
  modifiers: CreateOrderItemInput["modifiers"]
): NormalizedModifier[] {
  if (!Array.isArray(modifiers)) return []

  return modifiers
    .map((modifier) => {
      const groupName = normalizeText(modifier.groupName, 80)
      const optionName = normalizeText(modifier.option?.name, 120)

      if (!groupName || !optionName) return null

      return {
        groupId: normalizeText(modifier.groupId, 80) || null,
        groupName,
        optionId: normalizeText(modifier.option?.id, 80) || null,
        optionName,
        optionPrice: roundMoney(
          Math.max(0, normalizeNumber(modifier.option?.price, 0))
        ),
      }
    })
    .filter((modifier): modifier is NormalizedModifier => Boolean(modifier))
}

function mapPaymentMethod(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_")

  if (
    normalized === "pix" ||
    normalized === "pix_manual" ||
    normalized === "pix_direto" ||
    normalized === "pix_direct" ||
    normalized === "pix_sem_taxa"
  ) {
    return "pix"
  }

  if (
    normalized === "dinheiro" ||
    normalized === "cash" ||
    normalized === "money"
  ) {
    return "cash"
  }

  if (
    normalized === "cartao" ||
    normalized === "cartao_na_entrega" ||
    normalized === "cartao_entrega" ||
    normalized === "card" ||
    normalized === "card_on_delivery" ||
    normalized === "credito" ||
    normalized === "debito"
  ) {
    return "card_on_delivery"
  }

  return ""
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

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  )
}

export async function POST(request: Request) {
  try {
    let body: CreateOrderBody

    try {
      body = (await request.json()) as CreateOrderBody
    } catch {
      return jsonError("Corpo da requisição inválido.", 400)
    }

    const restaurantId = normalizeText(body.restaurantId, 80)
    const customerName = normalizeText(
      body.customerName,
      MAX_CUSTOMER_NAME_LENGTH
    )
    const customerPhone = normalizePhone(body.customerPhone).slice(
      0,
      MAX_CUSTOMER_PHONE_LENGTH
    )
    const customerAddress = normalizeText(
      body.customerAddress,
      MAX_ADDRESS_LENGTH
    )
    const neighborhood = normalizeText(
      body.neighborhood,
      MAX_NEIGHBORHOOD_LENGTH
    )
    const orderType = body.orderType === "pickup" ? "pickup" : "delivery"
    const paymentMethodLabel = normalizeText(body.paymentMethod, 80)
    const paymentMethod = mapPaymentMethod(paymentMethodLabel)
    const customerNote = normalizeText(body.customerNote, MAX_NOTE_LENGTH)
    const items = Array.isArray(body.items) ? body.items : []

    if (!restaurantId) {
      return jsonError("restaurantId é obrigatório.", 400)
    }

    if (!customerName) {
      return jsonError("Nome do cliente é obrigatório.", 400)
    }

    if (!customerPhone) {
      return jsonError("Telefone do cliente é obrigatório.", 400)
    }

    if (customerPhone.length < 10) {
      return jsonError("Telefone do cliente inválido.", 400)
    }

    if (!paymentMethod) {
      return jsonError("Forma de pagamento inválida.", 400)
    }

    if (orderType === "delivery" && !customerAddress) {
      return jsonError("Endereço é obrigatório para entrega.", 400)
    }

    if (orderType === "delivery" && !neighborhood) {
      return jsonError("Bairro é obrigatório para entrega.", 400)
    }

    if (items.length === 0) {
      return jsonError("O pedido precisa ter pelo menos 1 item.", 400)
    }

    if (items.length > MAX_ITEMS_PER_ORDER) {
      return jsonError(
        `O pedido não pode ter mais de ${MAX_ITEMS_PER_ORDER} itens diferentes.`,
        400
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
      console.error("Erro ao buscar restaurante:", restaurantError)

      return jsonError("Erro ao buscar restaurante.", 500)
    }

    const typedRestaurant = restaurant as RestaurantRow | null

    if (!typedRestaurant || typedRestaurant.is_active === false) {
      return jsonError("Restaurante não encontrado ou inativo.", 404)
    }

    if (orderType === "delivery" && typedRestaurant.delivery_enabled === false) {
      return jsonError(
        "Este restaurante não está aceitando pedidos para entrega.",
        400
      )
    }

    if (orderType === "pickup" && typedRestaurant.pickup_enabled === false) {
      return jsonError(
        "Este restaurante não está aceitando pedidos para retirada.",
        400
      )
    }

    const productIds = Array.from(
      new Set(items.map((item) => normalizeText(item.product_id, 80)).filter(Boolean))
    )

    if (productIds.length === 0) {
      return jsonError("Nenhum produto válido foi enviado no pedido.", 400)
    }

    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id, restaurant_id, name, price, is_available")
      .eq("restaurant_id", restaurantId)
      .in("id", productIds)

    if (productsError) {
      console.error("Erro ao buscar produtos:", productsError)

      return jsonError("Erro ao buscar produtos.", 500)
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
      const productId = normalizeText(item.product_id, 80)
      const quantity = Math.min(
        MAX_QUANTITY_PER_ITEM,
        Math.max(1, Math.floor(normalizeNumber(item.quantity, 1)))
      )
      const product = productMap.get(productId)
      const itemNotes = normalizeText(item.notes, MAX_ITEM_NOTE_LENGTH)
      const itemModifiers = normalizeModifiers(item.modifiers)

      if (!product) {
        return jsonError("Um dos produtos do pedido não foi encontrado.", 400)
      }

      if (product.restaurant_id !== restaurantId) {
        return jsonError("Produto não pertence a este restaurante.", 400)
      }

      if (product.is_available === false) {
        return jsonError(`O produto "${product.name}" está indisponível.`, 400)
      }

      const basePrice = Math.max(0, normalizeNumber(product.price, 0))
      const clientUnitPrice = Math.max(
        0,
        normalizeNumber(item.unit_price, basePrice)
      )

      /*
        Segurança:
        - o preço oficial vem do banco;
        - se o cliente tentar mandar preço menor, o backend ignora;
        - se vier maior por adicional/modificador, mantém o maior valor.
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
      return jsonError(
        `Pedido mínimo de R$ ${minimumOrder.toFixed(2).replace(".", ",")}.`,
        400
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
      console.error("Erro ao buscar regras de taxa de entrega:", deliveryRulesError)

      return jsonError("Erro ao buscar regras de taxa de entrega.", 500)
    }

    const deliveryRules = (deliveryRulesData || []) as DeliveryFeeRuleRow[]

    let deliveryFee = 0

    if (orderType === "delivery") {
      const matchedRule = findDeliveryRuleByNeighborhood(
        deliveryRules,
        neighborhood
      )

      if (deliveryRules.length > 0 && !matchedRule) {
        return jsonError("Bairro não atendido por este restaurante.", 400)
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
      console.error("Erro ao criar pedido:", createOrderError)

      return jsonError("Erro ao criar pedido.", 500)
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
      console.error("Erro ao salvar itens do pedido:", createOrderItemsError)

      await supabaseAdmin.from("orders").delete().eq("id", createdOrder.id)

      return jsonError("Erro ao salvar os itens do pedido.", 500)
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

    return jsonError("Erro inesperado ao criar pedido.", 500)
  }
}