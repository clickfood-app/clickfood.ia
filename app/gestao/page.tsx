"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Timer,
  TrendingDown,
  Wallet,
  X,
} from "lucide-react"

type OrderRow = {
  id: string
  public_order_number: string | null
  customer_name: string | null
  customer_phone: string | null
  total: number | string | null
  created_at: string
  status: string | null
  payment_method: string | null
  payment_status: string | null
  order_source: string | null
  order_type: string | null
  accepted_at: string | null
  preparation_started_at: string | null
  out_for_delivery_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
}

type PaymentGroup = "pix" | "cash" | "card" | "other"

type PaymentBreakdown = Record<PaymentGroup, number>

type FinancialRow = Record<string, unknown>
type CashClosingRow = Record<string, unknown>
type OrderItemRow = Record<string, unknown>

type ExpenseItem = {
  id: string
  title: string
  source: string
  amount: number
  paidAt: string | null
}

type ActivityPoint = {
  hour: string
  orders: number
  sales: number
}

type ItemSale = {
  id: string
  name: string
  quantity: number
  revenue: number
  isUpsell: boolean
}

type MetricsSnapshot = {
  totalOrders: number
  paidOrders: number
  pendingOrders: number
  cancelledOrders: number
  delayedOrders: number
  pendingPixOrders: number
  totalSales: number
  totalReceived: number
  totalPending: number
  totalExpenses: number
  manualIncome: number
  estimatedBalance: number
  paymentBreakdown: PaymentBreakdown
  expenses: ExpenseItem[]
}

type CaixaData = MetricsSnapshot & {
  sessionStartISO: string
  todayClosedReceived: number
  todayClosedBalance: number
  dayTotalOrders: number
  dayPaidOrders: number
  dayPendingOrders: number
  dayCancelledOrders: number
  dayDelayedOrders: number
  dayPendingPixOrders: number
  dayTotalSales: number
  dayTotalReceived: number
  dayTotalPending: number
  dayTotalExpenses: number
  dayManualIncome: number
  dayEstimatedBalance: number
  dayUniqueCustomers: number
  dayAverageTicket: number
  dayPaymentBreakdown: PaymentBreakdown
  dayExpenses: ExpenseItem[]
  activityData: ActivityPoint[]
  topItems: ItemSale[]
  upsellItems: ItemSale[]
  upsellRevenue: number
  upsellQuantity: number
  orders: OrderRow[]
  dayOrders: OrderRow[]
  closingsToday: CashClosingRow[]
  lastClosingToday: CashClosingRow | null
  lastClosingOverall: CashClosingRow | null
}

type ClosingForm = {
  cash: string
  pix: string
  card: string
  other: string
  notes: string
}

const emptyBreakdown: PaymentBreakdown = {
  pix: 0,
  cash: 0,
  card: 0,
  other: 0,
}

const paymentLabels: Record<PaymentGroup, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  card: "Cartão",
  other: "Outros",
}

function createEmptyMetrics(): MetricsSnapshot {
  return {
    totalOrders: 0,
    paidOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    delayedOrders: 0,
    pendingPixOrders: 0,
    totalSales: 0,
    totalReceived: 0,
    totalPending: 0,
    totalExpenses: 0,
    manualIncome: 0,
    estimatedBalance: 0,
    paymentBreakdown: { ...emptyBreakdown },
    expenses: [],
  }
}

function createEmptyCaixaData(sessionStartISO = new Date().toISOString()): CaixaData {
  return {
    sessionStartISO,
    ...createEmptyMetrics(),
    todayClosedReceived: 0,
    todayClosedBalance: 0,
    dayTotalOrders: 0,
    dayPaidOrders: 0,
    dayPendingOrders: 0,
    dayCancelledOrders: 0,
    dayDelayedOrders: 0,
    dayPendingPixOrders: 0,
    dayTotalSales: 0,
    dayTotalReceived: 0,
    dayTotalPending: 0,
    dayTotalExpenses: 0,
    dayManualIncome: 0,
    dayEstimatedBalance: 0,
    dayUniqueCustomers: 0,
    dayAverageTicket: 0,
    dayPaymentBreakdown: { ...emptyBreakdown },
    dayExpenses: [],
    activityData: [],
    topItems: [],
    upsellItems: [],
    upsellRevenue: 0,
    upsellQuantity: 0,
    orders: [],
    dayOrders: [],
    closingsToday: [],
    lastClosingToday: null,
    lastClosingOverall: null,
  }
}

function parseLocalAwareDate(value: Date | string | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return value

  const raw = String(value)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00`)
    : new Date(raw)

  return Number.isNaN(date.getTime()) ? null : date
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0))
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value)
}

function formatDateTime(value: string | null | undefined) {
  const date = parseLocalAwareDate(value)
  if (!date) return "-"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatTime(value: string | null | undefined) {
  const date = parseLocalAwareDate(value)
  if (!date) return "-"

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min"
  if (minutes < 60) return `${Math.round(minutes)} min`

  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)

  return rest > 0 ? `${hours}h ${rest}min` : `${hours}h`
}

function getLocalDateKey(value: Date | string) {
  const date = parseLocalAwareDate(value)
  if (!date) return ""

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getDayRange(offsetDays = 0) {
  const start = new Date()
  start.setDate(start.getDate() + offsetDays)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return {
    start,
    end,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    dateKey: getLocalDateKey(start),
  }
}

function parseMoneyInput(value: string) {
  const normalized = String(value || "")
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")

  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : 0
}

function moneyToInput(value: number) {
  return Number(value || 0).toFixed(2).replace(".", ",")
}

function readNumber(row: FinancialRow | null | undefined, fields: string[]) {
  if (!row) return 0

  for (const field of fields) {
    const value = row[field]

    if (value !== null && value !== undefined && value !== "") {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }

  return 0
}

function readString(
  row: FinancialRow | null | undefined,
  fields: string[]
): string | null {
  if (!row) return null

  for (const field of fields) {
    const value = row[field]

    if (value !== null && value !== undefined && value !== "") {
      return String(value)
    }
  }

  return null
}

function readBoolean(row: FinancialRow | null | undefined, fields: string[]) {
  if (!row) return false

  for (const field of fields) {
    const value = row[field]

    if (typeof value === "boolean") return value
    if (typeof value === "number") return value === 1
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase()
      if (["true", "1", "sim", "yes", "s"].includes(normalized)) return true
      if (["false", "0", "não", "nao", "no", "n"].includes(normalized)) return false
    }
  }

  return false
}

function readDateString(
  row: FinancialRow | null | undefined,
  fields: string[]
): string | null {
  const value = readString(row, fields)
  const date = parseLocalAwareDate(value)

  return date ? date.toISOString() : null
}

function isSameLocalDate(value: string | null | undefined, dateKey: string) {
  const date = parseLocalAwareDate(value)
  if (!date) return false

  return getLocalDateKey(date) === dateKey
}

function isDateInsideRange(
  value: string | null | undefined,
  startISO: string,
  endISO: string
) {
  const date = parseLocalAwareDate(value)
  const start = parseLocalAwareDate(startISO)
  const end = parseLocalAwareDate(endISO)

  if (!date || !start || !end) return false

  return date.getTime() >= start.getTime() && date.getTime() < end.getTime()
}

function getStatusBucket(status: string | null) {
  const normalized = String(status || "").toLowerCase()

  if (
    ["cancelled", "canceled", "cancelado", "recusado", "refused"].includes(
      normalized
    )
  ) {
    return "cancelled"
  }

  if (
    [
      "completed",
      "done",
      "finished",
      "finalizado",
      "delivered",
      "entregue",
    ].includes(normalized)
  ) {
    return "finished"
  }

  if (
    [
      "delivering",
      "on_route",
      "out_for_delivery",
      "em_rota",
      "rota",
      "saiu_para_entrega",
    ].includes(normalized)
  ) {
    return "route"
  }

  if (
    [
      "accepted",
      "confirmed",
      "preparing",
      "in_preparation",
      "em_preparo",
      "preparo",
      "cozinha",
      "ready",
      "pronto",
    ].includes(normalized)
  ) {
    return "open"
  }

  return "analysis"
}

function getStatusLabel(status: string | null) {
  const bucket = getStatusBucket(status)

  if (bucket === "cancelled") return "Cancelado"
  if (bucket === "finished") return "Finalizado"
  if (bucket === "route") return "Em rota"
  if (bucket === "open") return "Em andamento"

  return "Em análise"
}

function getPaymentGroup(paymentMethod: string | null): PaymentGroup {
  const method = String(paymentMethod || "").toLowerCase()

  if (method.includes("pix")) return "pix"

  if (
    method.includes("dinheiro") ||
    method.includes("cash") ||
    method.includes("money")
  ) {
    return "cash"
  }

  if (
    method.includes("card") ||
    method.includes("cart") ||
    method.includes("credito") ||
    method.includes("crédito") ||
    method.includes("debito") ||
    method.includes("débito") ||
    method.includes("maquininha")
  ) {
    return "card"
  }

  return "other"
}

function getPaymentMethodLabel(paymentMethod: string | null) {
  const group = getPaymentGroup(paymentMethod)

  if (group === "pix") return "Pix"
  if (group === "cash") return "Dinheiro"
  if (group === "card") return "Cartão"

  return paymentMethod || "Outro"
}

function isPaidOrder(order: OrderRow) {
  const paymentStatus = String(order.payment_status || "").toLowerCase()

  return [
    "paid",
    "received",
    "confirmed",
    "approved",
    "pago",
    "recebido",
    "confirmado",
  ].includes(paymentStatus)
}

function isPendingPix(order: OrderRow) {
  const method = getPaymentGroup(order.payment_method)
  const paymentStatus = String(order.payment_status || "").toLowerCase()

  if (method !== "pix") return false

  return ![
    "paid",
    "received",
    "confirmed",
    "approved",
    "pago",
    "recebido",
    "confirmado",
  ].includes(paymentStatus)
}

function getOrderAgeMinutes(createdAt: string) {
  const created = parseLocalAwareDate(createdAt)?.getTime() ?? Date.now()
  const now = Date.now()

  return Math.max(0, Math.floor((now - created) / 1000 / 60))
}

function isDelayed(order: OrderRow) {
  const bucket = getStatusBucket(order.status)
  const age = getOrderAgeMinutes(order.created_at)

  if (bucket === "analysis") return age >= 10
  if (bucket === "open") return age >= 30
  if (bucket === "route") return age >= 50

  return false
}

function isActiveOrder(order: OrderRow) {
  const bucket = getStatusBucket(order.status)

  return bucket !== "cancelled" && bucket !== "finished"
}

function isPaidFinancialRow(row: FinancialRow) {
  const status = String(
    readString(row, ["status", "payment_status", "settlement_status"]) || ""
  ).toLowerCase()

  return [
    "paid",
    "pago",
    "received",
    "recebido",
    "settled",
    "liquidado",
    "closed",
    "fechado",
  ].includes(status)
}

function isCashClosingTransaction(row: FinancialRow) {
  const origin = String(readString(row, ["origin", "source"]) || "").toLowerCase()
  const text = String(
    readString(row, ["title", "description", "category", "notes"]) || ""
  ).toLowerCase()

  return (
    origin.includes("cash_closing") ||
    origin.includes("fechamento") ||
    text.includes("fechamento de caixa") ||
    text.includes("fechamento do caixa")
  )
}

function getFinancialRowDate(row: FinancialRow, fields?: string[]) {
  return readDateString(
    row,
    fields ?? [
      "paid_at",
      "payment_date",
      "settled_at",
      "closed_at",
      "occurred_at",
      "purchase_date",
      "date",
      "created_at",
    ]
  )
}

function getExpenseAmount(row: FinancialRow, fields?: string[]) {
  return readNumber(
    row,
    fields ?? [
      "amount",
      "total_amount",
      "total_cost",
      "value",
      "total",
      "paid_amount",
      "settlement_amount",
    ]
  )
}

function getExpenseTitle(row: FinancialRow, fallback: string) {
  return (
    readString(row, [
      "description",
      "title",
      "name",
      "item_name",
      "product_name",
      "reason",
      "note",
      "notes",
      "reference",
    ]) || fallback
  )
}

function normalizeExpenseRows(
  rows: FinancialRow[],
  source: string,
  fallbackTitle: string,
  startISO: string,
  endISO: string,
  options?: {
    paidOnly?: boolean
    dateFields?: string[]
    amountFields?: string[]
  }
): ExpenseItem[] {
  const paidOnly = options?.paidOnly ?? true

  return rows
    .filter((row) => !paidOnly || isPaidFinancialRow(row))
    .filter((row) =>
      isDateInsideRange(
        getFinancialRowDate(row, options?.dateFields),
        startISO,
        endISO
      )
    )
    .map((row, index) => ({
      id: String(readString(row, ["id"]) || `${source}-${index}`),
      title: getExpenseTitle(row, fallbackTitle),
      source,
      amount: getExpenseAmount(row, options?.amountFields),
      paidAt: getFinancialRowDate(row, options?.dateFields),
    }))
    .filter((item) => item.amount > 0)
}

function normalizeManualIncomeRows(
  rows: FinancialRow[],
  startISO: string,
  endISO: string
) {
  return rows
    .filter((row) => !isCashClosingTransaction(row))
    .filter(
      (row) => String(readString(row, ["type", "transaction_type"]) || "") === "income"
    )
    .filter((row) =>
      isDateInsideRange(getFinancialRowDate(row, ["occurred_at", "created_at"]), startISO, endISO)
    )
}

function normalizeManualExpenseRows(
  rows: FinancialRow[],
  startISO: string,
  endISO: string
) {
  return normalizeExpenseRows(
    rows.filter(
      (row) =>
        !isCashClosingTransaction(row) &&
        String(readString(row, ["type", "transaction_type"]) || "") === "expense"
    ),
    "Lançamentos manuais",
    "Saída manual",
    startISO,
    endISO,
    {
      paidOnly: false,
      dateFields: ["occurred_at", "created_at"],
      amountFields: ["amount", "value", "total"],
    }
  )
}

function getClosingClosedAt(row: CashClosingRow | null) {
  return readDateString(row, ["closed_at", "created_at", "updated_at"])
}

function getClosingOpenedAt(row: CashClosingRow | null) {
  return readDateString(row, ["opened_at", "created_at"])
}

function getClosingReceived(row: CashClosingRow | null) {
  const directTotal = readNumber(row, [
    "total_received",
    "received_total",
    "received_amount",
  ])

  if (directTotal > 0) return directTotal

  return (
    readNumber(row, ["gross_revenue", "gross_total"]) +
    readNumber(row, ["manual_income", "manual_received"])
  )
}

function getClosingBalance(row: CashClosingRow | null) {
  return readNumber(row, [
    "final_balance",
    "estimated_balance",
    "expected_balance",
    "estimated_profit",
    "balance",
  ])
}

function getClosingType(row: CashClosingRow | null) {
  const type = readString(row, ["closing_type", "type"])

  if (type === "automatic") return "Automático"

  return "Manual"
}

function getPaymentStatusLabel(order: OrderRow) {
  if (isPaidOrder(order)) return "Pago"
  if (isPendingPix(order)) return "Pix pendente"

  return "Pendente"
}

function getCustomerKey(order: OrderRow) {
  const phone = String(order.customer_phone || "").replace(/\D/g, "")
  if (phone) return phone

  return String(order.customer_name || "").trim().toLowerCase()
}

function buildActivityData(orders: OrderRow[]) {
  const points: ActivityPoint[] = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}h`,
    orders: 0,
    sales: 0,
  }))

  orders
    .filter((order) => getStatusBucket(order.status) !== "cancelled")
    .forEach((order) => {
      const date = parseLocalAwareDate(order.created_at)
      if (!date) return

      const hour = date.getHours()
      points[hour].orders += 1
      points[hour].sales += Number(order.total || 0)
    })

  const currentHour = new Date().getHours()

  return points.slice(0, currentHour + 1)
}

function getItemName(row: OrderItemRow) {
  return (
    readString(row, ["product_name", "name", "title", "item_name"]) ||
    "Item sem nome"
  )
}

function getItemQuantity(row: OrderItemRow) {
  const quantity = readNumber(row, ["quantity", "qty", "amount"])

  return quantity > 0 ? quantity : 1
}

function getItemRevenue(row: OrderItemRow) {
  const total = readNumber(row, [
    "total_price",
    "line_total",
    "total",
    "amount",
    "value",
  ])

  if (total > 0) return total

  return readNumber(row, ["unit_price", "price", "item_price"]) * getItemQuantity(row)
}

function isUpsellItem(row: OrderItemRow) {
  if (readBoolean(row, ["is_upsell"])) return true

  if (readString(row, ["upsell_rule_id", "upsell_id", "campaign_id"])) {
    return true
  }

  const marker = String(
    readString(row, ["source", "origin", "item_type", "type", "category"]) || ""
  ).toLowerCase()

  return ["upsell", "adicional", "complemento", "combo"].some((item) =>
    marker.includes(item)
  )
}

function buildItemAnalytics(rows: OrderItemRow[]) {
  const map = new Map<string, ItemSale>()

  for (const row of rows) {
    const name = getItemName(row)
    const key = `${readString(row, ["product_id"]) || name}`.toLowerCase()
    const current =
      map.get(key) ??
      ({
        id: key,
        name,
        quantity: 0,
        revenue: 0,
        isUpsell: false,
      } satisfies ItemSale)

    current.quantity += getItemQuantity(row)
    current.revenue += getItemRevenue(row)
    current.isUpsell = current.isUpsell || isUpsellItem(row)

    map.set(key, current)
  }

  const items = Array.from(map.values()).sort((a, b) => {
    if (b.revenue !== a.revenue) return b.revenue - a.revenue
    return b.quantity - a.quantity
  })
  const upsellItems = items.filter((item) => item.isUpsell)

  return {
    topItems: items.slice(0, 6),
    upsellItems: upsellItems.slice(0, 5),
    upsellRevenue: upsellItems.reduce((sum, item) => sum + item.revenue, 0),
    upsellQuantity: upsellItems.reduce((sum, item) => sum + item.quantity, 0),
  }
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone,
}: {
  title: string
  value: string
  subtitle: string
  icon: ReactNode
  tone: "blue" | "green" | "amber" | "red" | "slate"
}) {
  const toneClass = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-orange-100 bg-orange-50 text-orange-700",
    red: "border-red-100 bg-red-50 text-red-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  }[tone]

  return (
    <div className="min-h-[118px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex h-full flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {title}
          </p>

          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
              toneClass
            )}
          >
            {icon}
          </div>
        </div>

        <div className="min-w-0">
          <p className="truncate text-2xl font-semibold tabular-nums text-slate-950">
            {value}
          </p>
          <p className="mt-2 truncate text-xs font-medium text-slate-500">
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  )
}

function Panel({
  title,
  subtitle,
  children,
  action,
  className,
  id,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        {action}
      </div>

      <div className="mt-4">{children}</div>
    </section>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-medium text-slate-500">
      {message}
    </div>
  )
}

function MoneyInput({
  label,
  value,
  expected,
  onChange,
}: {
  label: string
  value: string
  expected: number
  onChange: (value: string) => void
}) {
  return (
    <label className="block rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <span className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
        <span className="font-semibold text-blue-700">
          Esperado: {formatCurrency(expected)}
        </span>
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        placeholder="0,00"
        className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold tabular-nums text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
      />
    </label>
  )
}

function StatusBadge({ order }: { order: OrderRow }) {
  const bucket = getStatusBucket(order.status)

  const className = {
    analysis: "bg-blue-50 text-blue-700 ring-blue-100",
    open: "bg-orange-50 text-orange-700 ring-orange-100",
    route: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    finished: "bg-slate-100 text-slate-600 ring-slate-200",
    cancelled: "bg-red-50 text-red-700 ring-red-100",
  }[bucket]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ring-1",
        className
      )}
    >
      {getStatusLabel(order.status)}
    </span>
  )
}

function PaymentBadge({ order }: { order: OrderRow }) {
  const paid = isPaidOrder(order)
  const pendingPix = isPendingPix(order)

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ring-1",
        paid && "bg-emerald-50 text-emerald-700 ring-emerald-100",
        pendingPix && "bg-orange-50 text-orange-700 ring-orange-100",
        !paid && !pendingPix && "bg-slate-100 text-slate-600 ring-slate-200"
      )}
    >
      {getPaymentStatusLabel(order)}
    </span>
  )
}

function ActivityChart({ data }: { data: ActivityPoint[] }) {
  const [mode, setMode] = useState<"orders" | "sales">("orders")
  const hasData = data.some((point) => point.orders > 0)

  if (!hasData) {
    return <EmptyState message="Nenhum pedido registrado hoje." />
  }

  const values = data.map((point) => (mode === "orders" ? point.orders : point.sales))
  const maxValue = Math.max(1, ...values)
  const totalOrders = data.reduce((sum, point) => sum + point.orders, 0)
  const totalSales = data.reduce((sum, point) => sum + point.sales, 0)

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          Visualização do gráfico
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setMode("orders")}
            className={cn(
              "h-8 rounded-md px-3 text-xs font-semibold transition",
              mode === "orders"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            )}
          >
            Pedidos
          </button>
          <button
            type="button"
            onClick={() => setMode("sales")}
            className={cn(
              "h-8 rounded-md px-3 text-xs font-semibold transition",
              mode === "sales"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            )}
          >
            Vendas
          </button>
        </div>
      </div>

      <div className="relative h-[230px] overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
        <div className="pointer-events-none absolute inset-3 rounded-lg bg-[linear-gradient(to_right,rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.18)_1px,transparent_1px)] bg-[size:36px_28px]" />
        <div className="relative flex h-[170px] items-end gap-1">
          {data.map((point, index) => {
            const rawValue = mode === "orders" ? point.orders : point.sales
            const height =
              rawValue === 0
                ? 4
                : Math.max(12, Math.round((rawValue / maxValue) * 100))

            return (
              <div
                key={point.hour}
                className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
              >
                <div className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-20 w-max -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-[11px] text-slate-500 opacity-0 shadow-xl transition duration-150 group-hover:opacity-100">
                  <p className="font-semibold tabular-nums text-slate-950">
                    {point.hour}
                  </p>
                  <p className="mt-0.5 tabular-nums">
                    {point.orders} pedido(s)
                  </p>
                  <p className="tabular-nums font-semibold text-emerald-700">
                    {formatCurrency(point.sales)}
                  </p>
                </div>

                <div
                  className={cn(
                    "w-full max-w-8 origin-bottom rounded-t-md transition-all duration-200 ease-out group-hover:scale-y-105",
                    rawValue > 0
                      ? "bg-blue-600 group-hover:bg-blue-500 group-hover:shadow-md"
                      : "bg-slate-200 group-hover:bg-slate-300"
                  )}
                  style={{ height: `${height}%` }}
                />
                <span
                  className={cn(
                    "mt-2 text-[10px] font-semibold text-slate-400 transition-colors group-hover:text-slate-700",
                    index % 2 !== 0 && data.length > 12 && "opacity-0"
                  )}
                >
                  {point.hour}
                </span>
              </div>
            )
          })}
        </div>

        <div className="relative mt-3 flex items-center justify-between border-t border-slate-200 pt-2 text-[11px] font-semibold tabular-nums text-slate-500">
          <span>{formatNumber(totalOrders)} pedido(s)</span>
          <span>{formatCurrency(totalSales)}</span>
        </div>
      </div>
    </div>
  )
}

function PaymentDonut({
  rows,
  total,
}: {
  rows: Array<{
    key: PaymentGroup
    label: string
    amount: number
    percent: number
  }>
  total: number
}) {
  const colors: Record<PaymentGroup, string> = {
    pix: "#2563eb",
    cash: "#22c55e",
    card: "#f97316",
    other: "#64748b",
  }

  let cursor = 0
  const segments = rows
    .filter((row) => row.amount > 0)
    .map((row) => {
      const start = cursor
      const end = cursor + row.percent
      cursor = end

      return `${colors[row.key]} ${start}% ${end}%`
    })

  const background =
    total > 0 && segments.length > 0
      ? `conic-gradient(${segments.join(", ")})`
      : "conic-gradient(#e2e8f0 0% 100%)"

  return (
    <div className="grid gap-5 md:grid-cols-[190px_1fr] md:items-center">
      <div className="relative mx-auto flex h-40 w-40 items-center justify-center rounded-full shadow-sm">
        <div
          className="absolute inset-0 rounded-full transition duration-300 hover:scale-[1.03]"
          style={{ background }}
        />
        <div className="absolute inset-5 rounded-full bg-white shadow-inner" />
        <div className="relative text-center">
          <p className="text-sm font-semibold tabular-nums text-slate-950">
            {formatCurrency(total)}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">Total</p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.key}
            className="group rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: colors[row.key] }}
                />
                <span className="truncate text-sm font-semibold text-slate-700">
                  {row.label}
                </span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-slate-950 transition group-hover:text-emerald-700">
                {row.percent}%
              </span>
            </div>
            <p className="mt-1 pl-4 text-[11px] font-semibold tabular-nums text-slate-500">
              {formatCurrency(row.amount)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function SmallTile({
  label,
  value,
  tone = "slate",
}: {
  label: string
  value: string
  tone?: "slate" | "green" | "red" | "amber" | "blue"
}) {
  const toneClass = {
    slate: "text-slate-950",
    green: "text-emerald-700",
    red: "text-red-700",
    amber: "text-orange-700",
    blue: "text-blue-700",
  }[tone]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <p className={cn("mt-1 truncate text-sm font-semibold tabular-nums", toneClass)}>{value}</p>
    </div>
  )
}

export default function GestaoPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const today = useMemo(() => getDayRange(0), [])
  const yesterday = useMemo(() => getDayRange(-1), [])

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [data, setData] = useState<CaixaData>(
    createEmptyCaixaData(today.startISO)
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isClosing, setIsClosing] = useState(false)
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [closingForm, setClosingForm] = useState<ClosingForm>({
    cash: "0,00",
    pix: "0,00",
    card: "0,00",
    other: "0,00",
    notes: "",
  })

  const resolveRestaurant = useCallback(async () => {
    if (restaurantId) return restaurantId

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) throw userError
    if (!user) throw new Error("Usuário não autenticado.")

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    if (restaurantError) throw restaurantError
    if (!restaurant?.id) throw new Error("Restaurante não encontrado.")

    setRestaurantId(restaurant.id)

    return restaurant.id
  }, [restaurantId, supabase])

  const loadOptionalRows = useCallback(
    async (tableName: string, resolvedRestaurantId: string) => {
      try {
        const client = supabase as any
        const { data: rows, error } = await client
          .from(tableName)
          .select("*")
          .eq("restaurant_id", resolvedRestaurantId)
          .limit(3000)

        if (error) {
          console.warn(`Não foi possível carregar ${tableName}:`, error)
          return [] as FinancialRow[]
        }

        return (rows ?? []) as FinancialRow[]
      } catch (error) {
        console.warn(`Não foi possível carregar ${tableName}:`, error)
        return [] as FinancialRow[]
      }
    },
    [supabase]
  )

  const loadOrderItemsByOrderIds = useCallback(
    async (orderIds: string[]) => {
      if (orderIds.length === 0) return [] as OrderItemRow[]

      try {
        const client = supabase as any
        const { data: rows, error } = await client
          .from("order_items")
          .select("*")
          .in("order_id", orderIds)
          .limit(3000)

        if (error) {
          console.warn("Não foi possível carregar itens dos pedidos:", error)
          return [] as OrderItemRow[]
        }

        return (rows ?? []) as OrderItemRow[]
      } catch (error) {
        console.warn("Não foi possível carregar itens dos pedidos:", error)
        return [] as OrderItemRow[]
      }
    },
    [supabase]
  )

  const loadOrdersByRange = useCallback(
    async (resolvedRestaurantId: string, startISO: string, endISO: string) => {
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(
          [
            "id",
            "public_order_number",
            "customer_name",
            "customer_phone",
            "total",
            "created_at",
            "status",
            "payment_method",
            "payment_status",
            "order_source",
            "order_type",
            "accepted_at",
            "preparation_started_at",
            "out_for_delivery_at",
            "delivered_at",
            "cancelled_at",
          ].join(", ")
        )
        .eq("restaurant_id", resolvedRestaurantId)
        .gte("created_at", startISO)
        .lt("created_at", endISO)
        .order("created_at", { ascending: false })

      if (ordersError) throw ordersError

      return (ordersData ?? []) as unknown as OrderRow[]
    },
    [supabase]
  )

  const buildMetrics = useCallback(
    async (
      resolvedRestaurantId: string,
      startISO: string,
      endISO: string,
      orders: OrderRow[]
    ): Promise<MetricsSnapshot> => {
      const validOrders = orders.filter(
        (order) => getStatusBucket(order.status) !== "cancelled"
      )
      const cancelledOrders = orders.filter(
        (order) => getStatusBucket(order.status) === "cancelled"
      )

      const paidOrders = validOrders.filter(isPaidOrder)
      const pendingOrders = validOrders.filter((order) => !isPaidOrder(order))
      const delayedOrders = validOrders.filter(isDelayed)
      const pendingPixOrders = validOrders.filter(isPendingPix)

      const paymentBreakdown = paidOrders.reduce<PaymentBreakdown>(
        (acc, order) => {
          const group = getPaymentGroup(order.payment_method)
          acc[group] += Number(order.total || 0)
          return acc
        },
        { ...emptyBreakdown }
      )

      const totalSales = validOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      )
      const paidOrderTotal = paidOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      )
      const totalPending = pendingOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      )

      const [
        accountsPayableRows,
        supplierPurchaseRows,
        deliverySettlementRows,
        staffPaymentRows,
        financialTransactionRows,
        productLossRows,
      ] = await Promise.all([
        loadOptionalRows("accounts_payable", resolvedRestaurantId),
        loadOptionalRows("supplier_purchases", resolvedRestaurantId),
        loadOptionalRows("delivery_settlements", resolvedRestaurantId),
        loadOptionalRows("staff_payments", resolvedRestaurantId),
        loadOptionalRows("financial_transactions", resolvedRestaurantId),
        loadOptionalRows("product_losses", resolvedRestaurantId),
      ])

      const purchaseIds = new Set(
        supplierPurchaseRows
          .map((row) => readString(row, ["id"]))
          .filter(Boolean)
          .map(String)
      )
      const payableRowsWithoutDuplicatedPurchases = accountsPayableRows.filter(
        (row) => {
          const purchaseId = readString(row, ["purchase_id"])
          return !purchaseId || !purchaseIds.has(purchaseId)
        }
      )

      const manualIncomeRows = normalizeManualIncomeRows(
        financialTransactionRows,
        startISO,
        endISO
      )
      const manualIncome = manualIncomeRows.reduce(
        (sum, row) => sum + readNumber(row, ["amount", "value", "total"]),
        0
      )

      manualIncomeRows.forEach((row) => {
        const group = getPaymentGroup(readString(row, ["payment_method"]))
        paymentBreakdown[group] += readNumber(row, ["amount", "value", "total"])
      })

      const expenses = [
        ...normalizeExpenseRows(
          payableRowsWithoutDuplicatedPurchases,
          "Contas a pagar",
          "Despesa paga",
          startISO,
          endISO
        ),
        ...normalizeExpenseRows(
          supplierPurchaseRows,
          "Compras",
          "Compra de fornecedor",
          startISO,
          endISO,
          {
            dateFields: ["paid_at", "purchase_date", "updated_at", "created_at"],
            amountFields: ["total_amount", "amount", "total", "value"],
          }
        ),
        ...normalizeExpenseRows(
          deliverySettlementRows,
          "Entregadores",
          "Repasse de entregador",
          startISO,
          endISO
        ),
        ...normalizeExpenseRows(
          staffPaymentRows,
          "Equipe",
          "Pagamento de funcionário",
          startISO,
          endISO
        ),
        ...normalizeManualExpenseRows(financialTransactionRows, startISO, endISO),
        ...normalizeExpenseRows(
          productLossRows,
          "Perdas",
          "Perda registrada",
          startISO,
          endISO,
          {
            paidOnly: false,
            dateFields: ["occurred_at", "created_at"],
            amountFields: ["total_cost", "amount", "value", "total"],
          }
        ),
      ].sort((a, b) => {
        const dateA = a.paidAt ? parseLocalAwareDate(a.paidAt)?.getTime() ?? 0 : 0
        const dateB = b.paidAt ? parseLocalAwareDate(b.paidAt)?.getTime() ?? 0 : 0
        return dateB - dateA
      })

      const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0)
      const totalReceived = paidOrderTotal + manualIncome

      return {
        totalOrders: validOrders.length,
        paidOrders: paidOrders.length,
        pendingOrders: pendingOrders.length,
        cancelledOrders: cancelledOrders.length,
        delayedOrders: delayedOrders.length,
        pendingPixOrders: pendingPixOrders.length,
        totalSales,
        totalReceived,
        totalPending,
        totalExpenses,
        manualIncome,
        estimatedBalance: totalReceived - totalExpenses,
        paymentBreakdown,
        expenses,
      }
    },
    [loadOptionalRows]
  )

  const ensurePreviousDayAutoClosing = useCallback(
    async (resolvedRestaurantId: string) => {
      try {
        const client = supabase as any

        const { data: existingClosings, error: existingError } = await client
          .from("cash_closings")
          .select("id")
          .eq("restaurant_id", resolvedRestaurantId)
          .eq("closing_date", yesterday.dateKey)
          .limit(1)

        if (existingError) {
          console.warn("Não foi possível verificar fechamento automático:", existingError)
          return
        }

        if ((existingClosings ?? []).length > 0) return

        const yesterdayOrders = await loadOrdersByRange(
          resolvedRestaurantId,
          yesterday.startISO,
          yesterday.endISO
        )

        const yesterdayMetrics = await buildMetrics(
          resolvedRestaurantId,
          yesterday.startISO,
          yesterday.endISO,
          yesterdayOrders
        )

        const hasMovement =
          yesterdayMetrics.totalSales > 0 ||
          yesterdayMetrics.totalReceived > 0 ||
          yesterdayMetrics.totalPending > 0 ||
          yesterdayMetrics.totalExpenses > 0

        if (!hasMovement) return

        const payload = {
          restaurant_id: resolvedRestaurantId,
          closing_date: yesterday.dateKey,
          opened_at: yesterday.startISO,
          closed_at: yesterday.endISO,
          status: "closed",
          closing_type: "automatic",
          total_sales: yesterdayMetrics.totalSales,
          total_received: yesterdayMetrics.totalReceived,
          total_pending: yesterdayMetrics.totalPending,
          total_expenses: yesterdayMetrics.totalExpenses,
          final_balance: yesterdayMetrics.estimatedBalance,
          pix_total: yesterdayMetrics.paymentBreakdown.pix,
          cash_total: yesterdayMetrics.paymentBreakdown.cash,
          card_total: yesterdayMetrics.paymentBreakdown.card,
          other_total: yesterdayMetrics.paymentBreakdown.other,
          counted_pix: yesterdayMetrics.paymentBreakdown.pix,
          counted_cash: yesterdayMetrics.paymentBreakdown.cash,
          counted_card: yesterdayMetrics.paymentBreakdown.card,
          counted_other: yesterdayMetrics.paymentBreakdown.other,
          counted_total: yesterdayMetrics.totalReceived,
          difference_amount: 0,
          notes: "Fechamento automático criado ao abrir o sistema no dia seguinte.",
        }

        const { error: insertError } = await client
          .from("cash_closings")
          .insert(payload)

        if (insertError) {
          console.warn("Não foi possível criar fechamento automático:", insertError)
        }
      } catch (error) {
        console.warn("Erro no fechamento automático:", error)
      }
    },
    [
      buildMetrics,
      loadOrdersByRange,
      supabase,
      yesterday.dateKey,
      yesterday.endISO,
      yesterday.startISO,
    ]
  )

  const loadGestao = useCallback(async () => {
    try {
      setIsLoading(true)

      const resolvedRestaurantId = await resolveRestaurant()

      await ensurePreviousDayAutoClosing(resolvedRestaurantId)

      const cashClosingRows = await loadOptionalRows(
        "cash_closings",
        resolvedRestaurantId
      )

      const closingRows = (cashClosingRows ?? []) as CashClosingRow[]

      const closingsToday = closingRows
        .filter((closing) => {
          const closingDate = readString(closing, ["closing_date", "date"])
          const closedAt = getClosingClosedAt(closing)

          return closingDate === today.dateKey || isSameLocalDate(closedAt, today.dateKey)
        })
        .sort((a, b) => {
          const dateA = getClosingClosedAt(a)
            ? parseLocalAwareDate(String(getClosingClosedAt(a)))?.getTime() ?? 0
            : 0
          const dateB = getClosingClosedAt(b)
            ? parseLocalAwareDate(String(getClosingClosedAt(b)))?.getTime() ?? 0
            : 0

          return dateB - dateA
        })

      const lastClosingToday = closingsToday[0] ?? null
      const lastClosingOverall =
        closingRows
          .slice()
          .sort((a, b) => {
            const dateA = getClosingClosedAt(a)
              ? parseLocalAwareDate(String(getClosingClosedAt(a)))?.getTime() ?? 0
              : 0
            const dateB = getClosingClosedAt(b)
              ? parseLocalAwareDate(String(getClosingClosedAt(b)))?.getTime() ?? 0
              : 0

            return dateB - dateA
          })[0] ?? null

      const sessionStartISO = getClosingClosedAt(lastClosingToday) || today.startISO

      const [orders, dayOrders] = await Promise.all([
        loadOrdersByRange(resolvedRestaurantId, sessionStartISO, today.endISO),
        loadOrdersByRange(resolvedRestaurantId, today.startISO, today.endISO),
      ])

      const [metrics, dayMetrics, orderItems] = await Promise.all([
        buildMetrics(resolvedRestaurantId, sessionStartISO, today.endISO, orders),
        buildMetrics(resolvedRestaurantId, today.startISO, today.endISO, dayOrders),
        loadOrderItemsByOrderIds(dayOrders.map((order) => order.id)),
      ])

      const todayClosedReceived = closingsToday.reduce(
        (sum, closing) => sum + getClosingReceived(closing),
        0
      )
      const todayClosedBalance = closingsToday.reduce(
        (sum, closing) => sum + getClosingBalance(closing),
        0
      )

      const customerKeys = new Set(
        dayOrders
          .filter((order) => getStatusBucket(order.status) !== "cancelled")
          .map(getCustomerKey)
          .filter(Boolean)
      )
      const itemAnalytics = buildItemAnalytics(orderItems)

      setData({
        sessionStartISO,
        ...metrics,
        todayClosedReceived,
        todayClosedBalance,
        dayTotalOrders: dayMetrics.totalOrders,
        dayPaidOrders: dayMetrics.paidOrders,
        dayPendingOrders: dayMetrics.pendingOrders,
        dayCancelledOrders: dayMetrics.cancelledOrders,
        dayDelayedOrders: dayMetrics.delayedOrders,
        dayPendingPixOrders: dayMetrics.pendingPixOrders,
        dayTotalSales: dayMetrics.totalSales,
        dayTotalReceived: dayMetrics.totalReceived,
        dayTotalPending: dayMetrics.totalPending,
        dayTotalExpenses: dayMetrics.totalExpenses,
        dayManualIncome: dayMetrics.manualIncome,
        dayEstimatedBalance: dayMetrics.estimatedBalance,
        dayUniqueCustomers: customerKeys.size,
        dayAverageTicket:
          dayMetrics.totalOrders > 0
            ? dayMetrics.totalSales / dayMetrics.totalOrders
            : 0,
        dayPaymentBreakdown: dayMetrics.paymentBreakdown,
        dayExpenses: dayMetrics.expenses,
        activityData: buildActivityData(dayOrders),
        topItems: itemAnalytics.topItems,
        upsellItems: itemAnalytics.upsellItems,
        upsellRevenue: itemAnalytics.upsellRevenue,
        upsellQuantity: itemAnalytics.upsellQuantity,
        orders,
        dayOrders,
        closingsToday,
        lastClosingToday,
        lastClosingOverall,
      })
    } catch (error) {
      console.error("Erro ao carregar gestão:", error)

      toast({
        title: "Erro ao carregar gestão",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o resumo do dia.",
        variant: "destructive",
      })

      setData(createEmptyCaixaData(today.startISO))
    } finally {
      setIsLoading(false)
    }
  }, [
    buildMetrics,
    ensurePreviousDayAutoClosing,
    loadOptionalRows,
    loadOrderItemsByOrderIds,
    loadOrdersByRange,
    resolveRestaurant,
    toast,
    today.dateKey,
    today.endISO,
    today.startISO,
  ])

  useEffect(() => {
    void loadGestao()
  }, [loadGestao])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const currentDateKey = getDayRange(0).dateKey

      if (currentDateKey !== today.dateKey) {
        window.location.reload()
      }
    }, 60_000)

    return () => window.clearInterval(interval)
  }, [today.dateKey])

  const countedCash = parseMoneyInput(closingForm.cash)
  const countedPix = parseMoneyInput(closingForm.pix)
  const countedCard = parseMoneyInput(closingForm.card)
  const countedOther = parseMoneyInput(closingForm.other)
  const countedReceived = countedCash + countedPix + countedCard + countedOther
  const receivedDifference = countedReceived - data.totalReceived
  const countedBalance = countedReceived - data.totalExpenses

  const activeOrders = useMemo(() => {
    return data.dayOrders
      .filter(isActiveOrder)
      .sort((a, b) => getOrderAgeMinutes(b.created_at) - getOrderAgeMinutes(a.created_at))
  }, [data.dayOrders])

  const averageActiveAge = useMemo(() => {
    if (activeOrders.length === 0) return 0

    return (
      activeOrders.reduce((sum, order) => sum + getOrderAgeMinutes(order.created_at), 0) /
      activeOrders.length
    )
  }, [activeOrders])

  const oldestActiveAge = activeOrders[0]
    ? getOrderAgeMinutes(activeOrders[0].created_at)
    : 0

  const peakActivity = useMemo(() => {
    return data.activityData.reduce<ActivityPoint | null>((current, point) => {
      if (!current) return point
      return point.orders > current.orders ? point : current
    }, null)
  }, [data.activityData])

  const paymentRows = useMemo(() => {
    const total = Object.values(data.dayPaymentBreakdown).reduce(
      (sum, value) => sum + value,
      0
    )

    return (Object.keys(data.dayPaymentBreakdown) as PaymentGroup[]).map((key) => ({
      key,
      label: paymentLabels[key],
      amount: data.dayPaymentBreakdown[key],
      percent: total > 0 ? Math.round((data.dayPaymentBreakdown[key] / total) * 100) : 0,
    }))
  }, [data.dayPaymentBreakdown])

  const sectorSummary = useMemo(
    () => [
      {
        title: "Financeiro",
        value: formatCurrency(data.dayEstimatedBalance),
        detail: `${formatCurrency(data.dayTotalReceived)} recebidos`,
        tone: data.dayEstimatedBalance >= 0 ? "green" : "red",
      },
      {
        title: "Vendas",
        value: formatCurrency(data.dayTotalSales),
        detail: `${data.dayTotalOrders} pedido(s), ticket ${formatCurrency(data.dayAverageTicket)}`,
        tone: "blue",
      },
      {
        title: "Operação",
        value: `${data.dayDelayedOrders}`,
        detail: `${activeOrders.length} pedido(s) ativos`,
        tone: data.dayDelayedOrders > 0 ? "red" : "slate",
      },
      {
        title: "Compras e saídas",
        value: formatCurrency(data.dayTotalExpenses),
        detail: `${data.dayExpenses.length} lançamento(s)`,
        tone: data.dayTotalExpenses > 0 ? "amber" : "slate",
      },
      {
        title: "Upsell",
        value: formatCurrency(data.upsellRevenue),
        detail: `${formatNumber(data.upsellQuantity)} item(ns)`,
        tone: data.upsellRevenue > 0 ? "green" : "slate",
      },
    ],
    [
      activeOrders.length,
      data.dayAverageTicket,
      data.dayDelayedOrders,
      data.dayEstimatedBalance,
      data.dayExpenses.length,
      data.dayTotalExpenses,
      data.dayTotalOrders,
      data.dayTotalReceived,
      data.dayTotalSales,
      data.upsellQuantity,
      data.upsellRevenue,
    ]
  )

  const filteredOrders = data.dayOrders.filter((order) => {
    const search = searchTerm.trim().toLowerCase()

    if (!search) return true

    return [
      order.public_order_number,
      order.customer_name,
      order.customer_phone,
      getPaymentMethodLabel(order.payment_method),
      getStatusLabel(order.status),
      getPaymentStatusLabel(order),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search))
  })

  const paymentTotal = paymentRows.reduce((sum, row) => sum + row.amount, 0)
  const pendingPixTotal = data.dayOrders
    .filter(isPendingPix)
    .reduce((sum, order) => sum + Number(order.total || 0), 0)
  const cancelledTotal = data.dayOrders
    .filter((order) => getStatusBucket(order.status) === "cancelled")
    .reduce((sum, order) => sum + Number(order.total || 0), 0)
  const upsellRate =
    data.dayTotalOrders > 0
      ? Math.round((data.upsellQuantity / data.dayTotalOrders) * 100)
      : 0
  const upsellTicket =
    data.upsellQuantity > 0 ? data.upsellRevenue / data.upsellQuantity : 0
  const upsellChampion = data.upsellItems[0]?.name || "-"
  const longestActiveOrder = activeOrders[0] ?? null

  const movementRows = [
    {
      label: "Vendas",
      value: formatCurrency(data.dayTotalSales),
      tone: "green",
    },
    {
      label: "Entradas manuais",
      value: formatCurrency(data.dayManualIncome),
      tone: "green",
    },
    {
      label: "Saídas / Despesas",
      value: `-${formatCurrency(data.dayTotalExpenses)}`,
      tone: "red",
    },
    {
      label: "Cancelamentos",
      value: `-${formatCurrency(cancelledTotal)}`,
      tone: "red",
    },
    {
      label: "Pix pendentes",
      value: formatCurrency(pendingPixTotal),
      tone: "amber",
    },
    {
      label: "Resultado do dia",
      value: formatCurrency(data.dayEstimatedBalance),
      tone: data.dayEstimatedBalance >= 0 ? "green" : "red",
      strong: true,
    },
  ]

  const attentionRows = [
    {
      title: `${data.dayDelayedOrders} pedido(s) atrasado(s)`,
      detail: "Precisam de atenção",
      value: data.dayDelayedOrders,
      tone: "red",
      icon: <Timer className="h-4 w-4" />,
    },
    {
      title: `${data.dayPendingPixOrders} Pix aguardando confirmação`,
      detail: `Total pendente: ${formatCurrency(pendingPixTotal)}`,
      value: data.dayPendingPixOrders,
      tone: "amber",
      icon: <Clock3 className="h-4 w-4" />,
    },
    {
      title: `${data.dayCancelledOrders} pedido(s) cancelado(s)`,
      detail: `Total cancelado: ${formatCurrency(cancelledTotal)}`,
      value: data.dayCancelledOrders,
      tone: "slate",
      icon: <X className="h-4 w-4" />,
    },
    {
      title: `${data.dayExpenses.length} saída(s) registrada(s)`,
      detail: `Total: ${formatCurrency(data.dayTotalExpenses)}`,
      value: data.dayExpenses.length,
      tone: "blue",
      icon: <TrendingDown className="h-4 w-4" />,
    },
    {
      title: longestActiveOrder
        ? `Pedido mais demorado #${
            longestActiveOrder.public_order_number ||
            longestActiveOrder.id.slice(0, 6)
          }`
        : "Nenhum pedido ativo",
      detail: longestActiveOrder
        ? formatMinutes(getOrderAgeMinutes(longestActiveOrder.created_at))
        : "Operação sem fila ativa",
      value: oldestActiveAge,
      tone: oldestActiveAge >= 50 ? "red" : "slate",
      icon: <BarChart3 className="h-4 w-4" />,
    },
  ]

  const closingRows = [
    {
      label: "Faturamento bruto",
      value: formatCurrency(data.dayTotalSales),
      tone: "white",
    },
    {
      label: "Total recebido",
      value: formatCurrency(data.dayTotalReceived),
      tone: "green",
    },
    {
      label: "Total pendente",
      value: formatCurrency(data.dayTotalPending),
      tone: "amber",
    },
    {
      label: "Total de saídas",
      value: formatCurrency(data.dayTotalExpenses),
      tone: "red",
    },
  ]

  const openClosingModal = () => {
    setClosingForm({
      cash: moneyToInput(data.paymentBreakdown.cash),
      pix: moneyToInput(data.paymentBreakdown.pix),
      card: moneyToInput(data.paymentBreakdown.card),
      other: moneyToInput(data.paymentBreakdown.other),
      notes: "",
    })
    setIsClosingModalOpen(true)
  }

  const handleSaveClosing = async () => {
    try {
      setIsClosing(true)

      const resolvedRestaurantId = await resolveRestaurant()
      const nowISO = new Date().toISOString()

      const payload = {
        restaurant_id: resolvedRestaurantId,
        closing_date: today.dateKey,
        opened_at: data.sessionStartISO,
        closed_at: nowISO,
        status: "closed",
        closing_type: "manual",
        total_sales: data.totalSales,
        total_received: data.totalReceived,
        total_pending: data.totalPending,
        total_expenses: data.totalExpenses,
        final_balance: countedBalance,
        pix_total: data.paymentBreakdown.pix,
        cash_total: data.paymentBreakdown.cash,
        card_total: data.paymentBreakdown.card,
        other_total: data.paymentBreakdown.other,
        counted_pix: countedPix,
        counted_cash: countedCash,
        counted_card: countedCard,
        counted_other: countedOther,
        counted_total: countedReceived,
        difference_amount: receivedDifference,
        notes: closingForm.notes.trim() || null,
      }

      const client = supabase as any
      const { error } = await client.from("cash_closings").insert(payload)

      if (error) throw error

      toast({
        title: "Dia fechado",
        description:
          "Fechamento salvo. A gestão foi atualizada para o próximo movimento.",
      })

      setIsClosingModalOpen(false)
      await loadGestao()
    } catch (error) {
      console.error("Erro ao fechar dia:", error)

      toast({
        title: "Erro ao fechar dia",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o fechamento.",
        variant: "destructive",
      })
    } finally {
      setIsClosing(false)
    }
  }

  return (
    <AdminLayout title="Gestão">
      <div className="space-y-4 text-slate-950">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-br from-white via-white to-slate-50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">
                    Gestão diária
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Caixa aberto
                  </span>
                </div>

                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  Gestão
                </h1>
                <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                  Resumo financeiro, pedidos, pagamentos e fechamento do dia em uma visão limpa.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 tabular-nums shadow-sm">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    {formatDate(today.start)}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 tabular-nums shadow-sm">
                    <Clock3 className="h-4 w-4 text-slate-400" />
                    Aberto desde {formatTime(data.sessionStartISO)}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 tabular-nums shadow-sm">
                    <ReceiptText className="h-4 w-4 text-slate-400" />
                    {data.closingsToday.length} fechamento(s) hoje
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadGestao()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Atualizar
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </button>

                <button
                  type="button"
                  onClick={openClosingModal}
                  disabled={isLoading}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Fechar dia
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
            <SmallTile
              label="Último fechamento"
              value={
                data.lastClosingOverall
                  ? formatDateTime(getClosingClosedAt(data.lastClosingOverall))
                  : "Nenhum"
              }
            />
            <SmallTile
              label="Já fechado hoje"
              value={formatCurrency(data.todayClosedReceived)}
              tone="green"
            />
            <SmallTile
              label="Saldo fechado"
              value={formatCurrency(data.todayClosedBalance)}
              tone={data.todayClosedBalance >= 0 ? "green" : "red"}
            />
            <SmallTile
              label="Resultado aberto"
              value={formatCurrency(data.estimatedBalance)}
              tone={data.estimatedBalance >= 0 ? "green" : "red"}
            />
          </div>
        </section>

        {isLoading ? (
          <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando gestão...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                title="Faturamento"
                value={formatCurrency(data.dayTotalSales)}
                subtitle={`${data.dayTotalOrders} pedido(s) hoje`}
                tone="blue"
                icon={<ReceiptText className="h-4 w-4" />}
              />

              <MetricCard
                title="Recebido"
                value={formatCurrency(data.dayTotalReceived)}
                subtitle={`${data.dayPaidOrders} pedido(s) pagos`}
                tone="green"
                icon={<Wallet className="h-4 w-4" />}
              />

              <MetricCard
                title="A receber"
                value={formatCurrency(data.dayTotalPending)}
                subtitle={`${data.dayPendingOrders} pedido(s) pendente(s)`}
                tone={data.dayTotalPending > 0 ? "amber" : "slate"}
                icon={<Clock3 className="h-4 w-4" />}
              />

              <MetricCard
                title="Pedidos"
                value={formatNumber(data.dayTotalOrders)}
                subtitle={`Ticket médio ${formatCurrency(data.dayAverageTicket)}`}
                tone="slate"
                icon={<ShoppingCart className="h-4 w-4" />}
              />

              <MetricCard
                title="Saídas"
                value={formatCurrency(data.dayTotalExpenses)}
                subtitle={`${data.dayExpenses.length} lançamento(s)`}
                tone={data.dayTotalExpenses > 0 ? "red" : "slate"}
                icon={<TrendingDown className="h-4 w-4" />}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
              <Panel
                title="Vendas por horário"
                subtitle="Leitura visual do movimento do dia. Alterne entre pedidos e faturamento."
                action={
                  peakActivity && peakActivity.orders > 0 ? (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold tabular-nums text-blue-700">
                      <BarChart3 className="h-4 w-4" />
                      Pico {peakActivity.hour}: {peakActivity.orders} pedido(s)
                    </div>
                  ) : null
                }
              >
                <ActivityChart data={data.activityData} />
              </Panel>

              <Panel
                title="Pagamentos"
                subtitle="Distribuição dos valores recebidos por forma de pagamento."
              >
                <PaymentDonut rows={paymentRows} total={paymentTotal} />
              </Panel>
            </section>

            <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr_1fr]">
              <Panel
                title="Operação em tempo real"
                subtitle="Fila ativa, tempo médio e pedidos que precisam de atenção."
              >
                <div className="grid gap-2 sm:grid-cols-3">
                  <SmallTile
                    label="Ativos"
                    value={`${activeOrders.length}`}
                    tone={activeOrders.length > 0 ? "blue" : "slate"}
                  />
                  <SmallTile
                    label="Média ativa"
                    value={formatMinutes(averageActiveAge)}
                    tone={averageActiveAge >= 30 ? "amber" : "slate"}
                  />
                  <SmallTile
                    label="Mais antigo"
                    value={formatMinutes(oldestActiveAge)}
                    tone={oldestActiveAge >= 50 ? "red" : "slate"}
                  />
                </div>

                <div className="mt-3 space-y-2">
                  {activeOrders.length === 0 ? (
                    <EmptyState message="Nenhum pedido em andamento." />
                  ) : (
                    activeOrders.slice(0, 5).map((order) => (
                      <div
                        key={order.id}
                        className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:bg-white hover:shadow-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold tabular-nums text-slate-950">
                            #{order.public_order_number || order.id.slice(0, 6)}
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-slate-500">
                            {getStatusLabel(order.status)} • {formatTime(order.created_at)}
                          </p>
                        </div>

                        <div className="inline-flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold tabular-nums text-slate-700 ring-1 ring-slate-200">
                          <Timer className="h-4 w-4 text-slate-400" />
                          {formatMinutes(getOrderAgeMinutes(order.created_at))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Panel>

              <Panel
                title="Alertas do dia"
                subtitle="Pontos que o dono precisa olhar antes de fechar."
              >
                <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                  {attentionRows.map((item) => (
                    <div
                      key={item.title}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-white px-3 py-3 transition hover:bg-slate-50"
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl",
                          item.tone === "red" && "bg-red-50 text-red-700",
                          item.tone === "amber" && "bg-orange-50 text-orange-700",
                          item.tone === "blue" && "bg-blue-50 text-blue-700",
                          item.tone === "slate" && "bg-slate-100 text-slate-600"
                        )}
                      >
                        {item.icon}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {item.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                          {item.detail}
                        </p>
                      </div>

                      <span
                        className={cn(
                          "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold tabular-nums",
                          item.tone === "red" && "bg-red-50 text-red-700 ring-1 ring-red-100",
                          item.tone === "amber" && "bg-orange-50 text-orange-700 ring-1 ring-orange-100",
                          item.tone === "blue" && "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
                          item.tone === "slate" && "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                        )}
                      >
                        {typeof item.value === "number"
                          ? formatNumber(item.value)
                          : item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel
                title="Fechamento"
                subtitle="Resumo limpo para conferir antes de encerrar o dia."
                id="fechamento-setor"
              >
                <div className="space-y-2">
                  {closingRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
                    >
                      <span className="font-semibold text-slate-600">{row.label}</span>
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          row.tone === "white" && "text-slate-950",
                          row.tone === "green" && "text-emerald-700",
                          row.tone === "amber" && "text-orange-700",
                          row.tone === "red" && "text-red-700"
                        )}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">
                        Resultado do dia
                      </p>
                      <p className="mt-1 text-xs font-medium text-emerald-700/80">
                        Recebido menos saídas
                      </p>
                    </div>
                    <span className="text-xl font-semibold tabular-nums text-emerald-700">
                      {formatCurrency(data.dayEstimatedBalance)}
                    </span>
                  </div>
                </div>
              </Panel>
            </section>

            <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Panel
                title="Movimentação financeira"
                subtitle="Entradas, saídas, pendências e resultado consolidado do dia."
              >
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid grid-cols-[1fr_auto] border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    <span>Descrição</span>
                    <span>Valor</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {movementRows.map((row) => (
                      <div
                        key={row.label}
                        className={cn(
                          "grid grid-cols-[1fr_auto] gap-3 px-3 py-3 text-sm",
                          row.strong && "bg-slate-50"
                        )}
                      >
                        <span
                          className={cn(
                            "font-semibold text-slate-600",
                            row.strong && "text-slate-950"
                          )}
                        >
                          {row.label}
                        </span>
                        <span
                          className={cn(
                            "font-semibold tabular-nums text-slate-950",
                            row.tone === "green" && "text-emerald-700",
                            row.tone === "red" && "text-red-700",
                            row.tone === "amber" && "text-orange-700"
                          )}
                        >
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel
                title="Setores do fechamento"
                subtitle="Visão separada por financeiro, vendas, operação, saídas e upsell."
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {sectorSummary.map((sector) => (
                    <div
                      key={sector.title}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                        {sector.title}
                      </p>
                      <p
                        className={cn(
                          "mt-2 truncate text-base font-semibold tabular-nums",
                          sector.tone === "green" && "text-emerald-700",
                          sector.tone === "red" && "text-red-700",
                          sector.tone === "amber" && "text-amber-700",
                          sector.tone === "blue" && "text-blue-700",
                          sector.tone === "slate" && "text-slate-950"
                        )}
                      >
                        {sector.value}
                      </p>
                      <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-slate-500">
                        {sector.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
              <Panel
                title="Itens vendidos"
                subtitle="Ranking dos produtos que movimentaram o caixa hoje."
              >
                {data.topItems.length === 0 ? (
                  <EmptyState message="Nenhum item vendido hoje." />
                ) : (
                  <div className="space-y-2">
                    {data.topItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 transition hover:bg-white hover:shadow-sm"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-xs font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {item.name}
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-slate-500">
                            {formatNumber(item.quantity)} un.
                          </p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums text-slate-950">
                          {formatCurrency(item.revenue)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="Upsell"
                subtitle="Adicionais, combos e itens vendidos por regra de upsell."
                action={
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold tabular-nums text-emerald-700">
                    {formatCurrency(data.upsellRevenue)}
                  </div>
                }
              >
                <div className="mb-3 grid gap-2 sm:grid-cols-3">
                  <SmallTile label="Itens" value={formatNumber(data.upsellQuantity)} tone="green" />
                  <SmallTile label="Taxa" value={`${upsellRate}%`} tone="green" />
                  <SmallTile label="Ticket" value={formatCurrency(upsellTicket)} tone="green" />
                </div>

                {data.upsellItems.length === 0 ? (
                  <EmptyState message="Nenhum item de upsell vendido hoje." />
                ) : (
                  <div className="space-y-2">
                    {data.upsellItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {item.name}
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-emerald-700">
                            {formatNumber(item.quantity)} item(ns)
                          </p>
                        </div>

                        <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700">
                          {formatCurrency(item.revenue)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  Item campeão: <span className="text-slate-950">{upsellChampion}</span>
                </div>
              </Panel>
            </section>

            <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <Panel
                title="Fechamentos de hoje"
                subtitle="Caixas já consolidados durante o dia."
              >
                {data.closingsToday.length === 0 ? (
                  <EmptyState message="Nenhum fechamento registrado hoje." />
                ) : (
                  <div className="space-y-2">
                    {data.closingsToday.map((closing, index) => (
                      <div
                        key={String(readString(closing, ["id"]) || index)}
                        className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_1fr]"
                      >
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                            Período
                          </p>
                          <p className="mt-1 text-sm font-semibold tabular-nums text-slate-950">
                            {formatTime(getClosingOpenedAt(closing))} até {formatTime(getClosingClosedAt(closing))}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                            Entrada
                          </p>
                          <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-700">
                            {formatCurrency(getClosingReceived(closing))}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                            Tipo
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-950">
                            {getClosingType(closing)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="Saídas e compras"
                subtitle="Despesas, compras, equipe, entregadores, perdas e lançamentos manuais."
              >
                {data.dayExpenses.length === 0 ? (
                  <EmptyState message="Nenhuma saída registrada hoje." />
                ) : (
                  <div className="space-y-2">
                    {data.dayExpenses.slice(0, 8).map((expense) => (
                      <div
                        key={`${expense.source}-${expense.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 transition hover:bg-white hover:shadow-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {expense.title}
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-slate-500">
                            {expense.source} • {formatTime(expense.paidAt)}
                          </p>
                        </div>

                        <p className="shrink-0 text-sm font-semibold tabular-nums text-red-600">
                          -{formatCurrency(expense.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </section>

            <Panel
              title="Pedidos do dia"
              subtitle="Pedidos usados na análise diária da gestão."
              action={
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar pedido..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              }
            >
              {filteredOrders.length === 0 ? (
                <EmptyState message="Nenhum pedido encontrado." />
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="hidden grid-cols-[120px_1fr_130px_130px_130px_110px] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 lg:grid">
                    <span>Pedido</span>
                    <span>Cliente</span>
                    <span>Pagamento</span>
                    <span>Status</span>
                    <span>Recebimento</span>
                    <span className="text-right">Total</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {filteredOrders.map((order) => (
                      <div
                        key={order.id}
                        className="grid gap-3 bg-white px-3 py-3 text-sm transition hover:bg-slate-50 lg:grid-cols-[120px_1fr_130px_130px_130px_110px] lg:items-center"
                      >
                        <div>
                          <p className="font-semibold tabular-nums text-slate-950">
                            #{order.public_order_number || order.id.slice(0, 6)}
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-slate-500">
                            {formatTime(order.created_at)}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">
                            {order.customer_name || "Cliente não informado"}
                          </p>
                        </div>

                        <div className="font-semibold text-slate-700">
                          {getPaymentMethodLabel(order.payment_method)}
                        </div>

                        <div>
                          <StatusBadge order={order} />
                        </div>

                        <div>
                          <PaymentBadge order={order} />
                        </div>

                        <div className="font-semibold tabular-nums text-slate-950 lg:text-right">
                          {formatCurrency(Number(order.total || 0))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </>
        )}
      </div>

      {isClosingModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Fechar dia
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Período aberto de {formatTime(data.sessionStartISO)} até agora.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsClosingModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid gap-2 sm:grid-cols-4">
                <SmallTile label="Vendas abertas" value={formatCurrency(data.totalSales)} />
                <SmallTile
                  label="Recebido aberto"
                  value={formatCurrency(data.totalReceived)}
                  tone="green"
                />
                <SmallTile
                  label="Saídas abertas"
                  value={formatCurrency(data.totalExpenses)}
                  tone={data.totalExpenses > 0 ? "red" : "slate"}
                />
                <SmallTile
                  label="Saldo aberto"
                  value={formatCurrency(data.estimatedBalance)}
                  tone={data.estimatedBalance >= 0 ? "green" : "red"}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                  Divisão por setor
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {sectorSummary.map((sector) => (
                    <div key={sector.title} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
                        {sector.title}
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-slate-950">
                        {sector.value}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-slate-500">
                        {sector.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <MoneyInput
                  label="Dinheiro contado"
                  value={closingForm.cash}
                  expected={data.paymentBreakdown.cash}
                  onChange={(value) =>
                    setClosingForm((prev) => ({ ...prev, cash: value }))
                  }
                />

                <MoneyInput
                  label="Pix conferido"
                  value={closingForm.pix}
                  expected={data.paymentBreakdown.pix}
                  onChange={(value) =>
                    setClosingForm((prev) => ({ ...prev, pix: value }))
                  }
                />

                <MoneyInput
                  label="Cartão conferido"
                  value={closingForm.card}
                  expected={data.paymentBreakdown.card}
                  onChange={(value) =>
                    setClosingForm((prev) => ({ ...prev, card: value }))
                  }
                />

                <MoneyInput
                  label="Outros conferido"
                  value={closingForm.other}
                  expected={data.paymentBreakdown.other}
                  onChange={(value) =>
                    setClosingForm((prev) => ({ ...prev, other: value }))
                  }
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <SmallTile
                  label="Total conferido"
                  value={formatCurrency(countedReceived)}
                />
                <SmallTile
                  label="Diferença"
                  value={formatCurrency(receivedDifference)}
                  tone={
                    receivedDifference === 0
                      ? "green"
                      : receivedDifference > 0
                        ? "blue"
                        : "red"
                  }
                />
                <SmallTile label="Saldo final" value={formatCurrency(countedBalance)} />
              </div>

              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                  Observação
                </span>
                <textarea
                  value={closingForm.notes}
                  onChange={(event) =>
                    setClosingForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Diferença, conferência ou observação interna"
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </label>

              {Math.abs(receivedDifference) > 0 && (
                <div className="flex gap-3 rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Existe diferença entre o valor esperado e o valor conferido.
                  Se estiver correto, salve com observação.
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white p-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsClosingModalOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void handleSaveClosing()}
                disabled={isClosing}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isClosing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Confirmar fechamento
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
