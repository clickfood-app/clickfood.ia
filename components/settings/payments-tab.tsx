"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import {
  CreditCard,
  GripVertical,
  Loader2,
  Plus,
  QrCode,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth/auth-provider"
import { createClient } from "@/lib/supabase/client"
import {
  type PaymentMethod,
  defaultPaymentMethods,
  generatePaymentId,
} from "@/lib/settings-data"

type EfiEnvironment = "sandbox" | "production"

type EfiAccountResponse = {
  success: boolean
  connected: boolean
  account: {
    id: string
    restaurantId: string
    provider: "efi"
    enabled: boolean
    environment: EfiEnvironment
    clientIdLast4: string | null
    clientSecretLast4: string | null
    pixKey: string | null
    pixKeyLast4: string | null
    hasClientId: boolean
    hasClientSecret: boolean
    hasPixKey: boolean
    hasCertificate: boolean
    certificateFileName: string | null
    lastConnectionTestAt: string | null
    lastConnectionError: string | null
    createdAt: string | null
    updatedAt: string | null
    readyToEnable: boolean
  } | null
  error?: string
  message?: string
}

type EfiFormState = {
  enabled: boolean
  environment: EfiEnvironment
  clientId: string
  clientSecret: string
  pixKey: string
}

type PixKeyType = "cpf" | "cnpj" | "phone" | "email" | "random"

type PixSettingsForm = {
  pixEnabled: boolean
  pixKeyType: PixKeyType
  pixKey: string
  pixReceiverName: string
  pixReceiverCity: string
  pixInstructions: string
}

const emptyEfiForm: EfiFormState = {
  enabled: false,
  environment: "production",
  clientId: "",
  clientSecret: "",
  pixKey: "",
}

const emptyPixForm: PixSettingsForm = {
  pixEnabled: false,
  pixKeyType: "random",
  pixKey: "",
  pixReceiverName: "",
  pixReceiverCity: "",
  pixInstructions:
    "Após realizar o Pix, clique em Já paguei e envie o comprovante para conferência.",
}

const pixKeyTypeOptions: Array<{ value: PixKeyType; label: string }> = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "phone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "random", label: "Chave aleatória" },
]

export default function PaymentsTab() {
  const { restaurant } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const [methods, setMethods] = useState<PaymentMethod[]>(defaultPaymentMethods)
  const [saving, setSaving] = useState(false)

  const [loadingPix, setLoadingPix] = useState(true)
  const [savingPix, setSavingPix] = useState(false)
  const [pixForm, setPixForm] = useState<PixSettingsForm>(emptyPixForm)

  const [loadingEfi, setLoadingEfi] = useState(true)
  const [savingEfi, setSavingEfi] = useState(false)
  const [uploadingEfiCertificate, setUploadingEfiCertificate] = useState(false)
  const [efiConnected, setEfiConnected] = useState(false)
  const [savedEfiAccount, setSavedEfiAccount] =
    useState<EfiAccountResponse["account"]>(null)
  const [efiForm, setEfiForm] = useState<EfiFormState>(emptyEfiForm)
  const [editingEfi, setEditingEfi] = useState(false)

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

  function updatePixForm<K extends keyof PixSettingsForm>(
    key: K,
    value: PixSettingsForm[K]
  ) {
    setPixForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateEfiForm<K extends keyof EfiFormState>(
    key: K,
    value: EfiFormState[K]
  ) {
    setEfiForm((prev) => ({ ...prev, [key]: value }))
  }

  async function readApiJson<T>(response: Response) {
    const rawText = await response.text()

    if (!rawText) return null

    try {
      return JSON.parse(rawText) as T
    } catch {
      return null
    }
  }

  function getApiErrorMessage(
    data: { error?: unknown; message?: unknown } | null,
    fallback: string
  ) {
    const error = data?.error ?? data?.message

    if (typeof error === "string" && error.trim()) {
      return error
    }

    if (typeof error === "object" && error !== null) {
      const objectError = error as { message?: unknown; error_description?: unknown }

      if (typeof objectError.message === "string" && objectError.message.trim()) {
        return objectError.message
      }

      if (
        typeof objectError.error_description === "string" &&
        objectError.error_description.trim()
      ) {
        return objectError.error_description
      }
    }

    return fallback
  }

  async function loadPixSettings() {
    if (!restaurant?.id) {
      setLoadingPix(false)
      return
    }

    try {
      setLoadingPix(true)

      const { data, error } = await supabase
        .from("restaurants")
        .select(
          "pix_enabled, pix_key, pix_key_type, pix_receiver_name, pix_receiver_city, pix_instructions, name, city"
        )
        .eq("id", restaurant.id)
        .single()

      if (error) throw error

      setPixForm({
        pixEnabled: data?.pix_enabled === true,
        pixKeyType: (data?.pix_key_type as PixKeyType) || "random",
        pixKey: data?.pix_key || "",
        pixReceiverName: data?.pix_receiver_name || data?.name || "",
        pixReceiverCity: data?.pix_receiver_city || data?.city || "BRASIL",
        pixInstructions:
          data?.pix_instructions ||
          "Após realizar o Pix, clique em Já paguei e envie o comprovante para conferência.",
      })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao carregar configurações do Pix direto."
      )
    } finally {
      setLoadingPix(false)
    }
  }

  async function handleSavePixSettings() {
    if (!restaurant?.id) {
      toast.error("Restaurante não identificado.")
      return
    }

    const pixKey = pixForm.pixKey.trim()
    const pixReceiverName = pixForm.pixReceiverName.trim()
    const pixReceiverCity = pixForm.pixReceiverCity.trim().toUpperCase()
    const pixInstructions = pixForm.pixInstructions.trim()

    if (pixForm.pixEnabled) {
      if (!pixKey) {
        toast.error("Informe a chave Pix para ativar o Pix Direto.")
        return
      }

      if (!pixReceiverName) {
        toast.error("Informe o nome do recebedor Pix.")
        return
      }

      if (!pixReceiverCity) {
        toast.error("Informe a cidade do recebedor Pix.")
        return
      }
    }

    try {
      setSavingPix(true)

      const { error } = await supabase
        .from("restaurants")
        .update({
          pix_enabled: pixForm.pixEnabled,
          pix_key: pixKey || null,
          pix_key_type: pixForm.pixKeyType,
          pix_receiver_name: pixReceiverName || null,
          pix_receiver_city: pixReceiverCity || null,
          pix_instructions: pixInstructions || null,
        })
        .eq("id", restaurant.id)

      if (error) throw error

      setPixForm((prev) => ({
        ...prev,
        pixKey,
        pixReceiverName,
        pixReceiverCity,
        pixInstructions,
      }))

      toast.success("Pix Direto salvo com sucesso.")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao salvar Pix Direto."
      )
    } finally {
      setSavingPix(false)
    }
  }

  async function handleTogglePixEnabled(nextEnabled: boolean) {
    if (!restaurant?.id) {
      toast.error("Restaurante não identificado.")
      return
    }

    const previousPixForm = pixForm
    const pixKey = pixForm.pixKey.trim()
    const pixReceiverName = pixForm.pixReceiverName.trim()
    const pixReceiverCity = pixForm.pixReceiverCity.trim().toUpperCase()
    const pixInstructions = pixForm.pixInstructions.trim()

    if (nextEnabled) {
      if (!pixKey) {
        toast.error("Informe a chave Pix para ativar o Pix Direto.")
        return
      }

      if (!pixReceiverName) {
        toast.error("Informe o nome do recebedor Pix.")
        return
      }

      if (!pixReceiverCity) {
        toast.error("Informe a cidade do recebedor Pix.")
        return
      }
    }

    try {
      setSavingPix(true)
      setPixForm((prev) => ({ ...prev, pixEnabled: nextEnabled }))

      const updatePayload = nextEnabled
        ? {
            pix_enabled: true,
            pix_key: pixKey || null,
            pix_key_type: pixForm.pixKeyType,
            pix_receiver_name: pixReceiverName || null,
            pix_receiver_city: pixReceiverCity || null,
            pix_instructions: pixInstructions || null,
          }
        : {
            pix_enabled: false,
          }

      const { error } = await supabase
        .from("restaurants")
        .update(updatePayload)
        .eq("id", restaurant.id)

      if (error) throw error

      setPixForm((prev) => ({
        ...prev,
        pixEnabled: nextEnabled,
        ...(nextEnabled
          ? {
              pixKey,
              pixReceiverName,
              pixReceiverCity,
              pixInstructions,
            }
          : {}),
      }))

      toast.success(
        nextEnabled ? "Pix Direto ativado." : "Pix Direto desativado."
      )
    } catch (error) {
      setPixForm(previousPixForm)
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao alterar Pix Direto."
      )
    } finally {
      setSavingPix(false)
    }
  }

  async function loadEfiAccount() {
    try {
      setLoadingEfi(true)

      const res = await fetch("/api/efi/account", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })

      const data = await readApiJson<EfiAccountResponse>(res)

      if (!res.ok || !data) {
        throw new Error(
          getApiErrorMessage(data, "Erro ao carregar conta Efí.")
        )
      }

      setEfiConnected(Boolean(data.connected))
      setSavedEfiAccount(data.account)
      setEfiForm({
        enabled: Boolean(data.account?.enabled),
        environment: data.account?.environment ?? "production",
        clientId: "",
        clientSecret: "",
        pixKey: data.account?.pixKey ?? "",
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar conta Efí."
      )
    } finally {
      setLoadingEfi(false)
    }
  }

  async function handleSaveEfiAccount() {
    const clientId = efiForm.clientId.trim()
    const clientSecret = efiForm.clientSecret.trim()
    const pixKey = efiForm.pixKey.trim()

    if (efiForm.enabled) {
      if (!clientId && !savedEfiAccount?.hasClientId) {
        toast.error("Informe o Client ID da Efí.")
        return
      }

      if (!clientSecret && !savedEfiAccount?.hasClientSecret) {
        toast.error("Informe o Client Secret da Efí.")
        return
      }

      if (!pixKey && !savedEfiAccount?.hasPixKey) {
        toast.error("Informe a chave Pix da conta Efí.")
        return
      }

      if (!savedEfiAccount?.hasCertificate) {
        toast.error("Envie o certificado .p12 antes de ativar o Pix automático.")
        return
      }
    }

    try {
      setSavingEfi(true)

      const payload: {
        enabled: boolean
        environment: EfiEnvironment
        clientId?: string
        clientSecret?: string
        pixKey?: string
      } = {
        enabled: efiForm.enabled,
        environment: efiForm.environment,
      }

      if (clientId) payload.clientId = clientId
      if (clientSecret) payload.clientSecret = clientSecret
      if (pixKey) payload.pixKey = pixKey

      const res = await fetch("/api/efi/account", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await readApiJson<EfiAccountResponse>(res)

      if (!res.ok || !data) {
        throw new Error(
          getApiErrorMessage(data, "Erro ao salvar conta Efí.")
        )
      }

      setEfiConnected(Boolean(data?.connected))
      setSavedEfiAccount(data?.account ?? null)
      setEfiForm((prev) => ({
        ...prev,
        clientId: "",
        clientSecret: "",
        pixKey: data?.account?.pixKey ?? pixKey,
      }))

      toast.success("Conta Efí salva com sucesso.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar Efí.")
    } finally {
      setSavingEfi(false)
    }
  }

  async function handleUploadEfiCertificate(file: File | null) {
    if (!file) return

    if (!file.name.toLowerCase().endsWith(".p12")) {
      toast.error("Envie um certificado no formato .p12.")
      return
    }

    try {
      setUploadingEfiCertificate(true)

      const formData = new FormData()
      formData.append("certificate", file)

      const res = await fetch("/api/efi/account/certificate", {
        method: "POST",
        credentials: "include",
        body: formData,
      })

      const data = await readApiJson<EfiAccountResponse>(res)

      if (!res.ok || !data) {
        throw new Error(
          getApiErrorMessage(data, "Erro ao enviar certificado Efí.")
        )
      }

      setEfiConnected(Boolean(data?.connected))
      setSavedEfiAccount(data?.account ?? null)
      setEfiForm((prev) => ({
        ...prev,
        enabled: Boolean(data?.account?.enabled),
        environment: data?.account?.environment ?? prev.environment,
        pixKey: data?.account?.pixKey ?? prev.pixKey,
      }))

      toast.success("Certificado Efí enviado com sucesso.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao enviar certificado Efí."
      )
    } finally {
      setUploadingEfiCertificate(false)
    }
  }

  useEffect(() => {
    void loadEfiAccount()
  }, [restaurant?.id])

  useEffect(() => {
    void loadPixSettings()
  }, [restaurant?.id])

  async function handleToggleEfiEnabled(nextEnabled: boolean) {
    if (!nextEnabled) {
      try {
        setSavingEfi(true)
        setEfiForm((prev) => ({ ...prev, enabled: false }))

        const res = await fetch("/api/efi/account", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: false,
            environment: efiForm.environment,
          }),
        })

        const data = await readApiJson<EfiAccountResponse>(res)

        if (!res.ok || !data) {
          throw new Error(
            getApiErrorMessage(data, "Erro ao desativar Pix automático Efí.")
          )
        }

        setEfiConnected(Boolean(data?.connected))
        setSavedEfiAccount(data?.account ?? null)
        toast.success("Pix automático desativado.")
      } catch (error) {
        setEfiForm((prev) => ({ ...prev, enabled: true }))
        toast.error(
          error instanceof Error
            ? error.message
            : "Erro ao desativar Pix automático Efí."
        )
      } finally {
        setSavingEfi(false)
      }

      return
    }

    if (!savedEfiAccount?.readyToEnable) {
      toast.error("Conecte a conta Efí antes de ativar o Pix automático.")
      setEditingEfi(true)
      return
    }

    try {
      setSavingEfi(true)
      setEfiForm((prev) => ({ ...prev, enabled: true }))

      const res = await fetch("/api/efi/account", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          environment: efiForm.environment,
        }),
      })

      const data = await readApiJson<EfiAccountResponse>(res)

      if (!res.ok || !data) {
        throw new Error(
          getApiErrorMessage(data, "Erro ao ativar Pix automático Efí.")
        )
      }

      setEfiConnected(Boolean(data?.connected))
      setSavedEfiAccount(data?.account ?? null)
      toast.success("Pix automático ativado.")
    } catch (error) {
      setEfiForm((prev) => ({ ...prev, enabled: false }))
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao ativar Pix automático Efí."
      )
    } finally {
      setSavingEfi(false)
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
      <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-yellow-400" />
              <h3 className="text-base font-bold text-card-foreground">
                Pix automático
              </h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Receba Pix direto na conta Efí. O pedido só aparece no painel
              depois que o pagamento for confirmado.
            </p>
          </div>

          {loadingEfi ? (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-400/30 bg-[#0A0A0A] px-3 py-2 text-sm font-semibold text-yellow-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-yellow-400/30 bg-[#0A0A0A] px-3 py-2">
              <span className="text-sm font-semibold text-yellow-400">
                {efiForm.enabled ? "Ativo" : "Desativado"}
              </span>
              <Switch
                checked={efiForm.enabled}
                onCheckedChange={(checked) => void handleToggleEfiEnabled(checked)}
                disabled={savingEfi || uploadingEfiCertificate}
              />
            </div>
          )}
        </div>

        {!loadingEfi ? (
          <div className="mt-4 rounded-lg border border-yellow-400/30 bg-[#0A0A0A] p-4">
            {savedEfiAccount?.readyToEnable ? (
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-bold text-yellow-400">
                    {efiForm.enabled ? "Pix automático ativo" : "Pix automático desativado"}
                  </p>
                  <p className="mt-1 text-sm text-yellow-400">
                    {efiForm.enabled
                      ? "Os pedidos pagos por Pix entram automaticamente no painel."
                      : "Sua conta Efí está conectada. Ative para receber Pix automático."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingEfi((current) => !current)}
                  className="rounded-lg border border-yellow-400/30 bg-[#0A0A0A] px-4 py-2 text-sm font-semibold text-yellow-400 transition-colors hover:bg-yellow-400/10"
                >
                  {editingEfi ? "Ocultar configuração" : "Alterar conexão"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-bold text-yellow-400">
                    Pix automático não configurado
                  </p>
                  <p className="mt-1 text-sm text-yellow-400">
                    Conecte a conta Efí para liberar Pix automático no checkout.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingEfi(true)}
                  className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-black shadow-sm transition-opacity hover:opacity-90"
                >
                  Conectar conta Efí
                </button>
              </div>
            )}
          </div>
        ) : null}

        {editingEfi ? (
          <div className="mt-5 rounded-xl border border-yellow-400/30 bg-[#0A0A0A] p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-card-foreground">
                  Configuração avançada
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Esses dados ficam protegidos e só precisam ser alterados na conexão da Efí.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingEfi(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Fechar configuração avançada"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ambiente da Efí
                </label>
                <select
                  value={efiForm.environment}
                  onChange={(event) =>
                    updateEfiForm("environment", event.target.value as EfiEnvironment)
                  }
                  className="input-field"
                  disabled={savingEfi}
                >
                  <option value="sandbox">Homologação</option>
                  <option value="production">Produção</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Chave Pix da conta Efí
                </label>
                <input
                  type="text"
                  value={efiForm.pixKey}
                  onChange={(event) => updateEfiForm("pixKey", event.target.value)}
                  className="input-field"
                  placeholder="Cole a chave Pix cadastrada na Efí"
                  disabled={savingEfi}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Client ID
                </label>
                <input
                  type="password"
                  value={efiForm.clientId}
                  onChange={(event) => updateEfiForm("clientId", event.target.value)}
                  className="input-field"
                  placeholder={
                    savedEfiAccount?.clientIdLast4
                      ? `Deixe vazio para manter o atual — final ${savedEfiAccount.clientIdLast4}`
                      : "Cole o Client ID da Efí"
                  }
                  disabled={savingEfi}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Client Secret
                </label>
                <input
                  type="password"
                  value={efiForm.clientSecret}
                  onChange={(event) => updateEfiForm("clientSecret", event.target.value)}
                  className="input-field"
                  placeholder={
                    savedEfiAccount?.clientSecretLast4
                      ? `Deixe vazio para manter o atual — final ${savedEfiAccount.clientSecretLast4}`
                      : "Cole o Client Secret da Efí"
                  }
                  disabled={savingEfi}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Certificado .p12
              </label>
              <input
                type="file"
                accept=".p12"
                className="input-field file:mr-3 file:rounded-md file:border-0 file:bg-yellow-400 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-black"
                disabled={uploadingEfiCertificate}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  void handleUploadEfiCertificate(file)
                  event.currentTarget.value = ""
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Certificado atual: {savedEfiAccount?.certificateFileName || "não enviado"}
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={handleSaveEfiAccount}
                disabled={savingEfi || uploadingEfiCertificate}
                className="flex items-center gap-2 rounded-lg bg-yellow-400 px-5 py-2.5 text-sm font-semibold text-black shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingEfi ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {savingEfi ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-5">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-bold text-card-foreground">
                Pix Direto sem taxa
              </h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              O cliente paga direto na chave Pix do restaurante, envia o
              comprovante e o pagamento é confirmado manualmente no painel.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-emerald-400/30 bg-[#0A0A0A] px-3 py-2">
            <span className="text-sm font-semibold text-emerald-400">
              {pixForm.pixEnabled ? "Ativo" : "Inativo"}
            </span>
            <Switch
              checked={pixForm.pixEnabled}
              onCheckedChange={(checked) => void handleTogglePixEnabled(checked)}
              disabled={loadingPix || savingPix}
            />
          </div>
        </div>

        {loadingPix ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-[#0A0A0A] px-3 py-4 text-sm font-semibold text-emerald-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando configurações do Pix Direto...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tipo da chave Pix
                </label>
                <select
                  value={pixForm.pixKeyType}
                  onChange={(event) =>
                    updatePixForm("pixKeyType", event.target.value as PixKeyType)
                  }
                  className="input-field"
                  disabled={savingPix}
                >
                  {pixKeyTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Chave Pix
                </label>
                <input
                  type="text"
                  value={pixForm.pixKey}
                  onChange={(event) => updatePixForm("pixKey", event.target.value)}
                  className="input-field"
                  placeholder="Cole a chave Pix do restaurante"
                  disabled={savingPix}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Nome do recebedor
                </label>
                <input
                  type="text"
                  value={pixForm.pixReceiverName}
                  onChange={(event) =>
                    updatePixForm("pixReceiverName", event.target.value)
                  }
                  className="input-field"
                  placeholder="Ex: Gelin Do Lucão"
                  disabled={savingPix}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cidade do recebedor
                </label>
                <input
                  type="text"
                  value={pixForm.pixReceiverCity}
                  onChange={(event) =>
                    updatePixForm("pixReceiverCity", event.target.value.toUpperCase())
                  }
                  className="input-field"
                  placeholder="Ex: BELO HORIZONTE"
                  disabled={savingPix}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Instrução para o cliente
              </label>
              <textarea
                value={pixForm.pixInstructions}
                onChange={(event) =>
                  updatePixForm("pixInstructions", event.target.value)
                }
                rows={3}
                className="input-field min-h-[92px] resize-none"
                placeholder="Explique para o cliente como pagar e enviar o comprovante."
                disabled={savingPix}
              />
            </div>

            <div className="mt-4 rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
                <div>
                  <p className="text-sm font-semibold text-yellow-400">
                    Conferência manual obrigatória
                  </p>
                  <p className="mt-1 text-sm text-yellow-400">
                    O QR Code facilita o pagamento, mas não confirma sozinho. O
                    restaurante deve conferir valor, data, horário e destinatário
                    no comprovante antes de confirmar o Pix no painel.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={handleSavePixSettings}
                disabled={savingPix}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingPix ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {savingPix ? "Salvando Pix..." : "Salvar Pix Direto"}
              </button>
            </div>
          </>
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