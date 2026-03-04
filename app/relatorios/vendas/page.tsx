"use client"

import { useState, useMemo } from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  Ban,
  BarChart3,
  Clock,
  Crown,
  DollarSign,
  Lightbulb,
  Package,
  Percent,
  Rocket,
  ShoppingCart,
  Tag,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  Zap,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { cn } from "@/lib/utils"
import {
  type SalesPeriodKey,
  formatBRL,
  getSalesKPIs,
  getProductSales,
  getHourlySales,
  getDailySales,
  getClientTypeSales,
  getCouponSalesImpact,
  getCancellations,
  getSmartSalesSummary,
  getComboSuggestions,
  getComboSummary,
} from "@/lib/sales-data"

const periods: { key: SalesPeriodKey; label: string }[] = [
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "120", label: "120 dias" },
]

type SortField = "name" | "categoryName" | "quantity" | "revenue" | "pctFaturamento" | "ticketMedio"
type SortDir = "asc" | "desc"

export default function VendasPage() {
  const [period, setPeriod] = useState<SalesPeriodKey>("30")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("revenue")
  const [sortDir, setSortDir] = useState<SortDir>("desc")



  const kpis = useMemo(() => getSalesKPIs(period), [period])
  const allProducts = useMemo(() => getProductSales(period), [period])
  const hourly = useMemo(() => getHourlySales(period), [period])
  const daily = useMemo(() => getDailySales(period), [period])
  const clientTypes = useMemo(() => getClientTypeSales(period), [period])
  const couponImpact = useMemo(() => getCouponSalesImpact(period), [period])
  const cancellations = useMemo(() => getCancellations(period), [period])
  const smartSummary = useMemo(() => getSmartSalesSummary(period), [period])
  const comboSuggestions = useMemo(() => getComboSuggestions(period), [period])
  const comboSummary = useMemo(() => getComboSummary(period), [period])



  // Categories for filter
  const categories = useMemo(() => {
    const cats = Array.from(new Set(allProducts.map((p) => p.categoryName)))
    return cats.sort()
  }, [allProducts])

  // Filtered & sorted products
  const filteredProducts = useMemo(() => {
    let list = categoryFilter === "all" ? allProducts : allProducts.filter((p) => p.categoryName === categoryFilter)
    list = [...list].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return list
  }, [allProducts, categoryFilter, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
  }

  // Hourly chart max for bars
  const hourlyMax = Math.max(...hourly.buckets.map((h) => h.revenue))

  // KPI cards
  const kpiCards = [
    { label: "Receita Bruta", value: formatBRL(kpis.receitaBruta), change: kpis.receitaBrutaVar, icon: <DollarSign className="h-5 w-5" />, iconBg: "bg-blue-100 text-blue-600" },
    { label: "Total de Descontos", value: formatBRL(kpis.totalDescontos), change: kpis.totalDescontosVar, icon: <Tag className="h-5 w-5" />, iconBg: "bg-amber-100 text-amber-600", invertColor: true },
    { label: "Receita Liquida", value: formatBRL(kpis.receitaLiquida), change: kpis.receitaLiquidaVar, icon: <TrendingUp className="h-5 w-5" />, iconBg: "bg-green-100 text-green-600" },
    { label: "Total de Pedidos", value: kpis.totalPedidos.toLocaleString("pt-BR"), change: kpis.totalPedidosVar, icon: <ShoppingCart className="h-5 w-5" />, iconBg: "bg-blue-100 text-blue-600" },
    { label: "Ticket Medio", value: formatBRL(kpis.ticketMedio), change: kpis.ticketMedioVar, icon: <BarChart3 className="h-5 w-5" />, iconBg: "bg-blue-100 text-blue-600" },
    { label: "Perdido c/ Cancelamentos", value: formatBRL(kpis.valorPerdidoCancelamentos), change: kpis.valorPerdidoVar, icon: <XCircle className="h-5 w-5" />, iconBg: "bg-red-100 text-red-600", invertColor: true },
  ]

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header + Period Selector */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground text-balance">Vendas</h1>
            <p className="mt-1 text-sm text-muted-foreground">Analise detalhada de faturamento e performance de vendas</p>
          </div>
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

        {/* ── 1. Faturamento Detalhado ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-[hsl(var(--primary))]" />
            <h2 className="text-lg font-bold text-foreground">Faturamento Detalhado</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kpiCards.map((kpi) => {
              const isGrowth = kpi.invertColor ? kpi.change <= 0 : kpi.change >= 0
              return (
                <div key={kpi.label} className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", kpi.iconBg)}>
                      {kpi.icon}
                    </span>
                  </div>
                  <p className="mt-4 text-xl font-bold text-card-foreground truncate">{kpi.value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{kpi.label}</p>
                  <div className="mt-2 flex items-center gap-1">
                    {isGrowth ? (
                      <ArrowUpRight className="h-3 w-3 text-green-600" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-red-600" />
                    )}
                    <span className={cn("text-xs font-medium", isGrowth ? "text-green-600" : "text-red-600")}>
                      {kpi.change >= 0 ? "+" : ""}{kpi.change}% vs periodo anterior
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── OPORTUNIDADES PARA AUMENTAR O TICKET MEDIO ── */}
        <section>
          {/* Section divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-border" />
            <div className="flex items-center gap-2 rounded-full border border-green-300 bg-green-50 px-4 py-1.5">
              <Rocket className="h-4 w-4 text-green-600" />
              <span className="text-sm font-semibold text-green-700">Oportunidades para Aumentar o Ticket Medio</span>
            </div>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Mini summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ticket Medio Atual</p>
              <p className="mt-2 text-2xl font-bold text-[hsl(var(--primary))]">{formatBRL(comboSummary.currentTicket)}</p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Ticket Medio Potencial</p>
              <p className="mt-2 text-2xl font-bold text-green-700">{formatBRL(comboSummary.potentialTicket)}</p>
              <p className="mt-1 text-xs text-green-600">
                +{Math.round(((comboSummary.potentialTicket - comboSummary.currentTicket) / comboSummary.currentTicket) * 100)}% com sugestoes aplicadas
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Receita Estimada Extra</p>
              <p className="mt-2 text-2xl font-bold text-green-600">+{formatBRL(comboSummary.totalEstimatedRevenue)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{comboSummary.totalOpportunities} oportunidades identificadas</p>
            </div>
          </div>

          {/* Combo suggestion cards */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {comboSuggestions.map((suggestion) => {
              const typeConfig = {
                frequently_bought: { icon: <Zap className="h-4 w-4" />, color: "bg-blue-100 text-blue-700 border-blue-200", tagBg: "bg-blue-100 text-blue-700" },
                strong_weak: { icon: <Target className="h-4 w-4" />, color: "bg-amber-100 text-amber-700 border-amber-200", tagBg: "bg-amber-100 text-amber-700" },
                weak_hour: { icon: <Clock className="h-4 w-4" />, color: "bg-purple-100 text-purple-700 border-purple-200", tagBg: "bg-purple-100 text-purple-700" },
                loyal_exclusive: { icon: <Crown className="h-4 w-4" />, color: "bg-emerald-100 text-emerald-700 border-emerald-200", tagBg: "bg-emerald-100 text-emerald-700" },
              }[suggestion.type]

              const comboPrice = suggestion.mainProduct.price + suggestion.complementProduct.price
              const discountedPrice = comboPrice * (1 - suggestion.suggestedDiscount / 100)

              return (
                <div
                  key={suggestion.id}
                  className="rounded-xl border border-border bg-card p-6 transition-all hover:shadow-lg"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", typeConfig.color)}>
                      {typeConfig.icon}
                      {suggestion.typeBadge}
                    </span>
                  </div>

                  {/* Products */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Principal</p>
                      <p className="mt-1 text-sm font-bold text-card-foreground truncate">{suggestion.mainProduct.name}</p>
                      <p className="text-xs text-muted-foreground">{formatBRL(suggestion.mainProduct.price)}</p>
                    </div>
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] text-xs font-bold">+</div>
                    <div className="flex-1 rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Complementar</p>
                      <p className="mt-1 text-sm font-bold text-card-foreground truncate">{suggestion.complementProduct.name}</p>
                      <p className="text-xs text-muted-foreground">{formatBRL(suggestion.complementProduct.price)}</p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 mb-4">
                    <p className="text-xs leading-relaxed text-blue-800">{suggestion.reason}</p>
                  </div>

                  {/* Impact metrics */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {suggestion.recurrence > 0 && (
                      <div className="text-center">
                        <p className="text-lg font-bold text-[hsl(var(--primary))]">{suggestion.recurrence}%</p>
                        <p className="text-[10px] text-muted-foreground">recorrencia</p>
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-600">+{suggestion.estimatedTicketIncrease}%</p>
                      <p className="text-[10px] text-muted-foreground">ticket medio</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-600">+{formatBRL(suggestion.estimatedMonthlyRevenue)}</p>
                      <p className="text-[10px] text-muted-foreground">/mes estimado</p>
                    </div>
                  </div>

                  {/* Combo price preview */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground line-through">{formatBRL(comboPrice)}</span>
                      <span className="text-sm font-bold text-green-700">{formatBRL(discountedPrice)}</span>
                    </div>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                      -{suggestion.suggestedDiscount}%
                    </span>
                  </div>

                  {suggestion.hourRange && (
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Valido das {suggestion.hourRange}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── 2. Vendas por Produto ── */}
        <section>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-[hsl(var(--primary))]" />
                <h2 className="text-lg font-bold text-card-foreground">Vendas por Produto</h2>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="category-filter" className="sr-only">Filtrar por categoria</label>
                <select
                  id="category-filter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30"
                >
                  <option value="all">Todas as categorias</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {([
                      { field: "name" as SortField, label: "Produto" },
                      { field: "categoryName" as SortField, label: "Categoria" },
                      { field: "quantity" as SortField, label: "Qtd. Vendida" },
                      { field: "revenue" as SortField, label: "Receita" },
                      { field: "pctFaturamento" as SortField, label: "% Faturamento" },
                      { field: "ticketMedio" as SortField, label: "Ticket Medio" },
                    ]).map((col) => (
                      <th
                        key={col.field}
                        className="pb-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground"
                        onClick={() => toggleSort(col.field)}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          <SortIcon field={col.field} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className={cn(
                      "border-b border-border/50 last:border-0",
                      p.isMostSold && "bg-blue-50/50",
                      p.isTopRevenue && "bg-green-50/50",
                    )}>
                      <td className="py-3.5 font-medium text-card-foreground">
                        <div className="flex items-center gap-2">
                          {p.name}
                          {p.isMostSold && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              Mais Vendido
                            </span>
                          )}
                          {p.isTopRevenue && !p.isMostSold && (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                              Top Receita
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 text-muted-foreground">{p.categoryName}</td>
                      <td className="py-3.5 tabular-nums font-semibold text-card-foreground">{p.quantity.toLocaleString("pt-BR")}</td>
                      <td className="py-3.5 tabular-nums font-semibold text-card-foreground">{formatBRL(p.revenue)}</td>
                      <td className="py-3.5 tabular-nums">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 max-w-[80px] rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${Math.min(100, p.pctFaturamento * 3)}%` }} />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">{p.pctFaturamento}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 tabular-nums text-card-foreground">{formatBRL(p.ticketMedio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── 3. Vendas por Horario + 4. Vendas por Dia do Mes ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Vendas por Horario */}
          <section className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Clock className="h-5 w-5 text-[hsl(var(--primary))]" />
              <h2 className="text-lg font-bold text-card-foreground">Horarios Mais Lucrativos</h2>
            </div>
            <div className="space-y-2">
              {hourly.buckets.map((h) => (
                <div key={h.hour} className="flex items-center gap-3">
                  <span className={cn(
                    "w-10 text-right text-xs font-bold tabular-nums",
                    h.isPeak ? "text-green-600" : h.isWeakest ? "text-red-500" : "text-muted-foreground"
                  )}>
                    {h.hour}
                  </span>
                  <div className="flex-1 h-6 bg-muted rounded overflow-hidden relative">
                    <div
                      className={cn(
                        "h-full rounded transition-all",
                        h.isPeak
                          ? "bg-green-500"
                          : h.isWeakest
                            ? "bg-red-400"
                            : "bg-[hsl(var(--primary))]"
                      )}
                      style={{ width: `${hourlyMax > 0 ? (h.revenue / hourlyMax) * 100 : 0}%` }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-card-foreground">
                      {formatBRL(h.revenue)}
                    </span>
                  </div>
                  <span className="w-14 text-right text-[10px] text-muted-foreground tabular-nums">{h.pctTotal}%</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                <span className="text-xs font-medium text-green-700">Pico: {hourly.buckets.find((h) => h.isPeak)?.hour}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                <span className="text-xs font-medium text-red-600">Mais Fraco: {hourly.buckets.find((h) => h.isWeakest)?.hour}</span>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
              <p className="text-xs leading-relaxed text-blue-800">{hourly.insight}</p>
            </div>
          </section>

          {/* Vendas por Dia do Mes */}
          <section className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="h-5 w-5 text-[hsl(var(--primary))]" />
              <h2 className="text-lg font-bold text-card-foreground">Vendas por Dia</h2>
            </div>
            {/* 3 Summary cards */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">Melhor Dia</p>
                <p className="mt-2 text-base font-bold text-green-800">{daily.bestDay.date}</p>
                <p className="mt-1 text-sm font-semibold text-green-700">{formatBRL(daily.bestDay.revenue)}</p>
                <p className="mt-0.5 text-[10px] text-green-600">{daily.bestDay.orders} pedidos</p>
              </div>
              <div className="rounded-lg border border-[hsl(var(--primary))]/20 bg-blue-50 p-4 text-center">
                <p className="text-[10px] font-semibold text-[hsl(var(--primary))] uppercase tracking-wide">Media Diaria</p>
                <p className="mt-2 text-base font-bold text-card-foreground">{formatBRL(daily.avgDaily)}</p>
                <p className="mt-1 text-sm font-semibold text-[hsl(var(--primary))]">{Math.round(daily.avgDaily / (kpis.ticketMedio || 1))} pedidos</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{daily.days.length} dias analisados</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide">Pior Dia</p>
                <p className="mt-2 text-base font-bold text-red-800">{daily.worstDay.date}</p>
                <p className="mt-1 text-sm font-semibold text-red-700">{formatBRL(daily.worstDay.revenue)}</p>
                <p className="mt-0.5 text-[10px] text-red-600">{daily.worstDay.orders} pedidos</p>
              </div>
            </div>
            {/* Dynamic smart summary */}
            {(() => {
              const worstPctOfAvg = daily.avgDaily > 0
                ? Math.round((daily.worstDay.revenue / daily.avgDaily) * 100)
                : 0
              const bestVsWorst = daily.worstDay.revenue > 0
                ? Math.round((daily.bestDay.revenue / daily.worstDay.revenue) * 10) / 10
                : 0
              const aboveAvgDays = daily.days.filter((d) => d.revenue >= daily.avgDaily).length
              const belowAvgDays = daily.days.length - aboveAvgDays

              return (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-blue-600" />
                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Resumo Inteligente</p>
                  </div>
                  <p className="text-xs leading-relaxed text-blue-800">
                    Seu melhor desempenho foi no dia {daily.bestDay.date} com {formatBRL(daily.bestDay.revenue)}.
                  </p>
                  <p className="text-xs leading-relaxed text-blue-800">
                    O pior dia representou apenas {worstPctOfAvg}% da sua media diaria ({formatBRL(daily.avgDaily)}).
                  </p>
                  <p className="text-xs leading-relaxed text-blue-800">
                    {bestVsWorst > 2
                      ? `Ha variacao significativa entre os dias — o melhor faturou ${bestVsWorst}x mais que o pior.`
                      : `A variacao entre dias esta relativamente controlada (${bestVsWorst}x de diferenca).`
                    }
                  </p>
                  <p className="text-xs leading-relaxed text-blue-800">
                    {aboveAvgDays} dias ficaram acima da media e {belowAvgDays} abaixo.
                  </p>
                </div>
              )
            })()}
          </section>
        </div>

        {/* ── 5. Vendas por Tipo de Cliente ── */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Users className="h-5 w-5 text-[hsl(var(--primary))]" />
            <h2 className="text-lg font-bold text-card-foreground">Vendas por Tipo de Cliente</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {clientTypes.groups.map((group, idx) => {
              const colors = [
                { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-700", textDark: "text-amber-800", icon: "bg-amber-200 text-amber-700" },
                { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700", textDark: "text-blue-800", icon: "bg-blue-200 text-blue-700" },
                { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700", textDark: "text-emerald-800", icon: "bg-emerald-200 text-emerald-700" },
              ]
              const c = colors[idx] || colors[0]
              return (
                <div key={group.type} className={cn("rounded-xl border p-5", c.border, c.bg)}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", c.icon)}>
                      <Users className="h-4 w-4" />
                    </span>
                    <div>
                      <p className={cn("text-sm font-bold", c.textDark)}>{group.type}</p>
                      <p className={cn("text-xs", c.text)}>{group.count} clientes</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs", c.text)}>Receita Total</span>
                      <span className={cn("text-sm font-bold tabular-nums", c.textDark)}>{formatBRL(group.revenue)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs", c.text)}>Ticket Medio</span>
                      <span className={cn("text-sm font-bold tabular-nums", c.textDark)}>{formatBRL(group.ticketMedio)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs", c.text)}>% Faturamento</span>
                      <span className={cn("text-sm font-bold tabular-nums", c.textDark)}>{group.pctFaturamento}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-start gap-2">
            <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
            <p className="text-xs leading-relaxed text-blue-800">{clientTypes.insight}</p>
          </div>
        </section>

        {/* ── 6. Cupons e Descontos + 7. Cancelamentos ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Impacto de Cupons e Descontos */}
          <section className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Percent className="h-5 w-5 text-[hsl(var(--primary))]" />
              <h2 className="text-lg font-bold text-card-foreground">Impacto de Cupons e Descontos</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Pedidos c/ Cupom</p>
                  <p className="mt-1 text-xl font-bold text-card-foreground">{couponImpact.pctPedidosComCupom}%</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Receita c/ Cupom</p>
                  <p className="mt-1 text-xl font-bold text-card-foreground">{formatBRL(couponImpact.receitaComCupom)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="text-center flex-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Ticket c/ Cupom</p>
                  <p className="mt-1 text-lg font-bold text-green-600">{formatBRL(couponImpact.ticketComCupom)}</p>
                </div>
                <div className="text-muted-foreground text-xs font-semibold">vs</div>
                <div className="text-center flex-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Ticket s/ Cupom</p>
                  <p className="mt-1 text-lg font-bold text-card-foreground">{formatBRL(couponImpact.ticketSemCupom)}</p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Total de Descontos Concedidos</p>
                  <p className="text-sm font-bold text-card-foreground">{formatBRL(couponImpact.totalDescontosConcedidos)}</p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Cupom Mais Usado</p>
                  <p className="text-sm font-semibold text-card-foreground">{couponImpact.cupomMaisUsado}</p>
                </div>
              </div>
              {couponImpact.isDiscountHigh && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                  <p className="text-xs leading-relaxed text-amber-800">
                    Alerta: o volume de descontos esta acima de 12% da receita bruta. Considere revisar a politica de cupons.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Cancelamentos e Perdas */}
          <section className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Ban className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-bold text-card-foreground">Cancelamentos e Perdas</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                  <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide">Cancelados</p>
                  <p className="mt-1 text-xl font-bold text-red-800">{cancellations.totalCancelados}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                  <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide">Valor Perdido</p>
                  <p className="mt-1 text-xl font-bold text-red-800">{formatBRL(cancellations.valorPerdido)}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                  <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide">% do Total</p>
                  <p className="mt-1 text-xl font-bold text-red-800">{cancellations.pctTotal}%</p>
                </div>
              </div>
              {/* Motivos */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Principais Motivos</p>
                <div className="space-y-2">
                  {cancellations.motivos.map((m) => (
                    <div key={m.motivo} className="flex items-center gap-3">
                      <span className="text-xs text-card-foreground flex-1 truncate">{m.motivo}</span>
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-red-400" style={{ width: `${m.pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground tabular-nums w-10 text-right">{m.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
              {cancellations.increased && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                  <p className="text-xs leading-relaxed text-red-800">
                    Alerta: cancelamentos aumentaram de {cancellations.pctPrev}% para {cancellations.pctTotal}% neste periodo. Investigue as causas principais.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── 8. Analise Inteligente de Vendas ── */}
        <section className="rounded-xl border border-[hsl(var(--primary))]/20 bg-gradient-to-br from-blue-50 to-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Lightbulb className="h-5 w-5 text-[hsl(var(--primary))]" />
            <h2 className="text-lg font-bold text-card-foreground">Analise Inteligente de Vendas</h2>
          </div>
          <div className="space-y-3">
            {smartSummary.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] text-xs font-bold">
                  {idx + 1}
                </span>
                <p className="text-sm leading-relaxed text-card-foreground">{insight}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}
