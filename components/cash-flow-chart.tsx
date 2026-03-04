"use client"

import { useState } from "react"
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { TrendingUp } from "lucide-react"
import type { DailyFinance } from "@/lib/finance-data"
import { cn } from "@/lib/utils"

const INCOME_COLOR = "#22c55e" // green-500
const EXPENSE_COLOR = "#ef4444" // red-500

const periods = [
  { label: "7 dias", value: 7 },
  { label: "15 dias", value: 15 },
  { label: "30 dias", value: 30 },
] as const

interface CashFlowChartProps {
  data: DailyFinance[]
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <TrendingUp className="mb-3 h-10 w-10 opacity-40" />
      <p className="text-sm font-medium">Nenhum dado financeiro</p>
      <p className="mt-1 text-xs">
        Os dados aparecerão aqui quando houver movimentação.
      </p>
    </div>
  )
}

export default function CashFlowChart({ data }: CashFlowChartProps) {
  const [period, setPeriod] = useState<7 | 15 | 30>(30)

  const chartData = data.slice(-period)
  const hasData = chartData.length > 0

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Fluxo de Caixa
          </h2>
          <p className="text-sm text-muted-foreground">
            Entradas vs Saídas ao longo do tempo
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                period === p.value
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="px-6 py-5">
        {!hasData ? (
          <EmptyState />
        ) : (
          <>
            {/* Legend */}
            <div className="mb-4 flex items-center gap-5">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: INCOME_COLOR }} />
                <span className="text-xs font-medium text-foreground">Entradas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: EXPENSE_COLOR }} />
                <span className="text-xs font-medium text-foreground">Saídas</span>
              </div>
            </div>

            <ChartContainer
              config={{
                income: {
                  label: "Entradas",
                  color: INCOME_COLOR,
                },
                expenses: {
                  label: "Saídas",
                  color: EXPENSE_COLOR,
                },
              }}
              className="h-[320px] w-full"
            >
              <LineChart
                  data={chartData}
                  margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(220, 13%, 91%)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 11 }}
                    interval={period <= 7 ? 0 : period <= 15 ? 1 : 3}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 11 }}
                    tickFormatter={(v: number) =>
                      `R$${(v / 1000).toFixed(1)}k`
                    }
                    width={65}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => (
                          <span className="font-semibold">
                            {Number(value).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                        )}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Entradas"
                    stroke={INCOME_COLOR}
                    strokeWidth={2.5}
                    dot={period <= 15}
                    activeDot={{ r: 5, strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    name="Saídas"
                    stroke={EXPENSE_COLOR}
                    strokeWidth={2.5}
                    dot={period <= 15}
                    activeDot={{ r: 5, strokeWidth: 2 }}
                  />
              </LineChart>
            </ChartContainer>
          </>
        )}
      </div>
    </div>
  )
}
