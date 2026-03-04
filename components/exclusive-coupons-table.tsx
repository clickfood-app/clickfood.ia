"use client"

import { useState } from "react"
import {
  Copy,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/format-date"
import type { ExclusiveCoupon, ExclusiveReason, CouponStatus } from "@/lib/coupons-data"
import { exclusiveReasonLabels, formatBRL } from "@/lib/coupons-data"

interface ExclusiveCouponsTableProps {
  coupons: ExclusiveCoupon[]
  onDelete: (id: string) => void
  onResend: (id: string) => void
}

const reasonColors: Record<ExclusiveReason, string> = {
  fidelidade: "bg-blue-100 text-blue-700",
  pedido_cancelado: "bg-red-100 text-red-700",
  cliente_vip: "bg-amber-100 text-amber-700",
  recuperacao_inativo: "bg-green-100 text-green-700",
  manual: "bg-muted text-muted-foreground",
}

const statusConfig: Record<CouponStatus, { label: string; classes: string }> = {
  ativo: { label: "Ativo", classes: "bg-green-100 text-green-700" },
  pausado: { label: "Pausado", classes: "bg-amber-100 text-amber-700" },
  expirado: { label: "Expirado", classes: "bg-red-100 text-red-700" },
}

type SortField = "clientName" | "discountValue" | "expiresAt"

export default function ExclusiveCouponsTable({ coupons, onDelete, onResend }: ExclusiveCouponsTableProps) {
  const [search, setSearch] = useState("")
  const [filterReason, setFilterReason] = useState<ExclusiveReason | "all">("all")
  const [sortField, setSortField] = useState<SortField>("clientName")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 opacity-30" />
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
  }

  const filtered = coupons
    .filter((c) => {
      const q = search.toLowerCase()
      const matchSearch = c.clientName.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
      const matchReason = filterReason === "all" || c.reason === filterReason
      return matchSearch && matchReason
    })
    .sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "clientName": cmp = a.clientName.localeCompare(b.clientName); break
        case "discountValue": cmp = a.discountValue - b.discountValue; break
        case "expiresAt": cmp = a.expiresAt.localeCompare(b.expiresAt); break
      }
      return sortDir === "desc" ? -cmp : cmp
    })

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <UserCheck className="h-5 w-5 text-[hsl(var(--primary))]" />
        <h3 className="text-sm font-bold text-card-foreground">Cupons Personalizados</h3>
        <span className="ml-1 rounded-full bg-[hsl(var(--primary))]/10 px-2 py-0.5 text-xs font-semibold text-[hsl(var(--primary))]">
          {coupons.length}
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente ou codigo..."
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
          />
        </div>
        <select
          value={filterReason}
          onChange={(e) => setFilterReason(e.target.value as ExclusiveReason | "all")}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="all">Todos os motivos</option>
          {Object.entries(exclusiveReasonLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <button onClick={() => toggleSort("clientName")} className="flex items-center gap-1">
                  Cliente <SortIcon field="clientName" />
                </button>
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Codigo
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <button onClick={() => toggleSort("discountValue")} className="flex items-center gap-1">
                  Desconto <SortIcon field="discountValue" />
                </button>
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Motivo
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Utilizado
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <button onClick={() => toggleSort("expiresAt")} className="flex items-center gap-1">
                  Validade <SortIcon field="expiresAt" />
                </button>
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Acoes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  Nenhum cupom exclusivo encontrado
                </td>
              </tr>
            )}
            {filtered.map((coupon) => {
              const st = statusConfig[coupon.status]
              const used = coupon.usedCount > 0
              return (
                <tr key={coupon.id} className="transition-colors hover:bg-muted/30">
                  {/* Client */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-xs font-bold text-[hsl(var(--primary))]">
                        {coupon.clientName.split(" ").map(n => n[0]).join("").slice(0,2)}
                      </div>
                      <span className="text-sm font-semibold text-card-foreground">{coupon.clientName}</span>
                    </div>
                  </td>
                  {/* Code */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                        {coupon.code}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(coupon.code)}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="Copiar codigo"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  {/* Discount */}
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-semibold text-card-foreground">
                      {coupon.discountType === "percentual" ? `${coupon.discountValue}%` : formatBRL(coupon.discountValue)}
                    </span>
                    {coupon.minOrder > 0 && (
                      <p className="text-xs text-muted-foreground">Min. {formatBRL(coupon.minOrder)}</p>
                    )}
                  </td>
                  {/* Reason */}
                  <td className="px-5 py-3.5">
                    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", reasonColors[coupon.reason])}>
                      {exclusiveReasonLabels[coupon.reason]}
                    </span>
                  </td>
                  {/* Status */}
                  <td className="px-5 py-3.5">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", st.classes)}>
                      <span className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        coupon.status === "ativo" ? "bg-green-500" : coupon.status === "pausado" ? "bg-amber-500" : "bg-red-500"
                      )} />
                      {st.label}
                    </span>
                  </td>
                  {/* Used */}
                  <td className="px-5 py-3.5">
                    <span className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      used ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                    )}>
                      {used ? "Sim" : "Nao"}
                    </span>
                  </td>
                  {/* Expiry */}
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-card-foreground tabular-nums">
                      {formatDate(coupon.expiresAt)}
                    </span>
                  </td>
                  {/* Actions */}
                  <td className="px-5 py-3.5 text-right">
                    {confirmDelete === coupon.id ? (
                      <div className="flex items-center justify-end gap-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
                        <span className="text-xs text-red-600 font-medium">Cancelar cupom?</span>
                        <button
                          onClick={() => { onDelete(coupon.id); setConfirmDelete(null) }}
                          className="rounded-md bg-red-500 px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90"
                        >
                          Sim
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                        >
                          Nao
                        </button>
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem className="cursor-pointer gap-2">
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </DropdownMenuItem>
                          {coupon.status === "ativo" && (
                            <DropdownMenuItem onClick={() => onResend(coupon.id)} className="cursor-pointer gap-2">
                              <RefreshCw className="h-3.5 w-3.5" /> Reenviar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setConfirmDelete(coupon.id)}
                            className="cursor-pointer gap-2 text-muted-foreground focus:text-red-600 focus:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Cancelar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
