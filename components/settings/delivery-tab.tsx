"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Clock3,
  Loader2,
  MapPin,
  Plus,
  Save,
  Store,
  Trash2,
  Truck,
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type DeliverySettingsData = {
  minimumOrder: string
  estimatedDeliveryTime: string
  deliveryEnabled: boolean
  pickupEnabled: boolean
}

type NeighborhoodRuleForm = {
  id: string
  neighborhood: string
  fee: string
  isActive: boolean
}

interface RestaurantDeliveryRow {
  id: string
  owner_id: string
  minimum_order: number | string | null
  estimated_delivery_time: string | null
  delivery_enabled: boolean | null
  pickup_enabled: boolean | null
}

interface DeliveryFeeRuleRow {
  id: string
  restaurant_id: string
  label: string | null
  fee: number | string | null
  neighborhoods: string[] | null
  is_active: boolean | null
  sort_order: number | null
  max_distance_km?: number | string | null
  created_at?: string | null
}

const defaultSettings: DeliverySettingsData = {
  minimumOrder: "0",
  estimatedDeliveryTime: "30-45 min",
  deliveryEnabled: true,
  pickupEnabled: true,
}

function createEmptyNeighborhoodRule(order?: number): NeighborhoodRuleForm {
  const index = typeof order === "number" ? order + 1 : 1

  return {
    id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    neighborhood: "",
    fee: "0",
    isActive: true,
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error.trim()) {
    return error
  }

  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
      error_description?: string
    }

    const message = [
      maybeError.message,
      maybeError.details,
      maybeError.hint,
      maybeError.code,
      maybeError.error_description,
    ]
      .filter(Boolean)
      .join(" • ")

    if (message) return message
  }

  return fallback
}

async function ensureSessionUser(supabase: ReturnType<typeof createClient>) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) throw error
  if (!session?.user) throw new Error("Usuario nao autenticado.")

  return session.user
}

export default function DeliveryTab() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [settings, setSettings] = useState<DeliverySettingsData>(defaultSettings)
  const [rules, setRules] = useState<NeighborhoodRuleForm[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [settingErrors, setSettingErrors] = useState<
    Partial<Record<keyof DeliverySettingsData, string>>
  >({})
  const [ruleErrors, setRuleErrors] = useState<Record<string, string>>({})

  const updateSetting = useCallback(
    <K extends keyof DeliverySettingsData>(key: K, value: DeliverySettingsData[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
      setSettingErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    []
  )

  const updateRule = useCallback(
    <K extends keyof NeighborhoodRuleForm>(
      ruleId: string,
      key: K,
      value: NeighborhoodRuleForm[K]
    ) => {
      setRules((prev) =>
        prev.map((rule) =>
          rule.id === ruleId
            ? {
                ...rule,
                [key]: value,
              }
            : rule
        )
      )

      setRuleErrors((prev) => {
        const next = { ...prev }
        delete next[ruleId]
        return next
      })
    },
    []
  )

  const addRule = useCallback(() => {
    setRules((prev) => [...prev, createEmptyNeighborhoodRule(prev.length)])
  }, [])

  const removeRule = useCallback((ruleId: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== ruleId))
    setRuleErrors((prev) => {
      const next = { ...prev }
      delete next[ruleId]
      return next
    })
  }, [])

  const loadDeliveryData = useCallback(async () => {
    try {
      setLoading(true)

      const user = await ensureSessionUser(supabase)

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select(
          "id, owner_id, minimum_order, estimated_delivery_time, delivery_enabled, pickup_enabled"
        )
        .eq("owner_id", user.id)
        .single()

      if (restaurantError) throw restaurantError
      if (!restaurant) throw new Error("Restaurante nao encontrado.")

      const restaurantRow = restaurant as RestaurantDeliveryRow

      const { data: deliveryRules, error: rulesError } = await supabase
        .from("delivery_fee_rules")
        .select(
          "id, restaurant_id, label, fee, neighborhoods, is_active, sort_order, max_distance_km, created_at"
        )
        .eq("restaurant_id", restaurantRow.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })

      if (rulesError) throw rulesError

      setRestaurantId(restaurantRow.id)

      setSettings({
        minimumOrder:
          restaurantRow.minimum_order != null
            ? String(restaurantRow.minimum_order)
            : "0",
        estimatedDeliveryTime:
          restaurantRow.estimated_delivery_time || "30-45 min",
        deliveryEnabled: restaurantRow.delivery_enabled ?? true,
        pickupEnabled: restaurantRow.pickup_enabled ?? true,
      })

      const mappedRules = ((deliveryRules || []) as DeliveryFeeRuleRow[]).map((rule, index) => {
        const neighborhood =
          Array.isArray(rule.neighborhoods) && rule.neighborhoods.length > 0
            ? rule.neighborhoods[0]
            : rule.label || `Bairro ${index + 1}`

        return {
          id: String(rule.id),
          neighborhood: String(neighborhood || ""),
          fee: rule.fee != null ? String(rule.fee) : "0",
          isActive: Boolean(rule.is_active ?? true),
        }
      })

      setRules(mappedRules.length > 0 ? mappedRules : [createEmptyNeighborhoodRule(0)])
    } catch (error) {
      console.error("Erro ao carregar entrega:", error)
      toast.error(
        getErrorMessage(error, "Nao foi possivel carregar as configuracoes de entrega.")
      )
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void loadDeliveryData()
  }, [loadDeliveryData])

  function validate() {
    const nextSettingErrors: Partial<Record<keyof DeliverySettingsData, string>> = {}
    const nextRuleErrors: Record<string, string> = {}

    const minimumOrder = Number(settings.minimumOrder)

    if (Number.isNaN(minimumOrder) || minimumOrder < 0) {
      nextSettingErrors.minimumOrder = "Informe um pedido minimo valido"
    }

    if (!settings.estimatedDeliveryTime.trim()) {
      nextSettingErrors.estimatedDeliveryTime = "Informe o tempo estimado"
    }

    if (!settings.deliveryEnabled && !settings.pickupEnabled) {
      nextSettingErrors.deliveryEnabled = "Ative entrega ou retirada"
      nextSettingErrors.pickupEnabled = "Ative entrega ou retirada"
    }

    const activeRules = rules.filter((rule) => rule.isActive)

    if (settings.deliveryEnabled && activeRules.length === 0) {
      nextSettingErrors.deliveryEnabled = "Cadastre pelo menos um bairro ativo"
    }

    const seenNeighborhoods = new Set<string>()

    for (const rule of rules) {
      const fee = Number(rule.fee)
      const neighborhood = (rule.neighborhood || "").trim()

      if (!neighborhood) {
        nextRuleErrors[rule.id] = "Informe o nome do bairro."
        continue
      }

      if (Number.isNaN(fee) || fee < 0) {
        nextRuleErrors[rule.id] = "Informe uma taxa valida."
        continue
      }

      const normalized = neighborhood.toLowerCase()

      if (seenNeighborhoods.has(normalized)) {
        nextRuleErrors[rule.id] = "Esse bairro ja foi cadastrado."
        continue
      }

      seenNeighborhoods.add(normalized)
    }

    setSettingErrors(nextSettingErrors)
    setRuleErrors(nextRuleErrors)

    return (
      Object.keys(nextSettingErrors).length === 0 &&
      Object.keys(nextRuleErrors).length === 0
    )
  }

  async function handleSave() {
    if (!restaurantId) {
      toast.error("Restaurante nao encontrado.")
      return
    }

    if (!validate()) {
      toast.error("Corrija os campos da entrega.")
      return
    }

    try {
      setSaving(true)

      const user = await ensureSessionUser(supabase)

      const { error: restaurantUpdateError } = await supabase
        .from("restaurants")
        .update({
          minimum_order: Number(settings.minimumOrder),
          estimated_delivery_time: settings.estimatedDeliveryTime.trim(),
          delivery_enabled: settings.deliveryEnabled,
          pickup_enabled: settings.pickupEnabled,
        })
        .eq("id", restaurantId)
        .eq("owner_id", user.id)

      if (restaurantUpdateError) throw restaurantUpdateError

      const { error: deleteRulesError } = await supabase
        .from("delivery_fee_rules")
        .delete()
        .eq("restaurant_id", restaurantId)

      if (deleteRulesError) throw deleteRulesError

      const insertPayload = rules.map((rule, index) => ({
        restaurant_id: restaurantId,
        label: (rule.neighborhood || "").trim(),
        fee: Number(rule.fee || 0),
        neighborhoods: [(rule.neighborhood || "").trim()],
        is_active: Boolean(rule.isActive),
        sort_order: index,
        max_distance_km: 0,
      }))

      if (insertPayload.length > 0) {
        const { error: insertRulesError } = await supabase
          .from("delivery_fee_rules")
          .insert(insertPayload)

        if (insertRulesError) throw insertRulesError
      }

      await loadDeliveryData()
      toast.success("Configuracoes de entrega salvas com sucesso!")
    } catch (error) {
      const message = getErrorMessage(error, "Erro ao salvar entrega.")
      console.error("Erro ao salvar entrega:", message, error)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Carregando configuracoes de entrega...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2">
          <Truck className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h3 className="text-base font-bold text-card-foreground">
            Operacao da entrega
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Pedido minimo" error={settingErrors.minimumOrder}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={settings.minimumOrder}
              onChange={(e) => updateSetting("minimumOrder", e.target.value)}
              className={cn(
                "input-field",
                settingErrors.minimumOrder && "border-destructive"
              )}
              placeholder="0.00"
            />
          </Field>

          <Field label="Tempo estimado" error={settingErrors.estimatedDeliveryTime}>
            <div className="relative">
              <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={settings.estimatedDeliveryTime}
                onChange={(e) =>
                  updateSetting("estimatedDeliveryTime", e.target.value)
                }
                className={cn(
                  "input-field pl-10",
                  settingErrors.estimatedDeliveryTime && "border-destructive"
                )}
                placeholder="30-45 min"
              />
            </div>
          </Field>

          <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
            <ToggleCard
              title="Entrega habilitada"
              description="Permite pedidos com entrega"
              checked={settings.deliveryEnabled}
              error={settingErrors.deliveryEnabled}
              onChange={(checked) => updateSetting("deliveryEnabled", checked)}
            />

            <ToggleCard
              title="Retirada habilitada"
              description="Permite retirada no local"
              checked={settings.pickupEnabled}
              error={settingErrors.pickupEnabled}
              onChange={(checked) => updateSetting("pickupEnabled", checked)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[hsl(var(--primary))]" />
            <div>
              <h3 className="text-base font-bold text-card-foreground">
                Bairros e taxas
              </h3>
              <p className="text-sm text-muted-foreground">
                Cadastre um bairro por linha, igual ao modelo do checkout que voce mostrou.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={addRule}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-card-foreground transition-colors hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
            Adicionar bairro
          </button>
        </div>

        <div className="space-y-4">
          {rules.map((rule, index) => (
            <div
              key={rule.id}
              className="rounded-xl border border-border bg-background p-4"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-card-foreground">
                    Bairro {index + 1}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Exemplo: Centro, Sao Benedito, Cristina
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  disabled={rules.length === 1}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Nome do bairro" error={ruleErrors[rule.id]}>
                  <input
                    type="text"
                    value={rule.neighborhood ?? ""}
                    onChange={(e) =>
                      updateRule(rule.id, "neighborhood", e.target.value)
                    }
                    className={cn(
                      "input-field",
                      ruleErrors[rule.id] && "border-destructive"
                    )}
                    placeholder="Ex: Centro"
                  />
                </Field>

                <Field label="Taxa de entrega">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={rule.fee ?? "0"}
                    onChange={(e) => updateRule(rule.id, "fee", e.target.value)}
                    className={cn(
                      "input-field",
                      ruleErrors[rule.id] && "border-destructive"
                    )}
                    placeholder="5.00"
                  />
                </Field>

                <div className="md:col-span-2">
                  <ToggleCard
                    title="Bairro ativo"
                    description="Se desligar, ele nao aparece para o cliente no checkout"
                    checked={Boolean(rule.isActive)}
                    onChange={(checked) => updateRule(rule.id, "isActive", checked)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <Store className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-card-foreground">
                Como vai funcionar no checkout
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                O cliente vai selecionar o bairro em um campo igual ao modelo que voce mandou.
                Ao selecionar, a taxa entra automaticamente no pedido.
              </p>
            </div>
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
          {saving ? "Salvando..." : "Salvar Entrega"}
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-medium text-card-foreground">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

function ToggleCard({
  title,
  description,
  checked,
  error,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  error?: string
  onChange: (checked: boolean) => void
}) {
  return (
    <div>
      <label className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <div>
          <p className="text-sm font-medium text-card-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </label>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}