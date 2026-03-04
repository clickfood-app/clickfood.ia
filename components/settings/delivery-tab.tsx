"use client"

import { useState, useCallback } from "react"
import { Loader2, MapPin, Save, Truck } from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { type DeliveryData, defaultDeliveryData, formatBRL } from "@/lib/settings-data"

export default function DeliveryTab() {
  const [data, setData] = useState<DeliveryData>(defaultDeliveryData)
  const [saving, setSaving] = useState(false)

  const update = useCallback(
    <K extends keyof DeliveryData>(key: K, value: DeliveryData[K]) => {
      setData((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  async function handleSave() {
    if (data.fixedFee < 0 || data.minOrderValue < 0) {
      toast.error("Valores nao podem ser negativos.")
      return
    }
    setSaving(true)
    await new Promise((r) => setTimeout(r, 1200))
    setSaving(false)
    toast.success("Configuracoes de entrega salvas!")
  }

  return (
    <div className="space-y-8">
      {/* Fees & Values */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Truck className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h3 className="text-base font-bold text-card-foreground">Taxas e Valores</h3>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Taxa Fixa de Entrega
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={data.fixedFee}
                onChange={(e) => update("fixedFee", parseFloat(e.target.value) || 0)}
                className="input-field pl-10"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Valor Minimo do Pedido
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <input
                type="number"
                min={0}
                step={1}
                value={data.minOrderValue}
                onChange={(e) => update("minOrderValue", parseFloat(e.target.value) || 0)}
                className="input-field pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Time & Radius */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <MapPin className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h3 className="text-base font-bold text-card-foreground">Area e Tempo</h3>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Tempo Medio de Entrega
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={10}
                max={180}
                value={data.avgDeliveryTime}
                onChange={(e) => update("avgDeliveryTime", parseInt(e.target.value) || 0)}
                className="input-field"
              />
              <span className="text-sm text-muted-foreground flex-shrink-0">min</span>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Raio de Entrega
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={50}
                step={0.5}
                value={data.deliveryRadius}
                onChange={(e) => update("deliveryRadius", parseFloat(e.target.value) || 0)}
                className="input-field"
              />
              <span className="text-sm text-muted-foreground flex-shrink-0">km</span>
            </div>
          </div>
        </div>

        {/* Visual summary */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <p className="text-lg font-bold text-[hsl(var(--primary))]">{formatBRL(data.fixedFee)}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">taxa fixa</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <p className="text-lg font-bold text-card-foreground">{data.avgDeliveryTime} min</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">tempo medio</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <p className="text-lg font-bold text-card-foreground">{data.deliveryRadius} km</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">raio</p>
          </div>
        </div>
      </div>

      {/* Pickup */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-card-foreground">Retirada no Local</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Permitir que clientes retirem pedidos na loja</p>
          </div>
          <Switch
            checked={data.pickupEnabled}
            onCheckedChange={(v) => update("pickupEnabled", v)}
          />
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
