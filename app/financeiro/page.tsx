"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  CalendarDays,
  Loader2,
  RefreshCcw,
} from "lucide-react"

type DateRange = {
  start: string
  end: string
}

type DatePreset =
  | "today"
  | "7d"
  | "month"
  | "lastMonth"

type PaymentLabel =
  | "Pix"
  | "Crédito"
  | "Débito"
  | "Dinheiro"

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

type PaymentBreakdown = {
  label: PaymentLabel
  total: number
  count: number
}

type ExpenseBreakdown = {
  label: string
  total: number
  count: number
}

type DailyFinancialRow = {
  date: string
  label: string
  income: number
  salesRevenue: number
  expense: number
  result: number
  orders: number
}

type ChartPoint = {
  key: string
  label: string
  income: number
  expense: number
  result: number
  orders: number
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
  hasProductCost: boolean
  paymentBreakdown: PaymentBreakdown[]
  expenseBreakdown: ExpenseBreakdown[]
  recentMovements: RecentMovement[]
  dailyRows: DailyFinancialRow[]
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
  hasProductCost: false,
  paymentBreakdown: [],
  expenseBreakdown: [],
  recentMovements: [],
  dailyRows: [],
}

const presetOptions: {
  key: DatePreset
  label: string
}[] = [
  {
    key: "today",
    label: "Hoje",
  },
  {
    key: "7d",
    label: "7 dias",
  },
  {
    key: "month",
    label: "Este mês",
  },
  {
    key: "lastMonth",
    label: "Mês passado",
  },
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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0")

  const day = String(
    date.getDate()
  ).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function parseLocalDate(
  value: string,
  endOfDay = false
) {
  const [year, month, day] = value
    .split("-")
    .map(Number)

  const date = new Date(
    year,
    month - 1,
    day
  )

  if (endOfDay) {
    date.setHours(23, 59, 59, 999)
  } else {
    date.setHours(0, 0, 0, 0)
  }

  return date
}

function getDefaultRange(): DateRange {
  const today = new Date()

  const firstDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    1
  )

  return {
    start: getLocalDateString(firstDay),
    end: getLocalDateString(today),
  }
}

function getPresetRange(
  preset: DatePreset
): DateRange {
  const today = new Date()

  if (preset === "today") {
    const value =
      getLocalDateString(today)

    return {
      start: value,
      end: value,
    }
  }

  if (preset === "7d") {
    const start = new Date(today)

    start.setDate(
      start.getDate() - 6
    )

    return {
      start: getLocalDateString(start),
      end: getLocalDateString(today),
    }
  }

  if (preset === "lastMonth") {
    const firstDay = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1
    )

    const lastDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      0
    )

    return {
      start: getLocalDateString(firstDay),
      end: getLocalDateString(lastDay),
    }
  }

  const firstDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    1
  )

  return {
    start: getLocalDateString(firstDay),
    end: getLocalDateString(today),
  }
}

function getRangeDays(range: DateRange) {
  const start = parseLocalDate(
    range.start
  )

  const end = parseLocalDate(
    range.end
  )

  const days: Date[] = []
  const cursor = new Date(start)

  while (cursor <= end) {
    days.push(new Date(cursor))

    cursor.setDate(
      cursor.getDate() + 1
    )
  }

  return days
}

function getRangeDescription(
  range: DateRange
) {
  const start =
    new Intl.DateTimeFormat(
      "pt-BR"
    ).format(
      parseLocalDate(range.start)
    )

  const end =
    new Intl.DateTimeFormat(
      "pt-BR"
    ).format(
      parseLocalDate(range.end)
    )

  if (range.start === range.end) {
    return start
  }

  return `${start} até ${end}`
}

function isCancelledStatus(
  statusValue: string | null
) {
  const status = String(
    statusValue || ""
  ).toLowerCase()

  return [
    "cancelled",
    "canceled",
    "cancelado",
    "recusado",
    "refused",
    "void",
  ].includes(status)
}

function isValidOrderForFinance(
  order: OrderRow
) {
  const paymentMethod = String(
    order.payment_method || ""
  ).toLowerCase()

  const paymentStatus = String(
    order.payment_status || ""
  ).toLowerCase()

  if (
    isCancelledStatus(order.status)
  ) {
    return false
  }

  if (
    [
      "pix",
      "pix_manual",
      "manual_pix",
      "pix_direto",
      "pix_direct",
    ].includes(paymentMethod)
  ) {
    return [
      "paid",
      "received",
      "confirmed",
    ].includes(paymentStatus)
  }

  return true
}

function getPaymentLabel(
  paymentMethod: string | null
): PaymentLabel | null {
  const method = String(
    paymentMethod || ""
  )
    .trim()
    .toLowerCase()

  if (
    [
      "pix",
      "pix_manual",
      "manual_pix",
      "pix_direto",
      "pix_direct",
    ].includes(method)
  ) {
    return "Pix"
  }

  if (
    [
      "cash",
      "dinheiro",
    ].includes(method)
  ) {
    return "Dinheiro"
  }

  if (
    [
      "credit",
      "credit_card",
      "credito",
      "crédito",
      "card_credit",
      "cartao_credito",
      "cartão_crédito",
    ].includes(method)
  ) {
    return "Crédito"
  }

  if (
    [
      "debit",
      "debit_card",
      "debito",
      "débito",
      "card_debit",
      "cartao_debito",
      "cartão_débito",
    ].includes(method)
  ) {
    return "Débito"
  }

  return null
}

function isCashClosingTransaction(
  transaction: FinancialTransaction
) {
  const origin = String(
    transaction.origin || ""
  ).toLowerCase()

  const category = String(
    transaction.category || ""
  ).toLowerCase()

  const title = String(
    transaction.title || ""
  ).toLowerCase()

  return (
    origin === "cash_closing" ||
    category === "fechamento diário" ||
    title.startsWith(
      "fechamento de caixa"
    )
  )
}

function normalizeOrderItem(
  raw: RawOrderItem
) {
  const productId =
    typeof raw.product_id === "string"
      ? raw.product_id
      : typeof raw.menu_item_id ===
          "string"
        ? raw.menu_item_id
        : null

  const quantity = Number(
    raw.quantity || raw.qty || 1
  )

  const name =
    String(
      raw.product_name ||
        raw.menu_item_name ||
        raw.item_name ||
        raw.name ||
        "Produto sem nome"
    ) || "Produto sem nome"

  const unitPrice = Number(
    raw.unit_price ||
      raw.price ||
      0
  )

  const total = Number(
    raw.total_price ||
      raw.subtotal ||
      raw.total ||
      raw.line_total ||
      unitPrice * quantity ||
      0
  )

  return {
    orderId: String(
      raw.order_id || ""
    ),
    productId,
    name,
    quantity,
    total,
  }
}

function calculateMargin(
  revenue: number,
  profit: number
) {
  if (revenue <= 0) {
    return 0
  }

  return (
    (profit / revenue) * 100
  )
}

function calculateCmv(
  revenue: number,
  cost: number
) {
  if (revenue <= 0) {
    return 0
  }

  return (
    (cost / revenue) * 100
  )
}

function getRecordNumber(
  record: GenericFinanceRow,
  keys: string[]
) {
  for (const key of keys) {
    const value = record[key]

    if (
      typeof value === "number"
    ) {
      return value
    }

    if (
      typeof value === "string" &&
      value.trim() !== ""
    ) {
      const cleaned = value
        .replace(
          /[^0-9,.-]/g,
          ""
        )
        .trim()

      const normalized =
        cleaned.includes(",")
          ? cleaned
              .replace(/\./g, "")
              .replace(",", ".")
          : cleaned

      const parsed =
        Number(normalized)

      if (
        Number.isFinite(parsed)
      ) {
        return parsed
      }
    }
  }

  return 0
}

function getRecordString(
  record: GenericFinanceRow,
  keys: string[],
  fallback = ""
) {
  for (const key of keys) {
    const value = record[key]

    if (
      typeof value === "string" &&
      value.trim() !== ""
    ) {
      return value
    }

    if (
      typeof value === "number"
    ) {
      return String(value)
    }
  }

  return fallback
}

function getRecordDate(
  record: GenericFinanceRow,
  keys: string[]
) {
  for (const key of keys) {
    const value = record[key]

    if (
      typeof value === "string" &&
      value.trim() !== ""
    ) {
      return value
    }
  }

  return new Date().toISOString()
}

function isDateInsideRange(
  value: string,
  range: DateRange
) {
  const date = new Date(value)

  const start = parseLocalDate(
    range.start
  )

  const end = parseLocalDate(
    range.end,
    true
  )

  if (
    Number.isNaN(date.getTime())
  ) {
    return false
  }

  return (
    date >= start &&
    date <= end
  )
}

function isCancelledRecord(
  record: GenericFinanceRow
) {
  const status = getRecordString(
    record,
    [
      "status",
      "payment_status",
      "state",
    ]
  ).toLowerCase()

  return [
    "cancelled",
    "canceled",
    "cancelado",
    "recusado",
    "void",
  ].includes(status)
}

function classifyExpense(
  record: GenericFinanceRow,
  fallback = "Contas a pagar"
) {
  const text = [
    getRecordString(record, [
      "category",
      "type",
      "expense_type",
    ]),
    getRecordString(record, [
      "title",
      "description",
      "notes",
      "supplier_name",
      "employee_name",
    ]),
    getRecordString(record, [
      "origin",
      "source",
    ]),
  ]
    .join(" ")
    .toLowerCase()

  if (
    text.includes("folha") ||
    text.includes("funcion") ||
    text.includes("sal") ||
    text.includes("fixo")
  ) {
    return "Folha e equipe"
  }

  if (
    text.includes("fornecedor") ||
    text.includes("compra") ||
    text.includes("supplier")
  ) {
    return "Fornecedores"
  }

  if (
    text.includes("entregador") ||
    text.includes("motoboy") ||
    text.includes("delivery")
  ) {
    return "Entregadores"
  }

  return fallback
}

function addBreakdown(
  map: Map<
    string,
    ExpenseBreakdown
  >,
  label: string,
  total: number,
  count = 1
) {
  if (total <= 0) {
    return
  }

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

function getMonthlyPayroll(
  staffRows: GenericFinanceRow[]
) {
  return staffRows
    .filter((staff) => {
      const status =
        getRecordString(
          staff,
          [
            "status",
            "active_status",
          ]
        ).toLowerCase()

      const kind =
        getRecordString(
          staff,
          [
            "employment_type",
            "contract_type",
            "type",
            "role_type",
          ]
        ).toLowerCase()

      const isInactive = [
        "inactive",
        "inativo",
        "desativado",
        "demitido",
      ].includes(status)

      const isFreelancer =
        kind.includes("freela") ||
        kind.includes("diaria") ||
        kind.includes("daily")

      return (
        !isInactive &&
        !isFreelancer
      )
    })
    .reduce(
      (sum, staff) =>
        sum +
        getRecordNumber(
          staff,
          [
            "monthly_salary",
            "salary",
            "base_salary",
            "fixed_salary",
            "salary_amount",
            "amount",
          ]
        ),
      0
    )
}

function buildDailyPayrollMap(
  staffRows: GenericFinanceRow[],
  range: DateRange,
  ignorePayroll: boolean
) {
  const payrollByDate =
    new Map<string, number>()

  if (ignorePayroll) {
    return payrollByDate
  }

  const monthlyPayroll =
    getMonthlyPayroll(staffRows)

  if (monthlyPayroll <= 0) {
    return payrollByDate
  }

  for (
    const day of getRangeDays(range)
  ) {
    const daysInMonth =
      new Date(
        day.getFullYear(),
        day.getMonth() + 1,
        0
      ).getDate()

    payrollByDate.set(
      getLocalDateString(day),
      monthlyPayroll /
        daysInMonth
    )
  }

  return payrollByDate
}

function buildDailyRows({
  range,
  orders,
  transactions,
  productLosses,
  accountsPayable,
  deliverySettlements,
  productCostByDate,
  payrollByDate,
}: {
  range: DateRange
  orders: OrderRow[]
  transactions: FinancialTransaction[]
  productLosses: ProductLoss[]
  accountsPayable: GenericFinanceRow[]
  deliverySettlements: GenericFinanceRow[]
  productCostByDate: Map<
    string,
    number
  >
  payrollByDate: Map<
    string,
    number
  >
}) {
  const rows = new Map<
    string,
    DailyFinancialRow
  >()

  for (
    const day of getRangeDays(range)
  ) {
    const date =
      getLocalDateString(day)

    rows.set(date, {
      date,
      label:
        new Intl.DateTimeFormat(
          "pt-BR",
          {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }
        ).format(day),
      income: 0,
      salesRevenue: 0,
      expense: 0,
      result: 0,
      orders: 0,
    })
  }

  const addIncome = (
    dateValue: string,
    amount: number,
    isOrder = false
  ) => {
    const date =
      getLocalDateString(
        new Date(dateValue)
      )

    const row = rows.get(date)

    if (!row) {
      return
    }

    row.income += amount

    if (isOrder) {
      row.salesRevenue += amount
      row.orders += 1
    }
  }

  const addExpense = (
    dateValue: string,
    amount: number
  ) => {
    const date =
      getLocalDateString(
        new Date(dateValue)
      )

    const row = rows.get(date)

    if (!row) {
      return
    }

    row.expense += amount
  }

  for (const order of orders) {
    addIncome(
      order.created_at,
      Number(order.total || 0),
      true
    )
  }

  for (
    const transaction of transactions
  ) {
    if (
      isCashClosingTransaction(
        transaction
      )
    ) {
      continue
    }

    if (
      transaction.type === "income"
    ) {
      addIncome(
        transaction.occurred_at,
        Number(
          transaction.amount || 0
        )
      )
    } else {
      addExpense(
        transaction.occurred_at,
        Number(
          transaction.amount || 0
        )
      )
    }
  }

  for (
    const loss of productLosses
  ) {
    addExpense(
      loss.occurred_at,
      Number(loss.total_cost || 0)
    )
  }

  for (
    const payable of accountsPayable
  ) {
    addExpense(
      getRecordDate(
        payable,
        [
          "paid_at",
          "due_date",
          "created_at",
          "updated_at",
        ]
      ),
      getRecordNumber(
        payable,
        [
          "amount",
          "total_amount",
          "total",
          "value",
          "paid_amount",
        ]
      )
    )
  }

  for (
    const settlement of deliverySettlements
  ) {
    addExpense(
      getRecordDate(
        settlement,
        [
          "paid_at",
          "settled_at",
          "settlement_date",
          "created_at",
        ]
      ),
      getRecordNumber(
        settlement,
        [
          "amount",
          "total_amount",
          "total",
          "total_delivery_fee",
          "delivery_fee_total",
          "settlement_amount",
          "value",
        ]
      )
    )
  }

  for (
    const [
      date,
      amount,
    ] of productCostByDate.entries()
  ) {
    const row = rows.get(date)

    if (row) {
      row.expense += amount
    }
  }

  for (
    const [
      date,
      amount,
    ] of payrollByDate.entries()
  ) {
    const row = rows.get(date)

    if (row) {
      row.expense += amount
    }
  }

  return Array.from(
    rows.values()
  )
    .map((row) => ({
      ...row,
      result:
        row.income -
        row.expense,
    }))
    .sort((a, b) =>
      a.date.localeCompare(b.date)
    )
}

function buildChartGroups(
  rows: DailyFinancialRow[],
  range: DateRange
): ChartPoint[] {
  const orderedRows = [...rows].sort(
    (a, b) =>
      a.date.localeCompare(b.date)
  )

  const totalDays =
    getRangeDays(range).length

  if (totalDays <= 31) {
    return orderedRows
      .filter(
        (row) =>
          row.income > 0 ||
          row.expense > 0
      )
      .map((row) => ({
        key: row.date,
        label:
          new Intl.DateTimeFormat(
            "pt-BR",
            {
              day: "2-digit",
              month: "2-digit",
            }
          ).format(
            parseLocalDate(row.date)
          ),
        income: row.income,
        expense: row.expense,
        result: row.result,
        orders: row.orders,
      }))
  }

  if (totalDays <= 120) {
    const groups: ChartPoint[] = []

    for (
      let index = 0;
      index < orderedRows.length;
      index += 7
    ) {
      const chunk =
        orderedRows.slice(
          index,
          index + 7
        )

      if (chunk.length === 0) {
        continue
      }

      const income = chunk.reduce(
        (sum, row) =>
          sum + row.income,
        0
      )

      const expense = chunk.reduce(
        (sum, row) =>
          sum + row.expense,
        0
      )

      const orders = chunk.reduce(
        (sum, row) =>
          sum + row.orders,
        0
      )

      if (
        income <= 0 &&
        expense <= 0
      ) {
        continue
      }

      const firstDate =
        parseLocalDate(
          chunk[0].date
        )

      const lastDate =
        parseLocalDate(
          chunk[
            chunk.length - 1
          ].date
        )

      const firstLabel =
        new Intl.DateTimeFormat(
          "pt-BR",
          {
            day: "2-digit",
            month: "2-digit",
          }
        ).format(firstDate)

      const lastLabel =
        new Intl.DateTimeFormat(
          "pt-BR",
          {
            day: "2-digit",
            month: "2-digit",
          }
        ).format(lastDate)

      groups.push({
        key: `${chunk[0].date}-${chunk[chunk.length - 1].date}`,
        label: `${firstLabel}–${lastLabel}`,
        income,
        expense,
        result:
          income - expense,
        orders,
      })
    }

    return groups
  }

  const monthMap = new Map<
    string,
    ChartPoint
  >()

  for (const row of orderedRows) {
    const date =
      parseLocalDate(row.date)

    const key = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`

    const label =
      new Intl.DateTimeFormat(
        "pt-BR",
        {
          month: "short",
          year: "2-digit",
        }
      )
        .format(date)
        .replace(".", "")

    const current =
      monthMap.get(key) ?? {
        key,
        label,
        income: 0,
        expense: 0,
        result: 0,
        orders: 0,
      }

    current.income += row.income
    current.expense += row.expense
    current.result =
      current.income -
      current.expense

    current.orders += row.orders

    monthMap.set(key, current)
  }

  return Array.from(
    monthMap.values()
  ).filter(
    (item) =>
      item.income > 0 ||
      item.expense > 0
  )
}

function SummaryCard({
  title,
  value,
  description,
  tone = "default",
}: {
  title: string
  value: string
  description: string
  tone?:
    | "default"
    | "positive"
    | "negative"
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#070707] px-4 py-4 sm:px-5 sm:py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {title}
      </p>

      <p
        className={cn(
          "mt-3 text-2xl font-semibold tracking-tight sm:text-[28px]",
          tone === "positive" &&
            "text-emerald-400",
          tone === "negative" &&
            "text-red-400",
          tone === "default" &&
            "text-white"
        )}
      >
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-zinc-500">
        {description}
      </p>
    </div>
  )
}

function Panel({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-white/10 bg-[#050505]",
        className
      )}
    >
      <div className="border-b border-white/10 px-4 py-4 sm:px-5">
        <h2 className="text-sm font-semibold text-white">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            {description}
          </p>
        )}
      </div>

      <div>{children}</div>
    </section>
  )
}

function EmptyState({
  message,
}: {
  message: string
}) {
  return (
    <div className="px-4 py-10 text-center text-sm text-zinc-500">
      {message}
    </div>
  )
}

function BreakdownRow({
  label,
  detail,
  value,
  tone = "default",
}: {
  label: string
  detail: string
  value: string
  tone?:
    | "default"
    | "positive"
    | "negative"
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-4 py-3.5 last:border-b-0 sm:px-5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-200">
          {label}
        </p>

        <p className="mt-1 text-xs text-zinc-600">
          {detail}
        </p>
      </div>

      <p
        className={cn(
          "shrink-0 text-sm font-semibold",
          tone === "positive" &&
            "text-emerald-400",
          tone === "negative" &&
            "text-red-400",
          tone === "default" &&
            "text-white"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function FinancialChart({
  data,
  range,
}: {
  data: DailyFinancialRow[]
  range: DateRange
}) {
  const chartData = useMemo(
    () =>
      buildChartGroups(
        data,
        range
      ),
    [data, range]
  )

  const totalIncome = data.reduce(
    (sum, row) =>
      sum + row.income,
    0
  )

  const totalExpense = data.reduce(
    (sum, row) =>
      sum + row.expense,
    0
  )

  const result =
    totalIncome - totalExpense

  const maxValue = Math.max(
    ...chartData.flatMap(
      (item) => [
        item.income,
        item.expense,
      ]
    ),
    1
  )

  function getHeight(
    value: number
  ) {
    if (value <= 0) {
      return "0%"
    }

    return `${Math.max(
      (value / maxValue) * 100,
      4
    )}%`
  }

  if (chartData.length === 0) {
    return (
      <EmptyState message="Nenhuma movimentação financeira encontrada no período." />
    )
  }

  return (
    <div className="p-4 sm:p-5">
      <div className="mb-5 flex flex-wrap items-center gap-5 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
          Entradas
        </div>

        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-400" />
          Saídas
        </div>
      </div>

      <div
        className="overflow-x-auto pb-2
        [&::-webkit-scrollbar]:h-1.5
        [&::-webkit-scrollbar-track]:bg-transparent
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-white/10"
      >
        <div className="flex min-w-max items-end gap-3 px-1 pt-14">
          {chartData.map((item) => (
            <div
              key={item.key}
              className="group relative w-[62px] shrink-0"
            >
              <div className="pointer-events-none absolute left-1/2 top-0 z-20 hidden w-44 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-[#111111] p-3 shadow-2xl group-hover:block">
                <p className="text-xs font-semibold text-white">
                  {item.label}
                </p>

                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-zinc-500">
                      Entradas
                    </span>

                    <span className="font-semibold text-emerald-400">
                      {formatCurrency(
                        item.income
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-zinc-500">
                      Saídas
                    </span>

                    <span className="font-semibold text-red-400">
                      {formatCurrency(
                        item.expense
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-1.5 text-xs">
                    <span className="text-zinc-500">
                      Resultado
                    </span>

                    <span
                      className={cn(
                        "font-semibold",
                        item.result >= 0
                          ? "text-white"
                          : "text-red-400"
                      )}
                    >
                      {formatCurrency(
                        item.result
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-zinc-500">
                      Pedidos
                    </span>

                    <span className="font-semibold text-white">
                      {item.orders}
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative flex h-48 items-end justify-center gap-2 border-b border-white/10">
                <div
                  className="w-3 rounded-t-sm bg-emerald-400 transition group-hover:bg-emerald-300"
                  style={{
                    height: getHeight(
                      item.income
                    ),
                  }}
                />

                <div
                  className="w-3 rounded-t-sm bg-red-400 transition group-hover:bg-red-300"
                  style={{
                    height: getHeight(
                      item.expense
                    ),
                  }}
                />
              </div>

              <p className="mt-2 truncate text-center text-[10px] font-medium text-zinc-600">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid overflow-hidden rounded-lg border border-white/10 sm:grid-cols-3 sm:divide-x sm:divide-white/10">
        <div className="border-b border-white/10 px-4 py-3 sm:border-b-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
            Entradas
          </p>

          <p className="mt-1 text-sm font-semibold text-emerald-400">
            {formatCurrency(
              totalIncome
            )}
          </p>
        </div>

        <div className="border-b border-white/10 px-4 py-3 sm:border-b-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
            Saídas
          </p>

          <p className="mt-1 text-sm font-semibold text-red-400">
            {formatCurrency(
              totalExpense
            )}
          </p>
        </div>

        <div className="px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
            Resultado
          </p>

          <p
            className={cn(
              "mt-1 text-sm font-semibold",
              result >= 0
                ? "text-white"
                : "text-red-400"
            )}
          >
            {formatCurrency(result)}
          </p>
        </div>
      </div>
    </div>
  )
}

function PerformanceItem({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}) {
  return (
    <div className="border-b border-white/[0.07] px-4 py-4 last:border-b-0 sm:px-5">
      <p className="text-xs font-medium text-zinc-500">
        {label}
      </p>

      <p className="mt-2 text-lg font-semibold text-white">
        {value}
      </p>

      <p className="mt-1 text-xs leading-5 text-zinc-600">
        {description}
      </p>
    </div>
  )
}

export default function FinanceiroPage() {
  const supabase = useMemo(
    () => createClient(),
    []
  )

  const { toast } = useToast()

  const initialRange = useMemo(
    () => getDefaultRange(),
    []
  )

  const [startDate, setStartDate] =
    useState(initialRange.start)

  const [endDate, setEndDate] =
    useState(initialRange.end)

  const [
    appliedRange,
    setAppliedRange,
  ] = useState<DateRange>(
    initialRange
  )

  const [
    activePreset,
    setActivePreset,
  ] = useState<DatePreset | null>(
    "month"
  )

  const [
    restaurantId,
    setRestaurantId,
  ] = useState<string | null>(
    null
  )

  const [data, setData] =
    useState<DashboardData>(
      emptyDashboard
    )

  const [
    isLoading,
    setIsLoading,
  ] = useState(true)

  const resolveRestaurant =
    useCallback(async () => {
      if (restaurantId) {
        return restaurantId
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!user) {
        throw new Error(
          "Usuário não autenticado."
        )
      }

      const {
        data: restaurant,
        error: restaurantError,
      } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .single()

      if (restaurantError) {
        throw restaurantError
      }

      if (!restaurant?.id) {
        throw new Error(
          "Restaurante não encontrado."
        )
      }

      setRestaurantId(
        restaurant.id
      )

      return restaurant.id
    }, [
      restaurantId,
      supabase,
    ])

  const loadFinanceiro =
    useCallback(async () => {
      try {
        setIsLoading(true)

        const resolvedRestaurantId =
          await resolveRestaurant()

        const startIso =
          parseLocalDate(
            appliedRange.start
          ).toISOString()

        const endIso =
          parseLocalDate(
            appliedRange.end,
            true
          ).toISOString()

        const {
          data: ordersData,
          error: ordersError,
        } = await supabase
          .from("orders")
          .select(
            "id, total, created_at, status, payment_method, payment_status"
          )
          .eq(
            "restaurant_id",
            resolvedRestaurantId
          )
          .gte(
            "created_at",
            startIso
          )
          .lte(
            "created_at",
            endIso
          )
          .order("created_at", {
            ascending: true,
          })

        if (ordersError) {
          throw ordersError
        }

        const allOrders =
          (ordersData ??
            []) as OrderRow[]

        const validOrders =
          allOrders.filter(
            isValidOrderForFinance
          )

        const orderIds =
          validOrders.map(
            (order) => order.id
          )

        const {
          data: productsData,
          error: productsError,
        } = await supabase
          .from("products")
          .select(
            "id, name, price, cost_price, category_id"
          )
          .eq(
            "restaurant_id",
            resolvedRestaurantId
          )

        if (productsError) {
          throw productsError
        }

        const productRows =
          (productsData ??
            []) as ProductRow[]

        let orderItems: RawOrderItem[] =
          []

        if (orderIds.length > 0) {
          const {
            data: itemsData,
            error: itemsError,
          } = await supabase
            .from("order_items")
            .select("*")
            .in(
              "order_id",
              orderIds
            )

          if (itemsError) {
            throw itemsError
          }

          orderItems =
            (itemsData ??
              []) as RawOrderItem[]
        }

        const {
          data: transactionsData,
          error: transactionsError,
        } = await supabase
          .from(
            "financial_transactions"
          )
          .select(
            "id, type, origin, title, description, amount, category, payment_method, occurred_at"
          )
          .eq(
            "restaurant_id",
            resolvedRestaurantId
          )
          .gte(
            "occurred_at",
            startIso
          )
          .lte(
            "occurred_at",
            endIso
          )
          .order("occurred_at", {
            ascending: false,
          })

        if (transactionsError) {
          throw transactionsError
        }

        const {
          data: lossesData,
          error: lossesError,
        } = await supabase
          .from("product_losses")
          .select(
            "id, product_id, product_name, quantity, unit_cost, total_cost, reason, notes, occurred_at"
          )
          .eq(
            "restaurant_id",
            resolvedRestaurantId
          )
          .gte(
            "occurred_at",
            startIso
          )
          .lte(
            "occurred_at",
            endIso
          )
          .order("occurred_at", {
            ascending: false,
          })

        if (lossesError) {
          throw lossesError
        }

        const {
          data: accountsPayableData,
          error: accountsPayableError,
        } = await supabase
          .from(
            "accounts_payable"
          )
          .select("*")
          .eq(
            "restaurant_id",
            resolvedRestaurantId
          )

        if (accountsPayableError) {
          throw accountsPayableError
        }

        const {
          data:
            deliverySettlementsData,
          error:
            deliverySettlementsError,
        } = await supabase
          .from(
            "delivery_settlements"
          )
          .select("*")
          .eq(
            "restaurant_id",
            resolvedRestaurantId
          )

        if (
          deliverySettlementsError
        ) {
          throw deliverySettlementsError
        }

        const {
          data: staffData,
          error: staffError,
        } = await supabase
          .from("staff_members")
          .select("*")
          .eq(
            "restaurant_id",
            resolvedRestaurantId
          )

        if (staffError) {
          console.warn(
            "Não foi possível carregar a equipe para estimar a folha fixa:",
            staffError
          )
        }

        const transactions =
          (transactionsData ??
            []) as FinancialTransaction[]

        const productLosses =
          (lossesData ??
            []) as ProductLoss[]

        const allAccountsPayable =
          (accountsPayableData ??
            []) as GenericFinanceRow[]

        const allDeliverySettlements =
          (deliverySettlementsData ??
            []) as GenericFinanceRow[]

        const staffRows = staffError
          ? []
          : ((staffData ??
              []) as GenericFinanceRow[])

        const accountsPayable =
          allAccountsPayable.filter(
            (payable) => {
              const date =
                getRecordDate(
                  payable,
                  [
                    "paid_at",
                    "due_date",
                    "created_at",
                    "updated_at",
                  ]
                )

              return (
                !isCancelledRecord(
                  payable
                ) &&
                isDateInsideRange(
                  date,
                  appliedRange
                )
              )
            }
          )

        const deliverySettlements =
          allDeliverySettlements.filter(
            (settlement) => {
              const date =
                getRecordDate(
                  settlement,
                  [
                    "paid_at",
                    "settled_at",
                    "settlement_date",
                    "created_at",
                  ]
                )

              return (
                !isCancelledRecord(
                  settlement
                ) &&
                isDateInsideRange(
                  date,
                  appliedRange
                )
              )
            }
          )

        const productsById =
          new Map(
            productRows.map(
              (product) => [
                product.id,
                product,
              ]
            )
          )

        const validOrdersById =
          new Map(
            validOrders.map(
              (order) => [
                order.id,
                order,
              ]
            )
          )

        const grossRevenue =
          validOrders.reduce(
            (sum, order) =>
              sum +
              Number(
                order.total || 0
              ),
            0
          )

        const ordersCount =
          validOrders.length

        const averageTicket =
          ordersCount > 0
            ? grossRevenue /
              ordersCount
            : 0

        const manualIncome =
          transactions
            .filter(
              (transaction) =>
                transaction.type ===
                  "income" &&
                !isCashClosingTransaction(
                  transaction
                )
            )
            .reduce(
              (sum, transaction) =>
                sum +
                Number(
                  transaction.amount ||
                    0
                ),
              0
            )

        const manualExpenses =
          transactions
            .filter(
              (transaction) =>
                transaction.type ===
                  "expense" &&
                !isCashClosingTransaction(
                  transaction
                )
            )
            .reduce(
              (sum, transaction) =>
                sum +
                Number(
                  transaction.amount ||
                    0
                ),
              0
            )

        const accountsPayableExpenses =
          accountsPayable.reduce(
            (sum, payable) =>
              sum +
              getRecordNumber(
                payable,
                [
                  "amount",
                  "total_amount",
                  "total",
                  "value",
                  "paid_amount",
                ]
              ),
            0
          )

        const deliveryExpenses =
          deliverySettlements.reduce(
            (sum, settlement) =>
              sum +
              getRecordNumber(
                settlement,
                [
                  "amount",
                  "total_amount",
                  "total",
                  "total_delivery_fee",
                  "delivery_fee_total",
                  "settlement_amount",
                  "value",
                ]
              ),
            0
          )

        const hasPayrollInAccountsPayable =
          accountsPayable.some(
            (payable) =>
              classifyExpense(
                payable
              ) ===
              "Folha e equipe"
          )

        const payrollByDate =
          buildDailyPayrollMap(
            staffRows,
            appliedRange,
            hasPayrollInAccountsPayable
          )

        const fixedPayroll =
          Array.from(
            payrollByDate.values()
          ).reduce(
            (sum, amount) =>
              sum + amount,
            0
          )

        const expenses =
          manualExpenses +
          accountsPayableExpenses +
          deliveryExpenses +
          fixedPayroll

        const losses =
          productLosses.reduce(
            (sum, loss) =>
              sum +
              Number(
                loss.total_cost || 0
              ),
            0
          )

        const productCostByDate =
          new Map<
            string,
            number
          >()

        let productCost = 0
        let hasProductCost = false

        for (
          const rawItem of orderItems
        ) {
          const item =
            normalizeOrderItem(
              rawItem
            )

          const product =
            item.productId
              ? productsById.get(
                  item.productId
                )
              : null

          const unitCost = Number(
            product?.cost_price || 0
          )

          const itemCost =
            unitCost *
            item.quantity

          const order =
            validOrdersById.get(
              item.orderId
            )

          if (unitCost > 0) {
            hasProductCost = true
          }

          productCost += itemCost

          if (
            order &&
            itemCost > 0
          ) {
            const date =
              getLocalDateString(
                new Date(
                  order.created_at
                )
              )

            productCostByDate.set(
              date,
              Number(
                productCostByDate.get(
                  date
                ) || 0
              ) + itemCost
            )
          }
        }

        const paymentMap =
          new Map<
            PaymentLabel,
            PaymentBreakdown
          >()

        for (
          const order of validOrders
        ) {
          const label =
            getPaymentLabel(
              order.payment_method
            )

          if (!label) {
            continue
          }

          const total = Number(
            order.total || 0
          )

          const current =
            paymentMap.get(label) ??
            ({
              label,
              total: 0,
              count: 0,
            } satisfies PaymentBreakdown)

          current.total += total
          current.count += 1

          paymentMap.set(
            label,
            current
          )
        }

        const totalIncome =
          grossRevenue +
          manualIncome

        const totalOutflow =
          expenses +
          losses +
          productCost

        const estimatedProfit =
          totalIncome -
          totalOutflow

        const cmv =
          calculateCmv(
            grossRevenue,
            productCost
          )

        const estimatedMargin =
          calculateMargin(
            totalIncome,
            estimatedProfit
          )

        const expenseBreakdownMap =
          new Map<
            string,
            ExpenseBreakdown
          >()

        for (
          const payable of accountsPayable
        ) {
          addBreakdown(
            expenseBreakdownMap,
            classifyExpense(
              payable
            ),
            getRecordNumber(
              payable,
              [
                "amount",
                "total_amount",
                "total",
                "value",
                "paid_amount",
              ]
            )
          )
        }

        addBreakdown(
          expenseBreakdownMap,
          "Folha e equipe",
          fixedPayroll,
          payrollByDate.size
        )

        addBreakdown(
          expenseBreakdownMap,
          "Entregadores",
          deliveryExpenses,
          deliverySettlements.length
        )

        addBreakdown(
          expenseBreakdownMap,
          "Despesas manuais",
          manualExpenses,
          transactions.filter(
            (transaction) =>
              transaction.type ===
                "expense" &&
              !isCashClosingTransaction(
                transaction
              )
          ).length
        )

        addBreakdown(
          expenseBreakdownMap,
          "Perdas e desperdícios",
          losses,
          productLosses.length
        )

        addBreakdown(
          expenseBreakdownMap,
          "Custo dos produtos vendidos",
          productCost,
          orderItems.length
        )

        const orderMovements: RecentMovement[] =
          validOrders.map(
            (order) => {
              const paymentLabel =
                getPaymentLabel(
                  order.payment_method
                )

              return {
                id: `order-${order.id}`,
                type: "income",
                title: `Pedido #${order.id
                  .slice(-6)
                  .toUpperCase()}`,
                description: null,
                category: paymentLabel
                  ? `Pedido • ${paymentLabel}`
                  : "Pedido",
                amount: Number(
                  order.total || 0
                ),
                occurred_at:
                  order.created_at,
              }
            }
          )

        const transactionMovements: RecentMovement[] =
          transactions
            .filter(
              (transaction) =>
                !isCashClosingTransaction(
                  transaction
                )
            )
            .map(
              (transaction) => ({
                id: `transaction-${transaction.id}`,
                type:
                  transaction.type,
                title:
                  transaction.title,
                description:
                  transaction.description,
                category:
                  transaction.category ||
                  "Lançamento manual",
                amount: Number(
                  transaction.amount ||
                    0
                ),
                occurred_at:
                  transaction.occurred_at,
              })
            )

        const payableMovements: RecentMovement[] =
          accountsPayable.map(
            (payable, index) => ({
              id: String(
                payable.id ||
                  `payable-${index}`
              ),
              type: "expense",
              title:
                getRecordString(
                  payable,
                  [
                    "title",
                    "description",
                    "name",
                  ],
                  classifyExpense(
                    payable
                  )
                ),
              description:
                getRecordString(
                  payable,
                  [
                    "notes",
                    "supplier_name",
                  ],
                  ""
                ) || null,
              category:
                classifyExpense(
                  payable
                ),
              amount:
                getRecordNumber(
                  payable,
                  [
                    "amount",
                    "total_amount",
                    "total",
                    "value",
                    "paid_amount",
                  ]
                ),
              occurred_at:
                getRecordDate(
                  payable,
                  [
                    "paid_at",
                    "due_date",
                    "created_at",
                    "updated_at",
                  ]
                ),
            })
          )

        const deliveryMovements: RecentMovement[] =
          deliverySettlements.map(
            (
              settlement,
              index
            ) => ({
              id: String(
                settlement.id ||
                  `delivery-${index}`
              ),
              type: "expense",
              title:
                getRecordString(
                  settlement,
                  [
                    "title",
                    "description",
                    "delivery_person_name",
                  ],
                  "Acerto de entregador"
                ),
              description: null,
              category:
                "Entregadores",
              amount:
                getRecordNumber(
                  settlement,
                  [
                    "amount",
                    "total_amount",
                    "total",
                    "total_delivery_fee",
                    "delivery_fee_total",
                    "settlement_amount",
                    "value",
                  ]
                ),
              occurred_at:
                getRecordDate(
                  settlement,
                  [
                    "paid_at",
                    "settled_at",
                    "settlement_date",
                    "created_at",
                  ]
                ),
            })
          )

        const lossMovements: RecentMovement[] =
          productLosses.map(
            (loss) => ({
              id: `loss-${loss.id}`,
              type: "expense",
              title:
                loss.product_name ||
                "Perda registrada",
              description:
                loss.notes,
              category: `Perda • ${
                loss.reason ||
                "Sem motivo"
              }`,
              amount: Number(
                loss.total_cost || 0
              ),
              occurred_at:
                loss.occurred_at,
            })
          )

        const costMovements: RecentMovement[] =
          Array.from(
            productCostByDate.entries()
          ).map(
            ([date, amount]) => ({
              id: `cmv-${date}`,
              type: "expense",
              title:
                "Custo dos produtos vendidos",
              description: null,
              category: "CMV",
              amount,
              occurred_at:
                parseLocalDate(
                  date,
                  true
                ).toISOString(),
            })
          )

        const payrollMovements: RecentMovement[] =
          Array.from(
            payrollByDate.entries()
          ).map(
            ([date, amount]) => ({
              id: `payroll-${date}`,
              type: "expense",
              title:
                "Provisão diária da folha",
              description: null,
              category:
                "Folha e equipe",
              amount,
              occurred_at:
                parseLocalDate(
                  date,
                  true
                ).toISOString(),
            })
          )

        const recentMovements = [
          ...orderMovements,
          ...transactionMovements,
          ...payableMovements,
          ...deliveryMovements,
          ...lossMovements,
          ...costMovements,
          ...payrollMovements,
        ]
          .filter(
            (movement) =>
              movement.amount > 0
          )
          .sort(
            (a, b) =>
              new Date(
                b.occurred_at
              ).getTime() -
              new Date(
                a.occurred_at
              ).getTime()
          )

        const dailyRows =
          buildDailyRows({
            range: appliedRange,
            orders: validOrders,
            transactions,
            productLosses,
            accountsPayable,
            deliverySettlements,
            productCostByDate,
            payrollByDate,
          })

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
          hasProductCost,
          paymentBreakdown:
            Array.from(
              paymentMap.values()
            ).sort(
              (a, b) =>
                b.total - a.total
            ),
          expenseBreakdown:
            Array.from(
              expenseBreakdownMap.values()
            ).sort(
              (a, b) =>
                b.total - a.total
            ),
          recentMovements,
          dailyRows,
        })
      } catch (error) {
        console.error(
          "Erro ao carregar financeiro:",
          error
        )

        toast({
          title:
            "Erro ao carregar financeiro",
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
    }, [
      appliedRange,
      resolveRestaurant,
      supabase,
      toast,
    ])

  useEffect(() => {
    void loadFinanceiro()
  }, [loadFinanceiro])

  const applyRange =
    useCallback(() => {
      if (
        !startDate ||
        !endDate
      ) {
        toast({
          title:
            "Informe o período",
          description:
            "Selecione a data inicial e a data final.",
          variant: "destructive",
        })

        return
      }

      const start =
        parseLocalDate(startDate)

      const end =
        parseLocalDate(endDate)

      if (start > end) {
        toast({
          title:
            "Período inválido",
          description:
            "A data inicial não pode ser maior que a data final.",
          variant: "destructive",
        })

        return
      }

      setActivePreset(null)

      setAppliedRange({
        start: startDate,
        end: endDate,
      })
    }, [
      endDate,
      startDate,
      toast,
    ])

  const applyPreset =
    useCallback(
      (
        preset: DatePreset
      ) => {
        const range =
          getPresetRange(preset)

        setStartDate(range.start)
        setEndDate(range.end)
        setAppliedRange(range)
        setActivePreset(preset)
      },
      []
    )

  const totalIncome =
    data.grossRevenue +
    data.manualIncome

  const totalOutflow =
    data.expenses +
    data.losses +
    data.productCost

  const salesDays =
    data.dailyRows.filter(
      (row) => row.orders > 0
    )

  const activeSalesDays =
    salesDays.length

  const bestDay =
    salesDays.length > 0
      ? salesDays.reduce(
          (best, current) =>
            current.salesRevenue >
            best.salesRevenue
              ? current
              : best
        )
      : null

  const dailyAverage =
    activeSalesDays > 0
      ? data.grossRevenue /
        activeSalesDays
      : 0

  const ordersPerDay =
    activeSalesDays > 0
      ? data.ordersCount /
        activeSalesDays
      : 0

  const maxInputDate =
    getLocalDateString()

  return (
    <AdminLayout title="Finanças">
      <div className="space-y-4 pb-8 text-white">
        <section className="rounded-xl border border-white/10 bg-[#050505] p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-zinc-500">
                  Data inicial
                </span>

                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

                  <input
                    type="date"
                    value={startDate}
                    max={
                      endDate ||
                      maxInputDate
                    }
                    onChange={(
                      event
                    ) => {
                      setStartDate(
                        event.target
                          .value
                      )

                      setActivePreset(
                        null
                      )
                    }}
                    className="h-11 w-full rounded-lg border border-white/10 bg-black pl-10 pr-3 text-sm font-medium text-white outline-none [color-scheme:dark] transition focus:border-yellow-400"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-medium text-zinc-500">
                  Data final
                </span>

                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    max={maxInputDate}
                    onChange={(
                      event
                    ) => {
                      setEndDate(
                        event.target
                          .value
                      )

                      setActivePreset(
                        null
                      )
                    }}
                    className="h-11 w-full rounded-lg border border-white/10 bg-black pl-10 pr-3 text-sm font-medium text-white outline-none [color-scheme:dark] transition focus:border-yellow-400"
                  />
                </div>
              </label>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <div className="flex flex-wrap gap-2">
                {presetOptions.map(
                  (option) => (
                    <button
                      key={
                        option.key
                      }
                      type="button"
                      onClick={() =>
                        applyPreset(
                          option.key
                        )
                      }
                      className={cn(
                        "h-9 rounded-lg border px-3 text-xs font-semibold transition",
                        activePreset ===
                          option.key
                          ? "border-yellow-400 bg-yellow-400 text-black"
                          : "border-white/10 bg-black text-zinc-400 hover:border-white/20 hover:text-white"
                      )}
                    >
                      {
                        option.label
                      }
                    </button>
                  )
                )}
              </div>

              <div className="flex w-full gap-2 xl:w-auto">
                <button
                  type="button"
                  onClick={
                    applyRange
                  }
                  className="h-11 flex-1 rounded-lg bg-yellow-400 px-5 text-sm font-semibold text-black transition hover:bg-yellow-300 xl:flex-none"
                >
                  Aplicar período
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void loadFinanceiro()
                  }
                  aria-label="Atualizar dados financeiros"
                  title="Atualizar dados financeiros"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black text-zinc-400 transition hover:border-white/20 hover:text-white"
                >
                  <RefreshCcw
                    className={cn(
                      "h-4 w-4",
                      isLoading &&
                        "animate-spin"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-white/[0.07] pt-4">
            <p className="text-xs text-zinc-500">
              Período em análise:{" "}
              <span className="font-medium text-zinc-300">
                {getRangeDescription(
                  appliedRange
                )}
              </span>
            </p>
          </div>
        </section>

        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-white/10 bg-[#050505]">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando dados financeiros...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Faturamento"
                value={formatCurrency(
                  data.grossRevenue
                )}
                description={`${data.ordersCount} pedido(s) considerado(s) no período`}
              />

              <SummaryCard
                title="Entradas"
                value={formatCurrency(
                  totalIncome
                )}
                description="Pedidos válidos e lançamentos manuais"
                tone="positive"
              />

              <SummaryCard
                title="Saídas"
                value={formatCurrency(
                  totalOutflow
                )}
                description="Despesas, perdas, folha e custo dos produtos"
                tone="negative"
              />

              <SummaryCard
                title="Resultado"
                value={formatCurrency(
                  data.estimatedProfit
                )}
                description={`Margem estimada de ${data.estimatedMargin.toFixed(
                  1
                )}%`}
                tone={
                  data.estimatedProfit >=
                  0
                    ? "positive"
                    : "negative"
                }
              />
            </section>

            <section className="grid overflow-hidden rounded-xl border border-white/10 bg-[#050505] sm:grid-cols-3 sm:divide-x sm:divide-white/10">
              <div className="border-b border-white/10 px-4 py-4 sm:border-b-0 sm:px-5">
                <p className="text-xs text-zinc-500">
                  Ticket médio
                </p>

                <p className="mt-2 text-lg font-semibold text-white">
                  {formatCurrency(
                    data.averageTicket
                  )}
                </p>
              </div>

              <div className="border-b border-white/10 px-4 py-4 sm:border-b-0 sm:px-5">
                <p className="text-xs text-zinc-500">
                  Pedidos no período
                </p>

                <p className="mt-2 text-lg font-semibold text-white">
                  {data.ordersCount}
                </p>
              </div>

              <div className="px-4 py-4 sm:px-5">
                <p className="text-xs text-zinc-500">
                  CMV
                </p>

                <p className="mt-2 text-lg font-semibold text-white">
                  {data.hasProductCost
                    ? `${data.cmv.toFixed(
                        1
                      )}%`
                    : "Não configurado"}
                </p>
              </div>
            </section>

            <Panel
              title="Fluxo financeiro"
              description="Comparação entre entradas e saídas no período selecionado."
            >
              <FinancialChart
                data={
                  data.dailyRows
                }
                range={
                  appliedRange
                }
              />
            </Panel>

            <section className="grid gap-4 xl:grid-cols-2">
              <Panel
                title="Formas de pagamento"
                description="Valores recebidos em Pix, crédito, débito e dinheiro."
              >
                {data
                  .paymentBreakdown
                  .length === 0 ? (
                  <EmptyState message="Nenhuma forma de pagamento válida encontrada no período." />
                ) : (
                  data.paymentBreakdown.map(
                    (payment) => (
                      <BreakdownRow
                        key={
                          payment.label
                        }
                        label={
                          payment.label
                        }
                        detail={`${payment.count} pedido(s)`}
                        value={formatCurrency(
                          payment.total
                        )}
                        tone="positive"
                      />
                    )
                  )
                )}
              </Panel>

              <Panel
                title="Saídas por categoria"
                description="Origem das despesas consideradas no resultado."
              >
                {data
                  .expenseBreakdown
                  .length === 0 ? (
                  <EmptyState message="Nenhuma saída encontrada no período." />
                ) : (
                  data.expenseBreakdown.map(
                    (expense) => (
                      <BreakdownRow
                        key={
                          expense.label
                        }
                        label={
                          expense.label
                        }
                        detail={`${expense.count} lançamento(s)`}
                        value={formatCurrency(
                          expense.total
                        )}
                        tone="negative"
                      />
                    )
                  )
                )}
              </Panel>
            </section>

            <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <Panel
                title="Desempenho do período"
                description="Indicadores rápidos sobre as vendas selecionadas."
              >
                <PerformanceItem
                  label="Melhor dia"
                  value={
                    bestDay
                      ? `${bestDay.label} • ${formatCurrency(
                          bestDay.salesRevenue
                        )}`
                      : "Sem vendas"
                  }
                  description="Dia com o maior faturamento em pedidos"
                />

                <PerformanceItem
                  label="Média diária"
                  value={formatCurrency(
                    dailyAverage
                  )}
                  description="Média de faturamento nos dias com vendas"
                />

                <PerformanceItem
                  label="Pedidos por dia"
                  value={ordersPerDay.toLocaleString(
                    "pt-BR",
                    {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }
                  )}
                  description="Média de pedidos nos dias em que houve vendas"
                />

                <PerformanceItem
                  label="Dias com vendas"
                  value={String(
                    activeSalesDays
                  )}
                  description="Quantidade de dias que registraram pedidos"
                />
              </Panel>

              <Panel
                title="Últimos lançamentos"
                description="Movimentações mais recentes dentro do período."
              >
                {data
                  .recentMovements
                  .length === 0 ? (
                  <EmptyState message="Nenhum lançamento encontrado no período." />
                ) : (
                  data.recentMovements
                    .slice(0, 10)
                    .map(
                      (movement) => (
                        <div
                          key={
                            movement.id
                          }
                          className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-4 py-3.5 last:border-b-0 sm:px-5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-200">
                              {
                                movement.title
                              }
                            </p>

                            <p className="mt-1 truncate text-xs text-zinc-600">
                              {
                                movement.category
                              }{" "}
                              •{" "}
                              {formatDateTime(
                                movement.occurred_at
                              )}
                            </p>
                          </div>

                          <p
                            className={cn(
                              "shrink-0 text-sm font-semibold",
                              movement.type ===
                                "income"
                                ? "text-emerald-400"
                                : "text-red-400"
                            )}
                          >
                            {movement.type ===
                            "income"
                              ? "+"
                              : "-"}{" "}
                            {formatCurrency(
                              movement.amount
                            )}
                          </p>
                        </div>
                      )
                    )
                )}
              </Panel>
            </section>

            {!data.hasProductCost &&
              data.ordersCount > 0 && (
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] px-4 py-3 text-sm text-yellow-100/80">
                  O CMV ainda não pode
                  ser calculado com
                  precisão porque os
                  produtos vendidos não
                  possuem custo
                  cadastrado.
                </div>
              )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}