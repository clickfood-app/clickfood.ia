"use client"

import { useState, useMemo, useEffect } from "react"
import { Filter, X } from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import FinanceSummary from "@/components/finance-summary"
import ExpensesTable from "@/components/expenses-table"
import CashFlowChart from "@/components/cash-flow-chart"
import SupplierManager from "@/components/supplier-manager"
import TopSuppliersPanel from "@/components/top-suppliers-panel"
import {
  initialExpenses,
  initialSuppliers,
  dailyFinanceData,
  SUPPLIERS,
  PAYMENT_METHODS,
  computeFinalAmount,
  type Expense,
  type Supplier,
} from "@/lib/finance-data"
import { cn } from "@/lib/utils"

// Pre-computed static totals to avoid hydration mismatch
const STATIC_TOTAL_INCOME = 124840
// Pre-computed: sum of computeFinalAmount for all initialExpenses
const STATIC_TOTAL_EXPENSES = 6092.9

export default function FinanceiroPage() {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Filters
  const [filterSupplier, setFilterSupplier] = useState("")
  const [filterPayment, setFilterPayment] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  const hasActiveFilters =
    filterSupplier || filterPayment || filterStatus || filterDateFrom || filterDateTo

  function clearFilters() {
    setFilterSupplier("")
    setFilterPayment("")
    setFilterStatus("")
    setFilterDateFrom("")
    setFilterDateTo("")
  }

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (filterSupplier && e.supplier !== filterSupplier) return false
      if (filterPayment && e.paymentMethod !== filterPayment) return false
      if (filterStatus && e.status !== filterStatus) return false
      if (filterDateFrom && e.dueDate < filterDateFrom) return false
      if (filterDateTo && e.dueDate > filterDateTo) return false
      return true
    })
  }, [expenses, filterSupplier, filterPayment, filterStatus, filterDateFrom, filterDateTo])

  // Use static values for initial render to avoid hydration mismatch
  // After mount, dynamic calculations are safe
  const totalIncome = STATIC_TOTAL_INCOME
  
  const dynamicExpensesAmount = useMemo(() => {
    return filteredExpenses.reduce(
      (s, e) => s + computeFinalAmount(e.amount, e.discountPercent),
      0
    )
  }, [filteredExpenses])
  
  // Use static value before mount to prevent hydration mismatch
  const totalExpensesAmount = mounted ? dynamicExpensesAmount : STATIC_TOTAL_EXPENSES

  return (
    <AdminLayout>
      <div className="min-h-screen">
        <div className="p-8">
          {/* Page title */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-foreground tracking-tight text-balance">
              Controle Financeiro
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie entradas, saídas e acompanhe o fluxo de caixa do seu restaurante.
            </p>
          </div>

          {/* Summary cards */}
          <FinanceSummary
            totalIncome={totalIncome}
            totalExpenses={totalExpensesAmount}
          />

          {/* Cash flow chart */}
          <div className="mt-8">
            <CashFlowChart data={dailyFinanceData} />
          </div>

          {/* Suppliers section: manager + top 3 side by side */}
          <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <SupplierManager
                suppliers={suppliers}
                expenses={expenses}
                onUpdateSuppliers={setSuppliers}
              />
            </div>
            <div>
              <TopSuppliersPanel expenses={expenses} />
            </div>
          </div>

          {/* Filters */}
          <div className="mt-8">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
                  showFilters || hasActiveFilters
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/0.08] text-[hsl(var(--primary))]"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Filter className="h-4 w-4" />
                Filtros
                {hasActiveFilters && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[10px] font-bold text-[hsl(var(--primary-foreground))]">
                    {[filterSupplier, filterPayment, filterStatus, filterDateFrom, filterDateTo].filter(Boolean).length}
                  </span>
                )}
              </button>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpar
                </button>
              )}
            </div>

            {showFilters && (
              <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
                {/* Supplier */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Fornecedor
                  </label>
                  <select
                    value={filterSupplier}
                    onChange={(e) => setFilterSupplier(e.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  >
                    <option value="">Todos</option>
                    {SUPPLIERS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment method */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Forma de Pagamento
                  </label>
                  <select
                    value={filterPayment}
                    onChange={(e) => setFilterPayment(e.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  >
                    <option value="">Todas</option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  >
                    <option value="">Todos</option>
                    <option value="Pago">Pago</option>
                    <option value="Pendente">Pendente</option>
                  </select>
                </div>

                {/* Date from */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    De
                  </label>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </div>

                {/* Date to */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Até
                  </label>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Expenses table */}
          <ExpensesTable expenses={filteredExpenses} onUpdate={setExpenses} />
        </div>
      </div>
    </AdminLayout>
  )
}
