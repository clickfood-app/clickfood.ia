"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Flame,
  Loader2,
  MapPin,
  Package,
  PlusCircle,
  RefreshCcw,
  Route,
  ShoppingCart,
  Sparkles,
  Timer,
  Truck,
  Utensils,
  Zap,
} from "lucide-react"

type PeriodKey = "today" | "7d" | "30d"

type OrderRow = {
  id: string
  public_order_number: string | null
  customer_name: string | null
  customer_neighborhood: string | null
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

type StatusBucket =
  | "analysis"
  | "preparing"
  | "route"
  | "finished"
  | "cancelled"
  | "other"

type HourPoint = {
  hour: string
  count: number
}

type ProductRank = {
  name: string
  quantity: number
}

type AreaRank = {
  name: string
  orders: number
  revenue: number
}

type OperationalAlert = {
  title: string
  description: string
  tone: "red" | "amber" | "blue" | "green" | "slate"
  icon: ReactNode
}

type DashboardData = {
  totalOrders: number
  openOrders: number
  analysisOrders: number
  preparingOrders: number
  routeOrders: number
  finishedOrders: number
  delayedOrders: number
  pendingPixOrders: number
  topHour: string
  topProducts: ProductRank[]
  topAreas: AreaRank[]
  hourSeries: HourPoint[]
  openQueue: OrderRow[]
  alerts: OperationalAlert[]
}

const emptyDashboard: DashboardData = {
  totalOrders: 0,
  openOrders: 0,
  analysisOrders: 0,
  preparingOrders: 0,
  routeOrders: 0,
  finishedOrders: 0,
  delayedOrders: 0,
  pendingPixOrders: 0,
  topHour: "-",
  topProducts: [],
  topAreas: [],
  hourSeries: [],
  openQueue: [],
  alerts: [],
}

const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
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

  date.setDate(date.getDate() - 29)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

function getPeriodLabel(period: PeriodKey) {
  return periodOptions.find((option) => option.key === period)?.label || "Hoje"
}

function getStatusBucket(status: string | null): StatusBucket {
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
      "pending",
      "new",
      "novo",
      "received",
      "em_analise",
      "analysis",
      "aguardando",
    ].includes(normalized)
  ) {
    return "analysis"
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
    ].includes(normalized)
  ) {
    return "preparing"
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
    ["completed", "done", "finished", "finalizado", "delivered", "entregue"].includes(
      normalized
    )
  ) {
    return "finished"
  }

  return "other"
}

function getStatusLabel(status: string | null) {
  const bucket = getStatusBucket(status)

  if (bucket === "analysis") return "Em análise"
  if (bucket === "preparing") return "Em preparo"
  if (bucket === "route") return "Em rota"
  if (bucket === "finished") return "Finalizado"
  if (bucket === "cancelled") return "Cancelado"

  return status || "Pendente"
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
  if (bucket === "preparing") return age >= 30
  if (bucket === "route") return age >= 50
  if (bucket === "other") return age >= 25

  return false
}

function isOpenOrder(order: OrderRow) {
  const bucket = getStatusBucket(order.status)
  const status = String(order.status || "").toLowerCase()
  const paymentStatus = String(order.payment_status || "").toLowerCase()
  const paymentMethod = String(order.payment_method || "").toLowerCase()
  const age = getOrderAgeMinutes(order.created_at)

  const ignoredStatuses = [
    "awaiting_payment",
    "payment_pending",
    "pending_payment",
    "aguardando_pagamento",
    "deleted",
    "removed",
    "excluido",
  ]

  if (ignoredStatuses.includes(status)) return false
  if (bucket === "finished" || bucket === "cancelled") return false

  if (
    paymentMethod === "pix" &&
    ["pending", "awaiting_payment", "unpaid"].includes(paymentStatus)
  ) {
    return false
  }

  return age <= 720
}

function isPendingPix(order: OrderRow) {
  const method = String(order.payment_method || "").toLowerCase()
  const paymentStatus = String(order.payment_status || "").toLowerCase()

  if (method !== "pix") return false

  return !["paid", "received", "confirmed"].includes(paymentStatus)
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function buildHourSeries(orders: OrderRow[]) {
  const points: HourPoint[] = Array.from({ length: 24 }).map((_, index) => ({
    hour: `${String(index).padStart(2, "0")}h`,
    count: 0,
  }))

  for (const order of orders) {
    const hour = new Date(order.created_at).getHours()
    points[hour].count += 1
  }

  return points
}

function buildTopProducts(items: OrderItemRow[]) {
  const productMap = new Map<string, number>()

  for (const item of items) {
    const name = item.product_name || "Produto sem nome"
    const quantity = Number(item.quantity || 0)

    productMap.set(name, Number(productMap.get(name) || 0) + quantity)
  }

  return Array.from(productMap.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 6)
}

function buildTopAreas(orders: OrderRow[]) {
  const areaMap = new Map<string, AreaRank>()

  for (const order of orders) {
    const neighborhood = String(order.customer_neighborhood || "").trim()

    if (!neighborhood) continue

    const current =
      areaMap.get(neighborhood) ??
      ({
        name: neighborhood,
        orders: 0,
        revenue: 0,
      } satisfies AreaRank)

    current.orders += 1
    current.revenue += Number(order.total || 0)

    areaMap.set(neighborhood, current)
  }

  return Array.from(areaMap.values())
    .sort((a, b) => {
      if (b.orders !== a.orders) return b.orders - a.orders
      return b.revenue - a.revenue
    })
    .slice(0, 6)
}

function StatusBadge({ status }: { status: string | null }) {
  const bucket = getStatusBucket(status)

  const className = {
    analysis: "bg-blue-50 text-blue-700 ring-blue-100",
    preparing: "bg-amber-50 text-amber-700 ring-amber-100",
    route: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    finished: "bg-slate-100 text-slate-700 ring-slate-200",
    cancelled: "bg-red-50 text-red-700 ring-red-100",
    other: "bg-slate-100 text-slate-700 ring-slate-200",
  }[bucket]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ring-1",
        className
      )}
    >
      {getStatusLabel(status)}
    </span>
  )
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone,
  delay = 0,
}: {
  title: string
  value: string
  subtitle: string
  icon: ReactNode
  tone: "blue" | "amber" | "green" | "red"
  delay?: number
}) {
  const toneClass = {
    blue: {
      icon: "bg-blue-600 text-white shadow-blue-600/25",
      glow: "bg-blue-500/10",
      border: "hover:border-blue-200",
    },
    amber: {
      icon: "bg-orange-500 text-white shadow-orange-500/25",
      glow: "bg-orange-500/10",
      border: "hover:border-orange-200",
    },
    green: {
      icon: "bg-emerald-500 text-white shadow-emerald-500/25",
      glow: "bg-emerald-500/10",
      border: "hover:border-emerald-200",
    },
    red: {
      icon: "bg-red-500 text-white shadow-red-500/25",
      glow: "bg-red-500/10",
      border: "hover:border-red-200",
    },
  }[tone]

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.75)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_-42px_rgba(15,23,42,0.95)]",
        toneClass.border
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={cn(
          "absolute -right-10 -top-12 h-28 w-28 rounded-full blur-3xl transition group-hover:scale-125",
          toneClass.glow
        )}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            {title}
          </p>

          <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">
            {value}
          </p>

          <p className="mt-2 text-sm font-semibold leading-5 text-slate-500">
            {subtitle}
          </p>
        </div>

        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg",
            toneClass.icon
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
  icon,
  children,
  className,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.75)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-950">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-sm leading-5 text-slate-500">{subtitle}</p>
          )}
        </div>

        {icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/20">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  )
}

function OperationStep({
  title,
  value,
  subtitle,
  tone,
  icon,
}: {
  title: string
  value: number
  subtitle: string
  tone: "blue" | "amber" | "green" | "slate"
  icon: ReactNode
}) {
  const toneClass = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    amber: "border-orange-100 bg-orange-50 text-orange-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  }[tone]

  return (
    <div className={cn("rounded-3xl border p-4", toneClass)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          {icon}
        </div>

        <p className="text-3xl font-black">{value}</p>
      </div>

      <p className="mt-4 text-sm font-black">{title}</p>
      <p className="mt-1 text-xs font-semibold opacity-75">{subtitle}</p>
    </div>
  )
}

function HourChart({ data }: { data: HourPoint[] }) {
  const maxValue = Math.max(...data.map((item) => item.count), 1)

  return (
    <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-slate-950 p-4 text-white shadow-inner">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-300">
            Movimento
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-400">
            Distribuição de pedidos por horário
          </p>
        </div>

        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white ring-1 ring-white/10">
          24h
        </span>
      </div>

      <div className="flex h-[190px] items-end gap-1.5">
        {data.map((item, index) => {
          const height =
            item.count === 0 ? 5 : Math.max(12, (item.count / maxValue) * 100)
          const showLabel = index % 3 === 0
          const isPeak = item.count === maxValue && item.count > 0

          return (
            <div
              key={item.hour}
              className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-2"
            >
              <div className="relative flex flex-1 items-end">
                <div
                  className={cn(
                    "w-full rounded-t-xl transition-all duration-700 ease-out",
                    isPeak
                      ? "bg-gradient-to-t from-orange-500 to-yellow-300 shadow-[0_0_24px_rgba(249,115,22,0.45)]"
                      : item.count > 0
                        ? "bg-gradient-to-t from-blue-600 to-blue-300 group-hover:from-orange-500 group-hover:to-yellow-300"
                        : "bg-white/10"
                  )}
                  style={{
                    height: `${height}%`,
                    animationDelay: `${index * 35}ms`,
                  }}
                />

                <div className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 rounded-xl border border-white/10 bg-white px-2.5 py-1 text-xs font-black text-slate-900 shadow-lg group-hover:block">
                  {item.count} pedido(s)
                </div>
              </div>

              <p className="h-4 truncate text-center text-[10px] font-bold text-slate-500">
                {showLabel ? item.hour : ""}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
      {message}
    </div>
  )
}

export default function GestaoPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const [period, setPeriod] = useState<PeriodKey>("today")
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData>(emptyDashboard)
  const [isLoading, setIsLoading] = useState(true)

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

  const loadGestao = useCallback(async () => {
    try {
      setIsLoading(true)

      const resolvedRestaurantId = await resolveRestaurant()
      const startDate = getPeriodStart(period)

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(
          "id, public_order_number, customer_name, customer_neighborhood, total, created_at, status, payment_method, payment_status"
        )
        .eq("restaurant_id", resolvedRestaurantId)
        .gte("created_at", startDate)
        .order("created_at", { ascending: false })

      if (ordersError) throw ordersError

      const orders = (ordersData ?? []) as OrderRow[]
      const validOrders = orders.filter(
        (order) => getStatusBucket(order.status) !== "cancelled"
      )

      const orderIds = validOrders.map((order) => order.id)

      let orderItems: OrderItemRow[] = []

      if (orderIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from("order_items")
          .select("order_id, product_name, quantity")
          .in("order_id", orderIds)

        if (itemsError) throw itemsError

        orderItems = (itemsData ?? []) as OrderItemRow[]
      }

      const openOrders = validOrders.filter(isOpenOrder)

      const analysisOrders = validOrders.filter(
        (order) => getStatusBucket(order.status) === "analysis"
      )

      const preparingOrders = validOrders.filter(
        (order) => getStatusBucket(order.status) === "preparing"
      )

      const routeOrders = validOrders.filter(
        (order) => getStatusBucket(order.status) === "route"
      )

      const finishedOrders = validOrders.filter(
        (order) => getStatusBucket(order.status) === "finished"
      )

      const delayedOrders = openOrders.filter(isDelayed)
      const pendingPixOrders = validOrders.filter(isPendingPix)
      const hourSeries = buildHourSeries(validOrders)
      const topProducts = buildTopProducts(orderItems)
      const topAreas = buildTopAreas(validOrders)

      const topHourPoint = hourSeries.reduce(
        (best, current) => (current.count > best.count ? current : best),
        { hour: "-", count: 0 }
      )

      const alerts: OperationalAlert[] = []

      if (delayedOrders.length > 0) {
        alerts.push({
          title: `${delayedOrders.length} pedido(s) precisam de atenção`,
          description: "Existem pedidos parados há mais tempo que o ideal.",
          tone: "red",
          icon: <AlertTriangle className="h-4 w-4" />,
        })
      }

      if (pendingPixOrders.length > 0) {
        alerts.push({
          title: `${pendingPixOrders.length} Pix pendente(s)`,
          description:
            "Confira os pedidos aguardando confirmação de pagamento.",
          tone: "amber",
          icon: <Clock3 className="h-4 w-4" />,
        })
      }

      if (analysisOrders.length > 0) {
        alerts.push({
          title: `${analysisOrders.length} pedido(s) aguardando análise`,
          description:
            "Aceite ou recuse rapidamente para não travar a operação.",
          tone: "blue",
          icon: <Zap className="h-4 w-4" />,
        })
      }

      if (topProducts[0]) {
        alerts.push({
          title: `${topProducts[0].name} está em alta`,
          description: `${topProducts[0].quantity} unidade(s) vendidas no período. Confira estoque e preparo.`,
          tone: "green",
          icon: <Flame className="h-4 w-4" />,
        })
      }

      if (topAreas[0]) {
        alerts.push({
          title: `${topAreas[0].name} está movimentando mais pedidos`,
          description: `${topAreas[0].orders} pedido(s) vieram dessa área no período.`,
          tone: "blue",
          icon: <MapPin className="h-4 w-4" />,
        })
      }

      if (topHourPoint.count > 0) {
        alerts.push({
          title: `Horário mais movimentado: ${topHourPoint.hour}`,
          description: `${topHourPoint.count} pedido(s) concentrados nesse horário.`,
          tone: "slate",
          icon: <Timer className="h-4 w-4" />,
        })
      }

      if (alerts.length === 0) {
        alerts.push({
          title: "Operação tranquila",
          description: "Nenhum alerta importante encontrado nesse período.",
          tone: "green",
          icon: <CheckCircle2 className="h-4 w-4" />,
        })
      }

      setData({
        totalOrders: validOrders.length,
        openOrders: openOrders.length,
        analysisOrders: analysisOrders.length,
        preparingOrders: preparingOrders.length,
        routeOrders: routeOrders.length,
        finishedOrders: finishedOrders.length,
        delayedOrders: delayedOrders.length,
        pendingPixOrders: pendingPixOrders.length,
        topHour: topHourPoint.count > 0 ? topHourPoint.hour : "-",
        topProducts,
        topAreas,
        hourSeries,
        openQueue: openOrders
          .sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
          )
          .slice(0, 6),
        alerts: alerts.slice(0, 5),
      })
    } catch (error) {
      console.error("Erro ao carregar gestão:", error)

      toast({
        title: "Erro ao carregar gestão",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os dados da operação.",
        variant: "destructive",
      })

      setData(emptyDashboard)
    } finally {
      setIsLoading(false)
    }
  }, [period, resolveRestaurant, supabase, toast])

  useEffect(() => {
    void loadGestao()
  }, [loadGestao])

  const maxPipeline = Math.max(
    data.analysisOrders,
    data.preparingOrders,
    data.routeOrders,
    data.finishedOrders,
    1
  )

  const maxAreaOrders = Math.max(...data.topAreas.map((area) => area.orders), 1)

  const totalAreaOrders = data.topAreas.reduce(
    (sum, area) => sum + area.orders,
    0
  )

  const hottestArea = data.topAreas[0] ?? null

  const hottestAreaShare =
    hottestArea && totalAreaOrders > 0
      ? Math.round((hottestArea.orders / totalAreaOrders) * 100)
      : 0

  const hottestAreaAverageTicket =
    hottestArea && hottestArea.orders > 0
      ? hottestArea.revenue / hottestArea.orders
      : 0

  return (
    <AdminLayout title="Gestão">
      <div className="space-y-5">
        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_55px_-38px_rgba(15,23,42,0.55)]">
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-950 to-blue-950 px-4 py-4 text-white">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-blue-600 shadow-lg shadow-black/25">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>

                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-orange-300">
                    Centro de comando
                  </div>

                  <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-white">
                    Gestão da operação
                  </h1>

                  <p className="mt-1 max-w-2xl text-sm font-medium leading-5 text-slate-400">
                    Acompanhe o que está acontecendo agora, sem poluição visual.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {periodOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPeriod(option.key)}
                    className={cn(
                      "h-9 rounded-xl px-3 text-xs font-black transition",
                      period === option.key
                        ? "bg-white text-slate-950 shadow-lg"
                        : "border border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] hover:text-white"
                    )}
                  >
                    {option.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => void loadGestao()}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-black text-slate-200 transition hover:bg-white/[0.1] hover:text-white"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Atualizar
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 bg-slate-50/70 p-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Período
              </p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {getPeriodLabel(period)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Pedidos abertos
              </p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {data.openOrders}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Pico de movimento
              </p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {data.topHour}
              </p>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando operação...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Pedidos abertos"
                value={String(data.openOrders)}
                subtitle="Pedidos em andamento agora"
                tone="blue"
                delay={0}
                icon={<ShoppingCart className="h-5 w-5" />}
              />

              <MetricCard
                title="Em preparo"
                value={String(data.preparingOrders)}
                subtitle="Pedidos dentro da cozinha"
                tone="amber"
                delay={70}
                icon={<Utensils className="h-5 w-5" />}
              />

              <MetricCard
                title="Em rota"
                value={String(data.routeOrders)}
                subtitle="Pedidos com entrega em andamento"
                tone="green"
                delay={140}
                icon={<Truck className="h-5 w-5" />}
              />

              <MetricCard
                title="Atrasados"
                value={String(data.delayedOrders)}
                subtitle="Pedidos que exigem atenção"
                tone={data.delayedOrders > 0 ? "red" : "green"}
                delay={210}
                icon={<AlertTriangle className="h-5 w-5" />}
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.35fr_0.95fr]">
              <Panel
                title="Esteira da operação"
                subtitle={`Resumo dos pedidos em ${getPeriodLabel(
                  period
                ).toLowerCase()}`}
                icon={<Route className="h-5 w-5" />}
              >
                <div className="grid gap-3 md:grid-cols-4">
                  <OperationStep
                    title="Em análise"
                    value={data.analysisOrders}
                    subtitle="Aguardando ação"
                    tone="blue"
                    icon={<Clock3 className="h-5 w-5" />}
                  />

                  <OperationStep
                    title="Em preparo"
                    value={data.preparingOrders}
                    subtitle="Na cozinha"
                    tone="amber"
                    icon={<Utensils className="h-5 w-5" />}
                  />

                  <OperationStep
                    title="Em rota"
                    value={data.routeOrders}
                    subtitle="Com entregador"
                    tone="green"
                    icon={<Truck className="h-5 w-5" />}
                  />

                  <OperationStep
                    title="Finalizados"
                    value={data.finishedOrders}
                    subtitle="Concluídos"
                    tone="slate"
                    icon={<CheckCircle2 className="h-5 w-5" />}
                  />
                </div>

                <div className="mt-5 grid gap-3">
                  {[
                    ["Em análise", data.analysisOrders, "bg-blue-600"],
                    ["Em preparo", data.preparingOrders, "bg-orange-500"],
                    ["Em rota", data.routeOrders, "bg-emerald-600"],
                    ["Finalizados", data.finishedOrders, "bg-slate-950"],
                  ].map(([label, value, color]) => (
                    <div key={String(label)}>
                      <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>{label}</span>
                        <span>{value}</span>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700",
                            String(color)
                          )}
                          style={{
                            width: `${Math.min(
                              100,
                              (Number(value) / maxPipeline) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel
                title="Radar operacional"
                subtitle="Alertas rápidos para decidir melhor"
                icon={<Sparkles className="h-5 w-5" />}
              >
                <div className="space-y-3">
                  {data.alerts.map((alert) => {
                    const toneClass = {
                      red: "bg-red-50 text-red-700 border-red-100",
                      amber: "bg-orange-50 text-orange-700 border-orange-100",
                      blue: "bg-blue-50 text-blue-700 border-blue-100",
                      green: "bg-emerald-50 text-emerald-700 border-emerald-100",
                      slate: "bg-slate-50 text-slate-700 border-slate-200",
                    }[alert.tone]

                    return (
                      <div
                        key={alert.title}
                        className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3"
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                            toneClass
                          )}
                        >
                          {alert.icon}
                        </div>

                        <div>
                          <p className="text-sm font-black text-slate-900">
                            {alert.title}
                          </p>
                          <p className="mt-1 text-sm leading-5 text-slate-500">
                            {alert.description}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Panel>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.35fr_0.95fr]">
              <Panel
                title="Movimento por horário"
                subtitle="Volume de pedidos ao longo do dia"
                icon={<Timer className="h-5 w-5" />}
              >
                <HourChart data={data.hourSeries} />

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="rounded-full bg-slate-100 px-3 py-1.5">
                    Total no período: {data.totalOrders} pedido(s)
                  </span>

                  <span className="rounded-full bg-slate-100 px-3 py-1.5">
                    Horário mais forte: {data.topHour}
                  </span>
                </div>
              </Panel>

              <Panel
                title="Produtos em alta"
                subtitle="Itens mais pedidos no período"
                icon={<Flame className="h-5 w-5" />}
              >
                <div className="space-y-3">
                  {data.topProducts.length === 0 ? (
                    <EmptyState message="Nenhum produto vendido nesse período." />
                  ) : (
                    data.topProducts.map((product, index) => (
                      <div
                        key={product.name}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black",
                              index === 0
                                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                                : "bg-white text-slate-700"
                            )}
                          >
                            {index + 1}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">
                              {product.name}
                            </p>
                            <p className="text-xs font-medium text-slate-500">
                              Produto mais movimentado
                            </p>
                          </div>
                        </div>

                        <p className="shrink-0 text-sm font-black text-slate-950">
                          {product.quantity}x
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </section>

            <Panel
              title="Radar de áreas"
              subtitle="Bairros que mais puxaram pedidos no período"
              icon={<MapPin className="h-5 w-5" />}
            >
              {data.topAreas.length === 0 ? (
                <EmptyState message="Nenhuma área registrada nos pedidos desse período." />
              ) : (
                <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
                  <div className="rounded-[24px] border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-600">
                          Área quente
                        </p>

                        <h3 className="mt-2 truncate text-2xl font-black tracking-tight text-slate-950">
                          {hottestArea?.name}
                        </h3>

                        <p className="mt-2 text-sm font-semibold leading-5 text-slate-500">
                          Concentrou {hottestAreaShare}% dos pedidos mapeados.
                        </p>
                      </div>

                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/25">
                        <Flame className="h-6 w-6" />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-2xl bg-white p-3 shadow-sm">
                        <p className="text-[10px] font-bold uppercase text-slate-400">
                          Pedidos
                        </p>
                        <p className="mt-1 text-lg font-black text-slate-950">
                          {hottestArea?.orders ?? 0}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white p-3 shadow-sm">
                        <p className="text-[10px] font-bold uppercase text-slate-400">
                          Vendas
                        </p>
                        <p className="mt-1 truncate text-sm font-black text-slate-950">
                          {formatCurrency(hottestArea?.revenue ?? 0)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white p-3 shadow-sm">
                        <p className="text-[10px] font-bold uppercase text-slate-400">
                          Ticket
                        </p>
                        <p className="mt-1 truncate text-sm font-black text-slate-950">
                          {formatCurrency(hottestAreaAverageTicket)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {data.topAreas.map((area, index) => {
                      const share =
                        totalAreaOrders > 0
                          ? Math.round((area.orders / totalAreaOrders) * 100)
                          : 0

                      return (
                        <div
                          key={area.name}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className={cn(
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black",
                                  index === 0
                                    ? "bg-slate-950 text-white"
                                    : "bg-white text-slate-700"
                                )}
                              >
                                {index + 1}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-slate-950">
                                  {area.name}
                                </p>
                                <p className="text-xs font-medium text-slate-500">
                                  {area.orders} pedido(s) • {formatCurrency(area.revenue)}
                                </p>
                              </div>
                            </div>

                            <p className="shrink-0 text-sm font-black text-slate-950">
                              {share}%
                            </p>
                          </div>

                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-700",
                                index === 0
                                  ? "bg-gradient-to-r from-orange-500 to-yellow-400"
                                  : "bg-blue-600"
                              )}
                              style={{
                                width: `${Math.min(
                                  100,
                                  (area.orders / maxAreaOrders) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </Panel>

            <section className="grid gap-5 xl:grid-cols-[1.35fr_0.95fr]">
              <Panel
                title="Fila em andamento"
                subtitle="Pedidos abertos mais antigos primeiro"
                icon={<Package className="h-5 w-5" />}
              >
                <div className="space-y-3">
                  {data.openQueue.length === 0 ? (
                    <EmptyState message="Nenhum pedido em andamento agora." />
                  ) : (
                    data.openQueue.map((order) => {
                      const age = getOrderAgeMinutes(order.created_at)
                      const delayed = isDelayed(order)

                      return (
                        <div
                          key={order.id}
                          className={cn(
                            "flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                            delayed
                              ? "border-red-200 bg-red-50"
                              : "border-slate-200 bg-slate-50"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-black text-slate-950">
                                Pedido #{order.public_order_number || order.id.slice(0, 6)}
                              </p>

                              <StatusBadge status={order.status} />
                            </div>

                            <p className="mt-1 truncate text-sm font-medium text-slate-500">
                              {order.customer_name || "Cliente sem nome"} • criado às {formatTime(order.created_at)}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full px-3 py-1.5 text-xs font-black",
                                delayed
                                  ? "bg-red-100 text-red-700"
                                  : "bg-white text-slate-700"
                              )}
                            >
                              {age} min
                            </span>

                            <span className="inline-flex h-9 items-center rounded-xl bg-white px-3 text-xs font-black text-slate-600 shadow-sm">
                              Em andamento
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </Panel>

              <Panel
                title="Ações rápidas"
                subtitle="Atalhos para tocar a operação"
                icon={<Zap className="h-5 w-5" />}
              >
                <div className="grid gap-3">
                  <Link
                    href="/novo-pedido"
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <span className="flex items-center gap-2">
                      <PlusCircle className="h-4 w-4" />
                      Novo pedido
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/pedidos"
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Ver pedidos
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/mesas"
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <span className="flex items-center gap-2">
                      <Utensils className="h-4 w-4" />
                      Mesas
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/produtos"
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <span className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Produtos
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </Panel>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
