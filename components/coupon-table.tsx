"use client"

import {
  Calendar,
  PauseCircle,
  PlayCircle,
  Trash2,
} from "lucide-react"
import { formatBRL } from "@/lib/coupons-data"
import { cn } from "@/lib/utils"

type CouponStatus = "ativo" | "pausado" | "expirado"
type CouponType = "manual" | "automatico" | "relampago" | "campanha" | "exclusivo"
type DiscountType = "percentual" | "fixo"

export type CouponTableCoupon = {
  id: string
  name: string
  code: string
  type: CouponType
  discountType: DiscountType
  discountValue: number
  minOrder: number
  maxUses: number
  maxPerClient: number
  usedCount: number
  status: CouponStatus
  createdAt: string
  expiresAt: string
  revenueGenerated: number
}

interface CouponTableProps {
  coupons: CouponTableCoupon[]
  onToggleStatus: (id: string) => void
  onDelete: (id: string) => void
}

function statusBadge(status: CouponStatus) {
  switch (status) {
    case "ativo":
      return "bg-emerald-100 text-emerald-700"
    case "pausado":
      return "bg-amber-100 text-amber-700"
    case "expirado":
      return "bg-red-100 text-red-700"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function typeLabel(type: CouponType) {
  switch (type) {
    case "manual":
      return "Manual"
    case "automatico":
      return "Automático"
    case "relampago":
      return "Relâmpago"
    case "campanha":
      return "Campanha"
    case "exclusivo":
      return "Exclusivo"
    default:
      return type
  }
}

function discountLabel(coupon: CouponTableCoupon) {
  if (coupon.discountType === "percentual") {
    return `${coupon.discountValue}% OFF`
  }

  return `${formatBRL(coupon.discountValue)} OFF`
}

export default function CouponTable({
  coupons,
  onToggleStatus,
  onDelete,
}: CouponTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="min-w-full">
        <thead className="border-b border-border bg-muted/40">
          <tr className="text-left">
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cupom
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tipo
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Desconto
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Uso
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Validade
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ações
            </th>
          </tr>
        </thead>

        <tbody>
          {coupons.map((coupon) => (
            <tr key={coupon.id} className="border-b border-border last:border-0">
              <td className="px-4 py-4">
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">{coupon.name}</span>
                  <span className="text-sm text-muted-foreground">{coupon.code}</span>
                </div>
              </td>

              <td className="px-4 py-4">
                <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                  {typeLabel(coupon.type)}
                </span>
              </td>

              <td className="px-4 py-4">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {discountLabel(coupon)}
                  </span>
                  {coupon.minOrder > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Mínimo: {formatBRL(coupon.minOrder)}
                    </span>
                  )}
                </div>
              </td>

              <td className="px-4 py-4">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {coupon.usedCount}
                    {coupon.maxUses > 0 ? ` / ${coupon.maxUses}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Máx. por cliente: {coupon.maxPerClient}
                  </span>
                </div>
              </td>

              <td className="px-4 py-4">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{coupon.expiresAt || "Sem expiração"}</span>
                </div>
              </td>

              <td className="px-4 py-4">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                    statusBadge(coupon.status)
                  )}
                >
                  {coupon.status}
                </span>
              </td>

              <td className="px-4 py-4">
                <div className="flex justify-end gap-2">
                  {coupon.status !== "expirado" && (
                    <button
                      onClick={() => onToggleStatus(coupon.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                    >
                      {coupon.status === "ativo" ? (
                        <>
                          <PauseCircle className="h-4 w-4" />
                          Pausar
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-4 w-4" />
                          Ativar
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => onDelete(coupon.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {coupons.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhum cupom encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}