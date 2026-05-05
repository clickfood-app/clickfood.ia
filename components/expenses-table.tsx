"use client"

import { useMemo, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { computeFinalAmount, type Expense, type Supplier } from "@/lib/finance-data"

type CanonicalPaymentMethod =
  | "pix"
  | "dinheiro"
  | "cartao_credito"
  | "cartao_debito"
  | "boleto"

type UiExpenseStatus = "Pago" | "Pendente"
type CanonicalExpenseStatus = "pago" | "pendente"

type ExpensesTableProps = {
  expenses: Expense[]
  suppliers: Supplier[]
  onCreateExpense: (payload: {
    supplier_id?: string | null
    supplier_name?: string | null
    description: string
    category?: string | null
    amount: number
    discount_percent?: number
    payment_method: CanonicalPaymentMethod
    status: UiExpenseStatus
    issue_date?: string | null
    due_date: string
    paid_at?: string | null
  }) => Promise<void>
  onUpdateExpense: (
    id: string,
    payload: Partial<{
      supplier_id: string | null
      supplier_name: string | null
      description: string
      category: string | null
      amount: number
      discount_percent: number
      payment_method: CanonicalPaymentMethod
      status: UiExpenseStatus
      issue_date: string | null
      due_date: string
      paid_at: string | null
    }>
  ) => Promise<void>
  onDeleteExpense: (id: string) => Promise<void>
}

type FormState = {
  id?: string
  supplier_id: string
  description: string
  category: string
  amount: string
  discount_percent: string
  payment_method: CanonicalPaymentMethod
  status: CanonicalExpenseStatus
  issue_date: string
  due_date: string
}

const PAYMENT_METHOD_OPTIONS: Array<{
  value: CanonicalPaymentMethod
  label: string
}> = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "boleto", label: "Boleto" },
]

const initialForm: FormState = {
  supplier_id: "",
  description: "",
  category: "",
  amount: "",
  discount_percent: "0",
  payment_method: "pix",
  status: "pendente",
  issue_date: "",
  due_date: "",
}

function normalizeText(value: string | null | undefined) {
  return value?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

function normalizePaymentMethod(value: string | null | undefined): CanonicalPaymentMethod {
  const normalized = normalizeText(value)

  const map: Record<string, CanonicalPaymentMethod> = {
    pix: "pix",
    dinheiro: "dinheiro",
    boleto: "boleto",
    cartao_credito: "cartao_credito",
    cartao_debito: "cartao_debito",
    credito: "cartao_credito",
    debito: "cartao_debito",
    "cartao de credito": "cartao_credito",
    "cartao de debito": "cartao_debito",
  }

  return map[normalized ?? ""] ?? "pix"
}

function paymentMethodLabel(value: string | null | undefined) {
  const normalized = normalizePaymentMethod(value)
  const option = PAYMENT_METHOD_OPTIONS.find((item) => item.value === normalized)
  return option?.label ?? "Pix"
}

function normalizeStatus(value: string | null | undefined): CanonicalExpenseStatus {
  const normalized = normalizeText(value)
  return normalized === "pago" ? "pago" : "pendente"
}

function statusLabel(value: string | null | undefined): UiExpenseStatus {
  return normalizeStatus(value) === "pago" ? "Pago" : "Pendente"
}

export default function ExpensesTable({
  expenses,
  suppliers,
  onCreateExpense,
  onUpdateExpense,
  onDeleteExpense,
}: ExpensesTableProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<FormState>(initialForm)

  const sortedExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => b.dueDate.localeCompare(a.dueDate))
  }, [expenses])

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(expense: Expense) {
    const supplierMatch = suppliers.find((supplier) => supplier.name === expense.supplier)

    setEditingId(expense.id)
    setShowForm(true)
    setForm({
      id: expense.id,
      supplier_id: expense.supplier_id || supplierMatch?.id || "",
      description: expense.description || "",
      category: expense.category || "",
      amount: String(expense.amount ?? ""),
      discount_percent: String(expense.discountPercent ?? 0),
      payment_method: normalizePaymentMethod(expense.paymentMethod),
      status: normalizeStatus(expense.status),
      issue_date: expense.issueDate || "",
      due_date: expense.dueDate || "",
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.description.trim()) {
      alert("Informe a descrição da despesa.")
      return
    }

    if (!form.amount || Number(form.amount) <= 0) {
      alert("Informe um valor válido.")
      return
    }

    if (!form.due_date) {
      alert("Informe a data de vencimento.")
      return
    }

    const selectedSupplier = suppliers.find((supplier) => supplier.id === form.supplier_id) || null

    const payload = {
      supplier_id: selectedSupplier?.id ?? null,
      supplier_name: selectedSupplier?.name ?? null,
      description: form.description.trim(),
      category: form.category.trim() || null,
      amount: Number(form.amount),
      discount_percent: Number(form.discount_percent || 0),
      payment_method: form.payment_method,
      status: statusLabel(form.status),
      issue_date: form.issue_date || null,
      due_date: form.due_date,
      paid_at: form.status === "pago" ? new Date().toISOString() : null,
    } as const

    try {
      setLoading(true)

      if (editingId) {
        await onUpdateExpense(editingId, payload)
      } else {
        await onCreateExpense(payload)
      }

      resetForm()
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, description: string) {
    const confirmed = window.confirm(`Deseja excluir a despesa "${description}"?`)
    if (!confirmed) return

    try {
      await onDeleteExpense(id)
    } catch (error) {
      console.error(error)
    }
  }

  async function toggleStatus(expense: Expense) {
    const currentStatus = normalizeStatus(expense.status)
    const newStatus: CanonicalExpenseStatus =
      currentStatus === "pago" ? "pendente" : "pago"

    try {
      await onUpdateExpense(expense.id, {
        status: statusLabel(newStatus),
        paid_at: newStatus === "pago" ? new Date().toISOString() : null,
      })
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Despesas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre e acompanhe os gastos do restaurante.
          </p>
        </div>

        <button
          onClick={() => {
            if (showForm && !editingId) {
              setShowForm(false)
            } else {
              setEditingId(null)
              setForm(initialForm)
              setShowForm(true)
            }
          }}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Nova despesa
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-background/40 p-4 md:grid-cols-2 xl:grid-cols-3"
        >
          <div className="xl:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Descrição
            </label>
            <input
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Ex: Compra de bebidas"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Fornecedor
            </label>
            <select
              value={form.supplier_id}
              onChange={(e) => setForm((prev) => ({ ...prev, supplier_id: e.target.value }))}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            >
              <option value="">Selecione</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Categoria
            </label>
            <input
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="Ex: Insumos"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Valor
            </label>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder="0,00"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Desconto %
            </label>
            <input
              type="number"
              step="0.01"
              value={form.discount_percent}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, discount_percent: e.target.value }))
              }
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Forma de pagamento
            </label>
            <select
              value={form.payment_method}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  payment_method: e.target.value as CanonicalPaymentMethod,
                }))
              }
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            >
              {PAYMENT_METHOD_OPTIONS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  status: e.target.value as CanonicalExpenseStatus,
                }))
              }
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            >
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Data de emissão
            </label>
            <input
              type="date"
              value={form.issue_date}
              onChange={(e) => setForm((prev) => ({ ...prev, issue_date: e.target.value }))}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Data de vencimento
            </label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div className="flex items-end gap-2 xl:col-span-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 items-center rounded-xl bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar despesa"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {sortedExpenses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhuma despesa cadastrada ainda.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Fornecedor</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2">Pagamento</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2">Valor Final</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>

            <tbody>
              {sortedExpenses.map((expense) => {
                const finalAmount = computeFinalAmount(
                  Number(expense.amount),
                  Number(expense.discountPercent || 0)
                )

                return (
                  <tr key={expense.id} className="rounded-xl bg-background/50">
                    <td className="rounded-l-xl px-3 py-3">
                      <div className="font-medium text-foreground">{expense.description}</div>
                    </td>

                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      {expense.supplier || "—"}
                    </td>

                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      {expense.category || "—"}
                    </td>

                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      {paymentMethodLabel(expense.paymentMethod)}
                    </td>

                    <td className="px-3 py-3">
                      <button
                        onClick={() => toggleStatus(expense)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          normalizeStatus(expense.status) === "pago"
                            ? "bg-emerald-500/15 text-emerald-600"
                            : "bg-amber-500/15 text-amber-600"
                        }`}
                      >
                        {statusLabel(expense.status)}
                      </button>
                    </td>

                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      {new Date(`${expense.dueDate}T00:00:00`).toLocaleDateString("pt-BR")}
                    </td>

                    <td className="px-3 py-3 text-sm font-semibold text-foreground">
                      {finalAmount.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>

                    <td className="rounded-r-xl px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(expense)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleDelete(expense.id, expense.description)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/30 text-red-500 transition-colors hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}