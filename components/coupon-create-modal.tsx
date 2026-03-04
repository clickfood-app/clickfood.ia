"use client"

import { useState } from "react"
import {
  Clock,
  Hash,
  Link2,
  Mail,
  Megaphone,
  MessageCircle,
  Percent,
  Search,
  Tag,
  UserCheck,
  Zap,
  X,
  Bot,
  Bell,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  Coupon,
  CouponType,
  DiscountType,
  AutoTrigger,
  ExclusiveCoupon,
  ExclusiveReason,
  SendChannel,
} from "@/lib/coupons-data"
import { autoTriggerLabels, exclusiveReasonLabels } from "@/lib/coupons-data"
import { MOCK_CLIENTS, type Client } from "@/lib/clients-data"

interface CouponCreateModalProps {
  open: boolean
  onClose: () => void
  onSave: (coupon: Coupon) => void
  onSaveExclusive?: (coupon: ExclusiveCoupon) => void
}

const typeOptions: { value: CouponType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "manual", label: "Manual", icon: <Tag className="h-5 w-5" />, desc: "Codigo personalizado" },
  { value: "automatico", label: "Automatico", icon: <Bot className="h-5 w-5" />, desc: "Sem codigo, ativado por regra" },
  { value: "relampago", label: "Relampago", icon: <Zap className="h-5 w-5" />, desc: "Valido por poucas horas" },
  { value: "campanha", label: "Campanha", icon: <Megaphone className="h-5 w-5" />, desc: "Link rastreavel" },
  { value: "exclusivo", label: "Exclusivo", icon: <UserCheck className="h-5 w-5" />, desc: "Vinculado a um cliente" },
]

export default function CouponCreateModal({ open, onClose, onSave, onSaveExclusive }: CouponCreateModalProps) {
  const [couponType, setCouponType] = useState<CouponType>("manual")
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [discountType, setDiscountType] = useState<DiscountType>("percentual")
  const [discountValue, setDiscountValue] = useState(10)
  const [minOrder, setMinOrder] = useState(0)
  const [maxUses, setMaxUses] = useState(100)
  const [maxPerClient, setMaxPerClient] = useState(1)
  const [expiresAt, setExpiresAt] = useState("")
  // Auto-specific
  const [autoTrigger, setAutoTrigger] = useState<AutoTrigger>("primeiro_pedido")
  const [autoParam, setAutoParam] = useState(30)
  // Relampago
  const [durationHours, setDurationHours] = useState(4)
  const [notifyClients, setNotifyClients] = useState(true)
  // Campanha
  const [campaignName, setCampaignName] = useState("")
  const [origin, setOrigin] = useState("Instagram")
  // Exclusivo
  const [clientSearch, setClientSearch] = useState("")
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [exclusiveReason, setExclusiveReason] = useState<ExclusiveReason>("fidelidade")
  const [sendChannels, setSendChannels] = useState<SendChannel[]>(["whatsapp"])
  const [autoCode, setAutoCode] = useState(true)

  const filteredClients = MOCK_CLIENTS.filter((c) => {
    if (!clientSearch.trim()) return false
    const q = clientSearch.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email?.toLowerCase().includes(q) ?? false)
    )
  }).slice(0, 5)

  const toggleChannel = (ch: SendChannel) => {
    setSendChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    )
  }

  const generateCode = (client: Client | null) => {
    if (!client) return ""
    const first = client.name.split(" ")[0].toUpperCase().slice(0, 5)
    return `${first}${discountValue}${discountType === "percentual" ? "OFF" : "R"}`
  }

  if (!open) return null

  const handleSave = () => {
    if (couponType === "exclusivo") {
      if (!selectedClient) return
      const finalCode = autoCode ? generateCode(selectedClient) : code
      const newExclusive: ExclusiveCoupon = {
        id: `exc-${Date.now()}`,
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        code: finalCode || `EXC${Date.now().toString().slice(-5)}`,
        discountType,
        discountValue,
        minOrder,
        maxUses: maxPerClient || 1,
        usedCount: 0,
        reason: exclusiveReason,
        status: "ativo",
        createdAt: new Date().toISOString().split("T")[0],
        expiresAt: expiresAt || "2026-12-31",
        sendChannels,
        revenueGenerated: 0,
      }
      onSaveExclusive?.(newExclusive)
      onClose()
      return
    }

    const newCoupon: Coupon = {
      id: `cup-${Date.now()}`,
      name: name || "Novo Cupom",
      code: couponType === "automatico" ? null : code || null,
      type: couponType,
      discountType,
      discountValue,
      minOrder,
      maxUses: couponType === "automatico" ? 0 : maxUses,
      maxPerClient,
      usedCount: 0,
      status: "ativo",
      createdAt: new Date().toISOString().split("T")[0],
      expiresAt: expiresAt || "2026-12-31",
      revenueGenerated: 0,
      ...(couponType === "automatico" && { autoTrigger, autoParam }),
      ...(couponType === "relampago" && { durationHours, notifyClients }),
      ...(couponType === "campanha" && {
        campaignName,
        shareLink: `https://clickfood.com.br/c/${code || "LINK"}`,
        origin,
      }),
    }
    onSave(newCoupon)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-card-foreground">Criar Novo Cupom</h2>
            <p className="text-sm text-muted-foreground">Configure o tipo e as regras do cupom</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Type selector */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-card-foreground">Tipo do Cupom</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCouponType(opt.value)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all",
                    couponType === opt.value
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <span className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    couponType === opt.value
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "bg-secondary text-muted-foreground"
                  )}>
                    {opt.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Common fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">Nome do cupom</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Desconto de Boas-Vindas"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              />
            </div>

            {couponType !== "automatico" && (
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-card-foreground">
                  <Hash className="h-3.5 w-3.5" /> Codigo
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="BEMVINDO10"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono text-foreground uppercase placeholder:text-muted-foreground focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-card-foreground">
                <Percent className="h-3.5 w-3.5" /> Tipo de desconto
              </label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              >
                <option value="percentual">Percentual (%)</option>
                <option value="fixo">Valor fixo (R$)</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                Valor do desconto
              </label>
              <input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                min={1}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                Pedido minimo (R$)
              </label>
              <input
                type="number"
                value={minOrder}
                onChange={(e) => setMinOrder(Number(e.target.value))}
                min={0}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                Data de validade
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              />
            </div>

            {couponType !== "automatico" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                  Limite de uso total
                </label>
                <input
                  type="number"
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number(e.target.value))}
                  min={0}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                Limite por cliente
              </label>
              <input
                type="number"
                value={maxPerClient}
                onChange={(e) => setMaxPerClient(Number(e.target.value))}
                min={0}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              />
            </div>
          </div>

          {/* Type-specific fields */}
          {couponType === "automatico" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-4">
              <p className="text-sm font-semibold text-blue-800">Regra de ativacao automatica</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <select
                    value={autoTrigger}
                    onChange={(e) => setAutoTrigger(e.target.value as AutoTrigger)}
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-foreground focus:border-[hsl(var(--primary))] focus:outline-none"
                  >
                    {Object.entries(autoTriggerLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                {(autoTrigger === "inativo_dias" || autoTrigger === "pedido_acima" || autoTrigger === "vip") && (
                  <div className="col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-blue-800">
                      {autoTrigger === "inativo_dias" ? "Dias de inatividade" :
                       autoTrigger === "pedido_acima" ? "Valor minimo do pedido (R$)" :
                       "Minimo de pedidos para ser VIP"}
                    </label>
                    <input
                      type="number"
                      value={autoParam}
                      onChange={(e) => setAutoParam(Number(e.target.value))}
                      min={1}
                      className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-foreground focus:border-[hsl(var(--primary))] focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {couponType === "relampago" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-4">
              <p className="text-sm font-semibold text-amber-800">Configuracoes Relampago</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-amber-800">
                    <Clock className="h-3.5 w-3.5" /> Duracao (horas)
                  </label>
                  <input
                    type="number"
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    min={1}
                    max={24}
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-foreground focus:border-[hsl(var(--primary))] focus:outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-800">
                    <input
                      type="checkbox"
                      checked={notifyClients}
                      onChange={(e) => setNotifyClients(e.target.checked)}
                      className="h-4 w-4 rounded border-amber-300 accent-[hsl(var(--primary))]"
                    />
                    Notificar clientes
                  </label>
                </div>
              </div>
            </div>
          )}

          {couponType === "campanha" && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-4">
              <p className="text-sm font-semibold text-green-800">Configuracoes de Campanha</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-green-800">
                    <Megaphone className="h-3.5 w-3.5" /> Nome da campanha
                  </label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="Promo Verao 2026"
                    className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--primary))] focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-green-800">
                    <Link2 className="h-3.5 w-3.5" /> Origem do trafego
                  </label>
                  <select
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-foreground focus:border-[hsl(var(--primary))] focus:outline-none"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Facebook">Facebook</option>
                    <option value="TikTok">TikTok</option>
                    <option value="Google">Google</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {couponType === "exclusivo" && (
            <div className="rounded-xl border border-[hsl(var(--primary))]/30 bg-blue-50 p-4 space-y-4">
              <p className="text-sm font-semibold text-blue-800">Cupom Exclusivo por Cliente</p>

              {/* Client search */}
              <div className="relative">
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-blue-800">
                  <UserCheck className="h-3.5 w-3.5" /> Selecionar cliente
                </label>
                {selectedClient ? (
                  <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-white px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{selectedClient.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedClient.phone} {selectedClient.email ? `- ${selectedClient.email}` : ""}</p>
                    </div>
                    <button
                      onClick={() => { setSelectedClient(null); setClientSearch("") }}
                      className="rounded-md p-1 text-muted-foreground hover:bg-blue-100 hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true) }}
                      onFocus={() => setShowClientDropdown(true)}
                      placeholder="Buscar por nome, telefone ou email..."
                      className="w-full rounded-lg border border-blue-200 bg-white py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--primary))] focus:outline-none"
                    />
                    {showClientDropdown && filteredClients.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
                        {filteredClients.map((client) => (
                          <button
                            key={client.id}
                            onClick={() => {
                              setSelectedClient(client)
                              setClientSearch("")
                              setShowClientDropdown(false)
                            }}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-xs font-bold text-[hsl(var(--primary))]">
                              {client.name.split(" ").map(n => n[0]).join("").slice(0,2)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-card-foreground">{client.name}</p>
                              <p className="text-xs text-muted-foreground">{client.phone}</p>
                            </div>
                            <span className={cn(
                              "ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium",
                              client.status === "ativo" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            )}>
                              {client.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-blue-800">Motivo do cupom</label>
                <select
                  value={exclusiveReason}
                  onChange={(e) => setExclusiveReason(e.target.value as ExclusiveReason)}
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-foreground focus:border-[hsl(var(--primary))] focus:outline-none"
                >
                  {Object.entries(exclusiveReasonLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Code type */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-blue-800">Codigo do cupom</label>
                <div className="flex items-center gap-3 mb-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-blue-700">
                    <input
                      type="radio"
                      checked={autoCode}
                      onChange={() => setAutoCode(true)}
                      className="accent-[hsl(var(--primary))]"
                    />
                    Automatico
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-blue-700">
                    <input
                      type="radio"
                      checked={!autoCode}
                      onChange={() => setAutoCode(false)}
                      className="accent-[hsl(var(--primary))]"
                    />
                    Personalizado
                  </label>
                </div>
                {autoCode ? (
                  <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-mono text-muted-foreground">
                    {selectedClient ? generateCode(selectedClient) : "Selecione um cliente..."}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="CODIGO123"
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-mono text-foreground uppercase placeholder:text-muted-foreground focus:border-[hsl(var(--primary))] focus:outline-none"
                  />
                )}
              </div>

              {/* Send channels */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-blue-800">Enviar via</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "whatsapp" as SendChannel, label: "WhatsApp", icon: <MessageCircle className="h-3.5 w-3.5" /> },
                    { value: "notificacao" as SendChannel, label: "Notificacao", icon: <Bell className="h-3.5 w-3.5" /> },
                    { value: "email" as SendChannel, label: "Email", icon: <Mail className="h-3.5 w-3.5" /> },
                  ]).map((ch) => (
                    <button
                      key={ch.value}
                      onClick={() => toggleChannel(ch.value)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                        sendChannels.includes(ch.value)
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                          : "border-blue-200 bg-white text-muted-foreground hover:border-blue-300"
                      )}
                    >
                      {ch.icon}
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-[hsl(var(--primary))] px-5 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90"
          >
            Criar Cupom
          </button>
        </div>
      </div>
    </div>
  )
}
