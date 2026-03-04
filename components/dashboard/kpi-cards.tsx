"use client"

import {
  DollarSign,
  ShoppingCart,
  Receipt,
  Loader2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatBRL, type DashboardKPIs } from "@/lib/dashboard-data"

interface KPICard {
  label: string
  value: string
  variation: number
  icon: React.ReactNode
  iconBg: string
  isAlert?: boolean
}

function buildCards(kpis: DashboardKPIs): KPICard[] {
  return [
    {
      label: "Faturamento Hoje",
      value: formatBRL(kpis.faturamentoHoje),
      variation: kpis.faturamentoVar,
      icon: <DollarSign className="h-5 w-5" />,
      iconBg: "bg-blue-100 text-blue-600",
    },
    {
      label: "Pedidos Hoje",
      value: kpis.pedidosHoje.toString(),
      variation: kpis.pedidosVar,
      icon: <ShoppingCart className="h-5 w-5" />,
      iconBg: "bg-emerald-100 text-emerald-600",
    },
    {
      label: "Ticket Medio",
      value: formatBRL(kpis.ticketMedio),
      variation: kpis.ticketVar,
      icon: <Receipt className="h-5 w-5" />,
      iconBg: "bg-violet-100 text-violet-600",
    },
    {
      label: "Em Preparo",
      value: kpis.emAndamento.toString(),
      variation: 0,
      icon: <Loader2 className="h-5 w-5" />,
      iconBg: "bg-amber-100 text-amber-600",
    },
    {
      label: "Atrasados",
      value: kpis.atrasados.toString(),
      variation: 0,
      icon: <AlertTriangle className="h-5 w-5" />,
      iconBg: kpis.atrasados > 0 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600",
      isAlert: kpis.atrasados > 0,
    },
    {
      label: "vs Ontem",
      value: `${kpis.faturamentoVar > 0 ? "+" : ""}${kpis.faturamentoVar}%`,
      variation: kpis.faturamentoVar,
      icon: kpis.faturamentoVar >= 0
        ? <TrendingUp className="h-5 w-5" />
        : <TrendingDown className="h-5 w-5" />,
      iconBg: kpis.faturamentoVar >= 0
        ? "bg-emerald-100 text-emerald-600"
        : "bg-red-100 text-red-600",
    },
  ]
}

function VariationBadge({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
        <Minus className="h-3 w-3" /> 0%
      </span>
    )
  }

  const isPositive = value > 0
  // For cancelamentos, positive variation is BAD (inverted logic handled via the label "vs Ontem")
  return (
    <span className={cn("flex items-center gap-0.5 text-xs font-semibold", isPositive ? "text-emerald-600" : "text-red-600")}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? "+" : ""}{value}%
    </span>
  )
}

export default function KPICards({ kpis }: { kpis: DashboardKPIs }) {
  const cards = buildCards(kpis)

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn(
            "group rounded-xl border bg-card p-5 transition-all duration-200 hover:shadow-md",
            card.isAlert
              ? "border-red-300 bg-red-50/50 hover:border-red-400"
              : "border-border hover:border-[hsl(var(--primary))]/30"
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", card.iconBg)}>
              {card.icon}
            </span>
            <VariationBadge value={card.variation} />
          </div>
          <p className="mt-4 text-2xl font-bold text-card-foreground tabular-nums">{card.value}</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">{card.label}</p>
        </div>
      ))}
    </div>
  )
}
