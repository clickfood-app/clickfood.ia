import { randomInt } from "crypto"
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { notifyAiPublicOrderCreated } from "@/lib/ai-agent"

const MAX_ITEMS_PER_ORDER = 50
const MAX_QUANTITY_PER_ITEM = 99
const MAX_CUSTOMER_NAME_LENGTH = 120
const MAX_CUSTOMER_PHONE_LENGTH = 20
const MAX_ADDRESS_LENGTH = 250
const MAX_NEIGHBORHOOD_LENGTH = 120
const MAX_NOTE_LENGTH = 500
const MAX_ITEM_NOTE_LENGTH = 250
const MAX_ORDER_NUMBER_RETRIES = 5
const MAX_CUSTOMER_ZIP_LENGTH = 8
const MAX_ADDRESS_NUMBER_LENGTH = 20
const MAX_ADDRESS_COMPLEMENT_LENGTH = 120
const DELIVERY_API_TIMEOUT_MS = 12_000
const OPENROUTESERVICE_BASE_URL = "https://api.heigit.org"


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
  customerZip?: string
  customerNumber?: string
  customerComplement?: string
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
  address: string | null
  city: string | null
  state: string | null
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

type DeliveryDistanceRuleRow = {
  id: string
  restaurant_id: string
  up_to_km: number | string | null
  fee: number | string | null
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
    deliveryDistanceKm?: number
    discount: number
    total: number
    neighborhood: string
    orderType: string
    cashback: null
  }
}

type ViaCepResponse = {
  cep?: string
  logradouro?: string
  complemento?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean | "true"
}

type GeoJsonFeature = {
  geometry?: {
    coordinates?: [number, number]
  }
}

type GeocodeResponse = {
  features?: GeoJsonFeature[]
}

type DirectionsResponse = {
  routes?: Array<{
    summary?: {
      distance?: number
    }
  }>
  features?: Array<{
    properties?: {
      summary?: {
        distance?: number
      }
    }
  }>
}

type DeliveryQuote = {
  distanceKm: number
  fee: number
  customerAddress: string
  neighborhood: string
}

class DeliveryCalculationError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "DeliveryCalculationError"
    this.status = status
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

function normalizeZip(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(0, MAX_CUSTOMER_ZIP_LENGTH)
}

async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = DELIVERY_API_TIMEOUT_MS
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function lookupAddressByZip(zip: string) {
  if (!/^\d{8}$/.test(zip)) {
    throw new DeliveryCalculationError("Informe um CEP válido com 8 números.")
  }

  let response: Response

  try {
    response = await fetchWithTimeout(
      `https://viacep.com.br/ws/${zip}/json/`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    )
  } catch (error) {
    console.error("Erro ao consultar ViaCEP:", error)

    throw new DeliveryCalculationError(
      "Não foi possível consultar o CEP agora. Tente novamente.",
      502
    )
  }

  if (!response.ok) {
    throw new DeliveryCalculationError(
      "Não foi possível consultar o CEP informado.",
      502
    )
  }

  const data = (await response.json()) as ViaCepResponse

  if (data.erro === true || data.erro === "true") {
    throw new DeliveryCalculationError("CEP não encontrado.")
  }

  return data
}

function buildAddress(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(", ")
}

async function geocodeAddress(address: string, apiKey: string) {
  const endpoint = new URL(`${OPENROUTESERVICE_BASE_URL}/pelias/v1/search`)

  endpoint.searchParams.set("api_key", apiKey)
  endpoint.searchParams.set("text", address)
  endpoint.searchParams.set("boundary.country", "BR")
  endpoint.searchParams.set("size", "1")

  let response: Response

  try {
    response = await fetchWithTimeout(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    })
  } catch (error) {
    console.error("Erro ao geocodificar endereço no OpenRouteService:", {
      address,
      error,
    })

    throw new DeliveryCalculationError(
      "Não foi possível localizar o endereço informado.",
      502
    )
  }

  if (!response.ok) {
    const responseText = await response.text().catch(() => "")

    console.error("OpenRouteService recusou a geocodificação:", {
      status: response.status,
      address,
      response: responseText.slice(0, 500),
    })

    throw new DeliveryCalculationError(
      "Não foi possível localizar o endereço informado.",
      502
    )
  }

  const data = (await response.json()) as GeocodeResponse
  const coordinates = data.features?.[0]?.geometry?.coordinates

  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    !Number.isFinite(coordinates[0]) ||
    !Number.isFinite(coordinates[1])
  ) {
    throw new DeliveryCalculationError(
      "Endereço não localizado. Confira CEP, rua e número."
    )
  }

  return coordinates
}

async function calculateDrivingDistanceInMeters(
  origin: [number, number],
  destination: [number, number],
  apiKey: string
) {
  const endpoint = `${OPENROUTESERVICE_BASE_URL}/openrouteservice/v2/directions/driving-car`

  let response: Response

  try {
    response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [origin, destination],
        instructions: false,
      }),
    })
  } catch (error) {
    console.error("Erro ao calcular rota no OpenRouteService:", error)

    throw new DeliveryCalculationError(
      "Não foi possível calcular a rota de entrega agora.",
      502
    )
  }

  if (!response.ok) {
    const responseText = await response.text().catch(() => "")

    console.error("OpenRouteService recusou o cálculo da rota:", {
      status: response.status,
      response: responseText.slice(0, 500),
    })

    throw new DeliveryCalculationError(
      "Não foi possível calcular uma rota até este endereço.",
      502
    )
  }

  const data = (await response.json()) as DirectionsResponse

  const distanceInMeters =
    data.routes?.[0]?.summary?.distance ??
    data.features?.[0]?.properties?.summary?.distance

  if (!Number.isFinite(distanceInMeters) || Number(distanceInMeters) <= 0) {
    throw new DeliveryCalculationError(
      "Não foi possível calcular uma rota até este endereço."
    )
  }

  return Number(distanceInMeters)
}

async function getDeliveryDistanceRules(restaurantId: string) {
  const { data, error } = await supabaseAdmin
    .from("delivery_distance_rules")
    .select("id, restaurant_id, up_to_km, fee, is_active, sort_order")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("up_to_km", { ascending: true })

  if (error) {
    console.error("Erro ao buscar faixas de entrega por distância:", {
      restaurantId,
      message: error.message,
      code: error.code,
    })

    throw new DeliveryCalculationError(
      "Não foi possível carregar as regras de entrega deste restaurante.",
      500
    )
  }

  const rules = ((data || []) as DeliveryDistanceRuleRow[])
    .map((rule) => ({
      upToKm: normalizeNumber(rule.up_to_km, 0),
      fee: roundMoney(Math.max(0, normalizeNumber(rule.fee, 0))),
    }))
    .filter((rule) => rule.upToKm > 0)
    .sort((a, b) => a.upToKm - b.upToKm)

  if (rules.length === 0) {
    throw new DeliveryCalculationError(
      "As faixas de entrega ainda não foram configuradas para este restaurante.",
      500
    )
  }

  return rules
}

function getDeliveryFeeByDistance(
  distanceInMeters: number,
  deliveryRules: Array<{ upToKm: number; fee: number }>
) {
  const matchedRule = deliveryRules.find(
    (rule) => distanceInMeters <= rule.upToKm * 1000
  )

  if (!matchedRule) {
    const maxDeliveryDistanceKm = deliveryRules[deliveryRules.length - 1].upToKm

    throw new DeliveryCalculationError(
      `Este endereço está fora da área de entrega de até ${maxDeliveryDistanceKm} km.`
    )
  }

  return matchedRule.fee
}

async function calculateDeliveryQuote({
  restaurant,
  customerAddress,
  customerZip,
  customerNumber,
  customerComplement,
  neighborhood,
}: {
  restaurant: RestaurantRow
  customerAddress: string
  customerZip: string
  customerNumber: string
  customerComplement: string
  neighborhood: string
}): Promise<DeliveryQuote> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY?.trim()

  if (!apiKey) {
    console.error("OPENROUTESERVICE_API_KEY não configurada no servidor.")

    throw new DeliveryCalculationError(
      "O cálculo de entrega ainda não está configurado.",
      500
    )
  }

  const restaurantAddress = buildAddress([
    restaurant.address,
    restaurant.city,
    restaurant.state,
    "Brasil",
  ])

  if (!restaurant.address?.trim() || !restaurant.city?.trim() || !restaurant.state?.trim()) {
    throw new DeliveryCalculationError(
      "O endereço do restaurante está incompleto nas configurações.",
      500
    )
  }

  let resolvedCustomerAddress = customerAddress
  let resolvedNeighborhood = neighborhood
  let customerRouteAddress = buildAddress([
    customerAddress,
    neighborhood,
    restaurant.city,
    restaurant.state,
    "Brasil",
  ])

  if (customerZip) {
    const zipAddress = await lookupAddressByZip(customerZip)
    const zipStreet = normalizeText(zipAddress.logradouro, 160)
    const zipNeighborhood = normalizeText(zipAddress.bairro, MAX_NEIGHBORHOOD_LENGTH)
    const zipCity = normalizeText(zipAddress.localidade, 120)
    const zipState = normalizeText(zipAddress.uf, 2)
    const formattedZip = normalizeText(zipAddress.cep, 9) || customerZip

    resolvedNeighborhood = zipNeighborhood || neighborhood

    const streetAndNumber = buildAddress([
      zipStreet || customerAddress,
      customerNumber,
    ])

    resolvedCustomerAddress = buildAddress([
      streetAndNumber,
      customerComplement,
      resolvedNeighborhood,
      zipCity,
      zipState,
      `CEP ${formattedZip}`,
    ])

    customerRouteAddress = buildAddress([
      streetAndNumber || customerAddress,
      resolvedNeighborhood,
      zipCity,
      zipState,
      formattedZip,
      "Brasil",
    ])
  }

  if (!resolvedCustomerAddress.trim()) {
    throw new DeliveryCalculationError("Informe o endereço de entrega.")
  }

  const [originCoordinates, destinationCoordinates, deliveryRules] = await Promise.all([
    geocodeAddress(restaurantAddress, apiKey),
    geocodeAddress(customerRouteAddress, apiKey),
    getDeliveryDistanceRules(restaurant.id),
  ])

  const distanceInMeters = await calculateDrivingDistanceInMeters(
    originCoordinates,
    destinationCoordinates,
    apiKey
  )

  return {
    distanceKm: Math.round((distanceInMeters / 1000) * 100) / 100,
    fee: getDeliveryFeeByDistance(distanceInMeters, deliveryRules),
    customerAddress: resolvedCustomerAddress,
    neighborhood: resolvedNeighborhood,
  }
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
  | "picpay_pix"
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

  if (
  normalized === "picpay_pix" ||
  normalized === "pix_picpay" ||
  normalized === "picpay" ||
  normalized === "picpay_checkout"
) {
  return "picpay_pix"
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

async function notifyAiPublicOrderCreatedSafely(params: {
  restaurantId: string
  orderId: string
}) {

  const aiNotifyResult = await notifyAiPublicOrderCreated({
    restaurantId: params.restaurantId,
    orderId: params.orderId,
    source: "public_menu",
  })


  if (!aiNotifyResult.ok) {
    console.warn("[AI Agent] Pedido criado, mas resumo IA nao foi enviado:", {
      restaurantId: params.restaurantId,
      orderId: params.orderId,
      result: aiNotifyResult,
    })
  }

  return aiNotifyResult
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
    console.error("Erro ao buscar aceite automÃ¡tico do restaurante:", {
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
    throw new Error(result.error || "Erro ao criar job de impressÃ£o.")
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
    console.error("Pedido autoaceito, mas job de impressÃ£o nÃ£o foi criado:", {
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
    console.error("Erro ao criar pedido via RPC rÃ¡pida:", {
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
  customerZip,
  customerNumber,
  customerComplement,
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
  customerZip: string
  customerNumber: string
  customerComplement: string
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
    return jsonError("Nenhum produto vÃ¡lido foi enviado no pedido.", 400)
  }

  const [
    { data: restaurant, error: restaurantError },
    { data: products, error: productsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("restaurants")
      .select(
        "id, name, slug, is_active, address, city, state, delivery_enabled, pickup_enabled, minimum_order, auto_accept_orders"
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
    return jsonError("Restaurante nÃ£o encontrado ou inativo.", 404)
  }

  if (orderType === "delivery" && typedRestaurant.delivery_enabled === false) {
    return jsonError(
      "Este restaurante nÃ£o estÃ¡ aceitando pedidos para entrega.",
      400
    )
  }

  if (orderType === "pickup" && typedRestaurant.pickup_enabled === false) {
    return jsonError(
      "Este restaurante nÃ£o estÃ¡ aceitando pedidos para retirada.",
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
      return jsonError("Um dos produtos do pedido nÃ£o foi encontrado.", 400)
    }

    if (product.restaurant_id !== restaurantId) {
      return jsonError("Produto nÃ£o pertence a este restaurante.", 400)
    }

    if (product.is_available === false) {
      return jsonError(`O produto "${product.name}" estÃ¡ indisponÃ­vel.`, 400)
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
      `Pedido mÃ­nimo de R$ ${minimumOrder.toFixed(2).replace(".", ",")}.`,
      400
    )
  }

  let deliveryFee = 0
  let deliveryDistanceKm = 0
  let resolvedCustomerAddress = customerAddress
  let resolvedNeighborhood = neighborhood

  if (orderType === "delivery") {
    try {
      const deliveryQuote = await calculateDeliveryQuote({
        restaurant: typedRestaurant,
        customerAddress,
        customerZip,
        customerNumber,
        customerComplement,
        neighborhood,
      })

      deliveryFee = Math.max(0, roundMoney(deliveryQuote.fee))
      deliveryDistanceKm = deliveryQuote.distanceKm
      resolvedCustomerAddress = deliveryQuote.customerAddress
      resolvedNeighborhood = deliveryQuote.neighborhood
    } catch (error) {
      if (error instanceof DeliveryCalculationError) {
        return jsonError(error.message, error.status)
      }

      console.error("Erro inesperado ao calcular entrega:", error)

      return jsonError(
        "Não foi possível calcular a taxa de entrega agora.",
        500
      )
    }
  }

  const safeServiceFee = 0
  let discount = 0
  let cashbackRedeemData: CashbackRedeemData | null = null

  if (requestedCashbackAmount > 0) {
    if (!requestedCashbackWalletId) {
      return jsonError("Carteira de cashback invÃ¡lida.", 400)
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
      return jsonError("Carteira de cashback nÃ£o encontrada.", 400)
    }

    if (normalizePhone(wallet.customer_phone) !== customerPhone) {
      return jsonError("Cashback nÃ£o pertence a este cliente.", 400)
    }

    const walletBalance = roundMoney(
      Math.max(0, normalizeNumber(wallet.balance, 0))
    )

    if (walletBalance <= 0) {
      return jsonError("Cliente nÃ£o possui saldo de cashback.", 400)
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
      return jsonError("Campanha de cashback nÃ£o estÃ¡ ativa.", 400)
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
        `Cashback disponÃ­vel apenas em pedidos acima de R$ ${redeemMinimumOrderAmount
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
      return jsonError("Valor de cashback invÃ¡lido.", 400)
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
    : paymentMethod === "pix" || paymentMethod === "picpay_pix"
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
    delivery_address:
      orderType === "delivery" ? resolvedCustomerAddress : null,
    delivery_neighborhood:
      orderType === "delivery" ? resolvedNeighborhood : null,
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

      return jsonError("NÃ£o foi possÃ­vel aplicar o cashback.", 500)
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

      return jsonError("NÃ£o foi possÃ­vel registrar o uso do cashback.", 500)
    }
  }

  if (shouldAutoAcceptOrder) {
    try {
      await createDesktopPrintJobForOrder(createdOrder.id)
    } catch (printJobError) {
      console.error("Pedido autoaceito, mas job de impressÃ£o nÃ£o foi criado:", {
        restaurantId,
        orderId: createdOrder.id,
        error: printJobError,
      })
    }
  }

  await notifyAiPublicOrderCreatedSafely({
    restaurantId,
    orderId: createdOrder.id,
  })

  return NextResponse.json(
    {
      success: true,
      order: createdOrder,
      summary: {
        subtotal,
        serviceFee: safeServiceFee,
        deliveryFee,
        deliveryDistanceKm,
        discount,
        total,
        neighborhood: resolvedNeighborhood,
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

export async function PUT(request: Request) {
  try {
    let body: {
      restaurantId?: string
      customerAddress?: string
      customerZip?: string
      customerNumber?: string
      customerComplement?: string
      neighborhood?: string
    }

    try {
      body = (await request.json()) as typeof body
    } catch {
      return jsonError("Corpo da requisição inválido.", 400)
    }

    const restaurantId = normalizeText(body.restaurantId, 80)
    const customerAddress = normalizeText(
      body.customerAddress,
      MAX_ADDRESS_LENGTH
    )
    const customerZip = normalizeZip(body.customerZip)
    const customerNumber = normalizeText(
      body.customerNumber,
      MAX_ADDRESS_NUMBER_LENGTH
    )
    const customerComplement = normalizeText(
      body.customerComplement,
      MAX_ADDRESS_COMPLEMENT_LENGTH
    )
    const neighborhood = normalizeText(
      body.neighborhood,
      MAX_NEIGHBORHOOD_LENGTH
    )

    if (!restaurantId) {
      return jsonError("restaurantId é obrigatório.", 400)
    }

    if (!customerZip && !customerAddress) {
      return jsonError("Informe o CEP ou o endereço de entrega.", 400)
    }

    if (body.customerZip && !/^\d{8}$/.test(customerZip)) {
      return jsonError("Informe um CEP válido com 8 números.", 400)
    }

    if (customerZip && !customerNumber) {
      return jsonError("Informe o número do endereço.", 400)
    }

    const { data: restaurantData, error: restaurantError } =
      await supabaseAdmin
        .from("restaurants")
        .select(
          "id, name, slug, is_active, address, city, state, delivery_enabled, pickup_enabled, minimum_order, auto_accept_orders"
        )
        .eq("id", restaurantId)
        .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao buscar restaurante para calcular entrega:", {
        restaurantId,
        message: restaurantError.message,
        code: restaurantError.code,
      })

      return jsonError("Erro ao buscar restaurante.", 500)
    }

    const restaurant = restaurantData as RestaurantRow | null

    if (!restaurant || restaurant.is_active === false) {
      return jsonError("Restaurante não encontrado ou inativo.", 404)
    }

    if (restaurant.delivery_enabled === false) {
      return jsonError(
        "Este restaurante não está aceitando pedidos para entrega.",
        400
      )
    }

    try {
      const quote = await calculateDeliveryQuote({
        restaurant,
        customerAddress,
        customerZip,
        customerNumber,
        customerComplement,
        neighborhood,
      })

      return NextResponse.json(
        {
          success: true,
          quote: {
            distanceKm: quote.distanceKm,
            fee: quote.fee,
            customerAddress: quote.customerAddress,
            neighborhood: quote.neighborhood,
          },
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      )
    } catch (error) {
      if (error instanceof DeliveryCalculationError) {
        return jsonError(error.message, error.status)
      }

      console.error("Erro inesperado ao calcular prévia de entrega:", error)

      return jsonError(
        "Não foi possível calcular a taxa de entrega agora.",
        500
      )
    }
  } catch (error) {
    console.error("PUT /api/public/orders error:", error)

    return jsonError("Erro inesperado ao calcular a entrega.", 500)
  }
}

export async function POST(request: Request) {  try {
    let body: CreateOrderBody

    try {
      body = (await request.json()) as CreateOrderBody
    } catch {
      return jsonError("Corpo da requisiÃ§Ã£o invÃ¡lido.", 400)
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
    const customerZip = normalizeZip(body.customerZip)
    const customerNumber = normalizeText(
      body.customerNumber,
      MAX_ADDRESS_NUMBER_LENGTH
    )
    const customerComplement = normalizeText(
      body.customerComplement,
      MAX_ADDRESS_COMPLEMENT_LENGTH
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
      return jsonError("restaurantId Ã© obrigatÃ³rio.", 400)
    }

    if (!customerName) {
      return jsonError("Nome do cliente Ã© obrigatÃ³rio.", 400)
    }

    if (!customerPhone) {
      return jsonError("Telefone do cliente Ã© obrigatÃ³rio.", 400)
    }

    if (customerPhone.length < 10) {
      return jsonError("Telefone do cliente invÃ¡lido.", 400)
    }

    if (!paymentMethod) {
      return jsonError("Forma de pagamento invÃ¡lida.", 400)
    }

    if (needsChange && (!changeFor || changeFor <= 0)) {
      return jsonError("Informe o valor para troco.", 400)
    }

    if (orderType === "delivery" && !customerAddress) {
      return jsonError("EndereÃ§o Ã© obrigatÃ³rio para entrega.", 400)
    }

    if (
      orderType === "delivery" &&
      body.customerZip &&
      !/^\d{8}$/.test(customerZip)
    ) {
      return jsonError("Informe um CEP vÃ¡lido com 8 nÃºmeros.", 400)
    }

    if (orderType === "delivery" && !neighborhood && !customerZip) {
      return jsonError("Bairro Ã© obrigatÃ³rio para entrega.", 400)
    }

    if (items.length === 0) {
      return jsonError("O pedido precisa ter pelo menos 1 item.", 400)
    }

    if (items.length > MAX_ITEMS_PER_ORDER) {
      return jsonError(
        `O pedido nÃ£o pode ter mais de ${MAX_ITEMS_PER_ORDER} itens diferentes.`,
        400
      )
    }

    const hasCashback =
      requestedCashbackAmount > 0 ||
      Boolean(requestedCashbackWalletId) ||
      Boolean(requestedCashbackCampaignId)

    const canUseFastPath =
  orderType !== "delivery" &&
  !hasCashback &&
  !tableId &&
  !needsChange &&
  paymentMethod !== "picpay_pix"

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
        return jsonError(response.error || "NÃ£o foi possÃ­vel criar o pedido.", 400)
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

        await notifyAiPublicOrderCreatedSafely({
          restaurantId,
          orderId: response.order.id,
        })
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
      customerZip,
      customerNumber,
      customerComplement,
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