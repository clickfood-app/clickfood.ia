"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  BellRing,
  Bot,
  CheckCircle2,
  ChefHat,
  Clock3,
  CreditCard,
  Eye,
  History,
  Loader2,
  MapPin,
  Package,
  Phone,
  Printer,
  RefreshCcw,
  Search,
  Settings2,
  Truck,
  User,
  Volume2,
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
  source?: string | null
  order_source?: string | null
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
type ViewMode = "operation" | "history"
type HistoryStatusFilter = "all" | "open" | "finished" | "cancelled"
type HistoryPaymentStatusFilter = "all" | "paid" | "pending" | "cancelled"

type HistoryFilters = {
  dateFrom: string
  dateTo: string
  status: HistoryStatusFilter
  paymentStatus: HistoryPaymentStatusFilter
  paymentMethod: string
  deliveryPersonId: string
}

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

const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  dateFrom: "",
  dateTo: "",
  status: "all",
  paymentStatus: "all",
  paymentMethod: "all",
  deliveryPersonId: "all",
}

const columnStyles = {
  analysis: {
    title: "Pendentes",
    description: "Aguardando aceite",
    icon: Clock3,
    accent: "bg-yellow-400",
    border: "border-yellow-500/30",
    badge: "border-yellow-500/30 bg-yellow-400/10 text-yellow-300",
    body: "bg-[#050505]",
  },
  preparation: {
    title: "Em preparo",
    description: "Na cozinha",
    icon: ChefHat,
    accent: "bg-yellow-400",
    border: "border-yellow-500/30",
    badge: "border-yellow-500/30 bg-yellow-400/10 text-yellow-300",
    body: "bg-[#050505]",
  },
  ready: {
    title: "Prontos",
    description: "Aguardando finalização",
    icon: CheckCircle2,
    accent: "bg-yellow-400",
    border: "border-yellow-500/30",
    badge: "border-yellow-500/30 bg-yellow-400/10 text-yellow-300",
    body: "bg-[#050505]",
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
      .join(" · ")

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

  if (paymentMethod === "pix" || paymentMethod === "efi_pix") {
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

function formatItemCount(count: number) {
  return `${count} ${count === 1 ? "item" : "itens"}`
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
    (modifier) => `  · ${formatOrderItemModifier(modifier)}`
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Não informado"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return "Não informado"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getTodayInputDate() {
  return formatInputDate(new Date())
}

function getYesterdayInputDate() {
  const date = new Date()
  date.setDate(date.getDate() - 1)

  return formatInputDate(date)
}

function getLastSevenDaysInputDate() {
  const date = new Date()
  date.setDate(date.getDate() - 6)

  return formatInputDate(date)
}

function getDateStartIso(value: string) {
  return new Date(`${value}T00:00:00`).toISOString()
}

function getDateEndIso(value: string) {
  return new Date(`${value}T23:59:59.999`).toISOString()
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

function getOrderNeighborhood(order: OrderRow) {
  return getOrderTextField(order, [
    "customer_neighborhood",
    "delivery_neighborhood",
    "shipping_neighborhood",
    "neighborhood",
    "bairro",
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
  const neighborhood = getOrderNeighborhood(order)
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
    .join(" · ")

  return fullAddress || null
}

function isWhatsAppAiOrder(order: OrderRow) {
  const source = String(order.order_source || order.source || "")
    .trim()
    .toLowerCase()

  return source === "whatsapp_ai"
}

function getCleanOrderNote(note: string | null | undefined) {
  const value = note?.trim()

  if (!value) return null

  const normalized = value.toLowerCase()

  if (
    normalized.includes("pedido criado pela ia") ||
    normalized.includes("pedido criado por ia") ||
    normalized.includes("pedido criado pelo assistente") ||
    normalized.includes("pedido criado pela ia do whatsapp") ||
    normalized.includes("ai draft")
  ) {
    return "Pedido criado por IA"
  }

  return value
}

function buildPrintNotes(order: OrderRow) {
  if (isWhatsAppAiOrder(order)) return "Pedido criado por IA"

  return getCleanOrderNote(order.notes)
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
  if (!paymentMethod) return "Não informado"

  const normalized = normalizeStatus(paymentMethod)

  if (normalized === "pix") return "Pix automático"
  if (normalized === "efi_pix") return "Pix automático"
  if (isManualPixMethod(normalized)) return "Pix direto"
  if (normalized === "cash" || normalized === "dinheiro" || normalized === "cash_on_delivery") return "Dinheiro"
  if (normalized === "dinheiro_na_entrega") return "Dinheiro"
  if (normalized === "card_on_delivery") return "Cartão na entrega"
  if (normalized === "credit_card" || normalized === "credito" || normalized === "credit_card_on_delivery") return "Crédito"
  if (normalized === "debit_card" || normalized === "debito" || normalized === "debit_card_on_delivery") return "Débito"
  if (normalized === "mesa") return "Mesa"
  if (normalized === "pending" || normalized === "pendente") return "A confirmar"
  if (normalized === "waiting_payment" || normalized === "awaiting_payment") return "Aguardando pagamento"
  if (normalized === "waiting_customer_payment") return "Aguardando pagamento"

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
  const normalized = normalizeStatus(paymentStatus)

  if (!normalized) return "Não informado"

  if (normalized === "paid" || normalized === "pago" || normalized === "approved" || normalized === "confirmed") {
    return "Pago"
  }

  if (
    normalized === "awaiting_review" ||
    normalized === "aguardando_conferencia" ||
    normalized === "aguardando conferência" ||
    normalized === "waiting_pix_confirmation" ||
    normalized === "awaiting_pix_review" ||
    normalized === "aguardando_confirmacao_pix" ||
    normalized === "aguardando confirmação pix"
  ) {
    return "Conferir Pix"
  }

  if (
    normalized === "waiting_customer_payment" ||
    normalized === "waiting_payment" ||
    normalized === "awaiting_payment" ||
    normalized === "aguardando_pagamento" ||
    normalized === "aguardando pagamento"
  ) {
    return "Aguardando pagamento"
  }

  if (normalized === "pending" || normalized === "pendente" || normalized === "open" || normalized === "created") {
    return "Pendente"
  }

  if (normalized === "failed" || normalized === "falhou" || normalized === "erro") return "Falhou"
  if (normalized === "cancelled" || normalized === "canceled" || normalized === "cancelado") return "Cancelado"
  if (normalized === "refunded" || normalized === "reembolsado") return "Reembolsado"

  return paymentStatus
}

function isFinishedOrderStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status)

  return (
    normalized === "delivered" ||
    normalized === "completed" ||
    normalized === "finalizado" ||
    normalized === "finalizada" ||
    normalized === "finished"
  )
}

function isCancelledOrderStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status)

  return (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "cancelado" ||
    normalized === "cancelada"
  )
}

function isPaidPaymentStatus(paymentStatus: string | null | undefined) {
  const normalized = normalizeStatus(paymentStatus)

  return (
    normalized === "paid" ||
    normalized === "pago" ||
    normalized === "approved" ||
    normalized === "confirmed"
  )
}

function isCancelledPaymentStatus(paymentStatus: string | null | undefined) {
  const normalized = normalizeStatus(paymentStatus)

  return (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "cancelado" ||
    normalized === "cancelada" ||
    normalized === "failed" ||
    normalized === "falhou"
  )
}

function isPendingPaymentStatus(paymentStatus: string | null | undefined) {
  return !isPaidPaymentStatus(paymentStatus) && !isCancelledPaymentStatus(paymentStatus)
}

function getOrderStatusLabel(status: string | null | undefined) {
  const normalized = normalizeStatus(status)

  if (isAnalysisStatus(normalized)) return "Pendente"
  if (isPreparationStatus(normalized)) return "Em preparo"
  if (isReadyStatus(normalized)) return "Pronto"
  if (normalized === "out_for_delivery" || normalized === "em_rota" || normalized === "em rota") return "Em rota"
  if (isFinishedOrderStatus(normalized)) return "Finalizado"
  if (isCancelledOrderStatus(normalized)) return "Cancelado"
  if (normalized === "waiting_payment" || normalized === "awaiting_payment") return "Aguardando pagamento"

  return status || "Não informado"
}

function getOrderStatusBadgeClasses(status: string | null | undefined) {
  if (isFinishedOrderStatus(status)) {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-400"
  }

  if (isCancelledOrderStatus(status)) {
    return "border-red-500/30 bg-red-500/10 text-red-300"
  }

  if (isReadyStatus(status)) {
    return "border-yellow-500/30 bg-yellow-400/10 text-yellow-300"
  }

  if (isPreparationStatus(status)) {
    return "border-blue-400/30 bg-blue-500/10 text-blue-300"
  }

  return "border-white/10 bg-[#050505] text-zinc-400"
}

function matchesHistoryStatus(order: OrderRow, filter: HistoryStatusFilter) {
  if (filter === "all") return true
  if (filter === "open") return getBoardStatus(order.status) !== null
  if (filter === "finished") return isFinishedOrderStatus(order.status)
  if (filter === "cancelled") return isCancelledOrderStatus(order.status)

  return true
}

function matchesHistoryPaymentStatus(order: OrderRow, filter: HistoryPaymentStatusFilter) {
  if (filter === "all") return true
  if (filter === "paid") return isPaidPaymentStatus(order.payment_status)
  if (filter === "pending") return isPendingPaymentStatus(order.payment_status)
  if (filter === "cancelled") return isCancelledPaymentStatus(order.payment_status)

  return true
}

function formatHistoryItemsSummary(items: OrderItem[]) {
  if (items.length === 0) return "Itens não carregados"

  const preview = items
    .slice(0, 2)
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(", ")

  if (items.length <= 2) return preview

  return `${preview} +${items.length - 2}`
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

  const neighborhood = getOrderNeighborhood(order)

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
  onMarkReady: (order: OrderRow) => void
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
  onAccept,
  onCancel,
  onConfirmPixPayment,
  onMarkReady,
  onSendToRoute,
  onFinish,
  onPrint,
  onAssignDeliveryPerson,
}: OrderCardProps) {
  const isBusy = busyOrderId === order.id
  const isDelivery = isDeliveryOrder(order)
  const TypeIcon = isDelivery ? Truck : Package
  const isPixReview = isPixAwaitingReview(order)
  const deliveryAddress = getOrderAddress(order)
  const customerCpf = getOrderCpf(order)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [proofOpen, setProofOpen] = useState(false)

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

  const statusLabel =
    status === "analysis"
      ? "Pendente"
      : status === "preparation"
        ? "Em preparo"
        : "Pronto"

  const primaryActionLabel =
    status === "analysis"
      ? isPixReview
        ? "Conferir Pix"
        : "Aceitar"
      : status === "preparation"
        ? "Pronto"
        : "Finalizar"

  const showCashChange =
    isCashPaymentMethod(order.payment_method) &&
    order.needs_change &&
    getOrderChangeFor(order) > 0
  const isAiOrder = isWhatsAppAiOrder(order)
  const cleanOrderNote = getCleanOrderNote(order.notes)

  const handlePrimaryAction = () => {
    if (status === "analysis") {
      if (isPixReview) {
        setDetailsOpen(true)
        return
      }

      onAccept(order)
      return
    }

    if (status === "preparation") {
      onMarkReady(order)
      return
    }

    if (isDelivery) {
      onSendToRoute(order)
      return
    }

    onFinish(order)
  }

  const primaryActionDisabled =
    isBusy ||
    (status === "preparation" && kdsEnabled) ||
    (status === "ready" && isDelivery && !order.delivery_person_id)

  return (
    <>
      <article
        className={[
          "overflow-hidden rounded-xl border bg-[#0d0d0d] shadow-sm transition hover:border-yellow-400/40",
          isLate ? "border-red-500/60 ring-1 ring-red-500/15" : "border-white/10",
        ].join(" ")}
      >
        <div className={isLate ? "h-px bg-red-500" : "h-px bg-yellow-400/70"} />

        <div className="p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-black leading-none text-white">
                #{getOrderNumber(order)}
              </h3>

              <p className="mt-1.5 truncate text-sm font-black text-white">
                {getCustomerName(order)}
              </p>

              <p className="mt-0.5 truncate text-xs font-semibold text-zinc-500">
                {getCustomerPhone(order)}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#050505] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-zinc-500">
                <TypeIcon className="h-3 w-3" />
                {getOrderTypeLabel(order)}
              </span>

              <span className="inline-flex rounded-full border border-white/10 bg-black px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-zinc-500">
                {statusLabel}
              </span>
            </div>
          </div>

          {isAiOrder && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#080808] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-500">
              <Bot className="h-3 w-3 text-yellow-300" />
              Pedido criado por IA
            </div>
          )}

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-white/10 bg-black px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-zinc-500">
                {formatItemCount(items.length)} · {getPaymentLabel(order.payment_method)}
              </p>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-zinc-500">
                Status: {getPaymentStatusLabel(order.payment_status)}
              </p>
            </div>

            <p className="text-sm font-black text-white">
              {formatBRL(order.total)}
            </p>
          </div>

          {status === "analysis" && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span
                  className={[
                    "font-black",
                    acceptRemainingMs <= 10000 ? "text-red-400" : "text-yellow-300",
                  ].join(" ")}
                >
                  {acceptRemainingMs > 0
                    ? formatCountdown(acceptRemainingMs)
                    : "Tempo esgotado"}
                </span>

                <span className="font-semibold text-zinc-500">
                  entrou {formatElapsedTime(order.created_at, nowMs)}
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-[#080808]">
                <div
                  className={[
                    "h-full rounded-full transition-all",
                    acceptRemainingMs <= 10000 ? "bg-red-500" : "bg-yellow-400",
                  ].join(" ")}
                  style={{ width: `${acceptProgress}%` }}
                />
              </div>
            </div>
          )}

          {status === "preparation" && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span
                  className={[
                    "font-black",
                    preparationRemainingMs <= 0 ? "text-red-400" : "text-yellow-300",
                  ].join(" ")}
                >
                  {preparationRemainingMs > 0
                    ? `${Math.ceil(preparationRemainingMs / 60000)}min restantes`
                    : "Atrasado"}
                </span>

                <span className="font-semibold text-zinc-500">
                  meta {averagePrepTimeMinutes}min
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-[#080808]">
                <div
                  className={[
                    "h-full rounded-full transition-all",
                    preparationRemainingMs <= 0 ? "bg-red-500" : "bg-yellow-400",
                  ].join(" ")}
                  style={{ width: `${preparationProgress}%` }}
                />
              </div>
            </div>
          )}

          {status === "ready" && (
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <span className="font-black text-yellow-300">
                Pronto na cozinha
              </span>

              <span className="font-semibold text-zinc-500">
                aguardando finalização
              </span>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-white/10 bg-black px-3 text-xs font-black text-zinc-500 transition hover:border-yellow-400/40 hover:bg-[#050505]"
            >
              Detalhes
            </button>

            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={primaryActionDisabled}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-yellow-400 px-3 text-xs font-black text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : status === "ready" && isDelivery ? (
                <Truck className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {primaryActionLabel}
            </button>
          </div>
        </div>
      </article>

      {detailsOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
            <div
              className="absolute inset-0"
              onClick={() => setDetailsOpen(false)}
              aria-hidden="true"
            />

            <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b] shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-[#0d0d0d] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300">
                    Detalhes do pedido
                  </p>

                  <h3 className="mt-1 text-lg font-black text-white">
                    Pedido #{getOrderNumber(order)}
                  </h3>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-zinc-500">
                    <span className="font-bold text-zinc-500">{getCustomerName(order)}</span>
                    <span>{getCustomerPhone(order)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailsOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#080808] text-zinc-500 transition hover:border-yellow-400/50 hover:text-white"
                  aria-label="Fechar detalhes"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#0b0b0b] p-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-black p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                      Tipo
                    </p>
                    <p className="mt-1 text-sm font-black text-white">
                      {getOrderTypeLabel(order)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                      Pagamento
                    </p>
                    <p className="mt-1 text-sm font-black text-white">
                      {getPaymentLabel(order.payment_method)}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-zinc-500">
                      {getPaymentStatusLabel(order.payment_status)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                      Total
                    </p>
                    <p className="mt-1 text-sm font-black text-yellow-300">
                      {formatBRL(order.total)}
                    </p>
                  </div>
                </div>

                {(deliveryAddress || customerCpf) && (
                  <div className="rounded-xl border border-white/10 bg-black p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                      Cliente e entrega
                    </p>

                    {deliveryAddress && (
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-zinc-500">
                        <span className="font-black text-white">Endereço:</span>{" "}
                        {deliveryAddress}
                      </p>
                    )}

                    {customerCpf && (
                      <p className="mt-1 text-sm font-semibold text-zinc-500">
                        <span className="font-black text-white">CPF:</span>{" "}
                        {customerCpf}
                      </p>
                    )}
                  </div>
                )}

                {showCashChange && (
                  <div className="rounded-xl border border-yellow-500/25 bg-yellow-400/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-yellow-300">
                      Troco
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-100">
                      Cliente precisa de troco para{" "}
                      <span className="font-black">
                        {formatBRL(getOrderChangeFor(order))}
                      </span>{" "}
                      · Troco estimado:{" "}
                      <span className="font-black">
                        {formatBRL(getOrderChangeAmount(order))}
                      </span>
                    </p>
                  </div>
                )}

                {isPixReview && (
                  <div className="rounded-xl border border-yellow-500/30 bg-yellow-400/10 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wide text-yellow-300">
                          Conferência Pix
                        </p>

                        <p className="mt-1 text-xs font-semibold leading-relaxed text-zinc-500">
                          Confira valor, data, horário e destinatário antes de confirmar.
                        </p>
                      </div>

                      {order.pix_proof_url && (
                        <button
                          type="button"
                          onClick={() => setProofOpen(true)}
                          className="shrink-0 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-black text-black transition hover:bg-yellow-300"
                        >
                          Ver comprovante
                        </button>
                      )}
                    </div>

                    {order.pix_proof_url ? (
                      <button
                        type="button"
                        onClick={() => setProofOpen(true)}
                        className="mt-3 block w-full overflow-hidden rounded-xl border border-yellow-500/20 bg-black"
                      >
                        <img
                          src={order.pix_proof_url}
                          alt={`Comprovante Pix do pedido ${getOrderNumber(order)}`}
                          className="max-h-44 w-full object-contain"
                        />
                      </button>
                    ) : (
                      <p className="mt-3 rounded-lg border border-white/10 bg-black px-3 py-2 text-sm font-semibold text-zinc-500">
                        Comprovante não disponível.
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-xl border border-white/10 bg-black p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                      Itens
                    </p>
                    <span className="text-xs font-black text-zinc-500">
                      {formatItemCount(items.length)}
                    </span>
                  </div>

                  {items.length > 0 ? (
                    <div className="divide-y divide-white/10">
                      {items.map((item) => (
                        <div key={item.id} className="py-2 first:pt-0 last:pb-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-white">
                                {item.quantity}x {item.name}
                              </p>

                              {getSafeOrderItemModifiers(item).map((modifier, index) => (
                                <p
                                  key={`${modifier.groupId ?? modifier.groupName}-${modifier.optionId ?? modifier.optionName}-${index}`}
                                  className="mt-0.5 text-xs font-semibold text-zinc-500"
                                >
                                  · {formatOrderItemModifier(modifier)}
                                </p>
                              ))}

                              {item.notes && (
                                <p className="mt-1 text-xs font-semibold text-yellow-300">
                                  Obs: {item.notes}
                                </p>
                              )}
                            </div>

                            {item.total > 0 && (
                              <p className="shrink-0 text-sm font-black text-white">
                                {formatBRL(item.total)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-white/10 p-3 text-sm text-zinc-500">
                      Itens do pedido não carregados.
                    </p>
                  )}
                </div>

                {(cleanOrderNote || isAiOrder) && (
                  <div className="rounded-xl border border-white/10 bg-black p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                      {isAiOrder ? "Origem" : "Observação"}
                    </p>

                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold leading-relaxed text-zinc-500">
                      {isAiOrder && <Bot className="h-4 w-4 text-yellow-300" />}
                      {isAiOrder ? "Pedido criado por IA" : cleanOrderNote}
                    </p>
                  </div>
                )}

                {isDelivery && (status === "preparation" || status === "ready") && (
                  <div className="rounded-xl border border-white/10 bg-black p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                        Motoboy
                      </p>

                      {deliveryPersonName ? (
                        <span className="text-xs font-black text-yellow-300">
                          {deliveryPersonName}
                        </span>
                      ) : (
                        <span className="text-xs font-black text-zinc-500">
                          Necessário
                        </span>
                      )}
                    </div>

                    <select
                      value={order.delivery_person_id || ""}
                      onChange={(event) =>
                        onAssignDeliveryPerson(order.id, event.target.value)
                      }
                      disabled={isBusy || deliveryPeople.length === 0}
                      className="h-9 w-full rounded-lg border border-white/10 bg-[#050505] px-3 text-sm font-semibold text-white outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">
                        {deliveryPeople.length === 0
                          ? "Nenhum entregador cadastrado"
                          : "Selecionar motoboy"}
                      </option>

                      {deliveryPeople.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                          {person.phone ? ` · ${person.phone}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 bg-[#0d0d0d] p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                      Total do pedido
                    </p>
                    <p className="text-xl font-black text-white">
                      {formatBRL(order.total)}
                    </p>
                  </div>

                  {isDelivery && Number(order.delivery_fee || 0) > 0 && (
                    <p className="rounded-full border border-yellow-500/25 bg-yellow-400/10 px-3 py-1 text-xs font-bold text-yellow-300">
                      Entrega {formatBRL(order.delivery_fee)}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => onPrint(order, items, "kitchen")}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-yellow-500/25 bg-yellow-400/10 px-3 text-xs font-black text-yellow-300 transition hover:bg-yellow-300/15"
                  >
                    <ChefHat className="h-4 w-4" />
                    Cozinha
                  </button>

                  <button
                    type="button"
                    onClick={() => onPrint(order, items, "receipt")}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#050505] px-3 text-xs font-black text-zinc-100 transition hover:bg-[#080808]"
                  >
                    <Printer className="h-4 w-4" />
                    Recibo
                  </button>

                  {status === "analysis" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setDetailsOpen(false)
                          onCancel(order)
                        }}
                        disabled={isBusy}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-xs font-black text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <XCircle className="h-4 w-4" />
                        Negar
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (isPixReview) {
                            onConfirmPixPayment(order)
                            return
                          }

                          onAccept(order)
                          setDetailsOpen(false)
                        }}
                        disabled={isBusy}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-400 px-3 text-xs font-black text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        {isPixReview ? "Confirmar Pix" : "Aceitar"}
                      </button>
                    </>
                  )}

                  {status !== "analysis" && (
                    <button
                      type="button"
                      onClick={() => {
                        setDetailsOpen(false)
                        onCancel(order)
                      }}
                      disabled={isBusy}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-xs font-black text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancelar
                    </button>
                  )}

                  {status === "preparation" && (
                    kdsEnabled ? (
                      <div className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-white/10 bg-[#050505] px-3 text-xs font-black text-zinc-500">
                        KDS controlando
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onMarkReady(order)
                          setDetailsOpen(false)
                        }}
                        disabled={isBusy}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-400 px-3 text-xs font-black text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Marcar pronto
                      </button>
                    )
                  )}

                  {status === "ready" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isDelivery) {
                          onSendToRoute(order)
                        } else {
                          onFinish(order)
                        }

                        setDetailsOpen(false)
                      }}
                      disabled={isBusy || (isDelivery && !order.delivery_person_id)}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-400 px-3 text-xs font-black text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isDelivery ? (
                        <Truck className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Finalizar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {proofOpen && order.pix_proof_url &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 p-4">
            <button
              type="button"
              onClick={() => setProofOpen(false)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#0A0A0A] text-white transition hover:bg-[#0A0A0A]"
              aria-label="Fechar comprovante"
            >
              <XCircle className="h-5 w-5" />
            </button>

            <img
              src={order.pix_proof_url}
              alt={`Comprovante Pix do pedido ${getOrderNumber(order)}`}
              className="max-h-[92vh] max-w-[96vw] rounded-2xl object-contain"
            />
          </div>,
          document.body
        )}
    </>
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
  onMarkReady: (order: OrderRow) => void
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
  onMarkReady,
  onSendToRoute,
  onFinish,
  onPrint,
  onAssignDeliveryPerson,
}: BoardColumnProps) {
  const styles = columnStyles[status]
  const Icon = styles.icon as typeof Clock3

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b] shadow-sm">
      <div className="border-b border-white/10 bg-[#0d0d0d] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${styles.accent}`} />

            <div className="min-w-0">
              <h2 className="text-sm font-black tracking-tight text-white">
                {styles.title as string}
              </h2>
              <p className="truncate text-xs font-semibold text-zinc-500">
                {styles.description as string}
              </p>
            </div>
          </div>

          <span className="flex h-7 min-w-7 items-center justify-center rounded-full border border-yellow-500/25 bg-yellow-400/10 px-2 text-xs font-black text-yellow-300">
            {orders.length}
          </span>
        </div>
      </div>

      <div className={`${styles.body} min-h-[calc(100vh-305px)] space-y-3 p-3`}>
        {orders.length === 0 ? (
          <div className="flex min-h-[155px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-black p-5 text-center">
            <div>
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-[#050505] text-zinc-500">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-black text-white">
                Nenhum pedido
              </p>
              <p className="mt-1 max-w-[220px] text-xs font-semibold leading-relaxed text-zinc-500">
                Os pedidos dessa etapa aparecem aqui automaticamente.
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
              onMarkReady={onMarkReady}
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

type HistoryOrderDetailsModalProps = {
  order: OrderRow
  items: OrderItem[]
  deliveryPeople: DeliveryPerson[]
  onClose: () => void
}

function HistoryOrderDetailsModal({
  order,
  items,
  deliveryPeople,
  onClose,
}: HistoryOrderDetailsModalProps) {
  const deliveryAddress = getOrderAddress(order)
  const neighborhood = getOrderNeighborhood(order)
  const deliveryPersonName = getDeliveryPersonName(deliveryPeople, order.delivery_person_id)
  const subtotal = Number(order.subtotal || 0)
  const discount = Number(order.discount || 0)
  const deliveryFee = Number(order.delivery_fee || 0)
  const total = Number(order.total || 0)
  const calculatedItemsTotal = items.reduce((sum, item) => sum + Number(item.total || 0), 0)
  const shownSubtotal = subtotal > 0 ? subtotal : calculatedItemsTotal

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-[#0d0d0d] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300">
              Histórico do pedido
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-white">
                Pedido #{getOrderNumber(order)}
              </h3>

              <span
                className={[
                  "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                  getOrderStatusBadgeClasses(order.status),
                ].join(" ")}
              >
                {getOrderStatusLabel(order.status)}
              </span>
            </div>

            <p className="mt-1 text-xs font-semibold text-zinc-500">
              Criado em {formatDateTime(order.created_at)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#080808] text-zinc-500 transition hover:border-yellow-400/50 hover:text-white"
            aria-label="Fechar histórico"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black p-3">
              <div className="flex items-center gap-2 text-zinc-500">
                <User className="h-4 w-4 text-yellow-300" />
                <p className="text-[10px] font-black uppercase tracking-wide">
                  Cliente
                </p>
              </div>
              <p className="mt-2 text-sm font-black text-white">
                {getCustomerName(order)}
              </p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">
                {getCustomerPhone(order)}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black p-3">
              <div className="flex items-center gap-2 text-zinc-500">
                <CreditCard className="h-4 w-4 text-yellow-300" />
                <p className="text-[10px] font-black uppercase tracking-wide">
                  Pagamento
                </p>
              </div>
              <p className="mt-2 text-sm font-black text-white">
                {getPaymentLabel(order.payment_method)}
              </p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">
                {getPaymentStatusLabel(order.payment_status)}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black p-3">
              <div className="flex items-center gap-2 text-zinc-500">
                <Truck className="h-4 w-4 text-yellow-300" />
                <p className="text-[10px] font-black uppercase tracking-wide">
                  Entrega
                </p>
              </div>
              <p className="mt-2 text-sm font-black text-white">
                {getOrderTypeLabel(order)}
              </p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">
                Taxa: {formatBRL(order.delivery_fee)}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-xl border border-white/10 bg-black p-3">
              <div className="flex items-center gap-2 text-zinc-500">
                <MapPin className="h-4 w-4 text-yellow-300" />
                <p className="text-[10px] font-black uppercase tracking-wide">
                  Endereço e bairro
                </p>
              </div>

              <p className="mt-2 text-sm font-semibold leading-relaxed text-zinc-400">
                <span className="font-black text-white">Endereço:</span>{" "}
                {deliveryAddress || "Não informado"}
              </p>

              <p className="mt-1 text-sm font-semibold leading-relaxed text-zinc-400">
                <span className="font-black text-white">Bairro:</span>{" "}
                {neighborhood || "Não informado"}
              </p>

              {deliveryPersonName && (
                <p className="mt-1 text-sm font-semibold leading-relaxed text-zinc-400">
                  <span className="font-black text-white">Motoboy:</span>{" "}
                  {deliveryPersonName}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-black p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                Datas do pedido
              </p>

              <div className="mt-2 space-y-1.5 text-xs font-semibold text-zinc-500">
                <p>Entrada: {formatDateTime(order.created_at)}</p>
                {order.accepted_at && <p>Aceito: {formatDateTime(order.accepted_at)}</p>}
                {order.preparation_started_at && <p>Preparo: {formatDateTime(order.preparation_started_at)}</p>}
                {order.out_for_delivery_at && <p>Rota: {formatDateTime(order.out_for_delivery_at)}</p>}
                {order.delivered_at && <p>Finalizado: {formatDateTime(order.delivered_at)}</p>}
                {order.cancelled_at && <p>Cancelado: {formatDateTime(order.cancelled_at)}</p>}
              </div>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                Itens do pedido
              </p>
              <span className="text-xs font-black text-zinc-500">
                {formatItemCount(items.length)}
              </span>
            </div>

            {items.length === 0 ? (
              <p className="p-4 text-sm font-semibold text-zinc-500">
                Nenhum item carregado para esse pedido.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-white/10 bg-[#050505]">
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide text-zinc-500">
                        Produto
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-wide text-zinc-500">
                        Qtd
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wide text-zinc-500">
                        Unitário
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wide text-zinc-500">
                        Subtotal
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item) => {
                      const unitPrice = item.quantity > 0 ? item.total / item.quantity : item.total

                      return (
                        <tr key={item.id} className="border-b border-white/10 last:border-0">
                          <td className="px-3 py-3">
                            <p className="text-sm font-black text-white">
                              {item.name}
                            </p>

                            {getSafeOrderItemModifiers(item).map((modifier, index) => (
                              <p
                                key={`${modifier.groupId ?? modifier.groupName}-${modifier.optionId ?? modifier.optionName}-${index}`}
                                className="mt-0.5 text-xs font-semibold text-zinc-500"
                              >
                                · {formatOrderItemModifier(modifier)}
                              </p>
                            ))}

                            {item.notes && (
                              <p className="mt-1 text-xs font-semibold text-yellow-300">
                                Obs: {item.notes}
                              </p>
                            )}
                          </td>

                          <td className="px-3 py-3 text-center text-sm font-bold text-zinc-400">
                            {item.quantity}
                          </td>

                          <td className="px-3 py-3 text-right text-sm font-semibold text-zinc-500">
                            {formatBRL(unitPrice)}
                          </td>

                          <td className="px-3 py-3 text-right text-sm font-black text-white">
                            {formatBRL(item.total)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-xl border border-white/10 bg-black p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                Observações
              </p>

              <p className="mt-2 text-sm font-semibold leading-relaxed text-zinc-400">
                {buildPrintNotes(order) || "Nenhuma observação registrada."}
              </p>
            </div>

            <div className="rounded-xl border border-yellow-500/25 bg-yellow-400/10 p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-yellow-300">
                Resumo financeiro
              </p>

              <div className="mt-3 space-y-2 text-sm font-semibold">
                <div className="flex justify-between gap-3 text-zinc-300">
                  <span>Subtotal</span>
                  <span>{formatBRL(shownSubtotal)}</span>
                </div>

                <div className="flex justify-between gap-3 text-zinc-300">
                  <span>Taxa de entrega</span>
                  <span>{formatBRL(deliveryFee)}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between gap-3 text-zinc-300">
                    <span>Desconto</span>
                    <span>-{formatBRL(discount)}</span>
                  </div>
                )}

                <div className="border-t border-yellow-500/20 pt-2">
                  <div className="flex justify-between gap-3 text-base font-black text-white">
                    <span>Total</span>
                    <span>{formatBRL(total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {order.pix_proof_url && (
            <a
              href={order.pix_proof_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-yellow-500/25 bg-yellow-400/10 px-4 text-sm font-black text-yellow-300 transition hover:bg-yellow-300/15"
            >
              Ver comprovante Pix
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PedidosPage() {
  const { restaurant, user, isLoading: authLoading } = useAuth()

  const [orders, setOrders] = useState<OrderRow[]>([])
  const [orderItemsByOrderId, setOrderItemsByOrderId] = useState<
    Record<string, OrderItem[]>
  >({})
  const [deliveryPeople, setDeliveryPeople] = useState<DeliveryPerson[]>([])
  const [allDeliveryPeople, setAllDeliveryPeople] = useState<DeliveryPerson[]>([])
  const [averagePrepTimeMinutes, setAveragePrepTimeMinutes] = useState(30)
  const [restaurantPrintData, setRestaurantPrintData] =
    useState<RestaurantPrintData | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [activeView, setActiveView] = useState<ViewMode>("operation")
  const [search, setSearch] = useState("")
  const [historySearch, setHistorySearch] = useState("")
  const [historyOrders, setHistoryOrders] = useState<OrderRow[]>([])
  const [historyOrderItemsByOrderId, setHistoryOrderItemsByOrderId] = useState<
    Record<string, OrderItem[]>
  >({})
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>(
    DEFAULT_HISTORY_FILTERS
  )
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyRefreshing, setHistoryRefreshing] = useState(false)
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<OrderRow | null>(null)

  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [savingPrepTime, setSavingPrepTime] = useState(false)
  const [savingAutoAcceptOrders, setSavingAutoAcceptOrders] = useState(false)
  const [autoAcceptOrders, setAutoAcceptOrders] = useState(false)
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
          body: `${alert.orderNumber} · ${alert.customerName} · ${formatBRL(alert.total)}`,
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

  async function fetchOrderItemsMap(orderIds: string[]) {
    if (orderIds.length === 0) return {}

    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds)

    if (error) throw error

    const grouped: Record<string, OrderItem[]> = {}

    for (const rawItem of (data || []) as Record<string, unknown>[]) {
      const item = normalizeOrderItem(rawItem)

      if (!item.order_id) continue

      if (!grouped[item.order_id]) {
        grouped[item.order_id] = []
      }

      grouped[item.order_id].push(item)
    }

    return grouped
  }

  async function loadOrderItems(orderIds: string[]) {
    if (orderIds.length === 0) {
      setOrderItemsByOrderId({})
      return
    }

    try {
      const grouped = await fetchOrderItemsMap(orderIds)
      setOrderItemsByOrderId(grouped)
    } catch (err) {
      console.warn("Erro inesperado ao carregar itens dos pedidos:", err)
      setOrderItemsByOrderId({})
    }
  }

  async function loadHistoryOrderItems(orderIds: string[]) {
    if (orderIds.length === 0) {
      setHistoryOrderItemsByOrderId({})
      return
    }

    try {
      const grouped = await fetchOrderItemsMap(orderIds)
      setHistoryOrderItemsByOrderId(grouped)
    } catch (err) {
      console.warn("Erro inesperado ao carregar itens do histórico:", err)
      setHistoryOrderItemsByOrderId({})
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

  async function loadHistoryOrders(showRefresh = false) {
    if (!restaurant?.id) return

    try {
      if (showRefresh) {
        setHistoryRefreshing(true)
      } else {
        setHistoryLoading(true)
      }

      setError(null)

      const session = await ensureSupabaseSession()

      if (!session) {
        setHistoryLoading(false)
        setHistoryRefreshing(false)
        return
      }

      let query = supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .limit(500)

      if (historyFilters.dateFrom) {
        query = query.gte("created_at", getDateStartIso(historyFilters.dateFrom))
      }

      if (historyFilters.dateTo) {
        query = query.lte("created_at", getDateEndIso(historyFilters.dateTo))
      }

      const { data, error } = await query

      if (error) throw error

      const filteredRows = ((data || []) as OrderRow[]).filter((order) => {
        const paymentMethodMatches =
          historyFilters.paymentMethod === "all" ||
          normalizeStatus(order.payment_method) === normalizeStatus(historyFilters.paymentMethod)

        const deliveryPersonMatches =
          historyFilters.deliveryPersonId === "all" ||
          order.delivery_person_id === historyFilters.deliveryPersonId

        return (
          matchesHistoryStatus(order, historyFilters.status) &&
          matchesHistoryPaymentStatus(order, historyFilters.paymentStatus) &&
          paymentMethodMatches &&
          deliveryPersonMatches
        )
      })

      setHistoryOrders(filteredRows)

      void loadHistoryOrderItems(filteredRows.map((order) => order.id))
    } catch (err) {
      console.error("Erro ao buscar histórico:", err)
      setError(getErrorMessage(err, "Erro ao buscar histórico de pedidos."))
      setHistoryOrders([])
      setHistoryOrderItemsByOrderId({})
    } finally {
      setHistoryLoading(false)
      setHistoryRefreshing(false)
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
        .order("name", { ascending: true })

      if (error) throw error

      const people = (data || []) as DeliveryPerson[]

      setAllDeliveryPeople(people)
      setDeliveryPeople(people.filter((person) => person.is_active))
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
        .select("name, logo_url, phone, address, average_prep_time_minutes, auto_accept_orders")
        .eq("id", restaurant.id)
        .single()

      if (error) throw error

      setAveragePrepTimeMinutes(Number(data.average_prep_time_minutes || 30))
      setAutoAcceptOrders(Boolean(data.auto_accept_orders))

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

  async function createDesktopPrintJob(orderId: string, forceReprint = false) {
    const { data, error } = await supabase.rpc("create_order_print_job_for_order", {
      p_order_id: orderId,
      p_force_reprint: forceReprint,
    })

    if (error) throw error

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

  async function updateAutoAcceptOrders(nextValue: boolean) {
    if (!restaurant?.id) return

    const previousValue = autoAcceptOrders

    try {
      setSavingAutoAcceptOrders(true)
      setAutoAcceptOrders(nextValue)
      setError(null)

      const { error } = await supabase
        .from("restaurants")
        .update({ auto_accept_orders: nextValue })
        .eq("id", restaurant.id)

      if (error) throw error
    } catch (err) {
      console.error("Erro ao salvar aceite automático:", err)
      setAutoAcceptOrders(previousValue)
      setError(getErrorMessage(err, "Erro ao salvar aceite automático."))
    } finally {
      setSavingAutoAcceptOrders(false)
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

  async function notifyAiOrderStatus(orderId: string, status: string) {
    try {
      await fetch("/api/orders/ai-status-notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          status,
        }),
      })
    } catch (error) {
      console.error("Erro ao notificar cliente sobre status do pedido IA:", error)
    }
  }

  async function updateOrder(
    order: OrderRow,
    action: "accept" | "cancel" | "ready" | "route" | "finish"
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
          payment_status: "cancelled",
          cancelled_at: nowIso,
        }
      }

      if (action === "ready") {
        payload = {
          status: "ready",
        }
      }

      if (action === "route") {
        if (isDeliveryOrder(order) && !order.delivery_person_id) {
          setError("Selecione um motoboy antes de finalizar a entrega.")
          return
        }

        payload = {
          status: "delivered",
          payment_status: "paid",
          out_for_delivery_at: order.out_for_delivery_at || nowIso,
          delivered_at: nowIso,
        }
      }

      if (action === "finish") {
        payload = {
          status: "delivered",
          payment_status: "paid",
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

      if (typeof payload.status === "string" && payload.status.trim()) {
        await notifyAiOrderStatus(order.id, payload.status)
      }

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

        try {
          await createDesktopPrintJob(order.id)
        } catch (printJobError) {
          console.error("Pedido aceito, mas impressão desktop não foi gerada:", printJobError)

          setError(
            getErrorMessage(
              printJobError,
              "Pedido aceito, mas não foi possível enviar para a fila de impressão desktop."
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

      const shouldAcceptAutomatically = autoAcceptOrders

      let payload: Partial<OrderRow> = {
        payment_status: "paid",
        status: "pending",
        pix_confirmed_at: nowIso,
        pix_confirmed_by: user?.id ?? null,
      }

      if (shouldAcceptAutomatically) {
        payload = {
          ...payload,
          status: "accepted",
          accepted_at: nowIso,
          preparation_started_at: nowIso,
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

      if (typeof payload.status === "string" && payload.status.trim()) {
        await notifyAiOrderStatus(order.id, payload.status)
      }

      if (shouldAcceptAutomatically) {
        try {
          await deductStockForOrder(order.id)
        } catch (stockError) {
          console.error("Pix confirmado, mas estoque não foi baixado:", stockError)

          setError(
            getErrorMessage(
              stockError,
              "Pix confirmado, mas não foi possível baixar o estoque automaticamente."
            )
          )
        }

        try {
          await createDesktopPrintJob(order.id)
        } catch (printJobError) {
          console.error("Pix confirmado, mas impressão desktop não foi gerada:", printJobError)

          setError(
            getErrorMessage(
              printJobError,
              "Pix confirmado, mas não foi possível enviar para a fila de impressão desktop."
            )
          )
        }
      }
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

  function updateHistoryFilter(partial: Partial<HistoryFilters>) {
    setHistoryFilters((current) => ({
      ...current,
      ...partial,
    }))
  }

  function setHistoryToday() {
    const today = getTodayInputDate()

    setHistoryFilters((current) => ({
      ...current,
      dateFrom: today,
      dateTo: today,
    }))
  }

  function setHistoryYesterday() {
    const yesterday = getYesterdayInputDate()

    setHistoryFilters((current) => ({
      ...current,
      dateFrom: yesterday,
      dateTo: yesterday,
    }))
  }

  function setHistoryLastSevenDays() {
    setHistoryFilters((current) => ({
      ...current,
      dateFrom: getLastSevenDaysInputDate(),
      dateTo: getTodayInputDate(),
    }))
  }

  function clearHistoryFilters() {
    setHistoryFilters(DEFAULT_HISTORY_FILTERS)
    setHistorySearch("")
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
      setHistoryOrders([])
      setHistoryOrderItemsByOrderId({})
      setDeliveryPeople([])
      setAllDeliveryPeople([])
      setNewOrderAlert(null)
      previousVisibleOrderIdsRef.current = new Set()
      notifiedOrderIdsRef.current = new Set()
      hasSeededVisibleOrdersRef.current = false
      setLoading(false)
      setRefreshing(false)
      setHistoryLoading(false)
      setHistoryRefreshing(false)
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

          if (activeView === "history") {
            void loadHistoryOrders(true)
          }
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
  }, [authLoading, restaurant?.id, user?.id, activeView])

  useEffect(() => {
    if (!restaurant?.id || !user?.id) return

    const handlePageBack = () => {
      if (document.visibilityState === "visible") {
        void loadOrders(true)
        void loadDeliveryPeople()
        void loadRestaurantSettings()

        if (activeView === "history") {
          void loadHistoryOrders(true)
        }
      }
    }

    const handleWindowFocus = () => {
      void loadOrders(true)
      void loadDeliveryPeople()
      void loadRestaurantSettings()

      if (activeView === "history") {
        void loadHistoryOrders(true)
      }
    }

    document.addEventListener("visibilitychange", handlePageBack)
    window.addEventListener("focus", handleWindowFocus)

    return () => {
      document.removeEventListener("visibilitychange", handlePageBack)
      window.removeEventListener("focus", handleWindowFocus)
    }
  }, [restaurant?.id, user?.id, activeView])

  useEffect(() => {
    if (authLoading || activeView !== "history" || !user || !restaurant?.id) return

    void loadHistoryOrders()
  }, [
    activeView,
    authLoading,
    user?.id,
    restaurant?.id,
    historyFilters.dateFrom,
    historyFilters.dateTo,
    historyFilters.status,
    historyFilters.paymentStatus,
    historyFilters.paymentMethod,
    historyFilters.deliveryPersonId,
  ])

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

  const filteredHistoryOrders = useMemo(() => {
    const normalizedSearch = historySearch.trim().toLowerCase()

    return historyOrders.filter((order) => {
      if (!normalizedSearch) return true

      const items = historyOrderItemsByOrderId[order.id] || []
      const customerName = getCustomerName(order).toLowerCase()
      const customerPhone = getCustomerPhone(order).toLowerCase()
      const orderNumber = getOrderNumber(order).toLowerCase()
      const address = String(getOrderAddress(order) || "").toLowerCase()
      const neighborhood = String(getOrderNeighborhood(order) || "").toLowerCase()
      const itemNames = items.map((item) => item.name.toLowerCase()).join(" ")

      return (
        customerName.includes(normalizedSearch) ||
        customerPhone.includes(normalizedSearch) ||
        orderNumber.includes(normalizedSearch) ||
        address.includes(normalizedSearch) ||
        neighborhood.includes(normalizedSearch) ||
        itemNames.includes(normalizedSearch)
      )
    })
  }, [historyOrders, historySearch, historyOrderItemsByOrderId])

  const historyStats = useMemo(() => {
    const totalOrders = filteredHistoryOrders.length
    const revenue = filteredHistoryOrders.reduce(
      (sum, order) => sum + Number(order.total || 0),
      0
    )
    const deliveryFees = filteredHistoryOrders.reduce(
      (sum, order) => sum + Number(order.delivery_fee || 0),
      0
    )
    const finishedOrders = filteredHistoryOrders.filter((order) =>
      isFinishedOrderStatus(order.status)
    ).length
    const cancelledOrders = filteredHistoryOrders.filter((order) =>
      isCancelledOrderStatus(order.status)
    ).length

    return {
      totalOrders,
      revenue,
      deliveryFees,
      finishedOrders,
      cancelledOrders,
    }
  }, [filteredHistoryOrders])

  const uniquePaymentMethods = useMemo(() => {
    const methods = new Set<string>()

    historyOrders.forEach((order) => {
      if (order.payment_method) {
        methods.add(order.payment_method)
      }
    })

    return Array.from(methods).sort((a, b) => a.localeCompare(b))
  }, [historyOrders])

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
      <div className="min-h-[calc(100vh-90px)] rounded-[2rem] bg-black p-2 sm:p-4">
        <div className="flex flex-col gap-4">
          <div className="rounded-[1.5rem] border border-white/10 bg-[#0b0b0b] p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
                    Central operacional
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
                    Pedidos
                  </h1>
                  <p className="mt-1 text-sm font-semibold text-zinc-500">
                    Recebimento, operação e histórico completo dos pedidos.
                  </p>
                </div>

                <div className="flex w-fit rounded-xl border border-white/10 bg-black p-1">
                  <button
                    type="button"
                    onClick={() => setActiveView("operation")}
                    className={[
                      "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition",
                      activeView === "operation"
                        ? "bg-yellow-400 text-black"
                        : "text-zinc-500 hover:bg-[#050505] hover:text-white",
                    ].join(" ")}
                  >
                    <Package className="h-4 w-4" />
                    Operação
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveView("history")}
                    className={[
                      "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition",
                      activeView === "history"
                        ? "bg-yellow-400 text-black"
                        : "text-zinc-500 hover:bg-[#050505] hover:text-white",
                    ].join(" ")}
                  >
                    <History className="h-4 w-4" />
                    Histórico
                  </button>
                </div>
              </div>

              {activeView === "operation" ? (
                <>
                  <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-center">
                    <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px]">
                      <div className="relative min-w-0">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Buscar cliente, telefone ou pedido..."
                          className="h-10 w-full rounded-xl border border-white/10 bg-black pl-11 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10"
                        />
                      </div>

                      <div className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-black px-3">
                        <Settings2 className="h-4 w-4 shrink-0 text-yellow-300" />

                        <span className="whitespace-nowrap text-sm font-semibold text-zinc-500">
                          Tempo:
                        </span>

                        <select
                          value={averagePrepTimeMinutes}
                          onChange={(event) =>
                            updateAveragePrepTime(Number(event.target.value))
                          }
                          disabled={savingPrepTime}
                          className="h-8 flex-1 rounded-lg border border-white/10 bg-[#050505] px-2 text-sm font-black text-white outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10"
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
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-yellow-300" />
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 2xl:justify-end">
                      <p className="rounded-lg border border-white/10 bg-black px-3 py-2 text-xs font-semibold text-zinc-500">
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
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black px-4 text-sm font-black text-white transition hover:border-yellow-400/50 hover:bg-[#050505]"
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
                          "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition",
                          kdsEnabled
                            ? "border-yellow-500/30 bg-yellow-400/10 text-yellow-300 hover:bg-yellow-300/15"
                            : "border-white/10 bg-[#050505] text-zinc-500 hover:border-yellow-400/50",
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
                        onClick={() => void updateAutoAcceptOrders(!autoAcceptOrders)}
                        disabled={savingAutoAcceptOrders}
                        className={[
                          "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60",
                          autoAcceptOrders
                            ? "border-yellow-500/30 bg-yellow-400 text-black hover:bg-yellow-300"
                            : "border-white/10 bg-black text-white hover:border-yellow-400/50 hover:bg-[#050505]",
                        ].join(" ")}
                        title={
                          autoAcceptOrders
                            ? "Pedidos confirmados pelo cliente serão aceitos automaticamente e enviados para impressão desktop."
                            : "Pedidos serão impressos somente depois do aceite manual do restaurante."
                        }
                      >
                        {savingAutoAcceptOrders ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}

                        {autoAcceptOrders ? "Aceite ligado" : "Aceite automático"}
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
                          "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition",
                          orderAlertsEnabled
                            ? "border-yellow-500/30 bg-yellow-400 text-black hover:bg-yellow-300"
                            : "border-yellow-500/30 bg-yellow-400/10 text-yellow-300 hover:bg-yellow-300/15",
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
                    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black p-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-black text-white">
                          Impressão
                        </p>

                        <p className="mt-0.5 text-xs font-semibold text-zinc-500">
                          {selectedVisibleOrders.length > 0
                            ? `${selectedVisibleOrders.length} ${selectedVisibleOrders.length === 1 ? "pedido selecionado" : "pedidos selecionados"} de ${filteredOrders.length} ${filteredOrders.length === 1 ? "visível" : "visíveis"}.`
                            : "Selecione os pedidos que deseja imprimir."}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => selectVisibleOrders(filteredOrders.map((order) => order.id))}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-[#050505] px-3 text-xs font-black text-zinc-100 transition hover:border-yellow-400/50"
                        >
                          Selecionar pedidos
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrintSelectedOrders("kitchen")}
                          disabled={selectedVisibleOrders.length === 0}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-yellow-500/25 bg-yellow-400/10 px-3 text-xs font-black text-yellow-300 transition hover:bg-yellow-300/15 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <ChefHat className="h-4 w-4" />
                          Cozinha ({selectedVisibleOrders.length})
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrintSelectedOrders("receipt")}
                          disabled={selectedVisibleOrders.length === 0}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#050505] px-3 text-xs font-black text-zinc-100 transition hover:border-yellow-400/50 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Printer className="h-4 w-4" />
                          Recibos ({selectedVisibleOrders.length})
                        </button>

                        <button
                          type="button"
                          onClick={clearSelectedOrders}
                          disabled={selectedVisibleOrders.length === 0}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-[#050505] px-3 text-xs font-black text-zinc-500 transition hover:border-yellow-400/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-3">
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.5fr)_150px_150px_170px_170px_190px]">
    <div className="relative min-w-0">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

      <input
        value={historySearch}
        onChange={(event) => setHistorySearch(event.target.value)}
        placeholder="Buscar pedido, cliente, telefone, bairro ou item..."
        className="h-10 w-full rounded-xl border border-white/10 bg-black pl-11 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10"
      />
    </div>

    <input
      type="date"
      value={historyFilters.dateFrom}
      onChange={(event) => updateHistoryFilter({ dateFrom: event.target.value })}
      className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm font-semibold text-white outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10"
    />

    <input
      type="date"
      value={historyFilters.dateTo}
      onChange={(event) => updateHistoryFilter({ dateTo: event.target.value })}
      className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm font-semibold text-white outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10"
    />

    <select
      value={historyFilters.status}
      onChange={(event) =>
        updateHistoryFilter({
          status: event.target.value as HistoryStatusFilter,
        })
      }
      className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm font-semibold text-white outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10"
    >
      <option value="all">Todos status</option>
      <option value="open">Em aberto</option>
      <option value="finished">Finalizados</option>
      <option value="cancelled">Cancelados</option>
    </select>

    <select
      value={historyFilters.paymentStatus}
      onChange={(event) =>
        updateHistoryFilter({
          paymentStatus: event.target.value as HistoryPaymentStatusFilter,
        })
      }
      className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm font-semibold text-white outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10"
    >
      <option value="all">Todos pagamentos</option>
      <option value="paid">Pago</option>
      <option value="pending">Pendente</option>
      <option value="cancelled">Cancelado/Falhou</option>
    </select>

    <select
      value={historyFilters.deliveryPersonId}
      onChange={(event) =>
        updateHistoryFilter({
          deliveryPersonId: event.target.value,
        })
      }
      className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm font-semibold text-white outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10"
    >
      <option value="all">Todos motoboys</option>
      {allDeliveryPeople.map((person) => (
        <option key={person.id} value={person.id}>
          {person.name}
        </option>
      ))}
    </select>
  </div>

  <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={setHistoryToday}
        className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-black px-3 text-xs font-black text-zinc-100 transition hover:border-yellow-400/50"
      >
        Hoje
      </button>

      <button
        type="button"
        onClick={setHistoryYesterday}
        className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-black px-3 text-xs font-black text-zinc-100 transition hover:border-yellow-400/50"
      >
        Ontem
      </button>

      <button
        type="button"
        onClick={setHistoryLastSevenDays}
        className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-black px-3 text-xs font-black text-zinc-100 transition hover:border-yellow-400/50"
      >
        7 dias
      </button>

      <button
        type="button"
        onClick={clearHistoryFilters}
        className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-black px-3 text-xs font-black text-zinc-500 transition hover:border-yellow-400/50 hover:text-white"
      >
        Limpar
      </button>
    </div>

    <button
      type="button"
      onClick={() => void loadHistoryOrders(true)}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-400/10 px-4 text-sm font-black text-yellow-300 transition hover:bg-yellow-300/15 sm:w-auto"
    >
      {historyRefreshing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCcw className="h-4 w-4" />
      )}
      Atualizar histórico
    </button>
  </div>
</div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-xl border border-white/10 bg-black p-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                        Pedidos
                      </p>
                      <p className="mt-1 text-xl font-black text-white">
                        {historyStats.totalOrders}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black p-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                        Total vendido
                      </p>
                      <p className="mt-1 text-xl font-black text-yellow-300">
                        {formatBRL(historyStats.revenue)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black p-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                        Taxas de entrega
                      </p>
                      <p className="mt-1 text-xl font-black text-white">
                        {formatBRL(historyStats.deliveryFees)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black p-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                        Finalizados
                      </p>
                      <p className="mt-1 text-xl font-black text-emerald-400">
                        {historyStats.finishedOrders}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black p-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                        Cancelados
                      </p>
                      <p className="mt-1 text-xl font-black text-red-300">
                        {historyStats.cancelledOrders}
                      </p>
                    </div>
                  </div>

                  {uniquePaymentMethods.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateHistoryFilter({ paymentMethod: "all" })}
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs font-black transition",
                          historyFilters.paymentMethod === "all"
                            ? "border-yellow-500/30 bg-yellow-400 text-black"
                            : "border-white/10 bg-black text-zinc-500 hover:border-yellow-400/50 hover:text-white",
                        ].join(" ")}
                      >
                        Todos
                      </button>

                      {uniquePaymentMethods.map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => updateHistoryFilter({ paymentMethod: method })}
                          className={[
                            "rounded-full border px-3 py-1.5 text-xs font-black transition",
                            historyFilters.paymentMethod === method
                              ? "border-yellow-500/30 bg-yellow-400 text-black"
                              : "border-white/10 bg-black text-zinc-500 hover:border-yellow-400/50 hover:text-white",
                          ].join(" ")}
                        >
                          {getPaymentLabel(method)}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
                  {error}
                </div>
              )}

              {activeView === "operation" && newOrderAlert && (
                <div className="overflow-hidden rounded-xl border border-yellow-500/30 bg-yellow-400/10 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-400 text-black shadow-sm">
                        <BellRing className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">
                          Novo pedido recebido
                        </p>

                        <p className="truncate text-xs font-bold text-yellow-200">
                          {newOrderAlert.orderNumber} · {newOrderAlert.customerName} · {formatBRL(newOrderAlert.total)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setNewOrderAlert(null)}
                      className="shrink-0 rounded-full p-1 text-yellow-300 transition hover:bg-yellow-400/10"
                      aria-label="Fechar alerta de novo pedido"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {activeView === "operation" ? (
            loading ? (
              <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-[#0b0b0b] py-20 shadow-sm">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin text-yellow-300" />
                  Carregando operação...
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="grid min-w-[1080px] grid-cols-3 gap-4">
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
                    onMarkReady={(order) => void updateOrder(order, "ready")}
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
                    onMarkReady={(order) => void updateOrder(order, "ready")}
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
                    onMarkReady={(order) => void updateOrder(order, "ready")}
                    onSendToRoute={(order) => void updateOrder(order, "route")}
                    onFinish={(order) => void updateOrder(order, "finish")}
                    onPrint={handlePrintOrder}
                    onAssignDeliveryPerson={(orderId, deliveryPersonId) =>
                      void assignDeliveryPerson(orderId, deliveryPersonId)
                    }
                  />
                </div>
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#0b0b0b] shadow-sm">
              {historyLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin text-yellow-300" />
                    Carregando histórico...
                  </div>
                </div>
              ) : filteredHistoryOrders.length === 0 ? (
                <div className="flex items-center justify-center py-20 text-center">
                  <div>
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black text-zinc-500">
                      <History className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-black text-white">
                      Nenhum pedido encontrado
                    </p>
                    <p className="mt-1 text-xs font-semibold text-zinc-500">
                      Ajuste os filtros ou escolha outro período.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden">
  <table className="w-full table-fixed">
    <colgroup>
                    <col className="w-[17%]" />
                    <col className="w-[32%]" />
                    <col className="w-[22%]" />
                    <col className="w-[18%]" />
                    <col className="w-[11%]" />
                  </colgroup>
                    <thead>
  <tr className="border-b border-white/10 bg-[#0d0d0d]">
    <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide text-zinc-500">
      Pedido / Cliente
    </th>

    <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide text-zinc-500">
      Entrega
    </th>

    <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide text-zinc-500">
      Itens
    </th>

    <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide text-zinc-500">
      Pagamento
    </th>

    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wide text-zinc-500">
      Valor
    </th>
  </tr>
</thead>

                    <tbody>
                      {filteredHistoryOrders.map((order) => {
                        const items = historyOrderItemsByOrderId[order.id] || []
                        const address = getOrderAddress(order)
                        const neighborhood = getOrderNeighborhood(order)
                        const deliveryPersonName = getDeliveryPersonName(
                          allDeliveryPeople,
                          order.delivery_person_id
                        )

                        return (
                          <tr
                            key={order.id}
                            className="border-b border-white/10 last:border-0 transition hover:bg-[#050505]"
                          >
                            <td className="px-2.5 py-2 align-top">
                              <p className="truncate text-xs font-black text-yellow-300">
                                #{getOrderNumber(order)}
                              </p>

                              <p className="mt-0.5 truncate text-xs font-black text-white">
                                {getCustomerName(order)}
                              </p>

                              <p className="truncate text-[10px] font-semibold text-zinc-500">
                                {getCustomerPhone(order)}
                              </p>

                              <p className="mt-0.5 truncate text-[10px] font-semibold text-zinc-600">
                                {getOrderTypeLabel(order)}
                              </p>
                            </td>

                            <td className="px-2.5 py-2 align-top">
                              <p className="truncate text-xs font-semibold text-zinc-400">
                                {address || "Sem endereço"}
                              </p>

                              <p className="truncate text-[10px] font-black uppercase text-zinc-500">
                                {neighborhood || "Bairro não informado"}
                              </p>

                              <p className="truncate text-[10px] font-semibold text-zinc-600">
                                Motoboy: {deliveryPersonName || "Não informado"}
                              </p>
                            </td>

                            <td className="px-2.5 py-2 align-top">
                              <p className="truncate text-xs font-semibold text-zinc-400">
                                {formatHistoryItemsSummary(items)}
                              </p>

                              <p className="truncate text-[10px] font-semibold text-zinc-500">
                                {formatItemCount(items.length)}
                              </p>
                            </td>

                            <td className="px-2.5 py-2 align-top">
                              <span
                                className={[
                                  "inline-flex rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide",
                                  getOrderStatusBadgeClasses(order.status),
                                ].join(" ")}
                              >
                                {getOrderStatusLabel(order.status)}
                              </span>

                              <p className="mt-0.5 truncate text-xs font-semibold text-zinc-400">
                                {getPaymentLabel(order.payment_method)}
                              </p>

                              <p className="truncate text-[10px] font-semibold text-zinc-500">
                                {getPaymentStatusLabel(order.payment_status)}
                              </p>

                              <p className="truncate text-[10px] font-semibold text-zinc-600">
                                {formatDateTime(order.created_at)}
                              </p>
                            </td>

                            <td className="px-2.5 py-2 text-right align-top">
                              <p className="text-xs font-black text-white">
                                {formatBRL(order.total)}
                              </p>

                              <p className="text-[10px] font-semibold text-zinc-500">
                                Taxa {formatBRL(order.delivery_fee)}
                              </p>

                              <button
                                type="button"
                                onClick={() => setSelectedHistoryOrder(order)}
                                className="mt-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-black text-zinc-500 transition hover:border-yellow-400/50 hover:text-yellow-300"
                                aria-label={`Ver histórico do pedido ${getOrderNumber(order)}`}
                              >
                                <Eye className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedHistoryOrder && (
        <HistoryOrderDetailsModal
          order={selectedHistoryOrder}
          items={historyOrderItemsByOrderId[selectedHistoryOrder.id] || []}
          deliveryPeople={allDeliveryPeople}
          onClose={() => setSelectedHistoryOrder(null)}
        />
      )}
    </AdminLayout>
  )
}