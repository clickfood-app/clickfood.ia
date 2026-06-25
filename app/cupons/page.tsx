"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import {
  BadgePercent,
  CalendarRange,
  Copy,
  Loader2,
  Plus,
  Search,
  Ticket,
  Trash2,
  Users,
  X,
} from "lucide-react"

type CouponType = "percentage" | "fixed"
type CouponStatus = "active" | "scheduled" | "expired"
type CouponAudienceType =
  | "all"
  | "specific_customer"
  | "returning_customer"
  | "min_orders"

interface Coupon {
  id: string
  restaurant_id: string
  code: string
  title: string
  type: CouponType
  value: number
  minimum_order: number
  usage_limit: number
  used_count: number
  valid_until: string
  status: CouponStatus
  audience_type: CouponAudienceType
  customer_phone: string | null
  min_customer_orders: number
  created_at: string
}

interface CouponFormData {
  code: string
  title: string
  type: CouponType
  value: string
  minimumOrder: string
  usageLimit: string
  validUntil: string
  audienceType: CouponAudienceType
  customerPhone: string
  minCustomerOrders: string
}

const initialFormData: CouponFormData = {
  code: "",
  title: "",
  type: "percentage",
  value: "",
  minimumOrder: "",
  usageLimit: "",
  validUntil: "",
  audienceType: "all",
  customerPhone: "",
  minCustomerOrders: "",
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(date))
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "")
}

function getStatusLabel(status: CouponStatus) {
  if (status === "active") return "Ativo"
  if (status === "scheduled") return "Agendado"
  return "Expirado"
}

function getStatusClass(status: CouponStatus) {
  if (status === "active") return "bg-emerald-500/10 text-emerald-400"
  if (status === "scheduled") return "bg-yellow-400/10 text-yellow-400"
  return "bg-[#111111] text-zinc-500"
}

function getAudienceLabel(coupon: Coupon) {
  if (coupon.audience_type === "specific_customer") {
    return coupon.customer_phone
      ? `Cliente específico: ${coupon.customer_phone}`
      : "Cliente específico"
  }

  if (coupon.audience_type === "returning_customer") {
    return "Apenas clientes que já compraram"
  }

  if (coupon.audience_type === "min_orders") {
    return `Clientes com ${coupon.min_customer_orders} compra(s) ou mais`
  }

  return "Todos os clientes"
}

function CreateCouponModal({
  open,
  formData,
  error,
  isSubmitting,
  onClose,
  onChange,
  onSubmit,
}: {
  open: boolean
  formData: CouponFormData
  error: string
  isSubmitting: boolean
  onClose: () => void
  onChange: (field: keyof CouponFormData, value: string) => void
  onSubmit: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111] p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-[#0A0A0A] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Novo cupom</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Preencha os dados para criar um novo cupom.
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-[#111111] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-145px)] overflow-y-auto">
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-500">
                Código do cupom
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => onChange("code", e.target.value.toUpperCase())}
                placeholder="Ex: BEMVINDO10"
                className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/10"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-500">
                Nome do cupom
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => onChange("title", e.target.value)}
                placeholder="Ex: Cupom de boas-vindas"
                className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/10"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-500">
                Tipo de desconto
              </label>
              <select
                value={formData.type}
                onChange={(e) => onChange("type", e.target.value as CouponType)}
                className="w-full rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/10"
              >
                <option value="percentage">Porcentagem</option>
                <option value="fixed">Valor fixo</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-500">
                Valor do desconto
              </label>
              <input
                type="number"
                min="0"
                value={formData.value}
                onChange={(e) => onChange("value", e.target.value)}
                placeholder={formData.type === "percentage" ? "Ex: 10" : "Ex: 5"}
                className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/10"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-500">
                Pedido mínimo
              </label>
              <input
                type="number"
                min="0"
                value={formData.minimumOrder}
                onChange={(e) => onChange("minimumOrder", e.target.value)}
                placeholder="Ex: 30"
                className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/10"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-500">
                Limite de uso
              </label>
              <input
                type="number"
                min="1"
                value={formData.usageLimit}
                onChange={(e) => onChange("usageLimit", e.target.value)}
                placeholder="Ex: 100"
                className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/10"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-zinc-500">
                Data de validade
              </label>
              <input
                type="date"
                value={formData.validUntil}
                onChange={(e) => onChange("validUntil", e.target.value)}
                className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/10"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-zinc-500">
                Quem pode usar esse cupom?
              </label>

              <select
                value={formData.audienceType}
                onChange={(e) =>
                  onChange("audienceType", e.target.value as CouponAudienceType)
                }
                className="w-full rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/10"
              >
                <option value="all">Todos os clientes</option>
                <option value="specific_customer">
                  Cliente específico pelo telefone
                </option>
                <option value="returning_customer">
                  Apenas clientes que já compraram
                </option>
                <option value="min_orders">
                  Clientes com X compras ou mais
                </option>
              </select>

              <p className="mt-2 text-xs text-zinc-500">
                Essa regra será usada no checkout para bloquear quem não tiver direito ao cupom.
              </p>
            </div>

            {formData.audienceType === "specific_customer" ? (
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-zinc-500">
                  Telefone do cliente
                </label>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => onChange("customerPhone", e.target.value)}
                  placeholder="Ex: 31999999999"
                  className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/10"
                />
              </div>
            ) : null}

            {formData.audienceType === "min_orders" ? (
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-zinc-500">
                  Mínimo de compras do cliente
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.minCustomerOrders}
                  onChange={(e) => onChange("minCustomerOrders", e.target.value)}
                  placeholder="Ex: 3"
                  className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/10"
                />
              </div>
            ) : null}

            {error ? (
              <div className="md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-white/10 bg-[#0A0A0A] px-4 py-2.5 text-sm font-medium text-zinc-500 transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#080808] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {isSubmitting ? "Criando..." : "Criar cupom"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CuponsPage() {
  const supabase = useMemo(() => createClient(), [])

  const [search, setSearch] = useState("")
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState("")

  const [restaurantId, setRestaurantId] = useState<string | null>(null)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<CouponFormData>(initialFormData)
  const [formError, setFormError] = useState("")

  const filteredCoupons = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return coupons

    return coupons.filter(
      (coupon) =>
        coupon.code.toLowerCase().includes(query) ||
        coupon.title.toLowerCase().includes(query) ||
        getAudienceLabel(coupon).toLowerCase().includes(query)
    )
  }, [coupons, search])

  const stats = useMemo(() => {
    const active = coupons.filter((coupon) => coupon.status === "active").length
    const totalUses = coupons.reduce((sum, coupon) => sum + coupon.used_count, 0)
    const exclusive = coupons.filter(
      (coupon) => coupon.audience_type !== "all"
    ).length

    return {
      total: coupons.length,
      active,
      totalUses,
      exclusive,
    }
  }, [coupons])

  const loadCoupons = useCallback(async () => {
    try {
      setIsLoading(true)
      setPageError("")

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error("Usuário não autenticado.")

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .single()

      if (restaurantError) {
        throw new Error("Restaurante não encontrado para esse usuário.")
      }

      setRestaurantId(restaurant.id)

      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      setCoupons((data ?? []) as Coupon[])
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao carregar cupons."
      setPageError(message)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadCoupons()
  }, [loadCoupons])

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code)
  }

  const handleDeleteCoupon = async (couponId: string) => {
    const previousCoupons = coupons
    setCoupons((current) => current.filter((coupon) => coupon.id !== couponId))

    let query = supabase.from("coupons").delete().eq("id", couponId)

    if (restaurantId) {
      query = query.eq("restaurant_id", restaurantId)
    }

    const { error } = await query

    if (error) {
      setCoupons(previousCoupons)
      setPageError("Erro ao excluir cupom.")
    }
  }

  const handleOpenCreateModal = () => {
    setFormData(initialFormData)
    setFormError("")
    setIsCreateModalOpen(true)
  }

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false)
    setFormError("")
  }

  const handleChangeForm = (field: keyof CouponFormData, value: string) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleCreateCoupon = async () => {
    const code = formData.code.trim().toUpperCase()
    const title = formData.title.trim()
    const value = Number(formData.value)
    const minimumOrder = Number(formData.minimumOrder)
    const usageLimit = Number(formData.usageLimit)
    const validUntil = formData.validUntil
    const audienceType = formData.audienceType
    const customerPhone = normalizePhone(formData.customerPhone)
    const minCustomerOrders = Number(formData.minCustomerOrders || 0)

    if (!restaurantId) {
      setFormError("Restaurante não encontrado.")
      return
    }

    if (
      !code ||
      !title ||
      !formData.value ||
      !formData.minimumOrder ||
      !formData.usageLimit ||
      !validUntil
    ) {
      setFormError("Preencha todos os campos.")
      return
    }

    if (coupons.some((coupon) => coupon.code === code)) {
      setFormError("Já existe um cupom com esse código.")
      return
    }

    if (formData.type === "percentage" && value > 100) {
      setFormError("Cupom percentual não pode ser maior que 100%.")
      return
    }

    if (value <= 0 || minimumOrder < 0 || usageLimit <= 0) {
      setFormError("Preencha valores válidos.")
      return
    }

    if (audienceType === "specific_customer" && customerPhone.length < 10) {
      setFormError("Informe um telefone válido para o cliente específico.")
      return
    }

    if (audienceType === "min_orders" && minCustomerOrders <= 0) {
      setFormError("Informe a quantidade mínima de compras.")
      return
    }

    const today = new Date()
    const selectedDate = new Date(`${validUntil}T23:59:59`)
    const status: CouponStatus = selectedDate < today ? "expired" : "active"

    try {
      setIsSubmitting(true)
      setFormError("")

      const { data, error } = await supabase
        .from("coupons")
        .insert({
          restaurant_id: restaurantId,
          code,
          title,
          type: formData.type,
          value,
          minimum_order: minimumOrder,
          usage_limit: usageLimit,
          used_count: 0,
          valid_until: validUntil,
          status,
          audience_type: audienceType,
          customer_phone:
            audienceType === "specific_customer" ? customerPhone : null,
          min_customer_orders:
            audienceType === "min_orders" ? minCustomerOrders : 0,
        })
        .select("*")
        .single()

      if (error) {
        if (error.message.toLowerCase().includes("duplicate")) {
          throw new Error("Já existe um cupom com esse código.")
        }
        throw error
      }

      setCoupons((current) => [data as Coupon, ...current])
      setFormData(initialFormData)
      setIsCreateModalOpen(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao criar cupom."
      setFormError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Cupons</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Crie, acompanhe e gerencie os cupons do seu restaurante.
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#080808] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#111111]"
          >
            <Plus className="h-4 w-4" />
            Novo cupom
          </button>
        </div>

        {pageError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {pageError}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-zinc-500" />
              <span className="text-sm font-medium text-zinc-500">
                Total de cupons
              </span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-white">
              {stats.total}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
            <div className="flex items-center gap-2">
              <BadgePercent className="h-4 w-4 text-zinc-500" />
              <span className="text-sm font-medium text-zinc-500">
                Cupons ativos
              </span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-white">
              {stats.active}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-zinc-500" />
              <span className="text-sm font-medium text-zinc-500">
                Cupons exclusivos
              </span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-white">
              {stats.exclusive}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-zinc-500" />
              <span className="text-sm font-medium text-zinc-500">
                Usos totais
              </span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-white">
              {stats.totalUses}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0A0A0A]">
          <div className="border-b border-white/10 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar cupom por código, nome ou público..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0A0A0A] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition focus:border-white/10"
              />
            </div>
          </div>

          <div className="p-4">
            {isLoading ? (
              <div className="flex min-h-[240px] items-center justify-center">
                <div className="inline-flex items-center gap-2 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando cupons...
                </div>
              </div>
            ) : filteredCoupons.length === 0 ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#111111] text-center">
                <Ticket className="h-10 w-10 text-zinc-500" />
                <h2 className="mt-3 text-base font-semibold text-white">
                  Nenhum cupom encontrado
                </h2>
                <p className="mt-1 max-w-md text-sm text-zinc-500">
                  Crie seu primeiro cupom para aumentar conversão, fidelizar clientes e incentivar novos pedidos.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredCoupons.map((coupon) => (
                  <div
                    key={coupon.id}
                    className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-[#080808] px-3 py-1.5 text-sm font-semibold tracking-wide text-white">
                            {coupon.code}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                              coupon.status
                            )}`}
                          >
                            {getStatusLabel(coupon.status)}
                          </span>

                          {coupon.audience_type !== "all" ? (
                            <span className="rounded-full bg-yellow-400/10 px-2.5 py-1 text-xs font-medium text-yellow-400">
                              Exclusivo
                            </span>
                          ) : null}
                        </div>

                        <div>
                          <h3 className="text-base font-semibold text-white">
                            {coupon.title}
                          </h3>
                          <p className="mt-1 text-sm text-zinc-500">
                            {coupon.type === "percentage"
                              ? `${coupon.value}% de desconto`
                              : `${formatCurrency(coupon.value)} de desconto`}
                          </p>
                          <p className="mt-1 text-sm font-medium text-zinc-500">
                            {getAudienceLabel(coupon)}
                          </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-lg bg-[#111111] p-3">
                            <p className="text-xs text-zinc-500">
                              Pedido mínimo
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {formatCurrency(coupon.minimum_order)}
                            </p>
                          </div>

                          <div className="rounded-lg bg-[#111111] p-3">
                            <p className="text-xs text-zinc-500">Uso</p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {coupon.used_count} / {coupon.usage_limit}
                            </p>
                          </div>

                          <div className="rounded-lg bg-[#111111] p-3">
                            <div className="flex items-center gap-1 text-xs text-zinc-500">
                              <CalendarRange className="h-3.5 w-3.5" />
                              <span>Validade</span>
                            </div>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {formatDate(coupon.valid_until)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row gap-2 lg:flex-col">
                        <button
                          onClick={() => handleCopyCode(coupon.code)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-2 text-sm font-medium text-zinc-500 transition hover:bg-[#111111]"
                        >
                          <Copy className="h-4 w-4" />
                          Copiar
                        </button>

                        <button
                          onClick={() => handleDeleteCoupon(coupon.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-[#0A0A0A] px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateCouponModal
        open={isCreateModalOpen}
        formData={formData}
        error={formError}
        isSubmitting={isSubmitting}
        onClose={handleCloseCreateModal}
        onChange={handleChangeForm}
        onSubmit={handleCreateCoupon}
      />
    </AdminLayout>
  )
}