"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bot,
  Clock,
  Hash,
  Mail,
  Megaphone,
  MessageCircle,
  Percent,
  Search,
  Tag,
  UserCheck,
  X,
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
  CouponStatus,
} from "@/lib/coupons-data"
import { autoTriggerLabels, exclusiveReasonLabels } from "@/lib/coupons-data"
import { MOCK_CLIENTS, type Client } from "@/lib/clients-data"

interface CouponCreateModalProps {
  open: boolean
  onClose: () => void
  onSave: (coupon: Coupon) => void | Promise<void>
  onSaveExclusive?: (coupon: ExclusiveCoupon) => void | Promise<void>
}

type CouponCreateForm = {
  type: CouponType
  title: string
  code: string
  description: string
  discountType: DiscountType
  discountValue: number
  minOrderValue: number
  maxDiscountValue: number
  usageLimit: number
  status: CouponStatus
  startsAt: string
  expiresAt: string

  autoTrigger?: AutoTrigger
  triggerValue?: number

  durationHours?: number

  exclusiveReason?: ExclusiveReason
  selectedClients: string[]
  channel: SendChannel[]
}

const typeOptions: { value: CouponType; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    value: "manual",
    label: "Manual",
    icon: <Tag className="h-4 w-4" />,
    desc: "Cupom aplicado manualmente pelo cliente",
  },
  {
    value: "automatico",
    label: "Automático",
    icon: <Bot className="h-4 w-4" />,
    desc: "Cupom ativado por regras automáticas",
  },
  {
    value: "relampago",
    label: "Relâmpago",
    icon: <Clock className="h-4 w-4" />,
    desc: "Promoção com duração curta",
  },
  {
    value: "campanha",
    label: "Campanha",
    icon: <Megaphone className="h-4 w-4" />,
    desc: "Cupom para divulgação e tráfego",
  },
  {
    value: "exclusivo",
    label: "Exclusivo",
    icon: <UserCheck className="h-4 w-4" />,
    desc: "Cupom enviado para clientes específicos",
  },
]

const discountTypeOptions: { value: DiscountType; label: string; icon: React.ReactNode }[] = [
  {
    value: "percentual",
    label: "Percentual",
    icon: <Percent className="h-4 w-4" />,
  },
  {
    value: "fixo",
    label: "Valor fixo",
    icon: <Hash className="h-4 w-4" />,
  },
]

const channelOptions: { value: SendChannel; label: string; icon: React.ReactNode }[] = [
  { value: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="h-4 w-4" /> },
  { value: "email", label: "Email", icon: <Mail className="h-4 w-4" /> },
  { value: "notificacao", label: "Notificação", icon: <Bell className="h-4 w-4" /> },
]

const initialForm: CouponCreateForm = {
  type: "manual",
  title: "",
  code: "",
  description: "",
  discountType: "percentual",
  discountValue: 10,
  minOrderValue: 0,
  maxDiscountValue: 0,
  usageLimit: 0,
  status: "ativo",
  startsAt: "",
  expiresAt: "",
  autoTrigger: "primeiro_pedido",
  triggerValue: 0,
  durationHours: 6,
  exclusiveReason: "manual",
  selectedClients: [],
  channel: ["whatsapp"],
}

function generateId() {
  return crypto.randomUUID()
}

function toNumber(value: string | number | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function CouponCreateModal({
  open,
  onClose,
  onSave,
  onSaveExclusive,
}: CouponCreateModalProps) {
  const [form, setForm] = useState<CouponCreateForm>(initialForm)
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setForm(initialForm)
      setSearch("")
      setSaving(false)
    }
  }, [open])

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return MOCK_CLIENTS

    return MOCK_CLIENTS.filter((client) => {
      return (
        client.name.toLowerCase().includes(term) ||
        client.phone?.toLowerCase().includes(term) ||
        client.email?.toLowerCase().includes(term)
      )
    })
  }, [search])

  const setField = <K extends keyof CouponCreateForm>(field: K, value: CouponCreateForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const toggleClient = (clientId: string) => {
    setForm((prev) => ({
      ...prev,
      selectedClients: prev.selectedClients.includes(clientId)
        ? prev.selectedClients.filter((id) => id !== clientId)
        : [...prev.selectedClients, clientId],
    }))
  }

  const toggleChannel = (channel: SendChannel) => {
    setForm((prev) => ({
      ...prev,
      channel: prev.channel.includes(channel)
        ? prev.channel.filter((item) => item !== channel)
        : [...prev.channel, channel],
    }))
  }

  const buildBaseCoupon = (): Coupon => {
    return {
      id: generateId(),
      code:
        form.type === "automatico"
          ? ""
          : form.code.trim().toUpperCase(),
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      type: form.type,
      status: form.status,
      discountType: form.discountType,
      discountValue: toNumber(form.discountValue),
      minOrderValue: form.minOrderValue > 0 ? toNumber(form.minOrderValue) : undefined,
      maxDiscountValue: form.maxDiscountValue > 0 ? toNumber(form.maxDiscountValue) : undefined,
      usageLimit: form.usageLimit > 0 ? toNumber(form.usageLimit) : undefined,
      usedCount: 0,
      validFrom: form.startsAt || undefined,
      validUntil: form.expiresAt || undefined,
      createdAt: new Date().toISOString(),

      autoTrigger: form.type === "automatico" ? form.autoTrigger : undefined,
      triggerValue:
        form.type === "automatico" && form.triggerValue !== undefined
          ? toNumber(form.triggerValue)
          : undefined,

      audience:
        form.type === "campanha"
          ? "Campanha"
          : form.type === "relampago"
            ? "Oferta relâmpago"
            : undefined,

      channel:
        form.type === "campanha" ||
        form.type === "automatico" ||
        form.type === "relampago"
          ? form.channel
          : undefined,
    }
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) return

    if (
      (form.type === "manual" || form.type === "campanha" || form.type === "exclusivo") &&
      !form.code.trim()
    ) {
      return
    }

    if (form.type === "exclusivo") {
      if (!onSaveExclusive) return
      if (!form.selectedClients.length) return

      const firstSelectedClient = MOCK_CLIENTS.find((client) =>
        form.selectedClients.includes(client.id)
      )

      const exclusiveCoupon: ExclusiveCoupon = {
        id: generateId(),
        code: form.code.trim().toUpperCase(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        discountType: form.discountType,
        discountValue: toNumber(form.discountValue),
        minOrderValue: form.minOrderValue > 0 ? toNumber(form.minOrderValue) : undefined,
        maxDiscountValue: form.maxDiscountValue > 0 ? toNumber(form.maxDiscountValue) : undefined,
        status: form.status,
        reason: form.exclusiveReason || "manual",
        sendChannels: form.channel,
        customerName: firstSelectedClient?.name ?? undefined,
        customerPhone: firstSelectedClient?.phone ?? undefined,
        customerEmail: firstSelectedClient?.email ?? undefined,
        validUntil: form.expiresAt || undefined,
        createdAt: new Date().toISOString(),
      }

      try {
        setSaving(true)
        await onSaveExclusive(exclusiveCoupon)
        onClose()
      } finally {
        setSaving(false)
      }

      return
    }

    const coupon = buildBaseCoupon()

    try {
      setSaving(true)
      await onSave(coupon)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#111827] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold">Criar cupom</h2>
            <p className="text-sm text-white/60">Configure o tipo de oferta e as regras do cupom.</p>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[85vh] overflow-y-auto px-6 py-6">
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.9fr]">
            <div className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">
                  Tipo de cupom
                </h3>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {typeOptions.map((option) => {
                    const active = form.type === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setField("type", option.value)}
                        className={cn(
                          "rounded-2xl border p-4 text-left transition",
                          active
                            ? "border-violet-400 bg-violet-500/15"
                            : "border-white/10 bg-white/5 hover:bg-white/10"
                        )}
                      >
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                          <span className="text-violet-300">{option.icon}</span>
                          <span>{option.label}</span>
                        </div>
                        <p className="text-sm text-white/60">{option.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm text-white/70">Título</label>
                  <input
                    value={form.title}
                    onChange={(e) => setField("title", e.target.value)}
                    placeholder="Ex: 10% OFF no primeiro pedido"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-violet-400"
                  />
                </div>

                {(form.type === "manual" || form.type === "campanha" || form.type === "exclusivo") && (
                  <div className="space-y-2">
                    <label className="text-sm text-white/70">Código</label>
                    <input
                      value={form.code}
                      onChange={(e) => setField("code", e.target.value.toUpperCase())}
                      placeholder="Ex: BEMVINDO10"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 uppercase outline-none transition focus:border-violet-400"
                    />
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm text-white/70">Descrição</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    rows={3}
                    placeholder="Descreva a campanha ou a condição do cupom"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-violet-400"
                  />
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">
                  Desconto
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm text-white/70">Tipo de desconto</label>
                    <div className="grid gap-3 md:grid-cols-2">
                      {discountTypeOptions.map((option) => {
                        const active = form.discountType === option.value

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setField("discountType", option.value)}
                            className={cn(
                              "flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition",
                              active
                                ? "border-violet-400 bg-violet-500/15"
                                : "border-white/10 bg-white/5 hover:bg-white/10"
                            )}
                          >
                            <span className="text-violet-300">{option.icon}</span>
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-white/70">
                      {form.discountType === "percentual" ? "Percentual (%)" : "Valor (R$)"}
                    </label>
                    <input
                      type="number"
                      value={form.discountValue}
                      onChange={(e) => setField("discountValue", toNumber(e.target.value))}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-violet-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-white/70">Pedido mínimo (R$)</label>
                    <input
                      type="number"
                      value={form.minOrderValue}
                      onChange={(e) => setField("minOrderValue", toNumber(e.target.value))}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-violet-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-white/70">Desconto máximo (R$)</label>
                    <input
                      type="number"
                      value={form.maxDiscountValue}
                      onChange={(e) => setField("maxDiscountValue", toNumber(e.target.value))}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-violet-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-white/70">Limite de uso</label>
                    <input
                      type="number"
                      value={form.usageLimit}
                      onChange={(e) => setField("usageLimit", toNumber(e.target.value))}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-violet-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-white/70">Início</label>
                    <input
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(e) => setField("startsAt", e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-violet-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-white/70">Expiração</label>
                    <input
                      type="datetime-local"
                      value={form.expiresAt}
                      onChange={(e) => setField("expiresAt", e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-violet-400"
                    />
                  </div>
                </div>
              </section>

              {form.type === "automatico" && (
                <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">
                    Regra automática
                  </h3>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm text-white/70">Gatilho</label>
                      <select
                        value={form.autoTrigger}
                        onChange={(e) => setField("autoTrigger", e.target.value as AutoTrigger)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-violet-400"
                      >
                        {Object.entries(autoTriggerLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm text-white/70">Valor do gatilho</label>
                      <input
                        type="number"
                        value={form.triggerValue ?? 0}
                        onChange={(e) => setField("triggerValue", toNumber(e.target.value))}
                        placeholder="Ex: 30 dias ou R$ 80"
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-violet-400"
                      />
                    </div>
                  </div>
                </section>
              )}

              {form.type === "relampago" && (
                <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">
                    Configuração relâmpago
                  </h3>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm text-white/70">Duração (horas)</label>
                      <input
                        type="number"
                        value={form.durationHours ?? 0}
                        onChange={(e) => setField("durationHours", toNumber(e.target.value))}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-violet-400"
                      />
                    </div>
                  </div>
                </section>
              )}

              {form.type === "campanha" && (
                <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">
                    Configuração da campanha
                  </h3>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                    Cupons de campanha usam o mesmo schema dos cupons normais. O detalhamento
                    de tráfego e origem pode ser tratado depois em uma tabela separada, sem
                    quebrar este módulo.
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-6">
              {form.type === "exclusivo" && (
                <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/70">
                    Público exclusivo
                  </h3>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm text-white/70">Motivo</label>
                      <select
                        value={form.exclusiveReason}
                        onChange={(e) =>
                          setField("exclusiveReason", e.target.value as ExclusiveReason)
                        }
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-violet-400"
                      >
                        {Object.entries(exclusiveReasonLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm text-white/70">Canal de envio</label>
                      <div className="grid gap-2">
                        {channelOptions.map((item) => {
                          const active = form.channel.includes(item.value)

                          return (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => toggleChannel(item.value)}
                              className={cn(
                                "flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm transition",
                                active
                                  ? "border-violet-400 bg-violet-500/15"
                                  : "border-white/10 bg-white/5 hover:bg-white/10"
                              )}
                            >
                              <span className="text-violet-300">{item.icon}</span>
                              {item.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm text-white/70">Buscar clientes</label>

                      <div className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Buscar por nome, email ou telefone"
                          className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 outline-none transition focus:border-violet-400"
                        />
                      </div>

                      <div className="max-h-80 space-y-2 overflow-y-auto">
                        {filteredClients.map((client: Client) => {
                          const selected = form.selectedClients.includes(client.id)

                          return (
                            <button
                              key={client.id}
                              type="button"
                              onClick={() => toggleClient(client.id)}
                              className={cn(
                                "w-full rounded-2xl border p-3 text-left transition",
                                selected
                                  ? "border-violet-400 bg-violet-500/15"
                                  : "border-white/10 bg-white/5 hover:bg-white/10"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{client.name}</p>
                                  <p className="text-sm text-white/60">
                                    {client.email || client.phone || "Sem contato"}
                                  </p>
                                </div>

                                <div
                                  className={cn(
                                    "h-5 w-5 rounded-full border",
                                    selected
                                      ? "border-violet-400 bg-violet-400"
                                      : "border-white/20"
                                  )}
                                />
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      <p className="text-sm text-white/60">
                        {form.selectedClients.length} cliente(s) selecionado(s)
                      </p>
                    </div>
                  </div>
                </section>
              )}

              <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/70">
                  Resumo
                </h3>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Tipo</span>
                    <span className="font-medium">
                      {typeOptions.find((item) => item.value === form.type)?.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Desconto</span>
                    <span className="font-medium">
                      {form.discountType === "percentual"
                        ? `${form.discountValue}%`
                        : `R$ ${form.discountValue}`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Pedido mínimo</span>
                    <span className="font-medium">R$ {form.minOrderValue}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Uso total</span>
                    <span className="font-medium">{form.usageLimit || "Ilimitado"}</span>
                  </div>

                  {form.type === "exclusivo" && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Clientes</span>
                      <span className="font-medium">{form.selectedClients.length}</span>
                    </div>
                  )}

                  {form.type === "automatico" && form.autoTrigger && (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-white/70">
                      Gatilho:{" "}
                      <span className="font-medium text-white">
                        {autoTriggerLabels[form.autoTrigger]}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/70">
                  Status ao salvar
                </h3>

                <div className="grid gap-2">
                  {(["ativo", "pausado"] as CouponStatus[]).map((status) => {
                    const active = form.status === status

                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setField("status", status)}
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-left text-sm transition",
                          active
                            ? "border-violet-400 bg-violet-500/15"
                            : "border-white/10 bg-white/5 hover:bg-white/10"
                        )}
                      >
                        {status === "ativo" ? "Ativo ao salvar" : "Salvar pausado"}
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-2xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar cupom"}
          </button>
        </div>
      </div>
    </div>
  )
}