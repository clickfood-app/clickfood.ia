"use client"

import { useEffect, useMemo, useState } from "react"
import type { FormEvent, ReactNode } from "react"
import AdminLayout from "@/components/admin-layout"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Filter,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type PayableStatus = "pending" | "paid" | "overdue" | "canceled"
type VisualStatus = "pending" | "paid" | "overdue" | "canceled"
type StatusFilter = "all" | VisualStatus
type PeriodFilter = "all" | "today" | "next7" | "overdue"

type Supplier = {
  id: string
  name: string
  category: string | null
  status: "active" | "inactive"
}

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
  status: PayableStatus
  notes: string | null
  created_at: string
  updated_at: string
  suppliers?: {
    name: string | null
    category: string | null
  } | null
}

type PayableForm = {
  supplier_id: string
  description: string
  category: string
  amount: string
  due_date: string
  payment_method: string
  payment_reference: string
  status: PayableStatus
  notes: string
}

type PayableTemplate = {
  label: string
  description: string
  category: string
  dueDay: number
}

type MetricCardProps = {
  title: string
  value: string
  subtitle: string
  icon: ReactNode
  tone: "blue" | "orange" | "red" | "slate" | "emerald"
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

const today = getLocalDateString()
const currentMonth = today.slice(0, 7)

const emptyForm: PayableForm = {
  supplier_id: "",
  description: "",
  category: "",
  amount: "",
  due_date: today,
  payment_method: "",
  payment_reference: "",
  status: "pending",
  notes: "",
}

const payableTemplates: PayableTemplate[] = [
  { label: "Aluguel", description: "Aluguel", category: "Aluguel", dueDay: 5 },
  { label: "Água", description: "Conta de água", category: "Água", dueDay: 10 },
  { label: "Luz", description: "Conta de luz", category: "Energia", dueDay: 10 },
  { label: "Internet", description: "Internet", category: "Internet", dueDay: 10 },
  { label: "Imposto", description: "Impostos", category: "Impostos", dueDay: 20 },
  { label: "Sistema", description: "Sistema / software", category: "Sistemas", dueDay: 10 },
  { label: "Taxas", description: "Taxas operacionais", category: "Taxas", dueDay: 15 },
  { label: "Outros", description: "Outra conta", category: "Outros", dueDay: 10 },
]

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function parseMoney(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".")
  const number = Number(normalized)

  return Number.isFinite(number) ? number : 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`))
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00`))
}

function onlyFilled(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function addDaysToDateString(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + days)

  return getLocalDateString(date)
}

function addMonthsToDateString(value: string, months: number) {
  const date = new Date(`${value}T00:00:00`)
  const targetYear = date.getFullYear()
  const targetMonth = date.getMonth() + months
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
  const safeDay = Math.min(date.getDate(), lastDay)
  const nextDate = new Date(targetYear, targetMonth, safeDay)

  return getLocalDateString(nextDate)
}

function getMonthRange(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)

  return {
    start: getLocalDateString(start),
    end: getLocalDateString(end),
  }
}

function getDateInsideMonth(monthValue: string, day: number) {
  const [year, month] = monthValue.split("-").map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const safeDay = Math.min(day, lastDay)

  return getLocalDateString(new Date(year, month - 1, safeDay))
}

function getMonthLabel(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number)

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1))
}

function getDaysDifference(value: string) {
  const dueDate = new Date(`${value}T00:00:00`).getTime()
  const todayDate = new Date(`${today}T00:00:00`).getTime()

  return Math.round((dueDate - todayDate) / (1000 * 60 * 60 * 24))
}

function isOverdue(account: AccountPayable) {
  return account.status === "pending" && account.due_date < today
}

function getVisualStatus(account: AccountPayable): VisualStatus {
  if (account.status === "paid") return "paid"
  if (account.status === "canceled") return "canceled"
  if (isOverdue(account)) return "overdue"
  return "pending"
}

function getStatusLabel(status: VisualStatus) {
  if (status === "paid") return "Pago"
  if (status === "overdue") return "Vencido"
  if (status === "canceled") return "Cancelado"
  return "Pendente"
}

function getPaymentMethodLabel(method: string | null) {
  if (!method) return "Não informado"

  const labels: Record<string, string> = {
    pix: "Pix",
    dinheiro: "Dinheiro",
    cartao: "Cartão",
    boleto: "Boleto",
    transferencia: "Transferência",
  }

  return labels[method] || method
}

function getDueLabel(account: AccountPayable) {
  const visualStatus = getVisualStatus(account)

  if (visualStatus === "paid") return account.paid_at ? "Quitado" : "Pago"
  if (visualStatus === "canceled") return "Cancelado"

  const days = getDaysDifference(account.due_date)

  if (days < 0) {
    const absDays = Math.abs(days)
    return `${absDays} ${absDays === 1 ? "dia" : "dias"} atrasado`
  }

  if (days === 0) return "Vence hoje"
  if (days === 1) return "Vence amanhã"

  return `Vence em ${days} dias`
}

function getStatusBadgeClass(status: VisualStatus) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }

  if (status === "overdue") {
    return "border-red-200 bg-red-50 text-red-700"
  }

  if (status === "canceled") {
    return "border-slate-200 bg-slate-100 text-slate-500"
  }

  return "border-amber-200 bg-amber-50 text-amber-700"
}

function getDueToneClass(account: AccountPayable) {
  const visualStatus = getVisualStatus(account)

  if (visualStatus === "paid") return "bg-emerald-500"
  if (visualStatus === "overdue") return "bg-red-500"
  if (visualStatus === "canceled") return "bg-slate-300"
  if (account.due_date === today) return "bg-amber-500"

  return "bg-blue-500"
}

function MetricCard({ title, value, subtitle, icon, tone }: MetricCardProps) {
  const toneClasses = {
    blue: {
      card: "border-blue-100 bg-blue-50/70",
      icon: "bg-blue-600 text-white shadow-blue-600/20",
      subtitle: "text-blue-700",
    },
    orange: {
      card: "border-orange-100 bg-orange-50/70",
      icon: "bg-orange-500 text-white shadow-orange-500/20",
      subtitle: "text-orange-700",
    },
    red: {
      card: "border-red-100 bg-red-50/70",
      icon: "bg-red-500 text-white shadow-red-500/20",
      subtitle: "text-red-700",
    },
    slate: {
      card: "border-slate-200 bg-slate-50",
      icon: "bg-slate-800 text-white shadow-slate-800/20",
      subtitle: "text-slate-500",
    },
    emerald: {
      card: "border-emerald-100 bg-emerald-50/70",
      icon: "bg-emerald-500 text-white shadow-emerald-500/20",
      subtitle: "text-emerald-700",
    },
  }

  return (
    <div className={cn("rounded-3xl border p-4 shadow-sm", toneClasses[tone].card)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            {title}
          </p>

          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            {value}
          </p>

          <p className={cn("mt-1 text-xs font-black", toneClasses[tone].subtitle)}>
            {subtitle}
          </p>
        </div>

        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-lg",
            toneClasses[tone].icon,
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function ContasAPagarPage() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [accounts, setAccounts] = useState<AccountPayable[]>([])

  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState("all")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [form, setForm] = useState<PayableForm>(emptyForm)

  const selectedMonthRange = useMemo(() => getMonthRange(selectedMonth), [selectedMonth])

  async function loadPageData() {
    setLoading(true)
    setError(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError("Não foi possível identificar o usuário logado.")
      setLoading(false)
      return
    }

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError || !restaurant) {
      setError("Não foi possível encontrar o restaurante vinculado a este usuário.")
      setLoading(false)
      return
    }

    setRestaurantId(restaurant.id)

    const { data: suppliersData, error: suppliersError } = await supabase
      .from("suppliers")
      .select("id, name, category, status")
      .eq("restaurant_id", restaurant.id)
      .order("name", { ascending: true })

    if (suppliersError) {
      setError("Erro ao carregar fornecedores.")
      setLoading(false)
      return
    }

    setSuppliers((suppliersData || []) as Supplier[])

    const { data: accountsData, error: accountsError } = await supabase
      .from("accounts_payable")
      .select(`
        *,
        suppliers (
          name,
          category
        )
      `)
      .eq("restaurant_id", restaurant.id)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: false })

    if (accountsError) {
      setError("Erro ao carregar contas a pagar.")
      setLoading(false)
      return
    }

    setAccounts((accountsData || []) as AccountPayable[])
    setLoading(false)
  }

  useEffect(() => {
    void loadPageData()
  }, [])

  const activeSuppliers = suppliers.filter((supplier) => supplier.status === "active")

  const monthAccounts = useMemo(() => {
    return accounts.filter(
      (account) =>
        account.due_date >= selectedMonthRange.start &&
        account.due_date <= selectedMonthRange.end,
    )
  }, [accounts, selectedMonthRange.end, selectedMonthRange.start])

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>()

    payableTemplates.forEach((template) => categories.add(template.category))
    accounts.forEach((account) => {
      if (account.category) categories.add(account.category)
    })

    return Array.from(categories).sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [accounts])

  const totals = useMemo(() => {
    const nextSevenDays = addDaysToDateString(today, 7)

    const validAccounts = monthAccounts.filter(
      (account) => getVisualStatus(account) !== "canceled",
    )

    const openAccounts = validAccounts.filter((account) => {
      const visualStatus = getVisualStatus(account)
      return visualStatus === "pending" || visualStatus === "overdue"
    })

    const overdueAccounts = validAccounts.filter(
      (account) => getVisualStatus(account) === "overdue",
    )

    const dueTodayAccounts = validAccounts.filter((account) => {
      const visualStatus = getVisualStatus(account)
      return visualStatus === "pending" && account.due_date === today
    })

    const nextSevenDaysAccounts = validAccounts.filter((account) => {
      const visualStatus = getVisualStatus(account)
      return (
        visualStatus === "pending" &&
        account.due_date > today &&
        account.due_date <= nextSevenDays
      )
    })

    const paidAccounts = validAccounts.filter(
      (account) => getVisualStatus(account) === "paid",
    )

    return {
      totalAmount: validAccounts.reduce(
        (sum, account) => sum + Number(account.amount || 0),
        0,
      ),
      totalCount: validAccounts.length,
      openAmount: openAccounts.reduce(
        (sum, account) => sum + Number(account.amount || 0),
        0,
      ),
      openCount: openAccounts.length,
      overdueAmount: overdueAccounts.reduce(
        (sum, account) => sum + Number(account.amount || 0),
        0,
      ),
      overdueCount: overdueAccounts.length,
      dueTodayAmount: dueTodayAccounts.reduce(
        (sum, account) => sum + Number(account.amount || 0),
        0,
      ),
      dueTodayCount: dueTodayAccounts.length,
      nextSevenDaysAmount: nextSevenDaysAccounts.reduce(
        (sum, account) => sum + Number(account.amount || 0),
        0,
      ),
      nextSevenDaysCount: nextSevenDaysAccounts.length,
      paidAmount: paidAccounts.reduce(
        (sum, account) => sum + Number(account.amount || 0),
        0,
      ),
      paidCount: paidAccounts.length,
    }
  }, [monthAccounts])

  const categorySummary = useMemo(() => {
    const map = new Map<
      string,
      { category: string; total: number; open: number; paid: number; count: number }
    >()

    monthAccounts.forEach((account) => {
      const visualStatus = getVisualStatus(account)
      if (visualStatus === "canceled") return

      const category = account.category || "Sem categoria"
      const current = map.get(category) || {
        category,
        total: 0,
        open: 0,
        paid: 0,
        count: 0,
      }

      const amount = Number(account.amount || 0)

      current.total += amount
      current.count += 1

      if (visualStatus === "paid") {
        current.paid += amount
      } else {
        current.open += amount
      }

      map.set(category, current)
    })

    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [monthAccounts])

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLowerCase()
    const nextSevenDays = addDaysToDateString(today, 7)

    return monthAccounts.filter((account) => {
      const visualStatus = getVisualStatus(account)

      const matchesSearch =
        !term ||
        [
          account.description,
          account.category,
          account.payment_method,
          account.payment_reference,
          account.suppliers?.name,
          account.suppliers?.category,
          getStatusLabel(visualStatus),
          account.purchase_id ? "compra" : "manual",
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))

      const matchesStatus =
        statusFilter === "all" || getVisualStatus(account) === statusFilter

      const matchesCategory =
        categoryFilter === "all" || (account.category || "Sem categoria") === categoryFilter

      const matchesPeriod =
        periodFilter === "all" ||
        (periodFilter === "today" && account.due_date === today) ||
        (periodFilter === "next7" &&
          account.due_date >= today &&
          account.due_date <= nextSevenDays) ||
        (periodFilter === "overdue" && visualStatus === "overdue")

      return matchesSearch && matchesStatus && matchesCategory && matchesPeriod
    })
  }, [monthAccounts, search, statusFilter, categoryFilter, periodFilter])

  const hasFilters =
    search.trim().length > 0 ||
    statusFilter !== "all" ||
    categoryFilter !== "all" ||
    periodFilter !== "all"

  const isEditing = Boolean(editingAccountId)

  function clearFilters() {
    setSearch("")
    setStatusFilter("all")
    setCategoryFilter("all")
    setPeriodFilter("all")
  }

  function openCreateModal() {
    setEditingAccountId(null)
    setForm({
      ...emptyForm,
      due_date: selectedMonth === currentMonth ? today : getDateInsideMonth(selectedMonth, 10),
    })
    setIsModalOpen(true)
    setError(null)
  }

  function openTemplateModal(template: PayableTemplate) {
    setEditingAccountId(null)
    setForm({
      ...emptyForm,
      description: template.description,
      category: template.category,
      due_date: getDateInsideMonth(selectedMonth, template.dueDay),
    })
    setIsModalOpen(true)
    setError(null)
  }

  function openEditModal(account: AccountPayable) {
    setEditingAccountId(account.id)
    setForm({
      supplier_id: account.supplier_id || "",
      description: account.description || "",
      category: account.category || "",
      amount: String(account.amount || ""),
      due_date: account.due_date,
      payment_method: account.payment_method || "",
      payment_reference: account.payment_reference || "",
      status: account.status === "paid" ? "paid" : "pending",
      notes: account.notes || "",
    })
    setIsModalOpen(true)
    setError(null)
  }

  function closeModal() {
    if (saving) return

    setIsModalOpen(false)
    setEditingAccountId(null)
    setForm(emptyForm)
  }

  async function handleSaveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!restaurantId) {
      setError("Restaurante não encontrado.")
      return
    }

    const amount = parseMoney(form.amount)

    if (!form.description.trim()) {
      setError("Informe a descrição da conta.")
      return
    }

    if (amount <= 0) {
      setError("O valor da conta precisa ser maior que zero.")
      return
    }

    if (!form.due_date) {
      setError("Informe a data de vencimento.")
      return
    }

    setSaving(true)
    setError(null)

    const currentEditingAccount = editingAccountId
      ? accounts.find((account) => account.id === editingAccountId)
      : null

    const payload = {
      restaurant_id: restaurantId,
      supplier_id: form.supplier_id || null,
      description: form.description.trim(),
      category: onlyFilled(form.category),
      amount,
      due_date: form.due_date,
      paid_at:
        form.status === "paid"
          ? currentEditingAccount?.paid_at || new Date().toISOString()
          : null,
      payment_method: onlyFilled(form.payment_method),
      payment_reference: onlyFilled(form.payment_reference),
      status: form.status,
      notes: onlyFilled(form.notes),
    }

    if (editingAccountId) {
      const { data, error: updateError } = await supabase
        .from("accounts_payable")
        .update(payload)
        .eq("id", editingAccountId)
        .eq("restaurant_id", restaurantId)
        .select(`
          *,
          suppliers (
            name,
            category
          )
        `)
        .single()

      if (updateError || !data) {
        setError("Erro ao atualizar conta a pagar.")
        setSaving(false)
        return
      }

      setAccounts((current) =>
        current.map((item) => (item.id === editingAccountId ? (data as AccountPayable) : item)),
      )

      setSaving(false)
      closeModal()
      return
    }

    const { data, error: insertError } = await supabase
      .from("accounts_payable")
      .insert(payload)
      .select(`
        *,
        suppliers (
          name,
          category
        )
      `)
      .single()

    if (insertError || !data) {
      setError("Erro ao cadastrar conta a pagar.")
      setSaving(false)
      return
    }

    setAccounts((current) => [data as AccountPayable, ...current])
    setSaving(false)
    closeModal()
  }

  async function markAsPaid(account: AccountPayable) {
    if (!restaurantId) return

    setActionLoadingId(account.id)
    setError(null)

    const { data, error: updateError } = await supabase
      .from("accounts_payable")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", account.id)
      .eq("restaurant_id", restaurantId)
      .select(`
        *,
        suppliers (
          name,
          category
        )
      `)
      .single()

    if (updateError || !data) {
      setError("Erro ao marcar conta como paga.")
      setActionLoadingId(null)
      return
    }

    if (account.purchase_id) {
      await supabase
        .from("supplier_purchases")
        .update({
          payment_status: "paid",
          status: "closed",
        })
        .eq("id", account.purchase_id)
        .eq("restaurant_id", restaurantId)
    }

    setAccounts((current) =>
      current.map((item) => (item.id === account.id ? (data as AccountPayable) : item)),
    )

    setActionLoadingId(null)
  }

  async function cancelAccount(account: AccountPayable) {
    if (!restaurantId) return

    setActionLoadingId(account.id)
    setError(null)

    const { data, error: updateError } = await supabase
      .from("accounts_payable")
      .update({
        status: "canceled",
      })
      .eq("id", account.id)
      .eq("restaurant_id", restaurantId)
      .select(`
        *,
        suppliers (
          name,
          category
        )
      `)
      .single()

    if (updateError || !data) {
      setError("Erro ao cancelar conta.")
      setActionLoadingId(null)
      return
    }

    setAccounts((current) =>
      current.map((item) => (item.id === account.id ? (data as AccountPayable) : item)),
    )

    setActionLoadingId(null)
  }

  async function repeatNextMonth(account: AccountPayable) {
    if (!restaurantId) return

    setActionLoadingId(account.id)
    setError(null)

    const payload = {
      restaurant_id: restaurantId,
      supplier_id: account.supplier_id || null,
      purchase_id: null,
      description: account.description,
      category: account.category,
      amount: Number(account.amount || 0),
      due_date: addMonthsToDateString(account.due_date, 1),
      paid_at: null,
      payment_method: account.payment_method,
      payment_reference: null,
      status: "pending" as PayableStatus,
      notes: account.notes,
    }

    const { data, error: insertError } = await supabase
      .from("accounts_payable")
      .insert(payload)
      .select(`
        *,
        suppliers (
          name,
          category
        )
      `)
      .single()

    if (insertError || !data) {
      setError("Erro ao repetir conta para o próximo mês.")
      setActionLoadingId(null)
      return
    }

    setAccounts((current) => [data as AccountPayable, ...current])
    setActionLoadingId(null)
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#f4f7fb] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <section className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                  <ReceiptText className="h-6 w-6" />
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">
                    Financeiro operacional
                  </p>

                  <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                    Contas a Pagar
                  </h1>

                  <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-500">
                    Lance as contas do mês, acompanhe vencimentos e controle o que já foi pago.
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[180px_auto] sm:items-center">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Mês de controle
                  </span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value || currentMonth)}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 sm:mt-auto"
                >
                  <Plus className="h-4 w-4" />
                  Nova conta
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              title="Total do mês"
              value={formatCurrency(totals.totalAmount)}
              subtitle={`${totals.totalCount} ${totals.totalCount === 1 ? "conta lançada" : "contas lançadas"}`}
              icon={<Wallet className="h-5 w-5" />}
              tone="blue"
            />

            <MetricCard
              title="Em aberto"
              value={formatCurrency(totals.openAmount)}
              subtitle={`${totals.openCount} ${totals.openCount === 1 ? "conta" : "contas"}`}
              icon={<ReceiptText className="h-5 w-5" />}
              tone="slate"
            />

            <MetricCard
              title="Vence hoje"
              value={formatCurrency(totals.dueTodayAmount)}
              subtitle={`${totals.dueTodayCount} ${totals.dueTodayCount === 1 ? "vencimento" : "vencimentos"}`}
              icon={<CalendarClock className="h-5 w-5" />}
              tone="orange"
            />

            <MetricCard
              title="Vencidas"
              value={formatCurrency(totals.overdueAmount)}
              subtitle={`${totals.overdueCount} ${totals.overdueCount === 1 ? "atrasada" : "atrasadas"}`}
              icon={<AlertTriangle className="h-5 w-5" />}
              tone="red"
            />

            <MetricCard
              title="Pago no mês"
              value={formatCurrency(totals.paidAmount)}
              subtitle={`${totals.paidCount} ${totals.paidCount === 1 ? "quitada" : "quitadas"}`}
              icon={<CheckCircle2 className="h-5 w-5" />}
              tone="emerald"
            />
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-900">
                  Lançamento rápido
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Use os atalhos para lançar as despesas fixas do mês sem perder tempo.
                </p>
              </div>

              <p className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-500">
                {getMonthLabel(selectedMonth)}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {payableTemplates.map((template) => (
                <button
                  key={template.label}
                  type="button"
                  onClick={() => openTemplateModal(template)}
                  className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  + {template.label}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-white px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Filter className="h-4 w-4" />
                    </div>

                    <div>
                      <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-900">
                        Contas de {getMonthLabel(selectedMonth)}
                      </h2>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        Lista compacta para mobile, sem tabela arrastando para o lado.
                      </p>
                    </div>
                  </div>

                  {hasFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-wide text-slate-600 transition hover:bg-slate-50"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar por conta, categoria ou fornecedor..."
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="all">Todos os status</option>
                    <option value="pending">Pendentes</option>
                    <option value="overdue">Vencidas</option>
                    <option value="paid">Pagas</option>
                    <option value="canceled">Canceladas</option>
                  </select>

                  <select
                    value={periodFilter}
                    onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="all">Todo o mês</option>
                    <option value="today">Vence hoje</option>
                    <option value="next7">Próximos 7 dias</option>
                    <option value="overdue">Atrasadas</option>
                  </select>

                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="all">Todas categorias</option>
                    <option value="Sem categoria">Sem categoria</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <div className="mx-4 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 sm:mx-5">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="flex min-h-[300px] items-center justify-center">
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-500 shadow-sm">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Carregando contas...
                  </div>
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center p-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                    <ReceiptText className="h-8 w-8" />
                  </div>

                  <h3 className="mt-5 text-lg font-black text-slate-950">
                    Nenhuma conta encontrada
                  </h3>

                  <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
                    Lance as contas fixas e variáveis deste mês: aluguel, água, luz,
                    impostos, sistemas, taxas e outros custos.
                  </p>

                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Cadastrar conta
                  </button>
                </div>
              ) : (
                <div className="max-h-[620px] overflow-y-auto p-3 scrollbar-thin scrollbar-track-slate-100 scrollbar-thumb-slate-300 sm:p-4">
                  <div className="space-y-3">
                    {filteredAccounts.map((account) => {
                      const visualStatus = getVisualStatus(account)
                      const isActionLoading = actionLoadingId === account.id
                      const isDueToday = visualStatus === "pending" && account.due_date === today

                      return (
                        <article
                          key={account.id}
                          className={cn(
                            "rounded-3xl border bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md",
                            visualStatus === "overdue" && "border-red-200 bg-red-50/35",
                            isDueToday && "border-amber-200 bg-amber-50/40",
                            visualStatus === "paid" && "border-emerald-200 bg-emerald-50/25",
                            visualStatus === "canceled" && "border-slate-200 bg-slate-50 opacity-75",
                            visualStatus === "pending" && !isDueToday && "border-slate-200",
                          )}
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex min-w-0 flex-1 gap-3">
                              <span
                                className={cn(
                                  "mt-1 h-14 w-1.5 shrink-0 rounded-full",
                                  getDueToneClass(account),
                                )}
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={cn(
                                      "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                                      getStatusBadgeClass(visualStatus),
                                    )}
                                  >
                                    {getStatusLabel(visualStatus)}
                                  </span>

                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                                    {account.purchase_id ? "Compra" : "Manual"}
                                  </span>
                                </div>

                                <h3 className="mt-2 truncate text-base font-black text-slate-950">
                                  {account.description}
                                </h3>

                                <div className="mt-2 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
                                  <span>
                                    Vencimento:{" "}
                                    <strong className="text-slate-900">
                                      {formatShortDate(account.due_date)}
                                    </strong>
                                  </span>

                                  <span
                                    className={cn(
                                      visualStatus === "overdue" && "text-red-600",
                                      isDueToday && "text-amber-600",
                                      visualStatus === "paid" && "text-emerald-600",
                                    )}
                                  >
                                    {getDueLabel(account)}
                                  </span>

                                  <span>
                                    Categoria:{" "}
                                    <strong className="text-slate-900">
                                      {account.category || "Sem categoria"}
                                    </strong>
                                  </span>

                                  <span>
                                    Pagamento:{" "}
                                    <strong className="text-slate-900">
                                      {getPaymentMethodLabel(account.payment_method)}
                                    </strong>
                                  </span>
                                </div>

                                {(account.suppliers?.name || account.notes || account.payment_reference) && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {account.suppliers?.name && (
                                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">
                                        {account.suppliers.name}
                                      </span>
                                    )}

                                    {account.payment_reference && (
                                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500">
                                        {account.payment_reference}
                                      </span>
                                    )}

                                    {account.notes && (
                                      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-black text-orange-700">
                                        tem observação
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-3 lg:w-[270px] lg:items-end">
                              <p className="text-2xl font-black tracking-tight text-slate-950 lg:text-right">
                                {formatCurrency(Number(account.amount || 0))}
                              </p>

                              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                                {visualStatus !== "paid" && visualStatus !== "canceled" && (
                                  <button
                                    type="button"
                                    onClick={() => markAsPaid(account)}
                                    disabled={isActionLoading}
                                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isActionLoading && (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    )}
                                    Pagar
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => openEditModal(account)}
                                  disabled={isActionLoading}
                                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Editar
                                </button>

                                <button
                                  type="button"
                                  onClick={() => repeatNextMonth(account)}
                                  disabled={isActionLoading || visualStatus === "canceled"}
                                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isActionLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <RefreshCcw className="h-3.5 w-3.5" />
                                  )}
                                  Repetir
                                </button>

                                {visualStatus !== "canceled" && visualStatus !== "paid" && (
                                  <button
                                    type="button"
                                    onClick={() => cancelAccount(account)}
                                    disabled={isActionLoading}
                                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white px-3 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Cancelar
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              )}

              {!loading && filteredAccounts.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4 text-xs font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Exibindo {filteredAccounts.length} de {monthAccounts.length} contas do mês.
                  </span>

                  <span>
                    Em aberto: <strong className="font-black text-slate-950">{formatCurrency(totals.openAmount)}</strong>
                  </span>
                </div>
              )}
            </div>

            <aside className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-900">
                    Resumo por categoria
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Veja onde o dinheiro do mês está indo.
                  </p>
                </div>

                <div className="rounded-2xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
                  {categorySummary.length}
                </div>
              </div>

              <div className="mt-4 max-h-[620px] space-y-3 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-slate-100 scrollbar-thumb-slate-300">
                {categorySummary.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                    <p className="text-sm font-black text-slate-700">Sem contas lançadas</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Ao cadastrar contas, o resumo aparece aqui.
                    </p>
                  </div>
                ) : (
                  categorySummary.map((item) => {
                    const paidPercent = item.total > 0 ? Math.round((item.paid / item.total) * 100) : 0

                    return (
                      <div key={item.category} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-950">{item.category}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {item.count} {item.count === 1 ? "conta" : "contas"}
                            </p>
                          </div>

                          <p className="text-sm font-black text-slate-950">
                            {formatCurrency(item.total)}
                          </p>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${paidPercent}%` }}
                          />
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
                          <div className="rounded-2xl bg-white px-3 py-2">
                            <p className="text-slate-400">Aberto</p>
                            <p className="mt-0.5 font-black text-red-600">
                              {formatCurrency(item.open)}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-white px-3 py-2">
                            <p className="text-slate-400">Pago</p>
                            <p className="mt-0.5 font-black text-emerald-600">
                              {formatCurrency(item.paid)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </aside>
          </section>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                    {isEditing ? "Editar conta" : "Nova conta"}
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    {isEditing ? "Atualizar conta a pagar" : "Cadastrar conta a pagar"}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Preencha valor, vencimento e categoria para entrar no controle mensal.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAccount} className="max-h-[calc(92vh-88px)] overflow-y-auto">
                <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
                  <div className="p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="md:col-span-2">
                        <span className="text-sm font-black text-slate-700">
                          Descrição *
                        </span>
                        <input
                          value={form.description}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          placeholder="Ex: Aluguel, energia, imposto, sistema..."
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                        />
                      </label>

                      <label>
                        <span className="text-sm font-black text-slate-700">
                          Categoria
                        </span>
                        <input
                          value={form.category}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              category: event.target.value,
                            }))
                          }
                          placeholder="Ex: Aluguel, água, luz, imposto"
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                        />
                      </label>

                      <label>
                        <span className="text-sm font-black text-slate-700">
                          Fornecedor
                        </span>
                        <select
                          value={form.supplier_id}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              supplier_id: event.target.value,
                            }))
                          }
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                        >
                          <option value="">Sem fornecedor</option>
                          {activeSuppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span className="text-sm font-black text-slate-700">
                          Valor *
                        </span>
                        <input
                          value={form.amount}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              amount: event.target.value,
                            }))
                          }
                          placeholder="0,00"
                          inputMode="decimal"
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                        />
                      </label>

                      <label>
                        <span className="text-sm font-black text-slate-700">
                          Vencimento *
                        </span>
                        <input
                          type="date"
                          value={form.due_date}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              due_date: event.target.value,
                            }))
                          }
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                        />
                      </label>

                      <label>
                        <span className="text-sm font-black text-slate-700">
                          Status
                        </span>
                        <select
                          value={form.status}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              status: event.target.value as PayableStatus,
                            }))
                          }
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                        >
                          <option value="pending">Pendente</option>
                          <option value="paid">Pago</option>
                        </select>
                      </label>

                      <label>
                        <span className="text-sm font-black text-slate-700">
                          Forma de pagamento
                        </span>
                        <select
                          value={form.payment_method}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              payment_method: event.target.value,
                            }))
                          }
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                        >
                          <option value="">Não informado</option>
                          <option value="pix">Pix</option>
                          <option value="dinheiro">Dinheiro</option>
                          <option value="cartao">Cartão</option>
                          <option value="boleto">Boleto</option>
                          <option value="transferencia">Transferência</option>
                        </select>
                      </label>

                      <label className="md:col-span-2">
                        <span className="text-sm font-black text-slate-700">
                          Referência do pagamento
                        </span>
                        <input
                          value={form.payment_reference}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              payment_reference: event.target.value,
                            }))
                          }
                          placeholder="Ex: código do boleto, comprovante, parcela 1/3..."
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                        />
                      </label>

                      <label className="md:col-span-2">
                        <span className="text-sm font-black text-slate-700">
                          Observações
                        </span>
                        <textarea
                          value={form.notes}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              notes: event.target.value,
                            }))
                          }
                          placeholder="Ex: conta parcelada, negociação, vencimento alterado..."
                          rows={4}
                          className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                        />
                      </label>
                    </div>
                  </div>

                  <aside className="border-t border-slate-100 bg-slate-50 p-5 lg:border-l lg:border-t-0">
                    <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-2 text-blue-700">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-600 text-white">
                          <Wallet className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-black uppercase tracking-wide">
                          Resumo
                        </p>
                      </div>

                      <p className="mt-6 text-xs font-black uppercase tracking-wide text-slate-400">
                        Total da conta
                      </p>

                      <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                        {formatCurrency(parseMoney(form.amount))}
                      </p>

                      <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-bold text-slate-500">Vencimento</span>
                          <strong className="font-black text-slate-900">
                            {form.due_date ? formatDate(form.due_date) : "Não informado"}
                          </strong>
                        </div>

                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-bold text-slate-500">Categoria</span>
                          <strong className="max-w-[150px] truncate font-black text-slate-900">
                            {form.category || "Sem categoria"}
                          </strong>
                        </div>

                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-bold text-slate-500">Status</span>
                          <strong
                            className={cn(
                              "rounded-full px-2.5 py-1 text-xs font-black",
                              form.status === "paid"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700",
                            )}
                          >
                            {form.status === "paid" ? "Pago" : "Pendente"}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-3xl border border-orange-100 bg-orange-50 p-5">
                      <p className="text-sm font-black text-orange-800">
                        Uso recomendado
                      </p>
                      <p className="mt-2 text-xs font-semibold leading-relaxed text-orange-700">
                        No começo do mês, lance todas as contas previstas. Depois use
                        “Pagar” conforme for quitando cada uma.
                      </p>
                    </div>
                  </aside>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isEditing ? "Salvar alterações" : "Cadastrar conta"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}