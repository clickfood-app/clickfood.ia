"use client"

import { useState } from "react"
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Copy,
  Megaphone,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Search,
  Tag,
  Trash2,
  UserCheck,
  Zap,
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
import type { Coupon, CouponType, CouponStatus } from "@/lib/coupons-data"
import { couponTypeLabels, formatBRL } from "@/lib/coupons-data"

interface CouponTableProps {
  coupons: Coupon[]
  onToggleStatus: (id: string) => void
  onDelete: (id: string) => void
}

const typeIcons: Record<CouponType, React.ReactNode> = {
  manual: <Tag className="h-3.5 w-3.5" />,
  automatico: <Bot className="h-3.5 w-3.5" />,
  relampago: <Zap className="h-3.5 w-3.5" />,
  campanha: <Megaphone className="h-3.5 w-3.5" />,
  exclusivo: <UserCheck className="h-3.5 w-3.5" />,
}

const statusConfig: Record<CouponStatus, { label: string; classes: string }> = {
  ativo: { label: "Ativo", classes: "bg-green-100 text-green-700" },
  pausado: { label: "Pausado", classes: "bg-amber-100 text-amber-700" },
  expirado: { label: "Expirado", classes: "bg-red-100 text-red-700" },
}

type SortField = "name" | "usedCount" | "discountValue" | "expiresAt"

export default function CouponTable({ coupons, onToggleStatus, onDelete }: CouponTableProps) {
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<CouponType | "all">("all")
  const [filterStatus, setFilterStatus] = useState<CouponStatus | "all">("all")
  const [sortField, setSortField] = useState<SortField>("name")
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
      const matchSearch = c.name.toLowerCase().includes(q) || (c.code?.toLowerCase().includes(q) ?? false)
      const matchType = filterType === "all" || c.type === filterType
      const matchStatus = filterStatus === "all" || c.status === filterStatus
      return matchSearch && matchType && matchStatus
    })
    .sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "name": cmp = a.name.localeCompare(b.name); break
        case "usedCount": cmp = a.usedCount - b.usedCount; break
        case "discountValue": cmp = a.discountValue - b.discountValue; break
        case "expiresAt": cmp = a.expiresAt.localeCompare(b.expiresAt); break
      }
      return sortDir === "desc" ? -cmp : cmp
    })

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou codigo..."
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as CouponType | "all")}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="all">Todos os tipos</option>
          <option value="manual">Manual</option>
          <option value="automatico">Automatico</option>
          <option value="relampago">Relampago</option>
          <option value="campanha">Campanha</option>
          <option value="exclusivo">Exclusivo</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as CouponStatus | "all")}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="all">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="pausado">Pausados</option>
          <option value="expirado">Expirados</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <button onClick={() => toggleSort("name")} className="flex items-center gap-1">
                  Cupom <SortIcon field="name" />
                </button>
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tipo
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <button onClick={() => toggleSort("discountValue")} className="flex items-center gap-1">
                  Desconto <SortIcon field="discountValue" />
                </button>
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <button onClick={() => toggleSort("usedCount")} className="flex items-center gap-1">
                  Usos <SortIcon field="usedCount" />
                </button>
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <button onClick={() => toggleSort("expiresAt")} className="flex items-center gap-1">
                  Validade <SortIcon field="expiresAt" />
                </button>
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Acoes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  Nenhum cupom encontrado
                </td>
              </tr>
            )}
            {filtered.map((coupon) => {
              const st = statusConfig[coupon.status]
              const usagePercent = coupon.maxUses > 0 ? Math.round((coupon.usedCount / coupon.maxUses) * 100) : null
              return (
                <tr key={coupon.id} className="transition-colors hover:bg-muted/30">
                  {/* Name + code */}
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">{coupon.name}</p>
                      {coupon.code && (
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                            {coupon.code}
                          </code>
                          <button
                            onClick={() => navigator.clipboard.writeText(coupon.code || "")}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Copiar codigo"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      {!coupon.code && (
                        <p className="mt-0.5 text-xs text-muted-foreground italic">Sem codigo</p>
                      )}
                    </div>
                  </td>
                  {/* Type */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-blue-600">
                        {typeIcons[coupon.type]}
                      </span>
                      <span className="text-sm text-card-foreground">{couponTypeLabels[coupon.type]}</span>
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
                  {/* Usage */}
                  <td className="px-5 py-3.5">
                    <div>
                      <span className="text-sm font-semibold text-card-foreground tabular-nums">
                        {coupon.usedCount}
                      </span>
                      {coupon.maxUses > 0 && (
                        <span className="text-sm text-muted-foreground">/{coupon.maxUses}</span>
                      )}
                      {usagePercent !== null && (
                        <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              usagePercent >= 90 ? "bg-red-500" : usagePercent >= 70 ? "bg-amber-500" : "bg-[hsl(var(--primary))]"
                            )}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  {/* Expiry */}
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-card-foreground tabular-nums">
                      {formatDate(coupon.expiresAt)}
                    </span>
                  </td>
                  {/* Status toggle */}
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => coupon.status !== "expirado" && onToggleStatus(coupon.id)}
                      disabled={coupon.status === "expirado"}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity",
                        st.classes,
                        coupon.status === "expirado" ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:opacity-80"
                      )}
                    >
                      <span className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        coupon.status === "ativo" ? "bg-green-500" : coupon.status === "pausado" ? "bg-amber-500" : "bg-red-500"
                      )} />
                      {st.label}
                    </button>
                  </td>
                  {/* Actions */}
                  <td className="px-5 py-3.5 text-right">
                    {confirmDelete === coupon.id ? (
                      <div className="flex items-center justify-end gap-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
                        <span className="text-xs text-red-600 font-medium">Remover?</span>
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
                          {coupon.status !== "expirado" && (
                            <DropdownMenuItem onClick={() => onToggleStatus(coupon.id)} className="cursor-pointer gap-2">
                              {coupon.status === "ativo" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                              {coupon.status === "ativo" ? "Pausar" : "Ativar"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setConfirmDelete(coupon.id)}
                            className="cursor-pointer gap-2 text-muted-foreground focus:text-red-600 focus:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Excluir
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
