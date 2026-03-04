"use client"

import { memo } from "react"
import { Inbox } from "lucide-react"
import type { KanbanOrder } from "@/components/order-card"
import OrderCard from "@/components/order-card"

interface KanbanColumnProps {
  title: string
  headerColor: string
  count: number
  orders: KanbanOrder[]
  exitingIds: Set<string>
  renderActions: (order: KanbanOrder) => {
    label: string
    color: string
    onClick: (prepTime?: number) => void
  }[]
  onViewDetails?: (order: KanbanOrder) => void
  onAssignDelivery?: (order: KanbanOrder) => void
}

function KanbanColumnComponent({
  title,
  headerColor,
  count,
  orders,
  exitingIds,
  renderActions,
  onViewDetails,
  onAssignDelivery,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden min-w-[280px]">
      {/* Column header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ backgroundColor: headerColor }}
      >
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">
          {title}
        </h2>
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white/20 px-2 text-xs font-bold text-white tabular-nums">
          {count}
        </span>
      </div>

      {/* Cards area */}
      <div className="space-y-3 p-3">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Inbox className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm font-medium">Nenhum pedido</p>
            <p className="text-xs mt-0.5">Os pedidos aparecerao aqui</p>
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              actions={renderActions(order)}
              isExiting={exitingIds.has(order.id)}
              onViewDetails={onViewDetails}
              onAssignDelivery={onAssignDelivery}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default memo(KanbanColumnComponent)
