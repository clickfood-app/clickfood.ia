"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
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

type DeliveryFeeMode = "distance" | "neighborhood"

type DeliverySettingsData = {
  minimumOrder: string
  estimatedDeliveryTime: string
  deliveryEnabled: boolean
  pickupEnabled: boolean
  deliveryFeeMode: DeliveryFeeMode
}

type DistanceRuleForm = {
  id: string
  upToKm: string
  fee: string
  isActive: boolean
}

type NeighborhoodRuleForm = {
  id: string
  neighborhoodName: string
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
  delivery_fee_mode: string | null
}

interface DeliveryDistanceRuleRow {
  id: string
  restaurant_id: string
  up_to_km: number | string | null
  fee: number | string | null
  is_active: boolean | null
  sort_order: number | null
  created_at?: string | null
}

interface DeliveryNeighborhoodRuleRow {
  id: string
  restaurant_id: string
  neighborhood_name: string | null
  fee: number | string | null
  is_active: boolean | null
  sort_order: number | null
  created_at?: string | null
}

const defaultSettings: DeliverySettingsData = {
  minimumOrder: "0",
  estimatedDeliveryTime: "30-45 min",
  deliveryEnabled: true,
  pickupEnabled: true,
  deliveryFeeMode: "distance",
}

function createEmptyDistanceRule(order?: number): DistanceRuleForm {
  const index = typeof order === "number" ? order + 1 : 1

  return {
    id: `temp-distance-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    upToKm: String(index),
    fee: "0",
    isActive: true,
  }
}

function createEmptyNeighborhoodRule(): NeighborhoodRuleForm {
  return {
    id: `temp-neighborhood-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`,
    neighborhoodName: "",
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
  if (!session?.user) throw new Error("Usuário não autenticado.")

  return session.user
}

export default function DeliveryTab() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [settings, setSettings] =
    useState<DeliverySettingsData>(defaultSettings)
  const [rules, setRules] = useState<DistanceRuleForm[]>([])
  const [neighborhoodRules, setNeighborhoodRules] = useState<
    NeighborhoodRuleForm[]
  >([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [settingErrors, setSettingErrors] = useState<
    Partial<Record<keyof DeliverySettingsData, string>>
  >({})
  const [ruleErrors, setRuleErrors] = useState<Record<string, string>>({})
  const [neighborhoodRuleErrors, setNeighborhoodRuleErrors] = useState<
    Record<string, string>
  >({})

  const updateSetting = useCallback(
    <K extends keyof DeliverySettingsData>(
      key: K,
      value: DeliverySettingsData[K],
    ) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
      setSettingErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    [],
  )

  const updateRule = useCallback(
    <K extends keyof DistanceRuleForm>(
      ruleId: string,
      key: K,
      value: DistanceRuleForm[K],
    ) => {
      setRules((prev) =>
        prev.map((rule) =>
          rule.id === ruleId
            ? {
                ...rule,
                [key]: value,
              }
            : rule,
        ),
      )

      setRuleErrors((prev) => {
        const next = { ...prev }
        delete next[ruleId]
        return next
      })
    },
    [],
  )

  const updateNeighborhoodRule = useCallback(
    <K extends keyof NeighborhoodRuleForm>(
      ruleId: string,
      key: K,
      value: NeighborhoodRuleForm[K],
    ) => {
      setNeighborhoodRules((prev) =>
        prev.map((rule) =>
          rule.id === ruleId
            ? {
                ...rule,
                [key]: value,
              }
            : rule,
        ),
      )

      setNeighborhoodRuleErrors((prev) => {
        const next = { ...prev }
        delete next[ruleId]
        return next
      })
    },
    [],
  )

  const addRule = useCallback(() => {
    setRules((prev) => {
      const highestDistance = prev.reduce((highest, rule) => {
        const distance = Number(rule.upToKm)

        return Number.isFinite(distance) ? Math.max(highest, distance) : highest
      }, 0)

      return [
        ...prev,
        {
          ...createEmptyDistanceRule(prev.length),
          upToKm: String(highestDistance + 1),
        },
      ]
    })
  }, [])

  const removeRule = useCallback((ruleId: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== ruleId))
    setRuleErrors((prev) => {
      const next = { ...prev }
      delete next[ruleId]
      return next
    })
  }, [])

  const addNeighborhoodRule = useCallback(() => {
    setNeighborhoodRules((prev) => [...prev, createEmptyNeighborhoodRule()])
  }, [])

  const removeNeighborhoodRule = useCallback((ruleId: string) => {
    setNeighborhoodRules((prev) => prev.filter((rule) => rule.id !== ruleId))
    setNeighborhoodRuleErrors((prev) => {
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
          "id, owner_id, minimum_order, estimated_delivery_time, delivery_enabled, pickup_enabled, delivery_fee_mode",
        )
        .eq("owner_id", user.id)
        .single()

      if (restaurantError) throw restaurantError
      if (!restaurant) throw new Error("Restaurante não encontrado.")

      const restaurantRow = restaurant as RestaurantDeliveryRow

      const { data: deliveryRules, error: rulesError } = await supabase
        .from("delivery_distance_rules")
        .select(
          "id, restaurant_id, up_to_km, fee, is_active, sort_order, created_at",
        )
        .eq("restaurant_id", restaurantRow.id)
        .order("sort_order", { ascending: true })
        .order("up_to_km", { ascending: true })

      if (rulesError) throw rulesError

      const { data: deliveryNeighborhoodRules, error: neighborhoodRulesError } =
        await supabase
          .from("delivery_neighborhood_rules")
          .select(
            "id, restaurant_id, neighborhood_name, fee, is_active, sort_order, created_at",
          )
          .eq("restaurant_id", restaurantRow.id)
          .order("sort_order", { ascending: true })
          .order("neighborhood_name", { ascending: true })

      if (neighborhoodRulesError) throw neighborhoodRulesError

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
        deliveryFeeMode:
          restaurantRow.delivery_fee_mode === "neighborhood"
            ? "neighborhood"
            : "distance",
      })

      const mappedRules = (
        (deliveryRules || []) as DeliveryDistanceRuleRow[]
      ).map((rule) => ({
        id: String(rule.id),
        upToKm: rule.up_to_km != null ? String(rule.up_to_km) : "",
        fee: rule.fee != null ? String(rule.fee) : "0",
        isActive: Boolean(rule.is_active ?? true),
      }))

      setRules(
        mappedRules.length > 0
          ? mappedRules
          : [
              {
                ...createEmptyDistanceRule(0),
                upToKm: "1",
              },
            ],
      )

      const mappedNeighborhoodRules = (
        (deliveryNeighborhoodRules || []) as DeliveryNeighborhoodRuleRow[]
      ).map((rule) => ({
        id: String(rule.id),
        neighborhoodName: rule.neighborhood_name || "",
        fee: rule.fee != null ? String(rule.fee) : "0",
        isActive: Boolean(rule.is_active ?? true),
      }))

      setNeighborhoodRules(
        mappedNeighborhoodRules.length > 0
          ? mappedNeighborhoodRules
          : [createEmptyNeighborhoodRule()],
      )
    } catch (error) {
      console.error("Erro ao carregar entrega:", error)
      toast.error(
        getErrorMessage(
          error,
          "Não foi possível carregar as configurações de entrega.",
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void loadDeliveryData()
  }, [loadDeliveryData])

  function validate() {
    const nextSettingErrors: Partial<
      Record<keyof DeliverySettingsData, string>
    > = {}
    const nextRuleErrors: Record<string, string> = {}
    const nextNeighborhoodRuleErrors: Record<string, string> = {}

    const minimumOrder = Number(settings.minimumOrder)

    if (Number.isNaN(minimumOrder) || minimumOrder < 0) {
      nextSettingErrors.minimumOrder = "Informe um pedido mínimo válido."
    }

    if (!settings.estimatedDeliveryTime.trim()) {
      nextSettingErrors.estimatedDeliveryTime = "Informe o tempo estimado."
    }

    if (!settings.deliveryEnabled && !settings.pickupEnabled) {
      nextSettingErrors.deliveryEnabled = "Ative entrega ou retirada."
      nextSettingErrors.pickupEnabled = "Ative entrega ou retirada."
    }

    if (settings.deliveryFeeMode === "distance") {
      const activeRules = rules.filter((rule) => rule.isActive)

      if (settings.deliveryEnabled && activeRules.length === 0) {
        nextSettingErrors.deliveryEnabled =
          "Cadastre pelo menos uma faixa ativa."
      }

      const seenDistances = new Set<string>()

      for (const rule of rules) {
        const upToKm = Number(rule.upToKm)
        const fee = Number(rule.fee)

        if (!Number.isFinite(upToKm) || upToKm <= 0) {
          nextRuleErrors[rule.id] = "Informe uma distância maior que zero."
          continue
        }

        if (!Number.isFinite(fee) || fee < 0) {
          nextRuleErrors[rule.id] = "Informe uma taxa válida."
          continue
        }

        const normalizedDistance = upToKm.toFixed(2)

        if (seenDistances.has(normalizedDistance)) {
          nextRuleErrors[rule.id] = "Essa distância já foi cadastrada."
          continue
        }

        seenDistances.add(normalizedDistance)
      }
    } else {
      const activeNeighborhoodRules = neighborhoodRules.filter(
        (rule) => rule.isActive,
      )

      if (settings.deliveryEnabled && activeNeighborhoodRules.length === 0) {
        nextSettingErrors.deliveryEnabled =
          "Cadastre pelo menos um bairro ativo."
      }

      const seenNeighborhoods = new Set<string>()

      for (const rule of neighborhoodRules) {
        const neighborhoodName = rule.neighborhoodName.trim()
        const fee = Number(rule.fee)

        if (!neighborhoodName) {
          nextNeighborhoodRuleErrors[rule.id] = "Informe o nome do bairro."
          continue
        }

        if (!Number.isFinite(fee) || fee < 0) {
          nextNeighborhoodRuleErrors[rule.id] = "Informe uma taxa válida."
          continue
        }

        const normalizedNeighborhood =
          neighborhoodName.toLocaleLowerCase("pt-BR")

        if (seenNeighborhoods.has(normalizedNeighborhood)) {
          nextNeighborhoodRuleErrors[rule.id] = "Esse bairro já foi cadastrado."
          continue
        }

        seenNeighborhoods.add(normalizedNeighborhood)
      }
    }

    setSettingErrors(nextSettingErrors)
    setRuleErrors(nextRuleErrors)
    setNeighborhoodRuleErrors(nextNeighborhoodRuleErrors)

    return (
      Object.keys(nextSettingErrors).length === 0 &&
      Object.keys(nextRuleErrors).length === 0 &&
      Object.keys(nextNeighborhoodRuleErrors).length === 0
    )
  }

  async function handleSave() {
    if (!restaurantId) {
      toast.error("Restaurante não encontrado.")
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
          delivery_fee_mode: settings.deliveryFeeMode,
        })
        .eq("id", restaurantId)
        .eq("owner_id", user.id)

      if (restaurantUpdateError) throw restaurantUpdateError

      if (settings.deliveryFeeMode === "distance") {
        const { error: deleteRulesError } = await supabase
          .from("delivery_distance_rules")
          .delete()
          .eq("restaurant_id", restaurantId)

        if (deleteRulesError) throw deleteRulesError

        const insertPayload = [...rules]
          .sort((a, b) => Number(a.upToKm) - Number(b.upToKm))
          .map((rule, index) => ({
            restaurant_id: restaurantId,
            up_to_km: Number(rule.upToKm),
            fee: Number(rule.fee || 0),
            is_active: Boolean(rule.isActive),
            sort_order: index + 1,
          }))

        if (insertPayload.length > 0) {
          const { error: insertRulesError } = await supabase
            .from("delivery_distance_rules")
            .insert(insertPayload)

          if (insertRulesError) throw insertRulesError
        }
      } else {
        const { error: deleteNeighborhoodRulesError } = await supabase
          .from("delivery_neighborhood_rules")
          .delete()
          .eq("restaurant_id", restaurantId)

        if (deleteNeighborhoodRulesError) throw deleteNeighborhoodRulesError

        const neighborhoodInsertPayload = neighborhoodRules.map(
          (rule, index) => ({
            restaurant_id: restaurantId,
            neighborhood_name: rule.neighborhoodName.trim(),
            fee: Number(rule.fee || 0),
            is_active: Boolean(rule.isActive),
            sort_order: index + 1,
          }),
        )

        if (neighborhoodInsertPayload.length > 0) {
          const { error: insertNeighborhoodRulesError } = await supabase
            .from("delivery_neighborhood_rules")
            .insert(neighborhoodInsertPayload)

          if (insertNeighborhoodRulesError) {
            throw insertNeighborhoodRulesError
          }
        }
      }

      await loadDeliveryData()
      toast.success("Configurações de entrega salvas com sucesso!")
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
            Carregando configurações de entrega...
          </p>
        </div>
      </div>
    )
  }

  const activeRules = rules
    .filter((rule) => rule.isActive)
    .sort((a, b) => Number(a.upToKm) - Number(b.upToKm))

  const maximumDeliveryDistance =
    activeRules.length > 0
      ? Number(activeRules[activeRules.length - 1].upToKm)
      : 0

  const activeNeighborhoodCount = neighborhoodRules.filter(
    (rule) => rule.isActive,
  ).length

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2">
          <Truck className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h3 className="text-base font-bold text-card-foreground">
            Operação da entrega
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Pedido mínimo" error={settingErrors.minimumOrder}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={settings.minimumOrder}
              onChange={(e) => updateSetting("minimumOrder", e.target.value)}
              className={cn(
                "input-field",
                settingErrors.minimumOrder && "border-destructive",
              )}
              placeholder="0.00"
            />
          </Field>

          <Field
            label="Tempo estimado"
            error={settingErrors.estimatedDeliveryTime}
          >
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
                  settingErrors.estimatedDeliveryTime && "border-destructive",
                )}
                placeholder="30-45 min"
              />
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-2">
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
        <div className="mb-5 flex items-start gap-2">
          <MapPin className="mt-0.5 h-5 w-5 text-[hsl(var(--primary))]" />
          <div>
            <h3 className="text-base font-bold text-card-foreground">
              Como calcular a taxa de entrega
            </h3>
            <p className="text-sm text-muted-foreground">
              Escolha o modelo que será usado no cardápio e no checkout.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => updateSetting("deliveryFeeMode", "distance")}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors",
              settings.deliveryFeeMode === "distance"
                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5"
                : "border-border bg-background hover:bg-muted/40",
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  settings.deliveryFeeMode === "distance"
                    ? "border-[hsl(var(--primary))]"
                    : "border-border",
                )}
              >
                {settings.deliveryFeeMode === "distance" ? (
                  <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--primary))]" />
                ) : null}
              </span>
              <div>
                <p className="text-sm font-bold text-card-foreground">
                  Por quilometragem
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  A taxa muda conforme a distância entre o restaurante e o
                  endereço do cliente.
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => updateSetting("deliveryFeeMode", "neighborhood")}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors",
              settings.deliveryFeeMode === "neighborhood"
                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5"
                : "border-border bg-background hover:bg-muted/40",
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  settings.deliveryFeeMode === "neighborhood"
                    ? "border-[hsl(var(--primary))]"
                    : "border-border",
                )}
              >
                {settings.deliveryFeeMode === "neighborhood" ? (
                  <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--primary))]" />
                ) : null}
              </span>
              <div>
                <p className="text-sm font-bold text-card-foreground">
                  Por bairro
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  O restaurante cadastra os bairros atendidos e define uma taxa
                  para cada um.
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {settings.deliveryFeeMode === "distance" ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-5 w-5 text-[hsl(var(--primary))]" />
              <div>
                <h3 className="text-base font-bold text-card-foreground">
                  Faixas de distância
                </h3>
                <p className="text-sm text-muted-foreground">
                  Defina quanto o cliente paga de acordo com a distância da
                  rota.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={addRule}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-card-foreground transition-colors hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
              Adicionar faixa
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
                      Faixa {index + 1}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Exemplo: até 2 km por R$ 5,00
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
                  <Field label="Até quantos km" error={ruleErrors[rule.id]}>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={rule.upToKm}
                        onChange={(e) =>
                          updateRule(rule.id, "upToKm", e.target.value)
                        }
                        className={cn(
                          "input-field pr-12",
                          ruleErrors[rule.id] && "border-destructive",
                        )}
                        placeholder="1"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                        km
                      </span>
                    </div>
                  </Field>

                  <Field label="Taxa de entrega">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                        R$
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rule.fee}
                        onChange={(e) =>
                          updateRule(rule.id, "fee", e.target.value)
                        }
                        className={cn(
                          "input-field pl-10",
                          ruleErrors[rule.id] && "border-destructive",
                        )}
                        placeholder="5.00"
                      />
                    </div>
                  </Field>

                  <div className="md:col-span-2">
                    <ToggleCard
                      title="Faixa ativa"
                      description="Se desligar, essa faixa não será usada no cálculo"
                      checked={Boolean(rule.isActive)}
                      onChange={(checked) =>
                        updateRule(rule.id, "isActive", checked)
                      }
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
                  Limite atual da entrega
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {maximumDeliveryDistance > 0
                    ? `A maior faixa ativa é de ${maximumDeliveryDistance.toLocaleString(
                        "pt-BR",
                      )} km. Endereços acima desse limite serão bloqueados no checkout.`
                    : "Nenhuma faixa ativa. A entrega ficará indisponível até você ativar pelo menos uma faixa."}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-5 w-5 text-[hsl(var(--primary))]" />
              <div>
                <h3 className="text-base font-bold text-card-foreground">
                  Taxas por bairro
                </h3>
                <p className="text-sm text-muted-foreground">
                  Cadastre os bairros atendidos e a taxa de entrega de cada um.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={addNeighborhoodRule}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-card-foreground transition-colors hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
              Adicionar bairro
            </button>
          </div>

          <div className="space-y-4">
            {neighborhoodRules.map((rule, index) => (
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
                      Exemplo: Centro por R$ 5,00
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeNeighborhoodRule(rule.id)}
                    disabled={neighborhoodRules.length === 1}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remover
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Nome do bairro"
                    error={neighborhoodRuleErrors[rule.id]}
                  >
                    <input
                      type="text"
                      value={rule.neighborhoodName}
                      onChange={(e) =>
                        updateNeighborhoodRule(
                          rule.id,
                          "neighborhoodName",
                          e.target.value,
                        )
                      }
                      className={cn(
                        "input-field",
                        neighborhoodRuleErrors[rule.id] && "border-destructive",
                      )}
                      placeholder="Centro"
                    />
                  </Field>

                  <Field label="Taxa de entrega">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                        R$
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rule.fee}
                        onChange={(e) =>
                          updateNeighborhoodRule(rule.id, "fee", e.target.value)
                        }
                        className={cn(
                          "input-field pl-10",
                          neighborhoodRuleErrors[rule.id] &&
                            "border-destructive",
                        )}
                        placeholder="5.00"
                      />
                    </div>
                  </Field>

                  <div className="md:col-span-2">
                    <ToggleCard
                      title="Bairro ativo"
                      description="Se desligar, esse bairro não será oferecido no checkout"
                      checked={Boolean(rule.isActive)}
                      onChange={(checked) =>
                        updateNeighborhoodRule(rule.id, "isActive", checked)
                      }
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
                  Cobertura atual da entrega
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {activeNeighborhoodCount > 0
                    ? `${activeNeighborhoodCount} ${
                        activeNeighborhoodCount === 1
                          ? "bairro está ativo"
                          : "bairros estão ativos"
                      } para entrega.`
                    : "Nenhum bairro ativo. A entrega ficará indisponível até você ativar pelo menos um bairro."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
          {saving ? "Salvando..." : "Salvar entrega"}
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