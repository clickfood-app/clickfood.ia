// lib/coupons-data.ts

export type CouponType =
  | "manual"
  | "automatico"
  | "relampago"
  | "campanha"
  | "exclusivo"

export type CouponStatus = "ativo" | "pausado" | "expirado"

export type DiscountType = "percentual" | "fixo"

export type AutoTrigger =
  | "primeiro_pedido"
  | "inativo_dias"
  | "pedido_acima"
  | "aniversario"
  | "vip"

export type ExclusiveReason =
  | "fidelidade"
  | "pedido_cancelado"
  | "cliente_vip"
  | "recuperacao_inativo"
  | "manual"

export type SendChannel = "whatsapp" | "notificacao" | "email"

export interface Coupon {
  id: string
  code: string
  title: string
  description?: string
  type: CouponType
  status: CouponStatus
  discountType: DiscountType
  discountValue: number
  minOrderValue?: number
  maxDiscountValue?: number
  usageLimit?: number
  usedCount?: number
  validFrom?: string
  validUntil?: string
  createdAt: string
  updatedAt?: string

  autoTrigger?: AutoTrigger
  triggerValue?: number

  audience?: string
  channel?: SendChannel[]
}

export interface ExclusiveCoupon {
  id: string
  code: string
  title: string
  description?: string
  discountType: DiscountType
  discountValue: number
  minOrderValue?: number
  maxDiscountValue?: number
  status: CouponStatus
  reason: ExclusiveReason
  sendChannels: SendChannel[]
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  validUntil?: string
  createdAt: string
  usedAt?: string
}

export interface ExclusiveSuggestion {
  id: string
  clientId: string
  clientName: string
  reason: ExclusiveReason
  suggestedDiscountType: DiscountType
  suggestedDiscount: number
  observation?: string
  daysInactive?: number
  lastOrderAt?: string
}

export interface CouponUsageDay {
  date: string
  uses: number
  orders: number
  revenue: number
  discountGiven: number
  averageTicket: number
}

export interface TicketComparison {
  withoutCoupon: number
  withCoupon: number
  difference: number
  percentage: number
  isPositive: boolean
}

export interface CouponPerformance {
  couponId: string
  code: string
  title: string
  type: CouponType
  uses: number
  revenue: number
  discountGiven: number
  conversionRate: number
  averageTicket: number
}

export const couponTypeLabels: Record<CouponType, string> = {
  manual: "Manual",
  automatico: "Automático",
  relampago: "Relâmpago",
  campanha: "Campanha",
  exclusivo: "Exclusivo",
}

export const couponStatusLabels: Record<CouponStatus, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  expirado: "Expirado",
}

export const discountTypeLabels: Record<DiscountType, string> = {
  percentual: "Percentual",
  fixo: "Valor fixo",
}

export const autoTriggerLabels: Record<AutoTrigger, string> = {
  primeiro_pedido: "Primeiro pedido",
  inativo_dias: "Cliente inativo",
  pedido_acima: "Pedido acima de valor",
  aniversario: "Aniversário",
  vip: "Cliente VIP",
}

export const exclusiveReasonLabels: Record<ExclusiveReason, string> = {
  fidelidade: "Recompensa fidelidade",
  pedido_cancelado: "Pedido cancelado",
  cliente_vip: "Cliente VIP",
  recuperacao_inativo: "Recuperação de cliente inativo",
  manual: "Manual",
}

export const sendChannelLabels: Record<SendChannel, string> = {
  whatsapp: "WhatsApp",
  notificacao: "Notificação",
  email: "E-mail",
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

export function isCouponExpired(validUntil?: string) {
  if (!validUntil) return false
  return new Date(validUntil).getTime() < Date.now()
}

export function getCouponStatus(coupon: Coupon): CouponStatus {
  if (coupon.status === "pausado") return "pausado"
  if (isCouponExpired(coupon.validUntil)) return "expirado"
  return "ativo"
}

export function ticketComparison(
  withCoupon: number,
  withoutCoupon: number
): TicketComparison {
  const difference = withCoupon - withoutCoupon
  const percentage =
    withoutCoupon > 0 ? (difference / withoutCoupon) * 100 : 0

  return {
    withCoupon,
    withoutCoupon,
    difference,
    percentage,
    isPositive: difference >= 0,
  }
}

export const coupons: Coupon[] = []
export const exclusiveCoupons: ExclusiveCoupon[] = []
export const exclusiveSuggestions: ExclusiveSuggestion[] = []
export const couponUsageData: CouponUsageDay[] = []
export const couponPerformanceData: CouponPerformance[] = []

export const initialCoupons = coupons
export const initialExclusiveCoupons = exclusiveCoupons