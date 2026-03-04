"use client"

import { Award, Trophy } from "lucide-react"
import type { Expense } from "@/lib/finance-data"
import { computeFinalAmount, formatBRL } from "@/lib/finance-data"
import { cn } from "@/lib/utils"

interface TopSuppliersPanelProps {
  expenses: Expense[]
}

const MEDAL_STYLES = [
  {
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-500 text-white",
    barColor: "bg-amber-400",
    label: "1o",
  },
  {
    bg: "bg-slate-50",
    border: "border-slate-200",
    badge: "bg-slate-400 text-white",
    barColor: "bg-slate-300",
    label: "2o",
  },
  {
    bg: "bg-orange-50",
    border: "border-orange-200",
    badge: "bg-orange-400 text-white",
    barColor: "bg-orange-300",
    label: "3o",
  },
]

export default function TopSuppliersPanel({ expenses }: TopSuppliersPanelProps) {
  // Calculate total per supplier
  const supplierTotals = new Map<string, number>()
  for (const expense of expenses) {
    const finalAmount = computeFinalAmount(expense.amount, expense.discountPercent)
    supplierTotals.set(
      expense.supplier,
      (supplierTotals.get(expense.supplier) || 0) + finalAmount
    )
  }

  // Sort by total descending and take top 3
  const sorted = Array.from(supplierTotals.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)

  // Total expenses for percentage calculation
  const totalExpenses = expenses.reduce(
    (s, e) => s + computeFinalAmount(e.amount, e.discountPercent),
    0
  )

  const maxTotal = sorted.length > 0 ? sorted[0].total : 0

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border px-6 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
          <Trophy className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Top 3 Fornecedores
          </h2>
          <p className="text-sm text-muted-foreground">
            Maior volume de gastos no periodo
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Award className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">Sem dados de fornecedores</p>
            <p className="mt-1 text-xs">
              O ranking aparecera quando houver gastos cadastrados.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((supplier, index) => {
              const style = MEDAL_STYLES[index]
              const percentage = totalExpenses > 0
                ? ((supplier.total / totalExpenses) * 100).toFixed(1)
                : "0.0"
              const barWidth = maxTotal > 0
                ? Math.max((supplier.total / maxTotal) * 100, 8)
                : 0

              return (
                <div
                  key={supplier.name}
                  className={cn(
                    "rounded-lg border p-4 transition-shadow hover:shadow-sm",
                    style.bg,
                    style.border
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                          style.badge
                        )}
                      >
                        {style.label}
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          {supplier.name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {percentage}% das saidas totais
                        </p>
                      </div>
                    </div>
                    <span className="text-base font-bold tabular-nums text-foreground">
                      {formatBRL(supplier.total)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/5">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", style.barColor)}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
