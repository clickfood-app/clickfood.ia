// ── Sales Report deep analytics data generator ──
// Deterministic data based on period, reuses existing mock sources

import { initialProducts, initialCategories } from "@/lib/products-data"
import { MOCK_CLIENTS } from "@/lib/clients-data"
import { initialCoupons, initialExclusiveCoupons, ticketComparison } from "@/lib/coupons-data"

export type SalesPeriodKey = "30" | "90" | "120" | "custom"

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

// ── Daily data generator (same pattern as overview, for consistency) ──

interface DailyDataPoint {
  date: string
  dateISO: string
  faturamento: number
  pedidos: number
  ticketMedio: number
  dayOfWeek: number
  dayOfMonth: number
  hour: number[] // revenue by hour bucket (11-23)
}

function generateDailyData(days: number): DailyDataPoint[] {
  const data: DailyDataPoint[] = []
  const baseDate = new Date(2026, 1, 23)

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() - i)
    const dayOfWeek = date.getDay()
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")

    const weekdayMult =
      dayOfWeek === 5 ? 1.45 :
      dayOfWeek === 6 ? 1.6 :
      dayOfWeek === 0 ? 1.2 :
      dayOfWeek === 1 ? 0.7 :
      1.0

    const seed = (date.getFullYear() * 1000 + (date.getMonth() + 1) * 50 + date.getDate() * 7) % 100
    const noise = 0.8 + (seed / 100) * 0.4

    const basePedidos = Math.round(38 * weekdayMult * noise)
    const baseTicket = 42 + (seed % 20) - 10
    const fat = Math.round(basePedidos * baseTicket)

    // Hour distribution: restaurant pattern 11h-23h
    const hourRevenue: number[] = []
    const hourWeights = [3, 5, 4, 2, 1, 1, 2, 8, 14, 18, 12, 6, 2] // 11h to 23h
    const totalW = hourWeights.reduce((s, w) => s + w, 0)
    hourWeights.forEach((w) => {
      hourRevenue.push(Math.round((w / totalW) * fat))
    })

    data.push({
      date: `${day}/${month}`,
      dateISO: date.toISOString().split("T")[0],
      faturamento: fat,
      pedidos: basePedidos,
      ticketMedio: Math.round((fat / basePedidos) * 100) / 100,
      dayOfWeek,
      dayOfMonth: date.getDate(),
      hour: hourRevenue,
    })
  }
  return data
}

const d30 = generateDailyData(30)
const d90 = generateDailyData(90)
const d120 = generateDailyData(120)

const dataMap: Record<string, DailyDataPoint[]> = {
  "30": d30,
  "90": d90,
  "120": d120,
  custom: d30,
}

function pct(current: number, previous: number): number {
  if (previous === 0) return 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

// ── 1. Faturamento Detalhado ──

export interface SalesKPIs {
  receitaBruta: number
  receitaBrutaPrev: number
  receitaBrutaVar: number
  totalDescontos: number
  totalDescontosPrev: number
  totalDescontosVar: number
  receitaLiquida: number
  receitaLiquidaPrev: number
  receitaLiquidaVar: number
  totalPedidos: number
  totalPedidosPrev: number
  totalPedidosVar: number
  ticketMedio: number
  ticketMedioPrev: number
  ticketMedioVar: number
  valorPerdidoCancelamentos: number
  valorPerdidoPrev: number
  valorPerdidoVar: number
}

export function getSalesKPIs(period: SalesPeriodKey): SalesKPIs {
  const data = dataMap[period] || d30
  const days = data.length

  const receitaBruta = data.reduce((s, d) => s + d.faturamento, 0)
  const totalPedidos = data.reduce((s, d) => s + d.pedidos, 0)
  const ticketMedio = totalPedidos > 0 ? receitaBruta / totalPedidos : 0

  // Discounts ~8-12% of revenue
  const discountRate = 0.08 + (days % 3) * 0.02
  const totalDescontos = Math.round(receitaBruta * discountRate)
  const receitaLiquida = receitaBruta - totalDescontos

  // Cancel rate ~4.5%
  const cancelRate = 0.045 + (days % 4) * 0.003
  const cancelados = Math.round(totalPedidos * cancelRate)
  const valorPerdido = Math.round(cancelados * ticketMedio)

  // Previous period
  const prevMult = 0.88 + (days % 5) * 0.02
  const receitaBrutaPrev = Math.round(receitaBruta * prevMult)
  const totalPedidosPrev = Math.round(totalPedidos * (prevMult + 0.02))
  const ticketMedioPrev = totalPedidosPrev > 0 ? receitaBrutaPrev / totalPedidosPrev : 0
  const totalDescontosPrev = Math.round(receitaBrutaPrev * (discountRate - 0.01))
  const receitaLiquidaPrev = receitaBrutaPrev - totalDescontosPrev
  const canceladosPrev = Math.round(totalPedidosPrev * (cancelRate - 0.005))
  const valorPerdidoPrev = Math.round(canceladosPrev * ticketMedioPrev)

  return {
    receitaBruta,
    receitaBrutaPrev,
    receitaBrutaVar: pct(receitaBruta, receitaBrutaPrev),
    totalDescontos,
    totalDescontosPrev,
    totalDescontosVar: pct(totalDescontos, totalDescontosPrev),
    receitaLiquida,
    receitaLiquidaPrev,
    receitaLiquidaVar: pct(receitaLiquida, receitaLiquidaPrev),
    totalPedidos,
    totalPedidosPrev,
    totalPedidosVar: pct(totalPedidos, totalPedidosPrev),
    ticketMedio,
    ticketMedioPrev,
    ticketMedioVar: pct(ticketMedio, ticketMedioPrev),
    valorPerdidoCancelamentos: valorPerdido,
    valorPerdidoPrev,
    valorPerdidoVar: pct(valorPerdido, valorPerdidoPrev),
  }
}

// ── 2. Vendas por Produto ──

export interface ProductSalesRow {
  id: string
  name: string
  category: string
  categoryName: string
  quantity: number
  revenue: number
  pctFaturamento: number
  ticketMedio: number
  isMostSold: boolean
  isTopRevenue: boolean
}

export function getProductSales(period: SalesPeriodKey): ProductSalesRow[] {
  const mult = period === "30" ? 1 : period === "90" ? 2.8 : 3.8
  const products = initialProducts
    .filter((p) => p.active && p.salesCount > 0)
    .map((p) => {
      const qty = Math.round(p.salesCount * mult)
      const rev = Math.round(qty * p.price * 100) / 100
      const catName = initialCategories.find((c) => c.id === p.category)?.name || "Outros"
      return { id: p.id, name: p.name, category: p.category, categoryName: catName, quantity: qty, revenue: rev, ticketMedio: p.price, pctFaturamento: 0, isMostSold: false, isTopRevenue: false }
    })
    .sort((a, b) => b.revenue - a.revenue)

  const totalRev = products.reduce((s, p) => s + p.revenue, 0)
  products.forEach((p) => {
    p.pctFaturamento = totalRev > 0 ? Math.round((p.revenue / totalRev) * 1000) / 10 : 0
  })

  // Mark highlights
  const maxQty = Math.max(...products.map((p) => p.quantity))
  products.forEach((p) => {
    if (p.quantity === maxQty) p.isMostSold = true
  })
  if (products.length > 0) products[0].isTopRevenue = true

  return products
}

// ── 3. Vendas por Horario ──

export interface HourlyBucket {
  hour: string
  hourLabel: string
  revenue: number
  orders: number
  pctTotal: number
  isPeak: boolean
  isWeakest: boolean
}

export function getHourlySales(period: SalesPeriodKey): { buckets: HourlyBucket[]; insight: string } {
  const data = dataMap[period] || d30
  const hourLabels = ["11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h", "19h", "20h", "21h", "22h", "23h"]

  const totalByHour = hourLabels.map(() => ({ revenue: 0, orders: 0 }))
  data.forEach((d) => {
    d.hour.forEach((rev, idx) => {
      totalByHour[idx].revenue += rev
      totalByHour[idx].orders += Math.max(1, Math.round(d.pedidos * (d.hour[idx] / Math.max(1, d.faturamento))))
    })
  })

  const totalRev = totalByHour.reduce((s, h) => s + h.revenue, 0)
  const maxRev = Math.max(...totalByHour.map((h) => h.revenue))
  const minRev = Math.min(...totalByHour.map((h) => h.revenue))
  const peakIdx = totalByHour.findIndex((h) => h.revenue === maxRev)
  const weakIdx = totalByHour.findIndex((h) => h.revenue === minRev)

  // Compute % in peak window 18h-22h (indices 7-10)
  const peakWindowRev = totalByHour.slice(7, 11).reduce((s, h) => s + h.revenue, 0)
  const peakWindowPct = totalRev > 0 ? Math.round((peakWindowRev / totalRev) * 100) : 0

  const buckets: HourlyBucket[] = hourLabels.map((label, idx) => ({
    hour: label,
    hourLabel: label,
    revenue: totalByHour[idx].revenue,
    orders: totalByHour[idx].orders,
    pctTotal: totalRev > 0 ? Math.round((totalByHour[idx].revenue / totalRev) * 1000) / 10 : 0,
    isPeak: idx === peakIdx,
    isWeakest: idx === weakIdx,
  }))

  return {
    buckets,
    insight: `${peakWindowPct}% das vendas acontecem entre 18h e 22h. Pico de vendas as ${hourLabels[peakIdx]} e horario mais fraco as ${hourLabels[weakIdx]}.`,
  }
}

// ── 4. Vendas por Dia do Mes ──

export interface DailyRow {
  date: string
  dayOfMonth: number
  revenue: number
  orders: number
  isBest: boolean
  isWorst: boolean
}

export function getDailySales(period: SalesPeriodKey): { days: DailyRow[]; avgDaily: number; bestDay: DailyRow; worstDay: DailyRow } {
  const data = dataMap[period] || d30
  const maxRev = Math.max(...data.map((d) => d.faturamento))
  const minRev = Math.min(...data.map((d) => d.faturamento))
  const avgDaily = data.reduce((s, d) => s + d.faturamento, 0) / data.length

  const days: DailyRow[] = data.map((d) => ({
    date: d.date,
    dayOfMonth: d.dayOfMonth,
    revenue: d.faturamento,
    orders: d.pedidos,
    isBest: d.faturamento === maxRev,
    isWorst: d.faturamento === minRev,
  }))

  const bestDay = days.find((d) => d.isBest) || days[0]
  const worstDay = days.find((d) => d.isWorst) || days[0]

  return { days, avgDaily: Math.round(avgDaily), bestDay, worstDay }
}

// ── 5. Vendas por Tipo de Cliente ──

export interface ClientTypeGroup {
  type: string
  count: number
  revenue: number
  ticketMedio: number
  pctFaturamento: number
}

export function getClientTypeSales(period: SalesPeriodKey): { groups: ClientTypeGroup[]; insight: string } {
  const mult = period === "30" ? 1 : period === "90" ? 2.8 : 3.8
  const activeClients = MOCK_CLIENTS.filter((c) => c.status === "ativo" && !c.isBlocked)

  const vipClients = activeClients.filter((c) => c.orders.length >= 6)
  const recurrentClients = activeClients.filter((c) => c.orders.length >= 3 && c.orders.length < 6)
  const newClients = activeClients.filter((c) => c.orders.length < 3)

  const vipRevenue = Math.round(vipClients.reduce((s, c) => s + c.totalSpent, 0) * mult)
  const recRevenue = Math.round(recurrentClients.reduce((s, c) => s + c.totalSpent, 0) * mult)
  const newRevenue = Math.round(newClients.reduce((s, c) => s + c.totalSpent, 0) * mult)
  const totalRevenue = vipRevenue + recRevenue + newRevenue

  const groups: ClientTypeGroup[] = [
    {
      type: "VIP (+6 pedidos)",
      count: vipClients.length,
      revenue: vipRevenue,
      ticketMedio: vipClients.length > 0 ? Math.round(vipRevenue / (vipClients.length * Math.round(6 * mult))) : 0,
      pctFaturamento: totalRevenue > 0 ? Math.round((vipRevenue / totalRevenue) * 1000) / 10 : 0,
    },
    {
      type: "Recorrentes (3-5)",
      count: recurrentClients.length,
      revenue: recRevenue,
      ticketMedio: recurrentClients.length > 0 ? Math.round(recRevenue / (recurrentClients.length * Math.round(3.5 * mult))) : 0,
      pctFaturamento: totalRevenue > 0 ? Math.round((recRevenue / totalRevenue) * 1000) / 10 : 0,
    },
    {
      type: "Novos (1-2)",
      count: newClients.length,
      revenue: newRevenue,
      ticketMedio: newClients.length > 0 ? Math.round(newRevenue / (newClients.length * Math.round(1.5 * mult))) : 0,
      pctFaturamento: totalRevenue > 0 ? Math.round((newRevenue / totalRevenue) * 1000) / 10 : 0,
    },
  ]

  // Ticket comparison
  const recTicket = groups[1].ticketMedio
  const newTicket = groups[2].ticketMedio
  const ticketDiff = newTicket > 0 ? Math.round(((recTicket - newTicket) / newTicket) * 100) : 0

  return {
    groups,
    insight: ticketDiff > 0
      ? `Clientes recorrentes tem ticket ${ticketDiff}% maior que novos clientes.`
      : `Novos clientes estao com ticket medio proximo aos recorrentes.`,
  }
}

// ── 6. Impacto de Cupons e Descontos ──

export interface CouponSalesImpact {
  pctPedidosComCupom: number
  receitaComCupom: number
  ticketComCupom: number
  ticketSemCupom: number
  totalDescontosConcedidos: number
  isDiscountHigh: boolean
  cupomMaisUsado: string
}

export function getCouponSalesImpact(period: SalesPeriodKey): CouponSalesImpact {
  const allCoupons = [...initialCoupons]
  const totalRevenue = allCoupons.reduce((s, c) => s + c.revenueGenerated, 0)
  const exclusiveRevenue = initialExclusiveCoupons.reduce((s, c) => s + c.revenueGenerated, 0)
  const bestCoupon = allCoupons.reduce((best, c) => (c.usedCount > (best?.usedCount || 0) ? c : best), allCoupons[0])

  const mult = period === "30" ? 1 : period === "90" ? 2.8 : 3.8
  const totalDescontos = Math.round((totalRevenue + exclusiveRevenue) * 0.18 * mult)
  const kpis = getSalesKPIs(period)
  const discountPct = kpis.receitaBruta > 0 ? (totalDescontos / kpis.receitaBruta) * 100 : 0

  return {
    pctPedidosComCupom: 34,
    receitaComCupom: Math.round((totalRevenue + exclusiveRevenue) * mult),
    ticketComCupom: ticketComparison.withCoupon,
    ticketSemCupom: ticketComparison.withoutCoupon,
    totalDescontosConcedidos: totalDescontos,
    isDiscountHigh: discountPct > 12,
    cupomMaisUsado: bestCoupon.name,
  }
}

// ── 7. Cancelamentos e Perdas ──

export interface CancellationData {
  totalCancelados: number
  valorPerdido: number
  pctTotal: number
  pctPrev: number
  increased: boolean
  motivos: { motivo: string; count: number; pct: number }[]
}

export function getCancellations(period: SalesPeriodKey): CancellationData {
  const kpis = getSalesKPIs(period)
  const totalCancelados = Math.round(kpis.totalPedidos * 0.047)
  const valorPerdido = kpis.valorPerdidoCancelamentos
  const pctTotal = kpis.totalPedidos > 0 ? Math.round((totalCancelados / kpis.totalPedidos) * 1000) / 10 : 0

  const prevCancelados = Math.round(kpis.totalPedidosPrev * 0.042)
  const pctPrev = kpis.totalPedidosPrev > 0 ? Math.round((prevCancelados / kpis.totalPedidosPrev) * 1000) / 10 : 0

  const motivos = [
    { motivo: "Tempo de entrega longo", count: Math.round(totalCancelados * 0.35), pct: 35 },
    { motivo: "Pedido incorreto", count: Math.round(totalCancelados * 0.22), pct: 22 },
    { motivo: "Cliente desistiu", count: Math.round(totalCancelados * 0.18), pct: 18 },
    { motivo: "Produto indisponivel", count: Math.round(totalCancelados * 0.15), pct: 15 },
    { motivo: "Outros", count: Math.round(totalCancelados * 0.10), pct: 10 },
  ]

  return {
    totalCancelados,
    valorPerdido,
    pctTotal,
    pctPrev,
    increased: pctTotal > pctPrev,
    motivos,
  }
}

// ── Combo Opportunity Suggestions ──

export type ComboType = "frequently_bought" | "strong_weak" | "weak_hour" | "loyal_exclusive"

export interface ComboSuggestion {
  id: string
  type: ComboType
  typeBadge: string
  mainProduct: { id: string; name: string; price: number }
  complementProduct: { id: string; name: string; price: number }
  reason: string
  recurrence: number // % of orders containing both
  suggestedDiscount: number // %
  estimatedTicketIncrease: number // %
  estimatedMonthlyRevenue: number // R$
  hourRange?: string
}

export interface ComboOpportunitySummary {
  currentTicket: number
  potentialTicket: number
  totalOpportunities: number
  totalEstimatedRevenue: number
}

export function getComboSuggestions(period: SalesPeriodKey): ComboSuggestion[] {
  const products = getProductSales(period)
  const hourly = getHourlySales(period)
  const clientTypes = getClientTypeSales(period)

  const mult = period === "30" ? 1 : period === "90" ? 1.4 : 1.6

  // Find products by behavior
  const topSellers = products.filter((p) => p.quantity > 50 * mult).slice(0, 3)
  const lowSales = products.filter((p) => p.quantity < 20 * mult && p.quantity > 0).slice(0, 3)
  const weakHour = hourly.buckets.find((b) => b.isWeakest)

  // VIP ticket comparison
  const vipGroup = clientTypes.groups[0]
  const newGroup = clientTypes.groups[2]
  const vipTicketDiff = newGroup.ticketMedio > 0
    ? Math.round(((vipGroup.ticketMedio - newGroup.ticketMedio) / newGroup.ticketMedio) * 100)
    : 22

  const suggestions: ComboSuggestion[] = []

  // 1. Frequently bought together
  if (topSellers.length >= 1) {
    const main = topSellers[0]
    // Beverage most likely paired
    const complement = products.find((p) => p.categoryName === "Bebidas" && p.quantity > 30 * mult)
      || products.find((p) => p.categoryName === "Bebidas")
    if (complement) {
      const recurrence = 63 + Math.round((parseInt(period) % 7) * 2)
      suggestions.push({
        id: "combo-1",
        type: "frequently_bought",
        typeBadge: "Frequentemente Comprados Juntos",
        mainProduct: { id: main.id, name: main.name, price: main.ticketMedio },
        complementProduct: { id: complement.id, name: complement.name, price: complement.ticketMedio },
        reason: `${recurrence}% dos clientes que compram ${main.name} tambem pedem ${complement.name}. Criar combo com desconto incentiva o upsell natural.`,
        recurrence,
        suggestedDiscount: 8,
        estimatedTicketIncrease: 12,
        estimatedMonthlyRevenue: Math.round(2400 * mult),
        })
    }
  }

  // 2. Strong + Weak product
  if (topSellers.length >= 1 && lowSales.length >= 1) {
    const strong = topSellers.find((p) => p.categoryName === "Acompanhamentos") || topSellers[0]
    const weak = lowSales[0]
    suggestions.push({
      id: "combo-2",
      type: "strong_weak",
      typeBadge: "Produto Forte + Fraco",
      mainProduct: { id: strong.id, name: strong.name, price: strong.ticketMedio },
      complementProduct: { id: weak.id, name: weak.name, price: weak.ticketMedio },
      reason: `${strong.name} tem alto volume de vendas (${strong.quantity} un.) mas ${weak.name} tem baixa saida (${weak.quantity} un.). Combo ajuda a escoar estoque e aumentar diversidade.`,
      recurrence: 0,
      suggestedDiscount: 12,
      estimatedTicketIncrease: 8,
      estimatedMonthlyRevenue: Math.round(1800 * mult),
    })
  }

  // 3. Weak hour combo
  if (weakHour) {
    const main = topSellers[0] || products[0]
    const dessert = products.find((p) => p.categoryName === "Sobremesas" && p.quantity > 10 * mult)
      || products.find((p) => p.categoryName === "Sobremesas")
    if (main && dessert) {
      const avgRev = hourly.buckets.reduce((s, b) => s + b.revenue, 0) / hourly.buckets.length
      const weakPct = avgRev > 0 ? Math.round(((avgRev - weakHour.revenue) / avgRev) * 100) : 40
      suggestions.push({
        id: "combo-3",
        type: "weak_hour",
        typeBadge: "Combo para Horario Fraco",
        mainProduct: { id: main.id, name: main.name, price: main.ticketMedio },
        complementProduct: { id: dessert.id, name: dessert.name, price: dessert.ticketMedio },
        reason: `Entre ${weakHour.hour} e ${parseInt(weakHour.hour) + 2}h o volume e ${weakPct}% menor que a media. Combo promocional neste horario pode recuperar vendas perdidas.`,
        recurrence: 0,
        suggestedDiscount: 15,
        estimatedTicketIncrease: 6,
        estimatedMonthlyRevenue: Math.round(1200 * mult),
        hourRange: `${weakHour.hour} - ${parseInt(weakHour.hour) + 2}h`,
      })
    }
  }

  // 4. Loyal customer exclusive
  if (topSellers.length >= 2) {
    const main = topSellers[0]
    const side = products.find((p) => p.categoryName === "Acompanhamentos" && p.quantity > 20 * mult)
      || products.find((p) => p.categoryName === "Acompanhamentos")
    if (main && side) {
      suggestions.push({
        id: "combo-4",
        type: "loyal_exclusive",
        typeBadge: "Exclusivo para Clientes Fieis",
        mainProduct: { id: main.id, name: main.name, price: main.ticketMedio },
        complementProduct: { id: side.id, name: side.name, price: side.ticketMedio },
        reason: `Clientes recorrentes tem ticket ${vipTicketDiff}% maior. Combo exclusivo para fidelizados recompensa e incentiva compras maiores.`,
        recurrence: 0,
        suggestedDiscount: 10,
        estimatedTicketIncrease: 15,
        estimatedMonthlyRevenue: Math.round(3200 * mult),
      })
    }
  }

  return suggestions
}

export function getComboSummary(period: SalesPeriodKey): ComboOpportunitySummary {
  const kpis = getSalesKPIs(period)
  const suggestions = getComboSuggestions(period)
  const totalEstimated = suggestions.reduce((s, c) => s + c.estimatedMonthlyRevenue, 0)
  const avgTicketIncrease = suggestions.length > 0
    ? suggestions.reduce((s, c) => s + c.estimatedTicketIncrease, 0) / suggestions.length
    : 0

  return {
    currentTicket: Math.round(kpis.ticketMedio * 100) / 100,
    potentialTicket: Math.round(kpis.ticketMedio * (1 + avgTicketIncrease / 100) * 100) / 100,
    totalOpportunities: suggestions.length,
    totalEstimatedRevenue: totalEstimated,
  }
}

// ── 8. Analise Inteligente de Vendas ──

export function getSmartSalesSummary(period: SalesPeriodKey): string[] {
  const products = getProductSales(period)
  const hourly = getHourlySales(period)
  const clientTypes = getClientTypeSales(period)
  const cancellations = getCancellations(period)
  const topProduct = products[0]

  const insights: string[] = []

  if (topProduct) {
    insights.push(`Seu produto "${topProduct.name}" representa ${topProduct.pctFaturamento}% do faturamento.`)
  }

  insights.push(hourly.insight)
  insights.push(clientTypes.insight)

  if (cancellations.increased) {
    insights.push(`Cancelamentos aumentaram de ${cancellations.pctPrev}% para ${cancellations.pctTotal}% neste periodo.`)
  } else {
    insights.push(`Cancelamentos reduziram de ${cancellations.pctPrev}% para ${cancellations.pctTotal}% neste periodo.`)
  }

  return insights
}
