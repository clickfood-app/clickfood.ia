"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import {
  BarChart3,
  BadgePercent,
  DollarSign,
  Loader2,
  Package,
  ShoppingCart,
  TrendingUp,
} from "lucide-react"

type PeriodKey = "today" | "7d" | "30d"

type ProductMetric = {
  name: string
  total: number
}

type CouponMetric = {
  name: string
  total: number
}

type RevenueMetric = {
  label: string
  total: number
}

type DashboardData = {
  revenue: number
  orders: number
  averageTicket: number
  bestCoupon: string
  topProducts: ProductMetric[]
  topCoupons: CouponMetric[]
  revenueByDay: RevenueMetric[]
}

type OrderRow = {
  id: string
  total: number
  created_at: string
}

type CouponRow = {
  code: string
  used_count: number
}

type OrderItemRow = {
  product_name: string
  quantity: number
}

const emptyDashboard: DashboardData = {
  revenue: 0,
  orders: 0,
  averageTicket: 0,
  bestCoupon: "-",
  topProducts: [],
  topCoupons: [],
  revenueByDay: [],
}

function getPeriodStart(period: PeriodKey) {
  const now = new Date()

  if (period === "today") {
    now.setHours(0, 0, 0, 0)
    return now.toISOString()
  }

  if (period === "7d") {
    now.setDate(now.getDate() - 6)
    now.setHours(0, 0, 0, 0)
    return now.toISOString()
  }

  now.setDate(now.getDate() - 29)
  now.setHours(0, 0, 0, 0)
  return now.toISOString()
}

function buildRevenueByDay(orders: OrderRow[], period: PeriodKey): RevenueMetric[] {
  if (period === "today") {
    const grouped = new Map<string, number>()

    for (const order of orders) {
      const date = new Date(order.created_at)
      const label = `${String(date.getHours()).padStart(2, "0")}h`
      grouped.set(label, (grouped.get(label) ?? 0) + Number(order.total))
    }

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, total]) => ({ label, total }))
  }

  if (period === "7d") {
    const grouped = new Map<string, number>()
    const formatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })

    for (const order of orders) {
      const date = new Date(order.created_at)
      const raw = formatter.format(date).replace(".", "")
      const label = raw.charAt(0).toUpperCase() + raw.slice(1)
      grouped.set(label, (grouped.get(label) ?? 0) + Number(order.total))
    }

    return Array.from(grouped.entries()).map(([label, total]) => ({
      label,
      total,
    }))
  }

  const grouped = new Map<string, number>()

  for (const order of orders) {
    const date = new Date(order.created_at)
    const day = date.getDate()
    const bucket = day <= 7 ? "S1" : day <= 14 ? "S2" : day <= 21 ? "S3" : "S4"
    grouped.set(bucket, (grouped.get(bucket) ?? 0) + Number(order.total))
  }

  return ["S1", "S2", "S3", "S4"].map((label) => ({
    label,
    total: grouped.get(label) ?? 0,
  }))
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
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
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  )
}

function StatCard({
  title,
  value,
  icon,
  subtitle,
}: {
  title: string
  value: string
  icon: React.ReactNode
  subtitle?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          {icon}
        </div>
      </div>
    </div>
  )
}

function HorizontalBarChart({
  title,
  icon,
  data,
  valueLabel,
}: {
  title: string
  icon: React.ReactNode
  data: { name: string; total: number }[]
  valueLabel?: (value: number) => string
}) {
  const maxValue = Math.max(...data.map((item) => item.total), 1)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex items-center gap-2">
        <div className="text-slate-500">{icon}</div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>

      {data.length === 0 ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
          Nenhum dado encontrado
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((item) => {
            const width = (item.total / maxValue) * 100

            return (
              <div key={item.name} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium text-slate-700">
                    {item.name}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {valueLabel ? valueLabel(item.total) : item.total}
                  </span>
                </div>

                <div className="h-2.5 rounded-full bg-slate-100">
                  <div
                    className="h-2.5 rounded-full bg-slate-900 transition-all"
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

function VerticalBarChart({
  title,
  icon,
  data,
}: {
  title: string
  icon: React.ReactNode
  data: RevenueMetric[]
}) {
  const maxValue = Math.max(...data.map((item) => item.total), 1)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex items-center gap-2">
        <div className="text-slate-500">{icon}</div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>

      {data.length === 0 ? (
        <div className="flex min-h-[288px] items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
          Nenhum dado encontrado
        </div>
      ) : (
        <div className="flex h-72 items-end gap-3">
          {data.map((item) => {
            const height = (item.total / maxValue) * 100

            return (
              <div key={item.label} className="flex flex-1 flex-col items-center justify-end gap-2">
                <span className="text-xs font-medium text-slate-500">
                  {formatCurrency(item.total)}
                </span>

                <div className="flex h-56 w-full items-end rounded-xl bg-slate-100 p-1">
                  <div
                    className="w-full rounded-lg bg-slate-900 transition-all"
                    style={{ height: `${height}%` }}
                  />
                </div>

                <span className="text-xs font-semibold text-slate-700">{item.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RankingCard({
  title,
  items,
  suffix,
}: {
  title: string
  items: { name: string; total: number }[]
  suffix?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>

      {items.length === 0 ? (
        <div className="flex min-h-[288px] items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
          Nenhum dado encontrado
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.name}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <span className="text-sm font-medium text-slate-800">{item.name}</span>
              </div>

              <span className="text-sm font-semibold text-slate-900">
                {item.total}
                {suffix ? ` ${suffix}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function GestaoPage() {
  const supabase = useMemo(() => createClient(), [])
  const [period, setPeriod] = useState<PeriodKey>("7d")
  const [data, setData] = useState<DashboardData>(emptyDashboard)
  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState("")

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
        .select("id")
        .eq("owner_id", user.id)
        .single()

      if (restaurantError || !restaurant) {
        throw new Error("Restaurante não encontrado para esse usuário.")
      }

      const periodStart = getPeriodStart(period)

      const [
        { data: ordersData, error: ordersError },
        { data: orderItemsData, error: orderItemsError },
        { data: couponsData, error: couponsError },
      ] = await Promise.all([
        supabase
          .from("orders")
          .select("id, total, created_at")
          .eq("restaurant_id", restaurant.id)
          .gte("created_at", periodStart)
          .order("created_at", { ascending: true }),

        supabase
          .from("order_items")
          .select("product_name, quantity, orders!inner(created_at, restaurant_id)")
          .eq("orders.restaurant_id", restaurant.id)
          .gte("orders.created_at", periodStart),

        supabase
          .from("coupons")
          .select("code, used_count")
          .eq("restaurant_id", restaurant.id)
          .order("used_count", { ascending: false })
          .limit(5),
      ])

      if (ordersError) throw ordersError
      if (orderItemsError) throw orderItemsError
      if (couponsError) throw couponsError

      const orders = (ordersData ?? []) as OrderRow[]
      const orderItems = (orderItemsData ?? []) as OrderItemRow[]
      const coupons = (couponsData ?? []) as CouponRow[]

      const revenue = orders.reduce((sum, order) => sum + Number(order.total), 0)
      const ordersCount = orders.length
      const averageTicket = ordersCount > 0 ? revenue / ordersCount : 0

      const productMap = new Map<string, number>()

      for (const item of orderItems) {
        const name = item.product_name
        const quantity = Number(item.quantity ?? 0)
        productMap.set(name, (productMap.get(name) ?? 0) + quantity)
      }

      const topProducts = Array.from(productMap.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)

      const topCoupons = coupons
        .map((coupon) => ({
          name: coupon.code,
          total: Number(coupon.used_count ?? 0),
        }))
        .filter((coupon) => coupon.total > 0)

      setData({
        revenue,
        orders: ordersCount,
        averageTicket,
        bestCoupon: topCoupons[0]?.name ?? "-",
        topProducts,
        topCoupons,
        revenueByDay: buildRevenueByDay(orders, period),
      })
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
    loadDashboard()
  }, [loadDashboard])

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Gestão</h1>
            <p className="mt-1 text-sm text-slate-600">
              Acompanhe desempenho, faturamento, produtos e cupons do seu restaurante.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <PeriodButton
              label="Hoje"
              active={period === "today"}
              onClick={() => setPeriod("today")}
            />
            <PeriodButton
              label="7 dias"
              active={period === "7d"}
              onClick={() => setPeriod("7d")}
            />
            <PeriodButton
              label="30 dias"
              active={period === "30d"}
              onClick={() => setPeriod("30d")}
            />
          </div>
        </div>

        {pageError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {pageError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="inline-flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando dados da gestão...
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Faturamento"
                value={formatCurrency(data.revenue)}
                subtitle="Total do período selecionado"
                icon={<DollarSign className="h-5 w-5" />}
              />
              <StatCard
                title="Pedidos"
                value={String(data.orders)}
                subtitle="Quantidade total de pedidos"
                icon={<ShoppingCart className="h-5 w-5" />}
              />
              <StatCard
                title="Ticket médio"
                value={formatCurrency(data.averageTicket)}
                subtitle="Média por pedido"
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <StatCard
                title="Cupom destaque"
                value={data.bestCoupon}
                subtitle="Cupom com melhor desempenho"
                icon={<BadgePercent className="h-5 w-5" />}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <HorizontalBarChart
                title="Produtos que mais saem"
                icon={<Package className="h-5 w-5" />}
                data={data.topProducts}
              />

              <HorizontalBarChart
                title="Cupons que mais funcionam"
                icon={<BadgePercent className="h-5 w-5" />}
                data={data.topCoupons}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
              <VerticalBarChart
                title="Faturamento no período"
                icon={<BarChart3 className="h-5 w-5" />}
                data={data.revenueByDay}
              />

              <RankingCard
                title="Ranking de produtos"
                items={data.topProducts}
                suffix="un."
              />
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}