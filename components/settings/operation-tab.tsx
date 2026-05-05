"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Clock, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type OperationData = {
  openTime: string
  closeTime: string
  closedToday: boolean
  avgPrepTime: number
  closedMessage: string
  activeDays: string[]
}

interface RestaurantOperationRow {
  id: string
  owner_id: string
  open_time: string | null
  close_time: string | null
  closed_today: boolean | null
  avg_prep_time: number | null
  closed_message: string | null
  active_days: string[] | null
}

const defaultOperationData: OperationData = {
  openTime: "11:00",
  closeTime: "23:00",
  closedToday: false,
  avgPrepTime: 35,
  closedMessage: "Estamos fechados no momento. Voltamos em breve!",
  activeDays: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab"],
}

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]

export default function OperationTab() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [data, setData] = useState<OperationData>(defaultOperationData)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const update = useCallback(
    <K extends keyof OperationData>(key: K, value: OperationData[K]) => {
      setData((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const toggleDay = useCallback((day: string) => {
    setData((prev) => ({
      ...prev,
      activeDays: prev.activeDays.includes(day)
        ? prev.activeDays.filter((item) => item !== day)
        : [...prev.activeDays, day],
    }))
  }, [])

  useEffect(() => {
    async function loadOperationData() {
      try {
        setLoading(true)

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError
        if (!user) throw new Error("Usuario nao autenticado.")

        const { data: restaurant, error: restaurantError } = await supabase
          .from("restaurants")
          .select(
            "id, owner_id, open_time, close_time, closed_today, avg_prep_time, closed_message, active_days"
          )
          .eq("owner_id", user.id)
          .single()

        if (restaurantError) throw restaurantError
        if (!restaurant) throw new Error("Restaurante nao encontrado.")

        const row = restaurant as RestaurantOperationRow

        setRestaurantId(row.id)
        setData({
          openTime: row.open_time || "11:00",
          closeTime: row.close_time || "23:00",
          closedToday: row.closed_today ?? false,
          avgPrepTime: row.avg_prep_time ?? 35,
          closedMessage:
            row.closed_message || "Estamos fechados no momento. Voltamos em breve!",
          activeDays:
            Array.isArray(row.active_days) && row.active_days.length > 0
              ? row.active_days
              : ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab"],
        })
      } catch (error) {
        console.error(error)
        toast.error("Nao foi possivel carregar o funcionamento.")
      } finally {
        setLoading(false)
      }
    }

    loadOperationData()
  }, [supabase])

  async function handleSave() {
    if (!restaurantId) {
      toast.error("Restaurante nao encontrado.")
      return
    }

    if (data.activeDays.length === 0) {
      toast.error("Selecione pelo menos um dia de funcionamento.")
      return
    }

    if (!data.openTime || !data.closeTime) {
      toast.error("Preencha os horarios de abertura e fechamento.")
      return
    }

    if (data.avgPrepTime < 1) {
      toast.error("O tempo medio deve ser maior que zero.")
      return
    }

    try {
      setSaving(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error("Usuario nao autenticado.")

      const payload = {
        open_time: data.openTime,
        close_time: data.closeTime,
        closed_today: data.closedToday,
        avg_prep_time: Number(data.avgPrepTime),
        closed_message: data.closedMessage.trim() || null,
        active_days: data.activeDays,
      }

      const { error: updateError } = await supabase
        .from("restaurants")
        .update(payload)
        .eq("id", restaurantId)
        .eq("owner_id", user.id)

      if (updateError) throw updateError

      toast.success("Funcionamento salvo com sucesso!")
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar funcionamento.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando funcionamento...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2">
          <Clock className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h3 className="text-base font-bold text-card-foreground">Funcionamento</h3>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Horario de abertura">
            <input
              type="time"
              value={data.openTime}
              onChange={(e) => update("openTime", e.target.value)}
              className="input-field"
            />
          </Field>

          <Field label="Horario de fechamento">
            <input
              type="time"
              value={data.closeTime}
              onChange={(e) => update("closeTime", e.target.value)}
              className="input-field"
            />
          </Field>

          <Field label="Tempo medio de preparo (min)" className="md:col-span-2">
            <input
              type="number"
              min={1}
              value={data.avgPrepTime}
              onChange={(e) => update("avgPrepTime", Number(e.target.value))}
              className="input-field"
              placeholder="35"
            />
          </Field>

          <Field label="Dias ativos" className="md:col-span-2">
            <div className="flex flex-wrap gap-2">
              {weekDays.map((day) => {
                const active = data.activeDays.includes(day)

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                      active
                        ? "border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="Mensagem quando estiver fechado" className="md:col-span-2">
            <textarea
              value={data.closedMessage}
              onChange={(e) => update("closedMessage", e.target.value)}
              className="input-field min-h-[110px] resize-none py-3"
              placeholder="Estamos fechados no momento. Voltamos em breve!"
            />
          </Field>

          <div className="md:col-span-2">
            <label className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
              <input
                type="checkbox"
                checked={data.closedToday}
                onChange={(e) => update("closedToday", e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <div>
                <p className="text-sm font-medium text-card-foreground">Fechado hoje</p>
                <p className="text-xs text-muted-foreground">
                  Ative isso se quiser bloquear o restaurante temporariamente hoje.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Salvando..." : "Salvar Funcionamento"}
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-medium text-card-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}