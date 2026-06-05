"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChefHat,
  Clock3,
  Loader2,
  Package,
  Printer,
  RefreshCcw,
  Search,
  Settings2,
  Truck,
  Volume2,
  UserRound,
  XCircle,
} from "lucide-react"

import AdminLayout from "@/components/admin-layout"
import { useAuth } from "@/components/auth/auth-provider"
import { createClient } from "@/lib/supabase/client"
import {
  printThermalOrder,
  printThermalOrdersBatch,
  type ThermalPrintMode,
  type ThermalPrintOrder,
} from "@/lib/thermal-print"

type OrderRow = {
  id: string
  public_order_number: string | number | null
  customer_name: string | null
  customer_phone: string | null
  status: string | null
  total: number | string | null
  subtotal?: number | string | null
  discount?: number | string | null
  delivery_fee?: number | string | null
  payment_method: string | null
  payment_status: string | null
  needs_change?: boolean | null
  change_for?: number | string | null
  notes: string | null
  created_at: string
  delivery_person_id: string | null
  accepted_at: string | null
  preparation_started_at: string | null
  out_for_delivery_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  accept_by: string | null
  pix_proof_url: string | null
  pix_proof_path: string | null
  pix_proof_uploaded_at: string | null
  pix_confirmed_at: string | null
  pix_confirmed_by: string | null
}

type OrderItemModifier = {
  groupId: string | null
  optionId: string | null
  groupName: string
  optionName: string
  optionPrice: number
}

type OrderItem = {
  id: string
  order_id: string
  product_id: string | null
  name: string
  quantity: number
  total: number
  notes: string | null
  modifiers: OrderItemModifier[]
  stock_deducted_at: string | null
}

type DeliveryPerson = {
  id: string
  name: string
  phone: string | null
  is_active: boolean
  created_at: string
}

type OrderItemStockDeductionRow = {
  id: string
  product_id: string | null
  quantity: number | string | null
}

type ProductRecipeStockRow = {
  product_id: string | null
  stock_item_id: string | null
  quantity: number | string | null
}

type StockQuantityRow = {
  id: string
  current_quantity: number | string | null
}

type RestaurantPrintData = {
  name: string
  logoUrl: string | null
  phone: string | null
  address: string | null
}

type NewOrderAlert = {
  orderId: string
  orderNumber: string
  customerName: string
  total: number | string | null
  createdAt: string
}

type BoardStatus = "analysis" | "preparation" | "ready"

const supabase = createClient()

const OPEN_ORDER_STATUSES = [
  "pending",
  "pendente",
  "in_analysis",
  "em_analise",
  "analise",
  "em análise",
  "accepted",
  "aceito",
  "preparing",
  "em_preparo",
  "em preparo",
  "waiting",
  "aguardando",
  "ready",
  "pronto",
  "waiting_pix_confirmation",
  "awaiting_pix_review",
  "aguardando_confirmacao_pix",
  "aguardando confirmação pix",
]

const columnStyles = {
  analysis: {
    title: "PENDENTES",
    description: "Aguardando confirmação",
    icon: Clock3,
    header: "bg-amber-500",
    body: "bg-amber-50/45",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    button: "bg-emerald-600 hover:bg-emerald-700 text-white",
    progress: "bg-emerald-500",
  },
  preparation: {
    title: "EM PREPARO",
    description: "Na cozinha",
    icon: ChefHat,
    header: "bg-blue-600",
    body: "bg-blue-50/40",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    button: "bg-blue-600 hover:bg-blue-700 text-white",
    progress: "bg-blue-500",
  },
  ready: {
    title: "PRONTOS",
    description: "Cozinha finalizou",
    icon: CheckCircle2,
    header: "bg-emerald-600",
    body: "bg-emerald-50/40",
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    button: "bg-emerald-600 hover:bg-emerald-700 text-white",
    progress: "bg-emerald-500",
  },
} satisfies Record<BoardStatus, Record<string, string | typeof Clock3>>

async function ensureSupabaseSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error

  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }

    const message = [
      maybeError.message,
      maybeError.details,
      maybeError.hint,
      maybeError.code,
    ]
      .filter(Boolean)
      .join(" • ")

    if (message) return message
  }

  return fallback
}

function normalizeStatus(status: string | null | undefined) {
  return (status || "").trim().toLowerCase()
}

function isManualPixMethod(paymentMethod: string | null | undefined) {
  const value = normalizeStatus(paymentMethod)

  return (
    value === "pix_manual" ||
    value === "pix_direto" ||
    value === "pix direto" ||
    value === "pix_manual_receipt"
  )
}

function isPixAwaitingReview(order: Pick<OrderRow, "payment_method" | "payment_status" | "status">) {
  const paymentStatus = normalizeStatus(order.payment_status)
  const status = normalizeStatus(order.status)

  return (
    isManualPixMethod(order.payment_method) &&
    (paymentStatus === "awaiting_review" ||
      paymentStatus === "aguardando_conferencia" ||
      paymentStatus === "aguardando conferência" ||
      status === "waiting_pix_confirmation" ||
      status === "awaiting_pix_review" ||
      status === "aguardando_confirmacao_pix" ||
      status === "aguardando confirmação pix")
  )
}

function isAnalysisStatus(status: string | null | undefined) {
  const value = normalizeStatus(status)

  return (
    value === "pending" ||
    value === "pendente" ||
    value === "in_analysis" ||
    value === "em_analise" ||
    value === "analise" ||
    value === "em análise" ||
    value === "waiting_pix_confirmation" ||
    value === "awaiting_pix_review" ||
    value === "aguardando_confirmacao_pix" ||
    value === "aguardando confirmação pix"
  )
}

function isPreparationStatus(status: string | null | undefined) {
  const value = normalizeStatus(status)

  return (
    value === "accepted" ||
    value === "aceito" ||
    value === "preparing" ||
    value === "em_preparo" ||
    value === "em preparo" ||
    value === "waiting" ||
    value === "aguardando"
  )
}

function isReadyStatus(status: string | null | undefined) {
  const value = normalizeStatus(status)

  return (
    value === "ready" ||
    value === "pronto" ||
    value === "done" ||
    value === "prepared"
  )
}


function getBoardStatus(status: string | null | undefined): BoardStatus | null {
  if (isAnalysisStatus(status)) return "analysis"
  if (isPreparationStatus(status)) return "preparation"
  if (isReadyStatus(status)) return "ready"
  return null
}

function isOrderVisibleOnBoard(order: Partial<OrderRow>) {
  if (getBoardStatus(order.status) === null) return false

  const paymentMethod = String(order.payment_method || "").trim().toLowerCase()
  const paymentStatus = String(order.payment_status || "").trim().toLowerCase()
  const status = String(order.status || "").trim().toLowerCase()

  if (paymentMethod === "pix") {
    return paymentStatus === "paid"
  }

  if (isManualPixMethod(paymentMethod)) {
    return (
      paymentStatus === "paid" ||
      paymentStatus === "awaiting_review" ||
      status === "waiting_pix_confirmation" ||
      status === "awaiting_pix_review"
    )
  }

  return true
}

function getAudioContextConstructor() {
  if (typeof window === "undefined") return null

  const audioWindow = window as Window &
    typeof globalThis & {
      webkitAudioContext?: typeof AudioContext
    }

  return window.AudioContext || audioWindow.webkitAudioContext || null
}

function formatBRL(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeOrderItemModifiers(rawModifiers: unknown): OrderItemModifier[] {
  if (!Array.isArray(rawModifiers)) return []

  return rawModifiers
    .map((rawModifier) => {
      if (!rawModifier || typeof rawModifier !== "object") return null

      const modifier = rawModifier as Record<string, unknown>

      const groupName = cleanText(
        modifier.groupName ?? modifier.group_name ?? modifier.group
      )

      const optionName = cleanText(
        modifier.optionName ?? modifier.option_name ?? modifier.name ?? modifier.option
      )

      const optionPrice = Number(
        modifier.optionPrice ?? modifier.option_price ?? modifier.price ?? 0
      )

      if (!groupName && !optionName) return null

      return {
        groupId: cleanText(modifier.groupId ?? modifier.group_id) || null,
        optionId: cleanText(modifier.optionId ?? modifier.option_id) || null,
        groupName: groupName || "Complemento",
        optionName: optionName || "Opção",
        optionPrice: Number.isFinite(optionPrice) ? optionPrice : 0,
      }
    })
    .filter((modifier): modifier is OrderItemModifier => Boolean(modifier))
}

function formatOrderItemModifier(modifier: OrderItemModifier) {
  const price =
    modifier.optionPrice > 0 ? ` +${formatBRL(modifier.optionPrice)}` : ""

  return `${modifier.groupName}: ${modifier.optionName}${price}`
}

function getSafeOrderItemModifiers(item: OrderItem) {
  return Array.isArray(item.modifiers) ? item.modifiers : []
}

function getOrderItemPrintName(item: OrderItem) {
  const modifierLines = getSafeOrderItemModifiers(item).map(
    (modifier) => `  • ${formatOrderItemModifier(modifier)}`
  )

  const notesLine = item.notes ? [`  Obs: ${item.notes}`] : []

  return [item.name, ...modifierLines, ...notesLine].join("\n")
}

function formatTimeOnly(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatElapsedTime(value: string, nowMs: number) {
  const createdAt = new Date(value).getTime()
  const diffInMinutes = Math.max(0, Math.floor((nowMs - createdAt) / 60000))

  if (diffInMinutes < 1) return "agora"
  if (diffInMinutes < 60) return `${diffInMinutes}min`

  const hours = Math.floor(diffInMinutes / 60)
  const minutes = diffInMinutes % 60

  if (hours < 24) {
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`
  }

  const days = Math.floor(hours / 24)
  return `${days}d`
}

function formatCountdown(ms: number) {
  const safeMs = Math.max(0, ms)
  const totalSeconds = Math.floor(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function getOrderNumber(order: OrderRow) {
  if (order.public_order_number !== null && order.public_order_number !== undefined) {
    return String(order.public_order_number)
  }

  return order.id.slice(0, 8)
}

function getCustomerName(order: OrderRow) {
  return order.customer_name?.trim() || "Cliente sem nome"
}

function getCustomerPhone(order: OrderRow) {
  return order.customer_phone?.trim() || "Sem telefone"
}

function getOrderTextField(order: OrderRow, keys: string[]) {
  const rawOrder = order as unknown as Record<string, unknown>

  for (const key of keys) {
    const value = rawOrder[key]

    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }

  return null
}

function getOrderCpf(order: OrderRow) {
  return getOrderTextField(order, [
    "customer_cpf",
    "customer_document",
    "customer_tax_id",
    "document",
    "cpf",
    "tax_id",
  ])
}

function getOrderAddress(order: OrderRow) {
  const directAddress = getOrderTextField(order, [
    "customer_address",
    "delivery_address",
    "delivery_full_address",
    "full_address",
    "address",
    "shipping_address",
  ])

  if (directAddress) return directAddress

  const street = getOrderTextField(order, [
    "customer_street",
    "delivery_street",
    "street",
    "shipping_street",
  ])
  const number = getOrderTextField(order, [
    "customer_number",
    "delivery_number",
    "address_number",
    "number",
  ])
  const neighborhood = getOrderTextField(order, [
    "customer_neighborhood",
    "delivery_neighborhood",
    "neighborhood",
    "bairro",
  ])
  const complement = getOrderTextField(order, [
    "customer_complement",
    "delivery_complement",
    "complement",
  ])
  const city = getOrderTextField(order, [
    "customer_city",
    "delivery_city",
    "city",
  ])

  const mainAddress = [street, number].filter(Boolean).join(", ")
  const fullAddress = [mainAddress, neighborhood, complement, city]
    .filter(Boolean)
    .join(" • ")

  return fullAddress || null
}

function buildPrintNotes(order: OrderRow) {
  return order.notes?.trim() || null
}

function getAcceptDeadline(order: OrderRow) {
  if (order.accept_by) return new Date(order.accept_by)

  const createdAt = new Date(order.created_at)
  return new Date(createdAt.getTime() + 30 * 1000)
}

function getPreparationBaseTime(order: OrderRow) {
  return order.preparation_started_at || order.accepted_at || order.created_at
}

function getPreparationDeadline(order: OrderRow, averagePrepTimeMinutes: number) {
  const base = new Date(getPreparationBaseTime(order))
  return new Date(base.getTime() + averagePrepTimeMinutes * 60 * 1000)
}

function getProgressPercent(startDate: string, endDate: string, nowMs: number) {
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  const total = Math.max(1, end - start)
  const elapsed = Math.min(Math.max(0, nowMs - start), total)

  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

function getDeliveryPersonName(
  deliveryPeople: DeliveryPerson[],
  deliveryPersonId: string | null
) {
  if (!deliveryPersonId) return null

  return deliveryPeople.find((person) => person.id === deliveryPersonId)?.name || null
}

function getPaymentLabel(paymentMethod: string | null) {
  if (!paymentMethod) return "—"

  const normalized = paymentMethod.toLowerCase()

  if (normalized === "pix") return "Pix automático"
  if (isManualPixMethod(normalized)) return "Pix direto"
  if (normalized === "cash" || normalized === "dinheiro") return "Dinheiro"
  if (normalized === "credit_card" || normalized === "credito") return "Crédito"
  if (normalized === "debit_card" || normalized === "debito") return "Débito"
  if (normalized === "mesa") return "Mesa"

  return paymentMethod
}

function isCashPaymentMethod(paymentMethod: string | null | undefined) {
  const normalized = normalizeStatus(paymentMethod)

  return (
    normalized === "cash" ||
    normalized === "dinheiro" ||
    normalized === "cash_on_delivery" ||
    normalized === "dinheiro_na_entrega"
  )
}

function getOrderChangeFor(order: OrderRow) {
  const changeFor = Number(order.change_for || 0)

  if (!Number.isFinite(changeFor) || changeFor <= 0) return 0

  return changeFor
}

function getOrderChangeAmount(order: OrderRow) {
  const changeFor = getOrderChangeFor(order)
  const total = Number(order.total || 0)

  if (changeFor <= 0 || !Number.isFinite(total)) return 0

  return Math.max(changeFor - total, 0)
}

function getPaymentStatusLabel(paymentStatus: string | null) {
  const normalized = String(paymentStatus || "").toLowerCase()

  if (normalized === "paid") return "Pago"
  if (normalized === "awaiting_review") return "Conferir Pix"
  if (normalized === "waiting_customer_payment") return "Aguardando Pix"
  if (normalized === "pending") return "Pendente"
  if (normalized === "failed") return "Falhou"
  if (normalized === "cancelled") return "Cancelado"

  return paymentStatus || "—"
}

function isDeliveryOrder(order: OrderRow) {
  const deliveryFee = Number(order.delivery_fee || 0)
  const paymentMethod = normalizeStatus(order.payment_method)
  const customerName = normalizeStatus(order.customer_name)
  const notes = normalizeStatus(order.notes)

  const isLocalOrPickup =
    paymentMethod === "mesa" ||
    customerName.includes("mesa") ||
    notes.includes("retirada") ||
    notes.includes("retirar") ||
    notes.includes("balcao") ||
    notes.includes("balcão") ||
    notes.includes("pedido local") ||
    notes.includes("mesa") ||
    notes.includes("comanda") ||
    notes.includes("consumo local")

  if (isLocalOrPickup) return false

  const hasDeliverySignal =
    deliveryFee > 0 ||
    Boolean(order.delivery_person_id) ||
    notes.includes("delivery") ||
    notes.includes("entrega") ||
    notes.includes("entregar") ||
    notes.includes("endereco") ||
    notes.includes("endereço") ||
    notes.includes("bairro") ||
    notes.includes("rua")

  return hasDeliverySignal
}

function getOrderTypeLabel(order: OrderRow) {
  const paymentMethod = normalizeStatus(order.payment_method)
  const customerName = normalizeStatus(order.customer_name)

  if (paymentMethod === "mesa" || customerName.includes("mesa")) return "Mesa"

  return isDeliveryOrder(order) ? "Entrega" : "Retirada"
}

function isPaidOrder(order: OrderRow) {
  return normalizeStatus(order.payment_status) === "paid"
}

function getPaymentBadgeClasses(paymentStatus: string | null) {
  const normalized = normalizeStatus(paymentStatus)

  if (normalized === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }

  if (normalized === "awaiting_review" || normalized === "waiting_customer_payment") {
    return "border-orange-200 bg-orange-50 text-orange-700"
  }

  if (normalized === "failed" || normalized === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700"
  }

  return "border-amber-200 bg-amber-50 text-amber-700"
}

function getOrderTypeClasses(order: OrderRow) {
  const paymentMethod = normalizeStatus(order.payment_method)
  const customerName = normalizeStatus(order.customer_name)

  if (paymentMethod === "mesa" || customerName.includes("mesa")) {
    return "border-orange-200 bg-orange-50 text-orange-700"
  }

  if (isDeliveryOrder(order)) {
    return "border-blue-200 bg-blue-50 text-blue-700"
  }

  return "border-purple-200 bg-purple-50 text-purple-700"
}

function getOrderFlowHint(order: OrderRow, status: BoardStatus) {
  const isDelivery = isDeliveryOrder(order)
  const isPaid = isPaidOrder(order)

  if (status === "analysis") {
    if (isPixAwaitingReview(order)) {
      return "Cliente enviou comprovante. Confira antes de aceitar."
    }

    if (isPaid) return "Pedido pago. Pode aceitar com segurança."
    return "Pagamento pendente. Confira a forma de pagamento."
  }

  if (status === "preparation") {
    return "Pedido em produção na cozinha."
  }

  if (status === "ready") {
    if (isDelivery) return "Pedido pronto. Selecione o motoboy e envie."
    return "Pedido pronto. Finalize o atendimento."
  }

  return "Pedido em andamento."
}

function normalizeOrderItem(raw: Record<string, unknown>): OrderItem {
  const quantity = Number(raw.quantity || raw.qty || 1)
  const total = Number(
    raw.total_price ||
      raw.subtotal ||
      raw.total ||
      raw.price ||
      raw.unit_price ||
      0
  )

  const name =
    String(
      raw.product_name ||
        raw.menu_item_name ||
        raw.item_name ||
        raw.name ||
        "Item do pedido"
    ) || "Item do pedido"

  return {
    id: String(raw.id || crypto.randomUUID()),
    order_id: String(raw.order_id || ""),
    product_id:
      raw.product_id === null || raw.product_id === undefined
        ? null
        : String(raw.product_id),
    name,
    quantity,
    total,
    notes:
      raw.notes === null || raw.notes === undefined
        ? null
        : String(raw.notes),
    modifiers: normalizeOrderItemModifiers(raw.modifiers),
    stock_deducted_at:
      raw.stock_deducted_at === null || raw.stock_deducted_at === undefined
        ? null
        : String(raw.stock_deducted_at),
  }
}

function toPrintNumber(value: number | string | null | undefined) {
  const number = Number(value || 0)

  if (!Number.isFinite(number)) return 0

  return number
}

function getRestaurantPrintData(restaurant: unknown) {
  const data = restaurant as {
    name?: string | null
    logo_url?: string | null
    logoUrl?: string | null
    phone?: string | null
    address?: string | null
  }

  return {
    name: data?.name?.trim() || "Restaurante",
    logoUrl: data?.logo_url || data?.logoUrl || null,
    phone: data?.phone || null,
    address: data?.address || null,
  }
}

function getThermalOrderType(order: OrderRow) {
  return isDeliveryOrder(order) ? "delivery" : "pickup"
}

function buildThermalOrderPayload(
  order: OrderRow,
  items: OrderItem[]
): ThermalPrintOrder {
  const deliveryAddress = getOrderAddress(order)
  const customerCpf = getOrderCpf(order)

  const street = getOrderTextField(order, [
    "customer_street",
    "delivery_street",
    "street",
    "shipping_street",
  ])

  const number = getOrderTextField(order, [
    "customer_number",
    "delivery_number",
    "address_number",
    "number",
  ])

  const neighborhood = getOrderTextField(order, [
    "customer_neighborhood",
    "delivery_neighborhood",
    "neighborhood",
    "bairro",
  ])

  const complement = getOrderTextField(order, [
    "customer_complement",
    "delivery_complement",
    "complement",
  ])

  const reference = getOrderTextField(order, [
    "customer_reference",
    "delivery_reference",
    "address_reference",
    "reference",
  ])

  return {
    id: order.id,
    publicOrderNumber: getOrderNumber(order),
    type: getThermalOrderType(order),
    createdAt: order.created_at,
    customer: {
      name: getCustomerName(order),
      phone: getCustomerPhone(order),
      cpf: customerCpf,
      document: customerCpf,
      address: deliveryAddress,
      street,
      number,
      neighborhood,
      complement,
      reference,
    },
    items: items.map((item) => ({
      name: getOrderItemPrintName(item),
      quantity: item.quantity,
      price: item.quantity > 0 ? item.total / item.quantity : item.total,
    })),
    notes: buildPrintNotes(order),
    subtotal: toPrintNumber(order.subtotal),
    deliveryFee: toPrintNumber(order.delivery_fee),
    discount: toPrintNumber(order.discount),
    total: toPrintNumber(order.total),
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    needsChange: Boolean(order.needs_change),
    changeFor: getOrderChangeFor(order) || null,
  }
}

type OrderCardProps = {
  order: OrderRow
  status: BoardStatus
  items: OrderItem[]
  deliveryPeople: DeliveryPerson[]
  averagePrepTimeMinutes: number
  nowMs: number
  busyOrderId: string | null
  kdsEnabled: boolean
  isSelected: boolean
  onToggleSelected: (orderId: string) => void
  onAccept: (order: OrderRow) => void
  onCancel: (order: OrderRow) => void
  onConfirmPixPayment: (order: OrderRow) => void
  onSendToRoute: (order: OrderRow) => void
  onFinish: (order: OrderRow) => void
  onPrint: (order: OrderRow, items: OrderItem[], mode: ThermalPrintMode) => void
  onAssignDeliveryPerson: (orderId: string, deliveryPersonId: string) => void
}

function OrderCard({
  order,
  status,
  items,
  deliveryPeople,
  averagePrepTimeMinutes,
  nowMs,
  busyOrderId,
  kdsEnabled,
  isSelected,
  onToggleSelected,
  onAccept,
  onCancel,
  onConfirmPixPayment,
  onSendToRoute,
  onFinish,
  onPrint,
  onAssignDeliveryPerson,
}: OrderCardProps) {
  const styles = columnStyles[status]
  const isBusy = busyOrderId === order.id
  const isDelivery = isDeliveryOrder(order)
  const isPaid = isPaidOrder(order)
  const TypeIcon = isDelivery ? Truck : Package
  const isPixReview = isPixAwaitingReview(order)
  const deliveryAddress = getOrderAddress(order)
  const customerCpf = getOrderCpf(order)
  const [proofModalOpen, setProofModalOpen] = useState(false)

  const acceptDeadline = getAcceptDeadline(order)
  const acceptRemainingMs = acceptDeadline.getTime() - nowMs
  const acceptProgress = getProgressPercent(
    order.created_at,
    acceptDeadline.toISOString(),
    nowMs
  )

  const preparationBaseTime = getPreparationBaseTime(order)
  const preparationDeadline = getPreparationDeadline(order, averagePrepTimeMinutes)
  const preparationRemainingMs = preparationDeadline.getTime() - nowMs
  const preparationProgress = getProgressPercent(
    preparationBaseTime,
    preparationDeadline.toISOString(),
    nowMs
  )

  const deliveryPersonName = getDeliveryPersonName(
    deliveryPeople,
    order.delivery_person_id
  )

  const isLate =
    (status === "analysis" && acceptRemainingMs <= 0) ||
    (status === "preparation" && preparationRemainingMs <= 0)

  const visibleItems = items.slice(0, 3)
  const hiddenItemsCount = Math.max(0, items.length - visibleItems.length)

  return (
    <article
      className={[
       "group rounded-xl border bg-white shadow-sm transition duration-200 hover:shadow-md",
        isLate ? "border-red-300 ring-1 ring-red-100" : "border-slate-200/80",
      ].join(" ")}
    >
      <div
        className={[
          "h-1",
          isLate
            ? "bg-red-500"
            : status === "analysis"
              ? "bg-amber-500"
              : status === "preparation"
                ? "bg-blue-600"
                : "bg-emerald-600",
        ].join(" ")}
      />

      {isLate && (
        <div className="border-b border-red-100 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Pedido atrasado
          </div>
        </div>
      )}

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-base font-black leading-none text-slate-950">
                #{getOrderNumber(order)}
              </h3>

              {status === "analysis" && acceptRemainingMs <= 10000 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-700">
                  Alta
                </span>
              )}

              {status === "ready" && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                  Cozinha pronto
                </span>
              )}
            </div>

            <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-slate-700">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <UserRound className="h-3.5 w-3.5 text-slate-500" />
              </div>

              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900">
                  {getCustomerName(order)}
                </p>
                <p className="truncate text-[11px] font-medium text-slate-500">
                  {getCustomerPhone(order)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={[
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                getOrderTypeClasses(order),
              ].join(" ")}
            >
              <TypeIcon className="h-3 w-3" />
              {getOrderTypeLabel(order)}
            </span>

            <span
              className={[
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                getPaymentBadgeClasses(order.payment_status),
              ].join(" ")}
            >
              {isPaid ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <Clock3 className="h-3 w-3" />
              )}
              {getPaymentStatusLabel(order.payment_status)}
            </span>
          </div>
        </div>

        {(deliveryAddress || customerCpf) && (
          <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-2">
            {deliveryAddress && (
              <p className="text-[11px] font-bold leading-relaxed text-blue-900">
                Endereço: {deliveryAddress}
              </p>
            )}

            {customerCpf && (
              <p className="mt-0.5 text-[11px] font-bold leading-relaxed text-blue-900">
                CPF: {customerCpf}
              </p>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5">
          <p className="min-w-0 truncate text-[11px] font-semibold text-slate-700">
            {getOrderFlowHint(order, status)}
          </p>

          <p className="shrink-0 text-[11px] font-black text-slate-800">
            {getPaymentLabel(order.payment_method)}
          </p>
        </div>

        {isCashPaymentMethod(order.payment_method) && (
          <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">
              Troco
            </p>

            {order.needs_change && getOrderChangeFor(order) > 0 ? (
              <p className="mt-0.5 text-xs font-semibold leading-relaxed text-emerald-900">
                Cliente precisa de troco para{" "}
                <span className="font-black">{formatBRL(getOrderChangeFor(order))}</span>
                {" "}• Troco estimado:{" "}
                <span className="font-black">{formatBRL(getOrderChangeAmount(order))}</span>
              </p>
            ) : (
              <p className="mt-0.5 text-xs font-semibold leading-relaxed text-emerald-900">
                Cliente informou que não precisa de troco.
              </p>
            )}
          </div>
        )}

        {isPixReview && (
          <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-orange-700">
              Conferência Pix necessária
            </p>
            <p className="mt-0.5 text-xs font-semibold leading-relaxed text-orange-900">
              Confira data, horário, valor e destinatário do comprovante antes de confirmar.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => onToggleSelected(order.id)}
          className={[
            "mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg border text-xs font-black transition",
            isSelected
              ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
          ].join(" ")}
        >
          <span
            className={[
              "flex h-4 w-4 items-center justify-center rounded border",
              isSelected
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-300 bg-white",
            ].join(" ")}
          >
            {isSelected && <CheckCircle2 className="h-3 w-3" />}
          </span>

          {isSelected ? "Selecionado para impressão" : "Selecionar para impressão"}
        </button>

        <div className="mt-2">
          {status === "analysis" && (
            <>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-bold",
                    acceptRemainingMs <= 10000
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  ].join(" ")}
                >
                  <Clock3 className="h-3 w-3" />
                  {acceptRemainingMs > 0
                    ? formatCountdown(acceptRemainingMs)
                    : "Esgotado"}
                </span>

                <span className="text-slate-400">
                  entrou {formatElapsedTime(order.created_at, nowMs)}
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={[
                    "h-full rounded-full transition-all",
                    acceptRemainingMs <= 10000 ? "bg-red-500" : "bg-emerald-500",
                  ].join(" ")}
                  style={{ width: `${acceptProgress}%` }}
                />
              </div>
            </>
          )}

          {status === "preparation" && (
            <>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-bold",
                    preparationRemainingMs <= 0
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  ].join(" ")}
                >
                  <Clock3 className="h-3 w-3" />
                  {preparationRemainingMs > 0
                    ? `${Math.ceil(preparationRemainingMs / 60000)}min`
                    : "Atrasado"}
                </span>

                <span className="text-slate-400">
                  {averagePrepTimeMinutes}min estimado
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={[
                    "h-full rounded-full transition-all",
                    preparationRemainingMs <= 0 ? "bg-red-500" : String(styles.progress),
                  ].join(" ")}
                  style={{ width: `${preparationProgress}%` }}
                />
              </div>
            </>
          )}

          {status === "ready" && (
            <>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Pronto na cozinha
                </span>

                <span className="text-slate-400">
                  finalizar atendimento
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-full rounded-full bg-emerald-500" />
              </div>
            </>
          )}


        </div>

        <div className="mt-2 rounded-lg border border-slate-100 bg-white p-2 shadow-inner">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Itens
            </p>

            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
              {items.length} item(ns)
            </span>
          </div>

          {visibleItems.length > 0 ? (
            <div className="space-y-1">
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/70 px-2 py-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-slate-600">
                        {item.quantity}x
                      </span>

                      <span className="truncate font-semibold text-slate-800">
                        {item.name}
                      </span>
                    </div>

                    {item.total > 0 && (
                      <span className="shrink-0 text-[11px] font-bold text-slate-600">
                        {formatBRL(item.total)}
                      </span>
                    )}
                  </div>

                  {getSafeOrderItemModifiers(item).length > 0 && (
                    <div className="mt-1 space-y-0.5 pl-6">
                      {getSafeOrderItemModifiers(item).map((modifier, index) => (
                        <p
                          key={`${modifier.groupId ?? modifier.groupName}-${modifier.optionId ?? modifier.optionName}-${index}`}
                          className="text-[11px] font-semibold leading-relaxed text-blue-700"
                        >
                          • {formatOrderItemModifier(modifier)}
                        </p>
                      ))}
                    </div>
                  )}

                  {item.notes && (
                    <p className="mt-1 pl-6 text-[11px] font-semibold leading-relaxed text-amber-700">
                      Obs: {item.notes}
                    </p>
                  )}
                </div>
              ))}

              {hiddenItemsCount > 0 && (
                <p className="text-[11px] font-medium text-slate-500">
                  +{hiddenItemsCount} item(ns)
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Itens do pedido não carregados.
            </p>
          )}
        </div>

        {order.notes && (
          <div className="mt-2 max-h-14 overflow-hidden rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5">
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-700">
              Observação
            </p>
            <p className="mt-0.5 text-xs text-amber-900">{order.notes}</p>
          </div>
        )}

        {isDelivery && (status === "preparation" || status === "ready") && (
          <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/70 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-blue-600" />
                <p className="text-[10px] font-black uppercase tracking-wide text-blue-700">
                  Motoboy
                </p>
              </div>

              {deliveryPersonName ? (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Atribuído
                </span>
              ) : (
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                  Necessário
                </span>
              )}
            </div>

            {status === "preparation" || status === "ready" ? (
              <select
                value={order.delivery_person_id || ""}
                onChange={(event) =>
                  onAssignDeliveryPerson(order.id, event.target.value)
                }
                disabled={isBusy || deliveryPeople.length === 0}
                className="h-9 w-full rounded-lg border border-blue-100 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {deliveryPeople.length === 0
                    ? "Nenhum entregador cadastrado"
                    : "Selecionar motoboy"}
                </option>

                {deliveryPeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                    {person.phone ? ` • ${person.phone}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                  {deliveryPersonName?.charAt(0).toUpperCase() || "M"}
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {deliveryPersonName || "Motoboy não definido"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Taxa: {formatBRL(order.delivery_fee)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-2 border-t border-slate-100 pt-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Total
              </p>
              <p className="text-lg font-black text-slate-950">
                {formatBRL(order.total)}
              </p>
            </div>

            {isDelivery && Number(order.delivery_fee || 0) > 0 && (
              <p className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                Entrega {formatBRL(order.delivery_fee)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => onPrint(order, items, "kitchen")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-orange-700 transition hover:bg-orange-100"
            title="Imprimir comanda da cozinha"
          >
            <ChefHat className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onPrint(order, items, "receipt")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            title="Imprimir recibo do cliente"
          >
            <Printer className="h-4 w-4" />
          </button>

          {status === "analysis" && (
            isPixReview ? (
              <>
                <button
                  type="button"
                  onClick={() => setProofModalOpen(true)}
                  disabled={!order.pix_proof_url}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 text-xs font-black text-orange-700 shadow-sm transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Search className="h-3.5 w-3.5" />
                  Ver comprovante
                </button>

                <button
                  type="button"
                  onClick={() => onConfirmPixPayment(order)}
                  disabled={isBusy}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Confirmar Pix
                </button>

                <button
                  type="button"
                  onClick={() => onCancel(order)}
                  disabled={isBusy}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Cancelar pedido"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onAccept(order)}
                  disabled={isBusy}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Aceitar
                </button>

                <button
                  type="button"
                  onClick={() => onCancel(order)}
                  disabled={isBusy}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Negar
                </button>
              </>
            )
          )}

          {status === "preparation" && (
            kdsEnabled ? (
              <div className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700">
                Aguardando cozinha
              </div>
            ) : (
              <button
                type="button"
                onClick={() => (isDelivery ? onSendToRoute(order) : onFinish(order))}
                disabled={isBusy || (isDelivery && !order.delivery_person_id)}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isDelivery ? (
                  <Truck className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {isDelivery ? "Enviar" : "Finalizar"}
              </button>
            )
          )}

          {status === "ready" && (
            <button
              type="button"
              onClick={() => (isDelivery ? onSendToRoute(order) : onFinish(order))}
              disabled={isBusy || (isDelivery && !order.delivery_person_id)}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isDelivery ? (
                <Truck className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {isDelivery ? "Enviar" : "Servido"}
            </button>
          )}


        </div>
      </div>

      {proofModalOpen &&
  createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => setProofModalOpen(false)}
            aria-hidden="true"
          />

          <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-orange-600">
                  Comprovante Pix
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-950">
                  Pedido #{getOrderNumber(order)}
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Confira valor, data, horário e destinatário antes de confirmar.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setProofModalOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                aria-label="Fechar comprovante"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
              {order.pix_proof_url ? (
                <img
                  src={order.pix_proof_url}
                  alt={`Comprovante Pix do pedido ${getOrderNumber(order)}`}
                  className="mx-auto max-h-[68vh] w-full rounded-xl border border-slate-200 bg-white object-contain shadow-sm"
                />
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <p className="text-sm font-bold text-slate-700">
                    Comprovante não disponível.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Atualize a tela ou peça para o cliente reenviar o comprovante.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 bg-white p-4 sm:flex-row">
              {order.pix_proof_url && (
                <a
                  href={order.pix_proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  Abrir imagem
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  setProofModalOpen(false)
                  onCancel(order)
                }}
                disabled={isBusy}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" />
                Cancelar pedido
              </button>

              <button
                type="button"
                onClick={() => {
                  setProofModalOpen(false)
                  onConfirmPixPayment(order)
                }}
                disabled={isBusy}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Confirmar pagamento
              </button>
            </div>
           </div>
       </div>
    ,
    document.body
  )}
</article>
  )
}

type BoardColumnProps = {
  status: BoardStatus
  orders: OrderRow[]
  orderItemsByOrderId: Record<string, OrderItem[]>
  deliveryPeople: DeliveryPerson[]
  averagePrepTimeMinutes: number
  nowMs: number
  busyOrderId: string | null
  kdsEnabled: boolean
  selectedOrderIds: Set<string>
  onToggleSelected: (orderId: string) => void
  onAccept: (order: OrderRow) => void
  onCancel: (order: OrderRow) => void
  onConfirmPixPayment: (order: OrderRow) => void
  onSendToRoute: (order: OrderRow) => void
  onFinish: (order: OrderRow) => void
  onPrint: (order: OrderRow, items: OrderItem[], mode: ThermalPrintMode) => void
  onAssignDeliveryPerson: (orderId: string, deliveryPersonId: string) => void
}

function BoardColumn({
  status,
  orders,
  orderItemsByOrderId,
  deliveryPeople,
  averagePrepTimeMinutes,
  nowMs,
  busyOrderId,
  kdsEnabled,
  selectedOrderIds,
  onToggleSelected,
  onAccept,
  onCancel,
  onConfirmPixPayment,
  onSendToRoute,
  onFinish,
  onPrint,
  onAssignDeliveryPerson,
}: BoardColumnProps) {
  const styles = columnStyles[status]
  const Icon = styles.icon as typeof Clock3

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`${styles.header} px-4 py-3 text-white`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
              <Icon className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-sm font-black tracking-wide">{styles.title}</h2>
              <p className="text-xs font-medium text-white/80">
                {styles.description as string}
              </p>
            </div>
          </div>

          <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white/20 px-2 text-sm font-black">
            {orders.length}
          </span>
        </div>
      </div>

      <div className={`${styles.body} min-h-[calc(100vh-245px)] space-y-3 p-3`}>
        {orders.length === 0 ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/70 p-6 text-center">
            <div>
              <p className="text-sm font-bold text-slate-700">
                Nenhum pedido aqui
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Os pedidos aparecem automaticamente nessa etapa.
              </p>
            </div>
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              status={status}
              items={orderItemsByOrderId[order.id] || []}
              deliveryPeople={deliveryPeople}
              averagePrepTimeMinutes={averagePrepTimeMinutes}
              nowMs={nowMs}
              busyOrderId={busyOrderId}
              kdsEnabled={kdsEnabled}
              isSelected={selectedOrderIds.has(order.id)}
              onToggleSelected={onToggleSelected}
              onAccept={onAccept}
              onCancel={onCancel}
              onConfirmPixPayment={onConfirmPixPayment}
              onSendToRoute={onSendToRoute}
              onFinish={onFinish}
              onPrint={onPrint}
              onAssignDeliveryPerson={onAssignDeliveryPerson}
            />
          ))
        )}
      </div>
    </section>
  )
}

export default function PedidosPage() {
  const { restaurant, user, isLoading: authLoading } = useAuth()

  const [orders, setOrders] = useState<OrderRow[]>([])
  const [orderItemsByOrderId, setOrderItemsByOrderId] = useState<
    Record<string, OrderItem[]>
  >({})
  const [deliveryPeople, setDeliveryPeople] = useState<DeliveryPerson[]>([])
  const [averagePrepTimeMinutes, setAveragePrepTimeMinutes] = useState(30)
  const [restaurantPrintData, setRestaurantPrintData] =
    useState<RestaurantPrintData | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [savingPrepTime, setSavingPrepTime] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [nowMs, setNowMs] = useState(Date.now())
  const [orderAlertsEnabled, setOrderAlertsEnabled] = useState(false)
  const [kdsEnabled, setKdsEnabled] = useState(true)
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("default")
  const [newOrderAlert, setNewOrderAlert] = useState<NewOrderAlert | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const audioUnlockedRef = useRef(false)
  const alertTimeoutRef = useRef<number | null>(null)
  const previousVisibleOrderIdsRef = useRef<Set<string>>(new Set())
  const notifiedOrderIdsRef = useRef<Set<string>>(new Set())
  const hasSeededVisibleOrdersRef = useRef(false)

  const resumeOrderAudio = useCallback(async () => {
    const AudioContextConstructor = getAudioContextConstructor()

    if (!AudioContextConstructor) return null

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor()
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume()
    }

    audioUnlockedRef.current = audioContextRef.current.state === "running"

    return audioContextRef.current
  }, [])

  const playNewOrderSound = useCallback(async () => {
    try {
      const audioContext = await resumeOrderAudio()

      if (!audioContext) return false

      const masterGain = audioContext.createGain()
      masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime)
      masterGain.gain.exponentialRampToValueAtTime(0.42, audioContext.currentTime + 0.03)
      masterGain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 1.1)
      masterGain.connect(audioContext.destination)

      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator()
        const toneGain = audioContext.createGain()

        oscillator.type = "square"
        oscillator.frequency.setValueAtTime(frequency, startTime)

        toneGain.gain.setValueAtTime(0.0001, startTime)
        toneGain.gain.exponentialRampToValueAtTime(0.9, startTime + 0.015)
        toneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

        oscillator.connect(toneGain)
        toneGain.connect(masterGain)

        oscillator.start(startTime)
        oscillator.stop(startTime + duration + 0.04)
      }

      const start = audioContext.currentTime + 0.02

      playTone(784, start, 0.2)
      playTone(988, start + 0.24, 0.22)
      playTone(1319, start + 0.5, 0.26)

      audioUnlockedRef.current = true
      return true
    } catch (err) {
      console.warn("Não foi possível tocar o alerta sonoro:", err)
      audioUnlockedRef.current = false
      return false
    }
  }, [resumeOrderAudio])

  const disableOrderAlerts = useCallback(() => {
    setOrderAlertsEnabled(false)

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("clickfood_order_alerts_enabled")
    }
  }, [])

  const toggleKdsEnabled = useCallback(() => {
    setKdsEnabled((current) => {
      const nextValue = !current

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "clickfood_kds_enabled",
          nextValue ? "true" : "false"
        )
      }

      return nextValue
    })
  }, [])

  const enableOrderAlerts = useCallback(async () => {
    const soundWorked = await playNewOrderSound()

    if (!soundWorked) {
      setError(
        "O alerta visual foi ativado, mas o navegador não liberou o som. Clique novamente em Ativar alertas e confira se a aba não está mutada."
      )
    } else {
      setError(null)
    }

    setOrderAlertsEnabled(true)

    if (typeof window !== "undefined") {
      window.localStorage.setItem("clickfood_order_alerts_enabled", "true")
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission()
        setNotificationPermission(permission)
      } else {
        setNotificationPermission(Notification.permission)
      }
    } else {
      setNotificationPermission("unsupported")
    }
  }, [playNewOrderSound])

  const showNewOrderAlert = useCallback(
    (order: OrderRow) => {
      if (!order.id) return
      if (notifiedOrderIdsRef.current.has(order.id)) return

      notifiedOrderIdsRef.current.add(order.id)

      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          notifiedOrderIdsRef.current.delete(order.id)
        }, 2 * 60 * 1000)
      }

      const alert: NewOrderAlert = {
        orderId: order.id,
        orderNumber: `#${getOrderNumber(order)}`,
        customerName: getCustomerName(order),
        total: order.total,
        createdAt: order.created_at,
      }

      setNewOrderAlert(alert)

      if (typeof window !== "undefined") {
        if (alertTimeoutRef.current) {
          window.clearTimeout(alertTimeoutRef.current)
        }

        alertTimeoutRef.current = window.setTimeout(() => {
          setNewOrderAlert(null)
        }, 9000)
      }

      if (orderAlertsEnabled) {
        void playNewOrderSound()
      }

      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const notification = new Notification("Novo pedido recebido", {
          body: `${alert.orderNumber} • ${alert.customerName} • ${formatBRL(alert.total)}`,
          tag: `clickfood-order-${order.id}`,
        })

        notification.onclick = () => {
          window.focus()
          notification.close()
        }
      }
    },
    [orderAlertsEnabled, playNewOrderSound]
  )

  async function loadOrderItems(orderIds: string[]) {
    if (orderIds.length === 0) {
      setOrderItemsByOrderId({})
      return
    }

    try {
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds)

      if (error) {
        console.warn("Itens dos pedidos não carregados:", error.message)
        setOrderItemsByOrderId({})
        return
      }

      const grouped: Record<string, OrderItem[]> = {}

      for (const rawItem of (data || []) as Record<string, unknown>[]) {
        const item = normalizeOrderItem(rawItem)

        if (!item.order_id) continue

        if (!grouped[item.order_id]) {
          grouped[item.order_id] = []
        }

        grouped[item.order_id].push(item)
      }

      setOrderItemsByOrderId(grouped)
    } catch (err) {
      console.warn("Erro inesperado ao carregar itens dos pedidos:", err)
      setOrderItemsByOrderId({})
    }
  }

  async function loadOrders(showRefresh = false) {
    if (!restaurant?.id) return

    try {
      if (showRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError(null)

      const session = await ensureSupabaseSession()

      if (!session) {
        setLoading(false)
        setRefreshing(false)
        return
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .in("status", OPEN_ORDER_STATUSES)
        .order("created_at", { ascending: false })

      if (error) throw error

      const visibleOrders = ((data || []) as OrderRow[]).filter(isOrderVisibleOnBoard)

      setOrders(visibleOrders)
      setLastUpdatedAt(new Date())

      void loadOrderItems(visibleOrders.map((order) => order.id))
    } catch (err) {
      console.error("Erro ao buscar pedidos:", err)
      setError(getErrorMessage(err, "Erro ao buscar pedidos."))
      setOrders([])
      setOrderItemsByOrderId({})
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function loadDeliveryPeople() {
    if (!restaurant?.id) return

    try {
      const session = await ensureSupabaseSession()

      if (!session) return

      const { data, error } = await supabase
        .from("delivery_people")
        .select("id, name, phone, is_active, created_at")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("name", { ascending: true })

      if (error) throw error

      setDeliveryPeople((data || []) as DeliveryPerson[])
    } catch (err) {
      console.error("Erro ao carregar entregadores:", err)
      setError(getErrorMessage(err, "Erro ao carregar entregadores."))
    }
  }

  async function loadRestaurantSettings() {
    if (!restaurant?.id) return

    try {
      const session = await ensureSupabaseSession()

      if (!session) return

      const { data, error } = await supabase
        .from("restaurants")
        .select("name, logo_url, phone, address, average_prep_time_minutes")
        .eq("id", restaurant.id)
        .single()

      if (error) throw error

      setAveragePrepTimeMinutes(Number(data.average_prep_time_minutes || 30))

      setRestaurantPrintData({
        name: data.name?.trim() || "Restaurante",
        logoUrl: data.logo_url || null,
        phone: data.phone || null,
        address: data.address || null,
      })
    } catch (err) {
      console.error("Erro ao carregar configurações do restaurante:", err)
      setError(getErrorMessage(err, "Erro ao carregar configurações do restaurante."))
    }
  }

  async function updateAveragePrepTime(nextValue: number) {
    if (!restaurant?.id) return

    const previousValue = averagePrepTimeMinutes

    try {
      setSavingPrepTime(true)
      setAveragePrepTimeMinutes(nextValue)

      const { error } = await supabase
        .from("restaurants")
        .update({ average_prep_time_minutes: nextValue })
        .eq("id", restaurant.id)

      if (error) throw error
    } catch (err) {
      console.error("Erro ao salvar tempo médio:", err)
      setAveragePrepTimeMinutes(previousValue)
      setError(getErrorMessage(err, "Erro ao salvar tempo médio."))
    } finally {
      setSavingPrepTime(false)
    }
  }

  async function loadInitialData() {
    if (!restaurant?.id) return

    setError(null)

    await loadOrders()
    void loadDeliveryPeople()
    void loadRestaurantSettings()
  }

  async function refreshAll() {
    if (!restaurant?.id) return

    setError(null)

    await Promise.all([
      loadOrders(true),
      loadDeliveryPeople(),
      loadRestaurantSettings(),
    ])
  }

  async function assignDeliveryPerson(orderId: string, deliveryPersonId: string) {
    const previousOrders = orders

    try {
      setBusyOrderId(orderId)
      setError(null)

      setOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                delivery_person_id: deliveryPersonId || null,
              }
            : order
        )
      )

      const { error } = await supabase
        .from("orders")
        .update({
          delivery_person_id: deliveryPersonId || null,
        })
        .eq("id", orderId)
        .eq("restaurant_id", restaurant?.id)

      if (error) throw error
    } catch (err) {
      console.error("Erro ao vincular entregador:", err)
      setOrders(previousOrders)
      setError(getErrorMessage(err, "Erro ao vincular entregador."))
    } finally {
      setBusyOrderId(null)
    }
  }

  async function registerLoyaltyOrder(orderId: string) {
    const session = await ensureSupabaseSession()

    if (!session?.access_token) {
      throw new Error("Sessão expirada. Entre novamente para registrar fidelidade.")
    }

    const response = await fetch("/api/loyalty/register-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        order_id: orderId,
      }),
    })

    const result = await response.json().catch(() => null)

    if (!response.ok || result?.success === false) {
      throw new Error(result?.error || "Erro ao registrar fidelidade.")
    }

    return result
  }

  async function deductStockForOrder(orderId: string) {
    if (!restaurant?.id) {
      throw new Error("Restaurante não encontrado para baixar estoque.")
    }

    const deductedAt = new Date().toISOString()

    const { data: claimedItems, error: claimError } = await supabase
      .from("order_items")
      .update({ stock_deducted_at: deductedAt })
      .eq("order_id", orderId)
      .is("stock_deducted_at", null)
      .not("product_id", "is", null)
      .select("id, product_id, quantity")

    if (claimError) throw claimError

    const orderItemsToDeduct = ((claimedItems || []) as OrderItemStockDeductionRow[])
      .filter((item) => item.product_id && Number(item.quantity || 0) > 0)

    if (orderItemsToDeduct.length === 0) return

    const quantityByProductId = new Map<string, number>()

    for (const item of orderItemsToDeduct) {
      if (!item.product_id) continue

      const productId = String(item.product_id)
      const quantity = Number(item.quantity || 0)

      quantityByProductId.set(
        productId,
        (quantityByProductId.get(productId) || 0) + quantity
      )
    }

    const productIds = Array.from(quantityByProductId.keys())

    if (productIds.length === 0) return

    const { data: recipeRows, error: recipeError } = await supabase
      .from("product_recipe_items")
      .select("product_id, stock_item_id, quantity")
      .eq("restaurant_id", restaurant.id)
      .in("product_id", productIds)

    if (recipeError) throw recipeError

    const deductionByStockItemId = new Map<string, number>()

    for (const recipe of (recipeRows || []) as ProductRecipeStockRow[]) {
      if (!recipe.product_id || !recipe.stock_item_id) continue

      const soldQuantity = quantityByProductId.get(String(recipe.product_id)) || 0
      const recipeQuantity = Number(recipe.quantity || 0)
      const totalDeduction = soldQuantity * recipeQuantity

      if (totalDeduction <= 0) continue

      const stockItemId = String(recipe.stock_item_id)

      deductionByStockItemId.set(
        stockItemId,
        (deductionByStockItemId.get(stockItemId) || 0) + totalDeduction
      )
    }

    const stockItemIds = Array.from(deductionByStockItemId.keys())

    if (stockItemIds.length === 0) return

    const { data: stockRows, error: stockError } = await supabase
      .from("stock_items")
      .select("id, current_quantity")
      .eq("restaurant_id", restaurant.id)
      .in("id", stockItemIds)

    if (stockError) throw stockError

    for (const stockItem of (stockRows || []) as StockQuantityRow[]) {
      const deductionQuantity = deductionByStockItemId.get(stockItem.id) || 0

      if (deductionQuantity <= 0) continue

      const currentQuantity = Number(stockItem.current_quantity || 0)
      const nextQuantity = currentQuantity - deductionQuantity

      const { error: updateStockError } = await supabase
        .from("stock_items")
        .update({
          current_quantity: nextQuantity,
        })
        .eq("id", stockItem.id)
        .eq("restaurant_id", restaurant.id)

      if (updateStockError) throw updateStockError
    }
  }

  async function updateOrder(
    order: OrderRow,
    action: "accept" | "cancel" | "route" | "finish"
  ) {
    const previousOrders = orders
    const nowIso = new Date().toISOString()

    try {
      setBusyOrderId(order.id)
      setError(null)

      let payload: Partial<OrderRow> = {}

      if (action === "accept") {
        payload = {
          status: "accepted",
          accepted_at: nowIso,
          preparation_started_at: nowIso,
        }
      }

      if (action === "cancel") {
        payload = {
          status: "cancelled",
          cancelled_at: nowIso,
        }
      }

      if (action === "route") {
        if (!isDeliveryOrder(order)) {
          payload = {
            status: "delivered",
            delivered_at: nowIso,
          }
        } else {
          if (!order.delivery_person_id) {
            setError("Selecione um motoboy antes de enviar o pedido para entrega.")
            return
          }

          payload = {
            status: "out_for_delivery",
            out_for_delivery_at: nowIso,
          }
        }
      }

      if (action === "finish") {
        payload = {
          status: "delivered",
          delivered_at: nowIso,
        }
      }

      setOrders((current) =>
        current.map((item) =>
          item.id === order.id
            ? {
                ...item,
                ...payload,
              }
            : item
        )
      )

      const { error } = await supabase
        .from("orders")
        .update(payload)
        .eq("id", order.id)
        .eq("restaurant_id", restaurant?.id)

      if (error) throw error

      if (action === "accept") {
        try {
          await deductStockForOrder(order.id)
        } catch (stockError) {
          console.error("Pedido aceito, mas estoque não foi baixado:", stockError)

          setError(
            getErrorMessage(
              stockError,
              "Pedido aceito, mas não foi possível baixar o estoque automaticamente."
            )
          )
        }
      }

      if (payload.status === "delivered") {
        try {
          await registerLoyaltyOrder(order.id)
        } catch (loyaltyError) {
          console.error(
            "Pedido finalizado, mas fidelidade não registrada:",
            loyaltyError
          )

          setError(
            getErrorMessage(
              loyaltyError,
              "Pedido finalizado, mas não foi possível registrar a fidelidade."
            )
          )
        }
      }
    } catch (err) {
      console.error("Erro ao atualizar pedido:", err)
      setOrders(previousOrders)
      setError(getErrorMessage(err, "Erro ao atualizar pedido."))
    } finally {
      setBusyOrderId(null)
    }
  }

  async function confirmPixPayment(order: OrderRow) {
    const previousOrders = orders
    const nowIso = new Date().toISOString()

    try {
      setBusyOrderId(order.id)
      setError(null)

      const payload: Partial<OrderRow> = {
        payment_status: "paid",
        status: "pending",
        pix_confirmed_at: nowIso,
        pix_confirmed_by: user?.id ?? null,
      }

      setOrders((current) =>
        current.map((item) =>
          item.id === order.id
            ? {
                ...item,
                ...payload,
              }
            : item
        )
      )

      const { error } = await supabase
        .from("orders")
        .update(payload)
        .eq("id", order.id)
        .eq("restaurant_id", restaurant?.id)

      if (error) throw error
    } catch (err) {
      console.error("Erro ao confirmar Pix:", err)
      setOrders(previousOrders)
      setError(getErrorMessage(err, "Erro ao confirmar pagamento Pix."))
    } finally {
      setBusyOrderId(null)
    }
  }

  function handlePrintOrder(
    order: OrderRow,
    items: OrderItem[],
    mode: ThermalPrintMode
  ) {
    printThermalOrder({
      restaurant: restaurantPrintData || getRestaurantPrintData(restaurant),
      mode,
      size: "80mm",
      order: buildThermalOrderPayload(order, items),
    })
  }

  function toggleOrderSelection(orderId: string) {
    setSelectedOrderIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId]
    )
  }

  function clearSelectedOrders() {
    setSelectedOrderIds([])
  }

  function selectVisibleOrders(orderIds: string[]) {
    setSelectedOrderIds(orderIds)
  }

  function handlePrintSelectedOrders(mode: ThermalPrintMode) {
    const selectedOrdersToPrint = orders.filter((order) =>
      selectedOrderIds.includes(order.id)
    )

    if (selectedOrdersToPrint.length === 0) {
      setError("Selecione pelo menos um pedido para imprimir.")
      return
    }

    printThermalOrdersBatch({
      restaurant: restaurantPrintData || getRestaurantPrintData(restaurant),
      mode,
      size: "80mm",
      orders: selectedOrdersToPrint.map((order) =>
        buildThermalOrderPayload(order, orderItemsByOrderId[order.id] || [])
      ),
    })
  }

  useEffect(() => {
    setSelectedOrderIds((current) =>
      current.filter((orderId) => orders.some((order) => order.id === orderId))
    )
  }, [orders])

  useEffect(() => {
    if (typeof window === "undefined") return

    setOrderAlertsEnabled(
      window.localStorage.getItem("clickfood_order_alerts_enabled") === "true"
    )

    setKdsEnabled(window.localStorage.getItem("clickfood_kds_enabled") !== "false")

    if ("Notification" in window) {
      setNotificationPermission(Notification.permission)
    } else {
      setNotificationPermission("unsupported")
    }

    return () => {
      if (alertTimeoutRef.current) {
        window.clearTimeout(alertTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!restaurant?.id) {
      previousVisibleOrderIdsRef.current = new Set()
      notifiedOrderIdsRef.current = new Set()
      hasSeededVisibleOrdersRef.current = false
      return
    }

    const visibleOrders = orders.filter(isOrderVisibleOnBoard)
    const nextIds = new Set(visibleOrders.map((order) => order.id))

    if (!hasSeededVisibleOrdersRef.current) {
      previousVisibleOrderIdsRef.current = nextIds
      hasSeededVisibleOrdersRef.current = true
      return
    }

    const newestIncomingOrder = visibleOrders
      .filter((order) => !previousVisibleOrderIdsRef.current.has(order.id))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]

    previousVisibleOrderIdsRef.current = nextIds

    if (newestIncomingOrder) {
      showNewOrderAlert(newestIncomingOrder)
    }
  }, [orders, restaurant?.id, showNewOrderAlert])

  useEffect(() => {
    if (authLoading) {
      setLoading(true)
      return
    }

    if (!user || !restaurant?.id) {
      setOrders([])
      setOrderItemsByOrderId({})
      setDeliveryPeople([])
      setNewOrderAlert(null)
      previousVisibleOrderIdsRef.current = new Set()
      notifiedOrderIdsRef.current = new Set()
      hasSeededVisibleOrdersRef.current = false
      setLoading(false)
      setRefreshing(false)
      setError(null)
      return
    }

    void loadInitialData()

    const refreshInterval = window.setInterval(() => {
      void loadOrders(true)
    }, 15000)

    const ordersChannel = supabase
      .channel(`orders-live-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          void loadOrders(true)
        }
      )
      .subscribe()

    const deliveryPeopleChannel = supabase
      .channel(`delivery-people-live-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_people",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          void loadDeliveryPeople()
        }
      )
      .subscribe()

    return () => {
      window.clearInterval(refreshInterval)
      void supabase.removeChannel(ordersChannel)
      void supabase.removeChannel(deliveryPeopleChannel)
    }
  }, [authLoading, restaurant?.id, user?.id])

  useEffect(() => {
    if (!restaurant?.id || !user?.id) return

    const handlePageBack = () => {
      if (document.visibilityState === "visible") {
        void loadOrders(true)
        void loadDeliveryPeople()
        void loadRestaurantSettings()
      }
    }

    const handleWindowFocus = () => {
      void loadOrders(true)
      void loadDeliveryPeople()
      void loadRestaurantSettings()
    }

    document.addEventListener("visibilitychange", handlePageBack)
    window.addEventListener("focus", handleWindowFocus)

    return () => {
      document.removeEventListener("visibilitychange", handlePageBack)
      window.removeEventListener("focus", handleWindowFocus)
    }
  }, [restaurant?.id, user?.id])

  const openOrders = useMemo(() => {
    return orders.filter((order) => getBoardStatus(order.status) !== null)
  }, [orders])

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return openOrders.filter((order) => {
      if (!normalizedSearch) return true

      const customerName = getCustomerName(order).toLowerCase()
      const customerPhone = getCustomerPhone(order).toLowerCase()
      const orderNumber = getOrderNumber(order).toLowerCase()

      return (
        customerName.includes(normalizedSearch) ||
        customerPhone.includes(normalizedSearch) ||
        orderNumber.includes(normalizedSearch)
      )
    })
  }, [openOrders, search])

  const selectedOrderIdSet = useMemo(() => {
    return new Set(selectedOrderIds)
  }, [selectedOrderIds])

  const selectedVisibleOrders = useMemo(() => {
    return filteredOrders.filter((order) => selectedOrderIdSet.has(order.id))
  }, [filteredOrders, selectedOrderIdSet])

  const analysisOrders = useMemo(
    () => filteredOrders.filter((order) => getBoardStatus(order.status) === "analysis"),
    [filteredOrders]
  )

  const preparationOrders = useMemo(
    () =>
      filteredOrders.filter(
        (order) => getBoardStatus(order.status) === "preparation"
      ),
    [filteredOrders]
  )

  const readyOrders = useMemo(
    () => filteredOrders.filter((order) => getBoardStatus(order.status) === "ready"),
    [filteredOrders]
  )


  return (
    <AdminLayout title="Pedidos" description="Central operacional do restaurante">
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-center">
              <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px]">
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar cliente, telefone ou pedido..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>

                <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
                  <Settings2 className="h-4 w-4 shrink-0 text-slate-500" />

                  <span className="whitespace-nowrap text-sm font-semibold text-slate-700">
                    Tempo:
                  </span>

                  <select
                    value={averagePrepTimeMinutes}
                    onChange={(event) =>
                      updateAveragePrepTime(Number(event.target.value))
                    }
                    disabled={savingPrepTime}
                    className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  >
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={20}>20 min</option>
                    <option value={25}>25 min</option>
                    <option value={30}>30 min</option>
                    <option value={35}>35 min</option>
                    <option value={40}>40 min</option>
                    <option value={45}>45 min</option>
                    <option value={50}>50 min</option>
                    <option value={60}>60 min</option>
                  </select>

                  {savingPrepTime && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 2xl:justify-end">
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                  {lastUpdatedAt
                    ? `Atualizado às ${lastUpdatedAt.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}`
                    : "Aguardando dados..."}
                </p>

                <button
                  type="button"
                  onClick={() => void refreshAll()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  {refreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                  Atualizar
                </button>

                <button
                  type="button"
                  onClick={toggleKdsEnabled}
                  className={[
                    "inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition",
                    kdsEnabled
                      ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      : "border-slate-300 bg-slate-900 text-white hover:bg-slate-800",
                  ].join(" ")}
                  title={
                    kdsEnabled
                      ? "KDS ativo: a cozinha controla quando o pedido fica pronto."
                      : "KDS desativado: a aba Pedidos controla envio/finalização."
                  }
                >
                  <ChefHat className="h-4 w-4" />
                  {kdsEnabled ? "KDS ativo" : "KDS desativado"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (orderAlertsEnabled) {
                      disableOrderAlerts()
                      return
                    }

                    void enableOrderAlerts()
                  }}
                  className={[
                    "inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition",
                    orderAlertsEnabled
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
                  ].join(" ")}
                  title={
                    notificationPermission === "denied"
                      ? "O navegador bloqueou notificações de desktop, mas o som do painel pode funcionar."
                      : undefined
                  }
                >
                  {orderAlertsEnabled ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <BellRing className="h-4 w-4" />
                  )}
                  {orderAlertsEnabled ? "Alertas ativos" : "Ativar alertas"}
                </button>
              </div>
            </div>

            {filteredOrders.length > 0 && (
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    Impressão em lote
                  </p>

                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    {selectedVisibleOrders.length > 0
                      ? `${selectedVisibleOrders.length} pedido(s) selecionado(s) de ${filteredOrders.length} visível(is).`
                      : "Selecione os pedidos que deseja imprimir."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectVisibleOrders(filteredOrders.map((order) => order.id))}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    Selecionar visíveis
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrintSelectedOrders("kitchen")}
                    disabled={selectedVisibleOrders.length === 0}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 text-xs font-black text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <ChefHat className="h-4 w-4" />
                    Cozinha ({selectedVisibleOrders.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrintSelectedOrders("receipt")}
                    disabled={selectedVisibleOrders.length === 0}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Printer className="h-4 w-4" />
                    Recibos ({selectedVisibleOrders.length})
                  </button>

                  <button
                    type="button"
                    onClick={clearSelectedOrders}
                    disabled={selectedVisibleOrders.length === 0}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            {newOrderAlert && (
              <div className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                      <BellRing className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-emerald-900">
                        Novo pedido recebido
                      </p>

                      <p className="truncate text-xs font-bold text-emerald-800">
                        {newOrderAlert.orderNumber} • {newOrderAlert.customerName} • {formatBRL(newOrderAlert.total)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setNewOrderAlert(null)}
                    className="shrink-0 rounded-full p-1 text-emerald-700 transition hover:bg-emerald-100"
                    aria-label="Fechar alerta de novo pedido"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando operação...
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[1140px] grid-cols-3 gap-4">
              <BoardColumn
                status="analysis"
                orders={analysisOrders}
                orderItemsByOrderId={orderItemsByOrderId}
                deliveryPeople={deliveryPeople}
                averagePrepTimeMinutes={averagePrepTimeMinutes}
                nowMs={nowMs}
                busyOrderId={busyOrderId}
                kdsEnabled={kdsEnabled}
                selectedOrderIds={selectedOrderIdSet}
                onToggleSelected={toggleOrderSelection}
                onAccept={(order) => void updateOrder(order, "accept")}
                onCancel={(order) => void updateOrder(order, "cancel")}
                onConfirmPixPayment={(order) => void confirmPixPayment(order)}
                onSendToRoute={(order) => void updateOrder(order, "route")}
                onFinish={(order) => void updateOrder(order, "finish")}
                onPrint={handlePrintOrder}
                onAssignDeliveryPerson={(orderId, deliveryPersonId) =>
                  void assignDeliveryPerson(orderId, deliveryPersonId)
                }
              />

              <BoardColumn
                status="preparation"
                orders={preparationOrders}
                orderItemsByOrderId={orderItemsByOrderId}
                deliveryPeople={deliveryPeople}
                averagePrepTimeMinutes={averagePrepTimeMinutes}
                nowMs={nowMs}
                busyOrderId={busyOrderId}
                kdsEnabled={kdsEnabled}
                selectedOrderIds={selectedOrderIdSet}
                onToggleSelected={toggleOrderSelection}
                onAccept={(order) => void updateOrder(order, "accept")}
                onCancel={(order) => void updateOrder(order, "cancel")}
                onConfirmPixPayment={(order) => void confirmPixPayment(order)}
                onSendToRoute={(order) => void updateOrder(order, "route")}
                onFinish={(order) => void updateOrder(order, "finish")}
                onPrint={handlePrintOrder}
                onAssignDeliveryPerson={(orderId, deliveryPersonId) =>
                  void assignDeliveryPerson(orderId, deliveryPersonId)
                }
              />

              <BoardColumn
                status="ready"
                orders={readyOrders}
                orderItemsByOrderId={orderItemsByOrderId}
                deliveryPeople={deliveryPeople}
                averagePrepTimeMinutes={averagePrepTimeMinutes}
                nowMs={nowMs}
                busyOrderId={busyOrderId}
                kdsEnabled={kdsEnabled}
                selectedOrderIds={selectedOrderIdSet}
                onToggleSelected={toggleOrderSelection}
                onAccept={(order) => void updateOrder(order, "accept")}
                onCancel={(order) => void updateOrder(order, "cancel")}
                onConfirmPixPayment={(order) => void confirmPixPayment(order)}
                onSendToRoute={(order) => void updateOrder(order, "route")}
                onFinish={(order) => void updateOrder(order, "finish")}
                onPrint={handlePrintOrder}
                onAssignDeliveryPerson={(orderId, deliveryPersonId) =>
                  void assignDeliveryPerson(orderId, deliveryPersonId)
                }
              />


            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}