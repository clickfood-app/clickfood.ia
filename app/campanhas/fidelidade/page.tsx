"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  CalendarDays,
  Gift,
  Loader2,
  PlusCircle,
  Save,
  ShoppingBag,
  Trophy,
  Users,
  X,
} from "lucide-react"

import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"

type LoyaltyCampaign = {
  id: string
  restaurant_id: string
  title: string
  description: string | null
  required_orders: number
  minimum_order_amount: number
  reward_type: "custom" | "free_item" | "fixed_discount" | "percentage_discount"
  reward_description: string
  reward_value: number | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at: string
}

type FormState = {
  title: string
  description: string
  required_orders: string
  minimum_order_amount: string
  reward_type: LoyaltyCampaign["reward_type"]
  reward_description: string
  reward_value: string
  starts_at: string
  ends_at: string
}

const initialFormState: FormState = {
  title: "",
  description: "",
  required_orders: "10",
  minimum_order_amount: "0",
  reward_type: "custom",
  reward_description: "",
  reward_value: "",
  starts_at: "",
  ends_at: "",
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatDate(date: string | null) {
  if (!date) return "Sem data"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`))
}

function getRewardTypeLabel(type: LoyaltyCampaign["reward_type"]) {
  const labels = {
    custom: "Personalizado",
    free_item: "Item grátis",
    fixed_discount: "Desconto fixo",
    percentage_discount: "Desconto %",
  }

  return labels[type]
}

export default function CardFidelidadePage() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<LoyaltyCampaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(initialFormState)

  const activeCampaigns = campaigns.filter((campaign) => campaign.is_active)
  const inactiveCampaigns = campaigns.filter((campaign) => !campaign.is_active)

  const totalRequiredOrders = campaigns.reduce(
    (total, campaign) => total + campaign.required_orders,
    0
  )

  async function loadData() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error("Usuário não autenticado.")
      }

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .single()

      if (restaurantError || !restaurant) {
        throw new Error("Restaurante não encontrado.")
      }

      setRestaurantId(restaurant.id)

      const { data: loyaltyCampaigns, error: campaignsError } = await supabase
        .from("loyalty_campaigns")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })

      if (campaignsError) {
        throw new Error("Erro ao buscar campanhas de fidelidade.")
      }

      setCampaigns((loyaltyCampaigns || []) as LoyaltyCampaign[])
    } catch (error) {
      console.error(error)
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao carregar campanhas."
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  async function handleCreateCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!restaurantId) {
      setErrorMessage("Restaurante não encontrado.")
      return
    }

    if (!form.title.trim()) {
      setErrorMessage("Informe o nome da campanha.")
      return
    }

    if (!form.reward_description.trim()) {
      setErrorMessage("Informe a recompensa do card fidelidade.")
      return
    }

    const requiredOrders = Number(form.required_orders)
    const minimumOrderAmount = Number(form.minimum_order_amount || 0)
    const rewardValue = form.reward_value ? Number(form.reward_value) : null

    if (requiredOrders < 1 || requiredOrders > 10) {
      setErrorMessage("A quantidade de pedidos precisa ser entre 1 e 10.")
      return
    }

    if (minimumOrderAmount < 0) {
      setErrorMessage("O pedido mínimo não pode ser negativo.")
      return
    }

    try {
      setIsSaving(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      const { error } = await supabase.from("loyalty_campaigns").insert({
        restaurant_id: restaurantId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        required_orders: requiredOrders,
        minimum_order_amount: minimumOrderAmount,
        reward_type: form.reward_type,
        reward_description: form.reward_description.trim(),
        reward_value: rewardValue,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        is_active: true,
      })

      if (error) {
        throw new Error("Erro ao criar campanha de fidelidade.")
      }

      setForm(initialFormState)
      setShowForm(false)
      setSuccessMessage("Campanha de fidelidade criada com sucesso.")
      await loadData()
    } catch (error) {
      console.error(error)
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao salvar campanha."
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleCampaign(campaign: LoyaltyCampaign) {
    try {
      setErrorMessage(null)
      setSuccessMessage(null)

      const { error } = await supabase
        .from("loyalty_campaigns")
        .update({
          is_active: !campaign.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id)

      if (error) {
        throw new Error("Erro ao atualizar campanha.")
      }

      setCampaigns((current) =>
        current.map((item) =>
          item.id === campaign.id
            ? { ...item, is_active: !campaign.is_active }
            : item
        )
      )

      setSuccessMessage(
        campaign.is_active
          ? "Campanha pausada com sucesso."
          : "Campanha ativada com sucesso."
      )
    } catch (error) {
      console.error(error)
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao atualizar campanha."
      )
    }
  }

  return (
    <AdminLayout title="Card Fidelidade">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Card Fidelidade
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Crie cartões de fidelidade para recompensar clientes recorrentes
              após uma quantidade definida de pedidos.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700"
          >
            {showForm ? <X className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
            {showForm ? "Fechar cadastro" : "Nova campanha"}
          </button>
        </div>

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {successMessage}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <Users className="mb-4 h-6 w-6 text-violet-600" />
            <p className="text-sm font-medium text-slate-500">
              Campanhas criadas
            </p>
            <strong className="mt-2 block text-2xl font-black text-slate-950">
              {campaigns.length}
            </strong>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <ShoppingBag className="mb-4 h-6 w-6 text-violet-600" />
            <p className="text-sm font-medium text-slate-500">
              Campanhas ativas
            </p>
            <strong className="mt-2 block text-2xl font-black text-slate-950">
              {activeCampaigns.length}
            </strong>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <Trophy className="mb-4 h-6 w-6 text-violet-600" />
            <p className="text-sm font-medium text-slate-500">
              Campanhas pausadas
            </p>
            <strong className="mt-2 block text-2xl font-black text-slate-950">
              {inactiveCampaigns.length}
            </strong>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <Gift className="mb-4 h-6 w-6 text-violet-600" />
            <p className="text-sm font-medium text-slate-500">
              Pedidos configurados
            </p>
            <strong className="mt-2 block text-2xl font-black text-slate-950">
              {totalRequiredOrders}
            </strong>
          </div>
        </section>

        {showForm && (
          <section className="rounded-[28px] border border-violet-100 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                <Gift className="h-6 w-6" />
              </div>

              <div>
                <h2 className="text-lg font-black text-slate-950">
                  Criar nova campanha de fidelidade
                </h2>
                <p className="text-sm text-slate-500">
                  Configure quantos pedidos o cliente precisa fazer e qual
                  recompensa ele vai receber.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateCampaign} className="grid gap-4 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Nome da campanha
                </label>
                <input
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  placeholder="Ex: Compre 10 e ganhe um lanche"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Descrição
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateForm("description", event.target.value)
                  }
                  placeholder="Explique a regra da campanha para o restaurante."
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Quantidade de pedidos
                </label>
                <select
                  value={form.required_orders}
                  onChange={(event) =>
                    updateForm("required_orders", event.target.value)
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                >
                  {Array.from({ length: 10 }).map((_, index) => {
                    const value = String(index + 1)

                    return (
                      <option key={value} value={value}>
                        {value} pedido{value === "1" ? "" : "s"}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Pedido mínimo
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minimum_order_amount}
                  onChange={(event) =>
                    updateForm("minimum_order_amount", event.target.value)
                  }
                  placeholder="0,00"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Tipo de recompensa
                </label>
                <select
                  value={form.reward_type}
                  onChange={(event) =>
                    updateForm(
                      "reward_type",
                      event.target.value as LoyaltyCampaign["reward_type"]
                    )
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                >
                  <option value="custom">Personalizado</option>
                  <option value="free_item">Item grátis</option>
                  <option value="fixed_discount">Desconto fixo</option>
                  <option value="percentage_discount">Desconto %</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Valor da recompensa
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.reward_value}
                  onChange={(event) =>
                    updateForm("reward_value", event.target.value)
                  }
                  placeholder="Opcional"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Recompensa
                </label>
                <input
                  value={form.reward_description}
                  onChange={(event) =>
                    updateForm("reward_description", event.target.value)
                  }
                  placeholder="Ex: Ganhe um X-Burger grátis"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Início da campanha
                </label>
                <input
                  type="date"
                  value={form.starts_at}
                  onChange={(event) => updateForm("starts_at", event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Fim da campanha
                </label>
                <input
                  type="date"
                  value={form.ends_at}
                  onChange={(event) => updateForm("ends_at", event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:col-span-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-bold text-white shadow-lg shadow-violet-100 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                  {isSaving ? "Salvando..." : "Salvar campanha"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setForm(initialFormState)
                    setShowForm(false)
                  }}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        )}

        {isLoading ? (
          <section className="flex items-center justify-center rounded-[28px] border border-slate-200 bg-white p-10 shadow-sm">
            <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
              Carregando campanhas...
            </div>
          </section>
        ) : campaigns.length === 0 ? (
          <section className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <Gift className="h-7 w-7" />
            </div>

            <h2 className="text-xl font-black text-slate-950">
              Nenhum card fidelidade criado ainda
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Aqui o restaurante poderá criar uma regra como: “a cada 10 pedidos,
              o cliente ganha um lanche, desconto ou brinde”.
            </p>
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            {campaigns.map((campaign) => (
              <article
                key={campaign.id}
                className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                      <Gift className="h-6 w-6" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-black text-slate-950">
                          {campaign.title}
                        </h2>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            campaign.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {campaign.is_active ? "Ativa" : "Pausada"}
                        </span>
                      </div>

                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {campaign.description || "Sem descrição informada."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                      <ShoppingBag className="h-4 w-4" />
                      Regra
                    </div>
                    <p className="text-sm font-black text-slate-900">
                      {campaign.required_orders} pedido
                      {campaign.required_orders === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Pedido mínimo:{" "}
                      {formatCurrency(campaign.minimum_order_amount)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                      <Trophy className="h-4 w-4" />
                      Recompensa
                    </div>
                    <p className="text-sm font-black text-slate-900">
                      {campaign.reward_description}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {getRewardTypeLabel(campaign.reward_type)}
                      {campaign.reward_value
                        ? ` • ${formatCurrency(campaign.reward_value)}`
                        : ""}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                      <CalendarDays className="h-4 w-4" />
                      Início
                    </div>
                    <p className="text-sm font-black text-slate-900">
                      {formatDate(campaign.starts_at)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                      <CalendarDays className="h-4 w-4" />
                      Fim
                    </div>
                    <p className="text-sm font-black text-slate-900">
                      {formatDate(campaign.ends_at)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
                    <BadgeCheck className="h-4 w-4 text-violet-600" />
                    Criada em {formatDate(campaign.created_at.slice(0, 10))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleCampaign(campaign)}
                    className={`inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-bold transition ${
                      campaign.is_active
                        ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        : "bg-violet-600 text-white hover:bg-violet-700"
                    }`}
                  >
                    {campaign.is_active ? "Pausar campanha" : "Ativar campanha"}
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </AdminLayout>
  )
}