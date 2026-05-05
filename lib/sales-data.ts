// lib/sales-data.ts
// ── Sales Report deep analytics data generator ──
// Deterministic data based on period, reuses existing mock sources

import { initialProducts, initialCategories } from "@/lib/products-data"
import { MOCK_CLIENTS } from "@/lib/clients-data"
import {
  initialCoupons,
  initialExclusiveCoupons,
  ticketComparison,
} from "@/lib/coupons-data"

export type SalesPeriodKey = "30" | "90" | "120" | "custom"

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0)
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function round2(value: number): number {
  return Math.round(safeNumber(value) * 100) / 100
}

function round1(value: number): number {
  return Math.round(safeNumber(value) * 10) / 10
}

function sumBy<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((sum, item) => sum + safeNumber(selector(item)), 0)
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return sumBy(values, (v) => v) / values.length
}

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0
  }
  return numerator / denominator
}

function pct(current: number, previous: number): number {
  if (!Number.isFinite(previous) || previous === 0) return 0
  return round1(((current - previous) / previous) * 100)
}

function getPeriodMultiplier(period: SalesPeriodKey): number {
  switch (period) {
    case "30":
      return 1
    case "90":
      return 2.8
    case "120":
      return 3.8
    case "custom":
    default:
      return 1
  }
}

function getComboMultiplier(period: SalesPeriodKey): number {
  switch (period) {
    case "30":
      return 1
    case "90":
      return 1.4
    case "120":
      return 1.6
    case "custom":
    default:
      return 1
  }
}

function getStablePeriodSeed(period: SalesPeriodKey): number {
  switch (period) {
    case "30":
      return 30
    case "90":
      return 90
    case "120":
      return 120
    case "custom":
    default:
      return 30
  }
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
  const safeDays = Math.max(0, Math.floor(days))
  const data: DailyDataPoint[] = []
  const baseDate = new Date(2026, 1, 23)

  for (let i = safeDays - 1; i >= 0; i--) {
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

    const seed =
      (date.getFullYear() * 1000 + (date.getMonth() + 1) * 50 + date.getDate() * 7) % 100

    const noise = 0.8 + (seed / 100) * 0.4

    const basePedidos = Math.max(1, Math.round(38 * weekdayMult * noise))
    const baseTicket = 42 + (seed % 20) - 10
    const fat = Math.max(0, Math.round(basePedidos * baseTicket))

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
      ticketMedio: round2(safeDivide(fat, basePedidos)),
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

const dataMap: Record<SalesPeriodKey, DailyDataPoint[]> = {
  "30": d30,
  "90": d90,
  "120": d120,
  custom: d30,
}

function getPeriodData(period: SalesPeriodKey): DailyDataPoint[] {
  return dataMap[period] ?? d30
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
  const data = getPeriodData(period)
  const days = data.length

  const receitaBruta = sumBy(data, (d) => d.faturamento)
  const totalPedidos = sumBy(data, (d) => d.pedidos)
  const ticketMedio = safeDivide(receitaBruta, totalPedidos)

  const discountRate = 0.08 + (days % 3) * 0.02
  const totalDescontos = Math.round(receitaBruta * discountRate)
  const receitaLiquida = receitaBruta - totalDescontos

  const cancelRate = 0.045 + (days % 4) * 0.003
  const cancelados = Math.round(totalPedidos * cancelRate)
  const valorPerdido = Math.round(cancelados * ticketMedio)

  const prevMult = 0.88 + (days % 5) * 0.02
  const receitaBrutaPrev = Math.round(receitaBruta * prevMult)
  const totalPedidosPrev = Math.round(totalPedidos * (prevMult + 0.02))
  const ticketMedioPrev = safeDivide(receitaBrutaPrev, totalPedidosPrev)
  const totalDescontosPrev = Math.round(receitaBrutaPrev * Math.max(0, discountRate - 0.01))
  const receitaLiquidaPrev = receitaBrutaPrev - totalDescontosPrev
  const canceladosPrev = Math.round(totalPedidosPrev * Math.max(0, cancelRate - 0.005))
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
    ticketMedio: round2(ticketMedio),
    ticketMedioPrev: round2(ticketMedioPrev),
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
  const mult = getPeriodMultiplier(period)

  const products: ProductSalesRow[] = initialProducts
    .filter((p) => p.active && safeNumber(p.salesCount) > 0)
    .map((p) => {
      const qty = Math.max(0, Math.round(safeNumber(p.salesCount) * mult))
      const price = safeNumber(p.price)
      const rev = round2(qty * price)
      const catName =
        initialCategories.find((c) => c.id === p.category)?.name || "Outros"

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        categoryName: catName,
        quantity: qty,
        revenue: rev,
        ticketMedio: price,
        pctFaturamento: 0,
        isMostSold: false,
        isTopRevenue: false,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  const totalRev = sumBy(products, (p) => p.revenue)

  products.forEach((p) => {
    p.pctFaturamento = totalRev > 0 ? round1((p.revenue / totalRev) * 100) : 0
  })

  if (products.length === 0) {
    return []
  }

  const maxQty = Math.max(...products.map((p) => p.quantity))

  products.forEach((p) => {
    if (p.quantity === maxQty) p.isMostSold = true
  })

  products[0].isTopRevenue = true

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

export function getHourlySales(
  period: SalesPeriodKey
): { buckets: HourlyBucket[]; insight: string } {
  const data = getPeriodData(period)
  const hourLabels = ["11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h", "19h", "20h", "21h", "22h", "23h"]

  const totalByHour = hourLabels.map(() => ({ revenue: 0, orders: 0 }))

  data.forEach((d) => {
    d.hour.forEach((rev, idx) => {
      if (!totalByHour[idx]) return

      totalByHour[idx].revenue += safeNumber(rev)

      const proportionalOrders = Math.round(
        safeNumber(d.pedidos) * safeDivide(safeNumber(d.hour[idx]), Math.max(1, safeNumber(d.faturamento)))
      )

      totalByHour[idx].orders += Math.max(0, proportionalOrders)
    })
  })

  const totalRev = sumBy(totalByHour, (h) => h.revenue)

  if (totalByHour.length === 0) {
    return {
      buckets: [],
      insight: "Ainda nao ha dados suficientes por horario.",
    }
  }

  const revenues = totalByHour.map((h) => h.revenue)
  const maxRev = Math.max(...revenues)
  const minRev = Math.min(...revenues)

  const peakIdx = totalByHour.findIndex((h) => h.revenue === maxRev)
  const weakIdx = totalByHour.findIndex((h) => h.revenue === minRev)

  const peakWindowRev = totalByHour.slice(7, 11).reduce((s, h) => s + h.revenue, 0)
  const peakWindowPct = totalRev > 0 ? Math.round((peakWindowRev / totalRev) * 100) : 0

  const buckets: HourlyBucket[] = hourLabels.map((label, idx) => ({
    hour: label,
    hourLabel: label,
    revenue: totalByHour[idx].revenue,
    orders: totalByHour[idx].orders,
    pctTotal: totalRev > 0 ? round1((totalByHour[idx].revenue / totalRev) * 100) : 0,
    isPeak: idx === peakIdx,
    isWeakest: idx === weakIdx,
  }))

  const peakLabel = peakIdx >= 0 ? hourLabels[peakIdx] : "—"
  const weakLabel = weakIdx >= 0 ? hourLabels[weakIdx] : "—"

  return {
    buckets,
    insight: `${peakWindowPct}% das vendas acontecem entre 18h e 22h. Pico de vendas as ${peakLabel} e horario mais fraco as ${weakLabel}.`,
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

export function getDailySales(
  period: SalesPeriodKey
): { days: DailyRow[]; avgDaily: number; bestDay: DailyRow | null; worstDay: DailyRow | null } {
  const data = getPeriodData(period)

  if (data.length === 0) {
    return {
      days: [],
      avgDaily: 0,
      bestDay: null,
      worstDay: null,
    }
  }

  const maxRev = Math.max(...data.map((d) => d.faturamento))
  const minRev = Math.min(...data.map((d) => d.faturamento))
  const avgDaily = safeDivide(sumBy(data, (d) => d.faturamento), data.length)

  const days: DailyRow[] = data.map((d) => ({
    date: d.date,
    dayOfMonth: d.dayOfMonth,
    revenue: d.faturamento,
    orders: d.pedidos,
    isBest: d.faturamento === maxRev,
    isWorst: d.faturamento === minRev,
  }))

  const bestDay = days.find((d) => d.isBest) ?? null
  const worstDay = days.find((d) => d.isWorst) ?? null

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

export function getClientTypeSales(
  period: SalesPeriodKey
): { groups: ClientTypeGroup[]; insight: string } {
  const mult = getPeriodMultiplier(period)
  const activeClients = MOCK_CLIENTS.filter((c) => c.status === "ativo" && !c.isBlocked)

  const vipClients = activeClients.filter((c) => c.orders.length >= 6)
  const recurrentClients = activeClients.filter((c) => c.orders.length >= 3 && c.orders.length < 6)
  const newClients = activeClients.filter((c) => c.orders.length < 3)

  const vipRevenue = Math.round(sumBy(vipClients, (c) => c.totalSpent) * mult)
  const recRevenue = Math.round(sumBy(recurrentClients, (c) => c.totalSpent) * mult)
  const newRevenue = Math.round(sumBy(newClients, (c) => c.totalSpent) * mult)
  const totalRevenue = vipRevenue + recRevenue + newRevenue

  const groups: ClientTypeGroup[] = [
    {
      type: "VIP (+6 pedidos)",
      count: vipClients.length,
      revenue: vipRevenue,
      ticketMedio:
        vipClients.length > 0
          ? Math.round(safeDivide(vipRevenue, vipClients.length * Math.max(1, Math.round(6 * mult))))
          : 0,
      pctFaturamento: totalRevenue > 0 ? round1((vipRevenue / totalRevenue) * 100) : 0,
    },
    {
      type: "Recorrentes (3-5)",
      count: recurrentClients.length,
      revenue: recRevenue,
      ticketMedio:
        recurrentClients.length > 0
          ? Math.round(safeDivide(recRevenue, recurrentClients.length * Math.max(1, Math.round(3.5 * mult))))
          : 0,
      pctFaturamento: totalRevenue > 0 ? round1((recRevenue / totalRevenue) * 100) : 0,
    },
    {
      type: "Novos (1-2)",
      count: newClients.length,
      revenue: newRevenue,
      ticketMedio:
        newClients.length > 0
          ? Math.round(safeDivide(newRevenue, newClients.length * Math.max(1, Math.round(1.5 * mult))))
          : 0,
      pctFaturamento: totalRevenue > 0 ? round1((newRevenue / totalRevenue) * 100) : 0,
    },
  ]

  const recTicket = groups[1]?.ticketMedio ?? 0
  const newTicket = groups[2]?.ticketMedio ?? 0
  const ticketDiff = newTicket > 0 ? Math.round(((recTicket - newTicket) / newTicket) * 100) : 0

  return {
    groups,
    insight:
      ticketDiff > 0
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
  const exclusiveCoupons = [...initialExclusiveCoupons]
  const mult = getPeriodMultiplier(period)
  const kpis = getSalesKPIs(period)

  const totalUsedCoupons = sumBy(allCoupons, (c) => safeNumber(c.usedCount))

  const totalUsedExclusiveCoupons = exclusiveCoupons.reduce((sum, coupon) => {
    return sum + (coupon.usedAt ? 1 : 0)
  }, 0)

  const totalCouponUses = totalUsedCoupons + totalUsedExclusiveCoupons

  const pctPedidosComCupom =
    kpis.totalPedidos > 0
      ? round1((totalCouponUses / kpis.totalPedidos) * 100)
      : 0

  const receitaComCupom = Math.round(totalCouponUses * kpis.ticketMedio)

  const totalDescontosBase = sumBy(allCoupons, (c) => {
    const usedCount = safeNumber(c.usedCount)
    const discountValue = safeNumber(c.discountValue)
    return usedCount * discountValue
  })

  const totalDescontosExclusive = exclusiveCoupons.reduce((sum, coupon) => {
    const wasUsed = Boolean(coupon.usedAt)
    const discountValue = safeNumber(coupon.discountValue)
    return sum + (wasUsed ? discountValue : 0)
  }, 0)

  const totalDescontosConcedidos = Math.round(
    (totalDescontosBase + totalDescontosExclusive) * mult
  )

  const discountPct =
    kpis.receitaBruta > 0
      ? (totalDescontosConcedidos / kpis.receitaBruta) * 100
      : 0

  const bestCoupon =
    allCoupons.length > 0
      ? allCoupons.reduce<(typeof allCoupons)[number] | null>((best, current) => {
          if (!best) return current
          return safeNumber(current.usedCount) > safeNumber(best.usedCount)
            ? current
            : best
        }, null)
      : null

  const averageDiscountPerCouponUse =
    totalCouponUses > 0
      ? totalDescontosConcedidos / totalCouponUses
      : 0

  const computedTicketWithoutCoupon = round2(kpis.ticketMedio)
  const computedTicketWithCoupon = round2(
    Math.max(0, kpis.ticketMedio - averageDiscountPerCouponUse)
  )

  const comparison = ticketComparison(
    computedTicketWithCoupon,
    computedTicketWithoutCoupon
  )

  return {
    pctPedidosComCupom,
    receitaComCupom,
    ticketComCupom: round2(comparison.withCoupon),
    ticketSemCupom: round2(comparison.withoutCoupon),
    totalDescontosConcedidos,
    isDiscountHigh: discountPct > 12,
    cupomMaisUsado: bestCoupon?.title ?? bestCoupon?.code ?? "Nenhum cupom utilizado",
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
  const pctTotal =
    kpis.totalPedidos > 0 ? round1((totalCancelados / kpis.totalPedidos) * 100) : 0

  const prevCancelados = Math.round(kpis.totalPedidosPrev * 0.042)
  const pctPrev =
    kpis.totalPedidosPrev > 0
      ? round1((prevCancelados / kpis.totalPedidosPrev) * 100)
      : 0

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

export type ComboType =
  | "frequently_bought"
  | "strong_weak"
  | "weak_hour"
  | "loyal_exclusive"

export interface ComboSuggestion {
  id: string
  type: ComboType
  typeBadge: string
  mainProduct: { id: string; name: string; price: number }
  complementProduct: { id: string; name: string; price: number }
  reason: string
  recurrence: number
  suggestedDiscount: number
  estimatedTicketIncrease: number
  estimatedMonthlyRevenue: number
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

  if (products.length === 0) return []

  const mult = getComboMultiplier(period)
  const periodSeed = getStablePeriodSeed(period)

  const topSellers = products.filter((p) => p.quantity > 50 * mult).slice(0, 3)
  const lowSales = products.filter((p) => p.quantity < 20 * mult && p.quantity > 0).slice(0, 3)
  const weakHour = hourly.buckets.find((b) => b.isWeakest)

  const vipGroup = clientTypes.groups[0]
  const newGroup = clientTypes.groups[2]
  const vipTicketDiff =
    (newGroup?.ticketMedio ?? 0) > 0
      ? Math.round((((vipGroup?.ticketMedio ?? 0) - (newGroup?.ticketMedio ?? 0)) / (newGroup?.ticketMedio ?? 1)) * 100)
      : 22

  const suggestions: ComboSuggestion[] = []

  if (topSellers.length >= 1) {
    const main = topSellers[0]
    const complement =
      products.find((p) => p.categoryName === "Bebidas" && p.quantity > 30 * mult) ||
      products.find((p) => p.categoryName === "Bebidas")

    if (complement) {
      const recurrence = 63 + Math.round((periodSeed % 7) * 2)

      suggestions.push({
        id: "combo-1",
        type: "frequently_bought",
        typeBadge: "Frequentemente Comprados Juntos",
        mainProduct: { id: main.id, name: main.name, price: main.ticketMedio },
        complementProduct: {
          id: complement.id,
          name: complement.name,
          price: complement.ticketMedio,
        },
        reason: `${recurrence}% dos clientes que compram ${main.name} tambem pedem ${complement.name}. Criar combo com desconto incentiva o upsell natural.`,
        recurrence,
        suggestedDiscount: 8,
        estimatedTicketIncrease: 12,
        estimatedMonthlyRevenue: Math.round(2400 * mult),
      })
    }
  }

  if (topSellers.length >= 1 && lowSales.length >= 1) {
    const strong =
      topSellers.find((p) => p.categoryName === "Acompanhamentos") || topSellers[0]
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

  if (weakHour) {
    const main = topSellers[0] || products[0]
    const dessert =
      products.find((p) => p.categoryName === "Sobremesas" && p.quantity > 10 * mult) ||
      products.find((p) => p.categoryName === "Sobremesas")

    if (main && dessert) {
      const avgRev = average(hourly.buckets.map((b) => b.revenue))
      const weakPct = avgRev > 0 ? Math.round(((avgRev - weakHour.revenue) / avgRev) * 100) : 40

      const weakHourNum = Number.parseInt(weakHour.hour.replace("h", ""), 10)
      const endHour = Number.isFinite(weakHourNum) ? `${weakHourNum + 2}h` : "—"

      suggestions.push({
        id: "combo-3",
        type: "weak_hour",
        typeBadge: "Combo para Horario Fraco",
        mainProduct: { id: main.id, name: main.name, price: main.ticketMedio },
        complementProduct: { id: dessert.id, name: dessert.name, price: dessert.ticketMedio },
        reason: `Entre ${weakHour.hour} e ${endHour} o volume e ${weakPct}% menor que a media. Combo promocional neste horario pode recuperar vendas perdidas.`,
        recurrence: 0,
        suggestedDiscount: 15,
        estimatedTicketIncrease: 6,
        estimatedMonthlyRevenue: Math.round(1200 * mult),
        hourRange: `${weakHour.hour} - ${endHour}`,
      })
    }
  }

  if (topSellers.length >= 1) {
    const main = topSellers[0]
    const side =
      products.find((p) => p.categoryName === "Acompanhamentos" && p.quantity > 20 * mult) ||
      products.find((p) => p.categoryName === "Acompanhamentos")

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
  const totalEstimated = sumBy(suggestions, (c) => c.estimatedMonthlyRevenue)
  const avgTicketIncrease =
    suggestions.length > 0
      ? safeDivide(sumBy(suggestions, (c) => c.estimatedTicketIncrease), suggestions.length)
      : 0

  return {
    currentTicket: round2(kpis.ticketMedio),
    potentialTicket: round2(kpis.ticketMedio * (1 + avgTicketIncrease / 100)),
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
    insights.push(
      `Seu produto "${topProduct.name}" representa ${topProduct.pctFaturamento}% do faturamento.`
    )
  } else {
    insights.push("Ainda nao ha produtos com dados suficientes para analise.")
  }

  if (hourly.insight) {
    insights.push(hourly.insight)
  }

  if (clientTypes.insight) {
    insights.push(clientTypes.insight)
  }

  if (cancellations.increased) {
    insights.push(
      `Cancelamentos aumentaram de ${cancellations.pctPrev}% para ${cancellations.pctTotal}% neste periodo.`
    )
  } else {
    insights.push(
      `Cancelamentos reduziram de ${cancellations.pctPrev}% para ${cancellations.pctTotal}% neste periodo.`
    )
  }

  return insights
}