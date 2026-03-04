"use client"

import { Trophy, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatBRL, type TopProductToday, type PeakHourData } from "@/lib/dashboard-data"

export default function Highlights({
  topProduct,
  peakHour,
}: {
  topProduct: TopProductToday
  peakHour: PeakHourData
}) {
  const maxOrders = Math.max(...peakHour.hourlyBars.map((b) => b.orders))

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Top Product */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
            <Trophy className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-card-foreground">Mais Vendido Hoje</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Produto destaque</p>
          </div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-lg font-bold text-amber-900">{topProduct.name}</p>
          <div className="mt-2 flex items-center gap-4">
            <div>
              <p className="text-xs text-amber-700 uppercase">Quantidade</p>
              <p className="text-xl font-bold text-amber-800">{topProduct.quantity}</p>
            </div>
            <div className="h-8 w-px bg-amber-200" />
            <div>
              <p className="text-xs text-amber-700 uppercase">Receita</p>
              <p className="text-xl font-bold text-amber-800">{formatBRL(topProduct.revenue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Peak Hour */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100">
            <Clock className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-card-foreground">Horario de Pico</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Maior movimento</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <span className="rounded-lg bg-violet-100 px-3 py-1.5 text-lg font-bold text-violet-800">
            {peakHour.peakHour}
          </span>
          <span className="text-sm text-muted-foreground">
            {peakHour.peakOrders} pedidos
          </span>
        </div>

        {/* Mini bar chart */}
        <div className="flex items-end gap-1" style={{ height: 64 }}>
          {peakHour.hourlyBars.map((bar) => {
            const h = maxOrders > 0 ? (bar.orders / maxOrders) * 100 : 0
            const isPeak = bar.hour === peakHour.peakHour
            return (
              <div key={bar.hour} className="flex-1 min-w-0 group relative">
                <div
                  className={cn(
                    "w-full rounded-t transition-all",
                    isPeak ? "bg-violet-500" : "bg-violet-200 group-hover:bg-violet-300"
                  )}
                  style={{ height: `${h}%` }}
                />
                {/* Tooltip */}
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                  <div className="rounded bg-card border border-border shadow-md px-2 py-1 text-center whitespace-nowrap">
                    <p className="text-[10px] font-semibold text-card-foreground">{bar.hour}</p>
                    <p className="text-[10px] text-muted-foreground">{bar.orders} ped.</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
          <span>{peakHour.hourlyBars[0]?.hour}</span>
          <span>{peakHour.hourlyBars[peakHour.hourlyBars.length - 1]?.hour}</span>
        </div>
      </div>
    </div>
  )
}
