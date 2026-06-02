"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CreditCard,
  DollarSign,
  FileText,
  Loader2,
  Package,
  PieChart,
  RefreshCcw,
  ShoppingBag,
  Target,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type RawRow = Record<string, any>

type Order = {
  id: string
  total: number
  subtotal: number
  delivery_fee: number
  payment_method: string | null
  payment_status: string | null
  status: string | null
  order_source: string | null
  created_at: string
}

type AccountPayable = {
  id: string
  description: string
  category: string | null
  amount: number
  due_date: string | null
  paid_at: string | null
  payment_method: string | null
  status: string | null
  created_at: string | null
}

type OrderItem = {
  id: string
  order_id: string
  product_name: string
  quantity: number
  total: number
}

type CashClosing = {
  id: string
  closing_date: string
  gross_revenue: number
  manual_income: number
  expenses: number
  estimated_profit: number
  pix_total: number
  cash_total: number
  card_total: number
  orders_count: number
  average_ticket: number
  closed_at: string | null
}

type SupplierPurchase = {
  id: string
  supplier_id: string | null
  supplier_name: string
  amount: number
  status: string | null
  payment_status: string | null
  date: string | null
}

type DeliverySettlement = {
  id: string
  delivery_person_name: string
  amount: number
  status: string | null
  date: string | null
}

type RankingItem = {
  label: string
  value: number
  helper?: string
}

type CostAreaItem = {
  label: string
  paid: number
  pending: number
  total: number
  count: number
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function monthStart() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")

  return `${year}-${month}-01`
}

function lastThirtyDaysStart() {
  const date = new Date()
  date.setDate(date.getDate() - 29)
  return date.toISOString().slice(0, 10)
}

function getDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  end.setDate(end.getDate() + 1)

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

function isInsidePeriod(value: string | null | undefined, startDate: string, endDate: string) {
  if (!value) return false

  const date = value.slice(0, 10)
  return date >= startDate && date <= endDate
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getFirstValue(row: RawRow, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key]
    }
  }

  return null
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function formatWeekday(value: string | null | undefined) {
  if (!value) return "Sem dia"

  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`))

  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function normalizePaymentMethod(method: string | null) {
  const value = (method || "").toLowerCase()

  if (value.includes("pix") || value.includes("asaas") || value.includes("mercado_pago")) {
    return "Pix"
  }

  if (value.includes("dinheiro") || value.includes("cash") || value.includes("money")) {
    return "Dinheiro"
  }

  if (
    value.includes("cart") ||
    value.includes("card") ||
    value.includes("credito") ||
    value.includes("crédito") ||
    value.includes("debito") ||
    value.includes("débito")
  ) {
    return "Cartão"
  }

  return "Outros"
}

function normalizeSalesChannel(order: Order) {
  const source = (order.order_source || "").toLowerCase()
  const status = (order.status || "").toLowerCase()

  if (
    source.includes("waiter") ||
    source.includes("garcom") ||
    source.includes("garçom") ||
    source.includes("mesa") ||
    source.includes("table")
  ) {
    return "Garçom / Mesas"
  }

  if (
    source.includes("manual") ||
    source.includes("admin") ||
    source.includes("painel") ||
    source.includes("counter")
  ) {
    return "Manual / Balcão"
  }

  if (
    source.includes("public") ||
    source.includes("cardapio") ||
    source.includes("cardápio") ||
    source.includes("online") ||
    source.includes("site")
  ) {
    return "Cardápio online"
  }

  if (status.includes("table") || status.includes("mesa")) {
    return "Garçom / Mesas"
  }

  return "Não informado"
}

function expenseGroup(expense: AccountPayable) {
  const text = `${expense.category || ""} ${expense.description || ""}`.toLowerCase()

  if (
    text.includes("funcionários / fixos") ||
    text.includes("funcionarios / fixos") ||
    text.includes("folha fixa") ||
    text.includes("salário") ||
    text.includes("salario") ||
    text.includes("fixo")
  ) {
    return "Folha fixa"
  }

  if (
    text.includes("freelancer") ||
    text.includes("diária") ||
    text.includes("diaria") ||
    text.includes("diarista")
  ) {
    return "Freelancers / Diárias"
  }

  if (
    text.includes("entregador") ||
    text.includes("motoboy") ||
    text.includes("delivery") ||
    text.includes("entrega")
  ) {
    return "Entregadores"
  }

  if (
    text.includes("fornecedor") ||
    text.includes("compra") ||
    text.includes("insumo") ||
    text.includes("estoque") ||
    text.includes("mercadoria")
  ) {
    return "Fornecedores"
  }

  return "Outras despesas"
}

function isPaidStatus(status: string | null | undefined) {
  const value = (status || "").toLowerCase()
  return value === "paid" || value === "pago" || value === "concluido" || value === "concluído"
}

function maxValue(items: RankingItem[]) {
  return Math.max(...items.map((item) => item.value), 1)
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0
  return (value / total) * 100
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center text-sm text-slate-500">
      {text}
    </div>
  )
}

function ScrollableBox({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "overflow-y-auto pr-1 [scrollbar-color:theme(colors.slate.300)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400",
        className,
      )}
    >
      {children}
    </div>
  )
}

function SectionCard({
  title,
  subtitle,
  icon,
  children,
  className,
}: {
  title: string
  subtitle?: string
  icon: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm shadow-slate-200/40 sm:rounded-3xl sm:p-4",
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
        <div className="flex min-w-0 items-start gap-2 sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 sm:h-10 sm:w-10 sm:rounded-2xl">
            {icon}
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-950 sm:text-base">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500 sm:text-sm">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {children}
    </section>
  )
}

function KpiCard({
  title,
  value,
  helper,
  icon,
  tone = "slate",
}: {
  title: string
  value: string
  helper?: string
  icon: ReactNode
  tone?: "slate" | "emerald" | "violet" | "orange" | "red" | "blue"
}) {
  const toneStyles = {
    slate: "border-slate-200 bg-gradient-to-br from-white to-slate-50 text-slate-950",
    emerald: "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/70 text-emerald-900",
    violet: "border-violet-200 bg-gradient-to-br from-violet-50 via-white to-violet-50/70 text-violet-900",
    orange: "border-orange-200 bg-gradient-to-br from-orange-50 via-white to-orange-50/70 text-orange-900",
    red: "border-red-200 bg-gradient-to-br from-red-50 via-white to-red-50/70 text-red-900",
    blue: "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/70 text-blue-900",
  }

  const iconStyles = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    violet: "bg-violet-100 text-violet-700",
    orange: "bg-orange-100 text-orange-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  }

  return (
    <div className={cn("rounded-2xl border p-3 shadow-sm sm:rounded-3xl sm:p-4", toneStyles[tone])}>
      <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">
            {title}
          </p>

          <strong className="mt-1.5 block truncate text-xl font-bold tracking-tight sm:mt-2 sm:text-2xl">
            {value}
          </strong>
        </div>

        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl",
            iconStyles[tone],
          )}
        >
          {icon}
        </div>
      </div>

      {helper ? (
        <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-xs leading-relaxed text-slate-600 sm:rounded-2xl">
          {helper}
        </div>
      ) : null}
    </div>
  )
}

function InsightCard({
  title,
  value,
  helper,
  tone = "slate",
}: {
  title: string
  value: string
  helper?: string
  tone?: "slate" | "emerald" | "violet" | "orange"
}) {
  const styles = {
    slate: "border-slate-200 bg-slate-50",
    emerald: "border-emerald-200 bg-emerald-50",
    violet: "border-violet-200 bg-violet-50",
    orange: "border-orange-200 bg-orange-50",
  }

  return (
    <div className={cn("rounded-2xl border p-3", styles[tone])}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-[11px]">
        {title}
      </p>

      <strong className="mt-1 block text-sm font-semibold leading-snug text-slate-950 sm:text-base">
        {value}
      </strong>

      {helper ? (
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          {helper}
        </p>
      ) : null}
    </div>
  )
}

function RankingRows({
  items,
  emptyText,
  valueFormatter = formatCurrency,
  barTone = "bg-violet-600",
}: {
  items: RankingItem[]
  emptyText: string
  valueFormatter?: (value: number) => string
  barTone?: string
}) {
  const max = maxValue(items)

  if (items.length === 0) {
    return <EmptyState text={emptyText} />
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{item.label}</p>
              {item.helper ? <p className="text-xs text-slate-500">{item.helper}</p> : null}
            </div>
            <strong className="shrink-0 text-slate-950">{valueFormatter(item.value)}</strong>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/70">
            <div
              className={cn("h-full rounded-full", barTone)}
              style={{ width: `${Math.min((item.value / max) * 100, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function CompactTable({
  headers,
  rows,
  emptyText,
}: {
  headers: string[]
  rows: ReactNode[][]
  emptyText: string
}) {
  if (rows.length === 0) {
    return <EmptyState text={emptyText} />
  }

  return (
    <>
      <div className="space-y-3 sm:hidden">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
          >
            <div className="space-y-2">
              {row.map((cell, cellIndex) => (
                <div
                  key={cellIndex}
                  className="flex items-start justify-between gap-3 border-b border-slate-200/70 pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {headers[cellIndex]}
                  </span>

                  <div className="text-right text-sm text-slate-800">
                    {cell}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.16em] text-slate-500">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-4 py-3 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-slate-50/70">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3 align-middle text-slate-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function RevenueBars({
  items,
  emptyText,
}: {
  items: RankingItem[]
  emptyText: string
}) {
  const max = maxValue(items)

  if (items.length === 0) {
    return <EmptyState text={emptyText} />
  }

  return (
    <>
      <div className="space-y-3 sm:hidden">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-3"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                {item.helper ? <p className="text-xs text-slate-500">{item.helper}</p> : null}
              </div>

              <strong className="text-sm font-bold text-slate-950">
                {formatCurrency(item.value)}
              </strong>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.min((item.value / max) * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:block">
        <div className="flex h-[260px] items-end gap-2 overflow-x-auto pb-2">
          {items.map((item) => {
            const barHeight = Math.max((item.value / max) * 100, 12)

            return (
              <div key={item.label} className="flex min-w-[68px] flex-1 flex-col items-center justify-end gap-2">
                <div className="text-center text-[11px] font-semibold text-slate-700">
                  {formatCurrency(item.value)}
                </div>

                <div className="flex h-[180px] w-full items-end justify-center">
                  <div
                    className="w-full rounded-t-2xl bg-gradient-to-t from-emerald-500 via-emerald-400 to-emerald-300 shadow-sm shadow-emerald-200"
                    style={{ height: `${barHeight}%` }}
                  />
                </div>

                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                  {item.helper ? <p className="text-[11px] text-slate-500">{item.helper}</p> : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function CostDistribution({
  items,
  total,
}: {
  items: CostAreaItem[]
  total: number
}) {
  if (items.length === 0) {
    return <EmptyState text="Nenhum custo encontrado no período." />
  }

  const ordered = [...items].sort((a, b) => b.total - a.total)
  const biggest = Math.max(...ordered.map((item) => item.total), 1)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-[11px] sm:tracking-[0.16em]">
              Total dos custos principais
            </p>
            <strong className="text-lg font-bold text-slate-950 sm:text-xl">{formatCurrency(total)}</strong>
          </div>
          <div className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-[11px] sm:tracking-[0.16em]">
              Áreas
            </p>
            <strong className="text-base font-bold text-slate-950">{ordered.length}</strong>
          </div>
        </div>

        <ScrollableBox className="max-h-[520px] space-y-3 sm:max-h-[560px] sm:space-y-4">
          {ordered.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500">
                    {item.count} registro{item.count === 1 ? "" : "s"}
                  </p>
                </div>
                <strong className="shrink-0 text-sm text-slate-950 sm:text-base">
                  {formatCurrency(item.total)}
                </strong>
              </div>

              <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                  style={{ width: `${Math.min((item.total / biggest) * 100, 100)}%` }}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-emerald-50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 sm:text-[11px]">
                    Pago
                  </p>
                  <strong className="text-sm font-semibold text-emerald-700">
                    {formatCurrency(item.paid)}
                  </strong>
                </div>
                <div className="rounded-xl bg-orange-50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-700 sm:text-[11px]">
                    Pendente
                  </p>
                  <strong className="text-sm font-semibold text-orange-700">
                    {formatCurrency(item.pending)}
                  </strong>
                </div>
                <div className="rounded-xl bg-slate-100 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 sm:text-[11px]">
                    Peso
                  </p>
                  <strong className="text-sm font-semibold text-slate-900">
                    {formatPercent(percentage(item.total, total))}
                  </strong>
                </div>
              </div>
            </div>
          ))}
        </ScrollableBox>
      </div>
    </div>
  )
}

export default function RelatoriosFinanceirosPage() {
  const supabase = createClient()

  const [orders, setOrders] = useState<Order[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [expenses, setExpenses] = useState<AccountPayable[]>([])
  const [closings, setClosings] = useState<CashClosing[]>([])
  const [supplierPurchases, setSupplierPurchases] = useState<SupplierPurchase[]>([])
  const [deliverySettlements, setDeliverySettlements] = useState<DeliverySettlement[]>([])
  const [loading, setLoading] = useState(true)

  const [startDate, setStartDate] = useState(monthStart())
  const [endDate, setEndDate] = useState(todayDate())

  const paidOrders = useMemo(
    () => orders.filter((order) => isPaidStatus(order.payment_status)),
    [orders],
  )

  const pendingOrders = useMemo(
    () => orders.filter((order) => !isPaidStatus(order.payment_status)),
    [orders],
  )

  const paidExpenses = useMemo(
    () => expenses.filter((expense) => isPaidStatus(expense.status)),
    [expenses],
  )

  const pendingExpenses = useMemo(
    () => expenses.filter((expense) => !isPaidStatus(expense.status)),
    [expenses],
  )

  const totals = useMemo(() => {
    const revenue = paidOrders.reduce((acc, order) => acc + order.total, 0)
    const pendingRevenue = pendingOrders.reduce((acc, order) => acc + order.total, 0)

    const paidExpenseTotal = paidExpenses.reduce((acc, expense) => acc + expense.amount, 0)
    const pendingExpenseTotal = pendingExpenses.reduce((acc, expense) => acc + expense.amount, 0)

    const deliveryFees = paidOrders.reduce((acc, order) => acc + order.delivery_fee, 0)
    const deliveryFeesAllOrders = orders.reduce((acc, order) => acc + order.delivery_fee, 0)

    const averageTicket = paidOrders.length > 0 ? revenue / paidOrders.length : 0
    const balance = revenue - paidExpenseTotal
    const totalCostWithPending = paidExpenseTotal + pendingExpenseTotal

    return {
      revenue,
      pendingRevenue,
      paidExpenseTotal,
      pendingExpenseTotal,
      deliveryFees,
      deliveryFeesAllOrders,
      averageTicket,
      balance,
      totalCostWithPending,
      paidOrdersCount: paidOrders.length,
      pendingOrdersCount: pendingOrders.length,
      totalOrdersCount: orders.length,
    }
  }, [orders, paidExpenses, paidOrders, pendingExpenses, pendingOrders])

  const costsByGroup = useMemo(() => {
    const groups: Record<string, { paid: number; pending: number; count: number }> = {
      "Folha fixa": { paid: 0, pending: 0, count: 0 },
      "Freelancers / Diárias": { paid: 0, pending: 0, count: 0 },
      Entregadores: { paid: 0, pending: 0, count: 0 },
      Fornecedores: { paid: 0, pending: 0, count: 0 },
      "Outras despesas": { paid: 0, pending: 0, count: 0 },
    }

    expenses.forEach((expense) => {
      const group = expenseGroup(expense)
      const target = groups[group] || groups["Outras despesas"]

      if (isPaidStatus(expense.status)) {
        target.paid += expense.amount
      } else {
        target.pending += expense.amount
      }

      target.count += 1
    })

    return Object.entries(groups).map(([label, data]) => ({
      label,
      paid: data.paid,
      pending: data.pending,
      total: data.paid + data.pending,
      count: data.count,
    }))
  }, [expenses])

  const fixedPayroll = useMemo(
    () => costsByGroup.find((item) => item.label === "Folha fixa")?.total || 0,
    [costsByGroup],
  )

  const freelancerCost = useMemo(
    () => costsByGroup.find((item) => item.label === "Freelancers / Diárias")?.total || 0,
    [costsByGroup],
  )

  const supplierCost = useMemo(() => {
    const purchasesTotal = supplierPurchases.reduce((acc, purchase) => acc + purchase.amount, 0)
    const payableTotal = costsByGroup.find((item) => item.label === "Fornecedores")?.total || 0

    return purchasesTotal > 0 ? purchasesTotal : payableTotal
  }, [costsByGroup, supplierPurchases])

  const deliveryCost = useMemo(() => {
    const settlementsTotal = deliverySettlements.reduce((acc, settlement) => acc + settlement.amount, 0)
    const payableTotal = costsByGroup.find((item) => item.label === "Entregadores")?.total || 0

    if (settlementsTotal > 0) return settlementsTotal
    if (payableTotal > 0) return payableTotal

    return totals.deliveryFees
  }, [costsByGroup, deliverySettlements, totals.deliveryFees])

  const otherCosts = useMemo(() => {
    return costsByGroup
      .filter((item) => item.label === "Outras despesas")
      .reduce((acc, item) => acc + item.total, 0)
  }, [costsByGroup])

  const operationalResult = useMemo(() => {
    return totals.revenue - fixedPayroll - freelancerCost - supplierCost - deliveryCost - otherCosts
  }, [deliveryCost, fixedPayroll, freelancerCost, otherCosts, supplierCost, totals.revenue])

  const totalMainCosts = useMemo(() => {
    return fixedPayroll + freelancerCost + supplierCost + deliveryCost + otherCosts
  }, [deliveryCost, fixedPayroll, freelancerCost, otherCosts, supplierCost])

  const costShare = useMemo(() => {
    return percentage(totalMainCosts, totals.revenue)
  }, [totalMainCosts, totals.revenue])

  const revenueByDay = useMemo(() => {
    const grouped = paidOrders.reduce<Record<string, { total: number; orders: number }>>((acc, order) => {
      const date = order.created_at.slice(0, 10)
      acc[date] = acc[date] || { total: 0, orders: 0 }
      acc[date].total += order.total
      acc[date].orders += 1
      return acc
    }, {})

    return Object.entries(grouped)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, data]) => ({
        label: formatDate(date),
        value: data.total,
        helper: `${data.orders} pedido${data.orders === 1 ? "" : "s"} pago${data.orders === 1 ? "" : "s"}`,
      }))
  }, [paidOrders])

  const topProducts = useMemo(() => {
    const paidOrderIds = new Set(paidOrders.map((order) => order.id))

    const grouped = orderItems
      .filter((item) => paidOrderIds.has(item.order_id))
      .reduce<Record<string, { quantity: number; total: number }>>((acc, item) => {
        const product = item.product_name || "Produto sem nome"
        acc[product] = acc[product] || { quantity: 0, total: 0 }
        acc[product].quantity += item.quantity
        acc[product].total += item.total
        return acc
      }, {})

    return Object.entries(grouped)
      .map(([product, data]) => ({
        label: product,
        value: data.total,
        helper: `${data.quantity} vendido${data.quantity === 1 ? "" : "s"}`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [orderItems, paidOrders])

  const salesChannels = useMemo(() => {
    const grouped = paidOrders.reduce<Record<string, { total: number; orders: number }>>((acc, order) => {
      const channel = normalizeSalesChannel(order)
      acc[channel] = acc[channel] || { total: 0, orders: 0 }
      acc[channel].total += order.total
      acc[channel].orders += 1
      return acc
    }, {})

    return Object.entries(grouped)
      .map(([channel, data]) => ({
        label: channel,
        value: data.total,
        helper: `${data.orders} pedido${data.orders === 1 ? "" : "s"}`,
      }))
      .sort((a, b) => b.value - a.value)
  }, [paidOrders])

  const paymentMethods = useMemo(() => {
    const grouped = paidOrders.reduce<Record<string, { total: number; orders: number }>>((acc, order) => {
      const method = normalizePaymentMethod(order.payment_method)
      acc[method] = acc[method] || { total: 0, orders: 0 }
      acc[method].total += order.total
      acc[method].orders += 1
      return acc
    }, {})

    return Object.entries(grouped)
      .map(([method, data]) => ({
        label: method,
        value: data.total,
        helper: `${data.orders} pedido${data.orders === 1 ? "" : "s"}`,
      }))
      .sort((a, b) => b.value - a.value)
  }, [paidOrders])

  const suppliersRanking = useMemo(() => {
    const grouped = supplierPurchases.reduce<Record<string, { total: number; count: number }>>((acc, purchase) => {
      const supplier = purchase.supplier_name || "Fornecedor não informado"
      acc[supplier] = acc[supplier] || { total: 0, count: 0 }
      acc[supplier].total += purchase.amount
      acc[supplier].count += 1
      return acc
    }, {})

    if (Object.keys(grouped).length === 0) {
      expenses
        .filter((expense) => expenseGroup(expense) === "Fornecedores")
        .forEach((expense) => {
          const supplier = expense.description || expense.category || "Fornecedor não informado"
          grouped[supplier] = grouped[supplier] || { total: 0, count: 0 }
          grouped[supplier].total += expense.amount
          grouped[supplier].count += 1
        })
    }

    return Object.entries(grouped)
      .map(([supplier, data]) => ({
        label: supplier,
        value: data.total,
        helper: `${data.count} registro${data.count === 1 ? "" : "s"}`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [expenses, supplierPurchases])

  const deliveryRanking = useMemo(() => {
    const grouped = deliverySettlements.reduce<Record<string, { total: number; count: number }>>((acc, settlement) => {
      const driver = settlement.delivery_person_name || "Entregador não informado"
      acc[driver] = acc[driver] || { total: 0, count: 0 }
      acc[driver].total += settlement.amount
      acc[driver].count += 1
      return acc
    }, {})

    return Object.entries(grouped)
      .map(([driver, data]) => ({
        label: driver,
        value: data.total,
        helper: `${data.count} acerto${data.count === 1 ? "" : "s"}`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [deliverySettlements])

  const displayCostAreas = useMemo<CostAreaItem[]>(() => {
    const getBaseGroup = (label: string) =>
      costsByGroup.find((item) => item.label === label) || {
        label,
        paid: 0,
        pending: 0,
        total: 0,
        count: 0,
      }

    const folha = getBaseGroup("Folha fixa")
    const freelancer = getBaseGroup("Freelancers / Diárias")
    const outras = getBaseGroup("Outras despesas")

    const supplierBase = getBaseGroup("Fornecedores")
    const supplierPaidFromPurchases = supplierPurchases
      .filter((purchase) => isPaidStatus(purchase.payment_status || purchase.status))
      .reduce((acc, purchase) => acc + purchase.amount, 0)

    const supplierPendingFromPurchases = supplierPurchases
      .filter((purchase) => !isPaidStatus(purchase.payment_status || purchase.status))
      .reduce((acc, purchase) => acc + purchase.amount, 0)

    const supplierArea: CostAreaItem =
      supplierPurchases.length > 0
        ? {
            label: "Fornecedores",
            paid: supplierPaidFromPurchases,
            pending: supplierPendingFromPurchases,
            total: supplierPaidFromPurchases + supplierPendingFromPurchases,
            count: supplierPurchases.length,
          }
        : supplierBase

    const deliveryBase = getBaseGroup("Entregadores")
    const deliveryPaidFromSettlements = deliverySettlements
      .filter((settlement) => isPaidStatus(settlement.status))
      .reduce((acc, settlement) => acc + settlement.amount, 0)

    const deliveryPendingFromSettlements = deliverySettlements
      .filter((settlement) => !isPaidStatus(settlement.status))
      .reduce((acc, settlement) => acc + settlement.amount, 0)

    const deliveryArea: CostAreaItem =
      deliverySettlements.length > 0
        ? {
            label: "Entregadores",
            paid: deliveryPaidFromSettlements,
            pending: deliveryPendingFromSettlements,
            total: deliveryPaidFromSettlements + deliveryPendingFromSettlements,
            count: deliverySettlements.length,
          }
        : {
            label: "Entregadores",
            paid: deliveryBase.paid > 0 ? deliveryBase.paid : totals.deliveryFees,
            pending:
              deliveryBase.pending > 0
                ? deliveryBase.pending
                : Math.max(totals.deliveryFeesAllOrders - totals.deliveryFees, 0),
            total:
              (deliveryBase.paid > 0 ? deliveryBase.paid : totals.deliveryFees) +
              (deliveryBase.pending > 0
                ? deliveryBase.pending
                : Math.max(totals.deliveryFeesAllOrders - totals.deliveryFees, 0)),
            count: deliveryBase.count,
          }

    return [
      {
        label: "Folha fixa",
        paid: folha.paid,
        pending: folha.pending,
        total: folha.total,
        count: folha.count,
      },
      {
        label: "Freelancers / Diárias",
        paid: freelancer.paid,
        pending: freelancer.pending,
        total: freelancer.total,
        count: freelancer.count,
      },
      deliveryArea,
      supplierArea,
      {
        label: "Outras despesas",
        paid: outras.paid,
        pending: outras.pending,
        total: outras.total,
        count: outras.count,
      },
    ]
  }, [costsByGroup, deliverySettlements, supplierPurchases, totals.deliveryFees, totals.deliveryFeesAllOrders])

  const biggestCost = useMemo(() => {
    const ordered = [...displayCostAreas].sort((a, b) => b.total - a.total)
    return ordered[0] || null
  }, [displayCostAreas])

  const supplierAreaSummary = useMemo(() => {
    return displayCostAreas.find((item) => item.label === "Fornecedores") || {
      label: "Fornecedores",
      paid: 0,
      pending: 0,
      total: 0,
      count: 0,
    }
  }, [displayCostAreas])

  const deliveryAreaSummary = useMemo(() => {
    return displayCostAreas.find((item) => item.label === "Entregadores") || {
      label: "Entregadores",
      paid: 0,
      pending: 0,
      total: 0,
      count: 0,
    }
  }, [displayCostAreas])

  const averageDeliveryCost = useMemo(() => {
    if (totals.paidOrdersCount <= 0) return 0
    return totals.deliveryFees / totals.paidOrdersCount
  }, [totals.deliveryFees, totals.paidOrdersCount])

  const deliveryShare = useMemo(() => {
    return percentage(deliveryAreaSummary.total, totals.revenue)
  }, [deliveryAreaSummary.total, totals.revenue])

  const bestProduct = useMemo(() => topProducts[0] || null, [topProducts])
  const bestChannel = useMemo(() => salesChannels[0] || null, [salesChannels])
  const bestPaymentMethod = useMemo(() => paymentMethods[0] || null, [paymentMethods])

  const priorityText = useMemo(() => {
    if (totals.pendingRevenue > totals.revenue * 0.35 && totals.pendingRevenue > 0) {
      return `Confirmar ${formatCurrency(totals.pendingRevenue)} em recebimentos pendentes`
    }

    if (operationalResult < 0) {
      return "Reduzir custos fixos ou aumentar ticket médio"
    }

    if (biggestCost && biggestCost.total > totals.revenue * 0.4 && totals.revenue > 0) {
      return `Revisar ${biggestCost.label.toLowerCase()} antes de escalar`
    }

    if (totals.revenue <= 0) {
      return "Gerar vendas pagas para montar um histórico confiável"
    }

    return "Manter acompanhamento semanal de vendas e custos"
  }, [biggestCost, operationalResult, totals.pendingRevenue, totals.revenue])

  const alerts = useMemo(() => {
    const messages: { title: string; description: string; tone: "danger" | "warning" | "success" | "neutral" }[] = []

    if (totals.revenue <= 0) {
      messages.push({
        title: "Sem receita recebida no período",
        description: "Ainda não existem vendas pagas suficientes para uma leitura financeira consistente.",
        tone: "warning",
      })
    }

    if (operationalResult < 0) {
      messages.push({
        title: "Resultado operacional negativo",
        description: `As saídas principais passaram da receita em ${formatCurrency(Math.abs(operationalResult))}.`,
        tone: "danger",
      })
    }

    if (totals.pendingRevenue > totals.revenue * 0.35 && totals.pendingRevenue > 0) {
      messages.push({
        title: "Muito dinheiro pendente",
        description: `Existem ${formatCurrency(totals.pendingRevenue)} a receber. Isso pode distorcer sua leitura de caixa.`,
        tone: "warning",
      })
    }

    if (costShare > 70) {
      messages.push({
        title: "Custos altos para a receita atual",
        description: `Os custos principais equivalem a ${formatPercent(costShare)} da receita recebida.`,
        tone: "warning",
      })
    }

    if (topProducts.length === 0 && totals.revenue > 0) {
      messages.push({
        title: "Produtos não encontrados no relatório",
        description: "Existe receita, mas o ranking de itens não foi montado. Pode ser falta de vínculo com order_items.",
        tone: "neutral",
      })
    }

    if (messages.length === 0) {
      messages.push({
        title: "Período saudável",
        description: "A operação está positiva. Continue monitorando ticket, canal principal e custos semanais.",
        tone: "success",
      })
    }

    return messages
  }, [costShare, operationalResult, topProducts.length, totals.pendingRevenue, totals.revenue])

  async function loadOptionalSupplierPurchases(restaurantId: string) {
    const { data, error } = await supabase
      .from("supplier_purchases")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .limit(500)

    if (error) {
      console.warn("Não foi possível carregar compras de fornecedores:", error.message)
      return []
    }

    const supplierIds = Array.from(
      new Set((data || []).map((purchase: RawRow) => purchase.supplier_id).filter(Boolean)),
    )

    let supplierNames: Record<string, string> = {}

    if (supplierIds.length > 0) {
      const suppliersResponse = await supabase
        .from("suppliers")
        .select("id, name")
        .in("id", supplierIds)

      if (!suppliersResponse.error) {
        supplierNames = (suppliersResponse.data || []).reduce<Record<string, string>>((acc, supplier: RawRow) => {
          acc[supplier.id] = supplier.name
          return acc
        }, {})
      }
    }

    return (data || [])
      .map((purchase: RawRow) => {
        const date = String(getFirstValue(purchase, ["purchase_date", "date", "created_at", "updated_at"]) || "")
        const supplierId = purchase.supplier_id || null

        return {
          id: String(purchase.id),
          supplier_id: supplierId,
          supplier_name:
            purchase.supplier_name ||
            purchase.supplier ||
            (supplierId ? supplierNames[supplierId] : null) ||
            "Fornecedor não informado",
          amount: toNumber(getFirstValue(purchase, ["total_amount", "total", "amount", "final_total", "grand_total"])),
          status: purchase.status || null,
          payment_status: purchase.payment_status || null,
          date: date || null,
        }
      })
      .filter((purchase: SupplierPurchase) => isInsidePeriod(purchase.date, startDate, endDate))
  }

  async function loadOptionalDeliverySettlements(restaurantId: string) {
    const { data, error } = await supabase
      .from("delivery_settlements")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .limit(500)

    if (error) {
      console.warn("Não foi possível carregar acertos de entregadores:", error.message)
      return []
    }

    return (data || [])
      .map((settlement: RawRow) => {
        const date = String(getFirstValue(settlement, ["settlement_date", "paid_at", "created_at", "updated_at"]) || "")

        return {
          id: String(settlement.id),
          delivery_person_name:
            settlement.delivery_person_name ||
            settlement.driver_name ||
            settlement.motoboy_name ||
            settlement.name ||
            "Entregador não informado",
          amount: toNumber(getFirstValue(settlement, ["total_amount", "amount", "total", "delivery_fee_total", "total_delivery_fee"])),
          status: settlement.status || null,
          date: date || null,
        }
      })
      .filter((settlement: DeliverySettlement) => isInsidePeriod(settlement.date, startDate, endDate))
  }

  async function loadData() {
    try {
      setLoading(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error("Usuário não autenticado.")
      }

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .single()

      if (restaurantError || !restaurant) {
        throw new Error("Restaurante não encontrado.")
      }

      const { startIso, endIso } = getDateRange(startDate, endDate)

      const [ordersResponse, expensesResponse, closingsResponse] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .gte("created_at", startIso)
          .lt("created_at", endIso)
          .order("created_at", { ascending: false }),

        supabase
          .from("accounts_payable")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .gte("due_date", startDate)
          .lte("due_date", endDate)
          .order("due_date", { ascending: false }),

        supabase
          .from("cash_closings")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .gte("closing_date", startDate)
          .lte("closing_date", endDate)
          .order("closing_date", { ascending: false }),
      ])

      if (ordersResponse.error) throw ordersResponse.error
      if (expensesResponse.error) throw expensesResponse.error
      if (closingsResponse.error) throw closingsResponse.error

      const normalizedOrders: Order[] = (ordersResponse.data || []).map((order: RawRow) => ({
        id: String(order.id),
        total: toNumber(order.total),
        subtotal: toNumber(order.subtotal),
        delivery_fee: toNumber(order.delivery_fee),
        payment_method: order.payment_method || null,
        payment_status: order.payment_status || null,
        status: order.status || null,
        order_source: order.order_source || null,
        created_at: order.created_at,
      }))

      setOrders(normalizedOrders)

      const orderIds = normalizedOrders.map((order) => order.id)

      if (orderIds.length > 0) {
        const orderItemsResponse = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", orderIds)

        if (orderItemsResponse.error) {
          console.warn("Não foi possível carregar itens dos pedidos:", orderItemsResponse.error.message)
          setOrderItems([])
        } else {
          setOrderItems(
            (orderItemsResponse.data || []).map((item: RawRow) => {
              const quantity = toNumber(getFirstValue(item, ["quantity", "qty", "amount"])) || 1
              const unitPrice = toNumber(getFirstValue(item, ["unit_price", "price", "product_price"]))
              const total =
                toNumber(getFirstValue(item, ["total_price", "total", "subtotal", "amount_total"])) ||
                unitPrice * quantity

              return {
                id: String(item.id),
                order_id: String(item.order_id),
                product_name: item.product_name || item.name || item.title || "Produto sem nome",
                quantity,
                total,
              }
            }),
          )
        }
      } else {
        setOrderItems([])
      }

      setExpenses(
        (expensesResponse.data || []).map((expense: RawRow) => ({
          id: String(expense.id),
          description: expense.description || "Despesa sem descrição",
          category: expense.category || null,
          amount: toNumber(expense.amount),
          due_date: expense.due_date || null,
          paid_at: expense.paid_at || null,
          payment_method: expense.payment_method || null,
          status: expense.status || null,
          created_at: expense.created_at || null,
        })),
      )

      setClosings(
        (closingsResponse.data || []).map((closing: RawRow) => ({
          id: String(closing.id),
          closing_date: closing.closing_date,
          gross_revenue: toNumber(closing.gross_revenue),
          manual_income: toNumber(closing.manual_income),
          expenses: toNumber(closing.expenses),
          estimated_profit: toNumber(closing.estimated_profit),
          pix_total: toNumber(closing.pix_total),
          cash_total: toNumber(closing.cash_total),
          card_total: toNumber(closing.card_total),
          orders_count: toNumber(closing.orders_count),
          average_ticket: toNumber(closing.average_ticket),
          closed_at: closing.closed_at || null,
        })),
      )

      const [purchasesData, settlementsData] = await Promise.all([
        loadOptionalSupplierPurchases(restaurant.id),
        loadOptionalDeliverySettlements(restaurant.id),
      ])

      setSupplierPurchases(purchasesData)
      setDeliverySettlements(settlementsData)
    } catch (error: any) {
      console.error("Erro ao carregar relatório 360:", error)
      alert(error?.message || "Não foi possível carregar o relatório 360.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  const closingRows = closings.slice(0, 8).map((closing) => [
    <div key={`${closing.id}-day`} className="space-y-0.5">
      <span className="font-semibold text-slate-900">{formatWeekday(closing.closing_date)}</span>
      <span className="block text-xs text-slate-500">Caixa fechado</span>
    </div>,
    <span key={`${closing.id}-date`} className="font-medium text-slate-700">
      {formatDate(closing.closing_date)}
    </span>,
    <span
      key={`${closing.id}-result`}
      className={cn(
        "font-bold",
        closing.estimated_profit >= 0 ? "text-violet-700" : "text-red-600",
      )}
    >
      {formatCurrency(closing.estimated_profit)}
    </span>,
  ])

  return (
    <AdminLayout>
      <div className="space-y-4 px-0 pb-6 sm:space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 shadow-sm shadow-slate-200/40 sm:rounded-[28px]">
          <div className="flex flex-col gap-4 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200 sm:h-14 sm:w-14">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>

              <div className="min-w-0 space-y-2">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                    Relatório 360
                  </h1>
                  <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
                    Um painel executivo para entender resultado, custos, canais e prioridades do período.
                  </p>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  <div className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    Recebido: {formatCurrency(totals.revenue)}
                  </div>
                  <div className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                    Resultado: {formatCurrency(operationalResult)}
                  </div>
                  <div className="shrink-0 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                    Pendente: {formatCurrency(totals.pendingRevenue)}
                  </div>
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={loadData}
              disabled={loading}
              className="h-10 w-full rounded-2xl border-slate-200 bg-white/80 px-4 sm:h-11 sm:w-auto"
            >
              <RefreshCcw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/40 sm:rounded-[28px] sm:p-4">
          <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px_auto] xl:items-end">
            <div>
              <h2 className="text-sm font-semibold text-slate-950 sm:text-base">Período analisado</h2>
              <p className="text-xs leading-relaxed text-slate-500 sm:text-sm">
                O relatório recalcula automaticamente toda a leitura financeira com base nas datas selecionadas.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Data inicial</Label>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Data final</Label>
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>

            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  setStartDate(todayDate())
                  setEndDate(todayDate())
                }}
              >
                Hoje
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  setStartDate(monthStart())
                  setEndDate(todayDate())
                }}
              >
                Mês
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  setStartDate(lastThirtyDaysStart())
                  setEndDate(todayDate())
                }}
              >
                30 dias
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-500 sm:rounded-[28px]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando relatório 360...
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title="Ganhos recebidos"
                value={formatCurrency(totals.revenue)}
                helper={`${totals.paidOrdersCount} pedidos pagos no período`}
                icon={<TrendingUp className="h-5 w-5" />}
                tone="emerald"
              />
              <KpiCard
                title="Resultado operacional"
                value={formatCurrency(operationalResult)}
                helper="Receita menos folha, fornecedores, entregadores e demais saídas"
                icon={operationalResult >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                tone={operationalResult >= 0 ? "violet" : "red"}
              />
              <KpiCard
                title="A receber"
                value={formatCurrency(totals.pendingRevenue)}
                helper={`${totals.pendingOrdersCount} pedidos ainda pendentes`}
                icon={<Wallet className="h-5 w-5" />}
                tone="orange"
              />
              <KpiCard
                title="Ticket médio"
                value={formatCurrency(totals.averageTicket)}
                helper="Média dos pedidos pagos"
                icon={<Target className="h-5 w-5" />}
                tone="blue"
              />
            </div>

            <div className="grid gap-3 sm:gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <SectionCard
                title="Painel executivo"
                subtitle="Uma leitura direta do que entrou, o que saiu e o que pede atenção agora."
                icon={<Activity className="h-5 w-5" />}
              >
                <div className="grid gap-2 sm:gap-3 md:grid-cols-3">
                  <InsightCard
                    title="Entrou"
                    value={formatCurrency(totals.revenue)}
                    helper={`${totals.paidOrdersCount} pedidos pagos`}
                    tone="emerald"
                  />
                  <InsightCard
                    title="Saiu / Custos"
                    value={formatCurrency(totalMainCosts)}
                    helper="Folha, fornecedores, entregadores e outros"
                    tone="orange"
                  />
                  <InsightCard
                    title="Sobrou estimado"
                    value={formatCurrency(operationalResult)}
                    helper="Resultado operacional do período"
                    tone="violet"
                  />
                </div>

                <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3 md:grid-cols-2">
                  <InsightCard
                    title="Maior custo"
                    value={
                      biggestCost && biggestCost.total > 0
                        ? `${biggestCost.label} · ${formatCurrency(biggestCost.total)}`
                        : "Sem custo relevante"
                    }
                    helper="Área que mais pesou no período"
                  />
                  <InsightCard
                    title="Melhor produto"
                    value={
                      bestProduct
                        ? `${bestProduct.label} · ${formatCurrency(bestProduct.value)}`
                        : "Sem item suficiente"
                    }
                    helper="Maior faturamento entre os itens vendidos"
                  />
                  <InsightCard
                    title="Canal principal"
                    value={
                      bestChannel
                        ? `${bestChannel.label} · ${formatCurrency(bestChannel.value)}`
                        : "Sem canal suficiente"
                    }
                    helper="De onde veio mais dinheiro pago"
                  />
                  <InsightCard
                    title="Prioridade agora"
                    value={priorityText}
                    helper="Próxima ação sugerida pelo relatório"
                  />
                </div>

                <div className="mt-3 space-y-2 sm:mt-4">
                  {alerts.map((alert) => (
                    <div
                      key={alert.title}
                      className={cn(
                        "rounded-2xl border p-3",
                        alert.tone === "danger" && "border-red-200 bg-red-50 text-red-900",
                        alert.tone === "warning" && "border-orange-200 bg-orange-50 text-orange-900",
                        alert.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
                        alert.tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-800",
                      )}
                    >
                      <div className="flex gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold sm:text-base">{alert.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed opacity-90 sm:text-sm">{alert.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Ganhos por dia"
                subtitle="Visual para entender em quais dias o caixa realmente entrou."
                icon={<BarChart3 className="h-5 w-5" />}
              >
                <RevenueBars
                  items={revenueByDay.slice(-10)}
                  emptyText="Nenhuma venda paga no período."
                />
              </SectionCard>
            </div>

            <div className="grid gap-3 sm:gap-4 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
              <SectionCard
                title="Mapa de custos por área"
                subtitle="Visual mais claro para identificar onde o dinheiro está saindo."
                icon={<PieChart className="h-5 w-5" />}
              >
                <CostDistribution items={displayCostAreas} total={totalMainCosts} />
              </SectionCard>

              <SectionCard
                title="Fechamentos de caixa"
                subtitle="Mostra somente o dia, a data e o saldo final de cada caixa fechado."
                icon={<DollarSign className="h-5 w-5" />}
              >
                <ScrollableBox className="max-h-[300px] sm:max-h-[340px]">
                  <CompactTable
                    headers={["Dia", "Data", "Saldo fechado"]}
                    rows={closingRows}
                    emptyText="Nenhum fechamento de caixa encontrado."
                  />
                </ScrollableBox>
              </SectionCard>
            </div>

            <div className="grid gap-3 sm:gap-4 xl:grid-cols-3">
              <SectionCard
                title="Itens que mais vendem"
                subtitle="Ranking por faturamento dos produtos vendidos."
                icon={<Package className="h-5 w-5" />}
              >
                <RankingRows
                  items={topProducts}
                  emptyText="Nenhum item vendido encontrado no período."
                  barTone="bg-blue-600"
                />
              </SectionCard>

              <SectionCard
                title="Canais de venda"
                subtitle="De onde os pedidos pagos estão vindo."
                icon={<ShoppingBag className="h-5 w-5" />}
              >
                <RankingRows
                  items={salesChannels}
                  emptyText="Nenhum canal encontrado no período."
                  barTone="bg-violet-600"
                />
              </SectionCard>

              <SectionCard
                title="Formas de pagamento"
                subtitle="Ajuda a conferir Pix, cartão, dinheiro e outros."
                icon={<CreditCard className="h-5 w-5" />}
              >
                <RankingRows
                  items={paymentMethods}
                  emptyText="Nenhum pagamento recebido no período."
                  barTone="bg-slate-700"
                />
              </SectionCard>
            </div>

            <div className="grid gap-3 sm:gap-4 xl:grid-cols-2 xl:items-start">
              <SectionCard
                title="Compras e insumos"
                subtitle="Mostra o peso real de fornecedores e ajuda a controlar compras do período."
                icon={<Package className="h-5 w-5" />}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <InsightCard
                    title="Total em compras"
                    value={formatCurrency(supplierAreaSummary.total)}
                    helper={`${supplierAreaSummary.count} registro${supplierAreaSummary.count === 1 ? "" : "s"} no período`}
                    tone="orange"
                  />
                  <InsightCard
                    title="Fornecedor que mais pesou"
                    value={suppliersRanking[0]?.label || "Sem fornecedor"}
                    helper={suppliersRanking[0] ? formatCurrency(suppliersRanking[0].value) : "Nenhum gasto encontrado"}
                  />
                  <InsightCard
                    title="Pago"
                    value={formatCurrency(supplierAreaSummary.paid)}
                    helper="Compras já quitadas"
                    tone="emerald"
                  />
                  <InsightCard
                    title="Pendente"
                    value={formatCurrency(supplierAreaSummary.pending)}
                    helper="Compras ainda abertas"
                    tone="orange"
                  />
                </div>

                <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Ranking de fornecedores</p>
                      <p className="text-xs text-slate-500">Lista com rolagem para não estourar a tela.</p>
                    </div>
                  </div>

                  <ScrollableBox className="max-h-[260px] sm:max-h-[300px]">
                    <RankingRows
                      items={suppliersRanking}
                      emptyText="Nenhum gasto com fornecedor encontrado no período."
                      barTone="bg-red-500"
                    />
                  </ScrollableBox>
                </div>
              </SectionCard>

              <SectionCard
                title="Logística e entregas"
                subtitle="Ajuda a entender quanto a entrega pesa na operação e no caixa."
                icon={<Truck className="h-5 w-5" />}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <InsightCard
                    title="Taxas nos pagos"
                    value={formatCurrency(totals.deliveryFees)}
                    helper="Somente pedidos pagos"
                    tone="orange"
                  />
                  <InsightCard
                    title="Taxas totais"
                    value={formatCurrency(totals.deliveryFeesAllOrders)}
                    helper="Inclui pagos e pendentes"
                  />
                  <InsightCard
                    title="Média por pedido"
                    value={formatCurrency(averageDeliveryCost)}
                    helper="Entrega média por pedido pago"
                  />
                  <InsightCard
                    title="Peso na receita"
                    value={formatPercent(deliveryShare)}
                    helper="Quanto a logística pesa no recebido"
                    tone={deliveryShare > 20 ? "orange" : "emerald"}
                  />
                </div>

                <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Acertos por entregador</p>
                      <p className="text-xs text-slate-500">Quando houver acerto individual, o ranking aparece aqui.</p>
                    </div>
                  </div>

                  <ScrollableBox className="max-h-[260px] sm:max-h-[300px]">
                    {deliveryRanking.length > 0 ? (
                      <RankingRows
                        items={deliveryRanking}
                        emptyText="Nenhum acerto de entregador encontrado."
                        barTone="bg-orange-500"
                      />
                    ) : (
                      <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 p-4">
                        <p className="text-sm font-semibold text-orange-900">Sem acerto individual ainda</p>
                        <p className="mt-1 text-xs leading-relaxed text-orange-800">
                          Por enquanto o relatório usa as taxas dos pedidos. Quando você fechar acertos por entregador,
                          esse bloco vira um ranking por pessoa.
                        </p>
                      </div>
                    )}
                  </ScrollableBox>
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title="Resumo final para decisão"
              subtitle="Aqui o dono entende rapidamente o cenário e a ação mais importante."
              icon={<Users className="h-5 w-5" />}
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">O que entrou</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Receita recebida de {formatCurrency(totals.revenue)} com ticket médio de{" "}
                    {formatCurrency(totals.averageTicket)}.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">O que mais pesa</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {biggestCost && biggestCost.total > 0
                      ? `${biggestCost.label} é o maior custo do período, somando ${formatCurrency(biggestCost.total)}.`
                      : "Nenhum custo relevante identificado no período."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                    <Target className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">Melhor venda</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {bestProduct
                      ? `${bestProduct.label} foi o item com maior faturamento.`
                      : bestChannel
                      ? `${bestChannel.label} foi o principal canal do período.`
                      : "Ainda não há dados suficientes para destacar uma melhor venda."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">Ponto de atenção</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {priorityText}.{" "}
                    {bestPaymentMethod
                      ? `Hoje a principal forma de pagamento foi ${bestPaymentMethod.label.toLowerCase()}.`
                      : ""}
                  </p>
                </div>
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </AdminLayout>
  )
}