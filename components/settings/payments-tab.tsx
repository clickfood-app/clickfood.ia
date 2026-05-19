"use client"

import { useState, useCallback, useEffect } from "react"
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  type PaymentMethod,
  defaultPaymentMethods,
  generatePaymentId,
} from "@/lib/settings-data"

type AsaasEnvironment = "sandbox" | "production"

type AsaasAccountResponse = {
  connected: boolean
  account: {
    environment: AsaasEnvironment
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

type AsaasFormState = {
  environment: AsaasEnvironment
  apiKey: string
  webhookToken: string
  isActive: boolean
}

const emptyAsaasForm: AsaasFormState = {
  environment: "production",
  apiKey: "",
  webhookToken: "",
  isActive: true,
}

export default function PaymentsTab() {
  const [methods, setMethods] = useState<PaymentMethod[]>(defaultPaymentMethods)
  const [saving, setSaving] = useState(false)

  const [loadingAsaas, setLoadingAsaas] = useState(true)
  const [asaasConnected, setAsaasConnected] = useState(false)
  const [savedAccount, setSavedAccount] =
    useState<AsaasAccountResponse["account"]>(null)

  const [editingAsaas, setEditingAsaas] = useState(false)
  const [savingAsaas, setSavingAsaas] = useState(false)
  const [asaasForm, setAsaasForm] = useState<AsaasFormState>(emptyAsaasForm)

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

  function openAsaasEditor() {
    setAsaasForm({
      environment: savedAccount?.environment ?? "production",
      apiKey: "",
      webhookToken: "",
      isActive: savedAccount?.isActive ?? true,
    })

    setEditingAsaas(true)
  }

  async function handleSaveAsaasAccount() {
    const apiKey = asaasForm.apiKey.trim()
    const webhookToken = asaasForm.webhookToken.trim()

    if (!savedAccount?.apiKeyLast4 && !apiKey) {
      toast.error("Informe a API Key do Asaas.")
      return
    }

    if (!savedAccount?.webhookTokenLast4 && !webhookToken) {
      toast.error("Informe o Webhook Token do Asaas.")
      return
    }

    try {
      setSavingAsaas(true)

      const payload: {
        environment: AsaasEnvironment
        isActive: boolean
        apiKey?: string
        webhookToken?: string
      } = {
        environment: asaasForm.environment,
        isActive: asaasForm.isActive,
      }

      if (apiKey) {
        payload.apiKey = apiKey
      }

      if (webhookToken) {
        payload.webhookToken = webhookToken
      }

      const res = await fetch("/api/asaas/account", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = (await res.json().catch(() => null)) as
        | AsaasAccountResponse
        | null

      if (!res.ok) {
        throw new Error(
          data?.error || "Erro ao salvar a conexão Asaas do restaurante."
        )
      }

      setAsaasConnected(data?.connected ?? true)
      setSavedAccount(data?.account ?? null)
      setEditingAsaas(false)
      toast.success("Conexão Asaas atualizada com sucesso.")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao salvar a conexão Asaas."
      )
    } finally {
      setSavingAsaas(false)
    }
  }

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
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
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

          <div className="flex flex-wrap items-center gap-2">
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

            <button
              type="button"
              onClick={openAsaasEditor}
              disabled={loadingAsaas}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Pencil className="h-4 w-4" />
              {savedAccount ? "Editar conexão" : "Conectar Asaas"}
            </button>
          </div>
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
                A conexão da conta Asaas pode ser alterada pelo botão{" "}
                <span className="font-semibold text-foreground">
                  Editar conexão
                </span>
                . Por segurança, a API Key e o Webhook Token completos nunca
                são exibidos na tela.
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
              online, clique em{" "}
              <span className="font-semibold text-foreground">
                Conectar Asaas
              </span>{" "}
              e informe as credenciais do restaurante.
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

      {editingAsaas ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div>
                <h3 className="text-lg font-bold text-card-foreground">
                  Editar conexão Asaas
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Atualize as credenciais usadas para gerar Pix e validar o
                  webhook de pagamento.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingAsaas(false)}
                disabled={savingAsaas}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ambiente
                  </label>
                  <select
                    value={asaasForm.environment}
                    onChange={(e) =>
                      setAsaasForm((prev) => ({
                        ...prev,
                        environment: e.target.value as AsaasEnvironment,
                      }))
                    }
                    className="input-field"
                    disabled={savingAsaas}
                  >
                    <option value="production">Produção</option>
                    <option value="sandbox">Sandbox</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </label>
                  <div className="flex h-10 items-center justify-between rounded-lg border border-border bg-background px-3">
                    <span className="text-sm font-medium text-foreground">
                      {asaasForm.isActive ? "Ativa" : "Inativa"}
                    </span>
                    <Switch
                      checked={asaasForm.isActive}
                      onCheckedChange={(checked) =>
                        setAsaasForm((prev) => ({
                          ...prev,
                          isActive: checked,
                        }))
                      }
                      disabled={savingAsaas}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  API Key do Asaas
                </label>
                <input
                  type="password"
                  value={asaasForm.apiKey}
                  onChange={(e) =>
                    setAsaasForm((prev) => ({
                      ...prev,
                      apiKey: e.target.value,
                    }))
                  }
                  className="input-field"
                  placeholder={
                    savedAccount?.apiKeyLast4
                      ? `Deixe vazio para manter a atual — final ${savedAccount.apiKeyLast4}`
                      : "Cole a API Key do Asaas"
                  }
                  disabled={savingAsaas}
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  A chave completa não será exibida novamente depois de salvar.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Webhook Token do Asaas
                </label>
                <input
                  type="password"
                  value={asaasForm.webhookToken}
                  onChange={(e) =>
                    setAsaasForm((prev) => ({
                      ...prev,
                      webhookToken: e.target.value,
                    }))
                  }
                  className="input-field"
                  placeholder={
                    savedAccount?.webhookTokenLast4
                      ? `Deixe vazio para manter o atual — final ${savedAccount.webhookTokenLast4}`
                      : "Cole o token do webhook"
                  }
                  disabled={savingAsaas}
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Esse token precisa ser o mesmo configurado no webhook dentro
                  do painel do Asaas.
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  Atenção ao webhook em produção
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  No painel do Asaas, a URL precisa apontar para o domínio
                  público da ClickFood, por exemplo:{" "}
                  <span className="font-mono">
                    https://seudominio.com/api/asaas/webhook
                  </span>
                  .
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditingAsaas(false)}
                disabled={savingAsaas}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSaveAsaasAccount}
                disabled={savingAsaas}
                className="flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingAsaas ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {savingAsaas ? "Salvando..." : "Salvar conexão"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}