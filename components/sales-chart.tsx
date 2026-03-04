"use client"

import { useState } from "react"
import {
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar,
  ComposedChart,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

const REVENUE_COLOR = "hsl(217, 91%, 60%)"
const ORDERS_COLOR = "hsl(217, 70%, 78%)"

const periods = [
  { label: "7 dias", value: 7 },
  { label: "15 dias", value: 15 },
  { label: "30 dias", value: 30 },
] as const

interface SalesDataPoint {
  date: string
  revenue: number
  orders: number
}

function generateSalesData(days: number): SalesDataPoint[] {
  const data: SalesDataPoint[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dayLabel = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`
    const revenue = Math.round(1500 + Math.random() * 5000)
    const orders = Math.round(8 + Math.random() * 35)
    data.push({ date: dayLabel, revenue, orders })
  }
  return data
}

const allData = generateSalesData(30)

export default function SalesChart() {
  const [period, setPeriod] = useState<7 | 15 | 30>(30)
  const chartData = allData.slice(-period)

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Desempenho de Vendas
          </h2>
          <p className="text-sm text-muted-foreground">
            Faturamento diario e quantidade de pedidos
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

      <div className="px-6 py-5">
        {/* Legend */}
        <div className="mb-4 flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: REVENUE_COLOR }} />
            <span className="text-xs font-medium text-foreground">Faturamento (R$)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ORDERS_COLOR }} />
            <span className="text-xs font-medium text-foreground">Pedidos</span>
          </div>
        </div>

        <ChartContainer
          config={{
            revenue: {
              label: "Faturamento",
              color: REVENUE_COLOR,
            },
            orders: {
              label: "Pedidos",
              color: ORDERS_COLOR,
            },
          }}
          className="h-[320px] w-full"
          >
            <ComposedChart
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
                yAxisId="revenue"
                orientation="left"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 11 }}
                tickFormatter={(v: number) => `R$${(v / 1000).toFixed(1)}k`}
                width={65}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 11 }}
                width={40}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <span className="font-semibold">
                        {name === "revenue"
                          ? Number(value).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })
                          : `${value} pedidos`}
                      </span>
                    )}
                  />
                }
              />
              <Bar
                yAxisId="orders"
                dataKey="orders"
                name="orders"
                fill={ORDERS_COLOR}
                radius={[4, 4, 0, 0]}
                opacity={0.4}
                barSize={period <= 7 ? 28 : period <= 15 ? 18 : 10}
              />
              <Line
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                name="revenue"
                stroke={REVENUE_COLOR}
                strokeWidth={2.5}
                dot={period <= 15}
                activeDot={{ r: 5, strokeWidth: 2 }}
              />
            </ComposedChart>
          </ChartContainer>
      </div>
    </div>
  )
}
