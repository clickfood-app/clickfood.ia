"use client"

import { useState } from "react"
import {
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Plus,
  Tag,
  Ticket,
  Trophy,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import CouponCreateModal from "@/components/coupon-create-modal"
import CouponTable from "@/components/coupon-table"
import CouponAnalytics from "@/components/coupon-analytics"
import ExclusiveCouponsTable from "@/components/exclusive-coupons-table"
import ExclusiveSuggestions from "@/components/exclusive-suggestions"
import { cn } from "@/lib/utils"
import {
  initialCoupons,
  initialExclusiveCoupons,
  smartSuggestions,
  couponUsageHistory,
  formatBRL,
  type Coupon,
  type ExclusiveCoupon,
  type ExclusiveSuggestion,
} from "@/lib/coupons-data"

export default function CuponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons)
  const [exclusiveCoupons, setExclusiveCoupons] = useState<ExclusiveCoupon[]>(initialExclusiveCoupons)
  const [suggestions, setSuggestions] = useState<ExclusiveSuggestion[]>(smartSuggestions)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // KPI calculations
  const activeCoupons = coupons.filter((c) => c.status === "ativo").length
  const usedToday = 28 // mock: today's total
  const totalRevenue = coupons.reduce((sum, c) => sum + c.revenueGenerated, 0)
  const totalUses = coupons.reduce((sum, c) => sum + c.usedCount, 0)
  const conversionRate = 23.5 // mock percentage
  const bestCoupon = coupons.reduce((best, c) =>
    c.revenueGenerated > (best?.revenueGenerated || 0) ? c : best
  , coupons[0])

  // Exclusive KPIs
  const activeExclusive = exclusiveCoupons.filter((c) => c.status === "ativo").length
  const exclusiveUsageRate = exclusiveCoupons.length > 0
    ? Math.round((exclusiveCoupons.filter((c) => c.usedCount > 0).length / exclusiveCoupons.length) * 100)
    : 0
  const exclusiveRevenue = exclusiveCoupons.reduce((sum, c) => sum + c.revenueGenerated, 0)
  const recoveredClients = exclusiveCoupons.filter(
    (c) => c.reason === "recuperacao_inativo" && c.usedCount > 0
  ).length

  const kpis = [
    {
      label: "Cupons Ativos",
      value: activeCoupons.toString(),
      icon: <Ticket className="h-5 w-5" />,
      change: "+2 esta semana",
      positive: true,
      iconBg: "bg-blue-100 text-blue-600",
    },
    {
      label: "Utilizados Hoje",
      value: usedToday.toString(),
      icon: <Tag className="h-5 w-5" />,
      change: "+12% vs ontem",
      positive: true,
      iconBg: "bg-green-100 text-green-600",
    },
    {
      label: "Receita por Cupons",
      value: formatBRL(totalRevenue),
      icon: <TrendingUp className="h-5 w-5" />,
      change: "+8.3% no mes",
      positive: true,
      iconBg: "bg-blue-100 text-blue-600",
    },
    {
      label: "Taxa de Conversao",
      value: `${conversionRate}%`,
      icon: <Percent className="h-5 w-5" />,
      change: "-1.2% vs semana passada",
      positive: false,
      iconBg: "bg-amber-100 text-amber-600",
    },
    {
      label: "Melhor Desempenho",
      value: bestCoupon?.name || "-",
      icon: <Trophy className="h-5 w-5" />,
      change: `${formatBRL(bestCoupon?.revenueGenerated || 0)} gerados`,
      positive: true,
      iconBg: "bg-blue-100 text-blue-600",
    },
  ]

  const exclusiveKpis = [
    {
      label: "Exclusivos Ativos",
      value: activeExclusive.toString(),
      icon: <UserCheck className="h-5 w-5" />,
      change: `${exclusiveCoupons.length} total criados`,
      positive: true,
      iconBg: "bg-blue-100 text-blue-600",
    },
    {
      label: "Taxa de Uso",
      value: `${exclusiveUsageRate}%`,
      icon: <Tag className="h-5 w-5" />,
      change: `${exclusiveCoupons.filter(c => c.usedCount > 0).length} de ${exclusiveCoupons.length} usados`,
      positive: exclusiveUsageRate >= 50,
      iconBg: "bg-green-100 text-green-600",
    },
    {
      label: "Receita Exclusivos",
      value: formatBRL(exclusiveRevenue),
      icon: <TrendingUp className="h-5 w-5" />,
      change: "+5.2% vs mes anterior",
      positive: true,
      iconBg: "bg-blue-100 text-blue-600",
    },
    {
      label: "Clientes Recuperados",
      value: recoveredClients.toString(),
      icon: <Users className="h-5 w-5" />,
      change: "via cupom exclusivo",
      positive: recoveredClients > 0,
      iconBg: "bg-green-100 text-green-600",
    },
  ]

  const handleToggleStatus = (id: string) => {
    setCoupons((prev) =>
      prev.map((c) => {
        if (c.id !== id || c.status === "expirado") return c
        return { ...c, status: c.status === "ativo" ? "pausado" : "ativo" } as Coupon
      })
    )
  }

  const handleDelete = (id: string) => {
    setCoupons((prev) => prev.filter((c) => c.id !== id))
  }

  const handleCreate = (newCoupon: Coupon) => {
    setCoupons((prev) => [newCoupon, ...prev])
  }

  const handleCreateExclusive = (newCoupon: ExclusiveCoupon) => {
    setExclusiveCoupons((prev) => [newCoupon, ...prev])
  }

  const handleDeleteExclusive = (id: string) => {
    setExclusiveCoupons((prev) => prev.filter((c) => c.id !== id))
  }

  const handleResendExclusive = (id: string) => {
    // Mock resend - in production this would trigger a notification
    alert("Cupom reenviado com sucesso!")
  }

  const handleAcceptSuggestion = (suggestion: ExclusiveSuggestion) => {
    const newExclusive: ExclusiveCoupon = {
      id: `exc-${Date.now()}`,
      clientId: suggestion.clientId,
      clientName: suggestion.clientName,
      code: `${suggestion.clientName.split(" ")[0].toUpperCase().slice(0,5)}${suggestion.suggestedDiscount}`,
      discountType: suggestion.suggestedDiscountType,
      discountValue: suggestion.suggestedDiscount,
      minOrder: 0,
      maxUses: 1,
      usedCount: 0,
      reason: suggestion.reason,
      status: "ativo",
      createdAt: new Date().toISOString().split("T")[0],
      expiresAt: "2026-04-30",
      sendChannels: ["whatsapp", "notificacao"],
      revenueGenerated: 0,
    }
    setExclusiveCoupons((prev) => [newExclusive, ...prev])
  }

  const handleDismissSuggestion = (_id: string) => {
    // suggestion dismissal handled internally by the component
  }

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight text-balance">Cupons</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie e gerencie cupons para aumentar vendas e fidelizar clientes
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Criar Novo Cupom
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", kpi.iconBg)}>
                  {kpi.icon}
                </span>
              </div>
              <p className="mt-4 text-xl font-bold text-card-foreground truncate">{kpi.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{kpi.label}</p>
              <div className="mt-2 flex items-center gap-1">
                {kpi.positive ? (
                  <ArrowUpRight className="h-3 w-3 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-600" />
                )}
                <span className={cn("text-xs font-medium", kpi.positive ? "text-green-600" : "text-red-600")}>
                  {kpi.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Analytics Section */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-foreground mb-4">Inteligencia de Performance</h2>
          <CouponAnalytics usageData={couponUsageHistory} coupons={coupons} />
        </div>

        {/* Coupons Table */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-foreground mb-4">Cupons Criados</h2>
          <CouponTable
            coupons={coupons}
            onToggleStatus={handleToggleStatus}
            onDelete={handleDelete}
          />
        </div>

        {/* Exclusive Section Divider */}
        <div className="mt-12 mb-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <div className="flex items-center gap-2 rounded-full border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5 px-4 py-1.5">
            <UserCheck className="h-4 w-4 text-[hsl(var(--primary))]" />
            <span className="text-sm font-semibold text-[hsl(var(--primary))]">Cupons Exclusivos por Cliente</span>
          </div>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Exclusive KPI Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {exclusiveKpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", kpi.iconBg)}>
                  {kpi.icon}
                </span>
              </div>
              <p className="mt-4 text-xl font-bold text-card-foreground truncate">{kpi.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{kpi.label}</p>
              <div className="mt-2 flex items-center gap-1">
                {kpi.positive ? (
                  <ArrowUpRight className="h-3 w-3 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-600" />
                )}
                <span className={cn("text-xs font-medium", kpi.positive ? "text-green-600" : "text-red-600")}>
                  {kpi.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Smart Suggestions */}
        <div className="mt-8">
          <ExclusiveSuggestions
            suggestions={suggestions}
            onAccept={handleAcceptSuggestion}
            onDismiss={handleDismissSuggestion}
          />
        </div>

        {/* Exclusive Coupons Table */}
        <div className="mt-8">
          <ExclusiveCouponsTable
            coupons={exclusiveCoupons}
            onDelete={handleDeleteExclusive}
            onResend={handleResendExclusive}
          />
        </div>
      </div>

      {/* Create Modal */}
      <CouponCreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreate}
        onSaveExclusive={handleCreateExclusive}
      />
    </AdminLayout>
  )
}
