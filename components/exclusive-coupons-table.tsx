"use client"

import {
  Calendar,
  RotateCcw,
  Trash2,
  User,
} from "lucide-react"
import { formatBRL } from "@/lib/coupons-data"
import { cn } from "@/lib/utils"

type CouponStatus = "ativo" | "pausado" | "expirado"
type DiscountType = "percentual" | "fixo"
type ExclusiveReason =
  | "fidelidade"
  | "pedido_cancelado"
  | "cliente_vip"
  | "recuperacao_inativo"
  | "manual"

type SendChannel = "whatsapp" | "notificacao" | "email"

export type ExclusiveCouponsTableCoupon = {
  id: string
  clientId: string
  clientName: string
  code: string
  discountType: DiscountType
  discountValue: number
  minOrder: number
  maxUses: number
  usedCount: number
  reason: ExclusiveReason
  status: CouponStatus
  createdAt: string
  expiresAt: string
  sendChannels: SendChannel[]
  revenueGenerated: number
}

interface ExclusiveCouponsTableProps {
  coupons: ExclusiveCouponsTableCoupon[]
  onDelete: (id: string) => void
  onResend: (id: string) => void
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

function reasonLabel(reason: ExclusiveReason) {
  switch (reason) {
    case "fidelidade":
      return "Fidelidade"
    case "pedido_cancelado":
      return "Pedido cancelado"
    case "cliente_vip":
      return "Cliente VIP"
    case "recuperacao_inativo":
      return "Recuperação"
    case "manual":
      return "Manual"
    default:
      return reason
  }
}

function discountLabel(coupon: ExclusiveCouponsTableCoupon) {
  if (coupon.discountType === "percentual") {
    return `${coupon.discountValue}% OFF`
  }

  return `${formatBRL(coupon.discountValue)} OFF`
}

export default function ExclusiveCouponsTable({
  coupons,
  onDelete,
  onResend,
}: ExclusiveCouponsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="min-w-full">
        <thead className="border-b border-border bg-muted/40">
          <tr className="text-left">
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cliente
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cupom
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Motivo
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
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">
                      {coupon.clientName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {coupon.clientId || "Cliente sem ID"}
                    </span>
                  </div>
                </div>
              </td>

              <td className="px-4 py-4">
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">{coupon.code}</span>
                  <span className="text-sm text-muted-foreground">
                    {discountLabel(coupon)}
                  </span>
                </div>
              </td>

              <td className="px-4 py-4">
                <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                  {reasonLabel(coupon.reason)}
                </span>
              </td>

              <td className="px-4 py-4">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {coupon.usedCount}
                    {coupon.maxUses > 0 ? ` / ${coupon.maxUses}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Canais: {coupon.sendChannels.join(", ") || "—"}
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
                  <button
                    onClick={() => onResend(coupon.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reenviar
                  </button>

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
                Nenhum cupom exclusivo encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}