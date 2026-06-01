"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CreditCard,
  DollarSign,
  FileText,
  Loader2,
  Package,
  RefreshCcw,
  ShoppingBag,
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

function MetricBox({
  title,
  value,
  helper,
  tone = "neutral",
}: {
  title: string
  value: string
  helper?: string
  tone?: "neutral" | "success" | "warning" | "danger" | "purple"
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <strong
        className={cn(
          "mt-1 block text-xl font-semibold",
          tone === "success" && "text-emerald-600",
          tone === "warning" && "text-orange-600",
          tone === "danger" && "text-red-600",
          tone === "purple" && "text-violet-700",
          tone === "neutral" && "text-slate-950",
        )}
      >
        {value}
      </strong>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  )
}

function SectionCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string
  subtitle?: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 text-violet-700">{icon}</div>
          <div>
            <h2 className="font-semibold text-slate-950">{title}</h2>
            {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      {children}
    </section>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
      {text}
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
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{item.label}</p>
              {item.helper ? <p className="text-xs text-slate-500">{item.helper}</p> : null}
            </div>
            <strong className="shrink-0 text-slate-950">{valueFormatter(item.value)}</strong>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
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
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2.5 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-slate-50">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2.5 align-middle text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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

  const costShare = useMemo(() => {
    const totalCosts = fixedPayroll + freelancerCost + supplierCost + deliveryCost + otherCosts
    return percentage(totalCosts, totals.revenue)
  }, [deliveryCost, fixedPayroll, freelancerCost, otherCosts, supplierCost, totals.revenue])

  const revenueByDay = useMemo(() => {
    const grouped = paidOrders.reduce<Record<string, { total: number; orders: number }>>((acc, order) => {
      const date = order.created_at.slice(0, 10)
      acc[date] = acc[date] || { total: 0, orders: 0 }
      acc[date].total += order.total
      acc[date].orders += 1
      return acc
    }, {})

    return Object.entries(grouped)
      .map(([date, data]) => ({ label: formatDate(date), value: data.total, helper: `${data.orders} pedidos pagos` }))
      .sort((a, b) => a.label.localeCompare(b.label))
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
        helper: `${data.quantity} vendidos`,
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
        helper: `${data.orders} pedidos`,
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
        helper: `${data.orders} pedidos`,
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
        helper: `${data.count} registros`,
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
        helper: `${data.count} acertos`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [deliverySettlements])

  const closingsSummary = useMemo(() => {
    const revenue = closings.reduce((acc, closing) => acc + closing.gross_revenue, 0)
    const expensesTotal = closings.reduce((acc, closing) => acc + closing.expenses, 0)
    const result = closings.reduce((acc, closing) => acc + closing.estimated_profit, 0)
    const ordersCount = closings.reduce((acc, closing) => acc + toNumber(closing.orders_count), 0)

    return {
      revenue,
      expensesTotal,
      result,
      ordersCount,
      count: closings.length,
    }
  }, [closings])

  const alerts = useMemo(() => {
    const messages: { title: string; description: string; tone: "danger" | "warning" | "success" | "neutral" }[] = []

    if (totals.revenue <= 0) {
      messages.push({
        title: "Sem receita recebida no período",
        description: "O relatório ainda não tem vendas pagas para analisar. Confira se os pedidos foram marcados como pagos.",
        tone: "warning",
      })
    }

    if (operationalResult < 0) {
      messages.push({
        title: "Resultado operacional negativo",
        description: `As saídas principais passaram da receita em ${formatCurrency(Math.abs(operationalResult))}. O primeiro ponto é revisar folha, fornecedores e despesas fixas.`,
        tone: "danger",
      })
    }

    if (totals.pendingRevenue > totals.revenue * 0.35 && totals.pendingRevenue > 0) {
      messages.push({
        title: "Muito dinheiro pendente",
        description: `Existem ${formatCurrency(totals.pendingRevenue)} a receber. Isso pode distorcer o caixa do mês.`,
        tone: "warning",
      })
    }

    if (costShare > 70) {
      messages.push({
        title: "Custos altos para a receita atual",
        description: `Os custos principais equivalem a ${formatPercent(costShare)} da receita recebida. O ideal é investigar fornecedores, folha e taxas.`,
        tone: "warning",
      })
    }

    if (topProducts.length === 0 && totals.revenue > 0) {
      messages.push({
        title: "Produtos não encontrados no relatório",
        description: "Existe receita, mas não foi possível montar o ranking de itens. Pode ser falta de vínculo com order_items.",
        tone: "neutral",
      })
    }

    if (messages.length === 0) {
      messages.push({
        title: "Período saudável",
        description: "Não encontrei nenhum alerta forte nesse intervalo. Continue acompanhando ticket médio, produtos mais vendidos e custos fixos.",
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
              const total = toNumber(getFirstValue(item, ["total_price", "total", "subtotal", "amount_total"])) || unitPrice * quantity

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

  const costRows = costsByGroup.map((item) => [
    <span key={`${item.label}-name`} className="font-medium text-slate-900">
      {item.label}
    </span>,
    <span key={`${item.label}-paid`} className="font-semibold text-red-600">
      {formatCurrency(item.paid)}
    </span>,
    <span key={`${item.label}-pending`} className="font-semibold text-orange-600">
      {formatCurrency(item.pending)}
    </span>,
    <span key={`${item.label}-total`} className="font-semibold text-slate-950">
      {formatCurrency(item.total)}
    </span>,
  ])

  const closingRows = closings.slice(0, 8).map((closing) => [
    <span key={`${closing.id}-date`} className="font-medium text-slate-900">
      {formatDate(closing.closing_date)}
    </span>,
    <span key={`${closing.id}-orders`}>{closing.orders_count}</span>,
    <span key={`${closing.id}-revenue`} className="font-semibold text-emerald-600">
      {formatCurrency(closing.gross_revenue)}
    </span>,
    <span key={`${closing.id}-expense`} className="font-semibold text-red-600">
      {formatCurrency(closing.expenses)}
    </span>,
    <span
      key={`${closing.id}-result`}
      className={cn("font-semibold", closing.estimated_profit >= 0 ? "text-violet-700" : "text-red-600")}
    >
      {formatCurrency(closing.estimated_profit)}
    </span>,
  ])

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <FileText className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-xl font-semibold text-slate-950">Relatório 360</h1>
              <p className="text-sm text-slate-500">
                Ganhos, custos, folha, entregadores, fornecedores, produtos e canais de venda.
              </p>
            </div>
          </div>

          <Button type="button" variant="outline" onClick={loadData} disabled={loading} className="gap-2">
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_150px_150px_auto] lg:items-end">
            <div>
              <h2 className="font-semibold text-slate-950">Período analisado</h2>
              <p className="text-sm text-slate-500">
                O relatório recalcula tudo com base nas datas selecionadas.
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

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
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
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando relatório 360...
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricBox
                title="Ganhos recebidos"
                value={formatCurrency(totals.revenue)}
                helper={`${totals.paidOrdersCount} pedidos pagos`}
                tone="success"
              />
              <MetricBox
                title="Resultado operacional"
                value={formatCurrency(operationalResult)}
                helper="Receita menos folha, fornecedores, entregadores e outras despesas"
                tone={operationalResult >= 0 ? "purple" : "danger"}
              />
              <MetricBox
                title="A receber"
                value={formatCurrency(totals.pendingRevenue)}
                helper={`${totals.pendingOrdersCount} pedidos pendentes`}
                tone="warning"
              />
              <MetricBox
                title="Ticket médio"
                value={formatCurrency(totals.averageTicket)}
                helper="Média dos pedidos pagos"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <MetricBox title="Folha fixa" value={formatCurrency(fixedPayroll)} helper="Funcionários fixos" tone="danger" />
              <MetricBox title="Freelancers" value={formatCurrency(freelancerCost)} helper="Diárias e avulsos" tone="danger" />
              <MetricBox title="Fornecedores" value={formatCurrency(supplierCost)} helper="Compras e insumos" tone="danger" />
              <MetricBox title="Entregadores" value={formatCurrency(deliveryCost)} helper="Taxas/acertos do período" tone="warning" />
              <MetricBox title="Custos / Receita" value={formatPercent(costShare)} helper="Peso dos custos principais" tone={costShare > 70 ? "danger" : "neutral"} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <SectionCard
                title="Leitura rápida do período"
                subtitle="Resumo simples para o dono entender o mês sem olhar pedido por pedido."
                icon={<BarChart3 className="h-4 w-4" />}
              >
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Entrou</p>
                    <strong className="mt-1 block text-xl text-emerald-700">{formatCurrency(totals.revenue)}</strong>
                    <p className="mt-1 text-xs text-emerald-700">{totals.paidOrdersCount} pedidos pagos</p>
                  </div>

                  <div className="rounded-xl bg-red-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-red-700">Saiu / Custos</p>
                    <strong className="mt-1 block text-xl text-red-700">
                      {formatCurrency(fixedPayroll + freelancerCost + supplierCost + deliveryCost + otherCosts)}
                    </strong>
                    <p className="mt-1 text-xs text-red-700">Folha, fornecedores, entregadores e outros</p>
                  </div>

                  <div className="rounded-xl bg-violet-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Sobrou estimado</p>
                    <strong
                      className={cn(
                        "mt-1 block text-xl",
                        operationalResult >= 0 ? "text-violet-700" : "text-red-700",
                      )}
                    >
                      {formatCurrency(operationalResult)}
                    </strong>
                    <p className="mt-1 text-xs text-violet-700">Resultado operacional do período</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {alerts.map((alert) => (
                    <div
                      key={alert.title}
                      className={cn(
                        "rounded-xl border p-3",
                        alert.tone === "danger" && "border-red-100 bg-red-50 text-red-900",
                        alert.tone === "warning" && "border-orange-100 bg-orange-50 text-orange-900",
                        alert.tone === "success" && "border-emerald-100 bg-emerald-50 text-emerald-900",
                        alert.tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-800",
                      )}
                    >
                      <div className="flex gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-semibold">{alert.title}</p>
                          <p className="mt-0.5 text-sm opacity-90">{alert.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Ganhos por dia"
                subtitle="Mostra em quais dias o caixa realmente entrou."
                icon={<CalendarDays className="h-4 w-4" />}
              >
                <RankingRows
                  items={revenueByDay.slice(-10)}
                  emptyText="Nenhuma venda paga no período."
                  barTone="bg-emerald-500"
                />
              </SectionCard>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard
                title="Custos do mês por área"
                subtitle="Aqui o dono entende para onde o dinheiro está indo."
                icon={<Wallet className="h-4 w-4" />}
              >
                <CompactTable
                  headers={["Área", "Pago", "Pendente", "Total"]}
                  rows={costRows}
                  emptyText="Nenhum custo encontrado no período."
                />
              </SectionCard>

              <SectionCard
                title="Fechamentos de caixa"
                subtitle="Conferência rápida dos dias fechados no período."
                icon={<DollarSign className="h-4 w-4" />}
              >
                <div className="mb-3 grid gap-2 md:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-2">
                    <p className="text-xs text-slate-500">Fechamentos</p>
                    <strong className="text-slate-950">{closingsSummary.count}</strong>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2">
                    <p className="text-xs text-slate-500">Pedidos</p>
                    <strong className="text-slate-950">{closingsSummary.ordersCount}</strong>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2">
                    <p className="text-xs text-slate-500">Receita</p>
                    <strong className="text-emerald-600">{formatCurrency(closingsSummary.revenue)}</strong>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2">
                    <p className="text-xs text-slate-500">Saldo</p>
                    <strong className={closingsSummary.result >= 0 ? "text-violet-700" : "text-red-600"}>
                      {formatCurrency(closingsSummary.result)}
                    </strong>
                  </div>
                </div>

                <CompactTable
                  headers={["Data", "Pedidos", "Receita", "Despesas", "Saldo"]}
                  rows={closingRows}
                  emptyText="Nenhum fechamento de caixa encontrado."
                />
              </SectionCard>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <SectionCard
                title="Itens que mais vendem"
                subtitle="Ranking por faturamento dos produtos vendidos."
                icon={<Package className="h-4 w-4" />}
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
                icon={<ShoppingBag className="h-4 w-4" />}
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
                icon={<CreditCard className="h-4 w-4" />}
              >
                <RankingRows
                  items={paymentMethods}
                  emptyText="Nenhum pagamento recebido no período."
                  barTone="bg-slate-700"
                />
              </SectionCard>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard
                title="Fornecedores"
                subtitle="Mostra onde o restaurante mais gastou em compras e insumos."
                icon={<Package className="h-4 w-4" />}
              >
                <RankingRows
                  items={suppliersRanking}
                  emptyText="Nenhum gasto com fornecedor encontrado no período."
                  barTone="bg-red-500"
                />
              </SectionCard>

              <SectionCard
                title="Entregadores"
                subtitle="Acompanha taxas/acertos de entrega do período."
                icon={<Truck className="h-4 w-4" />}
              >
                {deliveryRanking.length > 0 ? (
                  <RankingRows
                    items={deliveryRanking}
                    emptyText="Nenhum acerto de entregador encontrado."
                    barTone="bg-orange-500"
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-orange-50 p-3">
                      <p className="text-sm font-medium text-orange-900">Taxas de entrega nos pedidos pagos</p>
                      <strong className="mt-1 block text-2xl text-orange-700">{formatCurrency(totals.deliveryFees)}</strong>
                      <p className="mt-1 text-xs text-orange-800">
                        Esse valor vem dos pedidos. Quando houver acerto por entregador, o ranking aparece aqui.
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-sm font-medium text-slate-900">Taxas em todos os pedidos do período</p>
                      <strong className="mt-1 block text-xl text-slate-950">{formatCurrency(totals.deliveryFeesAllOrders)}</strong>
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>

            <SectionCard
              title="Resumo final para decisão"
              subtitle="O objetivo dessa aba é mostrar se a operação está funcionando, não listar histórico de pedido."
              icon={<Users className="h-4 w-4" />}
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-900">O que entrou</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Receita recebida de {formatCurrency(totals.revenue)} com ticket médio de {formatCurrency(totals.averageTicket)}.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-900">O que mais pesa</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Maior custo: {costsByGroup.sort((a, b) => b.total - a.total)[0]?.label || "sem custo"}.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-900">Melhor venda</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Principal item/canal: {topProducts[0]?.label || salesChannels[0]?.label || "sem dados suficientes"}.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-900">Ponto de atenção</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {operationalResult < 0
                      ? "Reduzir custos ou aumentar ticket médio antes de escalar campanhas."
                      : "Manter acompanhamento de produtos, canais e custos fixos semanalmente."}
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
