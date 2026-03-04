"use client"

import {
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { formatBRL } from "@/lib/finance-data"

interface FinanceSummaryProps {
  totalIncome: number
  totalExpenses: number
}

export default function FinanceSummary({
  totalIncome,
  totalExpenses,
}: FinanceSummaryProps) {
  const balance = totalIncome - totalExpenses
  const profitPercent =
    totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : "0.0"
  const isPositive = balance >= 0

  const cards = [
    {
      label: "Total de Entradas",
      value: formatBRL(totalIncome),
      icon: <ArrowUpRight className="h-5 w-5" />,
      iconBg: "bg-green-100 text-green-600",
      accent: "text-green-600",
    },
    {
      label: "Total de Saídas",
      value: formatBRL(totalExpenses),
      icon: <ArrowDownLeft className="h-5 w-5" />,
      iconBg: "bg-red-100 text-red-600",
      accent: "text-red-600",
    },
    {
      label: "Saldo Atual",
      value: formatBRL(balance),
      icon: <Wallet className="h-5 w-5" />,
      iconBg: isPositive
        ? "bg-green-100 text-green-600"
        : "bg-red-100 text-red-600",
      accent: isPositive ? "text-green-600" : "text-red-600",
    },
    {
      label: isPositive ? "Lucro" : "Prejuízo",
      value: `${profitPercent}%`,
      icon: isPositive ? (
        <TrendingUp className="h-5 w-5" />
      ) : (
        <TrendingDown className="h-5 w-5" />
      ),
      iconBg: isPositive
        ? "bg-green-100 text-green-600"
        : "bg-red-100 text-red-600",
      accent: isPositive ? "text-green-600" : "text-red-600",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBg}`}
            >
              {card.icon}
            </span>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className={`mt-4 text-2xl font-bold ${card.accent}`}>
            {card.value}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{card.label}</p>
        </div>
      ))}
    </div>
  )
}
