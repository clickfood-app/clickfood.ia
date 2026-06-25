"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
  Crown,
  Loader2,
  MapIcon,
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

function normalizeText(value?: string | null) {
  return String(value || "").trim()
}

function normalizeNeighborhood(value?: string | null) {
  const neighborhood = normalizeText(value)

  if (!neighborhood) return "Bairro não informado"

  return neighborhood
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 2) return word
      return `${word[0]?.toUpperCase() || ""}${word.slice(1)}`
    })
    .join(" ")
}

function normalizeCustomerPhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "")
}

function getOrderTotal(order: OrderRecord) {
  const total = toNumber(order.total)
  if (total > 0) return total

  return toNumber(order.subtotal) + toNumber(order.delivery_fee)
}

function getPeriodStartDate(period: PeriodFilter) {
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

function getNeighborhoodStatus(item: {
  ordersCount: number
  revenue: number
  trend: number
  revenueShare: number
}): Pick<NeighborhoodRanking, "status" | "statusLabel"> {
  if (item.revenueShare >= 25 || item.ordersCount >= 20) {
    return {
      status: "hot",
      statusLabel: "Forte",
    }
  }

  if (item.trend > 0) {
    return {
      status: "growth",
      statusLabel: "Crescendo",
    }
  }

  if (item.ordersCount >= 3) {
    return {
      status: "attention",
      statusLabel: "Atenção",
    }
  }

  return {
    status: "weak",
    statusLabel: "Fraco",
  }
}

function getTrendPercentage(recentOrders: number, previousOrders: number) {
  if (previousOrders === 0 && recentOrders > 0) return 100
  if (previousOrders === 0) return 0

  return ((recentOrders - previousOrders) / previousOrders) * 100
}

function getDateFromOrder(order: OrderRecord) {
  if (!order.created_at) return null

  const date = new Date(order.created_at)

  if (Number.isNaN(date.getTime())) return null

  return date
}

function isOrderPaid(order: OrderRecord) {
  return String(order.payment_status || "").toLowerCase() === "paid"
}

function isOrderPending(order: OrderRecord) {
  const paymentStatus = String(order.payment_status || "").toLowerCase()

  return (
    paymentStatus === "pending" ||
    paymentStatus === "waiting" ||
    paymentStatus === "aguardando"
  )
}

function isOrderCanceled(order: OrderRecord) {
  const status = String(order.status || "").toLowerCase()

  return (
    status === "cancelled" ||
    status === "canceled" ||
    status === "cancelado"
  )
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

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(
          "id, created_at, customer_name, customer_phone, customer_address, customer_neighborhood, status, payment_status, subtotal, total, delivery_fee",
        )
        .eq("restaurant_id", restaurantData.id)
        .order("created_at", { ascending: false })
        .limit(2500)

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
  }, [])

  const ranking = useMemo<NeighborhoodRanking[]>(() => {
    const periodStart = getPeriodStartDate(periodFilter)
    const now = new Date()

    const validOrders = orders.filter((order) => {
      if (isOrderCanceled(order)) return false

      const orderDate = getDateFromOrder(order)
      if (!orderDate) return false

      if (periodStart && orderDate < periodStart) return false

      if (paymentFilter === "paid") return isOrderPaid(order)
      if (paymentFilter === "pending") return isOrderPending(order)

      return true
    })

    const totalRevenue = validOrders.reduce(
      (sum, order) => sum + getOrderTotal(order),
      0,
    )

    const totalOrders = validOrders.length

    const recentStart = new Date(now)
    recentStart.setDate(now.getDate() - 15)

    const previousStart = new Date(now)
    previousStart.setDate(now.getDate() - 30)

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

    for (const order of validOrders) {
      const neighborhoodName = normalizeNeighborhood(order.customer_neighborhood)
      const key = neighborhoodName.toLowerCase()
      const orderDate = getDateFromOrder(order)

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

      if (isOrderPaid(order)) {
        current.paidOrdersCount += 1
      }

      if (isOrderPending(order)) {
        current.pendingOrdersCount += 1
      }

      current.revenue += getOrderTotal(order)
      current.deliveryFees += toNumber(order.delivery_fee)

      if (orderDate) {
        if (!current.lastOrderDate || orderDate > current.lastOrderDate) {
          current.lastOrderDate = orderDate
        }

        if (orderDate >= recentStart) {
          current.recentOrders += 1
        } else if (orderDate >= previousStart && orderDate < recentStart) {
          current.previousOrders += 1
        }
      }

      const customerPhone = normalizeCustomerPhone(order.customer_phone)
      const customerName = normalizeText(order.customer_name)

      if (customerPhone) {
        current.customers.add(`phone:${customerPhone}`)
      } else if (customerName) {
        current.customers.add(`name:${customerName.toLowerCase()}`)
      } else {
        current.customers.add(`order:${order.id}`)
      }

      grouped.set(key, current)
    }

    const items = Array.from(grouped.values()).map((item) => {
      const averageTicket =
        item.ordersCount > 0 ? item.revenue / item.ordersCount : 0

      const averageDeliveryFee =
        item.ordersCount > 0 ? item.deliveryFees / item.ordersCount : 0

      const revenueShare =
        totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0

      const ordersShare =
        totalOrders > 0 ? (item.ordersCount / totalOrders) * 100 : 0

      const trend = getTrendPercentage(item.recentOrders, item.previousOrders)
      const status = getNeighborhoodStatus({
        ordersCount: item.ordersCount,
        revenue: item.revenue,
        trend,
        revenueShare,
      })

      return {
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
        status: status.status,
        statusLabel: status.statusLabel,
      }
    })

    return items.sort((a, b) => {
      if (sortFilter === "orders") return b.ordersCount - a.ordersCount
      if (sortFilter === "ticket") return b.averageTicket - a.averageTicket
      if (sortFilter === "delivery") {
        return b.averageDeliveryFee - a.averageDeliveryFee
      }
      if (sortFilter === "trend") return b.trend - a.trend

      return b.revenue - a.revenue
    })
  }, [orders, paymentFilter, periodFilter, sortFilter])

  const filteredRanking = useMemo(() => {
    const search = searchTerm.toLowerCase().trim()

    return ranking.filter((item) => {
      if (!search) return true

      return item.name.toLowerCase().includes(search)
    })
  }, [ranking, searchTerm])

  const summary = useMemo(() => {
    const totalRevenue = ranking.reduce((sum, item) => sum + item.revenue, 0)
    const totalOrders = ranking.reduce((sum, item) => sum + item.ordersCount, 0)
    const totalCustomers = ranking.reduce(
      (sum, item) => sum + item.uniqueCustomers,
      0,
    )

    const bestNeighborhood = ranking[0] || null

    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0

    const neighborhoodsWithGrowth = ranking.filter((item) => item.trend > 0)
      .length

    return {
      totalRevenue,
      totalOrders,
      totalCustomers,
      bestNeighborhood,
      averageTicket,
      neighborhoodsCount: ranking.length,
      neighborhoodsWithGrowth,
    }
  }, [ranking])

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
    { value: "delivery", label: "Taxa entrega" },
    { value: "trend", label: "Crescimento" },
  ] as const

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#111111] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                    <MapIcon className="h-5 w-5" />
                  </div>

                  <div>
                    <h1 className="text-xl font-bold text-white">
                      Radar de Bairros
                    </h1>
                    <p className="text-sm text-zinc-500">
                      Descubra quais regiões mais compram, onde vale fazer ação
                      local e onde a entrega pesa mais.
                    </p>
                  </div>
                </div>

                {restaurant?.name ? (
                  <p className="text-xs font-medium text-zinc-500">
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
                  className="h-10 rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold text-zinc-500 outline-none transition focus:border-emerald-400/50 focus:ring-4 focus:ring-emerald-400/20"
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
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0A0A0A] px-4 text-sm font-semibold text-zinc-500 transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
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
            <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-white/10 bg-[#0A0A0A]">
              <div className="flex flex-col items-center gap-3 text-zinc-500">
                <Loader2 className="h-7 w-7 animate-spin" />
                <p className="text-sm font-medium">
                  Carregando radar de bairros...
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                    <BadgeDollarSign className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-zinc-500">
                    Faturamento no período
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {formatMoney(summary.totalRevenue)}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-400">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-zinc-500">
                    Pedidos mapeados
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {formatNumber(summary.totalOrders)}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-400">
                    <Navigation className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-zinc-500">
                    Bairros ativos
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {formatNumber(summary.neighborhoodsCount)}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-400">
                    <Target className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-zinc-500">
                    Ticket médio geral
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {formatMoney(summary.averageTicket)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-yellow-500" />
                    <h2 className="text-base font-bold text-white">
                      Bairro campeão
                    </h2>
                  </div>

                  {summary.bestNeighborhood ? (
                    <div className="rounded-2xl bg-yellow-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xl font-black text-yellow-950">
                            {summary.bestNeighborhood.name}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-yellow-800/80">
                            {summary.bestNeighborhood.ordersCount} pedido(s) •{" "}
                            {formatMoney(summary.bestNeighborhood.revenue)}
                          </p>
                        </div>

                        <span className="rounded-full bg-yellow-200 px-3 py-1 text-xs font-black text-yellow-900">
                          {formatPercent(summary.bestNeighborhood.revenueShare)} da
                          receita
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-[#111111] p-4 text-sm font-medium text-zinc-500">
                      Nenhum bairro encontrado no período.
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                    <h2 className="text-base font-bold text-white">
                      Crescimento regional
                    </h2>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-emerald-500/10 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-400">
                        Bairros crescendo
                      </p>
                      <p className="mt-1 text-2xl font-black text-emerald-400">
                        {summary.neighborhoodsWithGrowth}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#111111] p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                        Clientes únicos
                      </p>
                      <p className="mt-1 text-2xl font-black text-white">
                        {formatNumber(summary.totalCustomers)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] shadow-sm">
                <div className="border-b border-white/10 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-base font-bold text-white">
                        Ranking por bairro
                      </h2>
                      <p className="text-sm text-zinc-500">
                        Veja onde entram mais pedidos e onde existe oportunidade
                        de campanha local.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input
                          value={searchTerm}
                          onChange={(event) =>
                            setSearchTerm(event.target.value)
                          }
                          placeholder="Buscar bairro..."
                          className="h-10 w-full rounded-xl border border-white/10 bg-[#0A0A0A] pl-9 pr-3 text-sm font-medium outline-none transition placeholder:text-zinc-500 focus:border-emerald-400/50 focus:ring-4 focus:ring-emerald-400/20 sm:w-64"
                        />
                      </div>

                      <select
                        value={paymentFilter}
                        onChange={(event) =>
                          setPaymentFilter(event.target.value as PaymentFilter)
                        }
                        className="h-10 rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold text-zinc-500 outline-none transition focus:border-emerald-400/50 focus:ring-4 focus:ring-emerald-400/20"
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
                        className="h-10 rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold text-zinc-500 outline-none transition focus:border-emerald-400/50 focus:ring-4 focus:ring-emerald-400/20"
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

                <div className="p-5">
                  {filteredRanking.length > 0 ? (
                    <div className="space-y-3">
                      {filteredRanking.map((item, index) => (
                        <div
                          key={item.key}
                          className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm transition hover:border-emerald-400/30 hover:bg-emerald-500/15"
                        >
                          <div className="grid gap-4 xl:grid-cols-[60px_minmax(0,1fr)_180px_180px_160px_160px] xl:items-center">
                            <div className="flex items-center gap-3 xl:block">
                              <div
                                className={cn(
                                  "flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-black",
                                  index === 0 && "bg-yellow-100 text-yellow-700",
                                  index === 1 && "bg-[#111111] text-zinc-500",
                                  index === 2 && "bg-yellow-400/10 text-yellow-400",
                                  index > 2 && "bg-emerald-500/10 text-emerald-400",
                                )}
                              >
                                #{index + 1}
                              </div>

                              <div className="xl:hidden">
                                <p className="text-base font-black text-white">
                                  {item.name}
                                </p>
                                <p className="text-sm font-semibold text-zinc-500">
                                  {item.ordersCount} pedido(s)
                                </p>
                              </div>
                            </div>

                            <div className="min-w-0">
                              <div className="hidden xl:block">
                                <p className="line-clamp-1 text-base font-black text-white">
                                  {item.name}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-zinc-500">
                                  {item.uniqueCustomers} cliente(s) único(s)
                                </p>
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-2 xl:mt-0">
                                <span
                                  className={cn(
                                    "rounded-full px-2.5 py-1 text-xs font-black",
                                    item.status === "hot" &&
                                      "bg-emerald-500/10 text-emerald-400",
                                    item.status === "growth" &&
                                      "bg-yellow-400/10 text-yellow-400",
                                    item.status === "attention" &&
                                      "bg-yellow-400/10 text-yellow-400",
                                    item.status === "weak" &&
                                      "bg-[#111111] text-zinc-500",
                                  )}
                                >
                                  {item.statusLabel}
                                </span>

                                <span className="rounded-full bg-[#111111] px-2.5 py-1 text-xs font-black text-zinc-500">
                                  {formatPercent(item.revenueShare)} da receita
                                </span>

                                {item.trend !== 0 ? (
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black",
                                      item.trend > 0
                                        ? "bg-emerald-500/10 text-emerald-400"
                                        : "bg-red-100 text-red-700",
                                    )}
                                  >
                                    {item.trend > 0 ? (
                                      <ArrowUp className="h-3 w-3" />
                                    ) : (
                                      <ArrowDown className="h-3 w-3" />
                                    )}
                                    {formatPercent(Math.abs(item.trend))}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="rounded-2xl bg-[#111111] p-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                                Faturamento
                              </p>
                              <p className="mt-1 text-base font-black text-white">
                                {formatMoney(item.revenue)}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-[#111111] p-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                                Pedidos
                              </p>
                              <p className="mt-1 text-base font-black text-white">
                                {item.ordersCount}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-[#111111] p-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                                Ticket médio
                              </p>
                              <p className="mt-1 text-base font-black text-white">
                                {formatMoney(item.averageTicket)}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-[#111111] p-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                                Taxa média
                              </p>
                              <p className="mt-1 text-base font-black text-white">
                                {formatMoney(item.averageDeliveryFee)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 p-3 text-sm font-bold text-emerald-400">
                              <ShoppingBag className="h-4 w-4" />
                              {item.paidOrdersCount} pago(s)
                            </div>

                            <div className="flex items-center gap-2 rounded-2xl bg-yellow-400/10 p-3 text-sm font-bold text-yellow-400">
                              <Percent className="h-4 w-4" />
                              {formatPercent(item.ordersShare)} dos pedidos
                            </div>

                            <div className="flex items-center gap-2 rounded-2xl bg-yellow-400/10 p-3 text-sm font-bold text-yellow-400">
                              <MapPin className="h-4 w-4" />
                              {item.lastOrderDate
                                ? `Último pedido em ${item.lastOrderDate.toLocaleDateString("pt-BR")}`
                                : "Sem data recente"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 bg-[#111111] p-10 text-center">
                      <MapPin className="mx-auto h-8 w-8 text-zinc-500" />
                      <p className="mt-3 text-sm font-bold text-zinc-500">
                        Nenhum bairro encontrado
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        Tente mudar os filtros ou aguarde novos pedidos com
                        bairro preenchido.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
                  <div>
                    <p className="font-black">Como usar esse radar</p>
                    <p className="mt-1 font-medium">
                      Use os bairros fortes para campanhas locais e os bairros
                      com ticket médio alto para ofertas premium. Se a taxa média
                      de entrega estiver alta em um bairro, avalie pedido mínimo,
                      taxa diferenciada ou campanha com retirada.
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