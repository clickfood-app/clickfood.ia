import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

const MAX_ITEMS_PER_ORDER = 50
const MAX_QUANTITY_PER_ITEM = 99
const MAX_CUSTOMER_NAME_LENGTH = 120
const MAX_CUSTOMER_PHONE_LENGTH = 20
const MAX_ADDRESS_LENGTH = 250
const MAX_NEIGHBORHOOD_LENGTH = 120
const MAX_NOTE_LENGTH = 500
const MAX_ITEM_NOTE_LENGTH = 250
const MAX_ORDER_NUMBER_RETRIES = 5

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
  tableId?: string | null
  customerName: string
  customerPhone: string
  customerAddress?: string
  neighborhood?: string
  orderType: "delivery" | "pickup"
  paymentMethod: string
  needsChange?: boolean | string | null
  changeFor?: number | string | null
  couponCode?: string | null
  customerNote?: string | null
  cashback?: {
    walletId?: string | null
    campaignId?: string | null
    amount?: number | string | null
  } | null
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
  auto_accept_orders: boolean | null
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

type CashbackWalletRow = {
  id: string
  restaurant_id: string
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  balance: number | string | null
  total_earned: number | string | null
  total_redeemed: number | string | null
}

type CashbackCampaignRow = {
  id: string
  restaurant_id: string
  name: string | null
  status: string | null
  campaign_type: string | null
  reward_config: Record<string, unknown> | null
  target_config: Record<string, unknown> | null
  minimum_order_amount: number | string | null
  starts_at: string | null
  ends_at: string | null
}

type CashbackRedeemData = {
  wallet: CashbackWalletRow
  campaign: CashbackCampaignRow
  amount: number
}

type CreatedOrderRow = {
  id: string
  public_order_number: string
  status: string
  subtotal: number
  discount: number
  delivery_fee: number
  service_fee: number
  total: number
  payment_method: string
  payment_status: string
  needs_change?: boolean | null
  change_for?: number | string | null
  created_at: string
  order_type: string
  delivery_address: string | null
  delivery_neighborhood: string | null
  notes: string | null
  order_source: string | null
}

type PublicOrderFastResponse = {
  success: boolean
  error?: string
  order?: CreatedOrderRow
  summary?: {
    subtotal: number
    serviceFee: number
    deliveryFee: number
    discount: number
    total: number
    neighborhood: string
    orderType: string
    cashback: null
  }
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

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()

    return ["true", "1", "sim", "yes", "s"].includes(normalized)
  }

  return false
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

type PublicPaymentMethod =
  | "pix_manual"
  | "pix"
  | "cash"
  | "card_on_delivery"
  | ""

function mapPaymentMethod(value: string): PublicPaymentMethod {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_")

  if (
    normalized === "pix_manual" ||
    normalized === "pix_direto" ||
    normalized === "pix_direct" ||
    normalized === "pix_sem_taxa"
  ) {
    return "pix_manual"
  }

  if (normalized === "pix") {
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
  const now = Date.now().toString().slice(-7)
  const random = randomInt(100, 999).toString()

  return `${now}${random}`
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

function isCampaignInsidePeriod(campaign: CashbackCampaignRow) {
  const now = new Date()

  if (campaign.starts_at) {
    const startsAt = new Date(campaign.starts_at)

    if (!Number.isNaN(startsAt.getTime()) && startsAt > now) {
      return false
    }
  }

  if (campaign.ends_at) {
    const endsAt = new Date(campaign.ends_at)

    if (!Number.isNaN(endsAt.getTime()) && endsAt < now) {
      return false
    }
  }

  return true
}

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}

async function createOrderWithRetry(orderPayload: Record<string, unknown>) {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= MAX_ORDER_NUMBER_RETRIES; attempt++) {
    const publicOrderNumber = buildPublicOrderNumber()

    const { data, error } = await supabaseAdmin
      .from("orders")
      .insert({
        ...orderPayload,
        public_order_number: publicOrderNumber,
      })
      .select(
        "id, public_order_number, status, subtotal, discount, delivery_fee, service_fee, total, payment_method, payment_status, needs_change, change_for, created_at, order_type, delivery_address, delivery_neighborhood, notes, order_source"
      )
      .single()

    if (!error && data) {
      return {
        order: data as CreatedOrderRow,
        error: null,
      }
    }

    lastError = error

    const isDuplicatePublicNumber =
      error?.code === "23505" &&
      String(error?.message || "").includes(
        "orders_restaurant_public_order_number_unique"
      )

    if (!isDuplicatePublicNumber) {
      return {
        order: null,
        error,
      }
    }
  }

  return {
    order: null,
    error: lastError,
  }
}

function canAutoAcceptPublicOrder(paymentMethod: PublicPaymentMethod) {
  return paymentMethod === "cash" || paymentMethod === "card_on_delivery"
}

async function getRestaurantAutoAcceptOrders(restaurantId: string) {
  const { data, error } = await supabaseAdmin
    .from("restaurants")
    .select("auto_accept_orders")
    .eq("id", restaurantId)
    .maybeSingle()

  if (error) {
    console.error("Erro ao buscar aceite automático do restaurante:", {
      restaurantId,
      message: error.message,
      code: error.code,
    })

    return false
  }

  return Boolean(data?.auto_accept_orders)
}

async function createDesktopPrintJobForOrder(orderId: string, forceReprint = false) {
  const { data, error } = await supabaseAdmin.rpc(
    "create_order_print_job_for_order",
    {
      p_order_id: orderId,
      p_force_reprint: forceReprint,
    }
  )

  if (error) {
    throw error
  }

  const result = data as {
    success?: boolean
    error?: string
    jobId?: string
    status?: string
    alreadyExists?: boolean
  } | null

  if (result?.success === false) {
    throw new Error(result.error || "Erro ao criar job de impressão.")
  }

  return result
}

async function autoAcceptCreatedOrderIfEnabled({
  restaurantId,
  orderId,
  paymentMethod,
}: {
  restaurantId: string
  orderId: string
  paymentMethod: PublicPaymentMethod
}) {
  if (!orderId) return false

  if (!canAutoAcceptPublicOrder(paymentMethod)) {
    return false
  }

  const autoAcceptOrders = await getRestaurantAutoAcceptOrders(restaurantId)

  if (!autoAcceptOrders) {
    return false
  }

  const nowIso = new Date().toISOString()

  const { error: updateOrderError } = await supabaseAdmin
    .from("orders")
    .update({
      status: "accepted",
      accepted_at: nowIso,
      preparation_started_at: nowIso,
    })
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)

  if (updateOrderError) {
    console.error("Erro ao aceitar pedido automaticamente:", {
      restaurantId,
      orderId,
      message: updateOrderError.message,
      code: updateOrderError.code,
    })

    return false
  }

  try {
    await createDesktopPrintJobForOrder(orderId)
  } catch (printJobError) {
    console.error("Pedido autoaceito, mas job de impressão não foi criado:", {
      restaurantId,
      orderId,
      error: printJobError,
    })
  }

  return true
}

async function createOrderFast({
  restaurantId,
  customerName,
  customerPhone,
  orderType,
  paymentMethod,
  customerAddress,
  neighborhood,
  customerNote,
  items,
}: {
  restaurantId: string
  customerName: string
  customerPhone: string
  orderType: "delivery" | "pickup"
  paymentMethod: Exclude<PublicPaymentMethod, "">
  customerAddress: string
  neighborhood: string
  customerNote: string
  items: CreateOrderItemInput[]
}) {
  const rpcItems = items.map((item) => ({
    product_id: normalizeText(item.product_id, 80),
    quantity: Math.min(
      MAX_QUANTITY_PER_ITEM,
      Math.max(1, Math.floor(normalizeNumber(item.quantity, 1)))
    ),
    unit_price:
      item.unit_price === undefined || item.unit_price === null
        ? null
        : Math.max(0, normalizeNumber(item.unit_price, 0)),
    notes: normalizeText(item.notes, MAX_ITEM_NOTE_LENGTH) || null,
    modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
  }))

  const { data, error } = await supabaseAdmin.rpc("create_public_order_fast", {
    p_restaurant_id: restaurantId,
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_order_type: orderType,
    p_payment_method: paymentMethod,
    p_customer_address: customerAddress || null,
    p_neighborhood: neighborhood || null,
    p_customer_note: customerNote || null,
    p_items: rpcItems,
  })

  if (error) {
    console.error("Erro ao criar pedido via RPC rápida:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })

    return {
      response: null,
      error,
    }
  }

  return {
    response: data as PublicOrderFastResponse | null,
    error: null,
  }
}

async function createOrderLegacy({
  restaurantId,
  tableId,
  customerName,
  customerPhone,
  customerAddress,
  neighborhood,
  orderType,
  paymentMethod,
  customerNote,
  needsChange,
  changeFor,
  requestedCashbackWalletId,
  requestedCashbackCampaignId,
  requestedCashbackAmount,
  items,
}: {
  restaurantId: string
  tableId: string | null
  customerName: string
  customerPhone: string
  customerAddress: string
  neighborhood: string
  orderType: "delivery" | "pickup"
  paymentMethod: Exclude<PublicPaymentMethod, "">
  customerNote: string
  needsChange: boolean
  changeFor: number | null
  requestedCashbackWalletId: string
  requestedCashbackCampaignId: string
  requestedCashbackAmount: number
  items: CreateOrderItemInput[]
}) {
  const productIds = Array.from(
    new Set(
      items
        .map((item) => normalizeText(item.product_id, 80))
        .filter(Boolean)
    )
  )

  if (productIds.length === 0) {
    return jsonError("Nenhum produto válido foi enviado no pedido.", 400)
  }

  const [
    { data: restaurant, error: restaurantError },
    { data: products, error: productsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("restaurants")
      .select(
        "id, name, slug, is_active, delivery_fee, delivery_enabled, pickup_enabled, minimum_order, auto_accept_orders"
      )
      .eq("id", restaurantId)
      .maybeSingle(),
    supabaseAdmin
      .from("products")
      .select("id, restaurant_id, name, price, is_available")
      .eq("restaurant_id", restaurantId)
      .in("id", productIds),
  ])

  if (restaurantError) {
    console.error("Erro ao buscar restaurante:", restaurantError)

    return jsonError("Erro ao buscar restaurante.", 500)
  }

  if (productsError) {
    console.error("Erro ao buscar produtos:", productsError)

    return jsonError("Erro ao buscar produtos.", 500)
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

  const productMap = new Map(
    ((products || []) as ProductRow[]).map((product) => [product.id, product])
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

  let deliveryFee = 0

  if (orderType === "delivery") {
    const { data: deliveryRulesData, error: deliveryRulesError } =
      await supabaseAdmin
        .from("delivery_fee_rules")
        .select(
          "id, restaurant_id, label, fee, neighborhoods, is_active, sort_order"
        )
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })

    if (deliveryRulesError) {
      console.error(
        "Erro ao buscar regras de taxa de entrega:",
        deliveryRulesError
      )

      return jsonError("Erro ao buscar regras de taxa de entrega.", 500)
    }

    const deliveryRules = (deliveryRulesData || []) as DeliveryFeeRuleRow[]
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

  const safeServiceFee = 0
  let discount = 0
  let cashbackRedeemData: CashbackRedeemData | null = null

  if (requestedCashbackAmount > 0) {
    if (!requestedCashbackWalletId) {
      return jsonError("Carteira de cashback inválida.", 400)
    }

    const { data: walletData, error: walletError } = await supabaseAdmin
      .from("cashback_wallets")
      .select(
        "id, restaurant_id, customer_id, customer_name, customer_phone, balance, total_earned, total_redeemed"
      )
      .eq("id", requestedCashbackWalletId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle()

    if (walletError) {
      console.error("Erro ao buscar carteira de cashback:", {
        restaurantId,
        customerPhone,
        message: walletError.message,
        code: walletError.code,
      })

      return jsonError("Erro ao validar cashback.", 500)
    }

    const wallet = walletData as CashbackWalletRow | null

    if (!wallet) {
      return jsonError("Carteira de cashback não encontrada.", 400)
    }

    if (normalizePhone(wallet.customer_phone) !== customerPhone) {
      return jsonError("Cashback não pertence a este cliente.", 400)
    }

    const walletBalance = roundMoney(
      Math.max(0, normalizeNumber(wallet.balance, 0))
    )

    if (walletBalance <= 0) {
      return jsonError("Cliente não possui saldo de cashback.", 400)
    }

    const campaignQuery = supabaseAdmin
      .from("campaigns")
      .select(
        "id, restaurant_id, name, status, campaign_type, reward_config, target_config, minimum_order_amount, starts_at, ends_at"
      )
      .eq("restaurant_id", restaurantId)
      .eq("campaign_type", "cashback")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5)

    const campaignQueryWithId = requestedCashbackCampaignId
      ? campaignQuery.eq("id", requestedCashbackCampaignId)
      : campaignQuery

    const { data: campaignsData, error: campaignError } =
      await campaignQueryWithId

    if (campaignError) {
      console.error("Erro ao buscar campanha de cashback:", {
        restaurantId,
        message: campaignError.message,
        code: campaignError.code,
      })

      return jsonError("Erro ao validar campanha de cashback.", 500)
    }

    const activeCampaign = (
      (campaignsData || []) as CashbackCampaignRow[]
    ).find(isCampaignInsidePeriod)

    if (!activeCampaign) {
      return jsonError("Campanha de cashback não está ativa.", 400)
    }

    const rewardConfig = activeCampaign.reward_config || {}
    const targetConfig = activeCampaign.target_config || {}

    const redeemAmount = roundMoney(
      Math.max(
        0,
        normalizeNumber(
          rewardConfig.redeem_amount ?? rewardConfig.cashback_amount,
          0
        )
      )
    )

    const redeemMinimumOrderAmount = roundMoney(
      Math.max(0, normalizeNumber(targetConfig.redeem_minimum_order_amount, 0))
    )

    if (redeemMinimumOrderAmount > 0 && subtotal < redeemMinimumOrderAmount) {
      return jsonError(
        `Cashback disponível apenas em pedidos acima de R$ ${redeemMinimumOrderAmount
          .toFixed(2)
          .replace(".", ",")}.`,
        400
      )
    }

    const maxAllowedDiscount = roundMoney(
      Math.min(walletBalance, redeemAmount > 0 ? redeemAmount : walletBalance)
    )

    discount = roundMoney(Math.min(requestedCashbackAmount, maxAllowedDiscount))

    if (discount <= 0) {
      return jsonError("Valor de cashback inválido.", 400)
    }

    cashbackRedeemData = {
      wallet,
      campaign: activeCampaign,
      amount: discount,
    }
  }

  const total = roundMoney(subtotal + safeServiceFee + deliveryFee - discount)

  if (needsChange && (!changeFor || changeFor < total)) {
    return jsonError(
      "O valor informado para troco precisa ser maior ou igual ao total do pedido.",
      400
    )
  }

  const shouldAutoAcceptOrder =
    Boolean(typedRestaurant.auto_accept_orders) &&
    canAutoAcceptPublicOrder(paymentMethod)

  const nowIso = new Date().toISOString()

  const initialStatus = shouldAutoAcceptOrder
    ? "accepted"
    : paymentMethod === "pix_manual"
      ? "waiting_payment"
      : paymentMethod === "pix"
        ? "awaiting_payment"
        : "pending"

  const initialPaymentStatus =
    paymentMethod === "pix_manual" ? "waiting_customer_payment" : "pending"

  const orderPayload = {
    restaurant_id: restaurantId,
    customer_name: customerName,
    customer_phone: customerPhone,
    status: initialStatus,
    subtotal,
    discount,
    delivery_fee: deliveryFee,
    service_fee: safeServiceFee,
    total,
    payment_method: paymentMethod,
    payment_status: initialPaymentStatus,
    needs_change: needsChange,
    change_for: needsChange ? changeFor : null,
    notes: customerNote || null,
    order_type: orderType,
    delivery_address: orderType === "delivery" ? customerAddress : null,
    delivery_neighborhood: orderType === "delivery" ? neighborhood : null,
    table_id: tableId,
    order_source: "public",
    accepted_at: shouldAutoAcceptOrder ? nowIso : null,
    preparation_started_at: shouldAutoAcceptOrder ? nowIso : null,
  }

  const { order: createdOrder, error: createOrderError } =
    await createOrderWithRetry(orderPayload)

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

  if (cashbackRedeemData) {
    const currentBalance = roundMoney(
      Math.max(0, normalizeNumber(cashbackRedeemData.wallet.balance, 0))
    )

    const currentRedeemed = roundMoney(
      Math.max(0, normalizeNumber(cashbackRedeemData.wallet.total_redeemed, 0))
    )

    const nextBalance = roundMoney(currentBalance - cashbackRedeemData.amount)
    const nextTotalRedeemed = roundMoney(
      currentRedeemed + cashbackRedeemData.amount
    )

    const { error: updateCashbackWalletError } = await supabaseAdmin
      .from("cashback_wallets")
      .update({
        balance: nextBalance,
        total_redeemed: nextTotalRedeemed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cashbackRedeemData.wallet.id)
      .eq("restaurant_id", restaurantId)

    if (updateCashbackWalletError) {
      console.error("Erro ao baixar saldo de cashback:", {
        restaurantId,
        orderId: createdOrder.id,
        walletId: cashbackRedeemData.wallet.id,
        message: updateCashbackWalletError.message,
        code: updateCashbackWalletError.code,
      })

      await supabaseAdmin
        .from("order_items")
        .delete()
        .eq("order_id", createdOrder.id)
      await supabaseAdmin.from("orders").delete().eq("id", createdOrder.id)

      return jsonError("Não foi possível aplicar o cashback.", 500)
    }

    const { error: cashbackTransactionError } = await supabaseAdmin
      .from("cashback_transactions")
      .insert({
        restaurant_id: restaurantId,
        wallet_id: cashbackRedeemData.wallet.id,
        customer_id: cashbackRedeemData.wallet.customer_id ?? null,
        order_id: createdOrder.id,
        campaign_id: cashbackRedeemData.campaign.id,
        type: "redeemed",
        amount: cashbackRedeemData.amount,
        description: `Cashback usado no pedido #${createdOrder.public_order_number}.`,
        expires_at: null,
      })

    if (cashbackTransactionError) {
      console.error("Erro ao registrar uso de cashback:", {
        restaurantId,
        orderId: createdOrder.id,
        walletId: cashbackRedeemData.wallet.id,
        message: cashbackTransactionError.message,
        code: cashbackTransactionError.code,
      })

      await supabaseAdmin
        .from("cashback_wallets")
        .update({
          balance: currentBalance,
          total_redeemed: currentRedeemed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cashbackRedeemData.wallet.id)
        .eq("restaurant_id", restaurantId)

      await supabaseAdmin
        .from("order_items")
        .delete()
        .eq("order_id", createdOrder.id)
      await supabaseAdmin.from("orders").delete().eq("id", createdOrder.id)

      return jsonError("Não foi possível registrar o uso do cashback.", 500)
    }
  }

  if (shouldAutoAcceptOrder) {
    try {
      await createDesktopPrintJobForOrder(createdOrder.id)
    } catch (printJobError) {
      console.error("Pedido autoaceito, mas job de impressão não foi criado:", {
        restaurantId,
        orderId: createdOrder.id,
        error: printJobError,
      })
    }
  }

  return NextResponse.json(
    {
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
        needsChange,
        changeFor: needsChange ? changeFor : null,
        cashback: cashbackRedeemData
          ? {
              walletId: cashbackRedeemData.wallet.id,
              campaignId: cashbackRedeemData.campaign.id,
              amount: cashbackRedeemData.amount,
            }
          : null,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
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
    const tableId = normalizeText(body.tableId, 80) || null
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
    const wantsChange = normalizeBoolean(body.needsChange)
    const needsChange = paymentMethod === "cash" ? wantsChange : false
    const changeFor = needsChange
      ? roundMoney(Math.max(0, normalizeNumber(body.changeFor, 0)))
      : null
    const customerNote = normalizeText(body.customerNote, MAX_NOTE_LENGTH)
    const requestedCashbackWalletId = normalizeText(body.cashback?.walletId, 80)
    const requestedCashbackCampaignId = normalizeText(
      body.cashback?.campaignId,
      80
    )
    const requestedCashbackAmount = roundMoney(
      Math.max(0, normalizeNumber(body.cashback?.amount, 0))
    )
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

    if (needsChange && (!changeFor || changeFor <= 0)) {
      return jsonError("Informe o valor para troco.", 400)
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

    const hasCashback =
      requestedCashbackAmount > 0 ||
      Boolean(requestedCashbackWalletId) ||
      Boolean(requestedCashbackCampaignId)

    const canUseFastPath = !hasCashback && !tableId && !needsChange

    if (canUseFastPath) {
      const { response, error } = await createOrderFast({
        restaurantId,
        customerName,
        customerPhone,
        customerAddress,
        neighborhood,
        orderType,
        paymentMethod,
        customerNote,
        items,
      })

      if (error) {
        return jsonError("Erro ao criar pedido.", 500)
      }

      if (!response) {
        return jsonError("Erro ao criar pedido.", 500)
      }

      if (!response.success) {
        return jsonError(response.error || "Não foi possível criar o pedido.", 400)
      }

      if (response.order?.id) {
        const autoAccepted = await autoAcceptCreatedOrderIfEnabled({
          restaurantId,
          orderId: response.order.id,
          paymentMethod,
        })

        if (autoAccepted) {
          response.order.status = "accepted"
        }
      }

      return NextResponse.json(response, {
        headers: {
          "Cache-Control": "no-store",
        },
      })
    }

    return await createOrderLegacy({
      restaurantId,
      tableId,
      customerName,
      customerPhone,
      customerAddress,
      neighborhood,
      orderType,
      paymentMethod,
      customerNote,
      needsChange,
      changeFor,
      requestedCashbackWalletId,
      requestedCashbackCampaignId,
      requestedCashbackAmount,
      items,
    })
  } catch (error) {
    console.error("POST /api/public/orders error:", error)

    return jsonError("Erro inesperado ao criar pedido.", 500)
  }
}