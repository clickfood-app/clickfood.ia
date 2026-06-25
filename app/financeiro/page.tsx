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
  CreditCard,
  DollarSign,
  Loader2,
  Percent,
  ReceiptText,
  RefreshCcw,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"

type PeriodKey = "today" | "7d" | "30d" | "90d" | "month"

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

type CashflowPoint = {
  date: string
  label: string
  income: number
  expense: number
  result: number
}

type ExpenseBreakdown = {
  label: string
  total: number
  count: number
}

type RecentMovement = {
  id: string
  type: "income" | "expense"
  title: string
  description: string | null
  category: string
  amount: number
  occurred_at: string
}

type GenericFinanceRow = Record<string, unknown>

type DashboardData = {
  grossRevenue: number
  ordersCount: number
  averageTicket: number
  manualIncome: number
  expenses: number
  losses: number
  productCost: number
  estimatedProfit: number
  estimatedMargin: number
  cmv: number
  pixTotal: number
  cashTotal: number
  cardTotal: number
  productFinance: ProductFinance[]
  categoryFinance: CategoryFinance[]
  paymentBreakdown: PaymentBreakdown[]
  transactions: FinancialTransaction[]
  productLosses: ProductLoss[]
  expenseBreakdown: ExpenseBreakdown[]
  recentMovements: RecentMovement[]
  cashflowSeries: CashflowPoint[]
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
  estimatedMargin: 0,
  cmv: 0,
  pixTotal: 0,
  cashTotal: 0,
  cardTotal: 0,
  productFinance: [],
  categoryFinance: [],
  paymentBreakdown: [],
  transactions: [],
  productLosses: [],
  expenseBreakdown: [],
  recentMovements: [],
  cashflowSeries: [],
}

const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
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

  if (period === "90d") {
    date.setDate(date.getDate() - 89)
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

  if (["pix", "pix_manual", "manual_pix", "pix_direto", "pix_direct"].includes(method)) return "Pix"
  if (method === "cash" || method === "dinheiro") return "Dinheiro"
  if (method === "credit_card" || method === "credito") return "Crédito"
  if (method === "debit_card" || method === "debito") return "Débito"
  if (method === "card" || method === "cartao") return "Cartão"
  if (method === "card_on_delivery") return "Cartão na entrega"

  return paymentMethod || "Não informado"
}

function getPaymentBucket(paymentMethod: string | null) {
  const method = String(paymentMethod || "").toLowerCase()

  if (["pix", "pix_manual", "manual_pix", "pix_direto", "pix_direct"].includes(method)) return "pix"
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
          : period === "90d"
            ? 90
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

function getRecordNumber(record: GenericFinanceRow, keys: string[]) {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === "number") return value
    if (typeof value === "string" && value.trim() !== "") {
      const cleaned = value.replace(/[^0-9,.-]/g, "").trim()
      const normalized = cleaned.includes(",")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned
      const parsed = Number(normalized)

      if (Number.isFinite(parsed)) return parsed
    }
  }

  return 0
}

function getRecordString(record: GenericFinanceRow, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === "string" && value.trim() !== "") return value
    if (typeof value === "number") return String(value)
  }

  return fallback
}

function getRecordDate(record: GenericFinanceRow, keys: string[]) {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === "string" && value.trim() !== "") return value
  }

  return new Date().toISOString()
}

function isDateInsidePeriod(value: string, startIso: string) {
  const date = new Date(value)
  const start = new Date(startIso)
  const now = new Date()

  if (Number.isNaN(date.getTime())) return false

  return date >= start && date <= now
}

function isCancelledRecord(record: GenericFinanceRow) {
  const status = getRecordString(record, ["status", "payment_status", "state"]).toLowerCase()

  return ["cancelled", "canceled", "cancelado", "recusado", "void"].includes(status)
}

function classifyExpense(record: GenericFinanceRow, fallback = "Contas a pagar") {
  const text = [
    getRecordString(record, ["category", "type", "expense_type"]),
    getRecordString(record, ["title", "description", "notes", "supplier_name", "employee_name"]),
    getRecordString(record, ["origin", "source"]),
  ]
    .join(" ")
    .toLowerCase()

  if (text.includes("folha") || text.includes("funcion") || text.includes("sal") || text.includes("fixo")) {
    return "Folha / equipe"
  }

  if (text.includes("fornecedor") || text.includes("compra") || text.includes("supplier")) {
    return "Fornecedores"
  }

  if (text.includes("entregador") || text.includes("motoboy") || text.includes("delivery")) {
    return "Entregadores"
  }

  return fallback
}

function addBreakdown(
  map: Map<string, ExpenseBreakdown>,
  label: string,
  total: number,
  count = 1
) {
  if (total <= 0) return

  const current =
    map.get(label) ??
    ({
      label,
      total: 0,
      count: 0,
    } satisfies ExpenseBreakdown)

  current.total += total
  current.count += count

  map.set(label, current)
}

function calculateFixedPayroll(staffRows: GenericFinanceRow[], period: PeriodKey) {
  const monthlyTotal = staffRows
    .filter((staff) => {
      const status = getRecordString(staff, ["status", "active_status"]).toLowerCase()
      const kind = getRecordString(staff, ["employment_type", "contract_type", "type", "role_type"]).toLowerCase()
      const isInactive = ["inactive", "inativo", "desativado", "demitido"].includes(status)
      const isFreelancer = kind.includes("freela") || kind.includes("diaria") || kind.includes("daily")

      return !isInactive && !isFreelancer
    })
    .reduce(
      (sum, staff) =>
        sum +
        getRecordNumber(staff, [
          "monthly_salary",
          "salary",
          "base_salary",
          "fixed_salary",
          "salary_amount",
          "amount",
        ]),
      0
    )

  if (monthlyTotal <= 0) return 0

  if (period === "today") {
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    return monthlyTotal / daysInMonth
  }

  if (period === "7d") return (monthlyTotal / 30) * 7
  if (period === "90d") return monthlyTotal * 3

  return monthlyTotal
}

function buildCashflowSeries({
  orders,
  transactions,
  productLosses,
  accountsPayable,
  deliverySettlements,
  productCostByDate,
  fixedPayroll,
  period,
}: {
  orders: OrderRow[]
  transactions: FinancialTransaction[]
  productLosses: ProductLoss[]
  accountsPayable: GenericFinanceRow[]
  deliverySettlements: GenericFinanceRow[]
  productCostByDate: Map<string, number>
  fixedPayroll: number
  period: PeriodKey
}) {
  const days = getSeriesDays(period)
  const incomeByDate = new Map<string, number>()
  const expenseByDate = new Map<string, number>()

  for (const day of days) {
    const key = getLocalDateString(day)
    incomeByDate.set(key, 0)
    expenseByDate.set(key, 0)
  }

  const addIncome = (dateValue: string, amount: number) => {
    const key = getLocalDateString(new Date(dateValue))
    if (!incomeByDate.has(key)) return
    incomeByDate.set(key, Number(incomeByDate.get(key) || 0) + amount)
  }

  const addExpense = (dateValue: string, amount: number) => {
    const key = getLocalDateString(new Date(dateValue))
    if (!expenseByDate.has(key)) return
    expenseByDate.set(key, Number(expenseByDate.get(key) || 0) + amount)
  }

  for (const order of orders) {
    addIncome(order.created_at, Number(order.total || 0))
  }

  for (const transaction of transactions) {
    if (isCashClosingTransaction(transaction)) continue

    if (transaction.type === "income") {
      addIncome(transaction.occurred_at, Number(transaction.amount || 0))
    } else {
      addExpense(transaction.occurred_at, Number(transaction.amount || 0))
    }
  }

  for (const loss of productLosses) {
    addExpense(loss.occurred_at, Number(loss.total_cost || 0))
  }

  for (const payable of accountsPayable) {
    addExpense(
      getRecordDate(payable, ["paid_at", "due_date", "created_at", "updated_at"]),
      getRecordNumber(payable, ["amount", "total_amount", "total", "value", "paid_amount"])
    )
  }

  for (const settlement of deliverySettlements) {
    addExpense(
      getRecordDate(settlement, ["paid_at", "settled_at", "settlement_date", "created_at"]),
      getRecordNumber(settlement, [
        "amount",
        "total_amount",
        "total",
        "total_delivery_fee",
        "delivery_fee_total",
        "settlement_amount",
        "value",
      ])
    )
  }

  for (const [date, amount] of productCostByDate.entries()) {
    addExpense(date, amount)
  }

  if (fixedPayroll > 0 && days.length > 0) {
    const dailyPayroll = fixedPayroll / days.length

    for (const day of days) {
      addExpense(day.toISOString(), dailyPayroll)
    }
  }

  return days.map((day) => {
    const date = getLocalDateString(day)
    const income = Number(incomeByDate.get(date) || 0)
    const expense = Number(expenseByDate.get(date) || 0)

    return {
      date,
      label: new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }).format(day),
      income,
      expense,
      result: income - expense,
    }
  })
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
    blue: "bg-yellow-400",
    green: "bg-yellow-400",
    red: "bg-red-500",
    amber: "bg-yellow-400",
    slate: "bg-yellow-400",
  }[tone]

  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#111111]">
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
    blue: "bg-yellow-400 text-black ring-yellow-300/40",
    green: "bg-yellow-400 text-black ring-yellow-300/40",
    red: "bg-red-500/10 text-red-500 ring-red-500/20",
    amber: "bg-yellow-400 text-black ring-yellow-300/40",
    slate: "bg-[#080808] text-zinc-500 ring-yellow-500/20",
  }[tone]

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-yellow-500/25 bg-[#050505] p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-yellow-400/70 hover:bg-[#080808] sm:p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-500">{title}</p>
          <p className="mt-2 truncate text-2xl font-black tracking-tight text-white">
            {value}
          </p>
          <p className="mt-2 text-xs font-medium leading-5 text-zinc-500">
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
        "animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-yellow-500/25 bg-[#050505] p-4 shadow-sm sm:p-5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-black tracking-tight text-white">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-sm leading-5 text-zinc-500">{subtitle}</p>
          )}
        </div>

        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-400 text-black">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  )
}

function CashflowChart({ data }: { data: CashflowPoint[] }) {
  const totalIncome = data.reduce((sum, item) => sum + item.income, 0)
  const totalExpense = data.reduce((sum, item) => sum + item.expense, 0)
  const totalResult = data.reduce((sum, item) => sum + item.result, 0)

  const maxValue = Math.max(
    ...data.flatMap((item) => [item.income, item.expense, Math.abs(item.result)]),
    1
  )

  const listData = [...data].reverse()

  function getBarWidth(value: number) {
    if (value <= 0) return "0%"
    return `${Math.max((value / maxValue) * 100, 3)}%`
  }

  if (data.length === 0) {
    return <EmptyState message="Nenhuma entrada ou saída encontrada no período." />
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-yellow-500/30 bg-[#080808] px-3 py-2.5">
          <p className="text-[9px] font-black uppercase tracking-wide text-yellow-300 sm:text-[10px]">
            Entradas
          </p>
          <p className="mt-0.5 text-sm font-black text-white sm:text-base">
            {formatCurrency(totalIncome)}
          </p>
        </div>

        <div className="rounded-2xl border border-red-500/25 bg-[#080808] px-3 py-2.5">
          <p className="text-[9px] font-black uppercase tracking-wide text-red-400 sm:text-[10px]">
            Saídas
          </p>
          <p className="mt-0.5 text-sm font-black text-red-400 sm:text-base">
            {formatCurrency(totalExpense)}
          </p>
        </div>

        <div className="rounded-2xl border border-yellow-500/25 bg-[#080808] px-3 py-2.5">
          <p className="text-[9px] font-black uppercase tracking-wide text-yellow-300 sm:text-[10px]">
            Resultado
          </p>
          <p className="mt-0.5 text-sm font-black text-white sm:text-base">
            {formatCurrency(totalResult)}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-yellow-500/20 bg-[#050505] p-3">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] font-bold text-zinc-500">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            Entradas
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Saídas
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            Resultado
          </div>
        </div>

        <div
          className="max-h-[330px] space-y-2 overflow-y-auto pr-1 sm:max-h-[390px]
          [&::-webkit-scrollbar]:w-2
          [&::-webkit-scrollbar-track]:rounded-full
          [&::-webkit-scrollbar-track]:bg-[#080808]
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb]:bg-yellow-500/60
          [&::-webkit-scrollbar-thumb:hover]:bg-yellow-400"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#facc15 #18181b",
          }}
        >
          {listData.map((item) => {
            const resultValue = Math.abs(item.result)
            const hasMovement =
              item.income > 0 || item.expense > 0 || resultValue > 0

            return (
              <div
                key={item.date}
                className="rounded-2xl border border-yellow-500/20 bg-[#080808] px-3 py-2.5 shadow-sm"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-white sm:text-sm">
                      {item.label}
                    </p>
                    <p className="text-[10px] font-medium text-zinc-500">
                      {hasMovement ? "Movimentação do dia" : "Sem movimentação"}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[9px] font-bold uppercase text-zinc-500">
                      Saldo
                    </p>
                    <p
                      className={cn(
                        "text-xs font-black sm:text-sm",
                        item.result >= 0 ? "text-yellow-300" : "text-red-500"
                      )}
                    >
                      {formatCurrency(item.result)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="grid grid-cols-[58px_1fr_78px] items-center gap-2 sm:grid-cols-[76px_1fr_105px]">
                    <span className="text-[10px] font-black text-zinc-500 sm:text-xs">
                      Entrada
                    </span>

                    <div className="h-2 overflow-hidden rounded-full bg-[#111111]">
                      <div
                        className="h-full rounded-full bg-yellow-400"
                        style={{ width: getBarWidth(item.income) }}
                      />
                    </div>

                    <span className="text-right text-[10px] font-black text-zinc-500 sm:text-xs">
                      {formatCurrency(item.income)}
                    </span>
                  </div>

                  <div className="grid grid-cols-[58px_1fr_78px] items-center gap-2 sm:grid-cols-[76px_1fr_105px]">
                    <span className="text-[10px] font-black text-red-400 sm:text-xs">
                      Saída
                    </span>

                    <div className="h-2 overflow-hidden rounded-full bg-red-500/10">
                      <div
                        className="h-full rounded-full bg-red-500"
                        style={{ width: getBarWidth(item.expense) }}
                      />
                    </div>

                    <span className="text-right text-[10px] font-black text-red-400 sm:text-xs">
                      {formatCurrency(item.expense)}
                    </span>
                  </div>

                  <div className="grid grid-cols-[58px_1fr_78px] items-center gap-2 sm:grid-cols-[76px_1fr_105px]">
                    <span className="text-[10px] font-black text-zinc-500 sm:text-xs">
                      Resultado
                    </span>

                    <div className="h-2 overflow-hidden rounded-full bg-[#111111]">
                      <div
                        className="h-full rounded-full bg-yellow-400"
                        style={{ width: getBarWidth(resultValue) }}
                      />
                    </div>

                    <span
                      className={cn(
                        "text-right text-[10px] font-black sm:text-xs",
                        item.result >= 0 ? "text-yellow-300" : "text-red-500"
                      )}
                    >
                      {formatCurrency(item.result)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-[11px] font-medium text-zinc-500">
        Histórico automático com entradas, saídas e resultado do período selecionado.
      </p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-yellow-500/25 bg-[#080808] px-4 py-8 text-center text-sm font-medium text-zinc-500">
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
    default: "text-white",
    green: "text-yellow-300",
    red: "text-red-500",
    blue: "text-yellow-300",
  }[tone]

  return (
    <div className="flex items-center justify-between gap-3 border-b border-yellow-500/10 py-2.5 last:border-b-0">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
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
      const chartOrderIds = validChartOrders.map((order) => order.id)
      const allOrderIdsForCost = Array.from(new Set([...orderIds, ...chartOrderIds]))

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

      let allOrderItems: RawOrderItem[] = []

      if (allOrderIdsForCost.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", allOrderIdsForCost)

        if (itemsError) throw itemsError

        allOrderItems = (itemsData ?? []) as RawOrderItem[]
      }

      const orderIdSet = new Set(orderIds)
      const chartOrderIdSet = new Set(chartOrderIds)
      const orderItems = allOrderItems.filter((rawItem) => {
        const item = normalizeOrderItem(rawItem)
        return orderIdSet.has(item.orderId)
      })

      const { data: transactionsData, error: transactionsError } = await supabase
        .from("financial_transactions")
        .select(
          "id, type, origin, title, description, amount, category, payment_method, occurred_at"
        )
        .eq("restaurant_id", resolvedRestaurantId)
        .gte("occurred_at", startDate)
        .order("occurred_at", { ascending: false })

      if (transactionsError) throw transactionsError

      const { data: chartTransactionsData, error: chartTransactionsError } = await supabase
        .from("financial_transactions")
        .select(
          "id, type, origin, title, description, amount, category, payment_method, occurred_at"
        )
        .eq("restaurant_id", resolvedRestaurantId)
        .gte("occurred_at", chartStartDate)
        .order("occurred_at", { ascending: false })

      if (chartTransactionsError) throw chartTransactionsError

      const { data: lossesData, error: lossesError } = await supabase
        .from("product_losses")
        .select(
          "id, product_id, product_name, quantity, unit_cost, total_cost, reason, notes, occurred_at"
        )
        .eq("restaurant_id", resolvedRestaurantId)
        .gte("occurred_at", startDate)
        .order("occurred_at", { ascending: false })

      if (lossesError) throw lossesError

      const { data: chartLossesData, error: chartLossesError } = await supabase
        .from("product_losses")
        .select(
          "id, product_id, product_name, quantity, unit_cost, total_cost, reason, notes, occurred_at"
        )
        .eq("restaurant_id", resolvedRestaurantId)
        .gte("occurred_at", chartStartDate)
        .order("occurred_at", { ascending: false })

      if (chartLossesError) throw chartLossesError

      const { data: accountsPayableData, error: accountsPayableError } = await supabase
        .from("accounts_payable")
        .select("*")
        .eq("restaurant_id", resolvedRestaurantId)

      if (accountsPayableError) throw accountsPayableError

      const { data: deliverySettlementsData, error: deliverySettlementsError } = await supabase
        .from("delivery_settlements")
        .select("*")
        .eq("restaurant_id", resolvedRestaurantId)

      if (deliverySettlementsError) throw deliverySettlementsError

      const { data: staffData, error: staffError } = await supabase
        .from("staff_members")
        .select("*")
        .eq("restaurant_id", resolvedRestaurantId)

      if (staffError) {
        console.warn("Não foi possível carregar equipe para estimar folha fixa:", staffError)
      }

      const transactions = (transactionsData ?? []) as FinancialTransaction[]
      const chartTransactions = (chartTransactionsData ?? []) as FinancialTransaction[]
      const productLosses = (lossesData ?? []) as ProductLoss[]
      const chartProductLosses = (chartLossesData ?? []) as ProductLoss[]
      const allAccountsPayable = (accountsPayableData ?? []) as GenericFinanceRow[]
      const allDeliverySettlements = (deliverySettlementsData ?? []) as GenericFinanceRow[]
      const staffRows = staffError ? [] : ((staffData ?? []) as GenericFinanceRow[])

      const accountsPayable = allAccountsPayable.filter((payable) => {
        const date = getRecordDate(payable, ["paid_at", "due_date", "created_at", "updated_at"])
        return !isCancelledRecord(payable) && isDateInsidePeriod(date, startDate)
      })

      const chartAccountsPayable = allAccountsPayable.filter((payable) => {
        const date = getRecordDate(payable, ["paid_at", "due_date", "created_at", "updated_at"])
        return !isCancelledRecord(payable) && isDateInsidePeriod(date, chartStartDate)
      })

      const deliverySettlements = allDeliverySettlements.filter((settlement) => {
        const date = getRecordDate(settlement, ["paid_at", "settled_at", "settlement_date", "created_at"])
        return !isCancelledRecord(settlement) && isDateInsidePeriod(date, startDate)
      })

      const chartDeliverySettlements = allDeliverySettlements.filter((settlement) => {
        const date = getRecordDate(settlement, ["paid_at", "settled_at", "settlement_date", "created_at"])
        return !isCancelledRecord(settlement) && isDateInsidePeriod(date, chartStartDate)
      })

      const productsById = new Map(productRows.map((product) => [product.id, product]))
      const categoriesById = new Map(
        categoryRows.map((category) => [category.id, category.name])
      )
      const validChartOrdersById = new Map(validChartOrders.map((order) => [order.id, order]))

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

      const manualExpenses = transactions
        .filter(
          (transaction) =>
            transaction.type === "expense" && !isCashClosingTransaction(transaction)
        )
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)

      const accountsPayableExpenses = accountsPayable.reduce(
        (sum, payable) =>
          sum + getRecordNumber(payable, ["amount", "total_amount", "total", "value", "paid_amount"]),
        0
      )

      const deliveryExpenses = deliverySettlements.reduce(
        (sum, settlement) =>
          sum +
          getRecordNumber(settlement, [
            "amount",
            "total_amount",
            "total",
            "total_delivery_fee",
            "delivery_fee_total",
            "settlement_amount",
            "value",
          ]),
        0
      )

      const hasPayrollInAccountsPayable = accountsPayable.some(
        (payable) => classifyExpense(payable) === "Folha / equipe"
      )
      const fixedPayroll = hasPayrollInAccountsPayable
        ? 0
        : calculateFixedPayroll(staffRows, period)

      const expenses = manualExpenses + accountsPayableExpenses + deliveryExpenses + fixedPayroll

      const losses = productLosses.reduce(
        (sum, loss) => sum + Number(loss.total_cost || 0),
        0
      )

      const productFinanceMap = new Map<string, ProductFinance>()
      const chartProductCostByDate = new Map<string, number>()

      for (const rawItem of allOrderItems) {
        const item = normalizeOrderItem(rawItem)
        const product = item.productId ? productsById.get(item.productId) : null
        const itemCost = Number(product?.cost_price || 0) * item.quantity

        if (chartOrderIdSet.has(item.orderId)) {
          const order = validChartOrdersById.get(item.orderId)

          if (order) {
            const dateKey = getLocalDateString(new Date(order.created_at))
            chartProductCostByDate.set(
              dateKey,
              Number(chartProductCostByDate.get(dateKey) || 0) + itemCost
            )
          }
        }
      }

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

      const totalIncome = grossRevenue + manualIncome
      const totalOutflow = expenses + losses + productCost
      const estimatedProfit = totalIncome - totalOutflow
      const cmv = calculateCmv(grossRevenue, productCost)
      const estimatedMargin = calculateMargin(totalIncome, estimatedProfit)

      const expenseBreakdownMap = new Map<string, ExpenseBreakdown>()

      for (const payable of accountsPayable) {
        addBreakdown(
          expenseBreakdownMap,
          classifyExpense(payable),
          getRecordNumber(payable, ["amount", "total_amount", "total", "value", "paid_amount"])
        )
      }

      addBreakdown(expenseBreakdownMap, "Folha / equipe", fixedPayroll)
      addBreakdown(expenseBreakdownMap, "Entregadores", deliveryExpenses, deliverySettlements.length)
      addBreakdown(expenseBreakdownMap, "Despesas manuais", manualExpenses, transactions.filter((transaction) => transaction.type === "expense").length)
      addBreakdown(expenseBreakdownMap, "Perdas/desperdício", losses, productLosses.length)
      addBreakdown(expenseBreakdownMap, "CMV / custo dos produtos", productCost, productFinance.length)

      const recentMovements: RecentMovement[] = [
        ...transactions
          .filter((transaction) => !isCashClosingTransaction(transaction))
          .map((transaction) => ({
            id: transaction.id,
            type: transaction.type,
            title: transaction.title,
            description: transaction.description,
            category: transaction.category || "Lançamento manual",
            amount: Number(transaction.amount || 0),
            occurred_at: transaction.occurred_at,
          } satisfies RecentMovement)),
        ...accountsPayable.map((payable, index) => ({
          id: String(payable.id || `payable-${index}`),
          type: "expense" as const,
          title: getRecordString(payable, ["title", "description", "name"], classifyExpense(payable)),
          description: getRecordString(payable, ["notes", "supplier_name"], "") || null,
          category: classifyExpense(payable),
          amount: getRecordNumber(payable, ["amount", "total_amount", "total", "value", "paid_amount"]),
          occurred_at: getRecordDate(payable, ["paid_at", "due_date", "created_at", "updated_at"]),
        } satisfies RecentMovement)),
        ...deliverySettlements.map((settlement, index) => ({
          id: String(settlement.id || `delivery-${index}`),
          type: "expense" as const,
          title: getRecordString(settlement, ["title", "description", "delivery_person_name"], "Acerto de entregador"),
          description: null,
          category: "Entregadores",
          amount: getRecordNumber(settlement, [
            "amount",
            "total_amount",
            "total",
            "total_delivery_fee",
            "delivery_fee_total",
            "settlement_amount",
            "value",
          ]),
          occurred_at: getRecordDate(settlement, ["paid_at", "settled_at", "settlement_date", "created_at"]),
        } satisfies RecentMovement)),
        ...productLosses.map((loss) => ({
          id: loss.id,
          type: "expense" as const,
          title: loss.product_name || "Perda registrada",
          description: loss.notes,
          category: `Perda • ${loss.reason || "Sem motivo"}`,
          amount: Number(loss.total_cost || 0),
          occurred_at: loss.occurred_at,
        } satisfies RecentMovement)),
      ]
        .filter((movement) => movement.amount > 0)
        .sort(
          (a, b) =>
            new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
        )

      setData({
        grossRevenue,
        ordersCount,
        averageTicket,
        manualIncome,
        expenses,
        losses,
        productCost,
        estimatedProfit,
        estimatedMargin,
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
        expenseBreakdown: Array.from(expenseBreakdownMap.values()).sort(
          (a, b) => b.total - a.total
        ),
        recentMovements,
        cashflowSeries: buildCashflowSeries({
          orders: validChartOrders,
          transactions: chartTransactions,
          productLosses: chartProductLosses,
          accountsPayable: chartAccountsPayable,
          deliverySettlements: chartDeliverySettlements,
          productCostByDate: chartProductCostByDate,
          fixedPayroll,
          period: chartPeriod,
        }),
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

  const totalIncome = data.grossRevenue + data.manualIncome
  const totalOutflow = data.expenses + data.losses + data.productCost
  const cashBalance = data.estimatedProfit


  const pixPercentage =
    data.grossRevenue > 0 ? Math.round((data.pixTotal / data.grossRevenue) * 100) : 0

  const outflowPercentage =
    totalIncome > 0 ? Math.round((totalOutflow / totalIncome) * 100) : 0

  const bestPaymentMethod = data.paymentBreakdown[0]

  const insightItems = [
    data.grossRevenue > 0
      ? `Pix representa ${pixPercentage}% do faturamento de pedidos no período.`
      : "Ainda não há faturamento registrado nesse período.",
    data.ordersCount > 0
      ? `Ticket médio atual: ${formatCurrency(data.averageTicket)}.`
      : "Quando os pedidos entrarem, o ticket médio aparecerá aqui.",
    data.cmv > 0
      ? data.cmv > 40
        ? `CMV em ${data.cmv.toFixed(1)}%: atenção, o custo dos produtos está alto.`
        : `CMV em ${data.cmv.toFixed(1)}%: custo dos produtos está controlado.`
      : "Cadastre custo nos produtos para calcular o CMV com precisão.",
    totalOutflow > 0
      ? `Saídas, perdas e CMV representam ${outflowPercentage}% das entradas.`
      : "Nenhuma saída, perda ou custo registrado nesse período.",
    bestPaymentMethod
      ? `${bestPaymentMethod.label} é a forma de pagamento mais usada no período.`
      : "As formas de pagamento aparecerão conforme os pedidos forem pagos.",
  ]

  return (
    <AdminLayout title="Finanças">
      <div className="space-y-5 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Resumo financeiro
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Entradas, saídas, CMV, lucro estimado e saúde financeira.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {periodOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setPeriod(option.key)}
                className={cn(
                  "h-10 rounded-xl px-3 text-sm font-bold transition sm:px-4",
                  period === option.key
                    ? "bg-yellow-400 text-black shadow-sm shadow-yellow-500/20"
                    : "border border-white/10 bg-[#050505] text-zinc-500 hover:border-yellow-400 hover:bg-[#080808] hover:text-yellow-300"
                )}
              >
                {option.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => void loadFinanceiro()}
              className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#050505] px-4 text-sm font-bold text-zinc-500 transition hover:border-yellow-400 hover:bg-[#080808] hover:text-yellow-300 sm:col-span-1"
            >
              <RefreshCcw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-white/10 bg-[#050505]">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando finanças...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <MetricCard
                title="Faturamento"
                value={formatCurrency(data.grossRevenue)}
                subtitle={`${getPeriodLabel(period)} • pedidos pagos/válidos`}
                tone="blue"
                delay={0}
                icon={<DollarSign className="h-5 w-5" />}
              />

              <MetricCard
                title="Entradas"
                value={formatCurrency(totalIncome)}
                subtitle="Pedidos + entradas manuais"
                tone="green"
                delay={60}
                icon={<ArrowUpRight className="h-5 w-5" />}
              />

              <MetricCard
                title="Saídas"
                value={formatCurrency(totalOutflow)}
                subtitle="Despesas + perdas + CMV"
                tone="red"
                delay={120}
                icon={<ArrowDownLeft className="h-5 w-5" />}
              />

              <MetricCard
                title="Resultado"
                value={formatCurrency(cashBalance)}
                subtitle={`Margem estimada: ${data.estimatedMargin.toFixed(1)}%`}
                tone={cashBalance >= 0 ? "green" : "red"}
                delay={180}
                icon={<Wallet className="h-5 w-5" />}
              />

              <MetricCard
                title="Ticket médio"
                value={formatCurrency(data.averageTicket)}
                subtitle={`${data.ordersCount} pedido(s) no período`}
                tone="slate"
                delay={240}
                icon={<ShoppingCart className="h-5 w-5" />}
              />

              <MetricCard
                title="CMV"
                value={`${data.cmv.toFixed(1)}%`}
                subtitle="Custo dos produtos vendidos"
                tone={data.cmv > 40 ? "red" : data.cmv > 30 ? "amber" : "blue"}
                delay={300}
                icon={<Percent className="h-5 w-5" />}
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
              <FinanceCard
                title="Histórico de entradas e saídas"
                subtitle={
                  period === "today"
                    ? "Comparativo dos últimos 7 dias para não olhar só o dia atual"
                    : `Entradas, saídas e resultado em ${getPeriodLabel(period).toLowerCase()}`
                }
                icon={<TrendingUp className="h-5 w-5" />}
              >
                <CashflowChart data={data.cashflowSeries} />
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
                            <p className="text-sm font-black text-white">
                              {payment.label}
                            </p>
                            <p className="text-xs font-medium text-zinc-500">
                              {payment.count} pedido(s)
                            </p>
                          </div>

                          <p className="text-sm font-black text-yellow-300">
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
                title="Despesas automáticas"
                subtitle="Folha, entregadores, fornecedores, perdas e CMV"
                icon={<ReceiptText className="h-5 w-5" />}
                className="xl:col-span-1"
              >
                <div className="space-y-4">
                  {data.expenseBreakdown.length === 0 ? (
                    <EmptyState message="Nenhuma despesa registrada nesse período." />
                  ) : (
                    data.expenseBreakdown.map((expense) => (
                      <div key={expense.label}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-white">
                              {expense.label}
                            </p>
                            <p className="text-xs font-medium text-zinc-500">
                              {expense.count} lançamento(s)
                            </p>
                          </div>

                          <p className="text-sm font-black text-red-500">
                            {formatCurrency(expense.total)}
                          </p>
                        </div>

                        <ProgressBar value={expense.total} max={totalOutflow} tone="red" />
                      </div>
                    ))
                  )}
                </div>
              </FinanceCard>

              <FinanceCard
                title="Resumo do período"
                subtitle="DRE rápida para bater o olho"
                icon={<Banknote className="h-5 w-5" />}
                className="xl:col-span-1"
              >
                <div className="rounded-xl border border-yellow-500/20 bg-[#080808] p-4">
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
                    label="Total de entradas"
                    value={formatCurrency(totalIncome)}
                    tone="green"
                  />
                  <ReportLine
                    label="Despesas operacionais"
                    value={`-${formatCurrency(data.expenses)}`}
                    tone="red"
                  />
                  <ReportLine
                    label="Perdas registradas"
                    value={`-${formatCurrency(data.losses)}`}
                    tone="red"
                  />
                  <ReportLine
                    label="CMV / custo dos produtos"
                    value={`-${formatCurrency(data.productCost)}`}
                    tone="red"
                  />
                  <ReportLine label="CMV estimado" value={`${data.cmv.toFixed(1)}%`} />
                  <ReportLine
                    label="Resultado estimado"
                    value={formatCurrency(data.estimatedProfit)}
                    tone={data.estimatedProfit >= 0 ? "blue" : "red"}
                  />
                  <ReportLine
                    label="Margem estimada"
                    value={`${data.estimatedMargin.toFixed(1)}%`}
                    tone={data.estimatedMargin >= 0 ? "blue" : "red"}
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
                      className="flex gap-3 rounded-xl border border-yellow-500/20 bg-[#080808] px-3 py-3"
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                          index === 0
                            ? "bg-yellow-400 text-black"
                            : index === 1
                              ? "bg-yellow-400 text-black"
                              : index === 2
                                ? "bg-yellow-400 text-black"
                                : index === 3
                                  ? "bg-red-500/10 text-red-500"
                                  : "bg-yellow-400 text-black"
                        )}
                      >
                        {index === 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : index === 1 ? (
                          <Wallet className="h-4 w-4" />
                        ) : index === 2 ? (
                          <Percent className="h-4 w-4" />
                        ) : index === 3 ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : (
                          <CreditCard className="h-4 w-4" />
                        )}
                      </div>

                      <p className="text-sm font-medium leading-5 text-zinc-500">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </FinanceCard>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <FinanceCard
                title="Entradas e saídas recentes"
                subtitle="Movimentos automáticos e manuais do período"
                icon={<ReceiptText className="h-5 w-5" />}
              >
                <div className="space-y-2">
                  {data.recentMovements.length === 0 ? (
                    <EmptyState message="Nenhum movimento financeiro nesse período." />
                  ) : (
                    data.recentMovements.slice(0, 8).map((movement) => (
                      <div
                        key={`${movement.type}-${movement.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-yellow-500/20 bg-[#080808] px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">
                            {movement.title}
                          </p>

                          <p className="mt-1 truncate text-xs font-medium text-zinc-500">
                            {movement.category} • {formatDateTime(movement.occurred_at)}
                          </p>
                        </div>

                        <p
                          className={cn(
                            "shrink-0 text-sm font-black",
                            movement.type === "income"
                              ? "text-yellow-300"
                              : "text-red-500"
                          )}
                        >
                          {movement.type === "income" ? "+" : "-"}
                          {formatCurrency(movement.amount)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </FinanceCard>

              <FinanceCard
                title="Leitura geral"
                subtitle="Resumo prático sem fechamento de caixa"
                icon={<ArrowUpRight className="h-5 w-5" />}
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-yellow-500/25 bg-[#080808] p-4">
                    <div className="flex items-center gap-2 text-yellow-300">
                      <ArrowUpRight className="h-4 w-4" />
                      <p className="text-xs font-black uppercase tracking-wide">
                        Entradas
                      </p>
                    </div>

                    <p className="mt-3 text-xl font-black text-white">
                      {formatCurrency(totalIncome)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-red-500/25 bg-[#080808] p-4">
                    <div className="flex items-center gap-2 text-red-400">
                      <ArrowDownLeft className="h-4 w-4" />
                      <p className="text-xs font-black uppercase tracking-wide">
                        Saídas
                      </p>
                    </div>

                    <p className="mt-3 text-xl font-black text-red-400">
                      {formatCurrency(totalOutflow)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-yellow-500/25 bg-[#080808] p-4">
                    <div className="flex items-center gap-2 text-yellow-300">
                      <Wallet className="h-4 w-4" />
                      <p className="text-xs font-black uppercase tracking-wide">
                        Resultado
                      </p>
                    </div>

                    <p className="mt-3 text-xl font-black text-white">
                      {formatCurrency(cashBalance)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-yellow-500/20 bg-[#080808] p-4">
                  <p className="text-sm font-bold leading-6 text-zinc-500">
                    Esta aba soma automaticamente pedidos pagos, entradas manuais,
                    contas a pagar, folha/equipe, entregadores, perdas e o custo dos
                    produtos vendidos. Fechamento de caixa fica fora daqui.
                  </p>
                </div>
              </FinanceCard>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  )
}