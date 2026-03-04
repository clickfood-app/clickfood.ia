"use client"

import { Eye } from "lucide-react"
import { type Order, STATUS_CONFIG, formatBRL, formatDate } from "@/lib/orders-data"
import { cn } from "@/lib/utils"

interface OrdersTableProps {
  orders: Order[]
  loading: boolean
  onViewDetails: (order: Order) => void
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-border last:border-0">
          {Array.from({ length: 7 }).map((__, j) => (
            <td key={j} className="px-4 py-3.5">
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export default function OrdersTable({ orders, loading, onViewDetails }: OrdersTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                ID
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cliente
              </th>
              <th className="hidden px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                Telefone
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="hidden px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                Pagamento
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total
              </th>
              <th className="hidden px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                Data
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Acoes
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows />
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <p className="text-sm font-medium text-muted-foreground">Nenhum pedido encontrado</p>
                  <p className="mt-1 text-xs text-muted-foreground">Tente ajustar os filtros de busca</p>
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const statusCfg = STATUS_CONFIG[order.status]
                return (
                  <tr
                    key={order.id}
                    className="group cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                    onClick={() => onViewDetails(order)}
                  >
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-semibold text-[hsl(var(--primary))]">{order.id}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-medium text-card-foreground">{order.clientName}</span>
                    </td>
                    <td className="hidden px-4 py-3.5 md:table-cell">
                      <span className="text-sm text-muted-foreground">{order.clientPhone}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold",
                          statusCfg.className
                        )}
                      >
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3.5 lg:table-cell">
                      <span className="text-sm text-muted-foreground">{order.paymentMethod}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-semibold tabular-nums text-card-foreground">
                        {formatBRL(order.total)}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3.5 sm:table-cell">
                      <span className="text-sm text-muted-foreground">{formatDate(order.date)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewDetails(order)
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))]"
                        aria-label={`Ver detalhes do pedido ${order.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
