"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowDownCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
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

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  cancelled: "Cancelado",
}

const statusStyles: Record<string, string> = {
  pending: "bg-orange-100 text-orange-700",
  paid: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-600",
}

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

  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
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
  }).format(new Date(`${value}T00:00:00`))
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

function isOverdue(expense: AccountPayable) {
  return expense.status === "pending" && expense.due_date < todayDate()
}

export default function DespesasPage() {
  const supabase = createClient()

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<AccountPayable[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [startDate, setStartDate] = useState(currentMonthStart())
  const [endDate, setEndDate] = useState(currentMonthEnd())
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [search, setSearch] = useState("")

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

      const matchesSearch =
        !term ||
        expense.description.toLowerCase().includes(term) ||
        expense.category?.toLowerCase().includes(term) ||
        expense.notes?.toLowerCase().includes(term)

      return matchesStatus && matchesSearch
    })
  }, [expenses, search, statusFilter])

  const totals = useMemo(() => {
    return filteredExpenses.reduce(
      (acc, expense) => {
        const value = toNumber(expense.amount)

        if (expense.status === "paid") {
          acc.paid += value
          acc.paidCount += 1
        }

        if (expense.status === "pending") {
          acc.pending += value
          acc.pendingCount += 1
        }

        if (isOverdue(expense)) {
          acc.overdue += value
          acc.overdueCount += 1
        }

        acc.total += value

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
      },
    )
  }, [filteredExpenses])

  const totalsByCategory = useMemo(() => {
    const grouped = filteredExpenses.reduce<Record<string, number>>((acc, expense) => {
      const key = expense.category || "Sem categoria"
      acc[key] = (acc[key] || 0) + toNumber(expense.amount)
      return acc
    }, {})

    return Object.entries(grouped)
      .map(([categoryName, total]) => ({
        category: categoryName,
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [filteredExpenses])

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

      const { startIso, endIso } = getDateRange(startDate, endDate)

      const { data, error } = await supabase
        .from("accounts_payable")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .gte("due_date", startDate)
        .lte("due_date", endDate)
        .order("due_date", { ascending: true })
        .order("created_at", { ascending: false })

      if (error) throw error

      setExpenses(
        (data || []).map((expense) => ({
          ...expense,
          amount: toNumber(expense.amount),
        })),
      )
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

  function clearForm() {
    setEditingId(null)
    setDescription("")
    setCategory("")
    setAmount("")
    setDueDate(todayDate())
    setPaymentMethod("")
    setPaymentReference("")
    setStatus("pending")
    setNotes("")
  }

  function handleEdit(expense: AccountPayable) {
    setEditingId(expense.id)
    setDescription(expense.description)
    setCategory(expense.category || "")
    setAmount(String(expense.amount || ""))
    setDueDate(expense.due_date)
    setPaymentMethod(expense.payment_method || "")
    setPaymentReference(expense.payment_reference || "")
    setStatus((expense.status as ExpenseStatus) || "pending")
    setNotes(expense.notes || "")
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

      clearForm()
      await loadData()
    } catch (error: any) {
      console.error("Erro ao salvar despesa:", error)
      alert(error?.message || "Não foi possível salvar a despesa.")
    } finally {
      setSaving(false)
    }
  }

  async function markAsPaid(expense: AccountPayable) {
    if (!restaurantId) return

    try {
      setUpdatingId(expense.id)

      const { error } = await supabase
        .from("accounts_payable")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", expense.id)
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

  async function cancelExpense(expense: AccountPayable) {
    if (!restaurantId) return

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
        .eq("id", expense.id)
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

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              <ArrowDownCircle className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-xl font-semibold text-slate-950">Despesas</h1>
              <p className="text-sm text-slate-500">
                Controle contas a pagar, vencimentos e despesas do restaurante.
              </p>
            </div>
          </div>

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
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total no período</p>
            <strong className="mt-1 block text-2xl font-semibold text-slate-950">
              {formatCurrency(totals.total)}
            </strong>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Pago</p>
            <strong className="mt-1 block text-2xl font-semibold text-emerald-600">
              {formatCurrency(totals.paid)}
            </strong>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Pendente</p>
            <strong className="mt-1 block text-2xl font-semibold text-orange-600">
              {formatCurrency(totals.pending)}
            </strong>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Vencido</p>
            <strong className="mt-1 block text-2xl font-semibold text-red-600">
              {formatCurrency(totals.overdue)}
            </strong>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Contas pendentes</p>
            <strong className="mt-1 block text-2xl font-semibold text-slate-950">
              {totals.pendingCount}
            </strong>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
          <div className="space-y-5">
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-950">
                    {editingId ? "Editar despesa" : "Nova despesa"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Lance despesas manuais ou contas a pagar.
                  </p>
                </div>

                {editingId && (
                  <Button type="button" variant="outline" size="sm" onClick={clearForm}>
                    Nova
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Ex: Aluguel, energia, fornecedor..."
                    required
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Categoria</Label>
                    <Input
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      placeholder="Ex: Fornecedor"
                    />
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
                </div>

                <div className="grid gap-3 md:grid-cols-2">
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
                </div>

                <div className="grid gap-3 md:grid-cols-2">
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
                </div>

                <div className="space-y-1.5">
                  <Label>Observação</Label>
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Detalhes da despesa..."
                    rows={3}
                  />
                </div>

                <Button type="submit" disabled={saving} className="w-full gap-2">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {editingId ? "Salvar alterações" : "Cadastrar despesa"}
                </Button>
              </div>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-4 font-semibold text-slate-950">
                Maiores categorias
              </h2>

              {totalsByCategory.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  Nenhuma categoria no período.
                </div>
              ) : (
                <div className="space-y-2">
                  {totalsByCategory.map((item) => (
                    <div
                      key={item.category}
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                    >
                      <span className="text-sm font-medium text-slate-700">
                        {item.category}
                      </span>
                      <strong className="text-slate-950">
                        {formatCurrency(item.total)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 grid gap-3 md:grid-cols-[1fr_160px_160px_160px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar despesa..."
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
                  <option value="all">Todos</option>
                  <option value="pending">Pendentes</option>
                  <option value="paid">Pagas</option>
                  <option value="cancelled">Canceladas</option>
                </select>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando despesas...
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center">
                  <ArrowDownCircle className="mx-auto h-9 w-9 text-slate-300" />
                  <p className="mt-2 font-medium text-slate-800">
                    Nenhuma despesa encontrada
                  </p>
                  <p className="text-sm text-slate-500">
                    Lance uma despesa ou ajuste os filtros.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="max-h-[640px] overflow-auto">
                    <table className="w-full min-w-[940px] text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Despesa</th>
                          <th className="px-4 py-3">Categoria</th>
                          <th className="px-4 py-3">Vencimento</th>
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
                                {isOverdue(expense) && (
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

                            <td className="px-4 py-3 text-slate-700">
                              {expense.category || "Sem categoria"}
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 text-slate-700">
                                {isOverdue(expense) ? (
                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                ) : (
                                  <CalendarClock className="h-4 w-4 text-slate-400" />
                                )}
                                {formatDate(expense.due_date)}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-1 text-xs font-medium",
                                  statusStyles[expense.status] ||
                                    "bg-slate-100 text-slate-600",
                                )}
                              >
                                {statusLabels[expense.status] || expense.status}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-slate-500">
                              {expense.status === "paid" ? (
                                <span>
                                  {expense.payment_method || "Método não informado"}
                                  {expense.paid_at
                                    ? ` • ${formatDateTime(expense.paid_at)}`
                                    : ""}
                                </span>
                              ) : (
                                "Ainda não pago"
                              )}
                            </td>

                            <td className="px-4 py-3 text-right font-semibold text-orange-600">
                              {formatCurrency(expense.amount)}
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                {expense.status === "pending" && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => markAsPaid(expense)}
                                    disabled={updatingId === expense.id}
                                    className="gap-2"
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
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
              <div className="flex gap-2">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <strong>Atenção:</strong> despesas cadastradas aqui também entram no
                  Caixa do Dia quando forem marcadas como pagas, desde que o pagamento
                  aconteça na data selecionada do caixa.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}