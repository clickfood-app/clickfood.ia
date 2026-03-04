"use client"

import { ShoppingCart, DollarSign, TrendingUp, XCircle } from "lucide-react"
import { type OrderSummary, formatBRL } from "@/lib/orders-data"

interface SummaryCardsProps {
  summary: OrderSummary
  loading: boolean
}

export default function OrderSummaryCards({ summary, loading }: SummaryCardsProps) {
  const cards = [
    {
      label: "Total de Pedidos",
      value: summary.totalOrders.toLocaleString("pt-BR"),
      icon: <ShoppingCart className="h-5 w-5" />,
      color: "text-[hsl(var(--primary))]",
      bgIcon: "bg-[hsl(var(--primary))]/10",
    },
    {
      label: "Total Faturado",
      value: formatBRL(summary.totalRevenue),
      icon: <DollarSign className="h-5 w-5" />,
      color: "text-green-600",
      bgIcon: "bg-green-100",
    },
    {
      label: "Ticket Medio",
      value: formatBRL(summary.averageTicket),
      icon: <TrendingUp className="h-5 w-5" />,
      color: "text-[hsl(var(--primary))]",
      bgIcon: "bg-[hsl(var(--primary))]/10",
    },
    {
      label: "Cancelamentos",
      value: summary.cancelledCount.toString(),
      icon: <XCircle className="h-5 w-5" />,
      color: "text-red-600",
      bgIcon: "bg-red-100",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {card.label}
            </p>
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bgIcon} ${card.color}`}>
              {card.icon}
            </div>
          </div>
          {loading ? (
            <div className="h-7 w-24 animate-pulse rounded bg-muted" />
          ) : (
            <p className={`text-xl font-bold tabular-nums ${card.color}`}>
              {card.value}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
