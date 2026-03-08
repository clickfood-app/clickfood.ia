// ── Dashboard / Painel data layer ──
// Deterministic "today" data for the operational dashboard.
// All helpers are pure functions — ready for Supabase realtime swap.
// IMPORTANT: All calculations use .reduce() from zero, never incremental sums.

import { initialProducts } from "@/lib/products-data"

// ── Types ──

export type OrderStatus = "pendente" | "aceito" | "em_preparo" | "aguardando" | "pronto" | "saiu_para_entrega" | "entregue" | "cancelado"

// Statuses that count towards faturamento (revenue)
// Excludes: pendente (not yet accepted), cancelado (cancelled)
const FATURAMENTO_STATUSES: OrderStatus[] = ["aceito", "em_preparo", "aguardando", "pronto", "saiu_para_entrega", "entregue"]

export interface DashboardOrder {
  id: string
  total: number
  status: OrderStatus
  created_at: string // ISO date string
  prazo_estimado?: number // minutes
  tempo_atual?: number // minutes elapsed
}

// ── Mock Orders (Supabase replacement) ──

const TODAY = "2026-02-27"
const YESTERDAY = "2026-02-26"

const mockOrders: DashboardOrder[] = [
  // Today's orders - includes all valid statuses
  { id: "4888", total: 78.00, status: "aceito", created_at: `${TODAY}T14:35:00` }, // Just accepted - counts toward faturamento
  { id: "4887", total: 89.90, status: "em_preparo", created_at: `${TODAY}T14:30:00` },
  { id: "4886", total: 132.50, status: "pendente", created_at: `${TODAY}T14:25:00` }, // Pending - does NOT count toward faturamento
  { id: "4885", total: 67.00, status: "pronto", created_at: `${TODAY}T14:15:00` },
  { id: "4884", total: 48.50, status: "saiu_para_entrega", created_at: `${TODAY}T14:00:00` }, // Out for delivery - counts
  { id: "4883", total: 220.00, status: "em_preparo", created_at: `${TODAY}T13:50:00` },
  { id: "4882", total: 75.80, status: "entregue", created_at: `${TODAY}T13:30:00` },
  { id: "4881", total: 95.00, status: "pronto", created_at: `${TODAY}T13:20:00` },
  { id: "4880", total: 156.30, status: "entregue", created_at: `${TODAY}T13:00:00` },
  { id: "4879", total: 88.00, status: "aguardando", created_at: `${TODAY}T12:45:00`, prazo_estimado: 25, tempo_atual: 38 },
  { id: "4878", total: 112.00, status: "entregue", created_at: `${TODAY}T12:30:00` },
  { id: "4877", total: 45.50, status: "entregue", created_at: `${TODAY}T12:15:00` },
  { id: "4876", total: 198.00, status: "em_preparo", created_at: `${TODAY}T12:00:00`, prazo_estimado: 30, tempo_atual: 45 },
  { id: "4875", total: 67.00, status: "entregue", created_at: `${TODAY}T11:45:00` },
  { id: "4874", total: 89.00, status: "entregue", created_at: `${TODAY}T11:30:00` },
  { id: "4873", total: 134.00, status: "entregue", created_at: `${TODAY}T11:15:00` },
  { id: "4872", total: 78.50, status: "entregue", created_at: `${TODAY}T11:00:00` },
  { id: "4871", total: 56.00, status: "cancelado", created_at: `${TODAY}T10:45:00` },
  { id: "4870", total: 92.00, status: "entregue", created_at: `${TODAY}T10:30:00` },
  { id: "4869", total: 145.00, status: "entregue", created_at: `${TODAY}T10:15:00` },
  { id: "4868", total: 38.00, status: "cancelado", created_at: `${TODAY}T10:00:00` },
  { id: "4867", total: 167.00, status: "entregue", created_at: `${TODAY}T09:45:00` },
  { id: "4866", total: 89.00, status: "entregue", created_at: `${TODAY}T09:30:00` },
  { id: "4865", total: 120.00, status: "entregue", created_at: `${TODAY}T09:15:00` },
  { id: "4864", total: 78.00, status: "entregue", created_at: `${TODAY}T09:00:00` },
  { id: "4863", total: 45.00, status: "cancelado", created_at: `${TODAY}T08:45:00` },
  // ... more orders for realistic counts
  ...Array.from({ length: 62 }, (_, i) => ({
    id: `${4800 - i}`,
    total: 45 + Math.floor((i * 7 + 13) % 150),
    status: "entregue" as OrderStatus,
    created_at: `${TODAY}T${String(8 + Math.floor(i / 10)).padStart(2, "0")}:${String((i * 6) % 60).padStart(2, "0")}:00`,
  })),
  // Yesterday's orders (for comparison)
  ...Array.from({ length: 78 }, (_, i) => ({
    id: `Y${4700 - i}`,
    total: 40 + Math.floor((i * 11 + 7) % 140),
    status: "entregue" as OrderStatus,
    created_at: `${YESTERDAY}T${String(9 + Math.floor(i / 12)).padStart(2, "0")}:${String((i * 5) % 60).padStart(2, "0")}:00`,
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `YC${i}`,
    total: 30 + i * 10,
    status: "cancelado" as OrderStatus,
    created_at: `${YESTERDAY}T${String(10 + i * 2).padStart(2, "0")}:00:00`,
  })),
]

// ── Utility: Check if date is today ──

function isToday(dateStr: string): boolean {
  return dateStr.startsWith(TODAY)
}

function isYesterday(dateStr: string): boolean {
  return dateStr.startsWith(YESTERDAY)
}

// ── Utility: Ensure non-negative ──

function ensureNonNegative(value: number): number {
  return Math.max(0, value)
}

// ── Formatters ──

export function formatBRL(value: number): string {
  const safeValue = ensureNonNegative(value)
  const formatted = safeValue.toFixed(2).replace(".", ",")
  return `R$ ${formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`
}

// ── KPIs ──

export interface DashboardKPIs {
  faturamentoHoje: number
  faturamentoOntem: number
  faturamentoVar: number
  pedidosHoje: number
  pedidosOntem: number
  pedidosVar: number
  ticketMedio: number
  ticketOntem: number
  ticketVar: number
  emAndamento: number
  atrasados: number
  cancelamentos: number
  cancelOntem: number
  cancelVar: number
}

/**
 * Calculate all KPIs using .reduce() from zero.
 * - Faturamento: Orders with status in FATURAMENTO_STATUSES (aceito, em_preparo, saiu_para_entrega, entregue)
 *   Does NOT include: pendente (not yet accepted), cancelado (cancelled)
 * - Pedidos Hoje: All orders created today (excluding cancelado)
 * - Em Andamento: Orders with status "em_preparo" or "aguardando"
 * - Atrasados: Orders where tempo_atual > prazo_estimado and not "entregue"/"cancelado"
 * 
 * IMPORTANT: 
 * - Values are always SUMMED using .reduce(), never subtracted
 * - All values are converted to Number() before summing
 * - ensureNonNegative() guarantees no negative values
 */
export function getDashboardKPIs(): DashboardKPIs {
  const ordersToday = mockOrders.filter((o) => isToday(o.created_at))
  const ordersYesterday = mockOrders.filter((o) => isYesterday(o.created_at))

  // Faturamento: Sum orders with valid statuses (aceito, em_preparo, saiu_para_entrega, entregue)
  // Excludes: pendente (not accepted yet), cancelado (cancelled - should not impact revenue)
  const faturamentoHoje = ensureNonNegative(
    ordersToday
      .filter((o) => FATURAMENTO_STATUSES.includes(o.status))
      .reduce((acc, o) => acc + Number(o.total || 0), 0)
  )

  const faturamentoOntem = ensureNonNegative(
    ordersYesterday
      .filter((o) => FATURAMENTO_STATUSES.includes(o.status))
      .reduce((acc, o) => acc + Number(o.total || 0), 0)
  )

  // Pedidos Hoje: Count orders that are not cancelled (valid orders)
  // When an order is "aceito", it increases this count
  const pedidosHoje = ordersToday.filter((o) => o.status !== "cancelado").length

  // Pedidos Ontem: Count valid orders from yesterday
  const pedidosOntem = ordersYesterday.filter((o) => o.status !== "cancelado").length

  // Ticket Medio: Faturamento / Valid orders (avoid division by zero)
  // Uses same filter as faturamento for consistency
  const validOrdersHoje = ordersToday.filter((o) => FATURAMENTO_STATUSES.includes(o.status)).length
  const validOrdersOntem = ordersYesterday.filter((o) => FATURAMENTO_STATUSES.includes(o.status)).length
  const ticketMedio = validOrdersHoje > 0 ? faturamentoHoje / validOrdersHoje : 0
  const ticketOntem = validOrdersOntem > 0 ? faturamentoOntem / validOrdersOntem : 0

  // Em Andamento: "em_preparo" or "aguardando"
  const emAndamento = ordersToday.filter(
    (o) => o.status === "em_preparo" || o.status === "aguardando"
  ).length

  // Atrasados: tempo_atual > prazo_estimado AND not "entregue"/"cancelado"
  const atrasados = ordersToday.filter((o) => {
    if (o.status === "entregue" || o.status === "cancelado") return false
    if (o.prazo_estimado && o.tempo_atual) {
      return o.tempo_atual > o.prazo_estimado
    }
    return false
  }).length

  // Cancelamentos
  const cancelamentos = ordersToday.filter((o) => o.status === "cancelado").length
  const cancelOntem = ordersYesterday.filter((o) => o.status === "cancelado").length

  return {
    faturamentoHoje: ensureNonNegative(faturamentoHoje),
    faturamentoOntem: ensureNonNegative(faturamentoOntem),
    faturamentoVar: pctChange(faturamentoHoje, faturamentoOntem),
    pedidosHoje: ensureNonNegative(pedidosHoje),
    pedidosOntem: ensureNonNegative(pedidosOntem),
    pedidosVar: pctChange(pedidosHoje, pedidosOntem),
    ticketMedio: ensureNonNegative(ticketMedio),
    ticketOntem: ensureNonNegative(ticketOntem),
    ticketVar: pctChange(ticketMedio, ticketOntem),
    emAndamento: ensureNonNegative(emAndamento),
    atrasados: ensureNonNegative(atrasados),
    cancelamentos: ensureNonNegative(cancelamentos),
    cancelOntem: ensureNonNegative(cancelOntem),
    cancelVar: pctChange(cancelamentos, cancelOntem),
  }
}

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 1000) / 10
}

/**
 * Calculate faturamento from a list of orders.
 * Use this when an order is accepted to recalculate the total.
 * 
 * IMPORTANT:
 * - Always sums from zero using .reduce()
 * - Only includes orders with valid statuses (aceito, em_preparo, saiu_para_entrega, entregue)
 * - Excludes: pendente, cancelado
 * - Converts values to Number() to handle string inputs
 * - Never returns negative values
 * 
 * @param orders - Array of orders to calculate faturamento from
 * @returns The total faturamento as a non-negative number
 */
export function calculateFaturamento(orders: DashboardOrder[]): number {
  return ensureNonNegative(
    orders
      .filter((o) => FATURAMENTO_STATUSES.includes(o.status))
      .reduce((acc, o) => acc + Number(o.total || 0), 0)
  )
}

/**
 * Count valid orders (excluding cancelled).
 * Use this when an order is accepted to update "Pedidos Hoje".
 */
export function countValidOrders(orders: DashboardOrder[]): number {
  return ensureNonNegative(
    orders.filter((o) => o.status !== "cancelado").length
  )
}

/**
 * Check if an order status is valid for faturamento calculation.
 */
export function isFaturamentoStatus(status: OrderStatus): boolean {
  return FATURAMENTO_STATUSES.includes(status)
}

// ── Hourly revenue for today's chart ──

export interface HourlyPoint {
  hour: string
  faturamento: number
  pedidos: number
}

export function getHourlyData(): HourlyPoint[] {
  const hours = [
    { h: "11h", f: 280, p: 5 },
    { h: "12h", f: 620, p: 12 },
    { h: "13h", f: 540, p: 10 },
    { h: "14h", f: 310, p: 6 },
    { h: "15h", f: 180, p: 4 },
    { h: "16h", f: 140, p: 3 },
    { h: "17h", f: 220, p: 4 },
    { h: "18h", f: 480, p: 9 },
    { h: "19h", f: 720, p: 14 },
    { h: "20h", f: 650, p: 12 },
    { h: "21h", f: 420, p: 8 },
    { h: "22h", f: 266.5, p: 5 },
  ]
  return hours.map((h) => ({ hour: h.h, faturamento: h.f, pedidos: h.p }))
}

// ── Weekly data (last 7 days) ──

export interface DailyPoint {
  date: string
  faturamento: number
  pedidos: number
}

export function getWeeklyData(): DailyPoint[] {
  return [
    { date: "Seg", faturamento: 3820, pedidos: 68 },
    { date: "Ter", faturamento: 4050, pedidos: 72 },
    { date: "Qua", faturamento: 3650, pedidos: 65 },
    { date: "Qui", faturamento: 4310, pedidos: 78 },
    { date: "Sex", faturamento: 5120, pedidos: 92 },
    { date: "Sab", faturamento: 5680, pedidos: 102 },
    { date: "Dom", faturamento: 4826.5, pedidos: 87 },
  ]
}

// ── Monthly data (last 30 days) ──

export function getMonthlyData(): DailyPoint[] {
  const data: DailyPoint[] = []

  for (let i = 29; i >= 0; i--) {
    const dayOfWeek = (7 - (i % 7)) % 7
    const mult =
      dayOfWeek === 5 ? 1.4 :
      dayOfWeek === 6 ? 1.55 :
      dayOfWeek === 0 ? 1.15 :
      dayOfWeek === 1 ? 0.75 :
      1.0
    const seed = (i * 7 + 13) % 100
    const noise = 0.85 + (seed / 100) * 0.3
    const pedidos = Math.round(38 * mult * noise)
    const ticket = 42 + (seed % 18) - 9
    data.push({
      date: `${30 - i}/02`,
      faturamento: Math.round(pedidos * ticket),
      pedidos,
    })
  }
  return data
}

// ── Recent orders ──

export interface RecentOrder {
  id: string
  customer: string
  total: number
  status: "pendente" | "em_preparo" | "pronto" | "entregue" | "cancelado"
  minutesAgo: number
}

export function getRecentOrders(): RecentOrder[] {
  return [
    { id: "#4887", customer: "Maria Silva", total: 89.90, status: "em_preparo", minutesAgo: 4 },
    { id: "#4886", customer: "Joao Santos", total: 132.50, status: "pendente", minutesAgo: 7 },
    { id: "#4885", customer: "Ana Costa", total: 67.00, status: "pronto", minutesAgo: 12 },
    { id: "#4884", customer: "Pedro Lima", total: 48.50, status: "entregue", minutesAgo: 18 },
    { id: "#4883", customer: "Carla Mendes", total: 220.00, status: "em_preparo", minutesAgo: 9 },
    { id: "#4882", customer: "Marcos Oliveira", total: 75.80, status: "entregue", minutesAgo: 25 },
    { id: "#4881", customer: "Julia Ferreira", total: 95.00, status: "pronto", minutesAgo: 15 },
    { id: "#4880", customer: "Rafael Souza", total: 156.30, status: "entregue", minutesAgo: 32 },
  ]
}

// ── Operational panel ──

export interface OperationalData {
  pendentes: number
  preparando: number
  tempoMedioMin: number
  tempoMedioPrevMin: number
  atrasados: { id: string; customer: string; minutes: number }[]
}

export function getOperationalData(): OperationalData {
  const ordersToday = mockOrders.filter((o) => isToday(o.created_at))

  // Pendentes: status "pendente"
  const pendentes = ordersToday.filter((o) => o.status === "pendente").length

  // Preparando: status "em_preparo" or "aguardando"
  const preparando = ordersToday.filter(
    (o) => o.status === "em_preparo" || o.status === "aguardando"
  ).length

  // Atrasados: tempo_atual > prazo_estimado AND not "entregue"/"cancelado"
  const atrasados = ordersToday
    .filter((o) => {
      if (o.status === "entregue" || o.status === "cancelado") return false
      if (o.prazo_estimado && o.tempo_atual) {
        return o.tempo_atual > o.prazo_estimado
      }
      return false
    })
    .map((o) => ({
      id: `#${o.id}`,
      customer: "Cliente", // Would come from join with customers table
      minutes: o.tempo_atual || 0,
    }))

  return {
    pendentes: ensureNonNegative(pendentes),
    preparando: ensureNonNegative(preparando),
    tempoMedioMin: 22,
    tempoMedioPrevMin: 25,
    atrasados,
  }
}

// ── Top product today ──

export interface TopProductToday {
  name: string
  quantity: number
  revenue: number
}

export function getTopProductToday(): TopProductToday {
  const best = initialProducts
    .filter((p) => p.active && p.salesCount > 0)
    .sort((a, b) => b.salesCount - a.salesCount)[0]
  return {
    name: best?.name ?? "N/A",
    quantity: 24,
    revenue: 24 * (best?.price ?? 0),
  }
}

// ── Peak hour ──

export interface PeakHourData {
  peakHour: string
  peakOrders: number
  hourlyBars: { hour: string; orders: number }[]
}

export function getPeakHour(): PeakHourData {
  const hourly = getHourlyData()
  const peak = hourly.reduce((best, h) => h.pedidos > best.pedidos ? h : best, hourly[0])
  return {
    peakHour: peak.hour,
    peakOrders: peak.pedidos,
    hourlyBars: hourly.map((h) => ({ hour: h.hour, orders: h.pedidos })),
  }
}

// ── Smart messages ──

export interface SmartMessage {
  id: string
  type: "positive" | "negative" | "warning"
  message: string
}

export function getSmartMessages(): SmartMessage[] {
  const kpis = getDashboardKPIs()
  const ops = getOperationalData()
  const messages: SmartMessage[] = []

  if (kpis.faturamentoVar > 0) {
    messages.push({
      id: "m1",
      type: "positive",
      message: `Hoje seu faturamento esta ${kpis.faturamentoVar}% maior que ontem.`,
    })
  } else {
    messages.push({
      id: "m1",
      type: "negative",
      message: `Atencao: faturamento esta ${Math.abs(kpis.faturamentoVar)}% menor que ontem.`,
    })
  }

  if (ops.atrasados.length > 0) {
    messages.push({
      id: "m2",
      type: "warning",
      message: `${ops.atrasados.length} pedido${ops.atrasados.length > 1 ? "s" : ""} aguardando ha mais de 30 minutos.`,
    })
  }

  if (kpis.cancelamentos > kpis.cancelOntem) {
    messages.push({
      id: "m3",
      type: "negative",
      message: `Cancelamentos subiram: ${kpis.cancelamentos} hoje vs ${kpis.cancelOntem} ontem.`,
    })
  } else if (kpis.cancelamentos < kpis.cancelOntem) {
    messages.push({
      id: "m3",
      type: "positive",
      message: `Cancelamentos caindo: ${kpis.cancelamentos} hoje vs ${kpis.cancelOntem} ontem.`,
    })
  }

  return messages
}

// ── Restaurant Status ──

export interface RestaurantStatus {
  isOpen: boolean
  openTime: string // "11:00"
  closeTime: string // "23:00"
  timeOpenMinutes: number // minutes since opening
  ordersInProgress: number
  ordersLate: number
  // If closed, show last session results
  lastSessionRevenue?: number
  lastSessionOrders?: number
}

export function getRestaurantStatus(): RestaurantStatus {
  const ordersToday = mockOrders.filter((o) => isToday(o.created_at))
  
  // Simulate open status (for demo, always open during business hours)
  const isOpen = true
  const openTime = "11:00"
  const closeTime = "23:00"
  const timeOpenMinutes = 3 * 60 + 42 // 3h 42min

  const ordersInProgress = ordersToday.filter(
    (o) => o.status === "pendente" || o.status === "aceito" || o.status === "em_preparo" || o.status === "aguardando" || o.status === "pronto" || o.status === "saiu_para_entrega"
  ).length

  const ordersLate = ordersToday.filter((o) => {
    if (o.status === "entregue" || o.status === "cancelado") return false
    if (o.prazo_estimado && o.tempo_atual) {
      return o.tempo_atual > o.prazo_estimado
    }
    return false
  }).length

  return {
    isOpen,
    openTime,
    closeTime,
    timeOpenMinutes,
    ordersInProgress,
    ordersLate,
  }
}

// ── Day Results (Main KPIs with profit) ──

export interface DayResults {
  faturamentoBruto: number
  faturamentoOntemMesmoHorario: number
  faturamentoVar: number
  totalPedidos: number
  pedidosOntemMesmoHorario: number
  pedidosVar: number
  ticketMedio: number
  ticketOntemMesmoHorario: number
  ticketVar: number
  lucroEstimado: number // faturamento - custos
  lucroOntem: number
  lucroVar: number
}

export function getDayResults(): DayResults {
  const kpis = getDashboardKPIs()
  
  // Estimate costs at 35% of revenue (food cost + operational)
  const custoOperacional = kpis.faturamentoHoje * 0.35
  const custoOntem = kpis.faturamentoOntem * 0.35
  const lucroEstimado = kpis.faturamentoHoje - custoOperacional
  const lucroOntem = kpis.faturamentoOntem - custoOntem

  return {
    faturamentoBruto: kpis.faturamentoHoje,
    faturamentoOntemMesmoHorario: kpis.faturamentoOntem,
    faturamentoVar: kpis.faturamentoVar,
    totalPedidos: kpis.pedidosHoje,
    pedidosOntemMesmoHorario: kpis.pedidosOntem,
    pedidosVar: kpis.pedidosVar,
    ticketMedio: kpis.ticketMedio,
    ticketOntemMesmoHorario: kpis.ticketOntem,
    ticketVar: kpis.ticketVar,
    lucroEstimado: ensureNonNegative(lucroEstimado),
    lucroOntem: ensureNonNegative(lucroOntem),
    lucroVar: pctChange(lucroEstimado, lucroOntem),
  }
}

// ── Operational Counters ──

export interface OperationalCounters {
  pendentes: number
  emPreparo: number
  saiuParaEntrega: number
  atrasados: number
  tempoMedioPreparoHoje: number // minutes
  tempoMedioHistorico: number // minutes
  isTempoAcimaDaMedia: boolean
}

export function getOperationalCounters(): OperationalCounters {
  const ordersToday = mockOrders.filter((o) => isToday(o.created_at))

  const pendentes = ordersToday.filter((o) => o.status === "pendente").length
  const emPreparo = ordersToday.filter((o) => o.status === "em_preparo" || o.status === "aguardando").length
  const saiuParaEntrega = ordersToday.filter((o) => o.status === "saiu_para_entrega").length
  const atrasados = ordersToday.filter((o) => {
    if (o.status === "entregue" || o.status === "cancelado") return false
    if (o.prazo_estimado && o.tempo_atual) {
      return o.tempo_atual > o.prazo_estimado
    }
    return false
  }).length

  const tempoMedioPreparoHoje = 22 // minutes (would be calculated from real data)
  const tempoMedioHistorico = 18 // minutes

  return {
    pendentes,
    emPreparo,
    saiuParaEntrega,
    atrasados,
    tempoMedioPreparoHoje,
    tempoMedioHistorico,
    isTempoAcimaDaMedia: tempoMedioPreparoHoje > tempoMedioHistorico,
  }
}

// ── Delivery Stats ──

export interface DeliveryStats {
  totalEntregasHoje: number
  valorTotalPagoEntregadores: number
  mediaGanhoPorEntrega: number
  entregadorMaisAtivo: {
    nome: string
    entregas: number
  }
}

export function getDeliveryStats(): DeliveryStats {
  const ordersToday = mockOrders.filter((o) => isToday(o.created_at))
  const entregues = ordersToday.filter((o) => o.status === "entregue").length
  
  // Simulate delivery costs (R$ 6-8 per delivery)
  const valorPorEntrega = 7
  const totalPago = entregues * valorPorEntrega

  return {
    totalEntregasHoje: entregues,
    valorTotalPagoEntregadores: totalPago,
    mediaGanhoPorEntrega: valorPorEntrega,
    entregadorMaisAtivo: {
      nome: "Carlos Silva",
      entregas: 18,
    },
  }
}

// ── Comparative Block ──

export interface ComparativeData {
  hojeVsOntem: {
    faturamentoHoje: number
    faturamentoOntem: number
    faturamentoVar: number
    pedidosHoje: number
    pedidosOntem: number
    pedidosVar: number
    ticketHoje: number
    ticketOntem: number
    ticketVar: number
  }
}

export function getComparativeData(): ComparativeData {
  const kpis = getDashboardKPIs()
  
  return {
    hojeVsOntem: {
      faturamentoHoje: kpis.faturamentoHoje,
      faturamentoOntem: kpis.faturamentoOntem,
      faturamentoVar: kpis.faturamentoVar,
      pedidosHoje: kpis.pedidosHoje,
      pedidosOntem: kpis.pedidosOntem,
      pedidosVar: kpis.pedidosVar,
      ticketHoje: kpis.ticketMedio,
      ticketOntem: kpis.ticketOntem,
      ticketVar: kpis.ticketVar,
    },
  }
}

// ── Featured Product ──

export interface FeaturedProduct {
  nome: string
  quantidadeVendida: number
  receitaGerada: number
  percentualDoTotal: number
  sugestao?: string
}

export function getFeaturedProduct(): FeaturedProduct {
  const kpis = getDashboardKPIs()
  const topProduct = getTopProductToday()
  
  const percentual = kpis.faturamentoHoje > 0 
    ? Math.round((topProduct.revenue / kpis.faturamentoHoje) * 100) 
    : 0

  let sugestao: string | undefined
  if (percentual > 25) {
    sugestao = `Este produto representa ${percentual}% das vendas. Considere criar combos ou promocoes relacionadas.`
  }

  return {
    nome: topProduct.name,
    quantidadeVendida: topProduct.quantity,
    receitaGerada: topProduct.revenue,
    percentualDoTotal: percentual,
    sugestao,
  }
}

// ── Smart Alerts ──

export interface SmartAlert {
  id: string
  type: "danger" | "warning" | "info"
  icon: "clock" | "trending-down" | "truck" | "x-circle" | "alert-triangle"
  title: string
  description: string
}

export function getSmartAlerts(): SmartAlert[] {
  const kpis = getDashboardKPIs()
  const ops = getOperationalCounters()
  const delivery = getDeliveryStats()
  const alerts: SmartAlert[] = []

  // Late orders alert
  if (ops.atrasados > 0) {
    alerts.push({
      id: "late-orders",
      type: "danger",
      icon: "clock",
      title: `${ops.atrasados} pedido${ops.atrasados > 1 ? "s" : ""} atrasado${ops.atrasados > 1 ? "s" : ""}`,
      description: "Pedidos aguardando alem do prazo estimado",
    })
  }

  // Ticket medio falling
  if (kpis.ticketVar < -10) {
    alerts.push({
      id: "ticket-down",
      type: "warning",
      icon: "trending-down",
      title: "Ticket medio em queda",
      description: `${Math.abs(kpis.ticketVar)}% menor que ontem no mesmo horario`,
    })
  }

  // High delivery costs
  const deliveryCostRatio = kpis.faturamentoHoje > 0 
    ? (delivery.valorTotalPagoEntregadores / kpis.faturamentoHoje) * 100 
    : 0
  if (deliveryCostRatio > 15) {
    alerts.push({
      id: "delivery-cost",
      type: "warning",
      icon: "truck",
      title: "Custo de entrega elevado",
      description: `${deliveryCostRatio.toFixed(1)}% do faturamento esta indo para entregas`,
    })
  }

  // High cancellations
  if (kpis.cancelamentos >= 5) {
    alerts.push({
      id: "cancellations",
      type: "danger",
      icon: "x-circle",
      title: `${kpis.cancelamentos} cancelamentos hoje`,
      description: "Numero de cancelamentos acima do esperado",
    })
  }

  // Prep time above average
  if (ops.isTempoAcimaDaMedia) {
    alerts.push({
      id: "prep-time",
      type: "info",
      icon: "alert-triangle",
      title: "Tempo de preparo acima da media",
      description: `${ops.tempoMedioPreparoHoje}min vs ${ops.tempoMedioHistorico}min historico`,
    })
  }

  return alerts
}
