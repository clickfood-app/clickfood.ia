"use client"

import { useState } from "react"
import {
  Bar,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  ComposedChart,
} from "recharts"
import {
  ChartContainer,
} from "@/components/ui/chart"
import {
  ArrowUpRight,
  Lightbulb,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { CouponUsageDay, Coupon } from "@/lib/coupons-data"
import { formatBRL, ticketComparison } from "@/lib/coupons-data"

interface CouponAnalyticsProps {
  usageData: CouponUsageDay[]
  coupons: Coupon[]
}

const BLUE = "hsl(217, 91%, 60%)"
const BLUE_LIGHT = "hsl(217, 70%, 78%)"

export default function CouponAnalytics({ usageData, coupons }: CouponAnalyticsProps) {
  const [period, setPeriod] = useState<7 | 14>("14")

  const slicedData = usageData.slice(-Number(period))

  const totalRevenue = coupons.reduce((sum, c) => sum + c.revenueGenerated, 0)
  const totalUses = coupons.reduce((sum, c) => sum + c.usedCount, 0)

  // Best performing coupon
  const bestCoupon = coupons.reduce((best, c) =>
    c.revenueGenerated > (best?.revenueGenerated || 0) ? c : best
  , coupons[0])

  const insights = [
    {
      text: `Clientes que usam cupom gastam ${ticketComparison.percentDifference}% a mais que os demais`,
      type: "positive" as const,
    },
    {
      text: `O cupom "${bestCoupon?.name}" gerou ${formatBRL(bestCoupon?.revenueGenerated || 0)} em receita`,
      type: "highlight" as const,
    },
    {
      text: `Ticket medio com cupom: ${formatBRL(ticketComparison.withCoupon)} vs ${formatBRL(ticketComparison.withoutCoupon)} sem cupom`,
      type: "positive" as const,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Usage chart */}
        <div className="rounded-xl border border-border bg-card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-card-foreground">Uso de Cupons por Periodo</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Utilizacoes e receita diaria</p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
              {([7, 14] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p as 7 | 14)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-all",
                    Number(period) === p
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p}d
                </button>
              ))}
            </div>
          </div>

          <ChartContainer
            config={{
              uses: { label: "Usos", color: BLUE },
              revenue: { label: "Receita", color: BLUE_LIGHT },
            }}
            className="h-[280px] w-full"
          >
            <ComposedChart data={slicedData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(220, 13%, 91%)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="uses"
                  tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                />
                <YAxis
                  yAxisId="revenue"
                  orientation="right"
                  tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                  tickFormatter={(v: number) => `R$${v}`}
                />
                <Tooltip
                  cursor={{ fill: "hsl(220, 14%, 96%)", radius: 4 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(220, 13%, 91%)",
                    boxShadow: "0 4px 12px rgba(0,0,0,.08)",
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    name === "revenue" ? formatBRL(value) : value,
                    name === "revenue" ? "Receita" : "Usos",
                  ]}
                />
                <Bar
                  yAxisId="uses"
                  dataKey="uses"
                  fill={BLUE}
                  radius={[4, 4, 0, 0]}
                  barSize={24}
                  animationDuration={800}
                />
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  stroke={BLUE_LIGHT}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: BLUE_LIGHT }}
                  activeDot={{ r: 5 }}
                  animationDuration={1000}
                />
            </ComposedChart>
          </ChartContainer>
        </div>

        {/* Right column: ticket comparison + insights */}
        <div className="space-y-5">
          {/* Ticket comparison */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-card-foreground">Ticket Medio</h3>
            <p className="text-xs text-muted-foreground mt-0.5 mb-4">Com cupom vs sem cupom</p>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-card-foreground">Com cupom</span>
                  <span className="text-sm font-bold text-[hsl(var(--primary))]">
                    {formatBRL(ticketComparison.withCoupon)}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[hsl(var(--primary))] transition-all duration-500"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-card-foreground">Sem cupom</span>
                  <span className="text-sm font-bold text-muted-foreground">
                    {formatBRL(ticketComparison.withoutCoupon)}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-muted-foreground/30 transition-all duration-500"
                    style={{ width: `${(ticketComparison.withoutCoupon / ticketComparison.withCoupon) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-green-700">
                <ArrowUpRight className="h-4 w-4" />
                <span className="text-xs font-semibold">+{ticketComparison.percentDifference}% de aumento</span>
              </div>
            </div>
          </div>

          {/* Insights */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-card-foreground">Sugestoes Inteligentes</h3>
            </div>
            <div className="space-y-2.5">
              {insights.map((insight, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-xs leading-relaxed",
                    insight.type === "positive" ? "bg-green-50 text-green-800" : "bg-blue-50 text-blue-800"
                  )}
                >
                  <TrendingUp className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>{insight.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
