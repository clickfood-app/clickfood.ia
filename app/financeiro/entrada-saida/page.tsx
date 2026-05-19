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
  CalendarDays,
  ClipboardList,
  CreditCard,
  Filter,
  Loader2,
  PlusCircle,
  ReceiptText,
  RefreshCcw,
  Search,
  Trash2,
  Wallet,
} from "lucide-react"

type PeriodKey = "today" | "7d" | "30d" | "month"
type TransactionType = "income" | "expense"
type TypeFilter = "all" | TransactionType

type FinancialTransaction = {
  id: string
  type: TransactionType
  origin: string
  title: string
  description: string | null
  amount: number | string
  category: string | null
  payment_method: string | null
  occurred_at: string
  created_at?: string
}

type TransactionForm = {
  type: TransactionType
  title: string
  description: string
  amount: string
  category: string
  payment_method: string
  occurred_at: string
}

type SummaryItem = {
  label: string
  total: number
  count: number
}

const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month", label: "Mês atual" },
]

const incomeCategories = [
  "Venda manual",
  "Recebimento",
  "Pix avulso",
  "Dinheiro em caixa",
  "Reembolso",
  "Outro",
]

const expenseCategories = [
  "Compra de insumos",
  "Pagamento funcionário",
  "Motoboy",
  "Embalagens",
  "Conta fixa",
  "Manutenção",
  "Marketing",
  "Outro",
]

const paymentMethods = [
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "credit_card", label: "Crédito" },
  { value: "debit_card", label: "Débito" },
  { value: "bank_transfer", label: "Transferência" },
  { value: "other", label: "Outro" },
]

function getLocalDateTimeValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

const emptyForm: TransactionForm = {
  type: "income",
  title: "",
  description: "",
  amount: "",
  category: "Venda manual",
  payment_method: "pix",
  occurred_at: getLocalDateTimeValue(),
}

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

function parseNumber(value: string) {
  return Number(String(value || "0").replace(",", "."))
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

  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

function getPeriodLabel(period: PeriodKey) {
  return periodOptions.find((option) => option.key === period)?.label || "Hoje"
}

function getPaymentMethodLabel(value: string | null) {
  return paymentMethods.find((method) => method.value === value)?.label || "Não informado"
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message

  try {
    return JSON.stringify(error, null, 2)
  } catch {
    return "Erro desconhecido."
  }
}

function buildSummaryByCategory(transactions: FinancialTransaction[]) {
  const map = new Map<string, SummaryItem>()

  for (const transaction of transactions) {
    const label = transaction.category || "Sem categoria"
    const current =
      map.get(label) ??
      ({
        label,
        total: 0,
        count: 0,
      } satisfies SummaryItem)

    current.total += Number(transaction.amount || 0)
    current.count += 1

    map.set(label, current)
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone = "slate",
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  tone?: "slate" | "green" | "red" | "blue" | "amber"
}) {
  const toneClass = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  }[tone]

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{title}</p>

          <p className="mt-2 truncate text-2xl font-black tracking-tight text-slate-950">
            {value}
          </p>

          <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
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

function Panel({
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
        "animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-black tracking-tight text-slate-950">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-sm leading-5 text-slate-500">{subtitle}</p>
          )}
        </div>

        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
      {message}
    </div>
  )
}

function ProgressBar({
  value,
  max,
  tone = "blue",
}: {
  value: number
  max: number
  tone?: "blue" | "green" | "red" | "slate"
}) {
  const width = max <= 0 ? 0 : Math.min(100, (value / max) * 100)

  const toneClass = {
    blue: "bg-blue-600",
    green: "bg-emerald-600",
    red: "bg-red-500",
    slate: "bg-slate-900",
  }[tone]

  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
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

export default function EntradaSaidaPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const [period, setPeriod] = useState<PeriodKey>("today")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [search, setSearch] = useState("")
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [form, setForm] = useState<TransactionForm>(emptyForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  const loadTransactions = useCallback(async () => {
    try {
      setIsLoading(true)

      const resolvedRestaurantId = await resolveRestaurant()
      const startDate = getPeriodStart(period)

      const { data, error } = await supabase
        .from("financial_transactions")
        .select(
          "id, type, origin, title, description, amount, category, payment_method, occurred_at, created_at"
        )
        .eq("restaurant_id", resolvedRestaurantId)
        .gte("occurred_at", startDate)
        .order("occurred_at", { ascending: false })

      if (error) throw error

      setTransactions((data ?? []) as FinancialTransaction[])
    } catch (error) {
      console.error("Erro ao carregar entradas e saídas:", error)

      toast({
        title: "Erro ao carregar entradas e saídas",
        description: getErrorMessage(error),
        variant: "destructive",
      })

      setTransactions([])
    } finally {
      setIsLoading(false)
    }
  }, [period, resolveRestaurant, supabase, toast])

  useEffect(() => {
    void loadTransactions()
  }, [loadTransactions])

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return transactions.filter((transaction) => {
      const matchesType =
        typeFilter === "all" ? true : transaction.type === typeFilter

      const matchesSearch = !normalizedSearch
        ? true
        : [
            transaction.title,
            transaction.description || "",
            transaction.category || "",
            getPaymentMethodLabel(transaction.payment_method),
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch)

      return matchesType && matchesSearch
    })
  }, [transactions, typeFilter, search])

  const incomeTotal = useMemo(() => {
    return transactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
  }, [transactions])

  const expenseTotal = useMemo(() => {
    return transactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
  }, [transactions])

  const balance = incomeTotal - expenseTotal

  const filteredIncomeTotal = useMemo(() => {
    return filteredTransactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
  }, [filteredTransactions])

  const filteredExpenseTotal = useMemo(() => {
    return filteredTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
  }, [filteredTransactions])

  const incomeSummary = useMemo(() => {
    return buildSummaryByCategory(
      transactions.filter((transaction) => transaction.type === "income")
    )
  }, [transactions])

  const expenseSummary = useMemo(() => {
    return buildSummaryByCategory(
      transactions.filter((transaction) => transaction.type === "expense")
    )
  }, [transactions])

  const currentCategoryOptions =
    form.type === "income" ? incomeCategories : expenseCategories

  const handleTypeChange = (type: TransactionType) => {
    setForm((current) => ({
      ...current,
      type,
      category: type === "income" ? incomeCategories[0] : expenseCategories[0],
    }))
  }

  const handleSave = async () => {
    try {
      const resolvedRestaurantId = await resolveRestaurant()
      const title = form.title.trim()
      const amount = parseNumber(form.amount)

      if (!title) {
        toast({
          title: "Informe o título",
          description: "Exemplo: compra de carne, Pix manual, pagamento de motoboy.",
          variant: "destructive",
        })
        return
      }

      if (!amount || amount <= 0 || Number.isNaN(amount)) {
        toast({
          title: "Valor inválido",
          description: "Informe um valor maior que zero.",
          variant: "destructive",
        })
        return
      }

      setIsSaving(true)

      const { error } = await supabase.from("financial_transactions").insert({
        restaurant_id: resolvedRestaurantId,
        type: form.type,
        origin: "manual",
        title,
        description: form.description.trim() || null,
        amount,
        category: form.category || null,
        payment_method: form.payment_method || null,
        occurred_at: form.occurred_at
          ? new Date(form.occurred_at).toISOString()
          : new Date().toISOString(),
      })

      if (error) throw error

      toast({
        title: form.type === "income" ? "Entrada registrada" : "Saída registrada",
        description: "O lançamento foi salvo com sucesso.",
      })

      setForm({
        ...emptyForm,
        type: form.type,
        category: form.type === "income" ? incomeCategories[0] : expenseCategories[0],
        occurred_at: getLocalDateTimeValue(),
      })

      await loadTransactions()
    } catch (error) {
      console.error("Erro ao salvar lançamento:", error)

      toast({
        title: "Erro ao salvar lançamento",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (transactionId: string) => {
    try {
      const resolvedRestaurantId = await resolveRestaurant()

      setDeletingId(transactionId)

      const { error } = await supabase
        .from("financial_transactions")
        .delete()
        .eq("id", transactionId)
        .eq("restaurant_id", resolvedRestaurantId)

      if (error) throw error

      toast({
        title: "Lançamento removido",
        description: "O registro foi excluído com sucesso.",
      })

      await loadTransactions()
    } catch (error) {
      console.error("Erro ao remover lançamento:", error)

      toast({
        title: "Erro ao remover lançamento",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AdminLayout title="Entrada e saída">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Entrada e saída
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Registre movimentações manuais do caixa do restaurante.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {periodOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setPeriod(option.key)}
                className={cn(
                  "h-10 rounded-xl px-4 text-sm font-bold transition",
                  period === option.key
                    ? "bg-slate-950 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                {option.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => void loadTransactions()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando entradas e saídas...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Entradas"
                value={formatCurrency(incomeTotal)}
                subtitle={`Total recebido em ${getPeriodLabel(period).toLowerCase()}`}
                tone="green"
                icon={<ArrowUpRight className="h-5 w-5" />}
              />

              <MetricCard
                title="Saídas"
                value={formatCurrency(expenseTotal)}
                subtitle={`Total gasto em ${getPeriodLabel(period).toLowerCase()}`}
                tone="red"
                icon={<ArrowDownLeft className="h-5 w-5" />}
              />

              <MetricCard
                title="Saldo manual"
                value={formatCurrency(balance)}
                subtitle="Entradas menos saídas"
                tone={balance >= 0 ? "blue" : "red"}
                icon={<Wallet className="h-5 w-5" />}
              />

              <MetricCard
                title="Lançamentos"
                value={String(transactions.length)}
                subtitle="Registros manuais no período"
                tone="slate"
                icon={<ReceiptText className="h-5 w-5" />}
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.9fr_1.3fr]">
              <Panel
                title="Novo lançamento"
                subtitle="Adicione uma entrada ou saída manual"
                icon={<PlusCircle className="h-5 w-5" />}
              >
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => handleTypeChange("income")}
                      className={cn(
                        "h-10 rounded-lg text-sm font-black transition",
                        form.type === "income"
                          ? "bg-white text-emerald-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Entrada
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTypeChange("expense")}
                      className={cn(
                        "h-10 rounded-lg text-sm font-black transition",
                        form.type === "expense"
                          ? "bg-white text-red-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Saída
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Título
                    </label>

                    <input
                      value={form.title}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder={
                        form.type === "income"
                          ? "Ex: Pix manual"
                          : "Ex: compra de carne"
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Valor
                      </label>

                      <input
                        value={form.amount}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            amount: event.target.value,
                          }))
                        }
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Data
                      </label>

                      <input
                        value={form.occurred_at}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            occurred_at: event.target.value,
                          }))
                        }
                        type="datetime-local"
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Categoria
                      </label>

                      <select
                        value={form.category}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            category: event.target.value,
                          }))
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400"
                      >
                        {currentCategoryOptions.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Forma
                      </label>

                      <select
                        value={form.payment_method}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            payment_method: event.target.value,
                          }))
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400"
                      >
                        {paymentMethods.map((method) => (
                          <option key={method.value} value={method.value}>
                            {method.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Observação
                    </label>

                    <textarea
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Opcional"
                      rows={3}
                      className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    />
                  </div>

                  <div
                    className={cn(
                      "rounded-2xl p-4",
                      form.type === "income" ? "bg-emerald-50" : "bg-red-50"
                    )}
                  >
                    <p
                      className={cn(
                        "text-xs font-black uppercase tracking-wide",
                        form.type === "income" ? "text-emerald-700" : "text-red-700"
                      )}
                    >
                      Prévia do lançamento
                    </p>

                    <p
                      className={cn(
                        "mt-1 text-2xl font-black",
                        form.type === "income" ? "text-emerald-700" : "text-red-700"
                      )}
                    >
                      {form.type === "income" ? "+" : "-"}
                      {formatCurrency(parseNumber(form.amount))}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlusCircle className="h-4 w-4" />
                    )}

                    Registrar lançamento
                  </button>
                </div>
              </Panel>

              <Panel
                title="Lançamentos"
                subtitle="Histórico manual do período"
                icon={<ClipboardList className="h-5 w-5" />}
              >
                <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                    <Search className="h-4 w-4 text-slate-400" />

                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar por título, categoria ou forma..."
                      className="h-11 w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                    />
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
                    <Filter className="ml-2 h-4 w-4 text-slate-400" />

                    {[
                      { key: "all", label: "Todos" },
                      { key: "income", label: "Entradas" },
                      { key: "expense", label: "Saídas" },
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setTypeFilter(option.key as TypeFilter)}
                        className={cn(
                          "h-9 rounded-lg px-3 text-xs font-black transition",
                          typeFilter === option.key
                            ? "bg-slate-950 text-white"
                            : "text-slate-500 hover:text-slate-900"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                      Entradas filtradas
                    </p>
                    <p className="mt-1 text-xl font-black text-emerald-700">
                      {formatCurrency(filteredIncomeTotal)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-red-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-red-700">
                      Saídas filtradas
                    </p>
                    <p className="mt-1 text-xl font-black text-red-700">
                      {formatCurrency(filteredExpenseTotal)}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredTransactions.length === 0 ? (
                    <EmptyState message="Nenhum lançamento encontrado." />
                  ) : (
                    filteredTransactions.map((transaction) => {
                      const isIncome = transaction.type === "income"

                      return (
                        <div
                          key={transaction.id}
                          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ring-1",
                                  isIncome
                                    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                                    : "bg-red-50 text-red-700 ring-red-100"
                                )}
                              >
                                {isIncome ? (
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowDownLeft className="h-3.5 w-3.5" />
                                )}
                                {isIncome ? "Entrada" : "Saída"}
                              </span>

                              <p className="font-black text-slate-950">
                                {transaction.title}
                              </p>
                            </div>

                            <p className="mt-1 text-sm font-medium text-slate-500">
                              {transaction.category || "Sem categoria"} •{" "}
                              {getPaymentMethodLabel(transaction.payment_method)} •{" "}
                              {formatDateTime(transaction.occurred_at)}
                            </p>

                            {transaction.description && (
                              <p className="mt-1 text-sm text-slate-500">
                                {transaction.description}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <p
                              className={cn(
                                "rounded-full bg-white px-3 py-1.5 text-sm font-black",
                                isIncome ? "text-emerald-600" : "text-red-600"
                              )}
                            >
                              {isIncome ? "+" : "-"}
                              {formatCurrency(Number(transaction.amount || 0))}
                            </p>

                            <button
                              type="button"
                              onClick={() => void handleDelete(transaction.id)}
                              disabled={deletingId === transaction.id}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label="Remover lançamento"
                            >
                              {deletingId === transaction.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </Panel>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <Panel
                title="Entradas por categoria"
                subtitle="Origem dos valores manuais recebidos"
                icon={<Banknote className="h-5 w-5" />}
              >
                <div className="space-y-4">
                  {incomeSummary.length === 0 ? (
                    <EmptyState message="Nenhuma entrada registrada no período." />
                  ) : (
                    incomeSummary.map((item) => (
                      <div key={item.label}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-800">
                              {item.label}
                            </p>
                            <p className="text-xs font-medium text-slate-500">
                              {item.count} lançamento(s)
                            </p>
                          </div>

                          <p className="text-sm font-black text-emerald-600">
                            {formatCurrency(item.total)}
                          </p>
                        </div>

                        <ProgressBar value={item.total} max={incomeTotal} tone="green" />
                      </div>
                    ))
                  )}
                </div>
              </Panel>

              <Panel
                title="Saídas por categoria"
                subtitle="Onde o dinheiro manual está saindo"
                icon={<CreditCard className="h-5 w-5" />}
              >
                <div className="space-y-4">
                  {expenseSummary.length === 0 ? (
                    <EmptyState message="Nenhuma saída registrada no período." />
                  ) : (
                    expenseSummary.map((item) => (
                      <div key={item.label}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-800">
                              {item.label}
                            </p>
                            <p className="text-xs font-medium text-slate-500">
                              {item.count} lançamento(s)
                            </p>
                          </div>

                          <p className="text-sm font-black text-red-600">
                            {formatCurrency(item.total)}
                          </p>
                        </div>

                        <ProgressBar value={item.total} max={expenseTotal} tone="red" />
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </section>

            <Panel
              title="Leitura rápida do caixa manual"
              subtitle="Resumo simples para entender o período"
              icon={<CalendarDays className="h-5 w-5" />}
            >
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-emerald-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                    Entradas
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-5 text-emerald-700">
                    Use para registrar dinheiro que entrou fora dos pedidos automáticos,
                    como Pix avulso, reembolso ou recebimento manual.
                  </p>
                </div>

                <div className="rounded-xl bg-red-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-red-700">
                    Saídas
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-5 text-red-700">
                    Use para registrar compras, pagamentos, manutenção, motoboy,
                    embalagens e despesas do dia.
                  </p>
                </div>

                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                    Saldo
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-5 text-blue-700">
                    Esse saldo é manual. Ele ajuda no controle do caixa, mas não substitui
                    o relatório financeiro completo.
                  </p>
                </div>
              </div>
            </Panel>
          </>
        )}
      </div>
    </AdminLayout>
  )
}