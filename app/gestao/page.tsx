"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import {
  ArrowUpRight,
  BarChart3,
  Clock3,
  DollarSign,
  Flame,
  Loader2,
  Package,
  RefreshCcw,
  ShoppingCart,
  TrendingUp,
  Trophy,
} from "lucide-react"

type PeriodKey = "7d" | "30d" | "60d"

type ProductMetric = {
  name: string
  total: number
}

type SeriesMetric = {
  label: string
  total: number
}

type DashboardData = {
  revenue: number
  orders: number
  averageTicket: number
  bestProduct: string
  bestProductUnits: number
  topHour: string
  topProducts: ProductMetric[]
  revenueSeries: SeriesMetric[]
  ordersSeries: SeriesMetric[]
  orderHeatmap: SeriesMetric[]
  revenueTrend: number | null
  ordersTrend: number | null
  ticketTrend: number | null
}

type OrderRow = {
  id: string
  total: number | string | null
  created_at: string
  status: string | null
  payment_method: string | null
  payment_status: string | null
}

type OrderItemRow = {
  order_id: string
  product_name: string | null
  quantity: number | string | null
}

const emptyDashboard: DashboardData = {
  revenue: 0,
  orders: 0,
  averageTicket: 0,
  bestProduct: "-",
  bestProductUnits: 0,
  topHour: "-",
  topProducts: [],
  revenueSeries: [],
  ordersSeries: [],
  orderHeatmap: [],
  revenueTrend: null,
  ordersTrend: null,
  ticketTrend: null,
}

const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "60d", label: "60 dias" },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "Sem histórico"

  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

function getPeriodDays(period: PeriodKey) {
  if (period === "7d") return 7
  if (period === "30d") return 30
  return 60
}

function getPeriodStart(period: PeriodKey) {
  const now = new Date()
  now.setDate(now.getDate() - (getPeriodDays(period) - 1))
  now.setHours(0, 0, 0, 0)

  return now.toISOString()
}

function isValidOrderForDashboard(order: OrderRow) {
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

  if (cancelledStatuses.includes(status)) {
    return false
  }

  if (paymentMethod === "pix") {
    return ["paid", "received", "confirmed"].includes(paymentStatus)
  }

  return true
}

function calculateTrend(values: number[]) {
  if (values.length < 2) return null

  const midpoint = Math.ceil(values.length / 2)
  const firstHalf = values.slice(0, midpoint).reduce((sum, value) => sum + value, 0)
  const secondHalf = values.slice(midpoint).reduce((sum, value) => sum + value, 0)

  if (firstHalf === 0 && secondHalf === 0) return null
  if (firstHalf === 0) return 100

  return ((secondHalf - firstHalf) / firstHalf) * 100
}

function calculateTicketTrend(orders: OrderRow[]) {
  if (orders.length < 2) return null

  const sortedOrders = [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const midpoint = Math.ceil(sortedOrders.length / 2)
  const firstHalf = sortedOrders.slice(0, midpoint)
  const secondHalf = sortedOrders.slice(midpoint)

  const firstAverage =
    firstHalf.length > 0
      ? firstHalf.reduce((sum, order) => sum + Number(order.total || 0), 0) /
        firstHalf.length
      : 0

  const secondAverage =
    secondHalf.length > 0
      ? secondHalf.reduce((sum, order) => sum + Number(order.total || 0), 0) /
        secondHalf.length
      : 0

  if (firstAverage === 0 && secondAverage === 0) return null
  if (firstAverage === 0) return 100

  return ((secondAverage - firstAverage) / firstAverage) * 100
}

function buildRevenueSeries(orders: OrderRow[], period: PeriodKey): SeriesMetric[] {
  const days = getPeriodDays(period)

  if (period === "7d") {
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    })

    const labels: string[] = []
    const grouped = new Map<string, number>()

    for (let index = days - 1; index >= 0; index--) {
      const date = new Date()
      date.setDate(date.getDate() - index)

      const label = formatter.format(date)
      labels.push(label)
      grouped.set(label, 0)
    }

    for (const order of orders) {
      const label = formatter.format(new Date(order.created_at))
      grouped.set(label, (grouped.get(label) ?? 0) + Number(order.total || 0))
    }

    return labels.map((label) => ({
      label,
      total: grouped.get(label) ?? 0,
    }))
  }

  const weeks = Math.ceil(days / 7)
  const labels = Array.from({ length: weeks }, (_, index) => `Sem ${index + 1}`)
  const grouped = new Map<string, number>(labels.map((label) => [label, 0]))
  const startDate = new Date(getPeriodStart(period)).getTime()

  for (const order of orders) {
    const orderDate = new Date(order.created_at).getTime()
    const diffDays = Math.max(0, Math.floor((orderDate - startDate) / 86400000))
    const weekIndex = Math.min(Math.floor(diffDays / 7), weeks - 1)
    const label = labels[weekIndex]

    grouped.set(label, (grouped.get(label) ?? 0) + Number(order.total || 0))
  }

  return labels.map((label) => ({
    label,
    total: grouped.get(label) ?? 0,
  }))
}

function buildOrdersSeries(orders: OrderRow[], period: PeriodKey): SeriesMetric[] {
  const revenueSeries = buildRevenueSeries(
    orders.map((order) => ({
      ...order,
      total: 1,
    })),
    period
  )

  return revenueSeries
}

function buildHeatmap(orders: OrderRow[]) {
  const buckets = [
    { label: "00h - 10h", match: (hour: number) => hour < 10 },
    { label: "10h - 12h", match: (hour: number) => hour >= 10 && hour < 12 },
    { label: "12h - 15h", match: (hour: number) => hour >= 12 && hour < 15 },
    { label: "15h - 18h", match: (hour: number) => hour >= 15 && hour < 18 },
    { label: "18h - 21h", match: (hour: number) => hour >= 18 && hour < 21 },
    { label: "21h - 00h", match: (hour: number) => hour >= 21 },
  ]

  const grouped = new Map<string, number>(buckets.map((bucket) => [bucket.label, 0]))

  for (const order of orders) {
    const hour = new Date(order.created_at).getHours()
    const matchedBucket = buckets.find((bucket) => bucket.match(hour))

    if (matchedBucket) {
      grouped.set(matchedBucket.label, (grouped.get(matchedBucket.label) ?? 0) + 1)
    }
  }

  return buckets.map((bucket) => ({
    label: bucket.label,
    total: grouped.get(bucket.label) ?? 0,
  }))
}

function PeriodButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-10 rounded-lg px-4 text-sm font-bold transition",
        active
          ? "bg-slate-950 text-white shadow-sm"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      ].join(" ")}
    >
      {label}
    </button>
  )
}

function TrendPill({ value }: { value: number | null }) {
  const isPositive = (value ?? 0) >= 0

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
        value === null
          ? "bg-slate-100 text-slate-500"
          : isPositive
            ? "bg-emerald-50 text-emerald-700"
            : "bg-red-50 text-red-600",
      ].join(" ")}
    >
      {formatPercent(value)}
    </span>
  )
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string
  value: string
  subtitle: string
  icon: ReactNode
  trend?: number | null
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 truncate text-2xl font-black tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-2 text-sm leading-5 text-slate-500">{subtitle}</p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
          {icon}
        </div>
      </div>

      {trend !== undefined && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <TrendPill value={trend} />
          <span className="text-xs font-medium text-slate-400">comparação interna</span>
        </div>
      )}
    </div>
  )
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        {icon}
      </div>

      <div>
        <h2 className="text-base font-black text-slate-950">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  )
}

function RevenueChart({
  data,
  total,
}: {
  data: SeriesMetric[]
  total: number
}) {
  const width = 760
  const height = 250
  const paddingX = 24
  const paddingTop = 20
  const chartBottom = height - 35
  const maxValue = Math.max(...data.map((item) => item.total), 1)
  const hasData = data.some((item) => item.total > 0)

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <SectionTitle
            icon={<TrendingUp className="h-5 w-5" />}
            title="Faturamento no período"
            subtitle="Evolução de receita conforme o filtro escolhido"
          />

          <div className="rounded-xl bg-slate-100 px-4 py-3 text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Total
            </p>
            <p className="mt-1 text-lg font-black text-slate-950">
              {formatCurrency(total)}
            </p>
          </div>
        </div>

        <div className="mt-5 flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
          Ainda não tem faturamento suficiente para gerar o gráfico.
        </div>
      </div>
    )
  }

  const points = data.map((item, index) => {
    const x =
      paddingX + (index * (width - paddingX * 2)) / Math.max(data.length - 1, 1)

    const y =
      chartBottom - (item.total / maxValue) * (chartBottom - paddingTop)

    return { x, y, label: item.label, total: item.total }
  })

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartBottom} L ${points[0].x} ${chartBottom} Z`

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <SectionTitle
          icon={<TrendingUp className="h-5 w-5" />}
          title="Faturamento no período"
          subtitle="Evolução de receita conforme o filtro escolhido"
        />

        <div className="rounded-xl bg-slate-100 px-4 py-3 text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Total
          </p>
          <p className="mt-1 text-lg font-black text-slate-950">
            {formatCurrency(total)}
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[270px] w-full">
          <defs>
            <linearGradient id="revenueArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0, 1, 2, 3].map((line) => {
            const y = paddingTop + ((chartBottom - paddingTop) / 3) * line

            return (
              <line
                key={line}
                x1={paddingX}
                x2={width - paddingX}
                y1={y}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray="5 5"
              />
            )
          })}

          <path d={areaPath} fill="url(#revenueArea)" />

          <path
            d={linePath}
            fill="none"
            stroke="#2563EB"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point) => (
            <g key={point.label}>
              <circle cx={point.x} cy={point.y} r="5" fill="#2563EB" />
              <circle cx={point.x} cy={point.y} r="11" fill="#2563EB" fillOpacity="0.12" />
            </g>
          ))}
        </svg>

        <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {data.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center"
            >
              <p className="text-xs font-semibold text-slate-500">{item.label}</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {item.total > 0 ? formatCompactCurrency(item.total) : "R$ 0"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProductChart({ products }: { products: ProductMetric[] }) {
  const maxValue = Math.max(...products.map((item) => item.total), 1)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <SectionTitle
        icon={<Trophy className="h-5 w-5" />}
        title="Produtos que mais saíram"
        subtitle="Ranking por quantidade vendida no período"
      />

      {products.length === 0 ? (
        <div className="mt-5 flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
          Nenhum produto vendido nesse período.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {products.map((product, index) => {
            const width = (product.total / maxValue) * 100

            return (
              <div key={product.name} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-black text-white">
                      {index + 1}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">
                        {product.name}
                      </p>
                      <p className="text-xs text-slate-500">Produto vendido no filtro atual</p>
                    </div>
                  </div>

                  <span className="shrink-0 text-sm font-black text-slate-950">
                    {product.total} un.
                  </span>
                </div>

                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MovementMap({ items }: { items: SeriesMetric[] }) {
  const maxValue = Math.max(...items.map((item) => item.total), 1)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <SectionTitle
        icon={<Clock3 className="h-5 w-5" />}
        title="Horários fortes"
        subtitle="Onde o restaurante concentra mais pedidos"
      />

      <div className="mt-5 space-y-4">
        {items.map((item) => {
          const width = (item.total / maxValue) * 100

          return (
            <div key={item.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                <span className="text-sm font-black text-slate-950">
                  {item.total} pedido(s)
                </span>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OrdersChart({ items }: { items: SeriesMetric[] }) {
  const maxValue = Math.max(...items.map((item) => item.total), 1)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <SectionTitle
        icon={<BarChart3 className="h-5 w-5" />}
        title="Volume de pedidos"
        subtitle="Quantidade de pedidos dentro do filtro"
      />

      <div className="mt-5 flex h-[260px] items-end gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4">
        {items.map((item) => {
          const height = Math.max(8, (item.total / maxValue) * 100)

          return (
            <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
              <div className="flex flex-1 items-end">
                <div
                  className="w-full rounded-t-lg bg-slate-950"
                  style={{ height: `${height}%` }}
                />
              </div>

              <div className="text-center">
                <p className="truncate text-[11px] font-semibold text-slate-500">
                  {item.label}
                </p>
                <p className="text-xs font-black text-slate-950">{item.total}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function GestaoPage() {
  const supabase = useMemo(() => createClient(), [])
  const [period, setPeriod] = useState<PeriodKey>("7d")
  const [data, setData] = useState<DashboardData>(emptyDashboard)
  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState("")
  const [restaurantName, setRestaurantName] = useState("Seu restaurante")
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true)
      setPageError("")

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error("Usuário não autenticado.")

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("owner_id", user.id)
        .single()

      if (restaurantError || !restaurant) {
        throw new Error("Restaurante não encontrado para esse usuário.")
      }

      setRestaurantName(restaurant.name || "Seu restaurante")

      const periodStart = getPeriodStart(period)

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, total, created_at, status, payment_method, payment_status")
        .eq("restaurant_id", restaurant.id)
        .gte("created_at", periodStart)
        .order("created_at", { ascending: true })

      if (ordersError) throw ordersError

      const validOrders = ((ordersData ?? []) as OrderRow[]).filter(isValidOrderForDashboard)
      const orderIds = validOrders.map((order) => order.id)

      let orderItems: OrderItemRow[] = []

      if (orderIds.length > 0) {
        const { data: orderItemsData, error: orderItemsError } = await supabase
          .from("order_items")
          .select("order_id, product_name, quantity")
          .in("order_id", orderIds)

        if (orderItemsError) throw orderItemsError

        orderItems = (orderItemsData ?? []) as OrderItemRow[]
      }

      const revenue = validOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      )

      const ordersCount = validOrders.length
      const averageTicket = ordersCount > 0 ? revenue / ordersCount : 0

      const productMap = new Map<string, number>()

      for (const item of orderItems) {
        const name = item.product_name?.trim() || "Produto sem nome"
        const quantity = Number(item.quantity || 0)

        productMap.set(name, (productMap.get(name) ?? 0) + quantity)
      }

      const topProducts = Array.from(productMap.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)

      const revenueSeries = buildRevenueSeries(validOrders, period)
      const ordersSeries = buildOrdersSeries(validOrders, period)
      const orderHeatmap = buildHeatmap(validOrders)
      const sortedHeatmap = [...orderHeatmap].sort((a, b) => b.total - a.total)

      setData({
        revenue,
        orders: ordersCount,
        averageTicket,
        bestProduct: topProducts[0]?.name ?? "-",
        bestProductUnits: topProducts[0]?.total ?? 0,
        topHour: sortedHeatmap[0]?.total > 0 ? sortedHeatmap[0].label : "-",
        topProducts,
        revenueSeries,
        ordersSeries,
        orderHeatmap,
        revenueTrend: calculateTrend(revenueSeries.map((item) => item.total)),
        ordersTrend: calculateTrend(ordersSeries.map((item) => item.total)),
        ticketTrend: calculateTicketTrend(validOrders),
      })

      setLastUpdatedAt(new Date())
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao carregar dados da gestão."

      setPageError(message)
      setData(emptyDashboard)
    } finally {
      setIsLoading(false)
    }
  }, [period, supabase])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  return (
    <AdminLayout title="Gestão">
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Gestão do restaurante
              </p>

              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                {restaurantName}
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Métricas reais de faturamento, pedidos e produtos mais vendidos.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {periodOptions.map((option) => (
                <PeriodButton
                  key={option.key}
                  label={option.label}
                  active={period === option.key}
                  onClick={() => setPeriod(option.key)}
                />
              ))}

              <button
                type="button"
                onClick={() => void loadDashboard()}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>
              Filtro atual:{" "}
              <strong className="text-slate-800">
                {periodOptions.find((option) => option.key === period)?.label}
              </strong>
            </span>

            {lastUpdatedAt && (
              <span>
                Atualizado às{" "}
                {lastUpdatedAt.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
          </div>
        </section>

        {pageError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {pageError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando gestão...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Faturamento"
                value={formatCurrency(data.revenue)}
                subtitle="Receita registrada no período"
                trend={data.revenueTrend}
                icon={<DollarSign className="h-5 w-5" />}
              />

              <MetricCard
                title="Pedidos"
                value={String(data.orders)}
                subtitle="Pedidos válidos no período"
                trend={data.ordersTrend}
                icon={<ShoppingCart className="h-5 w-5" />}
              />

              <MetricCard
                title="Ticket médio"
                value={formatCurrency(data.averageTicket)}
                subtitle="Média de valor por pedido"
                trend={data.ticketTrend}
                icon={<ArrowUpRight className="h-5 w-5" />}
              />

              <MetricCard
                title="Produto líder"
                value={data.bestProduct !== "-" ? data.bestProduct : "Sem vendas"}
                subtitle={
                  data.bestProductUnits > 0
                    ? `${data.bestProductUnits} unidades vendidas`
                    : "Nenhum produto vendido no filtro"
                }
                icon={<Package className="h-5 w-5" />}
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
              <RevenueChart data={data.revenueSeries} total={data.revenue} />

              <div className="grid gap-5">
                <MovementMap items={data.orderHeatmap} />

                <MetricCard
                  title="Horário forte"
                  value={data.topHour !== "-" ? data.topHour : "Sem pico"}
                  subtitle="Janela com maior movimento"
                  icon={<Flame className="h-5 w-5" />}
                />
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <OrdersChart items={data.ordersSeries} />

              <ProductChart products={data.topProducts} />
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  )
}