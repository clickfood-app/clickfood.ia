"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowDownCircle,
  BarChart3,
  Bike,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  PackageX,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShoppingCart,
  Trash2,
  Users,
  WalletCards,
  X,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type ExpenseStatus = "pending" | "paid" | "cancelled"
type StatusFilter = "all" | ExpenseStatus

type ExpenseOrigin = "manual" | "purchase" | "staff" | "delivery" | "loss"
type OriginFilter = "all" | ExpenseOrigin

type AccountPayable = {
  id: string
  restaurant_id: string
  supplier_id: string | null
  purchase_id: string | null
  description: string
  category: string | null
  amount: number
  due_date: string
  paid_at: string | null
  payment_method: string | null
  payment_reference: string | null
  status: ExpenseStatus | string
  notes: string | null
  created_at: string
  updated_at: string
}

type Expense360 = {
  id: string
  sourceId: string
  sourceTable:
    | "accounts_payable"
    | "supplier_purchases"
    | "staff_payments"
    | "delivery_settlements"
    | "product_losses"
  origin: ExpenseOrigin
  originLabel: string
  description: string
  category: string
  amount: number
  date: string
  dueDate: string | null
  paidAt: string | null
  paymentMethod: string | null
  paymentReference: string | null
  status: ExpenseStatus
  notes: string | null
  canEdit: boolean
  canPay: boolean
  raw: any
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  cancelled: "Cancelado",
}

const statusStyles: Record<string, string> = {
  pending: "bg-orange-100 text-orange-700 ring-orange-200",
  paid: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
}

const originLabels: Record<ExpenseOrigin, string> = {
  manual: "Manual",
  purchase: "Compras",
  staff: "Funcionários",
  delivery: "Entregadores",
  loss: "Perdas/consumo",
}

const originStyles: Record<ExpenseOrigin, string> = {
  manual: "bg-blue-50 text-blue-700 ring-blue-100",
  purchase: "bg-violet-50 text-violet-700 ring-violet-100",
  staff: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  delivery: "bg-orange-50 text-orange-700 ring-orange-100",
  loss: "bg-red-50 text-red-700 ring-red-100",
}

const manualCategoryOptions = [
  "Aluguel",
  "Água",
  "Energia",
  "Internet",
  "Impostos",
  "Contador",
  "Manutenção",
  "Marketing",
  "Consumo próprio",
  "Doação",
  "Brinde/cortesia",
  "Taxas",
  "Outros",
]

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function currentMonthStart() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")

  return `${year}-${month}-01`
}

function currentMonthEnd() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const lastDay = new Date(year, month, 0).getDate()

  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(
    2,
    "0",
  )}`
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sem data"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = toNumber(value)
    if (parsed > 0) return parsed
  }

  return 0
}

function pickText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }

  return ""
}

function pickDate(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.slice(0, 10)
  }

  return ""
}

function pickDateTime(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value
  }

  return null
}

function normalizeStatus(value: unknown): ExpenseStatus {
  const status = String(value || "").toLowerCase()

  if (
    ["paid", "pago", "settled", "liquidado", "confirmed", "confirmado"].includes(
      status,
    )
  ) {
    return "paid"
  }

  if (
    ["cancelled", "canceled", "cancelado", "cancelada"].includes(status)
  ) {
    return "cancelled"
  }

  return "pending"
}

function normalizePurchaseStatus(row: any): ExpenseStatus {
  const paymentStatus = pickText(
    row.payment_status,
    row.paymentStatus,
    row.paid_status,
  )
  const status = pickText(row.status)

  if (paymentStatus) return normalizeStatus(paymentStatus)
  if (pickDateTime(row.paid_at, row.payment_date)) return "paid"
  if (
    ["cancelled", "canceled", "cancelado", "cancelada"].includes(
      status.toLowerCase(),
    )
  ) {
    return "cancelled"
  }

  return "pending"
}

function isExpenseOverdue(expense: Expense360) {
  return (
    expense.status === "pending" &&
    Boolean(expense.dueDate) &&
    String(expense.dueDate) < todayDate()
  )
}

function isDateInRange(date: string, startDate: string, endDate: string) {
  if (!date) return false
  return date >= startDate && date <= endDate
}

function mapAccountPayable(row: any): Expense360 | null {
  const status = normalizeStatus(row.status)
  const dueDate = pickDate(row.due_date, row.dueDate, row.created_at)
  const paidAt = pickDateTime(row.paid_at, row.payment_date)
  const date = status === "paid" ? pickDate(paidAt, dueDate) : dueDate
  const amount = pickNumber(row.amount, row.value, row.total, row.total_amount)

  if (!row.id || amount <= 0) return null

  return {
    id: `accounts_payable:${row.id}`,
    sourceId: row.id,
    sourceTable: "accounts_payable",
    origin: "manual",
    originLabel: "Manual / contas fixas",
    description: pickText(row.description, row.title, "Despesa manual"),
    category: pickText(row.category, "Sem categoria"),
    amount,
    date: date || pickDate(row.created_at) || todayDate(),
    dueDate: dueDate || null,
    paidAt,
    paymentMethod: pickText(row.payment_method, row.paymentMethod) || null,
    paymentReference: pickText(row.payment_reference, row.reference) || null,
    status,
    notes: pickText(row.notes, row.observation, row.description_notes) || null,
    canEdit: true,
    canPay: status === "pending",
    raw: row,
  }
}

function mapSupplierPurchase(row: any): Expense360 | null {
  const status = normalizePurchaseStatus(row)
  const purchaseDate = pickDate(row.purchase_date, row.date, row.created_at)
  const dueDate = pickDate(
    row.due_date,
    row.payment_due_date,
    row.purchase_date,
    row.created_at,
  )
  const paidAt = pickDateTime(row.paid_at, row.payment_date)
  const amount = pickNumber(
    row.total_amount,
    row.total,
    row.final_amount,
    row.amount,
    row.subtotal,
  )
  const invoice = pickText(
    row.invoice_number,
    row.invoice,
    row.nf,
    row.document_number,
  )
  const supplierName = pickText(
    row.supplier_name,
    row.supplier,
    row.supplier_business_name,
  )

  if (!row.id || amount <= 0) return null

  return {
    id: `supplier_purchases:${row.id}`,
    sourceId: row.id,
    sourceTable: "supplier_purchases",
    origin: "purchase",
    originLabel: "Compras de fornecedores",
    description: supplierName
      ? `Compra - ${supplierName}`
      : invoice
        ? `Compra de fornecedor - NF ${invoice}`
        : "Compra de fornecedor",
    category: "Compras",
    amount,
    date:
      status === "paid"
        ? pickDate(paidAt, purchaseDate, dueDate)
        : dueDate || purchaseDate || todayDate(),
    dueDate: dueDate || purchaseDate || null,
    paidAt,
    paymentMethod: pickText(row.payment_method, row.paymentMethod) || null,
    paymentReference: invoice || null,
    status,
    notes: pickText(row.notes, row.observation) || null,
    canEdit: false,
    canPay: false,
    raw: row,
  }
}

function mapStaffPayment(row: any): Expense360 | null {
  const status = normalizeStatus(row.status || (row.paid_at ? "paid" : "pending"))
  const dueDate = pickDate(row.due_date, row.payment_date, row.date, row.created_at)
  const paidAt = pickDateTime(row.paid_at, row.payment_date)
  const amount = pickNumber(
    row.amount,
    row.value,
    row.total,
    row.total_amount,
    row.salary_amount,
  )
  const staffName = pickText(row.staff_name, row.employee_name, row.name)
  const paymentType = pickText(row.payment_type, row.type, row.category, "Pagamento")

  if (!row.id || amount <= 0) return null

  return {
    id: `staff_payments:${row.id}`,
    sourceId: row.id,
    sourceTable: "staff_payments",
    origin: "staff",
    originLabel: "Funcionários",
    description: staffName ? `${paymentType} - ${staffName}` : "Pagamento de funcionário",
    category: pickText(row.category, row.payment_type, row.type, "Funcionários"),
    amount,
    date: status === "paid" ? pickDate(paidAt, dueDate) : dueDate || todayDate(),
    dueDate: dueDate || null,
    paidAt,
    paymentMethod: pickText(row.payment_method, row.paymentMethod) || null,
    paymentReference: pickText(row.payment_reference, row.reference) || null,
    status,
    notes: pickText(row.notes, row.description, row.observation) || null,
    canEdit: false,
    canPay: false,
    raw: row,
  }
}

function mapDeliverySettlement(row: any): Expense360 | null {
  const status = normalizeStatus(row.status || (row.paid_at ? "paid" : "pending"))
  const dueDate = pickDate(row.due_date, row.settlement_date, row.date, row.created_at)
  const paidAt = pickDateTime(row.paid_at, row.payment_date)
  const amount = pickNumber(
    row.total_amount,
    row.amount,
    row.total_delivery_fees,
    row.delivery_fee_total,
    row.total,
  )
  const deliveryName = pickText(row.delivery_person_name, row.delivery_name, row.name)

  if (!row.id || amount <= 0) return null

  return {
    id: `delivery_settlements:${row.id}`,
    sourceId: row.id,
    sourceTable: "delivery_settlements",
    origin: "delivery",
    originLabel: "Entregadores",
    description: deliveryName ? `Repasse - ${deliveryName}` : "Repasse de entregador",
    category: "Entregadores",
    amount,
    date: status === "paid" ? pickDate(paidAt, dueDate) : dueDate || todayDate(),
    dueDate: dueDate || null,
    paidAt,
    paymentMethod: pickText(row.payment_method, row.paymentMethod) || null,
    paymentReference: pickText(row.payment_reference, row.reference) || null,
    status,
    notes: pickText(row.notes, row.observation) || null,
    canEdit: false,
    canPay: false,
    raw: row,
  }
}

function mapProductLoss(row: any): Expense360 | null {
  const date = pickDate(row.loss_date, row.date, row.created_at)
  const amount = pickNumber(
    row.total_cost,
    row.loss_value,
    row.estimated_cost,
    row.amount,
    row.cost,
    row.total,
  )
  const productName = pickText(row.product_name, row.name, row.item_name)
  const reason = pickText(row.reason, row.type, row.category)

  if (!row.id || amount <= 0) return null

  return {
    id: `product_losses:${row.id}`,
    sourceId: row.id,
    sourceTable: "product_losses",
    origin: "loss",
    originLabel: "Perdas / consumo",
    description: productName ? `Perda - ${productName}` : "Perda / consumo interno",
    category: reason || "Perdas",
    amount,
    date: date || todayDate(),
    dueDate: date || null,
    paidAt: pickDateTime(row.created_at),
    paymentMethod: null,
    paymentReference: null,
    status: "paid",
    notes: pickText(row.notes, row.observation) || null,
    canEdit: false,
    canPay: false,
    raw: row,
  }
}

export default function DespesasPage() {
  const supabase = createClient()

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<Expense360[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [startDate, setStartDate] = useState(currentMonthStart())
  const [endDate, setEndDate] = useState(currentMonthEnd())
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all")
  const [search, setSearch] = useState("")

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [amount, setAmount] = useState("")
  const [dueDate, setDueDate] = useState(todayDate())
  const [paymentMethod, setPaymentMethod] = useState("")
  const [paymentReference, setPaymentReference] = useState("")
  const [status, setStatus] = useState<ExpenseStatus>("pending")
  const [notes, setNotes] = useState("")

  const filteredExpenses = useMemo(() => {
    const term = search.trim().toLowerCase()

    return expenses.filter((expense) => {
      const matchesStatus = statusFilter === "all" || expense.status === statusFilter
      const matchesOrigin = originFilter === "all" || expense.origin === originFilter

      const matchesSearch =
        !term ||
        expense.description.toLowerCase().includes(term) ||
        expense.category.toLowerCase().includes(term) ||
        expense.originLabel.toLowerCase().includes(term) ||
        expense.notes?.toLowerCase().includes(term)

      return matchesStatus && matchesOrigin && matchesSearch
    })
  }, [expenses, originFilter, search, statusFilter])

  const totals = useMemo(() => {
    return filteredExpenses.reduce(
      (acc, expense) => {
        if (expense.status === "cancelled") return acc

        const value = toNumber(expense.amount)

        acc.total += value
        acc.byOrigin[expense.origin] = (acc.byOrigin[expense.origin] || 0) + value

        if (expense.status === "paid") {
          acc.paid += value
          acc.paidCount += 1
        }

        if (expense.status === "pending") {
          acc.pending += value
          acc.pendingCount += 1
        }

        if (isExpenseOverdue(expense)) {
          acc.overdue += value
          acc.overdueCount += 1
        }

        return acc
      },
      {
        total: 0,
        paid: 0,
        pending: 0,
        overdue: 0,
        paidCount: 0,
        pendingCount: 0,
        overdueCount: 0,
        byOrigin: {} as Record<ExpenseOrigin, number>,
      },
    )
  }, [filteredExpenses])

  const totalsByCategory = useMemo(() => {
    const grouped = filteredExpenses.reduce<Record<string, number>>((acc, expense) => {
      if (expense.status === "cancelled") return acc

      acc[expense.category] = (acc[expense.category] || 0) + toNumber(expense.amount)
      return acc
    }, {})

    return Object.entries(grouped)
      .map(([categoryName, total]) => ({
        category: categoryName,
        total: Number(total),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [filteredExpenses])

  const sourceCards = useMemo(
    () => [
      {
        key: "purchase" as ExpenseOrigin,
        title: "Compras",
        description: "Compras de fornecedores",
        value: totals.byOrigin.purchase || 0,
        icon: ShoppingCart,
      },
      {
        key: "staff" as ExpenseOrigin,
        title: "Funcionários",
        description: "Folha, diárias e freelancers",
        value: totals.byOrigin.staff || 0,
        icon: Users,
      },
      {
        key: "delivery" as ExpenseOrigin,
        title: "Entregadores",
        description: "Repasses e taxas",
        value: totals.byOrigin.delivery || 0,
        icon: Bike,
      },
      {
        key: "manual" as ExpenseOrigin,
        title: "Manuais/fixas",
        description: "Aluguel, luz, impostos e outros",
        value: totals.byOrigin.manual || 0,
        icon: WalletCards,
      },
      {
        key: "loss" as ExpenseOrigin,
        title: "Perdas/consumo",
        description: "Perdas, consumo próprio e doações",
        value: totals.byOrigin.loss || 0,
        icon: PackageX,
      },
    ],
    [totals.byOrigin],
  )

  async function safeLoadTable(tableName: string, currentRestaurantId: string) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("restaurant_id", currentRestaurantId)
      .order("created_at", { ascending: false })
      .limit(800)

    if (error) {
      console.warn(`Não foi possível carregar ${tableName}:`, error)
      return []
    }

    return data || []
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

      setRestaurantId(restaurant.id)

      const [payables, purchases, staffPayments, deliverySettlements, productLosses] =
        await Promise.all([
          safeLoadTable("accounts_payable", restaurant.id),
          safeLoadTable("supplier_purchases", restaurant.id),
          safeLoadTable("staff_payments", restaurant.id),
          safeLoadTable("delivery_settlements", restaurant.id),
          safeLoadTable("product_losses", restaurant.id),
        ])

      const purchaseIds = new Set(
        (purchases || [])
          .map((purchase: any) => String(purchase.id || ""))
          .filter(Boolean),
      )

      const mappedPayables = (payables || [])
        .filter((payable: any) => {
          if (!payable.purchase_id) return true
          return !purchaseIds.has(String(payable.purchase_id))
        })
        .map(mapAccountPayable)

      const allExpenses = [
        ...mappedPayables,
        ...(purchases || []).map(mapSupplierPurchase),
        ...(staffPayments || []).map(mapStaffPayment),
        ...(deliverySettlements || []).map(mapDeliverySettlement),
        ...(productLosses || []).map(mapProductLoss),
      ]
        .filter((expense): expense is Expense360 => Boolean(expense))
        .filter((expense) => isDateInRange(expense.date, startDate, endDate))
        .sort((a, b) => {
          if (a.status === "pending" && b.status !== "pending") return -1
          if (a.status !== "pending" && b.status === "pending") return 1
          return b.date.localeCompare(a.date)
        })

      setExpenses(allExpenses)
    } catch (error: any) {
      console.error("Erro ao carregar despesas:", error)
      alert(error?.message || "Não foi possível carregar as despesas.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  function clearForm(closeCard = false) {
    setEditingId(null)
    setDescription("")
    setCategory("")
    setAmount("")
    setDueDate(todayDate())
    setPaymentMethod("")
    setPaymentReference("")
    setStatus("pending")
    setNotes("")

    if (closeCard) setShowForm(false)
  }

  function openNewExpenseForm() {
    clearForm(false)
    setShowForm(true)
  }

  function handleEdit(expense: Expense360) {
    if (expense.sourceTable !== "accounts_payable") {
      alert("Essa despesa vem de outro módulo. Edite pela tela de origem.")
      return
    }

    const payable = expense.raw as AccountPayable

    setEditingId(payable.id)
    setDescription(payable.description)
    setCategory(payable.category || "")
    setAmount(String(payable.amount || ""))
    setDueDate(payable.due_date)
    setPaymentMethod(payable.payment_method || "")
    setPaymentReference(payable.payment_reference || "")
    setStatus(normalizeStatus(payable.status))
    setNotes(payable.notes || "")
    setShowForm(true)

    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!restaurantId) {
      alert("Restaurante não encontrado.")
      return
    }

    if (!description.trim()) {
      alert("Informe a descrição da despesa.")
      return
    }

    const parsedAmount = toNumber(amount)

    if (parsedAmount <= 0) {
      alert("Informe um valor válido.")
      return
    }

    try {
      setSaving(true)

      const payload = {
        restaurant_id: restaurantId,
        description: description.trim(),
        category: category.trim() || null,
        amount: parsedAmount,
        due_date: dueDate,
        paid_at: status === "paid" ? new Date().toISOString() : null,
        payment_method: paymentMethod.trim() || null,
        payment_reference: paymentReference.trim() || null,
        status,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error } = await supabase
          .from("accounts_payable")
          .update(payload)
          .eq("id", editingId)
          .eq("restaurant_id", restaurantId)

        if (error) throw error
      } else {
        const { error } = await supabase.from("accounts_payable").insert(payload)

        if (error) throw error
      }

      clearForm(true)
      await loadData()
    } catch (error: any) {
      console.error("Erro ao salvar despesa:", error)
      alert(error?.message || "Não foi possível salvar a despesa.")
    } finally {
      setSaving(false)
    }
  }

  async function markAsPaid(expense: Expense360) {
    if (!restaurantId) return

    if (expense.sourceTable !== "accounts_payable") {
      alert("Essa despesa vem de outro módulo. Faça a baixa pela tela de origem.")
      return
    }

    try {
      setUpdatingId(expense.id)

      const { error } = await supabase
        .from("accounts_payable")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", expense.sourceId)
        .eq("restaurant_id", restaurantId)

      if (error) throw error

      await loadData()
    } catch (error: any) {
      console.error("Erro ao pagar despesa:", error)
      alert(error?.message || "Não foi possível marcar como paga.")
    } finally {
      setUpdatingId(null)
    }
  }

  async function cancelExpense(expense: Expense360) {
    if (!restaurantId) return

    if (expense.sourceTable !== "accounts_payable") {
      alert("Essa despesa vem de outro módulo. Cancele pela tela de origem.")
      return
    }

    const confirmed = window.confirm(`Cancelar a despesa "${expense.description}"?`)

    if (!confirmed) return

    try {
      setUpdatingId(expense.id)

      const { error } = await supabase
        .from("accounts_payable")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", expense.sourceId)
        .eq("restaurant_id", restaurantId)

      if (error) throw error

      await loadData()
    } catch (error: any) {
      console.error("Erro ao cancelar despesa:", error)
      alert(error?.message || "Não foi possível cancelar a despesa.")
    } finally {
      setUpdatingId(null)
    }
  }

  function renderExpenseActions(expense: Expense360) {
    if (!expense.canEdit && !expense.canPay) {
      return (
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
          Via {expense.originLabel}
        </span>
      )
    }

    return (
      <div className="flex flex-wrap justify-end gap-2">
        {expense.canPay && expense.status === "pending" && (
          <Button
            type="button"
            size="sm"
            onClick={() => markAsPaid(expense)}
            disabled={updatingId === expense.id}
            className="h-8 gap-2"
          >
            {updatingId === expense.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Pagar
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => handleEdit(expense)}
          className="h-8"
        >
          <Pencil className="h-4 w-4" />
        </Button>

        {expense.status !== "cancelled" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => cancelExpense(expense)}
            disabled={updatingId === expense.id}
            className="h-8"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-4 pb-8">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              <ArrowDownCircle className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-950 sm:text-xl">
                Despesas 360
              </h1>
              <p className="text-sm text-slate-500">
                Compras, funcionários, entregadores, perdas, consumo próprio e contas
                manuais.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex">
            <Button
              type="button"
              variant="outline"
              onClick={loadData}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
              Atualizar
            </Button>

            <Button type="button" onClick={openNewExpenseForm} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova despesa
            </Button>
          </div>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">
                  {editingId ? "Editar despesa manual" : "Nova despesa manual"}
                </h2>
                <p className="text-sm text-slate-500">
                  Use para gastos que não vêm automaticamente de compras, funcionários ou
                  entregadores.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => clearForm(true)}
                className="h-9 w-9 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
              <div className="space-y-1.5 lg:col-span-2">
                <Label>Descrição</Label>
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Ex: Aluguel, energia, doação, consumo próprio..."
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Selecione</option>
                  {manualCategoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Valor</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Ex: 250.00"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as ExpenseStatus)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Método de pagamento</Label>
                <Input
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  placeholder="Pix, dinheiro, cartão..."
                />
              </div>

              <div className="space-y-1.5">
                <Label>Referência</Label>
                <Input
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="Comprovante, nota..."
                />
              </div>

              <div className="space-y-1.5 lg:col-span-4">
                <Label>Observação</Label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Detalhes da despesa..."
                  rows={3}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => clearForm(true)}>
                Cancelar
              </Button>

              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {editingId ? "Salvar alterações" : "Cadastrar despesa"}
              </Button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total no período
            </p>
            <strong className="mt-1 block text-xl font-semibold text-slate-950 sm:text-2xl">
              {formatCurrency(totals.total)}
            </strong>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Pago
            </p>
            <strong className="mt-1 block text-xl font-semibold text-emerald-600 sm:text-2xl">
              {formatCurrency(totals.paid)}
            </strong>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Pendente
            </p>
            <strong className="mt-1 block text-xl font-semibold text-orange-600 sm:text-2xl">
              {formatCurrency(totals.pending)}
            </strong>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Vencido
            </p>
            <strong className="mt-1 block text-xl font-semibold text-red-600 sm:text-2xl">
              {formatCurrency(totals.overdue)}
            </strong>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Pendências
            </p>
            <strong className="mt-1 block text-xl font-semibold text-slate-950 sm:text-2xl">
              {totals.pendingCount}
            </strong>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {sourceCards.map((item) => {
            const Icon = item.icon

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setOriginFilter(originFilter === item.key ? "all" : item.key)}
                className={cn(
                  "rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50",
                  originFilter === item.key
                    ? "border-orange-300 ring-2 ring-orange-100"
                    : "border-slate-200",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950">{item.title}</p>
                    <p className="truncate text-xs text-slate-500">{item.description}</p>
                  </div>

                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1",
                      originStyles[item.key],
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                </div>

                <strong className="mt-3 block text-lg font-semibold text-slate-950">
                  {formatCurrency(item.value)}
                </strong>
              </button>
            )
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_150px_150px_150px_150px]">
              <div className="relative md:col-span-2 xl:col-span-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por despesa, origem ou categoria..."
                  className="pl-9"
                />
              </div>

              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />

              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="all">Todos status</option>
                <option value="pending">Pendentes</option>
                <option value="paid">Pagas</option>
                <option value="cancelled">Canceladas</option>
              </select>

              <select
                value={originFilter}
                onChange={(event) => setOriginFilter(event.target.value as OriginFilter)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="all">Todas origens</option>
                <option value="purchase">Compras</option>
                <option value="staff">Funcionários</option>
                <option value="delivery">Entregadores</option>
                <option value="manual">Manuais/fixas</option>
                <option value="loss">Perdas/consumo</option>
              </select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando despesas 360...
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center sm:p-10">
                <ArrowDownCircle className="mx-auto h-9 w-9 text-slate-300" />
                <p className="mt-2 font-medium text-slate-800">
                  Nenhuma despesa encontrada
                </p>
                <p className="text-sm text-slate-500">
                  Lance uma despesa, registre uma compra ou ajuste os filtros.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {filteredExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full px-2 py-1 text-xs font-medium ring-1",
                                originStyles[expense.origin],
                              )}
                            >
                              {expense.originLabel}
                            </span>

                            <span
                              className={cn(
                                "rounded-full px-2 py-1 text-xs font-medium ring-1",
                                statusStyles[expense.status] ||
                                  "bg-slate-100 text-slate-600 ring-slate-200",
                              )}
                            >
                              {statusLabels[expense.status] || expense.status}
                            </span>
                          </div>

                          <p className="mt-2 font-semibold text-slate-950">
                            {expense.description}
                          </p>
                          <p className="text-sm text-slate-500">{expense.category}</p>
                        </div>

                        {isExpenseOverdue(expense) && (
                          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">Data</p>
                          <p className="font-medium text-slate-800">
                            {formatDate(expense.date)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">Valor</p>
                          <p className="font-semibold text-orange-600">
                            {formatCurrency(expense.amount)}
                          </p>
                        </div>

                        <div className="col-span-2">
                          <p className="text-xs text-slate-500">Pagamento</p>
                          <p className="font-medium text-slate-800">
                            {expense.status === "paid"
                              ? `${expense.paymentMethod || "Método não informado"}${
                                  expense.paidAt
                                    ? ` • ${formatDateTime(expense.paidAt)}`
                                    : ""
                                }`
                              : "Ainda não pago"}
                          </p>
                        </div>
                      </div>

                      {expense.notes && (
                        <p className="mt-3 text-sm text-slate-500">{expense.notes}</p>
                      )}

                      <div className="mt-3 flex justify-end">
                        {renderExpenseActions(expense)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-xl border border-slate-200 lg:block">
                  <div className="max-h-[640px] overflow-auto">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Despesa</th>
                          <th className="px-4 py-3">Origem</th>
                          <th className="px-4 py-3">Categoria</th>
                          <th className="px-4 py-3">Data</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Pagamento</th>
                          <th className="px-4 py-3 text-right">Valor</th>
                          <th className="px-4 py-3 text-right">Ações</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredExpenses.map((expense) => (
                          <tr key={expense.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="flex items-start gap-2">
                                {isExpenseOverdue(expense) && (
                                  <AlertTriangle className="mt-0.5 h-4 w-4 text-red-500" />
                                )}

                                <div>
                                  <p className="font-medium text-slate-950">
                                    {expense.description}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {expense.notes || "Sem observação"}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-1 text-xs font-medium ring-1",
                                  originStyles[expense.origin],
                                )}
                              >
                                {expense.originLabel}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-slate-700">
                              {expense.category}
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 text-slate-700">
                                {isExpenseOverdue(expense) ? (
                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                ) : (
                                  <CalendarClock className="h-4 w-4 text-slate-400" />
                                )}
                                {formatDate(expense.date)}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-1 text-xs font-medium ring-1",
                                  statusStyles[expense.status] ||
                                    "bg-slate-100 text-slate-600 ring-slate-200",
                                )}
                              >
                                {statusLabels[expense.status] || expense.status}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-slate-500">
                              {expense.status === "paid" ? (
                                <span>
                                  {expense.paymentMethod || "Método não informado"}
                                  {expense.paidAt
                                    ? ` • ${formatDateTime(expense.paidAt)}`
                                    : ""}
                                </span>
                              ) : (
                                "Ainda não pago"
                              )}
                            </td>

                            <td className="px-4 py-3 text-right font-semibold text-orange-600">
                              {formatCurrency(expense.amount)}
                            </td>

                            <td className="px-4 py-3 text-right">
                              {renderExpenseActions(expense)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-slate-500" />
                <h2 className="font-semibold text-slate-950">Maiores categorias</h2>
              </div>

              {totalsByCategory.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  Nenhuma categoria no período.
                </div>
              ) : (
                <div className="space-y-3">
                  {totalsByCategory.map((item) => {
                    const percent =
                      totals.total > 0 ? Math.min((item.total / totals.total) * 100, 100) : 0

                    return (
                      <div key={item.category} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate font-medium text-slate-700">
                            {item.category}
                          </span>
                          <strong className="text-slate-950">
                            {formatCurrency(item.total)}
                          </strong>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-orange-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
              <div className="flex gap-2">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <strong>Regra da tela:</strong> compras de fornecedores entram
                  automaticamente aqui como despesa. O botão “Nova despesa” fica apenas
                  para gastos manuais como doação, consumo próprio, impostos e contas fixas.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}