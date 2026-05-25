"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  CreditCard,
  DollarSign,
  Loader2,
  ReceiptText,
  RefreshCcw,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"

type PeriodKey = "today" | "7d" | "30d" | "month"

type OrderRow = {
  id: string
  total: number | string | null
  created_at: string
  status: string | null
  payment_method: string | null
  payment_status: string | null
}

type RawOrderItem = Record<string, unknown>

type ProductRow = {
  id: string
  name: string
  price: number | string | null
  cost_price: number | string | null
  category_id: string | null
}

type CategoryRow = {
  id: string
  name: string
}

type FinancialTransaction = {
  id: string
  type: "income" | "expense"
  origin: string
  title: string
  description: string | null
  amount: number | string
  category: string | null
  payment_method: string | null
  occurred_at: string
}

type ProductLoss = {
  id: string
  product_id: string | null
  product_name: string
  quantity: number | string
  unit_cost: number | string
  total_cost: number | string
  reason: string
  notes: string | null
  occurred_at: string
}

type ProductFinance = {
  productId: string | null
  name: string
  category: string
  quantity: number
  revenue: number
  cost: number
  profit: number
  margin: number
}

type CategoryFinance = {
  category: string
  revenue: number
  cost: number
  profit: number
  cmv: number
}

type PaymentBreakdown = {
  label: string
  total: number
  count: number
}

type RevenuePoint = {
  date: string
  label: string
  total: number
}

type DashboardData = {
  grossRevenue: number
  ordersCount: number
  averageTicket: number
  manualIncome: number
  expenses: number
  losses: number
  productCost: number
  estimatedProfit: number
  cmv: number
  pixTotal: number
  cashTotal: number
  cardTotal: number
  productFinance: ProductFinance[]
  categoryFinance: CategoryFinance[]
  paymentBreakdown: PaymentBreakdown[]
  transactions: FinancialTransaction[]
  productLosses: ProductLoss[]
  revenueSeries: RevenuePoint[]
}

const emptyDashboard: DashboardData = {
  grossRevenue: 0,
  ordersCount: 0,
  averageTicket: 0,
  manualIncome: 0,
  expenses: 0,
  losses: 0,
  productCost: 0,
  estimatedProfit: 0,
  cmv: 0,
  pixTotal: 0,
  cashTotal: 0,
  cardTotal: 0,
  productFinance: [],
  categoryFinance: [],
  paymentBreakdown: [],
  transactions: [],
  productLosses: [],
  revenueSeries: [],
}

const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month", label: "Mês atual" },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getLocalDayRange(date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

function getPeriodStart(period: PeriodKey) {
  const date = new Date()

  if (period === "today") {
    date.setHours(0, 0, 0, 0)
    return date.toISOString()
  }

  if (period === "7d") {
    date.setDate(date.getDate() - 6)
    date.setHours(0, 0, 0, 0)
    return date.toISOString()
  }

  if (period === "30d") {
    date.setDate(date.getDate() - 29)
    date.setHours(0, 0, 0, 0)
    return date.toISOString()
  }

  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

function getPeriodLabel(period: PeriodKey) {
  return periodOptions.find((option) => option.key === period)?.label || "Hoje"
}

function isValidOrderForFinance(order: OrderRow) {
  const status = String(order.status || "").toLowerCase()
  const paymentMethod = String(order.payment_method || "").toLowerCase()
  const paymentStatus = String(order.payment_status || "").toLowerCase()

  const cancelledStatuses = [
    "cancelled",
    "canceled",
    "cancelado",
    "recusado",
    "refused",
  ]

  if (cancelledStatuses.includes(status)) return false

  if (paymentMethod === "pix") {
    return ["paid", "received", "confirmed"].includes(paymentStatus)
  }

  return true
}

function getPaymentLabel(paymentMethod: string | null) {
  const method = String(paymentMethod || "").toLowerCase()

  if (method === "pix") return "Pix"
  if (method === "cash" || method === "dinheiro") return "Dinheiro"
  if (method === "credit_card" || method === "credito") return "Crédito"
  if (method === "debit_card" || method === "debito") return "Débito"
  if (method === "card" || method === "cartao") return "Cartão"

  return paymentMethod || "Não informado"
}

function getPaymentBucket(paymentMethod: string | null) {
  const method = String(paymentMethod || "").toLowerCase()

  if (method === "pix") return "pix"
  if (method === "cash" || method === "dinheiro") return "cash"

  return "card"
}

function isCashClosingTransaction(transaction: FinancialTransaction) {
  const origin = String(transaction.origin || "").toLowerCase()
  const category = String(transaction.category || "").toLowerCase()
  const title = String(transaction.title || "").toLowerCase()

  return (
    origin === "cash_closing" ||
    category === "fechamento diário" ||
    title.startsWith("fechamento de caixa")
  )
}

function normalizeOrderItem(raw: RawOrderItem) {
  const productId =
    typeof raw.product_id === "string"
      ? raw.product_id
      : typeof raw.menu_item_id === "string"
        ? raw.menu_item_id
        : null

  const quantity = Number(raw.quantity || raw.qty || 1)

  const name =
    String(
      raw.product_name ||
        raw.menu_item_name ||
        raw.item_name ||
        raw.name ||
        "Produto sem nome"
    ) || "Produto sem nome"

  const unitPrice = Number(raw.unit_price || raw.price || 0)

  const total = Number(
    raw.total_price ||
      raw.subtotal ||
      raw.total ||
      raw.line_total ||
      unitPrice * quantity ||
      0
  )

  const orderId = String(raw.order_id || "")

  return {
    orderId,
    productId,
    name,
    quantity,
    total,
  }
}

function calculateMargin(revenue: number, profit: number) {
  if (revenue <= 0) return 0
  return (profit / revenue) * 100
}

function calculateCmv(revenue: number, cost: number) {
  if (revenue <= 0) return 0
  return (cost / revenue) * 100
}

function getSeriesDays(period: PeriodKey) {
  const today = new Date()
  const days =
    period === "today"
      ? 1
      : period === "7d"
        ? 7
        : period === "30d"
          ? 30
          : today.getDate()

  const start = new Date(today)

  if (period === "month") {
    start.setDate(1)
  } else {
    start.setDate(today.getDate() - days + 1)
  }

  start.setHours(0, 0, 0, 0)

  return Array.from({ length: days }).map((_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)

    return date
  })
}

function buildRevenueSeries(orders: OrderRow[], period: PeriodKey) {
  const days = getSeriesDays(period)
  const revenueByDate = new Map<string, number>()

  for (const day of days) {
    revenueByDate.set(getLocalDateString(day), 0)
  }

  for (const order of orders) {
    const orderDateKey = getLocalDateString(new Date(order.created_at))

    if (!revenueByDate.has(orderDateKey)) continue

    revenueByDate.set(
      orderDateKey,
      Number(revenueByDate.get(orderDateKey) || 0) + Number(order.total || 0)
    )
  }

  return days.map((day) => ({
    date: getLocalDateString(day),
    label: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }).format(day),
    total: Number(revenueByDate.get(getLocalDateString(day)) || 0),
  }))
}

function ProgressBar({
  value,
  max,
  tone = "blue",
}: {
  value: number
  max: number
  tone?: "blue" | "green" | "red" | "amber" | "slate"
}) {
  const width = max <= 0 ? 0 : Math.min(100, (value / max) * 100)

  const toneClass = {
    blue: "bg-blue-600",
    green: "bg-emerald-600",
    red: "bg-red-500",
    amber: "bg-amber-500",
    slate: "bg-slate-900",
  }[tone]

  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-700 ease-out",
          toneClass
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone = "blue",
  delay = 0,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  tone?: "blue" | "green" | "red" | "amber" | "slate"
  delay?: number
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    red: "bg-red-50 text-red-600 ring-red-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  }[tone]

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 truncate text-2xl font-black tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
            {subtitle}
          </p>
        </div>

        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1",
            toneClass
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

function FinanceCard({
  title,
  subtitle,
  icon,
  children,
  className,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-black tracking-tight text-slate-950">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-sm leading-5 text-slate-500">{subtitle}</p>
          )}
        </div>

        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  )
}

function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const maxValue = Math.max(...data.map((item) => item.total), 1)

  return (
    <div className="space-y-4">
      <div className="flex h-[240px] items-end gap-2 rounded-2xl bg-slate-50 px-4 pb-4 pt-6">
        {data.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-sm font-medium text-slate-400">
            Sem dados para montar o gráfico.
          </div>
        ) : (
          data.map((item, index) => {
            const height = Math.max(8, (item.total / maxValue) * 100)

            return (
              <div
                key={item.date}
                className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-2"
              >
                <div className="relative flex flex-1 items-end">
                  <div
                    className="w-full rounded-t-xl bg-gradient-to-t from-blue-600 to-blue-400 shadow-sm transition-all duration-700 ease-out group-hover:from-blue-700 group-hover:to-blue-500"
                    style={{
                      height: `${height}%`,
                      animationDelay: `${index * 60}ms`,
                    }}
                  />

                  <div className="pointer-events-none absolute -top-10 left-1/2 hidden -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 shadow-lg group-hover:block">
                    {formatCurrency(item.total)}
                  </div>
                </div>

                <p className="truncate text-center text-[10px] font-semibold text-slate-400">
                  {item.label}
                </p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-medium text-slate-500">
      {message}
    </div>
  )
}

function ReportLine({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "green" | "red" | "blue"
}) {
  const toneClass = {
    default: "text-slate-950",
    green: "text-emerald-600",
    red: "text-red-600",
    blue: "text-blue-700",
  }[tone]

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={cn("text-sm font-black", toneClass)}>{value}</p>
    </div>
  )
}

export default function FinanceiroPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const [period, setPeriod] = useState<PeriodKey>("today")
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData>(emptyDashboard)
  const [isLoading, setIsLoading] = useState(true)
  const [isClosingCash, setIsClosingCash] = useState(false)

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

  const loadFinanceiro = useCallback(async () => {
    try {
      setIsLoading(true)

      const resolvedRestaurantId = await resolveRestaurant()
      const startDate = getPeriodStart(period)
      const chartPeriod: PeriodKey = period === "today" ? "7d" : period
      const chartStartDate = getPeriodStart(chartPeriod)

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, total, created_at, status, payment_method, payment_status")
        .eq("restaurant_id", resolvedRestaurantId)
        .gte("created_at", startDate)
        .order("created_at", { ascending: true })

      if (ordersError) throw ordersError

      const { data: chartOrdersData, error: chartOrdersError } = await supabase
        .from("orders")
        .select("id, total, created_at, status, payment_method, payment_status")
        .eq("restaurant_id", resolvedRestaurantId)
        .gte("created_at", chartStartDate)
        .order("created_at", { ascending: true })

      if (chartOrdersError) throw chartOrdersError

      const validOrders = ((ordersData ?? []) as OrderRow[]).filter(
        isValidOrderForFinance
      )

      const validChartOrders = ((chartOrdersData ?? []) as OrderRow[]).filter(
        isValidOrderForFinance
      )

      const orderIds = validOrders.map((order) => order.id)

      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, price, cost_price, category_id")
        .eq("restaurant_id", resolvedRestaurantId)

      if (productsError) throw productsError

      const productRows = (productsData ?? []) as ProductRow[]

      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("id, name")
        .eq("restaurant_id", resolvedRestaurantId)

      if (categoriesError) throw categoriesError

      const categoryRows = (categoriesData ?? []) as CategoryRow[]

      let orderItems: RawOrderItem[] = []

      if (orderIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", orderIds)

        if (itemsError) throw itemsError

        orderItems = (itemsData ?? []) as RawOrderItem[]
      }

      const { data: transactionsData, error: transactionsError } = await supabase
        .from("financial_transactions")
        .select(
          "id, type, origin, title, description, amount, category, payment_method, occurred_at"
        )
        .eq("restaurant_id", resolvedRestaurantId)
        .gte("occurred_at", startDate)
        .order("occurred_at", { ascending: false })

      if (transactionsError) throw transactionsError

      const { data: lossesData, error: lossesError } = await supabase
        .from("product_losses")
        .select(
          "id, product_id, product_name, quantity, unit_cost, total_cost, reason, notes, occurred_at"
        )
        .eq("restaurant_id", resolvedRestaurantId)
        .gte("occurred_at", startDate)
        .order("occurred_at", { ascending: false })

      if (lossesError) throw lossesError

      const transactions = (transactionsData ?? []) as FinancialTransaction[]
      const productLosses = (lossesData ?? []) as ProductLoss[]

      const productsById = new Map(productRows.map((product) => [product.id, product]))
      const categoriesById = new Map(
        categoryRows.map((category) => [category.id, category.name])
      )

      const grossRevenue = validOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      )

      const ordersCount = validOrders.length
      const averageTicket = ordersCount > 0 ? grossRevenue / ordersCount : 0

      const manualIncome = transactions
        .filter(
          (transaction) =>
            transaction.type === "income" && !isCashClosingTransaction(transaction)
        )
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)

      const expenses = transactions
        .filter((transaction) => transaction.type === "expense")
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)

      const losses = productLosses.reduce(
        (sum, loss) => sum + Number(loss.total_cost || 0),
        0
      )

      const productFinanceMap = new Map<string, ProductFinance>()

      for (const rawItem of orderItems) {
        const item = normalizeOrderItem(rawItem)
        const product = item.productId ? productsById.get(item.productId) : null

        const productName = product?.name || item.name
        const productCost = Number(product?.cost_price || 0) * item.quantity
        const productRevenue =
          item.total > 0 ? item.total : Number(product?.price || 0) * item.quantity

        const categoryName =
          product?.category_id && categoriesById.get(product.category_id)
            ? String(categoriesById.get(product.category_id))
            : "Sem categoria"

        const key = item.productId || productName

        const current =
          productFinanceMap.get(key) ??
          ({
            productId: item.productId,
            name: productName,
            category: categoryName,
            quantity: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
            margin: 0,
          } satisfies ProductFinance)

        current.quantity += item.quantity
        current.revenue += productRevenue
        current.cost += productCost
        current.profit = current.revenue - current.cost
        current.margin = calculateMargin(current.revenue, current.profit)

        productFinanceMap.set(key, current)
      }

      const productFinance = Array.from(productFinanceMap.values()).sort(
        (a, b) => b.profit - a.profit
      )

      const productCost = productFinance.reduce((sum, item) => sum + item.cost, 0)

      const categoryFinanceMap = new Map<string, CategoryFinance>()

      for (const product of productFinance) {
        const current =
          categoryFinanceMap.get(product.category) ??
          ({
            category: product.category,
            revenue: 0,
            cost: 0,
            profit: 0,
            cmv: 0,
          } satisfies CategoryFinance)

        current.revenue += product.revenue
        current.cost += product.cost
        current.profit = current.revenue - current.cost
        current.cmv = calculateCmv(current.revenue, current.cost)

        categoryFinanceMap.set(product.category, current)
      }

      const categoryFinance = Array.from(categoryFinanceMap.values()).sort(
        (a, b) => b.cost - a.cost
      )

      const paymentMap = new Map<string, PaymentBreakdown>()

      let pixTotal = 0
      let cashTotal = 0
      let cardTotal = 0

      for (const order of validOrders) {
        const total = Number(order.total || 0)
        const label = getPaymentLabel(order.payment_method)
        const bucket = getPaymentBucket(order.payment_method)

        if (bucket === "pix") pixTotal += total
        if (bucket === "cash") cashTotal += total
        if (bucket === "card") cardTotal += total

        const current =
          paymentMap.get(label) ??
          ({
            label,
            total: 0,
            count: 0,
          } satisfies PaymentBreakdown)

        current.total += total
        current.count += 1

        paymentMap.set(label, current)
      }

      const estimatedProfit =
        grossRevenue + manualIncome - expenses - losses - productCost

      const cmv = calculateCmv(grossRevenue, productCost)

      setData({
        grossRevenue,
        ordersCount,
        averageTicket,
        manualIncome,
        expenses,
        losses,
        productCost,
        estimatedProfit,
        cmv,
        pixTotal,
        cashTotal,
        cardTotal,
        productFinance,
        categoryFinance,
        paymentBreakdown: Array.from(paymentMap.values()).sort(
          (a, b) => b.total - a.total
        ),
        transactions,
        productLosses,
        revenueSeries: buildRevenueSeries(validChartOrders, chartPeriod),
      })
    } catch (error) {
      console.error("Erro ao carregar financeiro:", error)

      toast({
        title: "Erro ao carregar financeiro",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os dados financeiros.",
        variant: "destructive",
      })

      setData(emptyDashboard)
    } finally {
      setIsLoading(false)
    }
  }, [period, resolveRestaurant, supabase, toast])

  useEffect(() => {
    void loadFinanceiro()
  }, [loadFinanceiro])

  const closeCashToday = async () => {
    try {
      if (period !== "today") return

      const resolvedRestaurantId = await resolveRestaurant()
      const closingDate = getLocalDateString()
      const { startIso, endIso } = getLocalDayRange()

      setIsClosingCash(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from("cash_closings").upsert(
        {
          restaurant_id: resolvedRestaurantId,
          closing_date: closingDate,
          gross_revenue: data.grossRevenue,
          manual_income: data.manualIncome,
          expenses: data.expenses,
          losses: data.losses,
          product_cost: data.productCost,
          estimated_profit: data.estimatedProfit,
          pix_total: data.pixTotal,
          cash_total: data.cashTotal,
          card_total: data.cardTotal,
          orders_count: data.ordersCount,
          average_ticket: data.averageTicket,
          closed_by: user?.id ?? null,
          closed_at: new Date().toISOString(),
        },
        {
          onConflict: "restaurant_id,closing_date",
        }
      )

      if (error) throw error

      const title = `Fechamento de caixa - ${new Intl.DateTimeFormat("pt-BR").format(
        new Date()
      )}`

      const description = [
        "Lançamento automático gerado ao fechar o caixa.",
        `Pix: ${formatCurrency(data.pixTotal)}.`,
        `Dinheiro: ${formatCurrency(data.cashTotal)}.`,
        `Cartão: ${formatCurrency(data.cardTotal)}.`,
        `Pedidos: ${data.ordersCount}.`,
      ].join(" ")

      const { data: existingTransaction, error: existingTransactionError } =
        await supabase
          .from("financial_transactions")
          .select("id")
          .eq("restaurant_id", resolvedRestaurantId)
          .eq("type", "income")
          .eq("category", "Fechamento diário")
          .gte("occurred_at", startIso)
          .lt("occurred_at", endIso)
          .limit(1)
          .maybeSingle()

      if (existingTransactionError) throw existingTransactionError

      const transactionPayload = {
        restaurant_id: resolvedRestaurantId,
        type: "income" as const,
        origin: "cash_closing",
        title,
        description,
        amount: data.grossRevenue,
        category: "Fechamento diário",
        payment_method: "Misto",
        occurred_at: new Date().toISOString(),
      }

      const transactionRequest = existingTransaction?.id
        ? supabase
            .from("financial_transactions")
            .update(transactionPayload)
            .eq("id", existingTransaction.id)
            .eq("restaurant_id", resolvedRestaurantId)
        : supabase.from("financial_transactions").insert(transactionPayload)

      const { error: transactionError } = await transactionRequest

      if (transactionError) throw transactionError

      await loadFinanceiro()

      toast({
        title: "Caixa fechado",
        description:
          "O fechamento de hoje foi salvo e lançado como entrada automática.",
      })
    } catch (error) {
      console.error("Erro ao fechar caixa:", error)

      toast({
        title: "Erro ao fechar caixa",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível fechar o caixa.",
        variant: "destructive",
      })
    } finally {
      setIsClosingCash(false)
    }
  }

  const cashBalance = data.grossRevenue + data.manualIncome - data.expenses - data.losses

  const pixPercentage =
    data.grossRevenue > 0 ? Math.round((data.pixTotal / data.grossRevenue) * 100) : 0

  const expensePercentage =
    data.grossRevenue > 0
      ? Math.round(((data.expenses + data.losses) / data.grossRevenue) * 100)
      : 0

  const bestPaymentMethod = data.paymentBreakdown[0]

  const insightItems = [
    data.grossRevenue > 0
      ? `Pix representa ${pixPercentage}% do faturamento do período.`
      : "Ainda não há faturamento registrado nesse período.",
    data.ordersCount > 0
      ? `Ticket médio atual: ${formatCurrency(data.averageTicket)}.`
      : "Quando os pedidos entrarem, o ticket médio aparecerá aqui.",
    data.expenses + data.losses > 0
      ? `Saídas e perdas representam ${expensePercentage}% do faturamento.`
      : "Nenhuma saída ou perda registrada nesse período.",
    bestPaymentMethod
      ? `${bestPaymentMethod.label} é a forma de pagamento mais usada no período.`
      : "As formas de pagamento aparecerão conforme os pedidos forem pagos.",
  ]

  return (
    <AdminLayout title="Finanças">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Finanças
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Controle rápido do dinheiro do restaurante.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {periodOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setPeriod(option.key)}
                className={cn(
                  "h-10 rounded-xl px-4 text-sm font-bold transition",
                  period === option.key
                    ? "bg-slate-950 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                {option.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => void loadFinanceiro()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando finanças...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Faturamento"
                value={formatCurrency(data.grossRevenue)}
                subtitle={`${getPeriodLabel(period)} • pedidos pagos/válidos`}
                tone="blue"
                delay={0}
                icon={<DollarSign className="h-5 w-5" />}
              />

              <MetricCard
                title="Pedidos pagos"
                value={String(data.ordersCount)}
                subtitle="Pedidos considerados no financeiro"
                tone="slate"
                delay={70}
                icon={<ShoppingCart className="h-5 w-5" />}
              />

              <MetricCard
                title="Ticket médio"
                value={formatCurrency(data.averageTicket)}
                subtitle="Média por pedido confirmado"
                tone="green"
                delay={140}
                icon={<TrendingUp className="h-5 w-5" />}
              />

              <MetricCard
                title="Saldo estimado"
                value={formatCurrency(cashBalance)}
                subtitle="Entradas menos saídas e perdas"
                tone={cashBalance >= 0 ? "green" : "red"}
                delay={210}
                icon={<Wallet className="h-5 w-5" />}
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
              <FinanceCard
                title="Evolução do faturamento"
                subtitle={
                  period === "today"
                    ? "Comparativo visual dos últimos 7 dias"
                    : `Movimento financeiro em ${getPeriodLabel(period).toLowerCase()}`
                }
                icon={<TrendingUp className="h-5 w-5" />}
              >
                <RevenueChart data={data.revenueSeries} />
              </FinanceCard>

              <FinanceCard
                title="Formas de pagamento"
                subtitle="Resumo por método recebido"
                icon={<CreditCard className="h-5 w-5" />}
              >
                <div className="space-y-4">
                  {data.paymentBreakdown.length === 0 ? (
                    <EmptyState message="Nenhum pagamento no período." />
                  ) : (
                    data.paymentBreakdown.map((payment) => (
                      <div key={payment.label}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-800">
                              {payment.label}
                            </p>
                            <p className="text-xs font-medium text-slate-500">
                              {payment.count} pedido(s)
                            </p>
                          </div>

                          <p className="text-sm font-black text-slate-950">
                            {formatCurrency(payment.total)}
                          </p>
                        </div>

                        <ProgressBar
                          value={payment.total}
                          max={data.grossRevenue}
                          tone={
                            payment.label.toLowerCase().includes("pix")
                              ? "green"
                              : "blue"
                          }
                        />
                      </div>
                    ))
                  )}
                </div>
              </FinanceCard>
            </section>

            <section className="grid gap-5 xl:grid-cols-3">
              <FinanceCard
                title="Entradas e saídas recentes"
                subtitle="Últimos lançamentos manuais"
                icon={<ReceiptText className="h-5 w-5" />}
                className="xl:col-span-1"
              >
                <div className="space-y-2">
                  {data.transactions.length === 0 ? (
                    <EmptyState message="Nenhum lançamento manual nesse período." />
                  ) : (
                    data.transactions.slice(0, 6).map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-800">
                            {transaction.title}
                          </p>

                          <p className="mt-1 truncate text-xs font-medium text-slate-500">
                            {transaction.category || "Sem categoria"} •{" "}
                            {formatDateTime(transaction.occurred_at)}
                          </p>
                        </div>

                        <p
                          className={cn(
                            "shrink-0 text-sm font-black",
                            transaction.type === "income"
                              ? "text-emerald-600"
                              : "text-red-600"
                          )}
                        >
                          {transaction.type === "income" ? "+" : "-"}
                          {formatCurrency(Number(transaction.amount || 0))}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </FinanceCard>

              <FinanceCard
                title="Resumo do período"
                subtitle="Visão limpa dos principais números"
                icon={<Banknote className="h-5 w-5" />}
                className="xl:col-span-1"
              >
                <div className="rounded-xl bg-slate-50 p-4">
                  <ReportLine
                    label="Faturamento bruto"
                    value={formatCurrency(data.grossRevenue)}
                  />
                  <ReportLine
                    label="Entradas manuais"
                    value={formatCurrency(data.manualIncome)}
                    tone="green"
                  />
                  <ReportLine
                    label="Saídas/despesas"
                    value={`-${formatCurrency(data.expenses)}`}
                    tone="red"
                  />
                  <ReportLine
                    label="Perdas registradas"
                    value={`-${formatCurrency(data.losses)}`}
                    tone="red"
                  />
                  <ReportLine
                    label="Custo dos produtos"
                    value={`-${formatCurrency(data.productCost)}`}
                    tone="red"
                  />
                  <ReportLine label="CMV estimado" value={`${data.cmv.toFixed(1)}%`} />
                  <ReportLine
                    label="Resultado estimado"
                    value={formatCurrency(data.estimatedProfit)}
                    tone={data.estimatedProfit >= 0 ? "blue" : "red"}
                  />
                </div>
              </FinanceCard>

              <FinanceCard
                title="Insights financeiros"
                subtitle="Leitura rápida do momento"
                icon={<Sparkles className="h-5 w-5" />}
                className="xl:col-span-1"
              >
                <div className="space-y-3">
                  {insightItems.map((item, index) => (
                    <div
                      key={item}
                      className="flex gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                          index === 0
                            ? "bg-blue-50 text-blue-600"
                            : index === 1
                              ? "bg-emerald-50 text-emerald-600"
                              : index === 2
                                ? "bg-amber-50 text-amber-600"
                                : "bg-slate-100 text-slate-700"
                        )}
                      >
                        {index === 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : index === 1 ? (
                          <Wallet className="h-4 w-4" />
                        ) : index === 2 ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : (
                          <CreditCard className="h-4 w-4" />
                        )}
                      </div>

                      <p className="text-sm font-medium leading-5 text-slate-600">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </FinanceCard>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
              <FinanceCard
                title="Fechamento diário"
                subtitle="Salve o resumo do caixa de hoje"
                icon={<CalendarCheck className="h-5 w-5" />}
              >
                <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Pix</p>
                    <p className="mt-1 text-sm font-black text-slate-950">
                      {formatCurrency(data.pixTotal)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-500">Dinheiro</p>
                    <p className="mt-1 text-sm font-black text-slate-950">
                      {formatCurrency(data.cashTotal)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-500">Cartão</p>
                    <p className="mt-1 text-sm font-black text-slate-950">
                      {formatCurrency(data.cardTotal)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void closeCashToday()}
                  disabled={period !== "today" || isClosingCash}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isClosingCash ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CalendarCheck className="h-4 w-4" />
                  )}

                  {period === "today"
                    ? "Fechar caixa de hoje"
                    : "Use o filtro Hoje para fechar"}
                </button>
              </FinanceCard>

              <FinanceCard
                title="Leitura do caixa"
                subtitle="Resumo rápido para bater o olho"
                icon={<ArrowUpRight className="h-5 w-5" />}
              >
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <ArrowUpRight className="h-4 w-4" />
                      <p className="text-xs font-black uppercase tracking-wide">
                        Entradas
                      </p>
                    </div>

                    <p className="mt-3 text-xl font-black text-emerald-700">
                      {formatCurrency(data.grossRevenue + data.manualIncome)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-red-50 p-4">
                    <div className="flex items-center gap-2 text-red-700">
                      <ArrowDownLeft className="h-4 w-4" />
                      <p className="text-xs font-black uppercase tracking-wide">
                        Saídas
                      </p>
                    </div>

                    <p className="mt-3 text-xl font-black text-red-700">
                      {formatCurrency(data.expenses + data.losses)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-blue-50 p-4">
                    <div className="flex items-center gap-2 text-blue-700">
                      <Wallet className="h-4 w-4" />
                      <p className="text-xs font-black uppercase tracking-wide">
                        Saldo
                      </p>
                    </div>

                    <p className="mt-3 text-xl font-black text-blue-700">
                      {formatCurrency(cashBalance)}
                    </p>
                  </div>
                </div>
              </FinanceCard>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  )
}