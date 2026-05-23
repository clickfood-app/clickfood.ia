"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
  icon: React.ReactNode
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
  icon: React.ReactNode
  tone: "blue" | "amber" | "green" | "red"
  delay?: number
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-red-50 text-red-700 ring-red-100",
  }[tone]

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
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

function Panel({
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
  icon: React.ReactNode
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  }[tone]

  return (
    <div className={cn("rounded-2xl border p-4", toneClass)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70">
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
    <div className="rounded-2xl bg-slate-50 px-4 pb-4 pt-6">
      <div className="flex h-[220px] items-end gap-1.5">
        {data.map((item, index) => {
          const height =
            item.count === 0 ? 6 : Math.max(12, (item.count / maxValue) * 100)
          const showLabel = index % 3 === 0

          return (
            <div
              key={item.hour}
              className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-2"
            >
              <div className="relative flex flex-1 items-end">
                <div
                  className={cn(
                    "w-full rounded-t-lg transition-all duration-700 ease-out",
                    item.count > 0
                      ? "bg-slate-950 group-hover:bg-blue-600"
                      : "bg-slate-200"
                  )}
                  style={{
                    height: `${height}%`,
                    animationDelay: `${index * 35}ms`,
                  }}
                />

                <div className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 shadow-lg group-hover:block">
                  {item.count} pedido(s)
                </div>
              </div>

              <p className="h-4 truncate text-center text-[10px] font-bold text-slate-400">
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
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Gestão
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Acompanhe a operação do restaurante em tempo real.
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
              onClick={() => void loadGestao()}
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

            <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
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

                <div className="mt-5 space-y-3">
                  {[
                    ["Em análise", data.analysisOrders, "bg-blue-600"],
                    ["Em preparo", data.preparingOrders, "bg-amber-500"],
                    ["Em rota", data.routeOrders, "bg-emerald-600"],
                    ["Finalizados", data.finishedOrders, "bg-slate-950"],
                  ].map(([label, value, color]) => (
                    <div key={String(label)}>
                      <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>{label}</span>
                        <span>{value}</span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
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
                title="Alertas operacionais"
                subtitle="Pontos que merecem atenção"
                icon={<Sparkles className="h-5 w-5" />}
              >
                <div className="space-y-3">
                  {data.alerts.map((alert) => {
                    const toneClass = {
                      red: "bg-red-50 text-red-700 border-red-100",
                      amber: "bg-amber-50 text-amber-700 border-amber-100",
                      blue: "bg-blue-50 text-blue-700 border-blue-100",
                      green: "bg-emerald-50 text-emerald-700 border-emerald-100",
                      slate: "bg-slate-50 text-slate-700 border-slate-200",
                    }[alert.tone]

                    return (
                      <div
                        key={alert.title}
                        className="flex gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
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

            <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
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
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black",
                              index === 0
                                ? "bg-amber-100 text-amber-700"
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

<section className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 text-white shadow-[0_28px_80px_-45px_rgba(15,23,42,0.95)]">
  <div className="relative p-5">
    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-orange-500/20 blur-3xl" />
    <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-blue-600/20 blur-3xl" />

    <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-orange-300">
          <MapPin className="h-4 w-4" />
          Radar de áreas
        </div>

        <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
          Onde mais vende no período
        </h2>

        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
          Veja quais bairros estão puxando mais pedidos, faturamento e oportunidade de campanha.
        </p>
      </div>

      {hottestArea && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 text-right backdrop-blur-xl">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
            Área quente
          </p>

          <p className="mt-1 max-w-[220px] truncate text-xl font-black text-white">
            {hottestArea.name}
          </p>

          <p className="mt-1 text-xs font-semibold text-orange-300">
            {hottestAreaShare}% dos pedidos mapeados
          </p>
        </div>
      )}
    </div>

    {data.topAreas.length === 0 ? (
      <div className="relative mt-5 rounded-3xl border border-dashed border-white/10 bg-white/[0.04] px-4 py-10 text-center text-sm font-semibold text-slate-400">
        Nenhuma área registrada nos pedidos desse período.
      </div>
    ) : (
      <div className="relative mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-orange-300">
                Campeã de vendas
              </p>

              <h3 className="mt-2 text-3xl font-black tracking-tight text-white">
                {hottestArea?.name}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Essa região concentrou a maior parte dos pedidos no período selecionado.
              </p>
            </div>

            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-950/30">
              <Sparkles className="h-7 w-7" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white/[0.06] p-3">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Pedidos
              </p>

              <p className="mt-1 text-xl font-black text-white">
                {hottestArea?.orders ?? 0}
              </p>
            </div>

            <div className="rounded-2xl bg-white/[0.06] p-3">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Vendas
              </p>

              <p className="mt-1 text-sm font-black text-white">
                {formatCurrency(hottestArea?.revenue ?? 0)}
              </p>
            </div>

            <div className="rounded-2xl bg-white/[0.06] p-3">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Ticket médio
              </p>

              <p className="mt-1 text-sm font-black text-white">
                {formatCurrency(hottestAreaAverageTicket)}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-orange-300/15 bg-orange-400/10 p-4">
            <p className="text-sm font-bold leading-6 text-orange-100">
              Insight: boa região para ação de recompra, cupom direcionado ou campanha local.
            </p>
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
                className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl transition hover:bg-white/[0.08]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black",
                        index === 0
                          ? "bg-orange-500 text-white"
                          : "bg-white/10 text-slate-300"
                      )}
                    >
                      {index + 1}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">
                        {area.name}
                      </p>

                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {area.orders} pedido(s) • {formatCurrency(area.revenue)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-white">{share}%</p>
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      participação
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      index === 0
                        ? "bg-gradient-to-r from-orange-500 to-yellow-400"
                        : "bg-gradient-to-r from-blue-500 to-blue-300"
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
  </div>
</section>

            <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
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
                            "flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                            delayed
                              ? "border-red-200 bg-red-50"
                              : "border-slate-200 bg-slate-50"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-black text-slate-950">
                                Pedido #
                                {order.public_order_number || order.id.slice(0, 6)}
                              </p>

                              <StatusBadge status={order.status} />
                            </div>

                            <p className="mt-1 truncate text-sm font-medium text-slate-500">
                              {order.customer_name || "Cliente sem nome"} • criado
                              às {formatTime(order.created_at)}
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

                            <span className="inline-flex h-9 items-center rounded-lg bg-slate-100 px-3 text-xs font-black text-slate-600">
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
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <span className="flex items-center gap-2">
                      <PlusCircle className="h-4 w-4" />
                      Novo pedido
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/pedidos"
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Ver pedidos
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/mesas"
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <span className="flex items-center gap-2">
                      <Utensils className="h-4 w-4" />
                      Mesas
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/produtos"
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
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