"use client"

import { useState, useEffect, useMemo } from "react"
import {
  getRestaurantStatus,
  getDayResults,
  getOperationalCounters,
  getDeliveryStats,
  getComparativeData,
  getFeaturedProduct,
  getSmartAlerts,
  formatBRL,
} from "@/lib/dashboard-data"
import {
  Clock,
  DollarSign,
  ShoppingCart,
  Receipt,
  TrendingUp,
  TrendingDown,
  Minus,
  ChefHat,
  Truck,
  AlertTriangle,
  XCircle,
  Award,
  Bike,
  User,
  Timer,
  Package,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Skeleton ──

function DashboardSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="p-6 space-y-5">
        {/* Status bar skeleton */}
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
        {/* Main cards skeleton */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        {/* Rest */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="h-48 rounded-xl bg-muted animate-pulse" />
          <div className="h-48 rounded-xl bg-muted animate-pulse" />
          <div className="h-48 rounded-xl bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  )
}

// ── Variation Badge ──

function VariationBadge({ value, inverted = false }: { value: number; inverted?: boolean }) {
  const isPositive = inverted ? value < 0 : value > 0
  const isNegative = inverted ? value > 0 : value < 0

  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <Minus className="h-3 w-3" />
        0%
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
        isPositive && "bg-emerald-100 text-emerald-700",
        isNegative && "bg-red-100 text-red-700"
      )}
    >
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value)}%
    </span>
  )
}

// ── Main Dashboard ──

export default function DashboardContent() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Get all data
  const status = useMemo(() => getRestaurantStatus(), [])
  const dayResults = useMemo(() => getDayResults(), [])
  const operational = useMemo(() => getOperationalCounters(), [])
  const delivery = useMemo(() => getDeliveryStats(), [])
  const comparative = useMemo(() => getComparativeData(), [])
  const featured = useMemo(() => getFeaturedProduct(), [])
  const alerts = useMemo(() => getSmartAlerts(), [])

  // Format time open
  const timeOpenFormatted = useMemo(() => {
    const hours = Math.floor(status.timeOpenMinutes / 60)
    const mins = status.timeOpenMinutes % 60
    return `${hours}h ${mins}min`
  }, [status.timeOpenMinutes])

  if (!mounted) {
    return <DashboardSkeleton />
  }

  return (
    <div className="min-h-screen">
      <div className="p-6 space-y-5">

        {/* ══════════════════════════════════════════════════════════════════
            1. STATUS BAR - Live operational status
        ══════════════════════════════════════════════════════════════════ */}
        <div
          className={cn(
            "rounded-xl border p-4",
            status.isOpen
              ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100/50"
              : "border-red-200 bg-gradient-to-r from-red-50 to-red-100/50"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left: Status */}
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl",
                  status.isOpen ? "bg-emerald-500" : "bg-red-500"
                )}
              >
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-lg font-bold",
                      status.isOpen ? "text-emerald-700" : "text-red-700"
                    )}
                  >
                    {status.isOpen ? "Restaurante Aberto" : "Restaurante Fechado"}
                  </span>
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full animate-pulse",
                      status.isOpen ? "bg-emerald-500" : "bg-red-500"
                    )}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {status.isOpen ? (
                    <>
                      Aberto ha <span className="font-semibold text-foreground">{timeOpenFormatted}</span>
                      {" "} | Fecha as {status.closeTime}
                    </>
                  ) : (
                    <>Ultimo expediente: {formatBRL(status.lastSessionRevenue || 0)} em {status.lastSessionOrders || 0} pedidos</>
                  )}
                </p>
              </div>
            </div>

            {/* Right: Quick stats */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground tabular-nums">{status.ordersInProgress}</p>
                <p className="text-xs text-muted-foreground">Em andamento</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="text-center">
                <p
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    status.ordersLate > 0 ? "text-red-600" : "text-foreground"
                  )}
                >
                  {status.ordersLate}
                </p>
                <p className="text-xs text-muted-foreground">Atrasados</p>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            2. MAIN KPI CARDS - Day results
        ══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* Faturamento Bruto */}
          <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <VariationBadge value={dayResults.faturamentoVar} />
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground tabular-nums">
              {formatBRL(dayResults.faturamentoBruto)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Faturamento bruto do dia
            </p>
          </div>

          {/* Total Pedidos */}
          <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
              <VariationBadge value={dayResults.pedidosVar} />
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground tabular-nums">
              {dayResults.totalPedidos}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Total de pedidos
            </p>
          </div>

          {/* Ticket Medio */}
          <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100">
                <Receipt className="h-5 w-5 text-violet-600" />
              </div>
              <VariationBadge value={dayResults.ticketVar} />
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground tabular-nums">
              {formatBRL(dayResults.ticketMedio)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ticket medio
            </p>
          </div>

          {/* Lucro Estimado */}
          <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <VariationBadge value={dayResults.lucroVar} />
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground tabular-nums">
              {formatBRL(dayResults.lucroEstimado)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Lucro estimado
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            3-4-5. OPERATIONAL + DELIVERIES + COMPARATIVE
        ══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* 3. Operational Block */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <ChefHat className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Operacional</h3>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
                <p className="text-xl font-bold text-amber-700 tabular-nums">{operational.pendentes}</p>
                <p className="text-[10px] font-medium text-amber-600 uppercase">Pendentes</p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-center">
                <p className="text-xl font-bold text-blue-700 tabular-nums">{operational.emPreparo}</p>
                <p className="text-[10px] font-medium text-blue-600 uppercase">Preparo</p>
              </div>
              <div className="rounded-lg bg-violet-50 border border-violet-100 p-3 text-center">
                <p className="text-xl font-bold text-violet-700 tabular-nums">{operational.saiuParaEntrega}</p>
                <p className="text-[10px] font-medium text-violet-600 uppercase">Entrega</p>
              </div>
              <div
                className={cn(
                  "rounded-lg border p-3 text-center",
                  operational.atrasados > 0
                    ? "bg-red-50 border-red-200"
                    : "bg-muted/50 border-border"
                )}
              >
                <p
                  className={cn(
                    "text-xl font-bold tabular-nums",
                    operational.atrasados > 0 ? "text-red-600" : "text-muted-foreground"
                  )}
                >
                  {operational.atrasados}
                </p>
                <p
                  className={cn(
                    "text-[10px] font-medium uppercase",
                    operational.atrasados > 0 ? "text-red-500" : "text-muted-foreground"
                  )}
                >
                  Atrasados
                </p>
              </div>
            </div>

            {/* Prep time */}
            <div
              className={cn(
                "rounded-lg p-3 flex items-center justify-between",
                operational.isTempoAcimaDaMedia ? "bg-amber-50 border border-amber-100" : "bg-muted/50"
              )}
            >
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Tempo medio preparo</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    operational.isTempoAcimaDaMedia ? "text-amber-700" : "text-foreground"
                  )}
                >
                  {operational.tempoMedioPreparoHoje}min
                </span>
                {operational.isTempoAcimaDaMedia && (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
              </div>
            </div>
          </div>

          {/* 4. Deliveries Block */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Entregas</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total realizadas</span>
                <span className="text-lg font-bold text-foreground tabular-nums">{delivery.totalEntregasHoje}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pago a entregadores</span>
                <span className="text-lg font-bold text-foreground tabular-nums">{formatBRL(delivery.valorTotalPagoEntregadores)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Media por entrega</span>
                <span className="text-sm font-semibold text-foreground tabular-nums">{formatBRL(delivery.mediaGanhoPorEntrega)}</span>
              </div>

              <div className="h-px bg-border my-2" />

              {/* Top deliveryman */}
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
                  <Bike className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{delivery.entregadorMaisAtivo.nome}</p>
                  <p className="text-xs text-muted-foreground">Mais ativo do dia</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground tabular-nums">{delivery.entregadorMaisAtivo.entregas}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">entregas</p>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Comparative Block */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Hoje vs Ontem</h3>
              <span className="text-xs text-muted-foreground ml-auto">(mesmo horario)</span>
            </div>

            <div className="space-y-3">
              {/* Faturamento */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Faturamento</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-foreground tabular-nums">
                      {formatBRL(comparative.hojeVsOntem.faturamentoHoje)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      vs {formatBRL(comparative.hojeVsOntem.faturamentoOntem)}
                    </span>
                  </div>
                </div>
                <VariationBadge value={comparative.hojeVsOntem.faturamentoVar} />
              </div>

              <div className="h-px bg-border" />

              {/* Pedidos */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Pedidos</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-foreground tabular-nums">
                      {comparative.hojeVsOntem.pedidosHoje}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      vs {comparative.hojeVsOntem.pedidosOntem}
                    </span>
                  </div>
                </div>
                <VariationBadge value={comparative.hojeVsOntem.pedidosVar} />
              </div>

              <div className="h-px bg-border" />

              {/* Ticket */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Ticket Medio</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-foreground tabular-nums">
                      {formatBRL(comparative.hojeVsOntem.ticketHoje)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      vs {formatBRL(comparative.hojeVsOntem.ticketOntem)}
                    </span>
                  </div>
                </div>
                <VariationBadge value={comparative.hojeVsOntem.ticketVar} />
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            6-7. FEATURED PRODUCT + SMART ALERTS
        ══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

          {/* 6. Featured Product */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-5 w-5 text-amber-500" />
              <h3 className="text-sm font-semibold text-foreground">Produto Destaque do Dia</h3>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200">
                <Package className="h-8 w-8 text-amber-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-foreground">{featured.nome}</h4>
                <div className="mt-2 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xl font-bold text-foreground tabular-nums">{featured.quantidadeVendida}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Vendidos</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground tabular-nums">{formatBRL(featured.receitaGerada)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Receita</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground tabular-nums">{featured.percentualDoTotal}%</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Do total</p>
                  </div>
                </div>
              </div>
            </div>

            {featured.sugestao && (
              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-100 p-3">
                <p className="text-xs text-amber-700">{featured.sugestao}</p>
              </div>
            )}
          </div>

          {/* 7. Smart Alerts */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Alertas Inteligentes</h3>
              {alerts.length > 0 && (
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
                  {alerts.length}
                </span>
              )}
            </div>

            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 mb-3">
                  <TrendingUp className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-sm font-medium text-foreground">Tudo funcionando bem!</p>
                <p className="text-xs text-muted-foreground mt-1">Nenhum alerta no momento</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => {
                  const iconMap = {
                    clock: Clock,
                    "trending-down": TrendingDown,
                    truck: Truck,
                    "x-circle": XCircle,
                    "alert-triangle": AlertTriangle,
                  }
                  const Icon = iconMap[alert.icon]

                  return (
                    <div
                      key={alert.id}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3",
                        alert.type === "danger" && "border-red-200 bg-red-50",
                        alert.type === "warning" && "border-amber-200 bg-amber-50",
                        alert.type === "info" && "border-blue-200 bg-blue-50"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                          alert.type === "danger" && "bg-red-100",
                          alert.type === "warning" && "bg-amber-100",
                          alert.type === "info" && "bg-blue-100"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            alert.type === "danger" && "text-red-600",
                            alert.type === "warning" && "text-amber-600",
                            alert.type === "info" && "text-blue-600"
                          )}
                        />
                      </div>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            alert.type === "danger" && "text-red-700",
                            alert.type === "warning" && "text-amber-700",
                            alert.type === "info" && "text-blue-700"
                          )}
                        >
                          {alert.title}
                        </p>
                        <p
                          className={cn(
                            "text-xs mt-0.5",
                            alert.type === "danger" && "text-red-600",
                            alert.type === "warning" && "text-amber-600",
                            alert.type === "info" && "text-blue-600"
                          )}
                        >
                          {alert.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
