"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
  Crown,
  Loader2,
  Map,
  MapPin,
  Navigation,
  Percent,
  RefreshCcw,
  Search,
  ShoppingBag,
  Target,
  TrendingUp,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Restaurant = {
  id: string
  name: string | null
}

type OrderRecord = {
  id: string
  created_at: string | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_address?: string | null
  customer_neighborhood?: string | null
  status?: string | null
  payment_status?: string | null
  subtotal?: number | string | null
  total?: number | string | null
  delivery_fee?: number | string | null
}

type NeighborhoodRanking = {
  key: string
  name: string
  ordersCount: number
  paidOrdersCount: number
  pendingOrdersCount: number
  revenue: number
  deliveryFees: number
  averageTicket: number
  averageDeliveryFee: number
  revenueShare: number
  ordersShare: number
  lastOrderDate: Date | null
  uniqueCustomers: number
  recentOrders: number
  previousOrders: number
  trend: number
  status: "hot" | "growth" | "attention" | "weak"
  statusLabel: string
}

type PeriodFilter = "today" | "7d" | "30d" | "90d" | "all"
type PaymentFilter = "paid" | "pending" | "all"
type SortFilter = "revenue" | "orders" | "ticket" | "delivery" | "trend"

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

function formatMoney(value: number) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0)
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%"
  return `${value.toFixed(1).replace(".", ",")}%`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)
}

function formatDate(date: Date | null) {
  if (!date) return "Sem pedido"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".")
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function getOrderTotal(order: OrderRecord) {
  const total = toNumber(order.total)

  if (total > 0) return total

  return toNumber(order.subtotal) + toNumber(order.delivery_fee)
}

function normalizeText(value?: string | null) {
  return String(value || "").trim()
}

function normalizePhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "")
}

function getNeighborhood(order: OrderRecord) {
  const neighborhood = normalizeText(order.customer_neighborhood)

  if (neighborhood) return neighborhood

  return "Sem bairro informado"
}

function getNeighborhoodKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function getPeriodStart(period: PeriodFilter) {
  const now = new Date()
  const start = new Date(now)

  if (period === "today") {
    start.setHours(0, 0, 0, 0)
    return start
  }

  if (period === "7d") {
    start.setDate(now.getDate() - 7)
    return start
  }

  if (period === "30d") {
    start.setDate(now.getDate() - 30)
    return start
  }

  if (period === "90d") {
    start.setDate(now.getDate() - 90)
    return start
  }

  return null
}

function getDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

function getNeighborhoodStatus(neighborhood: NeighborhoodRanking) {
  if (neighborhood.revenueShare >= 25 || neighborhood.ordersShare >= 25) {
    return {
      status: "hot" as const,
      label: "Bairro quente",
    }
  }

  if (neighborhood.trend > 0) {
    return {
      status: "growth" as const,
      label: "Crescendo",
    }
  }

  if (neighborhood.ordersCount <= 2) {
    return {
      status: "weak" as const,
      label: "Fraco",
    }
  }

  return {
    status: "attention" as const,
    label: "Monitorar",
  }
}

export default function RadarBairrosPage() {
  const supabase = createClient()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("30d")
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("paid")
  const [sortFilter, setSortFilter] = useState<SortFilter>("revenue")
  const [searchTerm, setSearchTerm] = useState("")

  async function loadData(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError

      if (!user) {
        setError("Usuário não autenticado.")
        return
      }

      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle()

      if (restaurantError) throw restaurantError

      if (!restaurantData) {
        setError("Nenhum restaurante encontrado para este usuário.")
        return
      }

      setRestaurant(restaurantData)

      const startDate = getPeriodStart(periodFilter)

      let ordersQuery = supabase
        .from("orders")
        .select(
          "id, created_at, customer_name, customer_phone, customer_address, customer_neighborhood, status, payment_status, subtotal, total, delivery_fee",
        )
        .eq("restaurant_id", restaurantData.id)
        .order("created_at", { ascending: false })
        .limit(3000)

      if (startDate) {
        ordersQuery = ordersQuery.gte("created_at", startDate.toISOString())
      }

      const { data: ordersData, error: ordersError } = await ordersQuery

      if (ordersError) throw ordersError

      setOrders((ordersData || []) as OrderRecord[])
    } catch (err) {
      console.error("Erro ao carregar radar de bairros:", err)
      setError("Não foi possível carregar o radar de bairros.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodFilter])

  const neighborhoodRanking = useMemo<NeighborhoodRanking[]>(() => {
    const validOrders = orders.filter((order) => {
      const status = String(order.status || "").toLowerCase()
      const paymentStatus = String(order.payment_status || "").toLowerCase()

      const isCanceled =
        status === "cancelled" ||
        status === "canceled" ||
        status === "cancelado"

      if (isCanceled) return false

      if (paymentFilter === "paid") {
        return paymentStatus === "paid"
      }

      if (paymentFilter === "pending") {
        return paymentStatus !== "paid"
      }

      return true
    })

    const grouped = new Map<
      string,
      {
        key: string
        name: string
        ordersCount: number
        paidOrdersCount: number
        pendingOrdersCount: number
        revenue: number
        deliveryFees: number
        lastOrderDate: Date | null
        customers: Set<string>
        recentOrders: number
        previousOrders: number
      }
    >()

    const recentStart = getDaysAgo(7)
    const previousStart = getDaysAgo(14)

    for (const order of validOrders) {
      const neighborhoodName = getNeighborhood(order)
      const key = getNeighborhoodKey(neighborhoodName)
      const orderDate = order.created_at ? new Date(order.created_at) : null

      const paymentStatus = String(order.payment_status || "").toLowerCase()
      const isPaid = paymentStatus === "paid"

      const customerKey =
        normalizePhone(order.customer_phone) ||
        normalizeText(order.customer_name).toLowerCase() ||
        order.id

      const current =
        grouped.get(key) ||
        {
          key,
          name: neighborhoodName,
          ordersCount: 0,
          paidOrdersCount: 0,
          pendingOrdersCount: 0,
          revenue: 0,
          deliveryFees: 0,
          lastOrderDate: null,
          customers: new Set<string>(),
          recentOrders: 0,
          previousOrders: 0,
        }

      current.ordersCount += 1
      current.revenue += getOrderTotal(order)
      current.deliveryFees += toNumber(order.delivery_fee)
      current.customers.add(customerKey)

      if (isPaid) {
        current.paidOrdersCount += 1
      } else {
        current.pendingOrdersCount += 1
      }

      if (orderDate && !Number.isNaN(orderDate.getTime())) {
        if (!current.lastOrderDate || orderDate > current.lastOrderDate) {
          current.lastOrderDate = orderDate
        }

        if (orderDate >= recentStart) {
          current.recentOrders += 1
        } else if (orderDate >= previousStart && orderDate < recentStart) {
          current.previousOrders += 1
        }
      }

      grouped.set(key, current)
    }

    const totalRevenue = Array.from(grouped.values()).reduce(
      (sum, item) => sum + item.revenue,
      0,
    )

    const totalOrders = Array.from(grouped.values()).reduce(
      (sum, item) => sum + item.ordersCount,
      0,
    )

    const calculated = Array.from(grouped.values()).map((item) => {
      const averageTicket =
        item.ordersCount > 0 ? item.revenue / item.ordersCount : 0

      const averageDeliveryFee =
        item.ordersCount > 0 ? item.deliveryFees / item.ordersCount : 0

      const revenueShare =
        totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0

      const ordersShare =
        totalOrders > 0 ? (item.ordersCount / totalOrders) * 100 : 0

      const trend = item.recentOrders - item.previousOrders

      const baseNeighborhood: NeighborhoodRanking = {
        key: item.key,
        name: item.name,
        ordersCount: item.ordersCount,
        paidOrdersCount: item.paidOrdersCount,
        pendingOrdersCount: item.pendingOrdersCount,
        revenue: item.revenue,
        deliveryFees: item.deliveryFees,
        averageTicket,
        averageDeliveryFee,
        revenueShare,
        ordersShare,
        lastOrderDate: item.lastOrderDate,
        uniqueCustomers: item.customers.size,
        recentOrders: item.recentOrders,
        previousOrders: item.previousOrders,
        trend,
        status: "attention",
        statusLabel: "Monitorar",
      }

      const status = getNeighborhoodStatus(baseNeighborhood)

      return {
        ...baseNeighborhood,
        status: status.status,
        statusLabel: status.label,
      }
    })

    return calculated.sort((a, b) => {
      if (sortFilter === "orders") return b.ordersCount - a.ordersCount
      if (sortFilter === "ticket") return b.averageTicket - a.averageTicket
      if (sortFilter === "delivery") {
        return b.averageDeliveryFee - a.averageDeliveryFee
      }
      if (sortFilter === "trend") return b.trend - a.trend

      return b.revenue - a.revenue
    })
  }, [orders, paymentFilter, sortFilter])

  const filteredNeighborhoods = useMemo(() => {
    const search = searchTerm.toLowerCase()

    return neighborhoodRanking.filter((neighborhood) =>
      neighborhood.name.toLowerCase().includes(search),
    )
  }, [neighborhoodRanking, searchTerm])

  const summary = useMemo(() => {
    const totalOrders = neighborhoodRanking.reduce(
      (sum, item) => sum + item.ordersCount,
      0,
    )

    const totalRevenue = neighborhoodRanking.reduce(
      (sum, item) => sum + item.revenue,
      0,
    )

    const totalDeliveryFees = neighborhoodRanking.reduce(
      (sum, item) => sum + item.deliveryFees,
      0,
    )

    const totalCustomers = neighborhoodRanking.reduce(
      (sum, item) => sum + item.uniqueCustomers,
      0,
    )

    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const averageDeliveryFee =
      totalOrders > 0 ? totalDeliveryFees / totalOrders : 0

    const hotNeighborhoods = neighborhoodRanking.filter(
      (item) => item.status === "hot" || item.status === "growth",
    ).length

    return {
      totalNeighborhoods: neighborhoodRanking.length,
      totalOrders,
      totalRevenue,
      totalDeliveryFees,
      totalCustomers,
      averageTicket,
      averageDeliveryFee,
      hotNeighborhoods,
      topNeighborhood: neighborhoodRanking[0],
    }
  }, [neighborhoodRanking])

  const periodOptions = [
    { value: "today", label: "Hoje" },
    { value: "7d", label: "7 dias" },
    { value: "30d", label: "30 dias" },
    { value: "90d", label: "90 dias" },
    { value: "all", label: "Tudo" },
  ] as const

  const paymentOptions = [
    { value: "paid", label: "Pagos" },
    { value: "pending", label: "Pendentes" },
    { value: "all", label: "Todos" },
  ] as const

  const sortOptions = [
    { value: "revenue", label: "Faturamento" },
    { value: "orders", label: "Pedidos" },
    { value: "ticket", label: "Ticket médio" },
    { value: "delivery", label: "Taxa média" },
    { value: "trend", label: "Tendência" },
  ] as const

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                    <Map className="h-5 w-5" />
                  </div>

                  <div>
                    <h1 className="text-xl font-bold text-slate-950">
                      Radar de Bairros
                    </h1>
                    <p className="text-sm text-slate-500">
                      Descubra quais bairros mais compram, faturam e merecem
                      campanhas específicas.
                    </p>
                  </div>
                </div>

                {restaurant?.name ? (
                  <p className="text-xs font-medium text-slate-400">
                    Restaurante: {restaurant.name}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={periodFilter}
                  onChange={(event) =>
                    setPeriodFilter(event.target.value as PeriodFilter)
                  }
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                >
                  {periodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <Loader2 className="h-7 w-7 animate-spin" />
                <p className="text-sm font-medium">
                  Carregando radar de bairros...
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                      Áreas
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    Bairros ativos
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {summary.totalNeighborhoods}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    Pedidos analisados
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {formatNumber(summary.totalOrders)}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                    <BadgeDollarSign className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    Faturamento por área
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {formatMoney(summary.totalRevenue)}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 text-purple-600">
                    <Crown className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    Bairro líder
                  </p>
                  <p className="mt-1 line-clamp-1 text-lg font-black text-slate-950">
                    {summary.topNeighborhood?.name || "Sem dados"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Navigation className="h-5 w-5 text-slate-700" />
                    <h2 className="text-base font-bold text-slate-950">
                      Leitura operacional
                    </h2>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Ticket médio
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-950">
                        {formatMoney(summary.averageTicket)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Taxa média
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-950">
                        {formatMoney(summary.averageDeliveryFee)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Taxas de entrega
                      </p>
                      <p className="mt-1 text-lg font-black text-orange-600">
                        {formatMoney(summary.totalDeliveryFees)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Bairros quentes
                      </p>
                      <p className="mt-1 text-lg font-black text-emerald-600">
                        {summary.hotNeighborhoods}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-950">
                        Melhor alvo de campanha
                      </p>
                      <p className="text-xs font-medium text-slate-500">
                        Bairro com maior força no período.
                      </p>
                    </div>

                    <Target className="h-5 w-5 text-emerald-500" />
                  </div>

                  {summary.topNeighborhood ? (
                    <div className="rounded-2xl bg-emerald-50 p-4">
                      <p className="line-clamp-1 text-base font-black text-emerald-950">
                        {summary.topNeighborhood.name}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs font-bold uppercase text-emerald-700/70">
                            Faturou
                          </p>
                          <p className="font-black text-emerald-800">
                            {formatMoney(summary.topNeighborhood.revenue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase text-emerald-700/70">
                            Pedidos
                          </p>
                          <p className="font-black text-emerald-800">
                            {summary.topNeighborhood.ordersCount}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-500">
                      Ainda não há pedidos com bairro informado.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-950">
                        Ranking por bairro
                      </h2>
                      <p className="text-sm text-slate-500">
                        Veja onde vale fazer campanha, ajustar entrega ou focar
                        combos por região.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={searchTerm}
                          onChange={(event) =>
                            setSearchTerm(event.target.value)
                          }
                          placeholder="Buscar bairro..."
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 sm:w-64"
                        />
                      </div>

                      <select
                        value={paymentFilter}
                        onChange={(event) =>
                          setPaymentFilter(event.target.value as PaymentFilter)
                        }
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      >
                        {paymentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={sortFilter}
                        onChange={(event) =>
                          setSortFilter(event.target.value as SortFilter)
                        }
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      >
                        {sortOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1080px] text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-black uppercase tracking-wide text-slate-400">
                        <th className="px-5 py-3">Bairro</th>
                        <th className="px-5 py-3">Pedidos</th>
                        <th className="px-5 py-3">Faturamento</th>
                        <th className="px-5 py-3">Ticket médio</th>
                        <th className="px-5 py-3">Taxa média</th>
                        <th className="px-5 py-3">Clientes</th>
                        <th className="px-5 py-3">Participação</th>
                        <th className="px-5 py-3">Tendência</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredNeighborhoods.length > 0 ? (
                        filteredNeighborhoods.map((neighborhood) => (
                          <tr
                            key={neighborhood.key}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                          >
                            <td className="px-5 py-4">
                              <div>
                                <p className="font-bold text-slate-950">
                                  {neighborhood.name}
                                </p>
                                <p className="mt-1 text-xs font-medium text-slate-400">
                                  Último pedido:{" "}
                                  {formatDate(neighborhood.lastOrderDate)}
                                </p>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <p className="text-sm font-black text-slate-900">
                                {neighborhood.ordersCount}
                              </p>
                              <p className="mt-1 text-xs font-medium text-slate-400">
                                {neighborhood.paidOrdersCount} pagos •{" "}
                                {neighborhood.pendingOrdersCount} pendentes
                              </p>
                            </td>

                            <td className="px-5 py-4 text-sm font-black text-slate-900">
                              {formatMoney(neighborhood.revenue)}
                            </td>

                            <td className="px-5 py-4 text-sm font-black text-slate-900">
                              {formatMoney(neighborhood.averageTicket)}
                            </td>

                            <td className="px-5 py-4 text-sm font-black text-orange-600">
                              {formatMoney(neighborhood.averageDeliveryFee)}
                            </td>

                            <td className="px-5 py-4 text-sm font-black text-slate-900">
                              {neighborhood.uniqueCustomers}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-emerald-500"
                                    style={{
                                      width: `${Math.min(
                                        neighborhood.revenueShare,
                                        100,
                                      )}%`,
                                    }}
                                  />
                                </div>

                                <span className="text-xs font-black text-slate-600">
                                  {formatPercent(neighborhood.revenueShare)}
                                </span>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                {neighborhood.trend > 0 ? (
                                  <ArrowUp className="h-4 w-4 text-emerald-500" />
                                ) : neighborhood.trend < 0 ? (
                                  <ArrowDown className="h-4 w-4 text-red-500" />
                                ) : (
                                  <TrendingUp className="h-4 w-4 text-slate-400" />
                                )}

                                <span
                                  className={cn(
                                    "text-sm font-black",
                                    neighborhood.trend > 0 &&
                                      "text-emerald-600",
                                    neighborhood.trend < 0 && "text-red-600",
                                    neighborhood.trend === 0 &&
                                      "text-slate-500",
                                  )}
                                >
                                  {neighborhood.trend > 0
                                    ? `+${neighborhood.trend}`
                                    : neighborhood.trend}
                                </span>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-xs font-black",
                                  neighborhood.status === "hot" &&
                                    "bg-emerald-100 text-emerald-700",
                                  neighborhood.status === "growth" &&
                                    "bg-blue-100 text-blue-700",
                                  neighborhood.status === "attention" &&
                                    "bg-amber-100 text-amber-700",
                                  neighborhood.status === "weak" &&
                                    "bg-slate-100 text-slate-600",
                                )}
                              >
                                {neighborhood.statusLabel}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-5 py-12 text-center text-sm font-medium text-slate-500"
                          >
                            Nenhum bairro encontrado para os filtros atuais.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <div className="flex gap-3">
                  <Percent className="mt-0.5 h-5 w-5 flex-none" />
                  <div>
                    <p className="font-black">Como usar esse radar</p>
                    <p className="mt-1 font-medium">
                      Bairros com muito faturamento merecem campanhas próprias,
                      combos direcionados e atenção especial na entrega. Bairros
                      com taxa média alta podem indicar oportunidade de ajustar
                      regiões, motoboy ou valor mínimo de pedido.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
                  <div>
                    <p className="font-black">Atenção</p>
                    <p className="mt-1 font-medium">
                      Esse radar depende do campo de bairro salvo nos pedidos.
                      Quando o cliente não tiver bairro identificado, o pedido
                      entra como “Sem bairro informado”.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}