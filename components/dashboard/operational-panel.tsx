"use client"

import { Clock, AlertTriangle, ChefHat, Hourglass, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { OperationalData } from "@/lib/dashboard-data"

export default function OperationalPanel({ data }: { data: OperationalData }) {
  const tempoVar = data.tempoMedioPrevMin > 0
    ? Math.round(((data.tempoMedioMin - data.tempoMedioPrevMin) / data.tempoMedioPrevMin) * 100)
    : 0
  const tempoMelhorou = tempoVar < 0

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <ChefHat className="h-5 w-5 text-[hsl(var(--primary))]" />
        <h2 className="text-base font-bold text-card-foreground">Painel Operacional</h2>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
          <Hourglass className="h-5 w-5 mx-auto text-amber-600" />
          <p className="mt-2 text-2xl font-bold text-amber-800">{data.pendentes}</p>
          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Pendentes</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
          <ChefHat className="h-5 w-5 mx-auto text-blue-600" />
          <p className="mt-2 text-2xl font-bold text-blue-800">{data.preparando}</p>
          <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">Preparando</p>
        </div>
        <div className={cn(
          "rounded-lg border p-4 text-center",
          tempoMelhorou ? "border-emerald-200 bg-emerald-50" : "border-border bg-muted/30"
        )}>
          <Clock className={cn("h-5 w-5 mx-auto", tempoMelhorou ? "text-emerald-600" : "text-muted-foreground")} />
          <p className={cn("mt-2 text-2xl font-bold", tempoMelhorou ? "text-emerald-800" : "text-card-foreground")}>
            {data.tempoMedioMin}min
          </p>
          <div className="flex items-center justify-center gap-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Tempo Medio</p>
            {tempoMelhorou && <TrendingDown className="h-3 w-3 text-emerald-600" />}
          </div>
        </div>
      </div>

      {/* Late orders alert */}
      {data.atrasados.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <p className="text-xs font-bold text-red-800 uppercase tracking-wide">
              Pedidos Atrasados ({data.atrasados.length})
            </p>
          </div>
          <div className="space-y-2">
            {data.atrasados.map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-md bg-red-100/60 px-3 py-2">
                <div>
                  <span className="text-sm font-semibold text-red-800">{order.id}</span>
                  <span className="mx-2 text-xs text-red-700">{order.customer}</span>
                </div>
                <span className="rounded-full bg-red-200 px-2 py-0.5 text-[10px] font-bold text-red-800">
                  {order.minutes}min
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
