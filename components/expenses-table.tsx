"use client"

import { useState } from "react"
import {
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
  Percent,
} from "lucide-react"
import type {
  Expense,
  PaymentMethod,
  ExpenseStatus,
} from "@/lib/finance-data"
import {
  SUPPLIERS,
  PAYMENT_METHODS,
  computeFinalAmount,
  formatBRL,
} from "@/lib/finance-data"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/format-date"

interface ExpensesTableProps {
  expenses: Expense[]
  onUpdate: (expenses: Expense[]) => void
}

function generateId() {
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const emptyExpense: Omit<Expense, "id"> = {
  supplier: "",
  description: "",
  amount: 0,
  paymentMethod: "Pix",
  dueDate: new Date().toISOString().split("T")[0],
  status: "Pendente",
  discountPercent: 0,
}

export default function ExpensesTable({ expenses, onUpdate }: ExpensesTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Expense | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [newExpense, setNewExpense] = useState<Omit<Expense, "id">>(emptyExpense)
  // Supplier-level discount
  const [supplierDiscount, setSupplierDiscount] = useState<{ supplier: string; percent: number } | null>(null)

  // ── Inline edit ──
  function startEdit(expense: Expense) {
    setEditingId(expense.id)
    setEditData({ ...expense })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditData(null)
  }

  function saveEdit() {
    if (!editData) return
    onUpdate(expenses.map((e) => (e.id === editData.id ? editData : e)))
    setEditingId(null)
    setEditData(null)
  }

  // ── Add row ──
  function confirmAdd() {
    if (!newExpense.supplier || !newExpense.description || newExpense.amount <= 0) return
    const created: Expense = { ...newExpense, id: generateId() }
    onUpdate([created, ...expenses])
    setNewExpense(emptyExpense)
    setIsAdding(false)
  }

  function cancelAdd() {
    setIsAdding(false)
    setNewExpense(emptyExpense)
  }

  // ── Delete ──
  function deleteExpense(id: string) {
    onUpdate(expenses.filter((e) => e.id !== id))
  }

  // ── Apply supplier-level discount ──
  function applySupplierDiscount() {
    if (!supplierDiscount || supplierDiscount.percent <= 0) return
    const updated = expenses.map((e) => {
      if (e.supplier === supplierDiscount.supplier) {
        return { ...e, discountPercent: supplierDiscount.percent }
      }
      return e
    })
    onUpdate(updated)
    setSupplierDiscount(null)
  }

  const totalOriginal = expenses.reduce((s, e) => s + e.amount, 0)
  const totalFinal = expenses.reduce(
    (s, e) => s + computeFinalAmount(e.amount, e.discountPercent),
    0
  )
  const totalSaved = totalOriginal - totalFinal

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Planilha de Gastos
          </h2>
          <p className="text-sm text-muted-foreground">
            Controle de saídas com edição inline
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Supplier discount handler */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5">
            <Percent className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={supplierDiscount?.supplier ?? ""}
              onChange={(e) =>
                setSupplierDiscount({
                  supplier: e.target.value,
                  percent: supplierDiscount?.percent ?? 0,
                })
              }
              className="h-7 rounded border-0 bg-transparent text-xs text-foreground outline-none"
            >
              <option value="">Fornecedor</option>
              {SUPPLIERS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              max={100}
              placeholder="%"
              value={supplierDiscount?.percent ?? ""}
              onChange={(e) =>
                setSupplierDiscount({
                  supplier: supplierDiscount?.supplier ?? "",
                  percent: Number(e.target.value),
                })
              }
              className="h-7 w-14 rounded border border-border bg-background px-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
            <button
              onClick={applySupplierDiscount}
              disabled={!supplierDiscount?.supplier || !supplierDiscount?.percent}
              className="flex h-7 items-center rounded bg-[hsl(var(--primary))] px-2.5 text-xs font-medium text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Aplicar
            </button>
          </div>

          <button
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Fornecedor</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Desc. %</th>
              <th className="px-4 py-3">Final</th>
              <th className="px-4 py-3">Pagamento</th>
              <th className="px-4 py-3">Prazo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {/* Add row */}
            {isAdding && (
              <tr className="border-b border-border bg-[hsl(var(--primary))/0.04]">
                <td className="px-4 py-2">
                  <select
                    value={newExpense.supplier}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, supplier: e.target.value })
                    }
                    className="h-8 w-full rounded border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  >
                    <option value="">Selecionar</option>
                    {SUPPLIERS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    value={newExpense.description}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, description: e.target.value })
                    }
                    placeholder="Descrição"
                    className="h-8 w-full rounded border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={newExpense.amount || ""}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, amount: Number(e.target.value) })
                    }
                    placeholder="0,00"
                    className="h-8 w-24 rounded border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={newExpense.discountPercent || ""}
                    onChange={(e) =>
                      setNewExpense({
                        ...newExpense,
                        discountPercent: Number(e.target.value),
                      })
                    }
                    placeholder="0"
                    className="h-8 w-16 rounded border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </td>
                <td className="px-4 py-2 text-xs font-medium text-foreground">
                  {formatBRL(
                    computeFinalAmount(newExpense.amount, newExpense.discountPercent)
                  )}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={newExpense.paymentMethod}
                    onChange={(e) =>
                      setNewExpense({
                        ...newExpense,
                        paymentMethod: e.target.value as PaymentMethod,
                      })
                    }
                    className="h-8 rounded border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="date"
                    value={newExpense.dueDate}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, dueDate: e.target.value })
                    }
                    className="h-8 rounded border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={newExpense.status}
                    onChange={(e) =>
                      setNewExpense({
                        ...newExpense,
                        status: e.target.value as ExpenseStatus,
                      })
                    }
                    className="h-8 rounded border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Pago">Pago</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={confirmAdd}
                      className="flex h-7 w-7 items-center justify-center rounded text-green-600 transition-colors hover:bg-green-50"
                      aria-label="Confirmar"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={cancelAdd}
                      className="flex h-7 w-7 items-center justify-center rounded text-red-500 transition-colors hover:bg-red-50"
                      aria-label="Cancelar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* Data rows */}
            {expenses.map((expense) => {
              const isEditing = editingId === expense.id
              const row = isEditing && editData ? editData : expense
              const finalAmount = computeFinalAmount(row.amount, row.discountPercent)

              return (
                <tr
                  key={expense.id}
                  className={cn(
                    "border-b border-border last:border-b-0 transition-colors",
                    isEditing
                      ? "bg-[hsl(var(--primary))/0.04]"
                      : "hover:bg-muted/50"
                  )}
                >
                  {/* Supplier */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        value={editData!.supplier}
                        onChange={(e) =>
                          setEditData({ ...editData!, supplier: e.target.value })
                        }
                        className="h-8 w-full rounded border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                      >
                        {SUPPLIERS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm font-medium text-foreground">
                        {row.supplier}
                      </span>
                    )}
                  </td>

                  {/* Description */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        value={editData!.description}
                        onChange={(e) =>
                          setEditData({ ...editData!, description: e.target.value })
                        }
                        className="h-8 w-full rounded border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {row.description}
                      </span>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={editData!.amount}
                        onChange={(e) =>
                          setEditData({
                            ...editData!,
                            amount: Number(e.target.value),
                          })
                        }
                        className="h-8 w-24 rounded border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                      />
                    ) : (
                      <span className="text-sm text-foreground">
                        {formatBRL(row.amount)}
                      </span>
                    )}
                  </td>

                  {/* Discount % */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editData!.discountPercent}
                        onChange={(e) =>
                          setEditData({
                            ...editData!,
                            discountPercent: Number(e.target.value),
                          })
                        }
                        className="h-8 w-16 rounded border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                      />
                    ) : row.discountPercent > 0 ? (
                      <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        -{row.discountPercent}%
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>

                  {/* Final */}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        row.discountPercent > 0
                          ? "text-green-600"
                          : "text-foreground"
                      )}
                    >
                      {formatBRL(finalAmount)}
                    </span>
                  </td>

                  {/* Payment method */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        value={editData!.paymentMethod}
                        onChange={(e) =>
                          setEditData({
                            ...editData!,
                            paymentMethod: e.target.value as PaymentMethod,
                          })
                        }
                        className="h-8 rounded border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {row.paymentMethod}
                      </span>
                    )}
                  </td>

                  {/* Due date */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="date"
                        value={editData!.dueDate}
                        onChange={(e) =>
                          setEditData({ ...editData!, dueDate: e.target.value })
                        }
                        className="h-8 rounded border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {formatDate(row.dueDate)}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        value={editData!.status}
                        onChange={(e) =>
                          setEditData({
                            ...editData!,
                            status: e.target.value as ExpenseStatus,
                          })
                        }
                        className="h-8 rounded border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                      >
                        <option value="Pago">Pago</option>
                        <option value="Pendente">Pendente</option>
                      </select>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          row.status === "Pago"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        )}
                      >
                        {row.status}
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {isEditing ? (
                        <>
                          <button
                            onClick={saveEdit}
                            className="flex h-7 w-7 items-center justify-center rounded text-green-600 transition-colors hover:bg-green-50"
                            aria-label="Salvar"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex h-7 w-7 items-center justify-center rounded text-red-500 transition-colors hover:bg-red-50"
                            aria-label="Cancelar"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(expense)}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteExpense(expense.id)}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                            aria-label="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer totals */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-4">
        <div className="flex items-center gap-6 text-sm">
          <span className="text-muted-foreground">
            {expenses.length} registro(s)
          </span>
          {totalSaved > 0 && (
            <span className="flex items-center gap-1.5 text-green-600">
              <Percent className="h-3.5 w-3.5" />
              Economia total: {formatBRL(totalSaved)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Original</p>
            <p className="text-sm font-medium text-foreground">
              {formatBRL(totalOriginal)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Com desconto</p>
            <p className="text-sm font-bold text-[hsl(var(--primary))]">
              {formatBRL(totalFinal)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
