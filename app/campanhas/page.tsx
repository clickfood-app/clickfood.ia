"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Gift,
  Loader2,
  Megaphone,
  Pencil,
  Settings,
  Star,
  TicketPercent,
  TrendingUp,
  Upload,
  UserRoundCheck,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react"

import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"

type PerformanceDay = {
  label: string
  value: number
  percentage: number
}

type RecentCampaign = {
  id: string
  name: string
  description: string
  type: string
  impact: string
  secondaryImpact: string
  status: string
  period: string
  createdAt: string
}

type CampaignOverview = {
  success: boolean
  message?: string
  restaurant?: {
    id: string
    name: string
    slug: string
  }
  summary: {
    activeCampaigns: number
    fidelizedCustomers: number
    clickPromoBalance: number
    clickPromoBalanceFormatted: string
    monthlyRedemptions: number
  }
  cardFidelidade: {
    hasCampaign: boolean
    campaignId: string
    title: string
    rewardTitle: string
    requiredOrders: number
    isActive: boolean
    participants: number
    pendingRewards: number
    redeemedRewards: number
    completedGoals: number
    progress: number
    customersCloseToComplete: number
  }
  clickPromo: {
    balance: number
    balanceFormatted: string
    impactedOrders: number
    releasedAmount: number
    releasedAmountFormatted: string
    conversion: number
    performanceLastSevenDays: PerformanceDay[]
  }
  insights: {
    customersCloseToComplete: number
    inactiveCustomers: number
    clickPromoConversion: number
  }
  recentCampaigns: RecentCampaign[]
  totals: {
    orders: number
    monthOrders: number
    paidOrDeliveredOrders: number
    revenue: number
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value || 0)
}

function formatPercent(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`
}

function getStatusClasses(status: string) {
  const normalized = status.toLowerCase()

  if (normalized.includes("ativa")) {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
  }

  if (normalized.includes("conclu")) {
    return "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
  }

  return "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
}

export default function CampanhasPage() {
  const supabase = useMemo(() => createClient(), [])

  const [overview, setOverview] = useState<CampaignOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let isMounted = true

    async function loadOverview() {
      try {
        setIsLoading(true)
        setErrorMessage("")

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        if (!session?.access_token) {
          throw new Error("Sessão expirada. Faça login novamente.")
        }

        const response = await fetch("/api/campanhas/overview", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(
            data?.message || "Erro ao carregar visão geral das campanhas.",
          )
        }

        if (isMounted) {
          setOverview(data)
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Erro inesperado ao carregar campanhas.",
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadOverview()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const hasClickPromoPerformance = useMemo(() => {
    return (
      overview?.clickPromo.performanceLastSevenDays.some(
        (day) => day.value > 0,
      ) ?? false
    )
  }, [overview])

  if (isLoading) {
    return (
      <AdminLayout title="Campanhas">
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-sm font-semibold text-slate-600">
              Carregando visão geral das campanhas...
            </span>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (errorMessage || !overview) {
    return (
      <AdminLayout title="Campanhas">
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="w-full max-w-4xl rounded-[28px] border border-red-100 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>

              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  Não foi possível carregar as campanhas
                </h1>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {errorMessage ||
                    "Tente atualizar a página ou fazer login novamente."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Campanhas">
      <div className="space-y-5">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Campanha
            </h1>

            <p className="mt-1 text-sm font-medium text-slate-500">
              Visão geral das campanhas e benefícios do restaurante
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
              <Zap className="h-4 w-4 text-blue-600" />
              Ações rápidas
            </button>

            <Link
              href="/campanhas/fidelidade"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm shadow-blue-500/20 transition hover:bg-blue-700"
            >
              <Megaphone className="h-4 w-4" />
              Criar campanha
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Campanhas ativas"
            value={formatNumber(overview.summary.activeCampaigns)}
            description="Campanhas em funcionamento"
            icon={Megaphone}
            tone="blue"
          />

          <MetricCard
            title="Clientes fidelizados"
            value={formatNumber(overview.summary.fidelizedCustomers)}
            description="Clientes participando"
            icon={UsersRound}
            tone="orange"
          />

          <MetricCard
            title="Crédito ClickPromo"
            value={overview.summary.clickPromoBalanceFormatted}
            description="Disponível para liberar"
            icon={BadgeDollarSign}
            tone="green"
          />

          <MetricCard
            title="Resgates no mês"
            value={formatNumber(overview.summary.monthlyRedemptions)}
            description="Prêmios resgatados"
            icon={Gift}
            tone="purple"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_1.1fr_0.95fr]">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-sm shadow-orange-500/20">
                  <Star className="h-5 w-5 fill-white" />
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    Card Fidelidade
                  </h2>

                  <p className="mt-0.5 text-sm font-medium text-slate-500">
                    Estimule a recompra com metas de pedidos.
                  </p>
                </div>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  overview.cardFidelidade.isActive
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                    : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                }`}
              >
                {overview.cardFidelidade.isActive ? "Ativo" : "Inativo"}
              </span>
            </div>

            <div className="mt-5 rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 to-white px-4 py-4">
              {overview.cardFidelidade.hasCampaign ? (
                <div className="flex items-center justify-between gap-4">
                  <p className="text-base font-black text-orange-950">
                    {overview.cardFidelidade.requiredOrders} pedidos ={" "}
                    {overview.cardFidelidade.rewardTitle}
                  </p>

                  <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 sm:flex">
                    <Gift className="h-6 w-6" />
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-base font-black text-orange-950">
                    Nenhum card fidelidade ativo
                  </p>

                  <p className="mt-1 text-sm font-medium text-orange-700/80">
                    Crie uma campanha para começar a acompanhar recompra.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Progresso geral</span>
                <span>{formatPercent(overview.cardFidelidade.progress)}</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all"
                  style={{
                    width: `${Math.min(
                      Math.max(overview.cardFidelidade.progress, 0),
                      100,
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-bold text-slate-500">
                    Clientes ativos
                  </p>
                  <p className="mt-1 text-lg font-black text-orange-600">
                    {formatNumber(overview.cardFidelidade.participants)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-bold text-slate-500">
                    Metas atingidas
                  </p>
                  <p className="mt-1 text-lg font-black text-orange-600">
                    {formatNumber(overview.cardFidelidade.completedGoals)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MiniStat
                icon={UsersRound}
                label="Participando"
                value={formatNumber(overview.cardFidelidade.participants)}
              />

              <MiniStat
                icon={Gift}
                label="Pendentes"
                value={formatNumber(overview.cardFidelidade.pendingRewards)}
              />

              <MiniStat
                icon={CheckCircle2}
                label="Concluídos"
                value={formatNumber(overview.cardFidelidade.redeemedRewards)}
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                href="/campanhas/fidelidade"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-sm font-black text-blue-700 transition hover:bg-blue-50"
              >
                Ver campanha
                <ExternalLink className="h-4 w-4" />
              </Link>

              <Link
                href="/campanhas/fidelidade"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Link>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
                  <TicketPercent className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    ClickPromo
                  </h2>

                  <p className="mt-0.5 text-sm font-medium text-slate-500">
                    Crédito promocional subsidiado pela ClickFood.
                  </p>
                </div>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  overview.clickPromo.balance > 0
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                    : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                }`}
              >
                {overview.clickPromo.balance > 0 ? "Ativo" : "Sem saldo"}
              </span>
            </div>

            <div className="mt-5 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50 px-4 py-4">
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                Saldo disponível
              </p>

              <div className="mt-1 flex items-center justify-between gap-4">
                <p className="text-2xl font-black tracking-tight text-slate-950">
                  {overview.clickPromo.balanceFormatted}
                </p>

                <TicketPercent className="h-8 w-8 text-blue-400" />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 divide-x divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/60 py-3">
              <div className="px-3">
                <p className="text-xs font-bold text-slate-500">
                  Pedidos impactados
                </p>
                <p className="mt-1 text-base font-black text-slate-950">
                  {formatNumber(overview.clickPromo.impactedOrders)}
                </p>
              </div>

              <div className="px-3">
                <p className="text-xs font-bold text-slate-500">
                  Saldo liberado
                </p>
                <p className="mt-1 text-base font-black text-slate-950">
                  {overview.clickPromo.releasedAmountFormatted}
                </p>
              </div>

              <div className="px-3">
                <p className="text-xs font-bold text-slate-500">Conversão</p>
                <p className="mt-1 text-base font-black text-slate-950">
                  {formatPercent(overview.clickPromo.conversion)}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-sm font-black text-slate-800">
                Performance nos últimos 7 dias
              </p>

              {hasClickPromoPerformance ? (
                <div className="mt-4 flex h-28 items-end gap-3 border-b border-slate-100 pb-1">
                  {overview.clickPromo.performanceLastSevenDays.map((day) => (
                    <div
                      key={day.label}
                      className="flex flex-1 flex-col items-center gap-2"
                    >
                      <div className="flex h-20 w-full items-end justify-center">
                        <div
                          className="w-5 rounded-t-lg bg-blue-600 shadow-sm shadow-blue-500/20"
                          style={{
                            height: `${Math.max(day.percentage, 6)}%`,
                          }}
                        />
                      </div>

                      <span className="text-[11px] font-bold text-slate-400">
                        {day.label}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex h-28 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
                  <p className="px-4 text-sm font-semibold text-slate-400">
                    Sem pedidos ClickPromo nos últimos 7 dias.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                href="/campanhas/saldo-promocional"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-sm font-black text-blue-700 transition hover:bg-blue-50"
              >
                Gerenciar
                <Settings className="h-4 w-4" />
              </Link>

              <Link
                href="/campanhas/saldo-promocional"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm shadow-blue-500/20 transition hover:bg-blue-700"
              >
                <Upload className="h-4 w-4" />
                Liberar saldo
              </Link>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Zap className="h-5 w-5" />
              </div>

              <h2 className="text-lg font-black text-slate-950">
                Insights da campanha
              </h2>
            </div>

            <div className="flex flex-col gap-3">
              <InsightCard
                icon={UsersRound}
                tone="orange"
                text={`${formatNumber(
                  overview.insights.customersCloseToComplete,
                )} clientes estão próximos de completar o card`}
              />

              <InsightCard
                icon={TrendingUp}
                tone="blue"
                text={`ClickPromo teve ${formatPercent(
                  overview.insights.clickPromoConversion,
                )} de conversão no mês`}
              />

              <InsightCard
                icon={Clock3}
                tone="purple"
                text={`${formatNumber(
                  overview.insights.inactiveCustomers,
                )} clientes estão inativos há 15 dias`}
              />
            </div>

            <button className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-black text-blue-700 transition hover:bg-blue-50">
              Ver todos os insights
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.6fr_0.9fr]">
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <BarChart3 className="h-5 w-5" />
              </div>

              <h2 className="text-lg font-black text-slate-950">
                Desempenho recente
              </h2>
            </div>

            {overview.recentCampaigns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-black uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3">Campanha</th>
                      <th className="px-5 py-3">Tipo</th>
                      <th className="px-5 py-3">Impacto</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Período</th>
                    </tr>
                  </thead>

                  <tbody>
                    {overview.recentCampaigns.map((campaign) => (
                      <tr
                        key={`${campaign.type}-${campaign.id}`}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                                campaign.type === "ClickPromo"
                                  ? "bg-blue-600 text-white"
                                  : "bg-orange-500 text-white"
                              }`}
                            >
                              {campaign.type === "ClickPromo" ? (
                                <TicketPercent className="h-4 w-4" />
                              ) : (
                                <Star className="h-4 w-4 fill-white" />
                              )}
                            </div>

                            <div>
                              <p className="text-sm font-black text-slate-900">
                                {campaign.name}
                              </p>
                              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                                {campaign.description}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              campaign.type === "ClickPromo"
                                ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                                : "bg-orange-50 text-orange-700 ring-1 ring-orange-200"
                            }`}
                          >
                            {campaign.type}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm font-black text-slate-900">
                            {campaign.impact}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-500">
                            {campaign.secondaryImpact}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${getStatusClasses(
                              campaign.status,
                            )}`}
                          >
                            {campaign.status}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm font-bold text-slate-500">
                          {campaign.period}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex min-h-[220px] items-center justify-center px-6 py-10 text-center">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Megaphone className="h-6 w-6" />
                  </div>

                  <h3 className="mt-4 text-base font-black text-slate-900">
                    Nenhuma campanha encontrada
                  </h3>

                  <p className="mt-2 text-sm font-medium text-slate-500">
                    Quando uma campanha for criada, o desempenho aparecerá aqui.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Zap className="h-5 w-5" />
              </div>

              <h2 className="text-lg font-black text-slate-950">
                Ações rápidas
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <QuickAction
                href="/campanhas/fidelidade"
                icon={Star}
                title="Criar card fidelidade"
                description="Defina metas e prêmios"
                tone="orange"
              />

              <QuickAction
                href="/campanhas/saldo-promocional"
                icon={TicketPercent}
                title="Liberar ClickPromo"
                description="Disponibilizar crédito"
                tone="blue"
              />

              <QuickAction
                href="/clientes"
                icon={UserRoundCheck}
                title="Ver clientes elegíveis"
                description="Quem pode participar"
                tone="green"
              />

              <QuickAction
                href="/campanhas"
                icon={BarChart3}
                title="Acompanhar resultados"
                description="Ver relatórios e métricas"
                tone="purple"
              />
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  description: string
  icon: LucideIcon
  tone: "blue" | "orange" | "green" | "purple"
}) {
  const toneClasses = {
    blue: "bg-blue-50 text-blue-600",
    orange: "bg-orange-50 text-orange-600",
    green: "bg-emerald-50 text-emerald-600",
    purple: "bg-violet-50 text-violet-600",
  }

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${toneClasses[tone]}`}
        >
          <Icon className="h-7 w-7" />
        </div>

        <div>
          <p className="text-sm font-black text-slate-700">{title}</p>
          <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-400">
            {description}
          </p>
        </div>
      </div>
    </div>
  )
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
          <Icon className="h-4 w-4" />
        </div>

        <div>
          <p className="text-[11px] font-bold text-slate-400">{label}</p>
          <p className="text-sm font-black text-slate-950">{value}</p>
        </div>
      </div>
    </div>
  )
}

function InsightCard({
  icon: Icon,
  text,
  tone,
}: {
  icon: LucideIcon
  text: string
  tone: "orange" | "blue" | "purple"
}) {
  const toneClasses = {
    orange: "border-orange-100 bg-orange-50 text-orange-600",
    blue: "border-blue-100 bg-blue-50 text-blue-600",
    purple: "border-violet-100 bg-violet-50 text-violet-600",
  }

  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition hover:scale-[1.01] ${toneClasses[tone]}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80">
          <Icon className="h-5 w-5" />
        </div>

        <p className="text-sm font-black leading-5 text-slate-900">{text}</p>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  )
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
  tone,
}: {
  href: string
  icon: LucideIcon
  title: string
  description: string
  tone: "orange" | "blue" | "green" | "purple"
}) {
  const toneClasses = {
    orange: "border-orange-100 bg-orange-50 text-orange-600",
    blue: "border-blue-100 bg-blue-50 text-blue-600",
    green: "border-emerald-100 bg-emerald-50 text-emerald-600",
    purple: "border-violet-100 bg-violet-50 text-violet-600",
  }

  return (
    <Link
      href={href}
      className={`group rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${toneClasses[tone]}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <p className="text-sm font-black text-slate-950">{title}</p>
          <p className="mt-0.5 text-xs font-bold text-slate-500">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1 text-xs font-black">
        Acessar
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
      </div>
    </Link>
  )
}