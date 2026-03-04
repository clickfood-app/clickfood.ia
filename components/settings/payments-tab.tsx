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
  XCircle,
  ExternalLink,
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
import {
  getMercadoPagoAuthUrl,
  isMercadoPagoConnected,
  saveMercadoPagoConnection,
  disconnectMercadoPago,
  type MercadoPagoTokens,
} from "@/lib/mercadopago"

export default function PaymentsTab() {
  const [methods, setMethods] = useState<PaymentMethod[]>(defaultPaymentMethods)
  const [saving, setSaving] = useState(false)
  const [mpConnected, setMpConnected] = useState(false)
  const [mpConnecting, setMpConnecting] = useState(false)
  const { restaurant } = useAuth()
  const searchParams = useSearchParams()

  // Check Mercado Pago connection status on mount
  useEffect(() => {
    if (restaurant?.id) {
      setMpConnected(isMercadoPagoConnected(restaurant.id))
    }
  }, [restaurant?.id])

  // Handle OAuth callback params
  useEffect(() => {
    if (!restaurant?.id) return

    const mpSuccess = searchParams.get("mp_success")
    const mpError = searchParams.get("mp_error")
    const mpDemo = searchParams.get("mp_demo")
    const mpTokens = searchParams.get("mp_tokens")

    if (mpSuccess === "true" && mpTokens) {
      try {
        const tokens: MercadoPagoTokens = JSON.parse(decodeURIComponent(mpTokens))
        saveMercadoPagoConnection(restaurant.id, tokens)
        setMpConnected(true)
        toast.success("Mercado Pago conectado com sucesso!")
        // Clean URL
        window.history.replaceState({}, "", "/configuracoes")
      } catch {
        toast.error("Erro ao processar tokens do Mercado Pago")
      }
    } else if (mpDemo === "true") {
      // Demo mode - simulate connection
      const demoTokens: MercadoPagoTokens = {
        access_token: "DEMO_ACCESS_TOKEN",
        refresh_token: "DEMO_REFRESH_TOKEN",
        expires_in: 15552000,
        connected_at: new Date().toISOString(),
        user_id: 123456789,
      }
      saveMercadoPagoConnection(restaurant.id, demoTokens)
      setMpConnected(true)
      toast.success("Mercado Pago conectado (modo demonstracao)!")
      window.history.replaceState({}, "", "/configuracoes")
    } else if (mpError) {
      toast.error(`Erro ao conectar Mercado Pago: ${mpError}`)
      window.history.replaceState({}, "", "/configuracoes")
    }
  }, [searchParams, restaurant?.id])

  // Connect to Mercado Pago
  const handleConnectMercadoPago = useCallback(() => {
    if (!restaurant?.id) {
      toast.error("Restaurante nao encontrado")
      return
    }
    setMpConnecting(true)
    const authUrl = getMercadoPagoAuthUrl(restaurant.id)
    window.location.href = authUrl
  }, [restaurant?.id])

  // Disconnect from Mercado Pago
  const handleDisconnectMercadoPago = useCallback(() => {
    if (!restaurant?.id) return
    disconnectMercadoPago(restaurant.id)
    setMpConnected(false)
    toast.success("Mercado Pago desconectado")
  }, [restaurant?.id])

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

  const enabledCount = methods.filter((m) => m.enabled).length

  return (
    <div className="space-y-6">
      {/* Mercado Pago Integration */}
      {restaurant && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* MP Logo */}
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#009ee3]/10">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#009ee3">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.5 14.5v-5l4.5 2.5-4.5 2.5zm0-8h3v1h-3v-1z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-card-foreground">Mercado Pago</h3>
                <p className="text-sm text-muted-foreground">
                  {mpConnected
                    ? "Conta conectada - receba pagamentos online"
                    : "Conecte para receber pagamentos via Pix, cartao e boleto"}
                </p>
              </div>
            </div>

            {/* Connection Status & Button */}
            <div className="flex items-center gap-3">
              {mpConnected ? (
                <>
                  <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-semibold text-green-700">Conectado</span>
                  </div>
                  <button
                    onClick={handleDisconnectMercadoPago}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                  >
                    <XCircle className="h-4 w-4" />
                    Desconectar
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnectMercadoPago}
                  disabled={mpConnecting}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all",
                    "bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {mpConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4" />
                      Conectar Mercado Pago
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Info text */}
          {!mpConnected && (
            <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3">
              <p className="text-xs text-blue-700">
                Ao conectar, voce autoriza o ClickFood a processar pagamentos em seu nome. 
                Seus dados estao protegidos pela criptografia do Mercado Pago.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-[hsl(var(--primary))]" />
          <span className="text-sm font-bold text-card-foreground">{methods.length} formas cadastradas</span>
          <span className="text-xs text-muted-foreground">({enabledCount} ativas)</span>
        </div>
        <button
          onClick={addMethod}
          className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary))]/5"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </button>
      </div>

      {/* Methods List */}
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
              {/* Drag Handle */}
              <div className="mt-2 flex-shrink-0 text-muted-foreground/40">
                <GripVertical className="h-5 w-5" />
              </div>

              {/* Content */}
              <div className="flex-1 grid grid-cols-1 gap-4 md:grid-cols-12">
                {/* Name */}
                <div className="md:col-span-4">
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={method.name}
                    onChange={(e) => updateMethod(method.id, "name", e.target.value)}
                    className="input-field"
                    placeholder="Ex: Pix"
                  />
                </div>

                {/* Fee */}
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Taxa (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={method.fee}
                    onChange={(e) => updateMethod(method.id, "fee", parseFloat(e.target.value) || 0)}
                    className="input-field"
                    placeholder="0"
                  />
                </div>

                {/* Notes */}
                <div className="md:col-span-4">
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Observacao
                  </label>
                  <input
                    type="text"
                    value={method.notes}
                    onChange={(e) => updateMethod(method.id, "notes", e.target.value)}
                    className="input-field"
                    placeholder="Opcional"
                  />
                </div>

                {/* Actions */}
                <div className="md:col-span-2 flex items-end gap-3 justify-end">
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
          <CreditCard className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma forma de pagamento cadastrada</p>
          <button
            onClick={addMethod}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-xs font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar Primeira
          </button>
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Salvando..." : "Salvar Alteracoes"}
        </button>
      </div>
    </div>
  )
}
