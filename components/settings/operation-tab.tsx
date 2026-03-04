"use client"

import { useState, useCallback } from "react"
import { Clock, Loader2, Save, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { type OperationData, defaultOperationData } from "@/lib/settings-data"

export default function OperationTab() {
  const [data, setData] = useState<OperationData>(defaultOperationData)
  const [saving, setSaving] = useState(false)

  const update = useCallback(
    <K extends keyof OperationData>(key: K, value: OperationData[K]) => {
      setData((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  function toggleDay(idx: number) {
    setData((prev) => ({
      ...prev,
      days: prev.days.map((d, i) => (i === idx ? { ...d, active: !d.active } : d)),
    }))
  }

  async function handleSave() {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 1200))
    setSaving(false)
    toast.success("Horarios de funcionamento salvos!")
  }

  const activeDays = data.days.filter((d) => d.active).length

  return (
    <div className="space-y-8">
      {/* Closed Today Alert */}
      {data.closedToday && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Loja marcada como fechada hoje</p>
            <p className="text-xs text-amber-600">Clientes verao a mensagem de fechamento configurada abaixo.</p>
          </div>
        </div>
      )}

      {/* Hours */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h3 className="text-base font-bold text-card-foreground">Horario de Funcionamento</h3>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Abertura
            </label>
            <input
              type="time"
              value={data.openTime}
              onChange={(e) => update("openTime", e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Fechamento
            </label>
            <input
              type="time"
              value={data.closeTime}
              onChange={(e) => update("closeTime", e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Tempo Medio de Preparo
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={120}
                value={data.avgPrepTime}
                onChange={(e) => update("avgPrepTime", parseInt(e.target.value) || 0)}
                className="input-field"
              />
              <span className="text-sm text-muted-foreground flex-shrink-0">min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Closed Today */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-card-foreground">Fechado Hoje</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Desativa temporariamente o recebimento de pedidos</p>
          </div>
          <Switch
            checked={data.closedToday}
            onCheckedChange={(v) => update("closedToday", v)}
          />
        </div>
        {data.closedToday && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Mensagem de Fechamento
            </label>
            <textarea
              value={data.closedMessage}
              onChange={(e) => update("closedMessage", e.target.value)}
              className="input-field min-h-[80px] resize-y"
              placeholder="Mensagem exibida quando a loja esta fechada"
            />
          </div>
        )}
      </div>

      {/* Days of Week */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-card-foreground">Dias Ativos</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{activeDays} de 7 dias selecionados</p>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {data.days.map((day, idx) => (
            <button
              key={day.day}
              onClick={() => toggleDay(idx)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all",
                day.active
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 text-[hsl(var(--primary))]"
                  : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30"
              )}
            >
              <span className="text-xs font-bold">{day.dayShort}</span>
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  day.active ? "bg-green-500" : "bg-muted"
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  )
}
