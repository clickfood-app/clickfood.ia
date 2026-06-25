"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  DollarSign,
  FileText,
  Info,
  Loader2,
  Package,
  PieChart,
  RefreshCcw,
  ShoppingBag,
  Target,
  TrendingUp,
  Truck,
  Wallet,
  XCircle,
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
  quantity?: number
  orders?: number
  count?: number
}

type CostAreaItem = {
  label: string
  paid: number
  pending: number
  total: number
  count: number
}

type AlertTone = "blue" | "orange" | "red" | "violet"

const SALES_CHANNELS = ["Manual / Balcão", "Cardápio online", "WhatsApp / Robô", "Mesa / PDV"]
const PAYMENT_METHODS = ["Dinheiro", "Pix", "Cartão", "Outros"]

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

function inclusiveDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0
  }

  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
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

function formatCompactCurrency(value: number | null | undefined) {
  const amount = Number(value || 0)
  const absolute = Math.abs(amount)

  if (absolute >= 1_000_000) {
    return `R$ ${(amount / 1_000_000).toFixed(1).replace(".", ",")} mi`
  }

  if (absolute >= 1_000) {
    return `R$ ${(amount / 1_000).toFixed(1).replace(".", ",")} mil`
  }

  return formatCurrency(amount)
}

function formatPercent(value: number) {
  const fixed = value.toFixed(1)
  const clean = fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed
  return `${clean.replace(".", ",")}%`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "--/--"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
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
  const text = `${source} ${status}`

  if (
    text.includes("whatsapp") ||
    text.includes("whats") ||
    text.includes("robot") ||
    text.includes("robô") ||
    text.includes("robo") ||
    text.includes("bot")
  ) {
    return "WhatsApp / Robô"
  }

  if (
    text.includes("waiter") ||
    text.includes("garcom") ||
    text.includes("garçom") ||
    text.includes("mesa") ||
    text.includes("table") ||
    text.includes("pdv")
  ) {
    return "Mesa / PDV"
  }

  if (
    text.includes("public") ||
    text.includes("cardapio") ||
    text.includes("cardápio") ||
    text.includes("online") ||
    text.includes("site")
  ) {
    return "Cardápio online"
  }

  return "Manual / Balcão"
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
    return "Freelancers / diárias"
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

function isCanceledStatus(order: Order) {
  const value = `${order.status || ""} ${order.payment_status || ""}`.toLowerCase()

  return (
    value.includes("cancel") ||
    value.includes("cancelado") ||
    value.includes("cancelada") ||
    value.includes("canceled") ||
    value.includes("cancelled") ||
    value.includes("rejeitado") ||
    value.includes("rejected")
  )
}

function maxValue(items: RankingItem[]) {
  return Math.max(...items.map((item) => item.value), 1)
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0
  return (value / total) * 100
}

function percentWidth(value: number) {
  return `${Math.min(Math.max(value, 0), 100)}%`
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#cdd9ea] bg-[#f8fbff] px-4 py-6 text-center text-sm text-[#a1a1aa]">
      {text}
    </div>
  )
}

function SectionCard({
  title,
  subtitle,
  icon,
  children,
  className,
  action,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  action?: ReactNode
}) {
  return (
    <section className={cn("rounded-2xl border border-[#111111] bg-[#0A0A0A] shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-[#edf2f8] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#eef5ff] text-yellow-400">
              {icon}
            </div>
          ) : null}

          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#ffffff]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs leading-relaxed text-[#a1a1aa]">{subtitle}</p> : null}
          </div>
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className="p-4">{children}</div>
    </section>
  )
}

function MiniSparkline({
  values,
  color = "#facc15",
}: {
  values: number[]
  color?: string
}) {
  const source = values.length > 1 ? values : [0, values[0] || 0]
  const min = Math.min(...source)
  const max = Math.max(...source)
  const range = max - min || 1
  const width = 160
  const height = 42
  const points = source
    .map((value, index) => {
      const x = source.length === 1 ? width : (index / (source.length - 1)) * width
      const y = height - ((value - min) / range) * (height - 8) - 4
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {source.map((value, index) => {
        const x = source.length === 1 ? width : (index / (source.length - 1)) * width
        const y = height - ((value - min) / range) * (height - 8) - 4

        return <circle key={`${value}-${index}`} cx={x} cy={y} r="2.4" fill={color} />
      })}
    </svg>
  )
}

function MetricCard({
  title,
  value,
  helper,
  icon,
  tone = "blue",
  sparklineValues,
  children,
}: {
  title: string
  value: string
  helper?: string
  icon: ReactNode
  tone?: "blue" | "green" | "orange" | "red" | "violet" | "slate"
  sparklineValues?: number[]
  children?: ReactNode
}) {
  const toneStyles = {
    blue: {
      icon: "bg-yellow-400/10 text-yellow-400",
      value: "text-[#ffffff]",
      line: "#facc15",
    },
    green: {
      icon: "bg-emerald-500/10 text-[#059669]",
      value: "text-[#059669]",
      line: "#059669",
    },
    orange: {
      icon: "bg-yellow-400/10 text-yellow-400",
      value: "text-yellow-400",
      line: "#facc15",
    },
    red: {
      icon: "bg-red-100 text-[#dc2626]",
      value: "text-[#dc2626]",
      line: "#dc2626",
    },
    violet: {
      icon: "bg-yellow-400/10 text-[#facc15]",
      value: "text-[#ffffff]",
      line: "#facc15",
    },
    slate: {
      icon: "bg-[#111111] text-[#a1a1aa]",
      value: "text-[#ffffff]",
      line: "#a1a1aa",
    },
  }[tone]

  return (
    <div className="min-h-[150px] rounded-2xl border border-[#111111] bg-[#0A0A0A] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#ffffff]">{title}</p>
          <strong className={cn("mt-1 block truncate text-2xl font-black tracking-tight", toneStyles.value)}>
            {value}
          </strong>
          {helper ? <p className="mt-1 text-xs leading-relaxed text-[#a1a1aa]">{helper}</p> : null}
        </div>

        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", toneStyles.icon)}>
          {icon}
        </div>
      </div>

      {children ? <div className="mt-3">{children}</div> : null}

      {sparklineValues ? (
        <div className="mt-3">
          <MiniSparkline values={sparklineValues} color={toneStyles.line} />
        </div>
      ) : null}
    </div>
  )
}

function ProgressBar({
  percent,
  tone = "blue",
}: {
  percent: number
  tone?: "blue" | "green" | "orange" | "red" | "violet" | "slate"
}) {
  const colors = {
    blue: "bg-yellow-400",
    green: "bg-[#059669]",
    orange: "bg-yellow-400",
    red: "bg-[#dc2626]",
    violet: "bg-[#facc15]",
    slate: "bg-[#ffffff]",
  }

  return (
    <div className="h-1.5 w-full min-w-[72px] overflow-hidden rounded-full bg-[#edf2f8]">
      <div className={cn("h-full rounded-full", colors[tone])} style={{ width: percentWidth(percent) }} />
    </div>
  )
}

function BarWithPercent({
  percent,
  tone = "blue",
}: {
  percent: number
  tone?: "blue" | "green" | "orange" | "red" | "violet" | "slate"
}) {
  return (
    <div className="flex min-w-[112px] items-center gap-2">
      <ProgressBar percent={percent} tone={tone} />
      <span className="w-10 shrink-0 text-right text-xs font-bold text-[#ffffff]">{formatPercent(percent)}</span>
    </div>
  )
}

function CompactTable({
  headers,
  rows,
  footer,
  emptyText,
  minWidth = "640px",
}: {
  headers: string[]
  rows: ReactNode[][]
  footer?: ReactNode[]
  emptyText: string
  minWidth?: string
}) {
  if (rows.length === 0) {
    return <EmptyState text={emptyText} />
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#111111]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead className="bg-[#f8fbff] text-left text-[11px] font-bold uppercase tracking-wide text-[#a1a1aa]">
            <tr>
              {headers.map((header) => (
                <th key={header} className="whitespace-nowrap px-3 py-2.5">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf2f8] bg-[#0A0A0A]">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-[#f8fbff]">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2.5 align-middle text-[#ffffff]">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer ? (
            <tfoot className="border-t border-[#111111] bg-[#fbfdff] font-black text-[#ffffff]">
              <tr>
                {footer.map((cell, index) => (
                  <td key={index} className="px-3 py-2.5 align-middle">
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  )
}

function StatusDot({
  tone,
}: {
  tone: "green" | "orange" | "red" | "blue"
}) {
  const colors = {
    green: "bg-[#059669]",
    orange: "bg-yellow-400",
    red: "bg-[#dc2626]",
    blue: "bg-yellow-400",
  }

  return <span className={cn("h-2 w-2 shrink-0 rounded-full", colors[tone])} />
}

function StatusPill({
  children,
  tone = "green",
}: {
  children: ReactNode
  tone?: "green" | "orange" | "red" | "blue" | "slate"
}) {
  const styles = {
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-400",
    orange: "border-yellow-400/30 bg-yellow-400/10 text-yellow-400",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-yellow-400/30 bg-yellow-400/10 text-yellow-400",
    slate: "border-white/10 bg-[#111111] text-zinc-500",
  }

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold", styles[tone])}>
      {children}
    </span>
  )
}

function StatusDonut({
  paid,
  pending,
  canceled,
}: {
  paid: number
  pending: number
  canceled: number
}) {
  const total = paid + pending + canceled
  const paidDegrees = total > 0 ? (paid / total) * 360 : 0
  const pendingDegrees = total > 0 ? (pending / total) * 360 : 0
  const gradient =
    total > 0
      ? `conic-gradient(#059669 0deg ${paidDegrees}deg, #facc15 ${paidDegrees}deg ${
          paidDegrees + pendingDegrees
        }deg, #dc2626 ${paidDegrees + pendingDegrees}deg 360deg)`
      : "conic-gradient(#111111 0deg 360deg)"

  const rows = [
    { label: "Pagos", value: paid, tone: "green" as const },
    { label: "Pendentes", value: pending, tone: "orange" as const },
    { label: "Cancelados", value: canceled, tone: "red" as const },
  ]

  return (
    <div className="grid gap-5 sm:grid-cols-[160px_1fr] sm:items-center">
      <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full p-5" style={{ background: gradient }}>
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#0A0A0A] text-center shadow-inner">
          <strong className="text-3xl font-black text-[#ffffff]">{total}</strong>
          <span className="text-xs font-bold text-[#a1a1aa]">Total</span>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <StatusDot tone={row.tone} />
                <span className="text-sm font-bold text-[#ffffff]">{row.label}</span>
              </div>
              <ProgressBar percent={percentage(row.value, total)} tone={row.tone} />
            </div>
            <div className="text-right">
              <strong className="block text-sm font-black text-[#ffffff]">{row.value}</strong>
              <span className="text-xs text-[#a1a1aa]">{formatPercent(percentage(row.value, total))}</span>
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between border-t border-[#edf2f8] pt-3 text-sm font-black text-[#ffffff]">
          <span>Total</span>
          <span>{total}</span>
        </div>
      </div>
    </div>
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
    <div className="rounded-xl border border-[#111111] bg-[#0A0A0A] p-3">
      <div className="relative h-[230px] overflow-hidden">
        <div className="absolute inset-x-0 top-6 border-t border-[#edf2f8]" />
        <div className="absolute inset-x-0 top-[72px] border-t border-[#edf2f8]" />
        <div className="absolute inset-x-0 top-[118px] border-t border-[#edf2f8]" />
        <div className="absolute inset-x-0 top-[164px] border-t border-[#edf2f8]" />

        <div className="relative flex h-full items-end gap-2 overflow-x-auto pb-1">
          {items.map((item) => {
            const barHeight = Math.max((item.value / max) * 150, item.value > 0 ? 10 : 2)

            return (
              <div
                key={`${item.label}-${item.value}`}
                className="flex min-w-[58px] flex-1 flex-col items-center justify-end gap-2"
                title={`${item.helper || item.label}: ${formatCurrency(item.value)}`}
              >
                <span className="text-center text-[11px] font-bold text-[#a1a1aa]">
                  {formatCompactCurrency(item.value)}
                </span>
                <div className="flex h-[150px] w-full items-end justify-center rounded-lg bg-[#f4f7fb] px-1 pb-0.5">
                  <div
                    className="w-full rounded-t-md bg-yellow-400 shadow-sm shadow-yellow-400/20"
                    style={{ height: `${barHeight}px` }}
                  />
                </div>
                <span className="whitespace-nowrap text-[11px] font-bold text-[#ffffff]">{item.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function OwnerInsight({
  icon,
  label,
  value,
  tone = "blue",
}: {
  icon: ReactNode
  label: string
  value: string
  tone?: AlertTone | "green"
}) {
  const styles = {
    blue: "bg-yellow-400/15 text-zinc-400 ring-yellow-400/20",
    green: "bg-emerald-500/15 text-emerald-400 ring-emerald-400/20",
    orange: "bg-yellow-400/15 text-yellow-400 ring-yellow-400/20",
    red: "bg-red-500/15 text-red-200 ring-red-400/25",
    violet: "bg-yellow-400/15 text-yellow-400 ring-yellow-400/20",
  }

  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-white/10 bg-[#0A0A0A] p-3">
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1", styles[tone])}>
        {icon}
      </div>
      <p className="min-w-0 text-sm font-semibold leading-snug text-white/90">
        <span className="block text-xs font-black uppercase tracking-wide text-white/70">{label}</span>
        {value}
      </p>
    </div>
  )
}

function DecisionCard({
  title,
  value,
  helper,
  icon,
  tone,
}: {
  title: string
  value: string
  helper: string
  icon: ReactNode
  tone: "green" | "orange" | "blue" | "red"
}) {
  const styles = {
    green: "border-emerald-400/30 text-emerald-300",
    orange: "border-yellow-400/30 text-yellow-400",
    blue: "border-yellow-400/30 text-zinc-400",
    red: "border-red-400/45 text-yellow-400",
  }

  return (
    <div className={cn("rounded-2xl border bg-[#0A0A0A] p-4", styles[tone])}>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0A0A0A]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black">{title}</p>
          <strong className="mt-1 block text-xl font-black leading-tight text-white">{value}</strong>
          <p className="mt-2 text-xs leading-relaxed text-white/75">{helper}</p>
        </div>
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
    () => orders.filter((order) => isPaidStatus(order.payment_status) && !isCanceledStatus(order)),
    [orders],
  )

  const canceledOrders = useMemo(
    () => orders.filter((order) => isCanceledStatus(order)),
    [orders],
  )

  const pendingOrders = useMemo(
    () => orders.filter((order) => !isPaidStatus(order.payment_status) && !isCanceledStatus(order)),
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
    const canceledRevenue = canceledOrders.reduce((acc, order) => acc + order.total, 0)

    const paidExpenseTotal = paidExpenses.reduce((acc, expense) => acc + expense.amount, 0)
    const pendingExpenseTotal = pendingExpenses.reduce((acc, expense) => acc + expense.amount, 0)

    const deliveryFees = paidOrders.reduce((acc, order) => acc + order.delivery_fee, 0)
    const deliveryFeesAllOrders = orders.reduce((acc, order) => acc + order.delivery_fee, 0)

    const averageTicket = paidOrders.length > 0 ? revenue / paidOrders.length : 0
    const totalCostWithPending = paidExpenseTotal + pendingExpenseTotal

    return {
      revenue,
      pendingRevenue,
      canceledRevenue,
      grossRevenue: revenue + pendingRevenue,
      paidExpenseTotal,
      pendingExpenseTotal,
      deliveryFees,
      deliveryFeesAllOrders,
      averageTicket,
      totalCostWithPending,
      paidOrdersCount: paidOrders.length,
      pendingOrdersCount: pendingOrders.length,
      canceledOrdersCount: canceledOrders.length,
      totalOrdersCount: paidOrders.length + pendingOrders.length + canceledOrders.length,
    }
  }, [canceledOrders, orders, paidExpenses, paidOrders, pendingExpenses, pendingOrders])

  const costsByGroup = useMemo(() => {
    const groups: Record<string, { paid: number; pending: number; count: number }> = {
      "Folha fixa": { paid: 0, pending: 0, count: 0 },
      "Freelancers / diárias": { paid: 0, pending: 0, count: 0 },
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
    () => costsByGroup.find((item) => item.label === "Freelancers / diárias")?.total || 0,
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

  const operationalMargin = useMemo(() => {
    return percentage(operationalResult, totals.revenue)
  }, [operationalResult, totals.revenue])

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
        label: formatShortDate(date),
        value: data.total,
        helper: `${formatDate(date)} · ${data.orders} pedido${data.orders === 1 ? "" : "s"} pago${
          data.orders === 1 ? "" : "s"
        }`,
        orders: data.orders,
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
        quantity: data.quantity,
        helper: `${data.quantity} vendido${data.quantity === 1 ? "" : "s"}`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [orderItems, paidOrders])

  const salesChannels = useMemo(() => {
    const grouped = SALES_CHANNELS.reduce<Record<string, { total: number; orders: number }>>((acc, channel) => {
      acc[channel] = { total: 0, orders: 0 }
      return acc
    }, {})

    paidOrders.forEach((order) => {
      const channel = normalizeSalesChannel(order)
      grouped[channel] = grouped[channel] || { total: 0, orders: 0 }
      grouped[channel].total += order.total
      grouped[channel].orders += 1
    })

    return SALES_CHANNELS.map((channel) => ({
      label: channel,
      value: grouped[channel]?.total || 0,
      orders: grouped[channel]?.orders || 0,
      helper: `${grouped[channel]?.orders || 0} pedido${(grouped[channel]?.orders || 0) === 1 ? "" : "s"}`,
    }))
  }, [paidOrders])

  const paymentMethods = useMemo(() => {
    const grouped = PAYMENT_METHODS.reduce<Record<string, { total: number; orders: number }>>((acc, method) => {
      acc[method] = { total: 0, orders: 0 }
      return acc
    }, {})

    paidOrders.forEach((order) => {
      const method = normalizePaymentMethod(order.payment_method)
      grouped[method] = grouped[method] || { total: 0, orders: 0 }
      grouped[method].total += order.total
      grouped[method].orders += 1
    })

    return PAYMENT_METHODS.map((method) => ({
      label: method,
      value: grouped[method]?.total || 0,
      orders: grouped[method]?.orders || 0,
      helper: `${grouped[method]?.orders || 0} pedido${(grouped[method]?.orders || 0) === 1 ? "" : "s"}`,
    }))
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
        count: data.count,
        helper: `${data.count} registro${data.count === 1 ? "" : "s"}`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
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
        count: data.count,
        helper: `${data.count} acerto${data.count === 1 ? "" : "s"}`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
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
    const freelancer = getBaseGroup("Freelancers / diárias")
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
        label: "Freelancers / diárias",
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
    return ordered.find((item) => item.total > 0) || null
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

  const deliveryCount = useMemo(() => {
    if (deliverySettlements.length > 0) return deliverySettlements.length
    return paidOrders.filter((order) => order.delivery_fee > 0).length
  }, [deliverySettlements.length, paidOrders])

  const averageDeliveryCost = useMemo(() => {
    if (deliveryCount <= 0) return 0
    return deliveryAreaSummary.total / deliveryCount
  }, [deliveryAreaSummary.total, deliveryCount])

  const bestProduct = useMemo(() => topProducts[0] || null, [topProducts])
  const bestChannel = useMemo(
    () => [...salesChannels].filter((item) => item.value > 0).sort((a, b) => b.value - a.value)[0] || null,
    [salesChannels],
  )
  const bestPaymentMethod = useMemo(
    () => [...paymentMethods].filter((item) => item.value > 0).sort((a, b) => b.value - a.value)[0] || null,
    [paymentMethods],
  )

  const productLeaderShare = useMemo(() => {
    return bestProduct ? percentage(bestProduct.value, totals.revenue) : 0
  }, [bestProduct, totals.revenue])

  const periodIncludesToday = useMemo(() => {
    const today = todayDate()
    return startDate <= today && endDate >= today
  }, [endDate, startDate])

  const hasTodayClosing = useMemo(() => {
    const today = todayDate()
    return closings.some((closing) => closing.closing_date?.slice(0, 10) === today)
  }, [closings])

  const priorityText = useMemo(() => {
    if (totals.pendingRevenue > 0) {
      return `Confirmar ${formatCurrency(totals.pendingRevenue)} em recebimentos pendentes para ter visão real do caixa.`
    }

    if (totalMainCosts === 0) {
      return "Registrar custos do período para não superestimar o resultado operacional."
    }

    if (periodIncludesToday && !hasTodayClosing) {
      return "Finalizar o fechamento de caixa de hoje para completar a leitura."
    }

    if (productLeaderShare >= 50 && bestProduct) {
      return `Acompanhar a concentração do produto líder: ${formatPercent(productLeaderShare)} da receita.`
    }

    if (operationalResult < 0) {
      return "Revisar custos e ticket médio antes de ampliar a operação."
    }

    return "Manter acompanhamento semanal de vendas, custos e recebimentos."
  }, [
    bestProduct,
    hasTodayClosing,
    operationalResult,
    periodIncludesToday,
    productLeaderShare,
    totalMainCosts,
    totals.pendingRevenue,
  ])

  const managerAlerts = useMemo(() => {
    const messages: { title: string; description: string; tone: AlertTone; icon: ReactNode }[] = []

    if (totals.pendingRevenue > 0) {
      messages.push({
        title: "Recebimentos pendentes",
        description: `${formatCurrency(totals.pendingRevenue)} para confirmar.`,
        tone: "orange",
        icon: <Wallet className="h-4 w-4" />,
      })
    }

    if (totalMainCosts === 0) {
      messages.push({
        title: "Sem custos registrados",
        description: "O resultado pode estar superestimado.",
        tone: "blue",
        icon: <Info className="h-4 w-4" />,
      })
    }

    if (periodIncludesToday && !hasTodayClosing) {
      messages.push({
        title: "Sem fechamento de caixa hoje",
        description: "Finalize o caixa para visão completa.",
        tone: "blue",
        icon: <CalendarDays className="h-4 w-4" />,
      })
    }

    if (bestProduct && productLeaderShare >= 50) {
      messages.push({
        title: "Produto líder concentrado",
        description: `${bestProduct.label} concentra ${formatPercent(productLeaderShare)} da receita.`,
        tone: "violet",
        icon: <BarChart3 className="h-4 w-4" />,
      })
    }

    if (totals.canceledOrdersCount > 0) {
      messages.push({
        title: "Pedidos cancelados no período",
        description: `${totals.canceledOrdersCount} pedido${totals.canceledOrdersCount === 1 ? "" : "s"} cancelado${
          totals.canceledOrdersCount === 1 ? "" : "s"
        }.`,
        tone: "red",
        icon: <XCircle className="h-4 w-4" />,
      })
    }

    return messages
  }, [
    bestProduct,
    hasTodayClosing,
    periodIncludesToday,
    productLeaderShare,
    totalMainCosts,
    totals.canceledOrdersCount,
    totals.pendingRevenue,
  ])

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
      console.error("Erro ao carregar relatório operacional:", error)
      alert(error?.message || "Não foi possível carregar o relatório operacional.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  const selectedDays = inclusiveDays(startDate, endDate)
  const sparklineValues = revenueByDay.length > 0 ? revenueByDay.map((item) => item.value) : [0, totals.revenue]

  const dreRows = [
    ["Receita recebida", <span key="received" className="font-black text-[#059669]">{formatCurrency(totals.revenue)}</span>],
    ["Receita pendente", <span key="pending" className="font-black text-yellow-400">{formatCurrency(totals.pendingRevenue)}</span>],
    ["Receita bruta total", <span key="gross" className="font-black text-[#ffffff]">{formatCurrency(totals.grossRevenue)}</span>],
    ["Custos com folha fixa", <span key="payroll">{formatCurrency(fixedPayroll)}</span>],
    ["Custos com freelancers / diárias", <span key="freelancers">{formatCurrency(freelancerCost)}</span>],
    ["Custos com entregadores", <span key="delivery">{formatCurrency(deliveryCost)}</span>],
    ["Custos com fornecedores", <span key="suppliers">{formatCurrency(supplierCost)}</span>],
    ["Outras despesas", <span key="other">{formatCurrency(otherCosts)}</span>],
    ["Total de custos", <span key="costs" className="font-black">{formatCurrency(totalMainCosts)}</span>],
  ]

  const productRows = topProducts.map((product, index) => [
    <span key="position" className="font-black text-[#a1a1aa]">{index + 1}</span>,
    <div key="product" className="max-w-[220px]">
      <p className="font-black leading-tight text-[#ffffff]">{product.label}</p>
      <p className="text-xs text-[#a1a1aa]">{product.helper}</p>
    </div>,
    <span key="quantity" className="font-bold">{product.quantity || 0}</span>,
    <span key="revenue" className="font-black">{formatCurrency(product.value)}</span>,
    <BarWithPercent key="share" percent={percentage(product.value, totals.revenue)} tone="blue" />,
  ])

  const paymentRows = paymentMethods.map((method) => {
    const isMain = bestPaymentMethod?.label === method.label && method.value > 0

    return [
      <div key="method" className="flex items-center gap-2">
        <span className="font-bold text-[#ffffff]">{method.label}</span>
        {isMain ? <StatusPill tone="blue">Principal</StatusPill> : null}
      </div>,
      <span key="value" className="font-black">{formatCurrency(method.value)}</span>,
      <span key="orders" className="font-bold">{method.orders || 0}</span>,
      <BarWithPercent key="share" percent={percentage(method.value, totals.revenue)} tone={isMain ? "blue" : "slate"} />,
    ]
  })

  const channelRows = salesChannels.map((channel) => [
    <span key="channel" className="font-bold text-[#ffffff]">{channel.label}</span>,
    <span key="value" className="font-black">{formatCurrency(channel.value)}</span>,
    <span key="orders" className="font-bold">{channel.orders || 0}</span>,
    <BarWithPercent key="share" percent={percentage(channel.value, totals.revenue)} tone="blue" />,
  ])

  const costRows = displayCostAreas.map((area) => [
    <span key="area" className="font-bold text-[#ffffff]">{area.label}</span>,
    <span key="total" className="font-black">{formatCurrency(area.total)}</span>,
    <span key="paid" className="font-bold text-[#059669]">{formatCurrency(area.paid)}</span>,
    <span key="pending" className="font-bold text-yellow-400">{formatCurrency(area.pending)}</span>,
    <BarWithPercent key="share" percent={percentage(area.total, totalMainCosts)} tone="orange" />,
  ])

  const supplierRows = suppliersRanking.map((supplier) => [
    <span key="supplier" className="font-bold text-[#ffffff]">{supplier.label}</span>,
    <span key="total" className="font-black">{formatCurrency(supplier.value)}</span>,
    <span key="count" className="font-bold">{supplier.count || 0}</span>,
  ])

  const deliveryRows = deliveryRanking.map((driver) => [
    <span key="driver" className="font-bold text-[#ffffff]">{driver.label}</span>,
    <span key="total" className="font-black">{formatCurrency(driver.value)}</span>,
    <span key="count" className="font-bold">{driver.count || 0}</span>,
  ])

  const closingRows = closings.slice(0, 6).map((closing) => [
    <span key="day" className="font-bold text-[#ffffff]">{formatWeekday(closing.closing_date)}</span>,
    <span key="date" className="font-bold text-[#a1a1aa]">{formatDate(closing.closing_date)}</span>,
    <span key="balance" className={cn("font-black", closing.estimated_profit >= 0 ? "text-[#059669]" : "text-[#dc2626]")}>
      {formatCurrency(closing.estimated_profit)}
    </span>,
    <StatusPill key="status" tone={closing.closed_at ? "green" : "orange"}>
      {closing.closed_at ? "Caixa fechado" : "Em aberto"}
    </StatusPill>,
    <span key="note" className="text-[#a1a1aa]">
      {closing.orders_count > 0
        ? `${closing.orders_count} pedido${closing.orders_count === 1 ? "" : "s"} · ticket ${formatCurrency(closing.average_ticket)}`
        : "-"}
    </span>,
  ])

  return (
    <AdminLayout>
      <div className="-m-2 space-y-4 bg-[#f4f7fb] p-2 sm:-m-3 sm:p-3 md:-m-4 md:p-4">
        <header className="rounded-2xl border border-[#111111] bg-[#0A0A0A] p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-[#ffffff] sm:text-3xl">
                  Relatório operacional
                </h1>
                <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-yellow-400">
                  Gerencial
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-[#a1a1aa]">
                Leitura completa do período para tomada de decisão.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[160px_160px_auto] xl:items-end">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#a1a1aa]">Data inicial</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-10 rounded-xl border-[#111111] bg-[#0A0A0A] font-bold text-[#ffffff]"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#a1a1aa]">Data final</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="h-10 rounded-xl border-[#111111] bg-[#0A0A0A] font-bold text-[#ffffff]"
                />
              </div>

              <div className="grid grid-cols-4 gap-2 sm:col-span-2 xl:col-span-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-xl border-[#111111] bg-[#0A0A0A] px-3 font-bold text-[#ffffff] hover:bg-yellow-400/10 hover:text-yellow-400"
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
                  className="h-10 rounded-xl border-[#111111] bg-[#0A0A0A] px-3 font-bold text-[#ffffff] hover:bg-yellow-400/10 hover:text-yellow-400"
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
                  className="h-10 rounded-xl border-[#111111] bg-[#0A0A0A] px-3 font-bold text-[#ffffff] hover:bg-yellow-400/10 hover:text-yellow-400"
                  onClick={() => {
                    setStartDate(lastThirtyDaysStart())
                    setEndDate(todayDate())
                  }}
                >
                  30d
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={loadData}
                  disabled={loading}
                  className="h-10 rounded-xl bg-yellow-400 px-3 font-bold text-black hover:bg-yellow-300"
                >
                  <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                  <span className="sr-only">Atualizar</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex items-center gap-3 rounded-2xl border border-yellow-400/30 bg-[#0A0A0A] px-4 py-3 text-sm font-bold text-[#ffffff] shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">
            <CalendarDays className="h-4 w-4" />
          </div>
          <span>
            Período selecionado: {formatDate(startDate)} até {formatDate(endDate)} ({selectedDays}{" "}
            {selectedDays === 1 ? "dia" : "dias"})
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-[#111111] bg-[#0A0A0A] py-16 text-sm font-bold text-[#a1a1aa] shadow-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-yellow-400" />
            Carregando relatório operacional...
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-lg font-black text-[#ffffff]">Resumo executivo</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                <MetricCard
                  title="Receita recebida"
                  value={formatCurrency(totals.revenue)}
                  helper={`${totals.paidOrdersCount} pedido${totals.paidOrdersCount === 1 ? "" : "s"} pago${
                    totals.paidOrdersCount === 1 ? "" : "s"
                  }`}
                  icon={<DollarSign className="h-4 w-4" />}
                  tone="green"
                  sparklineValues={sparklineValues}
                />
                <MetricCard
                  title="A receber"
                  value={formatCurrency(totals.pendingRevenue)}
                  helper={`${totals.pendingOrdersCount} pedido${totals.pendingOrdersCount === 1 ? "" : "s"} pendente${
                    totals.pendingOrdersCount === 1 ? "" : "s"
                  }`}
                  icon={<Wallet className="h-4 w-4" />}
                  tone={totals.pendingRevenue > 0 ? "orange" : "slate"}
                  sparklineValues={[0, totals.pendingRevenue]}
                />
                <MetricCard
                  title="Resultado operacional"
                  value={formatCurrency(operationalResult)}
                  helper={`${formatPercent(operationalMargin)} do recebido`}
                  icon={<TrendingUp className="h-4 w-4" />}
                  tone={operationalResult >= 0 ? "blue" : "red"}
                  sparklineValues={sparklineValues.map((value) => Math.max(value - totalMainCosts / Math.max(revenueByDay.length, 1), 0))}
                />
                <MetricCard
                  title="Margem operacional"
                  value={formatPercent(operationalMargin)}
                  helper="Sobre receita recebida"
                  icon={<Activity className="h-4 w-4" />}
                  tone="violet"
                  sparklineValues={[0, Math.max(operationalMargin, 0), Math.max(operationalMargin, 0) + 4]}
                />
                <MetricCard
                  title="Ticket médio"
                  value={formatCurrency(totals.averageTicket)}
                  helper="Valor médio dos pedidos pagos"
                  icon={<Target className="h-4 w-4" />}
                  tone="blue"
                  sparklineValues={sparklineValues.map((value) => value / Math.max(totals.paidOrdersCount, 1))}
                />
                <MetricCard
                  title="Total de pedidos"
                  value={String(totals.totalOrdersCount)}
                  helper="Total no período"
                  icon={<ShoppingBag className="h-4 w-4" />}
                  tone="slate"
                >
                  <div className="space-y-1.5 text-xs font-bold text-[#a1a1aa]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2"><StatusDot tone="green" /> pagos</span>
                      <span>{totals.paidOrdersCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2"><StatusDot tone="orange" /> pendentes</span>
                      <span>{totals.pendingOrdersCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2"><StatusDot tone="red" /> cancelados</span>
                      <span>{totals.canceledOrdersCount}</span>
                    </div>
                  </div>
                </MetricCard>
              </div>
            </section>

            <section className="rounded-2xl border border-[#ffffff] bg-[#ffffff] p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-white">Leitura para o dono</h2>
                <StatusPill tone={totals.pendingRevenue > 0 ? "orange" : "green"}>
                  {totals.pendingRevenue > 0 ? "Atenção" : "Conferido"}
                </StatusPill>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <OwnerInsight
                  icon={<DollarSign className="h-4 w-4" />}
                  label="Caixa"
                  value={`Entrou ${formatCurrency(totals.revenue)} no caixa no período.`}
                  tone="green"
                />
                <OwnerInsight
                  icon={totals.pendingRevenue > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  label="Recebimentos"
                  value={
                    totals.pendingRevenue > 0
                      ? `Ainda existem ${formatCurrency(totals.pendingRevenue)} pendentes para confirmar.`
                      : "Não há recebimentos pendentes no período."
                  }
                  tone={totals.pendingRevenue > 0 ? "orange" : "green"}
                />
                <OwnerInsight
                  icon={<Target className="h-4 w-4" />}
                  label="Ticket médio"
                  value={`Ticket médio foi de ${formatCurrency(totals.averageTicket)}.`}
                  tone="blue"
                />
                <OwnerInsight
                  icon={<ShoppingBag className="h-4 w-4" />}
                  label="Canal principal"
                  value={bestChannel ? `Principal canal foi ${bestChannel.label}.` : "Ainda não há canal principal com venda paga."}
                  tone="violet"
                />
                <OwnerInsight
                  icon={<Package className="h-4 w-4" />}
                  label="Produto líder"
                  value={bestProduct ? `Produto que mais vendeu foi ${bestProduct.label}.` : "Nenhum produto vendido encontrado no período."}
                  tone="blue"
                />
                <OwnerInsight
                  icon={<AlertTriangle className="h-4 w-4" />}
                  label="Ação"
                  value={
                    totals.pendingRevenue > 0
                      ? "Existe valor pendente que pode distorcer o caixa."
                      : "O caixa recebido não tem pendência financeira registrada."
                  }
                  tone={totals.pendingRevenue > 0 ? "orange" : "green"}
                />
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr_1.05fr]">
              <SectionCard
                title="DRE operacional do período"
                subtitle="Receita, custos e margem em leitura direta."
                icon={<FileText className="h-4 w-4" />}
              >
                <div className="overflow-hidden rounded-xl border border-[#111111]">
                  <div className="divide-y divide-[#edf2f8] bg-[#0A0A0A] text-sm">
                    {dreRows.map(([label, value]) => (
                      <div key={String(label)} className="flex items-center justify-between gap-4 px-3 py-2.5">
                        <span className="font-medium text-[#a1a1aa]">{label}</span>
                        <span className="shrink-0 text-right font-bold text-[#ffffff]">{value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-4 bg-[#ffffff] px-3 py-3 text-white">
                      <span className="font-black">Resultado operacional</span>
                      <strong className={cn("text-base", operationalResult >= 0 ? "text-emerald-300" : "text-red-300")}>
                        {formatCurrency(operationalResult)}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-4 px-3 py-3">
                      <span className="font-black text-[#ffffff]">Margem operacional</span>
                      <strong className={cn(operationalMargin >= 0 ? "text-[#059669]" : "text-[#dc2626]")}>
                        {formatPercent(operationalMargin)}
                      </strong>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Pedidos por status"
                subtitle="Pagos, pendentes e cancelados."
                icon={<PieChart className="h-4 w-4" />}
              >
                <StatusDonut
                  paid={totals.paidOrdersCount}
                  pending={totals.pendingOrdersCount}
                  canceled={totals.canceledOrdersCount}
                />
              </SectionCard>

              <SectionCard
                title="Ganhos por dia"
                subtitle="Barras compactas da receita recebida."
                icon={<BarChart3 className="h-4 w-4" />}
                action={<StatusPill tone="blue">R$</StatusPill>}
              >
                <RevenueBars items={revenueByDay} emptyText="Nenhuma venda paga encontrada no período." />
              </SectionCard>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <SectionCard
                title="Produtos mais vendidos"
                subtitle="Ordenado por faturamento do maior para o menor."
                icon={<Package className="h-4 w-4" />}
              >
                <CompactTable
                  headers={["#", "Produto", "Qtd", "Faturamento", "%"]}
                  rows={productRows}
                  footer={[
                    "Total",
                    `${topProducts.length} produto${topProducts.length === 1 ? "" : "s"}`,
                    topProducts.reduce((acc, product) => acc + (product.quantity || 0), 0),
                    formatCurrency(topProducts.reduce((acc, product) => acc + product.value, 0)),
                    formatPercent(percentage(topProducts.reduce((acc, product) => acc + product.value, 0), totals.revenue)),
                  ]}
                  emptyText="Nenhum item vendido encontrado no período."
                  minWidth="720px"
                />
              </SectionCard>

              <SectionCard
                title="Pagamentos recebidos"
                subtitle="Participação por forma de pagamento."
                icon={<CreditCard className="h-4 w-4" />}
              >
                <CompactTable
                  headers={["Forma", "Valor", "Pedidos", "%"]}
                  rows={paymentRows}
                  footer={["Total", formatCurrency(totals.revenue), totals.paidOrdersCount, formatPercent(totals.revenue > 0 ? 100 : 0)]}
                  emptyText="Nenhum pagamento recebido no período."
                  minWidth="620px"
                />
              </SectionCard>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <SectionCard
                title="Canais de venda"
                subtitle="Origem das vendas pagas no período."
                icon={<ShoppingBag className="h-4 w-4" />}
              >
                <CompactTable
                  headers={["Canal", "Valor", "Pedidos", "%"]}
                  rows={channelRows}
                  footer={["Total", formatCurrency(totals.revenue), totals.paidOrdersCount, formatPercent(totals.revenue > 0 ? 100 : 0)]}
                  emptyText="Nenhum canal encontrado no período."
                  minWidth="620px"
                />
              </SectionCard>

              <SectionCard
                title="Custos por área"
                subtitle="Quanto cada área pesou no período."
                icon={<Activity className="h-4 w-4" />}
              >
                <CompactTable
                  headers={["Área", "Total", "Pago", "Pendente", "%"]}
                  rows={costRows}
                  footer={["Total", formatCurrency(totalMainCosts), formatCurrency(displayCostAreas.reduce((acc, area) => acc + area.paid, 0)), formatCurrency(displayCostAreas.reduce((acc, area) => acc + area.pending, 0)), formatPercent(totalMainCosts > 0 ? 100 : 0)]}
                  emptyText="Nenhum custo encontrado no período."
                  minWidth="720px"
                />
              </SectionCard>

              <SectionCard
                title="Fornecedores e entregas"
                subtitle="Fornecedores, entregas e acertos individuais."
                icon={<Truck className="h-4 w-4" />}
              >
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-[#111111] bg-[#f8fbff] p-3">
                    <p className="text-xs font-bold text-[#a1a1aa]">Fornecedores</p>
                    <strong className="mt-1 block text-xl font-black text-[#ffffff]">{formatCurrency(supplierAreaSummary.total)}</strong>
                    <p className="text-xs text-[#a1a1aa]">Gasto total</p>
                  </div>
                  <div className="rounded-xl border border-[#111111] bg-[#f8fbff] p-3">
                    <p className="text-xs font-bold text-[#a1a1aa]">Entregas</p>
                    <strong className="mt-1 block text-xl font-black text-[#ffffff]">{deliveryCount}</strong>
                    <p className="text-xs text-[#a1a1aa]">Total no período</p>
                  </div>
                  <div className="rounded-xl border border-[#111111] bg-[#f8fbff] p-3">
                    <p className="text-xs font-bold text-[#a1a1aa]">Média por entrega</p>
                    <strong className="mt-1 block text-xl font-black text-[#ffffff]">{formatCurrency(averageDeliveryCost)}</strong>
                    <p className="text-xs text-[#a1a1aa]">Por entrega</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4">
                  <div>
                    <p className="mb-2 text-sm font-black text-[#ffffff]">Top fornecedores</p>
                    <CompactTable
                      headers={["Fornecedor", "Gasto", "Registros"]}
                      rows={supplierRows}
                      emptyText="Nenhum fornecedor encontrado no período."
                      minWidth="480px"
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-black text-[#ffffff]">Acertos por entregador</p>
                    <CompactTable
                      headers={["Entregador", "Valor", "Acertos"]}
                      rows={deliveryRows}
                      emptyText="Sem acerto individual de entregador no período."
                      minWidth="480px"
                    />
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="grid items-start gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <SectionCard
                title="Fechamentos de caixa"
                subtitle="Últimos fechamentos dentro do período selecionado."
                icon={<DollarSign className="h-4 w-4" />}
                action={
                  closings.length > 6 ? (
                    <a
                      href="/financeiro/caixa"
                      className="inline-flex items-center gap-1 text-xs font-black text-yellow-400 hover:text-yellow-400"
                    >
                      Ver todos <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  ) : null
                }
              >
                <CompactTable
                  headers={["Dia", "Data", "Saldo fechado", "Status", "Observação"]}
                  rows={closingRows}
                  emptyText="Nenhum fechamento de caixa encontrado no período."
                  minWidth="760px"
                />

                {closings.length > 6 ? (
                  <div className="mt-3 text-center">
                    <a
                      href="/financeiro/caixa"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-black text-yellow-400 hover:bg-yellow-300/10"
                    >
                      Ver todos os fechamentos <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                ) : null}
              </SectionCard>

              <SectionCard
                title="Alertas gerenciais"
                subtitle="Ações mostradas apenas quando fazem sentido para o período."
                icon={<AlertTriangle className="h-4 w-4" />}
              >
                {managerAlerts.length > 0 ? (
                  <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
                    {managerAlerts.map((alert) => {
                      const styles = {
                        blue: "border-yellow-400/30 bg-yellow-400/10 text-yellow-400",
                        orange: "border-yellow-400/30 bg-yellow-400/10 text-yellow-400",
                        red: "border-red-200 bg-red-50 text-red-800",
                        violet: "border-yellow-400/30 bg-yellow-400/10 text-yellow-400",
                      }[alert.tone]

                      return (
                        <div key={alert.title} className={cn("min-w-0 rounded-2xl border p-4", styles)}>
                          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#0A0A0A]">
                            {alert.icon}
                          </div>
                          <p className="break-words text-sm font-black leading-tight">{alert.title}</p>
                          <p className="mt-2 break-words text-xs font-medium leading-relaxed opacity-80">{alert.description}</p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <EmptyState text="Nenhum alerta gerencial relevante para o período selecionado." />
                )}
              </SectionCard>
            </div>

            <section className="rounded-2xl border border-[#ffffff] bg-[#ffffff] p-4 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-black text-white">Resumo para decisão</h2>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DecisionCard
                  title="Entrou"
                  value={formatCurrency(totals.revenue)}
                  helper="Receita recebida no período."
                  icon={<DollarSign className="h-6 w-6" />}
                  tone="green"
                />
                <DecisionCard
                  title="Pesou"
                  value={biggestCost ? formatCurrency(biggestCost.total) : "R$ 0,00"}
                  helper={biggestCost ? `Maior custo: ${biggestCost.label}.` : "Nenhum custo registrado."}
                  icon={<Activity className="h-6 w-6" />}
                  tone="orange"
                />
                <DecisionCard
                  title="Melhor venda"
                  value={bestProduct ? bestProduct.label : "Sem destaque"}
                  helper={bestProduct ? `${formatCurrency(bestProduct.value)} em faturamento.` : "Produto com maior faturamento ainda não identificado."}
                  icon={<Package className="h-6 w-6" />}
                  tone="blue"
                />
                <DecisionCard
                  title="Atenção"
                  value="Ação recomendada"
                  helper={priorityText}
                  icon={<AlertTriangle className="h-6 w-6" />}
                  tone="red"
                />
              </div>
            </section>

            <p className="pb-2 text-center text-xs font-medium text-[#a1a1aa]">
              Relatório gerencial baseado nos dados reais do período selecionado.
            </p>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
