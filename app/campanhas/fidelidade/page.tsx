"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  DollarSign,
  Gift,
  Loader2,
  PlusCircle,
  Save,
  ShoppingBag,
  Target,
  TrendingUp,
  Trash2,
  Trophy,
  UserRound,
  Users,
  Wallet,
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
  reward_value: number | string | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at: string
}

type LoyaltyParticipant = {
  id: string
  restaurant_id: string
  campaign_id: string
  customer_phone: string | null
  customer_name: string | null
  current_orders: number | string | null
  required_orders: number | string | null
  reward_available: boolean | null
  reward_redeemed: boolean | null
  last_order_id?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type OrderRecord = {
  id: string
  restaurant_id: string
  customer_name: string | null
  customer_phone: string | null
  total: number | string | null
  status: string | null
  payment_status: string | null
  created_at: string
}

type ParticipantInsight = LoyaltyParticipant & {
  currentOrdersNumber: number
  requiredOrdersNumber: number
  progressPercentage: number
  missingOrders: number
  totalSpent: number
  averageTicket: number
  validOrdersCount: number
  statusLabel: string
  statusClassName: string
}

type CampaignInsight = {
  campaignId: string
  participants: ParticipantInsight[]
  participantsCount: number
  completedParticipants: number
  availableRewards: number
  redeemedRewards: number
  totalRevenue: number
  totalValidOrders: number
  averageTicket: number
  rewardCost: number
  potentialCost: number
  realizedCost: number
  grossReturn: number
  minimumRevenuePerReward: number
  estimatedReturnPerReward: number
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

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0

  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function normalizePhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "")
}

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(toNumber(value))
}

function formatDate(date: string | null) {
  if (!date) return "Sem data"

  const normalizedDate = date.includes("T") ? date.slice(0, 10) : date

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${normalizedDate}T00:00:00`))
}

function formatPhone(phone: string | null | undefined) {
  const normalizedPhone = normalizePhone(phone)

  if (!normalizedPhone) return "Telefone não informado"

  if (normalizedPhone.length === 11) {
    return `(${normalizedPhone.slice(0, 2)}) ${normalizedPhone.slice(
      2,
      7
    )}-${normalizedPhone.slice(7)}`
  }

  if (normalizedPhone.length === 10) {
    return `(${normalizedPhone.slice(0, 2)}) ${normalizedPhone.slice(
      2,
      6
    )}-${normalizedPhone.slice(6)}`
  }

  return normalizedPhone
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

function getRewardValueLabel(campaign: LoyaltyCampaign) {
  const rewardValue = toNumber(campaign.reward_value)

  if (!rewardValue) return "Valor não informado"

  if (campaign.reward_type === "percentage_discount") {
    return `${rewardValue}%`
  }

  return formatCurrency(rewardValue)
}

function getRewardCost(campaign: LoyaltyCampaign) {
  if (campaign.reward_type === "percentage_discount") return 0

  return toNumber(campaign.reward_value)
}

function isOrderInsideCampaign(order: OrderRecord, campaign: LoyaltyCampaign) {
  const orderDate = new Date(order.created_at)

  if (campaign.starts_at) {
    const startDate = new Date(`${campaign.starts_at}T00:00:00`)

    if (orderDate < startDate) return false
  }

  if (campaign.ends_at) {
    const endDate = new Date(`${campaign.ends_at}T23:59:59`)

    if (orderDate > endDate) return false
  }

  return true
}

function isValidOrderForCampaign(order: OrderRecord, campaign: LoyaltyCampaign) {
  const status = String(order.status || "").toLowerCase()
  const paymentStatus = String(order.payment_status || "").toLowerCase()

  if (status.includes("cancel")) return false
  if (paymentStatus.includes("refund")) return false
  if (toNumber(order.total) < toNumber(campaign.minimum_order_amount)) return false

  return isOrderInsideCampaign(order, campaign)
}

function getParticipantStatus(
  participant: LoyaltyParticipant,
  currentOrders: number,
  requiredOrders: number
) {
  if (participant.reward_redeemed) {
    return {
      label: "Resgatado",
      className: "bg-[#111111] text-zinc-500",
    }
  }

  if (participant.reward_available || currentOrders >= requiredOrders) {
    return {
      label: "Prêmio liberado",
      className: "bg-emerald-500/10 text-emerald-400",
    }
  }

  if (requiredOrders - currentOrders <= 2) {
    return {
      label: "Quase ganhando",
      className: "bg-yellow-400/10 text-yellow-400",
    }
  }

  return {
    label: "Em andamento",
    className: "bg-yellow-400/10 text-yellow-400",
  }
}

export default function CardFidelidadePage() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<LoyaltyCampaign[]>([])
  const [participants, setParticipants] = useState<LoyaltyParticipant[]>([])
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LoyaltyCampaign | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [form, setForm] = useState<FormState>(initialFormState)

  const activeCampaigns = campaigns.filter((campaign) => campaign.is_active)
  const inactiveCampaigns = campaigns.filter((campaign) => !campaign.is_active)

  const insightsByCampaignId = useMemo(() => {
    const insights = new Map<string, CampaignInsight>()

    campaigns.forEach((campaign) => {
      const campaignParticipants = participants.filter(
        (participant) => participant.campaign_id === campaign.id
      )

      const participantInsights = campaignParticipants
        .map((participant) => {
          const participantPhone = normalizePhone(participant.customer_phone)
          const currentOrdersNumber = toNumber(participant.current_orders)
          const requiredOrdersNumber =
            toNumber(participant.required_orders) ||
            toNumber(campaign.required_orders) ||
            1

          const participantOrders = orders.filter((order) => {
            const orderPhone = normalizePhone(order.customer_phone)

            return (
              participantPhone &&
              orderPhone === participantPhone &&
              isValidOrderForCampaign(order, campaign)
            )
          })

          const totalSpent = participantOrders.reduce(
            (total, order) => total + toNumber(order.total),
            0
          )
          const validOrdersCount = participantOrders.length
          const averageTicket = validOrdersCount > 0 ? totalSpent / validOrdersCount : 0
          const progressPercentage = Math.min(
            100,
            Math.round((currentOrdersNumber / requiredOrdersNumber) * 100)
          )
          const missingOrders = Math.max(requiredOrdersNumber - currentOrdersNumber, 0)
          const status = getParticipantStatus(
            participant,
            currentOrdersNumber,
            requiredOrdersNumber
          )

          return {
            ...participant,
            currentOrdersNumber,
            requiredOrdersNumber,
            progressPercentage,
            missingOrders,
            totalSpent,
            averageTicket,
            validOrdersCount,
            statusLabel: status.label,
            statusClassName: status.className,
          }
        })
        .sort((firstParticipant, secondParticipant) => {
          if (secondParticipant.totalSpent !== firstParticipant.totalSpent) {
            return secondParticipant.totalSpent - firstParticipant.totalSpent
          }

          return secondParticipant.currentOrdersNumber - firstParticipant.currentOrdersNumber
        })

      const rewardCost = getRewardCost(campaign)
      const participantsCount = participantInsights.length
      const completedParticipants = participantInsights.filter(
        (participant) =>
          participant.reward_available ||
          participant.reward_redeemed ||
          participant.currentOrdersNumber >= participant.requiredOrdersNumber
      ).length
      const availableRewards = participantInsights.filter(
        (participant) => participant.reward_available && !participant.reward_redeemed
      ).length
      const redeemedRewards = participantInsights.filter(
        (participant) => participant.reward_redeemed
      ).length
      const totalRevenue = participantInsights.reduce(
        (total, participant) => total + participant.totalSpent,
        0
      )
      const totalValidOrders = participantInsights.reduce(
        (total, participant) => total + participant.validOrdersCount,
        0
      )
      const averageTicket = totalValidOrders > 0 ? totalRevenue / totalValidOrders : 0
      const potentialCost = completedParticipants * rewardCost
      const realizedCost = redeemedRewards * rewardCost
      const grossReturn = totalRevenue - realizedCost
      const minimumRevenuePerReward =
        toNumber(campaign.minimum_order_amount) * toNumber(campaign.required_orders)
      const estimatedReturnPerReward = minimumRevenuePerReward - rewardCost

      insights.set(campaign.id, {
        campaignId: campaign.id,
        participants: participantInsights,
        participantsCount,
        completedParticipants,
        availableRewards,
        redeemedRewards,
        totalRevenue,
        totalValidOrders,
        averageTicket,
        rewardCost,
        potentialCost,
        realizedCost,
        grossReturn,
        minimumRevenuePerReward,
        estimatedReturnPerReward,
      })
    })

    return insights
  }, [campaigns, orders, participants])

  const globalInsights = useMemo(() => {
    const campaignInsights = Array.from(insightsByCampaignId.values())

    return campaignInsights.reduce(
      (total, insight) => ({
        participantsCount: total.participantsCount + insight.participantsCount,
        totalRevenue: total.totalRevenue + insight.totalRevenue,
        realizedCost: total.realizedCost + insight.realizedCost,
        grossReturn: total.grossReturn + insight.grossReturn,
      }),
      {
        participantsCount: 0,
        totalRevenue: 0,
        realizedCost: 0,
        grossReturn: 0,
      }
    )
  }, [insightsByCampaignId])

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

      const { data: loyaltyParticipants, error: participantsError } = await supabase
        .from("customer_loyalties")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("current_orders", { ascending: false })

      if (participantsError) {
        console.warn("Erro ao buscar participantes do card fidelidade:", participantsError)
      }

      const { data: restaurantOrders, error: ordersError } = await supabase
        .from("orders")
        .select(
          "id, restaurant_id, customer_name, customer_phone, total, status, payment_status, created_at"
        )
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .limit(1000)

      if (ordersError) {
        console.warn("Erro ao buscar pedidos para métricas de fidelidade:", ordersError)
      }

      setCampaigns((loyaltyCampaigns || []) as LoyaltyCampaign[])
      setParticipants((loyaltyParticipants || []) as LoyaltyParticipant[])
      setOrders((restaurantOrders || []) as OrderRecord[])
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

    if (rewardValue !== null && rewardValue < 0) {
      setErrorMessage("O custo da recompensa não pode ser negativo.")
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
          item.id === campaign.id ? { ...item, is_active: !campaign.is_active } : item
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

async function handleDeleteCampaign() {
  if (!deleteTarget) return

  try {
    setIsDeleting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.access_token) {
      throw new Error("Sessão expirada. Faça login novamente.")
    }

    const response = await fetch(`/api/campanhas/fidelidade/${deleteTarget.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    const result = await response.json().catch(() => null)

    if (!response.ok || !result?.success) {
      throw new Error(
        result?.details ||
          result?.error ||
          "Erro ao excluir campanha de fidelidade."
      )
    }

    setCampaigns((current) =>
      current.filter((campaign) => campaign.id !== deleteTarget.id)
    )

    setParticipants((current) =>
      current.filter((participant) => participant.campaign_id !== deleteTarget.id)
    )

    setDeleteTarget(null)
    setSuccessMessage("Campanha excluída com sucesso.")
  } catch (error) {
    console.error(error)

    setErrorMessage(
      error instanceof Error
        ? error.message
        : "Erro inesperado ao excluir campanha."
    )
  } finally {
    setIsDeleting(false)
  }
}

  return (
    <AdminLayout title="Card Fidelidade">
      <div className="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-yellow-400">
                <Trophy className="h-3.5 w-3.5" />
                Fidelidade
              </div>

              <h1 className="text-xl font-black tracking-tight text-white">
                Card Fidelidade
              </h1>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
                Crie campanhas simples para fazer o cliente voltar, acompanhar
                progresso e medir se a recompensa está se pagando.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowForm((current) => !current)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 text-sm font-bold text-black shadow-sm transition hover:bg-yellow-300"
            >
              {showForm ? <X className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
              {showForm ? "Fechar" : "Nova campanha"}
            </button>
          </div>
        </section>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-400">
            {successMessage}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  Participantes
                </p>
                <strong className="mt-2 block text-2xl font-black text-white">
                  {globalInsights.participantsCount}
                </strong>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-xs font-medium text-zinc-500">
              {campaigns.length} campanha{campaigns.length === 1 ? "" : "s"} criada
              {campaigns.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  Receita gerada
                </p>
                <strong className="mt-2 block text-2xl font-black text-white">
                  {formatCurrency(globalInsights.totalRevenue)}
                </strong>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-xs font-medium text-zinc-500">
              Pedidos válidos nas campanhas
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  Custo realizado
                </p>
                <strong className="mt-2 block text-2xl font-black text-white">
                  {formatCurrency(globalInsights.realizedCost)}
                </strong>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-xs font-medium text-zinc-500">
              Prêmios já resgatados
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  Retorno bruto
                </p>
                <strong className="mt-2 block text-2xl font-black text-emerald-400">
                  {formatCurrency(globalInsights.grossReturn)}
                </strong>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-xs font-medium text-zinc-500">
              Receita menos custo realizado
            </p>
          </div>
        </section>

        <section className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#0A0A0A] p-3 shadow-sm">
          <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-400">
            <BadgeCheck className="h-4 w-4" />
            {activeCampaigns.length} ativa{activeCampaigns.length === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl bg-[#111111] px-3 py-2 text-xs font-black text-zinc-500">
            <Gift className="h-4 w-4" />
            {inactiveCampaigns.length} pausada{inactiveCampaigns.length === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl bg-yellow-400/10 px-3 py-2 text-xs font-black text-yellow-400">
            <ShoppingBag className="h-4 w-4" />
            {orders.length} pedido{orders.length === 1 ? "" : "s"} monitorado
            {orders.length === 1 ? "" : "s"}
          </span>
        </section>

        {showForm && (
          <section className="rounded-2xl border border-yellow-400/30 bg-[#0A0A0A] p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-black text-white">
                  Nova campanha
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Configure uma regra objetiva. O restaurante precisa entender em
                  poucos segundos o que o cliente ganha e quando ganha.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setForm(initialFormState)
                  setShowForm(false)
                }}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-xs font-bold text-zinc-500 transition hover:bg-[#111111]"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="grid gap-3 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-500">
                  Nome da campanha
                </label>
                <input
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  placeholder="Ex: Compre 10 e ganhe 1"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-medium outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                />
              </div>

              <div className="lg:col-span-4">
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-500">
                  Recompensa
                </label>
                <input
                  value={form.reward_description}
                  onChange={(event) =>
                    updateForm("reward_description", event.target.value)
                  }
                  placeholder="Ex: Pizza grande grátis"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-medium outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                />
              </div>

              <div className="lg:col-span-3">
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-500">
                  Tipo
                </label>
                <select
                  value={form.reward_type}
                  onChange={(event) =>
                    updateForm(
                      "reward_type",
                      event.target.value as LoyaltyCampaign["reward_type"]
                    )
                  }
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-medium outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                >
                  <option value="custom">Personalizado</option>
                  <option value="free_item">Item grátis</option>
                  <option value="fixed_discount">Desconto fixo</option>
                  <option value="percentage_discount">Desconto %</option>
                </select>
              </div>

              <div className="lg:col-span-3">
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-500">
                  Pedidos necessários
                </label>
                <select
                  value={form.required_orders}
                  onChange={(event) => updateForm("required_orders", event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-medium outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
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

              <div className="lg:col-span-3">
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-500">
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
                  placeholder="30,00"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-medium outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                />
              </div>

              <div className="lg:col-span-3">
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-500">
                  Custo do prêmio
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.reward_value}
                  onChange={(event) => updateForm("reward_value", event.target.value)}
                  placeholder="70,00"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-medium outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                />
              </div>

              <div className="lg:col-span-3">
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-500">
                  Início
                </label>
                <input
                  type="date"
                  value={form.starts_at}
                  onChange={(event) => updateForm("starts_at", event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-medium outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                />
              </div>

              <div className="lg:col-span-3">
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-500">
                  Fim
                </label>
                <input
                  type="date"
                  value={form.ends_at}
                  onChange={(event) => updateForm("ends_at", event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-medium outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                />
              </div>

              <div className="lg:col-span-9">
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-zinc-500">
                  Observação interna
                </label>
                <input
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  placeholder="Opcional. Ex: válida apenas para delivery ou produtos selecionados."
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-medium outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                />
              </div>

              <div className="flex items-end lg:col-span-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 text-sm font-bold text-black shadow-sm transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSaving ? "Salvando..." : "Salvar campanha"}
                </button>
              </div>
            </form>
          </section>
        )}

        {isLoading ? (
          <section className="flex items-center justify-center rounded-2xl border border-white/10 bg-[#0A0A0A] p-10 shadow-sm">
            <div className="flex items-center gap-3 text-sm font-bold text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
              Carregando campanhas...
            </div>
          </section>
        ) : campaigns.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-white/10 bg-[#0A0A0A] p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">
              <Gift className="h-6 w-6" />
            </div>

            <h2 className="text-lg font-black text-white">
              Nenhum card fidelidade criado ainda
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
              Crie uma campanha simples, como “compre 10 pedidos acima de R$ 30
              e ganhe uma pizza”. Depois acompanhe clientes, prêmios e retorno.
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            {campaigns.map((campaign) => {
              const insight = insightsByCampaignId.get(campaign.id)
              const campaignParticipants = insight?.participants || []
              const minimumRevenuePerReward = insight?.minimumRevenuePerReward || 0
              const rewardCost = insight?.rewardCost || 0
              const estimatedReturnPerReward = insight?.estimatedReturnPerReward || 0
              const estimatedMargin =
                minimumRevenuePerReward > 0
                  ? Math.round((estimatedReturnPerReward / minimumRevenuePerReward) * 100)
                  : 0

              return (
                <article
                  key={campaign.id}
                  className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${
                            campaign.is_active
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-[#111111] text-zinc-500"
                          }`}
                        >
                          {campaign.is_active ? "Ativa" : "Pausada"}
                        </span>

                        <span className="rounded-full bg-yellow-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-yellow-400">
                          {campaign.required_orders} pedido
                          {campaign.required_orders === 1 ? "" : "s"}
                        </span>

                        <span className="rounded-full bg-yellow-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-yellow-400">
                          Mínimo {formatCurrency(campaign.minimum_order_amount)}
                        </span>
                      </div>

                      <h2 className="mt-3 text-lg font-black tracking-tight text-white">
                        {campaign.title}
                      </h2>

                      <p className="mt-1 text-sm font-medium text-zinc-500">
                        {campaign.description || "Sem observação interna."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleCampaign(campaign)}
                        className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-bold transition ${
                          campaign.is_active
                            ? "bg-[#111111] text-zinc-500 hover:bg-[#111111]"
                            : "bg-yellow-400 text-black hover:bg-yellow-300"
                        }`}
                      >
                        {campaign.is_active ? "Pausar" : "Ativar"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(campaign)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 text-sm font-bold text-red-600 transition hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-[#111111] p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-zinc-500">
                        <Trophy className="h-4 w-4 text-yellow-400" />
                        Recompensa
                      </div>
                      <p className="line-clamp-2 text-sm font-black text-white">
                        {campaign.reward_description}
                      </p>
                      <p className="mt-1 text-xs font-medium text-zinc-500">
                        {getRewardTypeLabel(campaign.reward_type)} • {getRewardValueLabel(campaign)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#111111] p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-zinc-500">
                        <Target className="h-4 w-4 text-yellow-400" />
                        Viabilidade
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="font-bold text-zinc-500">Receita mín.</p>
                          <strong className="mt-1 block font-black text-white">
                            {formatCurrency(minimumRevenuePerReward)}
                          </strong>
                        </div>
                        <div>
                          <p className="font-bold text-zinc-500">Custo</p>
                          <strong className="mt-1 block font-black text-white">
                            {formatCurrency(rewardCost)}
                          </strong>
                        </div>
                        <div>
                          <p className="font-bold text-zinc-500">Retorno</p>
                          <strong className="mt-1 block font-black text-emerald-400">
                            {formatCurrency(estimatedReturnPerReward)}
                            {estimatedMargin > 0 ? ` • ${estimatedMargin}%` : ""}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#111111] p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-zinc-500">
                        <CalendarDays className="h-4 w-4 text-zinc-500" />
                        Período
                      </div>
                      <p className="text-sm font-black text-white">
                        {formatDate(campaign.starts_at)} até {formatDate(campaign.ends_at)}
                      </p>
                      <p className="mt-1 text-xs font-medium text-zinc-500">
                        Criada em {formatDate(campaign.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                        Participantes
                      </p>
                      <strong className="mt-1 block text-lg font-black text-white">
                        {insight?.participantsCount || 0}
                      </strong>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                        Receita
                      </p>
                      <strong className="mt-1 block text-lg font-black text-yellow-400">
                        {formatCurrency(insight?.totalRevenue || 0)}
                      </strong>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                        Ticket médio
                      </p>
                      <strong className="mt-1 block text-lg font-black text-white">
                        {formatCurrency(insight?.averageTicket || 0)}
                      </strong>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                        Prêmios liberados
                      </p>
                      <strong className="mt-1 block text-lg font-black text-yellow-400">
                        {insight?.availableRewards || 0}
                      </strong>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                        Retorno bruto
                      </p>
                      <strong className="mt-1 block text-lg font-black text-emerald-400">
                        {formatCurrency(insight?.grossReturn || 0)}
                      </strong>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-[#0A0A0A]">
                    <div className="flex flex-col gap-2 border-b border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-black text-white">
                          Clientes participando
                        </h3>
                        <p className="text-xs font-medium text-zinc-500">
                          Lista compacta com progresso, gasto e status do prêmio.
                        </p>
                      </div>

                      <span className="w-fit rounded-full bg-yellow-400/10 px-3 py-1 text-xs font-black text-yellow-400">
                        {campaignParticipants.length} cliente
                        {campaignParticipants.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {campaignParticipants.length === 0 ? (
                      <div className="p-5 text-center">
                        <UserRound className="mx-auto mb-2 h-6 w-6 text-zinc-500" />
                        <p className="text-sm font-bold text-zinc-500">
                          Nenhum cliente participando ainda.
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Quando um pedido válido entrar, o cliente aparece aqui.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/10">
                        {campaignParticipants.slice(0, 6).map((participant) => (
                          <div
                            key={participant.id}
                            className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,1fr)_120px_140px] lg:items-center"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-white">
                                {participant.customer_name || "Cliente sem nome"}
                              </p>
                              <p className="text-xs font-medium text-zinc-500">
                                {formatPhone(participant.customer_phone)}
                              </p>
                            </div>

                            <div>
                              <div className="mb-1 flex items-center justify-between text-xs font-bold text-zinc-500">
                                <span>
                                  {participant.currentOrdersNumber}/
                                  {participant.requiredOrdersNumber} pedidos
                                </span>
                                <span>{participant.progressPercentage}%</span>
                              </div>

                              <div className="h-2 overflow-hidden rounded-full bg-[#111111]">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-yellow-300"
                                  style={{ width: `${participant.progressPercentage}%` }}
                                />
                              </div>
                            </div>

                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                                Total gasto
                              </p>
                              <strong className="text-sm font-black text-white">
                                {formatCurrency(participant.totalSpent)}
                              </strong>
                            </div>

                            <div className="flex flex-col gap-1 lg:items-end">
                              <span
                                className={`w-fit rounded-full px-3 py-1 text-xs font-black ${participant.statusClassName}`}
                              >
                                {participant.statusLabel}
                              </span>
                              <p className="text-xs font-semibold text-zinc-500">
                                Falta {participant.missingOrders} pedido
                                {participant.missingOrders === 1 ? "" : "s"}
                              </p>
                            </div>
                          </div>
                        ))}

                        {campaignParticipants.length > 6 && (
                          <p className="p-3 text-center text-xs font-semibold text-zinc-500">
                            Mostrando 6 de {campaignParticipants.length} participantes.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </section>
        )}

        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505] p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-red-100 bg-[#0A0A0A] shadow-2xl">
              <div className="bg-gradient-to-r from-red-50 via-[#080808] to-yellow-400 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100">
                    <AlertTriangle className="h-6 w-6" />
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-white">
                      Excluir campanha?
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-zinc-500">
                      Essa ação remove a campanha e os participantes vinculados a
                      ela. Use somente quando tiver certeza de que não precisa mais
                      desse histórico.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="rounded-xl border border-white/10 bg-[#111111] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                    Campanha selecionada
                  </p>
                  <strong className="mt-1 block text-base font-black text-white">
                    {deleteTarget.title}
                  </strong>
                  <p className="mt-1 text-sm font-medium text-zinc-500">
                    {deleteTarget.reward_description}
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    disabled={isDeleting}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-[#0A0A0A] px-5 text-sm font-bold text-zinc-500 transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteCampaign}
                    disabled={isDeleting}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Trash2 className="h-5 w-5" />
                    )}
                    {isDeleting ? "Excluindo..." : "Excluir definitivamente"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
