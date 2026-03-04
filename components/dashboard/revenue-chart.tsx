"use client"

import { useState } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { cn } from "@/lib/utils"
import { formatBRL, getHourlyData, getWeeklyData, getMonthlyData } from "@/lib/dashboard-data"

type Tab = "hoje" | "7d" | "30d"

const tabs: { key: Tab; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
]

function getData(tab: Tab) {
  switch (tab) {
    case "hoje": return { data: getHourlyData(), xKey: "hour" }
    case "7d": return { data: getWeeklyData(), xKey: "date" }
    case "30d": return { data: getMonthlyData(), xKey: "date" }
  }
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-card-foreground">{label}</p>
      <p className="text-sm font-bold text-[hsl(var(--primary))]">{formatBRL(payload[0].value)}</p>
    </div>
  )
}

export default function RevenueChart() {
  const [activeTab, setActiveTab] = useState<Tab>("hoje")
  const { data, xKey } = getData(activeTab)

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-bold text-card-foreground">Faturamento</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Receita ao longo do tempo</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                activeTab === tab.key
                  ? "bg-card text-card-foreground shadow-sm"
                  : "text-muted-foreground hover:text-card-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="faturamento"
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={2.5}
              fill="url(#fillRevenue)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(217, 91%, 60%)", fill: "#fff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
