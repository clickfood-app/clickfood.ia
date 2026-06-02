"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  Loader2,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldCheck,
  TrendingDown,
  Wallet,
  X,
  Zap,
} from "lucide-react"

type OrderRow = {
  id: string
  public_order_number: string | null
  customer_name: string | null
  total: number | string | null
  created_at: string
  status: string | null
  payment_method: string | null
  payment_status: string | null
}

type PaymentGroup = "pix" | "cash" | "card" | "other"

type PaymentBreakdown = Record<PaymentGroup, number>

type FinancialRow = Record<string, unknown>
type CashClosingRow = Record<string, unknown>

type ExpenseItem = {
  id: string
  title: string
  source: string
  amount: number
  paidAt: string | null
}

type CaixaData = {
  sessionStartISO: string
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
  estimatedBalance: number
  todayClosedReceived: number
  todayClosedBalance: number
  paymentBreakdown: PaymentBreakdown
  orders: OrderRow[]
  expenses: ExpenseItem[]
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

function createEmptyCaixaData(sessionStartISO = new Date().toISOString()): CaixaData {
  return {
    sessionStartISO,
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
    estimatedBalance: 0,
    todayClosedReceived: 0,
    todayClosedBalance: 0,
    paymentBreakdown: { ...emptyBreakdown },
    orders: [],
    expenses: [],
    closingsToday: [],
    lastClosingToday: null,
    lastClosingOverall: null,
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatTime(value: string | null | undefined) {
  if (!value) return "-"

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function getLocalDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value
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

function readDateString(
  row: FinancialRow | null | undefined,
  fields: string[]
): string | null {
  const value = readString(row, fields)
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toISOString()
}

function isSameLocalDate(value: string | null | undefined, dateKey: string) {
  if (!value) return false

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false

  return getLocalDateKey(date) === dateKey
}

function isDateInsideRange(
  value: string | null | undefined,
  startISO: string,
  endISO: string
) {
  if (!value) return false

  const dateMs = new Date(value).getTime()
  const startMs = new Date(startISO).getTime()
  const endMs = new Date(endISO).getTime()

  if (Number.isNaN(dateMs)) return false

  return dateMs >= startMs && dateMs < endMs
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
  const created = new Date(createdAt).getTime()
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

function getFinancialRowDate(row: FinancialRow) {
  return readDateString(row, [
    "paid_at",
    "payment_date",
    "settled_at",
    "closed_at",
    "date",
    "created_at",
  ])
}

function getExpenseAmount(row: FinancialRow) {
  return readNumber(row, [
    "amount",
    "total_amount",
    "value",
    "total",
    "paid_amount",
    "settlement_amount",
  ])
}

function getExpenseTitle(row: FinancialRow, fallback: string) {
  return (
    readString(row, [
      "description",
      "title",
      "name",
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
  endISO: string
): ExpenseItem[] {
  return rows
    .filter((row) => isPaidFinancialRow(row))
    .filter((row) => isDateInsideRange(getFinancialRowDate(row), startISO, endISO))
    .map((row, index) => ({
      id: String(readString(row, ["id"]) || `${source}-${index}`),
      title: getExpenseTitle(row, fallbackTitle),
      source,
      amount: getExpenseAmount(row),
      paidAt: getFinancialRowDate(row),
    }))
    .filter((item) => item.amount > 0)
}

function getClosingClosedAt(row: CashClosingRow | null) {
  return readDateString(row, ["closed_at", "created_at", "updated_at"])
}

function getClosingOpenedAt(row: CashClosingRow | null) {
  return readDateString(row, ["opened_at", "created_at"])
}

function getClosingReceived(row: CashClosingRow | null) {
  return readNumber(row, ["total_received", "received_total", "received_amount"])
}

function getClosingBalance(row: CashClosingRow | null) {
  return readNumber(row, [
    "final_balance",
    "estimated_balance",
    "expected_balance",
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
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  }[tone]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
            {title}
          </p>
          <p className="mt-2 truncate text-2xl font-black tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            {subtitle}
          </p>
        </div>

        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
            toneClass
          )}
        >
          {icon}
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
}: {
  title: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-black tracking-tight text-slate-950">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm font-medium leading-5 text-slate-500">
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
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
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
    <label className="block rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <span className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
        <span className="text-slate-400">
          Esperado: {formatCurrency(expected)}
        </span>
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        placeholder="0,00"
        className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
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
    finished: "bg-slate-100 text-slate-700 ring-slate-200",
    cancelled: "bg-red-50 text-red-700 ring-red-100",
  }[bucket]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-black ring-1",
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
        "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-black ring-1",
        paid && "bg-emerald-50 text-emerald-700 ring-emerald-100",
        pendingPix && "bg-orange-50 text-orange-700 ring-orange-100",
        !paid && !pendingPix && "bg-slate-100 text-slate-700 ring-slate-200"
      )}
    >
      {getPaymentStatusLabel(order)}
    </span>
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
          .limit(2000)

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

  const loadOrdersByRange = useCallback(
    async (resolvedRestaurantId: string, startISO: string, endISO: string) => {
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(
          "id, public_order_number, customer_name, total, created_at, status, payment_method, payment_status"
        )
        .eq("restaurant_id", resolvedRestaurantId)
        .gte("created_at", startISO)
        .lt("created_at", endISO)
        .order("created_at", { ascending: false })

      if (ordersError) throw ordersError

      return (ordersData ?? []) as OrderRow[]
    },
    [supabase]
  )

  const buildMetrics = useCallback(
    async (
      resolvedRestaurantId: string,
      startISO: string,
      endISO: string,
      orders: OrderRow[]
    ) => {
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
      const totalReceived = paidOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      )
      const totalPending = pendingOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      )

      const [accountsPayableRows, deliverySettlementRows, staffPaymentRows] =
        await Promise.all([
          loadOptionalRows("accounts_payable", resolvedRestaurantId),
          loadOptionalRows("delivery_settlements", resolvedRestaurantId),
          loadOptionalRows("staff_payments", resolvedRestaurantId),
        ])

      const expenses = [
        ...normalizeExpenseRows(
          accountsPayableRows,
          "Contas a pagar",
          "Despesa paga",
          startISO,
          endISO
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
          "Funcionários",
          "Pagamento de funcionário",
          startISO,
          endISO
        ),
      ].sort((a, b) => {
        const dateA = a.paidAt ? new Date(a.paidAt).getTime() : 0
        const dateB = b.paidAt ? new Date(b.paidAt).getTime() : 0
        return dateB - dateA
      })

      const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0)

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
            ? new Date(String(getClosingClosedAt(a))).getTime()
            : 0
          const dateB = getClosingClosedAt(b)
            ? new Date(String(getClosingClosedAt(b))).getTime()
            : 0

          return dateB - dateA
        })

      const lastClosingToday = closingsToday[0] ?? null
      const lastClosingOverall =
        closingRows
          .slice()
          .sort((a, b) => {
            const dateA = getClosingClosedAt(a)
              ? new Date(String(getClosingClosedAt(a))).getTime()
              : 0
            const dateB = getClosingClosedAt(b)
              ? new Date(String(getClosingClosedAt(b))).getTime()
              : 0

            return dateB - dateA
          })[0] ?? null

      const sessionStartISO = getClosingClosedAt(lastClosingToday) || today.startISO

      const orders = await loadOrdersByRange(
        resolvedRestaurantId,
        sessionStartISO,
        today.endISO
      )

      const metrics = await buildMetrics(
        resolvedRestaurantId,
        sessionStartISO,
        today.endISO,
        orders
      )

      const todayClosedReceived = closingsToday.reduce(
        (sum, closing) => sum + getClosingReceived(closing),
        0
      )
      const todayClosedBalance = closingsToday.reduce(
        (sum, closing) => sum + getClosingBalance(closing),
        0
      )

      setData({
        sessionStartISO,
        ...metrics,
        orders,
        todayClosedReceived,
        todayClosedBalance,
        closingsToday,
        lastClosingToday,
        lastClosingOverall,
      })
    } catch (error) {
      console.error("Erro ao carregar caixa do dia:", error)

      toast({
        title: "Erro ao carregar gestão",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o caixa do dia.",
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

  const filteredOrders = data.orders.filter((order) => {
    const search = searchTerm.trim().toLowerCase()

    if (!search) return true

    return [
      order.public_order_number,
      order.customer_name,
      getPaymentMethodLabel(order.payment_method),
      getStatusLabel(order.status),
      getPaymentStatusLabel(order),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search))
  })

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
        title: "Caixa fechado",
        description:
          "Fechamento salvo. A tela foi zerada para o próximo movimento.",
      })

      setIsClosingModalOpen(false)
      await loadGestao()
    } catch (error) {
      console.error("Erro ao fechar caixa:", error)

      toast({
        title: "Erro ao fechar caixa",
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
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-600">
                Caixa do dia
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                Gestão / Caixa
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {formatDate(today.start)} • caixa aberto desde{" "}
                {formatTime(data.sessionStartISO)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 text-xs font-black text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Caixa aberto
              </div>

              <button
                type="button"
                onClick={() => void loadGestao()}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </button>

              <button
                type="button"
                onClick={openClosingModal}
                disabled={isLoading}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                Fechar caixa
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                Último fechamento
              </p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {data.lastClosingOverall
                  ? formatDateTime(getClosingClosedAt(data.lastClosingOverall))
                  : "Nenhum"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                Fechamentos hoje
              </p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {data.closingsToday.length}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                Já fechado hoje
              </p>
              <p className="mt-1 text-sm font-black text-emerald-700">
                {formatCurrency(data.todayClosedReceived)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                Saldo fechado hoje
              </p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {formatCurrency(data.todayClosedBalance)}
              </p>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando caixa...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                title="Vendas abertas"
                value={formatCurrency(data.totalSales)}
                subtitle={`${data.totalOrders} pedido(s) desde ${formatTime(data.sessionStartISO)}`}
                tone="blue"
                icon={<ReceiptText className="h-5 w-5" />}
              />

              <MetricCard
                title="Recebido aberto"
                value={formatCurrency(data.totalReceived)}
                subtitle={`${data.paidOrders} pedido(s) pagos`}
                tone="green"
                icon={<Wallet className="h-5 w-5" />}
              />

              <MetricCard
                title="Pendente"
                value={formatCurrency(data.totalPending)}
                subtitle={`${data.pendingOrders} pedido(s) a receber`}
                tone={data.totalPending > 0 ? "amber" : "slate"}
                icon={<Clock3 className="h-5 w-5" />}
              />

              <MetricCard
                title="Saídas abertas"
                value={formatCurrency(data.totalExpenses)}
                subtitle="Despesas após último fechamento"
                tone={data.totalExpenses > 0 ? "red" : "slate"}
                icon={<TrendingDown className="h-5 w-5" />}
              />

              <MetricCard
                title="Saldo aberto"
                value={formatCurrency(data.estimatedBalance)}
                subtitle="Recebido - saídas"
                tone={data.estimatedBalance >= 0 ? "green" : "red"}
                icon={<DollarSign className="h-5 w-5" />}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
              <Panel
                title="Recebimentos do caixa aberto"
                subtitle="Valores que ainda não foram fechados."
              >
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                      <Zap className="h-4 w-4 text-blue-600" />
                      Pix
                    </div>
                    <p className="mt-2 text-xl font-black text-slate-950">
                      {formatCurrency(data.paymentBreakdown.pix)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                      <Banknote className="h-4 w-4 text-emerald-600" />
                      Dinheiro
                    </div>
                    <p className="mt-2 text-xl font-black text-slate-950">
                      {formatCurrency(data.paymentBreakdown.cash)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                      <CreditCard className="h-4 w-4 text-orange-600" />
                      Cartão
                    </div>
                    <p className="mt-2 text-xl font-black text-slate-950">
                      {formatCurrency(data.paymentBreakdown.card)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                      <Wallet className="h-4 w-4 text-slate-600" />
                      Outros
                    </div>
                    <p className="mt-2 text-xl font-black text-slate-950">
                      {formatCurrency(data.paymentBreakdown.other)}
                    </p>
                  </div>
                </div>
              </Panel>

              <Panel
                title="Pendências"
                subtitle="Coisas que podem travar o fechamento."
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-orange-50 p-4 text-orange-700">
                    <div>
                      <p className="text-sm font-black">Pix pendentes</p>
                      <p className="text-xs font-semibold opacity-80">
                        Aguardando confirmação
                      </p>
                    </div>
                    <p className="text-2xl font-black">{data.pendingPixOrders}</p>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700">
                    <div>
                      <p className="text-sm font-black">Pedidos atrasados</p>
                      <p className="text-xs font-semibold opacity-80">
                        Precisam de atenção
                      </p>
                    </div>
                    <p className="text-2xl font-black">{data.delayedOrders}</p>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                    <div>
                      <p className="text-sm font-black">Cancelados</p>
                      <p className="text-xs font-semibold opacity-80">
                        Fora do caixa
                      </p>
                    </div>
                    <p className="text-2xl font-black">{data.cancelledOrders}</p>
                  </div>
                </div>
              </Panel>
            </section>

            <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <Panel
                title="Fechamentos de hoje"
                subtitle="Entradas já consolidadas para o resumo."
              >
                {data.closingsToday.length === 0 ? (
                  <EmptyState message="Nenhum caixa fechado hoje." />
                ) : (
                  <div className="space-y-2">
                    {data.closingsToday.map((closing, index) => (
                      <div
                        key={String(readString(closing, ["id"]) || index)}
                        className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_1fr]"
                      >
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                            Período
                          </p>
                          <p className="text-sm font-black text-slate-950">
                            {formatTime(getClosingOpenedAt(closing))} até{" "}
                            {formatTime(getClosingClosedAt(closing))}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                            Entrada
                          </p>
                          <p className="text-sm font-black text-emerald-700">
                            {formatCurrency(getClosingReceived(closing))}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                            Tipo
                          </p>
                          <p className="text-sm font-black text-slate-950">
                            {getClosingType(closing)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="Saídas do caixa aberto"
                subtitle="Despesas pagas depois do último fechamento."
              >
                {data.expenses.length === 0 ? (
                  <EmptyState message="Nenhuma saída neste caixa aberto." />
                ) : (
                  <div className="space-y-2">
                    {data.expenses.slice(0, 8).map((expense) => (
                      <div
                        key={`${expense.source}-${expense.id}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950">
                            {expense.title}
                          </p>
                          <p className="text-xs font-semibold text-slate-500">
                            {expense.source} • {formatTime(expense.paidAt)}
                          </p>
                        </div>

                        <p className="shrink-0 text-sm font-black text-red-600">
                          -{formatCurrency(expense.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </section>

            <Panel
              title="Pedidos do caixa aberto"
              subtitle="Pedidos desde o último fechamento."
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
                <EmptyState message="Nenhum pedido neste caixa aberto. Se você acabou de fechar, está certo: o caixa zerou." />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="hidden grid-cols-[120px_1fr_130px_130px_130px_110px] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-400 lg:grid">
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
                        className="grid gap-3 px-3 py-3 text-sm lg:grid-cols-[120px_1fr_130px_130px_130px_110px] lg:items-center"
                      >
                        <div>
                          <p className="font-black text-slate-950">
                            #{order.public_order_number || order.id.slice(0, 6)}
                          </p>
                          <p className="text-xs font-semibold text-slate-500">
                            {formatTime(order.created_at)}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-800">
                            {order.customer_name || "Cliente não informado"}
                          </p>
                        </div>

                        <div className="font-bold text-slate-700">
                          {getPaymentMethodLabel(order.payment_method)}
                        </div>

                        <div>
                          <StatusBadge order={order} />
                        </div>

                        <div>
                          <PaymentBadge order={order} />
                        </div>

                        <div className="font-black text-slate-950 lg:text-right">
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-4">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Fechar caixa
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Fechando período de {formatTime(data.sessionStartISO)} até agora.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsClosingModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Vendas
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatCurrency(data.totalSales)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Recebido
                  </p>
                  <p className="mt-1 text-lg font-black text-emerald-700">
                    {formatCurrency(data.totalReceived)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Saídas
                  </p>
                  <p className="mt-1 text-lg font-black text-red-700">
                    {formatCurrency(data.totalExpenses)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Saldo
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatCurrency(data.estimatedBalance)}
                  </p>
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

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Total conferido
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {formatCurrency(countedReceived)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Diferença
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-2xl font-black",
                      receivedDifference === 0
                        ? "text-emerald-700"
                        : receivedDifference > 0
                          ? "text-blue-700"
                          : "text-red-700"
                    )}
                  >
                    {formatCurrency(receivedDifference)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Saldo final
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {formatCurrency(countedBalance)}
                  </p>
                </div>
              </div>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
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
                  placeholder="Ex: diferença no dinheiro, maquininha pendente, caixa conferido por..."
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </label>

              {Math.abs(receivedDifference) > 0 && (
                <div className="flex gap-3 rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm font-semibold leading-6 text-orange-800">
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
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void handleSaveClosing()}
                disabled={isClosing}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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