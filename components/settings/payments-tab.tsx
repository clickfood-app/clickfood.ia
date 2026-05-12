"use client"

import { useState, useCallback, useEffect } from "react"
import {
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
  const [savingAsaas, setSavingAsaas] = useState(false)
  const [asaasConnected, setAsaasConnected] = useState(false)
  const [savedAccount, setSavedAccount] = useState<AsaasAccountResponse["account"]>(null)

  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox")
  const [apiKey, setApiKey] = useState("")
  const [webhookToken, setWebhookToken] = useState("")
  const [walletId, setWalletId] = useState("")

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

      if (data.account) {
        setEnvironment(data.account.environment || "sandbox")
        setWalletId(data.account.walletId || "")
      }
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

  async function handleSaveAsaas() {
    if (!apiKey.trim()) {
      toast.error("Preencha a API Key do Asaas.")
      return
    }

    if (!webhookToken.trim()) {
      toast.error("Preencha o token do webhook do Asaas.")
      return
    }

    try {
      setSavingAsaas(true)

      const res = await fetch("/api/asaas/account", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          environment,
          apiKey: apiKey.trim(),
          webhookToken: webhookToken.trim(),
          walletId: walletId.trim() || null,
          userAgent: "clickfood",
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Erro ao salvar conta Asaas.")
      }

      toast.success("Conta Asaas salva com sucesso.")

      setApiKey("")
      setWebhookToken("")

      await loadAsaasAccount()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar conta Asaas."
      )
    } finally {
      setSavingAsaas(false)
    }
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
              Conecte a conta do próprio restaurante para gerar Pix direto nela.
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
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
              Não conectada
            </div>
          )}
        </div>

        {savedAccount && (
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ambiente atual
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {savedAccount.environment === "production" ? "Produção" : "Sandbox"}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                API Key
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {savedAccount.apiKeyLast4
                  ? `Final ${savedAccount.apiKeyLast4}`
                  : "Não salva"}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Webhook
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {savedAccount.webhookTokenLast4
                  ? `Final ${savedAccount.webhookTokenLast4}`
                  : "Não salvo"}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Wallet ID
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">
                {savedAccount.walletId || "Não informado"}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ambiente
            </label>
            <select
              value={environment}
              onChange={(e) =>
                setEnvironment(e.target.value === "production" ? "production" : "sandbox")
              }
              className="input-field"
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Produção</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Wallet ID (opcional)
            </label>
            <input
              type="text"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              className="input-field"
              placeholder="Opcional"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              API Key do Asaas
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="input-field"
              placeholder={
                savedAccount?.apiKeyLast4
                  ? `Já salva • final ${savedAccount.apiKeyLast4}`
                  : "Cole a API Key"
              }
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Token do webhook
            </label>
            <input
              type="password"
              value={webhookToken}
              onChange={(e) => setWebhookToken(e.target.value)}
              className="input-field"
              placeholder={
                savedAccount?.webhookTokenLast4
                  ? `Já salvo • final ${savedAccount.webhookTokenLast4}`
                  : "Cole o token do webhook"
              }
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSaveAsaas}
            disabled={savingAsaas}
            className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {savingAsaas ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {savingAsaas ? "Salvando conta..." : "Salvar conta Asaas"}
          </button>
        </div>
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