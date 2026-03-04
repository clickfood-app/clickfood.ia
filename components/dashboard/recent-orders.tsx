"use client"

import { Clock, ArrowRight } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { formatBRL, type RecentOrder } from "@/lib/dashboard-data"

const statusConfig: Record<RecentOrder["status"], { label: string; bg: string; text: string }> = {
  pendente: { label: "Pendente", bg: "bg-amber-100", text: "text-amber-700" },
  em_preparo: { label: "Preparando", bg: "bg-blue-100", text: "text-blue-700" },
  pronto: { label: "Pronto", bg: "bg-emerald-100", text: "text-emerald-700" },
  entregue: { label: "Entregue", bg: "bg-muted", text: "text-muted-foreground" },
  cancelado: { label: "Cancelado", bg: "bg-red-100", text: "text-red-700" },
}

export default function RecentOrders({ orders }: { orders: RecentOrder[] }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-card-foreground">Pedidos Recentes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Atualizacao em tempo real</p>
        </div>
        <Link
          href="/pedidos"
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary))]/10"
        >
          Ver todos <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="divide-y divide-border">
        {orders.map((order) => {
          const s = statusConfig[order.status]
          return (
            <div key={order.id} className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted/30">
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-card-foreground">{order.id}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", s.bg, s.text)}>
                      {s.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">{order.customer}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <span className="text-sm font-bold text-card-foreground tabular-nums">{formatBRL(order.total)}</span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {order.minutesAgo}min
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
