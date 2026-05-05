"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import {
  AlertTriangle,
  Clock3,
  DollarSign,
  Loader2,
  Receipt,
  RefreshCcw,
  ShoppingCart,
  TimerReset,
  XCircle,
} from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { cn } from "@/lib/utils"

type OrderRow = {
  id: string
  public_order_number: string
  customer_name: string
  status: string
  total: number | string | null
  created_at: string
}

type DashboardMetrics = {
  faturamentoHoje: number
  faturamentoOntem: number
  faturamentoVar: number
  pedidosHoje: number
  pedidosOntem: number
  pedidosVar: number
  ticketMedioHoje: number
  ticketMedioOntem: number
  ticketVar: number
  pendentesAgora: number
  emPreparoAgora: number
  concluidosHoje: number
  canceladosHoje: number
  recentOrders: OrderRow[]
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CANCELLED_STATUSES = ["cancelado", "cancelled", "canceled"]
const REVENUE_STATUSES = [
  "aceito",
  "accepted",
  "em_preparo",
  "preparing",
  "aguardando",
  "waiting",
  "pronto",
  "ready",
  "saiu_para_entrega",
  "out_for_delivery",
  "entregue",
  "delivered",
]
const PENDING_STATUSES = ["pendente", "pending"]
const PREPARING_STATUSES = [
  "aceito",
  "accepted",
  "em_preparo",
  "preparing",
  "aguardando",
  "waiting",
  "pronto",
  "ready",
  "saiu_para_entrega",
  "out_for_delivery",
]
const DONE_STATUSES = ["entregue", "delivered"]

function normalizeStatus(status: string | null | undefined) {
  return (status || "").trim().toLowerCase()
}

function isCancelled(status: string) {
  return CANCELLED_STATUSES.includes(normalizeStatus(status))
}

function isRevenueStatus(status: string) {
  return REVENUE_STATUSES.includes(normalizeStatus(status))
}

function isPendingStatus(status: string) {
  return PENDING_STATUSES.includes(normalizeStatus(status))
}

function isPreparingStatus(status: string) {
  return PREPARING_STATUSES.includes(normalizeStatus(status))
}

function isDoneStatus(status: string) {
  return DONE_STATUSES.includes(normalizeStatus(status))
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0)
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

function formatStatus(status: string) {
  const normalized = normalizeStatus(status)

  if (normalized === "pending" || normalized === "pendente") return "Pendente"
  if (normalized === "accepted" || normalized === "aceito") return "Aceito"
  if (normalized === "preparing" || normalized === "em_preparo") return "Em preparo"
  if (normalized === "waiting" || normalized === "aguardando") return "Aguardando"
  if (normalized === "ready" || normalized === "pronto") return "Pronto"
  if (normalized === "out_for_delivery" || normalized === "saiu_para_entrega") {
    return "Saiu para entrega"
  }
  if (normalized === "delivered" || normalized === "entregue") return "Entregue"
  if (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "cancelado"
  ) {
    return "Cancelado"
  }

  return status
}

function getStatusClasses(status: string) {
  const normalized = normalizeStatus(status)

  if (normalized === "pending" || normalized === "pendente") {
    return "border-amber-200 bg-amber-50 text-amber-700"
  }

  if (
    normalized === "accepted" ||
    normalized === "aceito" ||
    normalized === "preparing" ||
    normalized === "em_preparo" ||
    normalized === "waiting" ||
    normalized === "aguardando" ||
    normalized === "ready" ||
    normalized === "pronto" ||
    normalized === "out_for_delivery" ||
    normalized === "saiu_para_entrega"
  ) {
    return "border-blue-200 bg-blue-50 text-blue-700"
  }

  if (normalized === "delivered" || normalized === "entregue") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }

  if (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "cancelado"
  ) {
    return "border-red-200 bg-red-50 text-red-700"
  }

  return "border-slate-200 bg-slate-50 text-slate-700"
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function getDayRange(baseDate: Date) {
  const start = new Date(baseDate)
  start.setHours(0, 0, 0, 0)

  const end = new Date(baseDate)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

function isBetween(date: string, start: Date, end: Date) {
  const value = new Date(date).getTime()
  return value >= start.getTime() && value <= end.getTime()
}

function buildMetrics(allOrders: OrderRow[], now = new Date()): DashboardMetrics {
  const todayRange = getDayRange(now)
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterdayRange = getDayRange(yesterdayDate)

  const ordersToday = allOrders.filter((order) =>
    isBetween(order.created_at, todayRange.start, todayRange.end)
  )

  const ordersYesterday = allOrders.filter((order) =>
    isBetween(order.created_at, yesterdayRange.start, yesterdayRange.end)
  )

  const faturamentoHoje = ordersToday
    .filter((order) => isRevenueStatus(order.status))
    .reduce((acc, order) => acc + Number(order.total || 0), 0)

  const faturamentoOntem = ordersYesterday
    .filter((order) => isRevenueStatus(order.status))
    .reduce((acc, order) => acc + Number(order.total || 0), 0)

  const pedidosHoje = ordersToday.length
  const pedidosOntem = ordersYesterday.length

  const validOrdersHoje = ordersToday.filter((order) => !isCancelled(order.status))
  const validOrdersOntem = ordersYesterday.filter((order) => !isCancelled(order.status))

  const ticketMedioHoje =
    validOrdersHoje.length > 0 ? faturamentoHoje / validOrdersHoje.length : 0

  const ticketMedioOntem =
    validOrdersOntem.length > 0 ? faturamentoOntem / validOrdersOntem.length : 0

  const pendentesAgora = ordersToday.filter((order) =>
    isPendingStatus(order.status)
  ).length

  const emPreparoAgora = ordersToday.filter((order) =>
    isPreparingStatus(order.status)
  ).length

  const concluidosHoje = ordersToday.filter((order) =>
    isDoneStatus(order.status)
  ).length

  const canceladosHoje = ordersToday.filter((order) =>
    isCancelled(order.status)
  ).length

  const recentOrders = [...ordersToday]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 8)

  return {
    faturamentoHoje,
    faturamentoOntem,
    faturamentoVar: pctChange(faturamentoHoje, faturamentoOntem),
    pedidosHoje,
    pedidosOntem,
    pedidosVar: pctChange(pedidosHoje, pedidosOntem),
    ticketMedioHoje,
    ticketMedioOntem,
    ticketVar: pctChange(ticketMedioHoje, ticketMedioOntem),
    pendentesAgora,
    emPreparoAgora,
    concluidosHoje,
    canceladosHoje,
    recentOrders,
  }
}

function SkeletonCard() {
  return <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
}

function VariationBadge({ value }: { value: number }) {
  const isPositive = value > 0
  const isNeutral = value === 0

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        isNeutral && "bg-slate-100 text-slate-600",
        !isNeutral && isPositive && "bg-emerald-100 text-emerald-700",
        !isNeutral && !isPositive && "bg-red-100 text-red-700"
      )}
    >
      {isNeutral ? "0%" : `${isPositive ? "+" : ""}${value}%`}
    </span>
  )
}

export default function DashboardContent() {
  const { restaurant, user, isLoading: authLoading } = useAuth()

  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  async function loadDashboard(showRefresh = false) {
    if (!restaurant?.id) return

    try {
      if (showRefresh) setRefreshing(true)
      else setLoading(true)

      setError(null)

      const today = getDayRange(new Date())
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayRange = getDayRange(yesterday)

      const { data, error } = await supabase
        .from("orders")
        .select("id, public_order_number, customer_name, status, total, created_at")
        .eq("restaurant_id", restaurant.id)
        .gte("created_at", yesterdayRange.start.toISOString())
        .lte("created_at", today.end.toISOString())
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      setOrders((data || []) as OrderRow[])
      setLastUpdated(new Date())
    } catch (err) {
      console.error("Erro ao carregar dashboard:", err)
      setError(
        err instanceof Error ? err.message : "Erro ao carregar dashboard."
      )
      setOrders([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setOrders([])
      setLoading(false)
      setError("Usuário não autenticado.")
      return
    }

    if (!restaurant?.id) {
      setOrders([])
      setLoading(false)
      setError("Restaurante não encontrado para este usuário.")
      return
    }

    void loadDashboard()

    const interval = window.setInterval(() => {
      void loadDashboard(true)
    }, 15000)

    const channel = supabase
      .channel(`dashboard-orders-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          void loadDashboard(true)
        }
      )
      .subscribe()

    return () => {
      window.clearInterval(interval)
      void supabase.removeChannel(channel)
    }
  }, [authLoading, restaurant?.id, user?.id])

  const metrics = useMemo(() => buildMetrics(orders), [orders])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <div className="h-24 animate-pulse rounded-3xl bg-white" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="h-96 animate-pulse rounded-3xl bg-white" />
            <div className="h-96 animate-pulse rounded-3xl bg-white" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <TimerReset className="h-3.5 w-3.5" />
                Operação em tempo real
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Painel do dia
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Dados reais do restaurante com atualização automática.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                Última atualização:{" "}
                <span className="font-semibold text-slate-900">
                  {lastUpdated
                    ? new Intl.DateTimeFormat("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      }).format(lastUpdated)
                    : "—"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => loadDashboard(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Atualizar
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <DollarSign className="h-5 w-5" />
              </div>
              <VariationBadge value={metrics.faturamentoVar} />
            </div>
            <p className="mt-4 text-sm text-slate-500">Faturamento hoje</p>
            <h3 className="mt-1 text-3xl font-bold text-slate-900">
              {formatBRL(metrics.faturamentoHoje)}
            </h3>
            <p className="mt-2 text-xs text-slate-400">
              Ontem: {formatBRL(metrics.faturamentoOntem)}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <VariationBadge value={metrics.pedidosVar} />
            </div>
            <p className="mt-4 text-sm text-slate-500">Pedidos hoje</p>
            <h3 className="mt-1 text-3xl font-bold text-slate-900">
              {metrics.pedidosHoje}
            </h3>
            <p className="mt-2 text-xs text-slate-400">
              Ontem: {metrics.pedidosOntem}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <Receipt className="h-5 w-5" />
              </div>
              <VariationBadge value={metrics.ticketVar} />
            </div>
            <p className="mt-4 text-sm text-slate-500">Ticket médio</p>
            <h3 className="mt-1 text-3xl font-bold text-slate-900">
              {formatBRL(metrics.ticketMedioHoje)}
            </h3>
            <p className="mt-2 text-xs text-slate-400">
              Ontem: {formatBRL(metrics.ticketMedioOntem)}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <XCircle className="h-5 w-5" />
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                Hoje
              </span>
            </div>
            <p className="mt-4 text-sm text-slate-500">Cancelados</p>
            <h3 className="mt-1 text-3xl font-bold text-slate-900">
              {metrics.canceladosHoje}
            </h3>
            <p className="mt-2 text-xs text-slate-400">
              Pedidos cancelados no dia
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Fila operacional
                </h2>
                <p className="text-sm text-slate-500">
                  Situação atual da operação
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                <Clock3 className="h-3.5 w-3.5" />
                Atualiza em tempo real
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-700">Pendentes</p>
                <h3 className="mt-2 text-3xl font-bold text-amber-900">
                  {metrics.pendentesAgora}
                </h3>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-700">Em preparo</p>
                <h3 className="mt-2 text-3xl font-bold text-blue-900">
                  {metrics.emPreparoAgora}
                </h3>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-700">
                  Concluídos hoje
                </p>
                <h3 className="mt-2 text-3xl font-bold text-emerald-900">
                  {metrics.concluidosHoje}
                </h3>
              </div>

              <div
                className={cn(
                  "rounded-2xl border p-4",
                  metrics.canceladosHoje > 0
                    ? "border-rose-200 bg-rose-50"
                    : "border-slate-200 bg-slate-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      metrics.canceladosHoje > 0
                        ? "text-rose-700"
                        : "text-slate-600"
                    )}
                  >
                    Cancelados
                  </p>

                  {metrics.canceladosHoje > 0 && (
                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                  )}
                </div>

                <h3
                  className={cn(
                    "mt-2 text-3xl font-bold",
                    metrics.canceladosHoje > 0
                      ? "text-rose-900"
                      : "text-slate-900"
                  )}
                >
                  {metrics.canceladosHoje}
                </h3>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-900">
                Últimos pedidos
              </h2>
              <p className="text-sm text-slate-500">
                Entradas mais recentes do dia
              </p>
            </div>

            {metrics.recentOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="text-sm font-medium text-slate-700">
                  Nenhum pedido hoje
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Assim que entrarem pedidos, eles aparecem aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          #{order.public_order_number} • {order.customer_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDateTime(order.created_at)}
                        </p>
                      </div>

                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                          getStatusClasses(order.status)
                        )}
                      >
                        {formatStatus(order.status)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-slate-500">Total</p>
                      <p className="text-sm font-bold text-slate-900">
                        {formatBRL(Number(order.total || 0))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}