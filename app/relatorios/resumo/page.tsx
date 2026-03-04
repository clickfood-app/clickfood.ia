"use client"

import { useState, useMemo } from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Lightbulb,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  XCircle,
  Ticket,
  Sparkles,
  Target,
  Flame,
} from "lucide-react"
import {
  Cell,
  PieChart,
  Pie,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import AdminLayout from "@/components/admin-layout"
import { cn } from "@/lib/utils"
import {
  type PeriodKey,
  formatBRL,
  getKPIs,
  getOrderStatus,
  getClientAnalysis,
  getCouponImpact,
  getTopProducts,
  getDayOfWeekAnalysis,
  getSmartAlerts,
  getDynamicSummary,
  getComparativeTable,
  getProjection,
  getHeatmapData,
  getImpactFactors,
} from "@/lib/overview-data"

const periods: { key: PeriodKey; label: string }[] = [
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "120", label: "120 dias" },
]

export default function VisaoGeralPage() {
  const [period, setPeriod] = useState<PeriodKey>("30")

  const kpis = useMemo(() => getKPIs(period), [period])
  const orderStatus = useMemo(() => getOrderStatus(period), [period])
  const clientAnalysis = useMemo(() => getClientAnalysis(period), [period])
  const couponImpact = useMemo(() => getCouponImpact(period), [period])
  const topProducts = useMemo(() => getTopProducts(period), [period])
  const dayOfWeek = useMemo(() => getDayOfWeekAnalysis(period), [period])
  const alerts = useMemo(() => getSmartAlerts(period), [period])
  const summary = useMemo(() => getDynamicSummary(period), [period])
  const comparative = useMemo(() => getComparativeTable(period), [period])
  const projection = useMemo(() => getProjection(period), [period])
  const heatmap = useMemo(() => getHeatmapData(period), [period])
  const impactFactors = useMemo(() => getImpactFactors(period), [period])

  const bestDay = dayOfWeek.reduce((b, d) => (d.revenue > b.revenue ? d : b), dayOfWeek[0])

  // Pie chart data for order status
  const pieData = [
    { name: "Concluidos", value: orderStatus.concluidos, fill: "hsl(142, 76%, 36%)" },
    { name: "Cancelados", value: orderStatus.cancelados, fill: "hsl(0, 84%, 60%)" },
    { name: "Em andamento", value: orderStatus.emAndamento, fill: "hsl(217, 91%, 60%)" },
  ]
  const totalOrders = orderStatus.concluidos + orderStatus.cancelados + orderStatus.emAndamento

  const pieConfig: ChartConfig = {
    concluidos: { label: "Concluidos", color: "hsl(142, 76%, 36%)" },
    cancelados: { label: "Cancelados", color: "hsl(0, 84%, 60%)" },
    emAndamento: { label: "Em andamento", color: "hsl(217, 91%, 60%)" },
  }

  const kpiCards = [
    {
      label: "Faturamento Total",
      value: formatBRL(kpis.faturamentoTotal),
      change: kpis.faturamentoVar,
      icon: <DollarSign className="h-5 w-5" />,
      iconBg: "bg-blue-100 text-blue-600",
    },
    {
      label: "Total de Pedidos",
      value: kpis.totalPedidos.toLocaleString("pt-BR"),
      change: kpis.pedidosVar,
      icon: <ShoppingCart className="h-5 w-5" />,
      iconBg: "bg-blue-100 text-blue-600",
    },
    {
      label: "Ticket Medio",
      value: formatBRL(kpis.ticketMedio),
      change: kpis.ticketVar,
      icon: <TrendingUp className="h-5 w-5" />,
      iconBg: "bg-blue-100 text-blue-600",
    },
    {
      label: "Lucro Estimado",
      value: formatBRL(kpis.lucroEstimado),
      change: kpis.lucroVar,
      icon: <BarChart3 className="h-5 w-5" />,
      iconBg: "bg-green-100 text-green-600",
    },
    {
      label: "Novos Clientes",
      value: kpis.novosClientes.toString(),
      change: kpis.novosClientesVar,
      icon: <Users className="h-5 w-5" />,
      iconBg: "bg-blue-100 text-blue-600",
    },
  ]

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header + Period Selector */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground text-balance">Visao Geral</h1>
            <p className="mt-1 text-sm text-muted-foreground">Panorama completo do restaurante</p>
          </div>

          {/* 1. Period Selector */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {periods.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium transition-all",
                  period === p.key
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Summary */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
          <Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
          <p className="text-sm leading-relaxed text-blue-800">{summary}</p>
        </div>

        {/* 2. KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {kpiCards.map((kpi) => (
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
                {kpi.change >= 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-600" />
                )}
                <span className={cn("text-xs font-medium", kpi.change >= 0 ? "text-green-600" : "text-red-600")}>
                  {kpi.change >= 0 ? "+" : ""}{kpi.change}% vs periodo anterior
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── RESUMO ESTRATEGICO DO PERIODO ── */}
        <div className="flex items-center gap-3 mt-2">
          <div className="h-px flex-1 bg-border" />
          <div className="flex items-center gap-2 rounded-full border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5 px-4 py-1.5">
            <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" />
            <span className="text-sm font-semibold text-[hsl(var(--primary))]">Resumo Estrategico do Periodo</span>
          </div>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* 1. Comparativo Periodo Atual vs Anterior */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold text-card-foreground mb-5">Comparativo: Periodo Atual vs Anterior</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Metrica</th>
                  <th className="pb-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Periodo Atual</th>
                  <th className="pb-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Periodo Anterior</th>
                  <th className="pb-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Variacao</th>
                </tr>
              </thead>
              <tbody>
                {comparative.map((row) => (
                  <tr key={row.metric} className="border-b border-border/50 last:border-0">
                    <td className="py-3.5 font-medium text-card-foreground">{row.metric}</td>
                    <td className="py-3.5 text-right tabular-nums font-semibold text-card-foreground">{row.current}</td>
                    <td className="py-3.5 text-right tabular-nums text-muted-foreground">{row.previous}</td>
                    <td className="py-3.5 text-right">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        row.variation >= 0
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      )}>
                        {row.variation >= 0 ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {row.variation >= 0 ? "+" : ""}{row.variation}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. Tendencia e Projecao */}
        <div className="rounded-xl border border-[hsl(var(--primary))]/20 bg-gradient-to-br from-blue-50 to-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-5 w-5 text-[hsl(var(--primary))]" />
            <h2 className="text-lg font-bold text-card-foreground">Tendencia e Projecao</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Crescimento Semanal</p>
              <p className={cn(
                "mt-2 text-2xl font-bold",
                projection.weeklyGrowth >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {projection.weeklyGrowth >= 0 ? "+" : ""}{projection.weeklyGrowth}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">media por semana</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Projecao Faturamento 30d</p>
              <p className="mt-2 text-2xl font-bold text-[hsl(var(--primary))]">
                {formatBRL(projection.faturamento30d)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">proximos 30 dias</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Projecao Pedidos 30d</p>
              <p className="mt-2 text-2xl font-bold text-card-foreground">
                {projection.pedidos30d.toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">pedidos estimados</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tendencia Ticket</p>
              <p className={cn(
                "mt-2 text-2xl font-bold capitalize",
                projection.ticketTrend === "subindo" ? "text-green-600"
                  : projection.ticketTrend === "caindo" ? "text-red-600"
                  : "text-muted-foreground"
              )}>
                {projection.ticketTrend === "subindo" ? "Subindo" : projection.ticketTrend === "caindo" ? "Caindo" : "Estavel"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">ticket medio</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
            <p className="text-xs leading-relaxed text-blue-800">
              {projection.weeklyGrowth >= 0
                ? `Seu faturamento esta crescendo em media ${projection.weeklyGrowth}% por semana. Mantendo essa tendencia, a projecao para os proximos 30 dias e ${formatBRL(projection.faturamento30d)}.`
                : `Seu faturamento esta retraindo ${Math.abs(projection.weeklyGrowth)}% por semana. Considere acoes promocionais para reverter a tendencia.`
              }
            </p>
          </div>
        </div>

        {/* 3. Performance por Dia da Semana (Heatmap) */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Calendar className="h-5 w-5 text-[hsl(var(--primary))]" />
            <h2 className="text-lg font-bold text-card-foreground">Performance por Dia da Semana</h2>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {heatmap.map((d) => (
              <div
                key={d.day}
                className={cn(
                  "relative rounded-xl p-3 text-center transition-all",
                  d.isBest
                    ? "ring-2 ring-[hsl(var(--primary))] ring-offset-2"
                    : ""
                )}
                style={{
                  backgroundColor: `hsl(217, 91%, ${95 - Math.round(d.intensity * 40)}%)`,
                }}
              >
                <p className={cn(
                  "text-xs font-bold uppercase tracking-wide",
                  d.intensity > 0.7 ? "text-blue-900" : "text-blue-700"
                )}>
                  {d.dayShort}
                </p>
                <p className={cn(
                  "mt-2 text-lg font-bold tabular-nums",
                  d.intensity > 0.7 ? "text-blue-900" : "text-blue-800"
                )}>
                  {formatBRL(d.avgRevenue)}
                </p>
                <p className={cn(
                  "text-[10px] mt-0.5",
                  d.intensity > 0.7 ? "text-blue-800" : "text-blue-600"
                )}>
                  {d.avgOrders} pedidos
                </p>
                <p className={cn(
                  "mt-1 text-xs font-semibold",
                  d.intensity > 0.7 ? "text-blue-900" : "text-blue-700"
                )}>
                  {d.pctTotal}%
                </p>
                {d.isBest && (
                  <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                    <Flame className="h-3 w-3" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-start gap-2">
            <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
            <p className="text-xs leading-relaxed text-blue-800">
              {bestDay.day} representa {bestDay.pctTotal}% do seu faturamento total. Considere concentrar promocoes nos dias mais fracos.
            </p>
          </div>
        </div>

        {/* 4. Fatores que Mais Impactam o Faturamento */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Target className="h-5 w-5 text-[hsl(var(--primary))]" />
            <h2 className="text-lg font-bold text-card-foreground">Fatores que Mais Impactam o Faturamento</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {impactFactors.map((factor) => (
              <div
                key={factor.label}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4",
                  factor.type === "positive"
                    ? "border-green-200 bg-green-50"
                    : factor.type === "negative"
                      ? "border-red-200 bg-red-50"
                      : "border-blue-200 bg-blue-50"
                )}
              >
                <div className={cn(
                  "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                  factor.type === "positive"
                    ? "bg-green-200 text-green-700"
                    : factor.type === "negative"
                      ? "bg-red-200 text-red-700"
                      : "bg-blue-200 text-blue-700"
                )}>
                  {factor.type === "positive" ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : factor.type === "negative" ? (
                    <ArrowDownRight className="h-4 w-4" />
                  ) : (
                    <BarChart3 className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-xs font-medium uppercase tracking-wide",
                    factor.type === "positive" ? "text-green-700"
                      : factor.type === "negative" ? "text-red-700"
                      : "text-blue-700"
                  )}>
                    {factor.label}
                  </p>
                  <p className={cn(
                    "mt-1 text-lg font-bold truncate",
                    factor.type === "positive" ? "text-green-800"
                      : factor.type === "negative" ? "text-red-800"
                      : "text-blue-800"
                  )}>
                    {factor.value}
                  </p>
                  <p className={cn(
                    "mt-0.5 text-xs",
                    factor.type === "positive" ? "text-green-600"
                      : factor.type === "negative" ? "text-red-600"
                      : "text-blue-600"
                  )}>
                    {factor.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Performance Operacional + 5. Analise de Clientes */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Order Status */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-bold text-card-foreground mb-5">Performance Operacional</h2>
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <ChartContainer config={pieConfig} className="h-[180px] w-[180px] flex-shrink-0">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <div className="flex-1 space-y-3 w-full">
                <div className="flex items-center justify-between rounded-lg bg-green-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Concluidos</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-green-800">{orderStatus.concluidos.toLocaleString()}</span>
                    <span className="ml-2 text-xs text-green-600">{Math.round((orderStatus.concluidos / totalOrders) * 100)}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-800">Cancelados</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-red-800">{orderStatus.cancelados.toLocaleString()}</span>
                    <span className="ml-2 text-xs text-red-600">{Math.round((orderStatus.cancelados / totalOrders) * 100)}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Em andamento</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-blue-800">{orderStatus.emAndamento}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Tempo medio de preparo</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-lg font-bold text-foreground">{orderStatus.prepTimeAvg} min</span>
                      <span className={cn(
                        "text-xs font-medium",
                        orderStatus.prepTimeAvg < orderStatus.prepTimePrev ? "text-green-600" : "text-red-600"
                      )}>
                        {orderStatus.prepTimeAvg < orderStatus.prepTimePrev ? "-" : "+"}
                        {Math.abs(orderStatus.prepTimeAvg - orderStatus.prepTimePrev)} min vs anterior
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Client Analysis */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-bold text-card-foreground mb-5">Analise de Clientes</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-green-50 p-4">
                <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Ativos</p>
                <p className="mt-1 text-2xl font-bold text-green-800">{clientAnalysis.ativos}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-4">
                <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Inativos</p>
                <p className="mt-1 text-2xl font-bold text-red-800">{clientAnalysis.inativos}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Taxa de Retencao</p>
                <p className="mt-1 text-2xl font-bold text-blue-800">{clientAnalysis.retencao}%</p>
                <div className="mt-1 flex items-center gap-1">
                  {clientAnalysis.retencao > clientAnalysis.retencaoPrev ? (
                    <ArrowUpRight className="h-3 w-3 text-green-600" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-600" />
                  )}
                  <span className={cn(
                    "text-xs font-medium",
                    clientAnalysis.retencao > clientAnalysis.retencaoPrev ? "text-green-600" : "text-red-600"
                  )}>
                    {clientAnalysis.retencao > clientAnalysis.retencaoPrev ? "+" : ""}
                    {clientAnalysis.retencao - clientAnalysis.retencaoPrev}%
                  </span>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Frequencia Media</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{clientAnalysis.frequenciaMedia}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">compras por cliente</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
              <p className="text-xs leading-relaxed text-blue-800">
                Sua taxa de retencao {clientAnalysis.retencao > clientAnalysis.retencaoPrev ? "aumentou" : "diminuiu"} {Math.abs(clientAnalysis.retencao - clientAnalysis.retencaoPrev)}% nos ultimos {period} dias.
              </p>
            </div>
          </div>
        </div>

        {/* 6. Impacto de Cupons */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold text-card-foreground mb-5">Impacto de Cupons</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Ticket className="h-4 w-4 text-[hsl(var(--primary))]" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Receita de Cupons</span>
              </div>
              <p className="text-xl font-bold text-foreground">{formatBRL(couponImpact.receitaCupons)}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="h-4 w-4 text-[hsl(var(--primary))]" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pedidos com Cupom</span>
              </div>
              <p className="text-xl font-bold text-foreground">{couponImpact.pctPedidosComCupom}%</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ticket com Cupom</span>
              </div>
              <p className="text-xl font-bold text-foreground">{formatBRL(couponImpact.ticketComCupom)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">vs {formatBRL(couponImpact.ticketSemCupom)} sem cupom</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-[hsl(var(--primary))]" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mais Usado</span>
              </div>
              <p className="text-base font-bold text-foreground truncate">{couponImpact.cupomMaisUsado}</p>
            </div>
          </div>
        </div>

        {/* 7. Top Products */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold text-card-foreground mb-5">Top Produtos</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">#</th>
                  <th className="pb-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produto</th>
                  <th className="pb-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qtd</th>
                  <th className="pb-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Receita</th>
                  <th className="pb-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">%</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((prod, idx) => (
                  <tr key={prod.name} className="border-b border-border/50 last:border-0">
                    <td className="py-3">
                      <span className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                        idx === 0
                          ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                          : idx < 3
                            ? "bg-blue-50 text-blue-600"
                            : "bg-muted text-muted-foreground"
                      )}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-card-foreground">{prod.name}</td>
                    <td className="py-3 text-right tabular-nums text-muted-foreground">{prod.quantity}</td>
                    <td className="py-3 text-right tabular-nums font-medium text-card-foreground">{formatBRL(prod.revenue)}</td>
                    <td className="py-3 text-right">
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{prod.pctFaturamento}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 9. Smart Alerts */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold text-card-foreground mb-5">Alertas Inteligentes</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4",
                  alert.type === "positive"
                    ? "border-green-200 bg-green-50"
                    : alert.type === "negative"
                      ? "border-red-200 bg-red-50"
                      : "border-blue-200 bg-blue-50"
                )}
              >
                {alert.type === "positive" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                ) : alert.type === "negative" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                ) : (
                  <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                )}
                <p className={cn(
                  "text-sm leading-relaxed",
                  alert.type === "positive"
                    ? "text-green-800"
                    : alert.type === "negative"
                      ? "text-red-800"
                      : "text-blue-800"
                )}>
                  {alert.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
