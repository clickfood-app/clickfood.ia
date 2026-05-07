"use client"

import { useState, useCallback, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import {
  CreditCard,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  type PaymentMethod,
  defaultPaymentMethods,
  generatePaymentId,
} from "@/lib/settings-data"
import { useAuth } from "@/components/auth/auth-provider"
import { createClient } from "@/lib/supabase/client"

type StripeStatusResponse = {
  connected: boolean
  stripeAccountId: string | null
  onboardingCompleted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  requirements: {
    currentlyDue: string[]
    eventuallyDue: string[]
    pastDue: string[]
    pendingVerification: string[]
    disabledReason: string | null
  } | null
  capabilities: {
    card_payments: string | null
    transfers: string | null
  } | null
}

const defaultStripeStatus: StripeStatusResponse = {
  connected: false,
  stripeAccountId: null,
  onboardingCompleted: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
  requirements: null,
  capabilities: null,
}

export default function PaymentsTab() {
  const [methods, setMethods] = useState<PaymentMethod[]>(defaultPaymentMethods)
  const [saving, setSaving] = useState(false)
  const [stripeStatus, setStripeStatus] =
    useState<StripeStatusResponse>(defaultStripeStatus)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [stripeConnecting, setStripeConnecting] = useState(false)

  const { restaurant } = useAuth()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const toggleMethod = useCallback((id: string) => {
    setMethods((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    )
  }, [])

  const updateMethod = useCallback(
    (id: string, key: keyof PaymentMethod, value: string | number) => {
      setMethods((prev) =>
        prev.map((m) => (m.id === id ? { ...m, [key]: value } : m))
      )
    },
    []
  )

  function addMethod() {
    const newMethod: PaymentMethod = {
      id: generatePaymentId(),
      name: "",
      enabled: true,
      fee: 0,
      notes: "",
    }

    setMethods((prev) => [...prev, newMethod])
    toast.info("Nova forma de pagamento adicionada. Preencha os dados.")
  }

  function removeMethod(id: string) {
    setMethods((prev) => prev.filter((m) => m.id !== id))
    toast.success("Forma de pagamento removida.")
  }

  async function handleSave() {
    const emptyNames = methods.filter((m) => !m.name.trim())

    if (emptyNames.length > 0) {
      toast.error("Preencha o nome de todas as formas de pagamento.")
      return
    }

    setSaving(true)
    await new Promise((r) => setTimeout(r, 1200))
    setSaving(false)
    toast.success("Formas de pagamento salvas!")
  }

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error || !session?.access_token) {
      throw new Error("Sessao nao encontrada. Faca login novamente.")
    }

    return session.access_token
  }, [supabase])

  const fetchStripeStatus = useCallback(async () => {
    if (!restaurant?.id) {
      setStripeStatus(defaultStripeStatus)
      return
    }

    try {
      setStripeLoading(true)
      const token = await getAccessToken()

      const response = await fetch(
        `/api/stripe/status?restaurantId=${restaurant.id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao consultar status da Stripe.")
      }

      setStripeStatus({
        connected: !!data.connected,
        stripeAccountId: data.stripeAccountId ?? null,
        onboardingCompleted: !!data.onboardingCompleted,
        chargesEnabled: !!data.chargesEnabled,
        payoutsEnabled: !!data.payoutsEnabled,
        detailsSubmitted: !!data.detailsSubmitted,
        requirements: data.requirements ?? null,
        capabilities: data.capabilities ?? null,
      })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao consultar status da Stripe."
      )
    } finally {
      setStripeLoading(false)
    }
  }, [getAccessToken, restaurant?.id])

  const handleConnectStripe = useCallback(async () => {
    if (!restaurant?.id) {
      toast.error("Restaurante nao encontrado.")
      return
    }

    try {
      setStripeConnecting(true)
      const token = await getAccessToken()

      const response = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          restaurantId: restaurant.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao iniciar onboarding da Stripe.")
      }

      if (!data?.onboardingUrl) {
        throw new Error("Stripe nao retornou a URL de onboarding.")
      }

      window.location.href = data.onboardingUrl
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao conectar com a Stripe."
      )
      setStripeConnecting(false)
    }
  }, [getAccessToken, restaurant?.id])

  useEffect(() => {
    fetchStripeStatus()
  }, [fetchStripeStatus])

  useEffect(() => {
    const stripeParam = searchParams.get("stripe")

    if (stripeParam === "return") {
      toast.success("Retorno da Stripe recebido. Atualizando status...")
      fetchStripeStatus()
      window.history.replaceState({}, "", "/configuracoes?tab=payments")
    }

    if (stripeParam === "refresh") {
      toast.info("Continue o onboarding da Stripe para concluir a integracao.")
      window.history.replaceState({}, "", "/configuracoes?tab=payments")
    }
  }, [fetchStripeStatus, searchParams])

  const enabledCount = methods.filter((m) => m.enabled).length
  const stripeReady =
    stripeStatus.connected &&
    stripeStatus.onboardingCompleted &&
    stripeStatus.chargesEnabled &&
    stripeStatus.payoutsEnabled

  return (
    <div className="space-y-6">
      {restaurant && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
                <CreditCard className="h-6 w-6 text-violet-600" />
              </div>

              <div>
                <h3 className="text-base font-bold text-card-foreground">
                  Stripe Connect
                </h3>
                <p className="text-sm text-muted-foreground">
                  Conecte a conta do restaurante para receber pagamentos online.
                </p>

                {stripeStatus.stripeAccountId && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Conta Stripe: {stripeStatus.stripeAccountId}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {stripeReady ? (
                <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-semibold text-green-700">
                    Conta ativa
                  </span>
                </div>
              ) : stripeStatus.connected ? (
                <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700">
                    Onboarding pendente
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5">
                  <AlertCircle className="h-4 w-4 text-gray-500" />
                  <span className="text-xs font-semibold text-gray-600">
                    Nao conectada
                  </span>
                </div>
              )}

              <button
                onClick={fetchStripeStatus}
                disabled={stripeLoading}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {stripeLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Atualizar status
              </button>

              {!stripeReady && (
                <button
                  onClick={handleConnectStripe}
                  disabled={stripeConnecting}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all",
                    "bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  {stripeConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4" />
                      {stripeStatus.connected
                        ? "Continuar onboarding"
                        : "Conectar Stripe"}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Dados enviados
              </p>
              <p className="mt-1 text-sm font-bold text-card-foreground">
                {stripeStatus.detailsSubmitted ? "Sim" : "Nao"}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Pagamentos
              </p>
              <p className="mt-1 text-sm font-bold text-card-foreground">
                {stripeStatus.chargesEnabled ? "Liberados" : "Pendente"}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Repasses
              </p>
              <p className="mt-1 text-sm font-bold text-card-foreground">
                {stripeStatus.payoutsEnabled ? "Liberados" : "Pendente"}
              </p>
            </div>
          </div>

          {!stripeReady && (
            <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
              <div>
                <p className="text-sm font-bold text-amber-800">
                  A conta ainda esta pendente na Stripe
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Abaixo esta o motivo real retornado pela Stripe para a conta
                  ainda nao ficar ativa.
                </p>
              </div>

              {stripeStatus.requirements?.disabledReason && (
                <div className="rounded-lg bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Motivo do bloqueio
                  </p>
                  <p className="mt-1 text-sm font-medium text-card-foreground">
                    {stripeStatus.requirements.disabledReason}
                  </p>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Capability card_payments
                  </p>
                  <p className="mt-1 text-sm font-bold text-card-foreground">
                    {stripeStatus.capabilities?.card_payments ?? "null"}
                  </p>
                </div>

                <div className="rounded-lg bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Capability transfers
                  </p>
                  <p className="mt-1 text-sm font-bold text-card-foreground">
                    {stripeStatus.capabilities?.transfers ?? "null"}
                  </p>
                </div>
              </div>

              {stripeStatus.requirements?.currentlyDue?.length ? (
                <div className="rounded-lg bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Falta enviar agora
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-card-foreground">
                    {stripeStatus.requirements.currentlyDue.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {stripeStatus.requirements?.pendingVerification?.length ? (
                <div className="rounded-lg bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Em verificacao
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-card-foreground">
                    {stripeStatus.requirements.pendingVerification.map(
                      (item) => (
                        <li key={item}>• {item}</li>
                      )
                    )}
                  </ul>
                </div>
              ) : null}

              {stripeStatus.requirements?.pastDue?.length ? (
                <div className="rounded-lg bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Pendencias vencidas
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-card-foreground">
                    {stripeStatus.requirements.pastDue.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-[hsl(var(--primary))]" />
          <span className="text-sm font-bold text-card-foreground">
            {methods.length} formas cadastradas
          </span>
          <span className="text-xs text-muted-foreground">
            ({enabledCount} ativas)
          </span>
        </div>

        <button
          onClick={addMethod}
          className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary))]/5"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </button>
      </div>

      <div className="space-y-3">
        {methods.map((method) => (
          <div
            key={method.id}
            className={cn(
              "rounded-xl border bg-card p-5 transition-all",
              method.enabled ? "border-border" : "border-border/50 opacity-60"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="mt-2 flex-shrink-0 text-muted-foreground/40">
                <GripVertical className="h-5 w-5" />
              </div>

              <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-4">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={method.name}
                    onChange={(e) =>
                      updateMethod(method.id, "name", e.target.value)
                    }
                    className="input-field"
                    placeholder="Ex: Pix"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Taxa (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={method.fee}
                    onChange={(e) =>
                      updateMethod(
                        method.id,
                        "fee",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="input-field"
                    placeholder="0"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Observacao
                  </label>
                  <input
                    type="text"
                    value={method.notes}
                    onChange={(e) =>
                      updateMethod(method.id, "notes", e.target.value)
                    }
                    className="input-field"
                    placeholder="Opcional"
                  />
                </div>

                <div className="flex items-end justify-end gap-3 md:col-span-2">
                  <Switch
                    checked={method.enabled}
                    onCheckedChange={() => toggleMethod(method.id)}
                  />
                  <button
                    onClick={() => removeMethod(method.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {methods.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-12">
          <CreditCard className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Nenhuma forma de pagamento cadastrada
          </p>
          <button
            onClick={addMethod}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-xs font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar Primeira
          </button>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Salvando..." : "Salvar Alteracoes"}
        </button>
      </div>
    </div>
  )
}