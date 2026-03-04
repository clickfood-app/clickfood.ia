// ── Overview / Visao Geral mock data generator ──
// All data is deterministic based on period selection

import { MOCK_CLIENTS } from "@/lib/clients-data"
import { initialProducts } from "@/lib/products-data"
import { initialCoupons, initialExclusiveCoupons, ticketComparison } from "@/lib/coupons-data"
import { formatBRL } from "@/lib/finance-data"

export { formatBRL }

export type PeriodKey = "30" | "90" | "120"

// ── Daily revenue data per period ──

interface DailyDataPoint {
  date: string // "DD/MM"
  dateISO: string
  faturamento: number
  pedidos: number
  ticketMedio: number
  dayOfWeek: number // 0 = Sunday
}

function generateDailyData(days: number): DailyDataPoint[] {
  const data: DailyDataPoint[] = []
  const baseDate = new Date(2026, 1, 23) // Feb 23 2026

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() - i)

    const dayOfWeek = date.getDay()
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")

    // Realistic restaurant patterns: weekends are busier
    const weekdayMultiplier =
      dayOfWeek === 5 ? 1.45 : // Friday
      dayOfWeek === 6 ? 1.6 :  // Saturday
      dayOfWeek === 0 ? 1.2 :  // Sunday
      dayOfWeek === 1 ? 0.7 :  // Monday
      1.0

    // Seed-based pseudo-random for consistency
    const seed = (date.getFullYear() * 1000 + (date.getMonth() + 1) * 50 + date.getDate() * 7) % 100
    const noise = 0.8 + (seed / 100) * 0.4

    const basePedidos = Math.round(38 * weekdayMultiplier * noise)
    const baseTicket = 42 + (seed % 20) - 10
    const faturamento = Math.round(basePedidos * baseTicket)

    data.push({
      date: `${day}/${month}`,
      dateISO: date.toISOString().split("T")[0],
      faturamento,
      pedidos: basePedidos,
      ticketMedio: Math.round((faturamento / basePedidos) * 100) / 100,
      dayOfWeek,
    })
  }

  return data
}

const data30 = generateDailyData(30)
const data90 = generateDailyData(90)
const data120 = generateDailyData(120)

const dataByPeriod: Record<PeriodKey, DailyDataPoint[]> = {
  "30": data30,
  "90": data90,
  "120": data120,
}

// ── KPI helpers ──

export interface OverviewKPIs {
  faturamentoTotal: number
  faturamentoAnterior: number
  faturamentoVar: number
  totalPedidos: number
  pedidosAnterior: number
  pedidosVar: number
  ticketMedio: number
  ticketAnterior: number
  ticketVar: number
  lucroEstimado: number
  lucroAnterior: number
  lucroVar: number
  novosClientes: number
  novosClientesAnterior: number
  novosClientesVar: number
}

export function getKPIs(period: PeriodKey): OverviewKPIs {
  const data = dataByPeriod[period]
  const days = parseInt(period)

  const faturamentoTotal = data.reduce((s, d) => s + d.faturamento, 0)
  const totalPedidos = data.reduce((s, d) => s + d.pedidos, 0)
  const ticketMedio = totalPedidos > 0 ? faturamentoTotal / totalPedidos : 0

  // Simulate previous period with ~85-95% of current
  const prevMult = 0.88 + (days % 5) * 0.02
  const faturamentoAnterior = Math.round(faturamentoTotal * prevMult)
  const pedidosAnterior = Math.round(totalPedidos * (prevMult + 0.02))
  const ticketAnterior = pedidosAnterior > 0 ? faturamentoAnterior / pedidosAnterior : 0

  // Costs estimate at ~40% of revenue
  const custos = faturamentoTotal * 0.40
  const custosAnterior = faturamentoAnterior * 0.40
  const lucroEstimado = faturamentoTotal - custos
  const lucroAnterior = faturamentoAnterior - custosAnterior

  // New clients scale with period
  const baseNew = days <= 30 ? 18 : days <= 90 ? 52 : 68
  const basePrev = Math.round(baseNew * 0.82)

  return {
    faturamentoTotal,
    faturamentoAnterior,
    faturamentoVar: pctChange(faturamentoTotal, faturamentoAnterior),
    totalPedidos,
    pedidosAnterior,
    pedidosVar: pctChange(totalPedidos, pedidosAnterior),
    ticketMedio,
    ticketAnterior,
    ticketVar: pctChange(ticketMedio, ticketAnterior),
    lucroEstimado,
    lucroAnterior,
    lucroVar: pctChange(lucroEstimado, lucroAnterior),
    novosClientes: baseNew,
    novosClientesAnterior: basePrev,
    novosClientesVar: pctChange(baseNew, basePrev),
  }
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

// ── Chart data ──

export function getChartData(period: PeriodKey) {
  const data = dataByPeriod[period]
  // For 90/120 day periods, aggregate weekly to keep chart readable
  if (parseInt(period) > 30) {
    const weeks: { date: string; faturamento: number; pedidos: number; ticketMedio: number }[] = []
    for (let i = 0; i < data.length; i += 7) {
      const slice = data.slice(i, i + 7)
      const fat = slice.reduce((s, d) => s + d.faturamento, 0)
      const ped = slice.reduce((s, d) => s + d.pedidos, 0)
      weeks.push({
        date: `${slice[0].date} - ${slice[slice.length - 1].date}`,
        faturamento: fat,
        pedidos: ped,
        ticketMedio: ped > 0 ? Math.round((fat / ped) * 100) / 100 : 0,
      })
    }
    return weeks
  }
  return data.map((d) => ({
    date: d.date,
    faturamento: d.faturamento,
    pedidos: d.pedidos,
    ticketMedio: d.ticketMedio,
  }))
}

// ── Order status ──

export interface OrderStatusData {
  concluidos: number
  cancelados: number
  emAndamento: number
  prepTimeAvg: number
  prepTimePrev: number
}

export function getOrderStatus(period: PeriodKey): OrderStatusData {
  const days = parseInt(period)
  const base = days <= 30 ? 1 : days <= 90 ? 2.8 : 3.8
  return {
    concluidos: Math.round(890 * base),
    cancelados: Math.round(42 * base),
    emAndamento: 12,
    prepTimeAvg: 22,
    prepTimePrev: 25,
  }
}

// ── Client analysis ──

export interface ClientAnalysis {
  ativos: number
  inativos: number
  retencao: number
  retencaoPrev: number
  frequenciaMedia: string
}

export function getClientAnalysis(period: PeriodKey): ClientAnalysis {
  const ativos = MOCK_CLIENTS.filter((c) => c.status === "ativo").length
  const inativos = MOCK_CLIENTS.filter((c) => c.status === "inativo").length
  const days = parseInt(period)
  const retencao = days <= 30 ? 72 : days <= 90 ? 68 : 65
  const retencaoPrev = retencao - (days <= 30 ? 12 : days <= 90 ? 8 : 5)
  return {
    ativos,
    inativos,
    retencao,
    retencaoPrev,
    frequenciaMedia: days <= 30 ? "2.3x" : days <= 90 ? "3.1x" : "3.8x",
  }
}

// ── Coupon impact ──

export interface CouponImpact {
  receitaCupons: number
  pctPedidosComCupom: number
  ticketComCupom: number
  ticketSemCupom: number
  cupomMaisUsado: string
}

export function getCouponImpact(_period: PeriodKey): CouponImpact {
  const allCoupons = [...initialCoupons]
  const bestCoupon = allCoupons.reduce(
    (best, c) => (c.usedCount > (best?.usedCount || 0) ? c : best),
    allCoupons[0]
  )
  const totalRevenue = allCoupons.reduce((s, c) => s + c.revenueGenerated, 0)
  const exclusiveRevenue = initialExclusiveCoupons.reduce((s, c) => s + c.revenueGenerated, 0)

  return {
    receitaCupons: totalRevenue + exclusiveRevenue,
    pctPedidosComCupom: 34,
    ticketComCupom: ticketComparison.withCoupon,
    ticketSemCupom: ticketComparison.withoutCoupon,
    cupomMaisUsado: bestCoupon.name,
  }
}

// ── Top products ──

export interface TopProduct {
  name: string
  quantity: number
  revenue: number
  pctFaturamento: number
}

export function getTopProducts(period: PeriodKey): TopProduct[] {
  const mult = parseInt(period) <= 30 ? 1 : parseInt(period) <= 90 ? 2.8 : 3.8
  const products = initialProducts
    .filter((p) => p.active && p.salesCount > 0)
    .sort((a, b) => b.salesCount - a.salesCount)
    .slice(0, 8)

  const totalRev = products.reduce(
    (s, p) => s + Math.round(p.salesCount * mult) * p.price,
    0
  )

  return products.map((p) => {
    const qty = Math.round(p.salesCount * mult)
    const rev = qty * p.price
    return {
      name: p.name,
      quantity: qty,
      revenue: rev,
      pctFaturamento: Math.round((rev / totalRev) * 1000) / 10,
    }
  })
}

// ── Day of week analysis ──

export interface DayOfWeekData {
  day: string
  dayShort: string
  revenue: number
  orders: number
  pctTotal: number
}

const dayNames = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"]
const dayShorts = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]

export function getDayOfWeekAnalysis(period: PeriodKey): DayOfWeekData[] {
  const data = dataByPeriod[period]
  const byDay: { revenue: number; orders: number }[] = Array.from({ length: 7 }, () => ({
    revenue: 0,
    orders: 0,
  }))

  data.forEach((d) => {
    byDay[d.dayOfWeek].revenue += d.faturamento
    byDay[d.dayOfWeek].orders += d.pedidos
  })

  const totalRev = byDay.reduce((s, d) => s + d.revenue, 0)

  return byDay.map((d, i) => ({
    day: dayNames[i],
    dayShort: dayShorts[i],
    revenue: d.revenue,
    orders: d.orders,
    pctTotal: totalRev > 0 ? Math.round((d.revenue / totalRev) * 1000) / 10 : 0,
  }))
}

// ── Smart alerts ──

export interface SmartAlert {
  id: string
  type: "positive" | "negative" | "neutral"
  message: string
}

export function getSmartAlerts(period: PeriodKey): SmartAlert[] {
  const kpis = getKPIs(period)
  const dayData = getDayOfWeekAnalysis(period)
  const bestDay = dayData.reduce((best, d) => (d.revenue > best.revenue ? d : best), dayData[0])
  const clientAnalysis = getClientAnalysis(period)
  const alerts: SmartAlert[] = []

  if (kpis.faturamentoVar > 0) {
    alerts.push({
      id: "a1",
      type: "positive",
      message: `Faturamento cresceu ${kpis.faturamentoVar}% em relacao ao periodo anterior.`,
    })
  } else {
    alerts.push({
      id: "a1",
      type: "negative",
      message: `Faturamento caiu ${Math.abs(kpis.faturamentoVar)}% em relacao ao periodo anterior.`,
    })
  }

  if (kpis.ticketVar < 0) {
    alerts.push({
      id: "a2",
      type: "negative",
      message: `Seu ticket medio caiu ${Math.abs(kpis.ticketVar)}%.`,
    })
  } else {
    alerts.push({
      id: "a2",
      type: "positive",
      message: `Ticket medio aumentou ${kpis.ticketVar}%.`,
    })
  }

  alerts.push({
    id: "a3",
    type: "positive",
    message: `Melhor dia de venda: ${bestDay.day} (${bestDay.pctTotal}% do faturamento).`,
  })

  if (clientAnalysis.retencao > clientAnalysis.retencaoPrev) {
    alerts.push({
      id: "a4",
      type: "positive",
      message: `Taxa de retencao aumentou ${clientAnalysis.retencao - clientAnalysis.retencaoPrev}% nos ultimos ${period} dias.`,
    })
  } else {
    alerts.push({
      id: "a4",
      type: "negative",
      message: `Clientes recorrentes diminuiram ${clientAnalysis.retencaoPrev - clientAnalysis.retencao}% no periodo.`,
    })
  }

  const orderStatus = getOrderStatus(period)
  const cancelRate = Math.round((orderStatus.cancelados / (orderStatus.concluidos + orderStatus.cancelados)) * 100)
  if (cancelRate > 4) {
    alerts.push({
      id: "a5",
      type: "negative",
      message: `Pedidos cancelados representam ${cancelRate}% do total. Investigue possiveis causas.`,
    })
  }

  alerts.push({
    id: "a6",
    type: "neutral",
    message: `${kpis.novosClientes} novos clientes no periodo, crescimento de ${kpis.novosClientesVar}%.`,
  })

  return alerts
}

// ── Comparative table ──

export interface ComparativeRow {
  metric: string
  current: string
  previous: string
  variation: number
}

export function getComparativeTable(period: PeriodKey): ComparativeRow[] {
  const kpis = getKPIs(period)
  return [
    {
      metric: "Faturamento",
      current: formatBRL(kpis.faturamentoTotal),
      previous: formatBRL(kpis.faturamentoAnterior),
      variation: kpis.faturamentoVar,
    },
    {
      metric: "Pedidos",
      current: kpis.totalPedidos.toLocaleString("pt-BR"),
      previous: kpis.pedidosAnterior.toLocaleString("pt-BR"),
      variation: kpis.pedidosVar,
    },
    {
      metric: "Ticket Medio",
      current: formatBRL(kpis.ticketMedio),
      previous: formatBRL(kpis.ticketAnterior),
      variation: kpis.ticketVar,
    },
    {
      metric: "Novos Clientes",
      current: kpis.novosClientes.toString(),
      previous: kpis.novosClientesAnterior.toString(),
      variation: kpis.novosClientesVar,
    },
  ]
}

// ── Projection data ──

export interface Projection {
  weeklyGrowth: number
  faturamento30d: number
  pedidos30d: number
  ticketTrend: "subindo" | "estavel" | "caindo"
}

export function getProjection(period: PeriodKey): Projection {
  const data = dataByPeriod[period]
  const days = data.length

  // Weekly growth: compare last 7 days vs previous 7 days
  const last7 = data.slice(-7)
  const prev7 = data.slice(-14, -7)
  const revLast = last7.reduce((s, d) => s + d.faturamento, 0)
  const revPrev = prev7.reduce((s, d) => s + d.faturamento, 0)
  const weeklyGrowth = revPrev > 0 ? Math.round(((revLast - revPrev) / revPrev) * 1000) / 10 : 0

  // Project 30 days forward
  const avgDaily = data.reduce((s, d) => s + d.faturamento, 0) / days
  const avgOrders = data.reduce((s, d) => s + d.pedidos, 0) / days
  const growthFactor = 1 + weeklyGrowth / 100
  const faturamento30d = Math.round(avgDaily * 30 * growthFactor)
  const pedidos30d = Math.round(avgOrders * 30 * growthFactor)

  // Ticket trend
  const kpis = getKPIs(period)
  const ticketTrend: Projection["ticketTrend"] =
    kpis.ticketVar > 2 ? "subindo" : kpis.ticketVar < -2 ? "caindo" : "estavel"

  return { weeklyGrowth, faturamento30d, pedidos30d, ticketTrend }
}

// ── Heatmap data (day of week with intensity) ──

export interface HeatmapDay {
  day: string
  dayShort: string
  avgRevenue: number
  avgOrders: number
  intensity: number // 0-1
  pctTotal: number
  isBest: boolean
}

export function getHeatmapData(period: PeriodKey): HeatmapDay[] {
  const dow = getDayOfWeekAnalysis(period)
  const data = dataByPeriod[period]
  const days = parseInt(period)

  // Count occurrences of each day
  const dayCounts = Array(7).fill(0)
  data.forEach((d) => { dayCounts[d.dayOfWeek]++ })

  const maxRevenue = Math.max(...dow.map((d) => d.revenue))
  const bestIdx = dow.findIndex((d) => d.revenue === maxRevenue)

  return dow.map((d, i) => ({
    day: d.day,
    dayShort: d.dayShort,
    avgRevenue: dayCounts[i] > 0 ? Math.round(d.revenue / dayCounts[i]) : 0,
    avgOrders: dayCounts[i] > 0 ? Math.round(d.orders / dayCounts[i]) : 0,
    intensity: maxRevenue > 0 ? d.revenue / maxRevenue : 0,
    pctTotal: d.pctTotal,
    isBest: i === bestIdx,
  }))
}

// ── Impact factors ──

export interface ImpactFactor {
  label: string
  value: string
  detail: string
  type: "positive" | "negative" | "neutral"
}

export function getImpactFactors(period: PeriodKey): ImpactFactor[] {
  const products = getTopProducts(period)
  const coupon = getCouponImpact(period)
  const client = getClientAnalysis(period)
  const kpis = getKPIs(period)
  const order = getOrderStatus(period)
  const cancelRate = Math.round((order.cancelados / (order.concluidos + order.cancelados)) * 100)

  // Best day ticket
  const dow = getDayOfWeekAnalysis(period)
  const bestTicketDay = dow.reduce((best, d) =>
    d.orders > 0 && (d.revenue / d.orders) > (best.revenue / Math.max(best.orders, 1)) ? d : best
  , dow[0])
  const bestTicketValue = bestTicketDay.orders > 0
    ? formatBRL(bestTicketDay.revenue / bestTicketDay.orders)
    : "N/A"

  return [
    {
      label: "Produto mais rentavel",
      value: products[0]?.name ?? "N/A",
      detail: `Gera ${products[0]?.pctFaturamento ?? 0}% do faturamento total`,
      type: "positive",
    },
    {
      label: "Pedidos com cupom",
      value: `${coupon.pctPedidosComCupom}%`,
      detail: `Ticket com cupom ${formatBRL(coupon.ticketComCupom)} vs ${formatBRL(coupon.ticketSemCupom)} sem`,
      type: coupon.ticketComCupom > coupon.ticketSemCupom ? "positive" : "neutral",
    },
    {
      label: "Clientes recorrentes",
      value: `${client.retencao}%`,
      detail: client.retencao > client.retencaoPrev
        ? `Aumentou ${client.retencao - client.retencaoPrev}% no periodo`
        : `Caiu ${client.retencaoPrev - client.retencao}% no periodo`,
      type: client.retencao > client.retencaoPrev ? "positive" : "negative",
    },
    {
      label: "Maior ticket medio",
      value: bestTicketValue,
      detail: `${bestTicketDay.day} tem o maior ticket medio`,
      type: "positive",
    },
    {
      label: "Taxa de cancelamento",
      value: `${cancelRate}%`,
      detail: `${order.cancelados} pedidos cancelados de ${order.concluidos + order.cancelados}`,
      type: cancelRate > 5 ? "negative" : cancelRate > 3 ? "neutral" : "positive",
    },
  ]
}

// ── Dynamic summary ──

export function getDynamicSummary(period: PeriodKey): string {
  const kpis = getKPIs(period)
  const dayData = getDayOfWeekAnalysis(period)
  const bestDay = dayData.reduce((best, d) => (d.revenue > best.revenue ? d : best), dayData[0])

  const fatFormatted = formatBRL(kpis.faturamentoTotal)
  const crescimento = kpis.faturamentoVar > 0
    ? `com crescimento de ${kpis.faturamentoVar}%`
    : `com queda de ${Math.abs(kpis.faturamentoVar)}%`
  const ticketDir = kpis.ticketVar > 0 ? "aumentou" : "caiu"

  return `Nos ultimos ${period} dias seu restaurante faturou ${fatFormatted}, ${crescimento}. Seu ticket medio ${ticketDir} e ${bestDay.day.toLowerCase()} e seu melhor dia.`
}
