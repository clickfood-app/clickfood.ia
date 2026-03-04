"use client"

import { Filter, X } from "lucide-react"
import {
  type OrderFilters,
  DEFAULT_FILTERS,
  ALL_STATUSES,
  ALL_PAYMENT_METHODS,
  STATUS_CONFIG,
} from "@/lib/orders-data"

interface OrderFiltersProps {
  filters: OrderFilters
  onChange: (filters: OrderFilters) => void
  loading: boolean
}

export default function OrderFiltersPanel({ filters, onChange, loading }: OrderFiltersProps) {
  const hasFilters =
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.status !== "all" ||
    filters.paymentMethod !== "all" ||
    filters.minValue !== "" ||
    filters.maxValue !== ""

  function update(partial: Partial<OrderFilters>) {
    onChange({ ...filters, ...partial })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-[hsl(var(--primary))]" />
        <h3 className="text-sm font-semibold text-card-foreground">Filtros Avancados</h3>
        {loading && (
          <div className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Date from */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Data Inicial
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => update({ dateFrom: e.target.value })}
            className="input-field"
          />
        </div>

        {/* Date to */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Data Final
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => update({ dateTo: e.target.value })}
            className="input-field"
          />
        </div>

        {/* Status */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => update({ status: e.target.value as OrderFilters["status"] })}
            className="input-field"
          >
            <option value="all">Todos</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
        </div>

        {/* Payment Method */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pagamento
          </label>
          <select
            value={filters.paymentMethod}
            onChange={(e) => update({ paymentMethod: e.target.value as OrderFilters["paymentMethod"] })}
            className="input-field"
          >
            <option value="all">Todos</option>
            {ALL_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Min value */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Valor Minimo
          </label>
          <input
            type="number"
            placeholder="R$ 0,00"
            value={filters.minValue}
            onChange={(e) => update({ minValue: e.target.value })}
            className="input-field"
            min={0}
          />
        </div>

        {/* Max value */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Valor Maximo
          </label>
          <input
            type="number"
            placeholder="R$ 999,00"
            value={filters.maxValue}
            onChange={(e) => update({ maxValue: e.target.value })}
            className="input-field"
            min={0}
          />
        </div>
      </div>

      {/* Action buttons */}
      {hasFilters && (
        <div className="mt-4 flex items-center justify-end">
          <button
            onClick={() => onChange({ ...DEFAULT_FILTERS, search: filters.search })}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  )
}
