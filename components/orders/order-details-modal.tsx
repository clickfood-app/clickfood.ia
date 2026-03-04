"use client"

import { X, Package, User, Phone, CreditCard, Calendar } from "lucide-react"
import {
  type Order,
  type OrderStatus,
  STATUS_CONFIG,
  ALL_STATUSES,
  formatBRL,
  formatDate,
} from "@/lib/orders-data"
import { cn } from "@/lib/utils"

interface OrderDetailsModalProps {
  order: Order
  onClose: () => void
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void
}

export default function OrderDetailsModal({ order, onClose, onStatusChange }: OrderDetailsModalProps) {
  const statusCfg = STATUS_CONFIG[order.status]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-card-foreground">Pedido {order.id}</h3>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold",
                  statusCfg.className
                )}
              >
                {statusCfg.label}
              </span>
              <span className="text-xs text-muted-foreground">{formatDate(order.date)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Client info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Cliente</p>
                <p className="text-sm font-medium text-card-foreground">{order.clientName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Telefone</p>
                <p className="text-sm font-medium text-card-foreground">{order.clientPhone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Pagamento</p>
                <p className="text-sm font-medium text-card-foreground">{order.paymentMethod}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Horario</p>
                <p className="text-sm font-medium text-card-foreground">
                  {order.createdAt.split("T")[1]?.slice(0, 5) || "---"}
                </p>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-[hsl(var(--primary))]" />
              <p className="text-xs font-semibold text-card-foreground uppercase tracking-wide">Itens do Pedido</p>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Produto
                    </th>
                    <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Qtd
                    </th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Unitario
                    </th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => (
                    <tr key={idx} className="border-t border-border">
                      <td className="px-3 py-2.5 text-sm text-card-foreground">{item.name}</td>
                      <td className="px-3 py-2.5 text-center text-sm tabular-nums text-muted-foreground">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-right text-sm tabular-nums text-muted-foreground">{formatBRL(item.unitPrice)}</td>
                      <td className="px-3 py-2.5 text-right text-sm font-medium tabular-nums text-card-foreground">{formatBRL(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/20">
                    <td colSpan={3} className="px-3 py-3 text-right text-sm font-bold text-card-foreground">
                      Total
                    </td>
                    <td className="px-3 py-3 text-right text-base font-bold tabular-nums text-[hsl(var(--primary))]">
                      {formatBRL(order.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Change status */}
          <div>
            <p className="mb-2 text-xs font-semibold text-card-foreground uppercase tracking-wide">Alterar Status</p>
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map((s) => {
                const cfg = STATUS_CONFIG[s]
                const isActive = order.status === s
                return (
                  <button
                    key={s}
                    onClick={() => !isActive && onStatusChange(order.id, s)}
                    disabled={isActive}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                      isActive
                        ? cn(cfg.className, "ring-2 ring-offset-1 ring-current")
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-[hsl(var(--primary))] px-5 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
