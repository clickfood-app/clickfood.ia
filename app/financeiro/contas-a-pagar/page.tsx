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
  Plus,
  ReceiptText,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type PayableStatus = "pending" | "paid" | "overdue" | "canceled"
type VisualStatus = "pending" | "paid" | "overdue" | "canceled"
type StatusFilter = "all" | VisualStatus
type PeriodFilter = "all" | "today" | "next7" | "month" | "overdue"

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

const emptyForm: PayableForm = {
  supplier_id: "",
  description: "",
  category: "",
  amount: "0",
  due_date: today,
  payment_method: "",
  payment_reference: "",
  status: "pending",
  notes: "",
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function parseMoney(value: string) {
  const normalized = value.replace(",", ".")
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

function getCurrentMonthRange() {
  const base = new Date(`${today}T00:00:00`)
  const start = new Date(base.getFullYear(), base.getMonth(), 1)
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0)

  return {
    start: getLocalDateString(start),
    end: getLocalDateString(end),
  }
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

  if (visualStatus === "paid") {
    return account.paid_at ? "Quitado" : "Pago"
  }

  if (visualStatus === "canceled") {
    return "Cancelado"
  }

  const days = getDaysDifference(account.due_date)

  if (days < 0) {
    const absDays = Math.abs(days)
    return `${absDays} ${absDays === 1 ? "dia" : "dias"} atrasado`
  }

  if (days === 0) return "Vence hoje"
  if (days === 1) return "Vence amanhã"
  if (days <= 7) return `Vence em ${days} dias`

  return `Vence em ${days} dias`
}

function getStatusBadgeClass(status: VisualStatus) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 ring-emerald-500/10"
  }

  if (status === "overdue") {
    return "border-red-200 bg-red-50 text-red-700 ring-red-500/10"
  }

  if (status === "canceled") {
    return "border-slate-200 bg-slate-100 text-slate-500 ring-slate-500/10"
  }

  return "border-amber-200 bg-amber-50 text-amber-700 ring-amber-500/10"
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
      card: "from-blue-50 via-white to-white border-blue-100",
      icon: "bg-blue-600 text-white shadow-blue-600/20",
      subtitle: "text-blue-700",
    },
    orange: {
      card: "from-orange-50 via-white to-white border-orange-100",
      icon: "bg-orange-500 text-white shadow-orange-500/20",
      subtitle: "text-orange-700",
    },
    red: {
      card: "from-red-50 via-white to-white border-red-100",
      icon: "bg-red-500 text-white shadow-red-500/20",
      subtitle: "text-red-700",
    },
    slate: {
      card: "from-slate-50 via-white to-white border-slate-200",
      icon: "bg-slate-800 text-white shadow-slate-800/20",
      subtitle: "text-slate-500",
    },
    emerald: {
      card: "from-emerald-50 via-white to-white border-emerald-100",
      icon: "bg-emerald-500 text-white shadow-emerald-500/20",
      subtitle: "text-emerald-700",
    },
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-3xl border bg-gradient-to-br p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl",
        toneClasses[tone].card,
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/70 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
            {title}
          </p>

          <p className="mt-4 text-2xl font-black tracking-tight text-slate-950">
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

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all")
  const [supplierFilter, setSupplierFilter] = useState("all")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<PayableForm>(emptyForm)

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

  const totals = useMemo(() => {
    const monthRange = getCurrentMonthRange()
    const nextSevenDays = addDaysToDateString(today, 7)

    const openAccounts = accounts.filter((account) => {
      const visualStatus = getVisualStatus(account)
      return visualStatus === "pending" || visualStatus === "overdue"
    })

    const overdueAccounts = accounts.filter(
      (account) => getVisualStatus(account) === "overdue",
    )

    const dueTodayAccounts = accounts.filter((account) => {
      const visualStatus = getVisualStatus(account)
      return visualStatus === "pending" && account.due_date === today
    })

    const nextSevenDaysAccounts = accounts.filter((account) => {
      const visualStatus = getVisualStatus(account)
      return (
        visualStatus === "pending" &&
        account.due_date > today &&
        account.due_date <= nextSevenDays
      )
    })

    const paidThisMonthAccounts = accounts.filter((account) => {
      const visualStatus = getVisualStatus(account)
      const paidDate = account.paid_at?.slice(0, 10)

      return (
        visualStatus === "paid" &&
        !!paidDate &&
        paidDate >= monthRange.start &&
        paidDate <= monthRange.end
      )
    })

    const monthOpenAccounts = accounts.filter((account) => {
      const visualStatus = getVisualStatus(account)

      return (
        (visualStatus === "pending" || visualStatus === "overdue") &&
        account.due_date >= monthRange.start &&
        account.due_date <= monthRange.end
      )
    })

    return {
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
      paidThisMonthAmount: paidThisMonthAccounts.reduce(
        (sum, account) => sum + Number(account.amount || 0),
        0,
      ),
      monthOpenAmount: monthOpenAccounts.reduce(
        (sum, account) => sum + Number(account.amount || 0),
        0,
      ),
    }
  }, [accounts])

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLowerCase()
    const nextSevenDays = addDaysToDateString(today, 7)
    const monthRange = getCurrentMonthRange()

    return accounts.filter((account) => {
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

      const matchesSupplier =
        supplierFilter === "all" || account.supplier_id === supplierFilter

      const matchesPeriod =
        periodFilter === "all" ||
        (periodFilter === "today" && account.due_date === today) ||
        (periodFilter === "next7" &&
          account.due_date >= today &&
          account.due_date <= nextSevenDays) ||
        (periodFilter === "month" &&
          account.due_date >= monthRange.start &&
          account.due_date <= monthRange.end) ||
        (periodFilter === "overdue" && visualStatus === "overdue")

      return matchesSearch && matchesStatus && matchesSupplier && matchesPeriod
    })
  }, [accounts, search, statusFilter, supplierFilter, periodFilter])

  const hasFilters =
    search.trim().length > 0 ||
    statusFilter !== "all" ||
    supplierFilter !== "all" ||
    periodFilter !== "all"

  function clearFilters() {
    setSearch("")
    setStatusFilter("all")
    setSupplierFilter("all")
    setPeriodFilter("all")
  }

  function openCreateModal() {
    setForm(emptyForm)
    setIsModalOpen(true)
    setError(null)
  }

  function closeModal() {
    if (saving) return

    setIsModalOpen(false)
    setForm(emptyForm)
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
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

    const payload = {
      restaurant_id: restaurantId,
      supplier_id: form.supplier_id || null,
      description: form.description.trim(),
      category: onlyFilled(form.category),
      amount,
      due_date: form.due_date,
      paid_at: form.status === "paid" ? new Date().toISOString() : null,
      payment_method: onlyFilled(form.payment_method),
      payment_reference: onlyFilled(form.payment_reference),
      status: form.status,
      notes: onlyFilled(form.notes),
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

  return (
  <AdminLayout>
    <div className="min-h-screen bg-[#f4f7fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <div className="flex items-center gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
        <ReceiptText className="h-6 w-6" />
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">
            Financeiro
          </span>

          <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 sm:inline-flex">
            Operacional
          </span>
        </div>

        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
          Contas a Pagar
        </h1>

        <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-500">
          Controle vencimentos, fornecedores, contas manuais e compras pendentes.
        </p>
      </div>
    </div>

    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Em aberto
        </p>
        <p className="mt-0.5 text-sm font-black text-slate-950">
          {formatCurrency(totals.openAmount)}
        </p>
      </div>

      <button
        type="button"
        onClick={openCreateModal}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Nova conta
      </button>
    </div>
  </div>
</section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            title="Em aberto"
            value={formatCurrency(totals.openAmount)}
            subtitle={`${totals.openCount} ${totals.openCount === 1 ? "conta" : "contas"}`}
            icon={<ReceiptText className="h-5 w-5" />}
            tone="blue"
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
            title="Próximos 7 dias"
            value={formatCurrency(totals.nextSevenDaysAmount)}
            subtitle={`${totals.nextSevenDaysCount} ${totals.nextSevenDaysCount === 1 ? "conta próxima" : "contas próximas"}`}
            icon={<Clock3 className="h-5 w-5" />}
            tone="slate"
          />

          <MetricCard
            title="Pago no mês"
            value={formatCurrency(totals.paidThisMonthAmount)}
            subtitle="quitado neste mês"
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="emerald"
          />
        </div>

        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur">
          <div className="border-b border-slate-100 bg-white px-5 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Filter className="h-4 w-4" />
                  </div>

                  <div>
                    <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-900">
                      Filtros e vencimentos
                    </h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      Encontre rapidamente o que precisa ser pago, quitado ou revisado.
                    </p>
                  </div>
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

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_0.8fr_0.8fr_1fr]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por conta, fornecedor, categoria..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
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
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="all">Todos os períodos</option>
                <option value="today">Vence hoje</option>
                <option value="next7">Próximos 7 dias</option>
                <option value="month">Este mês</option>
                <option value="overdue">Atrasadas</option>
              </select>

              <select
                value={supplierFilter}
                onChange={(event) => setSupplierFilter(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="all">Todos os fornecedores</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="mx-5 mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[340px] items-center justify-center">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-500 shadow-sm">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando contas...
              </div>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="flex min-h-[340px] flex-col items-center justify-center p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                <ReceiptText className="h-8 w-8" />
              </div>

              <h3 className="mt-5 text-lg font-black text-slate-950">
                Nenhuma conta encontrada
              </h3>

              <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
                Cadastre contas manuais ou registre compras pendentes de fornecedores para aparecerem aqui.
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-5 py-4">Vencimento</th>
                    <th className="px-5 py-4">Conta</th>
                    <th className="px-5 py-4">Fornecedor</th>
                    <th className="px-5 py-4">Pagamento</th>
                    <th className="px-5 py-4">Valor</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Origem</th>
                    <th className="px-5 py-4 text-right">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredAccounts.map((account) => {
                    const visualStatus = getVisualStatus(account)
                    const isActionLoading = actionLoadingId === account.id
                    const isDueToday = visualStatus === "pending" && account.due_date === today

                    return (
                      <tr
                        key={account.id}
                        className={cn(
                          "group transition",
                          visualStatus === "overdue" && "bg-red-50/35 hover:bg-red-50/70",
                          isDueToday && "bg-amber-50/40 hover:bg-amber-50/80",
                          visualStatus === "paid" && "hover:bg-emerald-50/35",
                          visualStatus === "canceled" && "bg-slate-50/80 opacity-75 hover:bg-slate-100/70",
                          visualStatus === "pending" && !isDueToday && "hover:bg-blue-50/25",
                        )}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <span
                              className={cn(
                                "mt-1 h-12 w-1.5 rounded-full",
                                getDueToneClass(account),
                              )}
                            />

                            <div>
                              <p className="text-sm font-black text-slate-950">
                                {formatShortDate(account.due_date)}
                              </p>

                              <p
                                className={cn(
                                  "mt-1 text-xs font-black",
                                  visualStatus === "overdue" && "text-red-600",
                                  isDueToday && "text-amber-600",
                                  visualStatus === "paid" && "text-emerald-600",
                                  visualStatus === "canceled" && "text-slate-400",
                                  visualStatus === "pending" && !isDueToday && "text-blue-600",
                                )}
                              >
                                {getDueLabel(account)}
                              </p>

                              {account.paid_at && (
                                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                                  Pago em{" "}
                                  {new Intl.DateTimeFormat("pt-BR").format(
                                    new Date(account.paid_at),
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="max-w-[280px] truncate text-sm font-black text-slate-950">
                            {account.description}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {account.category && (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-500">
                                {account.category}
                              </span>
                            )}

                            {account.notes && (
                              <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-600">
                                tem observação
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="max-w-[180px] truncate text-sm font-bold text-slate-700">
                            {account.suppliers?.name || "Não informado"}
                          </p>

                          {account.suppliers?.category && (
                            <p className="mt-1 max-w-[180px] truncate text-xs font-semibold text-slate-400">
                              {account.suppliers.category}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm font-black text-slate-700">
                            {getPaymentMethodLabel(account.payment_method)}
                          </p>

                          {account.payment_reference && (
                            <p className="mt-1 max-w-[180px] truncate text-xs font-semibold text-slate-400">
                              {account.payment_reference}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-base font-black tracking-tight text-slate-950">
                            {formatCurrency(Number(account.amount || 0))}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wide shadow-sm ring-4",
                              getStatusBadgeClass(visualStatus),
                            )}
                          >
                            {getStatusLabel(visualStatus)}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wide",
                              account.purchase_id
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-slate-50 text-slate-500",
                            )}
                          >
                            {account.purchase_id ? "Compra" : "Manual"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            {visualStatus !== "paid" && visualStatus !== "canceled" && (
                              <button
                                type="button"
                                onClick={() => markAsPaid(account)}
                                disabled={isActionLoading}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-black text-emerald-700 transition hover:-translate-y-0.5 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isActionLoading && (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                )}
                                Marcar pago
                              </button>
                            )}

                            {visualStatus !== "canceled" && visualStatus !== "paid" && (
                              <button
                                type="button"
                                onClick={() => cancelAccount(account)}
                                disabled={isActionLoading}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Cancelar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredAccounts.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4 text-xs font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Exibindo {filteredAccounts.length} de {accounts.length} contas.
              </span>

              <span>
                Em aberto no mês:{" "}
                <strong className="font-black text-slate-950">
                  {formatCurrency(totals.monthOpenAmount)}
                </strong>
              </span>
            </div>
          )}
        </section>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-950/30">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-500">
                  Nova conta
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-950">
                  Cadastrar conta a pagar
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="max-h-[calc(92vh-74px)] overflow-y-auto">
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
                        placeholder="Ex: Aluguel, energia, fornecedor de bebidas..."
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
                        placeholder="Ex: Fornecedor, aluguel, imposto"
                        className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                      />
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
                        placeholder="Ex: código do comprovante, boleto, observação..."
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
                        placeholder="Observações sobre vencimento, negociação, parcelamento..."
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

                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-bold text-slate-500">Pagamento</span>
                        <strong className="font-black text-slate-900">
                          {getPaymentMethodLabel(form.payment_method)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-3xl border border-orange-100 bg-orange-50 p-5">
                    <p className="text-sm font-black text-orange-800">
                      Controle operacional
                    </p>
                    <p className="mt-2 text-xs font-semibold leading-relaxed text-orange-700">
                      Contas pendentes entram nos alertas de vencimento e ajudam o restaurante a prever saída de caixa.
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
                  Cadastrar conta
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