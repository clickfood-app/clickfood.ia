"use client"

import { useState, useCallback, useEffect } from "react"
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  type PaymentMethod,
  defaultPaymentMethods,
  generatePaymentId,
} from "@/lib/settings-data"

type AsaasAccountResponse = {
  connected: boolean
  account: {
    environment: "sandbox" | "production"
    walletId: string | null
    userAgent: string | null
    apiKeyLast4: string | null
    webhookTokenLast4: string | null
    isActive: boolean
    connectedAt: string | null
    lastTestedAt: string | null
    lastError: string | null
    createdAt: string | null
    updatedAt: string | null
  } | null
  error?: string
}

export default function PaymentsTab() {
  const [methods, setMethods] = useState<PaymentMethod[]>(defaultPaymentMethods)
  const [saving, setSaving] = useState(false)

  const [loadingAsaas, setLoadingAsaas] = useState(true)
  const [asaasConnected, setAsaasConnected] = useState(false)
  const [savedAccount, setSavedAccount] =
    useState<AsaasAccountResponse["account"]>(null)

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

  async function loadAsaasAccount() {
    try {
      setLoadingAsaas(true)

      const res = await fetch("/api/asaas/account", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })

      const data = (await res.json()) as AsaasAccountResponse

      if (!res.ok) {
        throw new Error(data.error || "Erro ao carregar conta Asaas.")
      }

      setAsaasConnected(data.connected)
      setSavedAccount(data.account)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar conta Asaas."
      )
    } finally {
      setLoadingAsaas(false)
    }
  }

  useEffect(() => {
    loadAsaasAccount()
  }, [])

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

  const enabledCount = methods.filter((m) => m.enabled).length

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[hsl(var(--primary))]" />
              <h3 className="text-base font-bold text-card-foreground">
                Conta Asaas do restaurante
              </h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              O recebimento online é feito diretamente na conta Asaas conectada
              ao restaurante.
            </p>
          </div>

          {loadingAsaas ? (
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando
            </div>
          ) : asaasConnected && savedAccount?.isActive ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Conectada
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
              <AlertCircle className="h-4 w-4" />
              Não conectada
            </div>
          )}
        </div>

        {savedAccount ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ambiente
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {savedAccount.environment === "production"
                    ? "Produção"
                    : "Sandbox"}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  API Key
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {savedAccount.apiKeyLast4
                    ? `Final ${savedAccount.apiKeyLast4}`
                    : "Não informada"}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Webhook
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {savedAccount.webhookTokenLast4
                    ? `Final ${savedAccount.webhookTokenLast4}`
                    : "Não informado"}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {savedAccount.isActive ? "Ativa" : "Inativa"}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                A conexão da conta Asaas é gerenciada internamente pela
                ClickFood. Se precisar alterar ou reconectar a conta, entre em
                contato com o suporte.
              </p>
            </div>

            {savedAccount.lastError ? (
              <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                  Último erro
                </p>
                <p className="mt-1 text-sm text-destructive">
                  {savedAccount.lastError}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">
              Nenhuma conta Asaas conectada no momento. Para ativar o Pix
              online, solicite a conexão da conta ao suporte da ClickFood.
            </p>
          </div>
        )}
      </div>

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
                    Observação
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
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>
    </div>
  )
}