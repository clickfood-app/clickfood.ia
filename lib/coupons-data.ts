// ── Coupon types and mock data ──

export type CouponType = "manual" | "automatico" | "relampago" | "campanha" | "exclusivo"
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

export const exclusiveReasonLabels: Record<ExclusiveReason, string> = {
  fidelidade: "Recompensa fidelidade",
  pedido_cancelado: "Pedido cancelado",
  cliente_vip: "Cliente VIP",
  recuperacao_inativo: "Recuperacao de cliente inativo",
  manual: "Manual",
}

export interface ExclusiveCoupon {
  id: string
  clientId: string
  clientName: string
  code: string
  discountType: DiscountType
  discountValue: number
  minOrder: number
  maxUses: number
  usedCount: number
  reason: ExclusiveReason
  status: CouponStatus
  createdAt: string
  expiresAt: string
  sendChannels: SendChannel[]
  revenueGenerated: number
}

export interface Coupon {
  id: string
  name: string
  code: string | null
  type: CouponType
  discountType: DiscountType
  discountValue: number
  minOrder: number
  maxUses: number
  maxPerClient: number
  usedCount: number
  status: CouponStatus
  createdAt: string
  expiresAt: string
  // Auto-specific
  autoTrigger?: AutoTrigger
  autoParam?: number
  // Relampago-specific
  durationHours?: number
  notifyClients?: boolean
  // Campanha-specific
  campaignName?: string
  shareLink?: string
  origin?: string
  // Revenue tracking
  revenueGenerated: number
}

export interface CouponUsageDay {
  date: string
  uses: number
  revenue: number
}

export const autoTriggerLabels: Record<AutoTrigger, string> = {
  primeiro_pedido: "Primeiro pedido",
  inativo_dias: "Cliente inativo (X dias)",
  pedido_acima: "Pedido acima de valor",
  aniversario: "Aniversario do cliente",
  vip: "Cliente VIP",
}

export const couponTypeLabels: Record<CouponType, string> = {
  manual: "Manual",
  automatico: "Automatico",
  relampago: "Relampago",
  campanha: "Campanha",
  exclusivo: "Exclusivo",
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export const initialCoupons: Coupon[] = [
  {
    id: "cup-001",
    name: "Desconto de Boas-Vindas",
    code: "BEMVINDO10",
    type: "manual",
    discountType: "percentual",
    discountValue: 10,
    minOrder: 30,
    maxUses: 500,
    maxPerClient: 1,
    usedCount: 187,
    status: "ativo",
    createdAt: "2026-01-15",
    expiresAt: "2026-06-30",
    revenueGenerated: 9350,
  },
  {
    id: "cup-002",
    name: "Volta pra gente",
    code: null,
    type: "automatico",
    discountType: "fixo",
    discountValue: 15,
    minOrder: 50,
    maxUses: 0,
    maxPerClient: 1,
    usedCount: 43,
    status: "ativo",
    createdAt: "2026-02-01",
    expiresAt: "2026-12-31",
    autoTrigger: "inativo_dias",
    autoParam: 30,
    revenueGenerated: 3225,
  },
  {
    id: "cup-003",
    name: "Flash Friday",
    code: "FLASH50",
    type: "relampago",
    discountType: "percentual",
    discountValue: 25,
    minOrder: 40,
    maxUses: 100,
    maxPerClient: 1,
    usedCount: 98,
    status: "expirado",
    createdAt: "2026-02-14",
    expiresAt: "2026-02-14",
    durationHours: 4,
    notifyClients: true,
    revenueGenerated: 7840,
  },
  {
    id: "cup-004",
    name: "Campanha Instagram",
    code: "INSTA20",
    type: "campanha",
    discountType: "percentual",
    discountValue: 20,
    minOrder: 25,
    maxUses: 300,
    maxPerClient: 2,
    usedCount: 156,
    status: "ativo",
    createdAt: "2026-01-20",
    expiresAt: "2026-04-30",
    campaignName: "Promo Verao 2026",
    shareLink: "https://clickfood.com.br/c/INSTA20",
    origin: "Instagram",
    revenueGenerated: 12480,
  },
  {
    id: "cup-005",
    name: "Primeiro Pedido",
    code: null,
    type: "automatico",
    discountType: "percentual",
    discountValue: 15,
    minOrder: 0,
    maxUses: 0,
    maxPerClient: 1,
    usedCount: 312,
    status: "ativo",
    createdAt: "2026-01-01",
    expiresAt: "2026-12-31",
    autoTrigger: "primeiro_pedido",
    revenueGenerated: 18720,
  },
  {
    id: "cup-006",
    name: "WhatsApp Exclusivo",
    code: "ZAPFOOD",
    type: "campanha",
    discountType: "fixo",
    discountValue: 10,
    minOrder: 35,
    maxUses: 200,
    maxPerClient: 3,
    usedCount: 89,
    status: "pausado",
    createdAt: "2026-02-05",
    expiresAt: "2026-05-31",
    campaignName: "Engajamento WhatsApp",
    shareLink: "https://clickfood.com.br/c/ZAPFOOD",
    origin: "WhatsApp",
    revenueGenerated: 5340,
  },
  {
    id: "cup-007",
    name: "Cliente VIP",
    code: null,
    type: "automatico",
    discountType: "percentual",
    discountValue: 12,
    minOrder: 0,
    maxUses: 0,
    maxPerClient: 0,
    usedCount: 67,
    status: "ativo",
    createdAt: "2026-01-10",
    expiresAt: "2026-12-31",
    autoTrigger: "vip",
    autoParam: 10,
    revenueGenerated: 6030,
  },
]

export const couponUsageHistory: CouponUsageDay[] = [
  { date: "17/02", uses: 12, revenue: 480 },
  { date: "18/02", uses: 18, revenue: 720 },
  { date: "19/02", uses: 8, revenue: 320 },
  { date: "20/02", uses: 22, revenue: 880 },
  { date: "21/02", uses: 31, revenue: 1240 },
  { date: "22/02", uses: 27, revenue: 1080 },
  { date: "23/02", uses: 15, revenue: 600 },
  { date: "24/02", uses: 20, revenue: 800 },
  { date: "25/02", uses: 35, revenue: 1400 },
  { date: "26/02", uses: 29, revenue: 1160 },
  { date: "27/02", uses: 19, revenue: 760 },
  { date: "28/02", uses: 24, revenue: 960 },
  { date: "01/03", uses: 33, revenue: 1320 },
  { date: "02/03", uses: 28, revenue: 1120 },
]

// Average ticket with coupon vs without
export const ticketComparison = {
  withCoupon: 58.5,
  withoutCoupon: 42.3,
  percentDifference: 38.3,
}

// ── Exclusive (personalized) coupons ──

export const initialExclusiveCoupons: ExclusiveCoupon[] = [
  {
    id: "exc-001",
    clientId: "c1",
    clientName: "Lucas Ferreira",
    code: "LUCAS10",
    discountType: "percentual",
    discountValue: 10,
    minOrder: 30,
    maxUses: 1,
    usedCount: 1,
    reason: "fidelidade",
    status: "expirado",
    createdAt: "2026-01-20",
    expiresAt: "2026-02-20",
    sendChannels: ["whatsapp", "notificacao"],
    revenueGenerated: 72.9,
  },
  {
    id: "exc-002",
    clientId: "c5",
    clientName: "Roberto Almeida",
    code: "VOLTAROB15",
    discountType: "fixo",
    discountValue: 15,
    minOrder: 40,
    maxUses: 1,
    usedCount: 0,
    reason: "recuperacao_inativo",
    status: "ativo",
    createdAt: "2026-02-10",
    expiresAt: "2026-03-10",
    sendChannels: ["whatsapp", "email"],
    revenueGenerated: 0,
  },
  {
    id: "exc-003",
    clientId: "c4",
    clientName: "Ana Beatriz Lima",
    code: "ANAVIP20",
    discountType: "percentual",
    discountValue: 20,
    minOrder: 0,
    maxUses: 2,
    usedCount: 1,
    reason: "cliente_vip",
    status: "ativo",
    createdAt: "2026-02-01",
    expiresAt: "2026-04-01",
    sendChannels: ["notificacao"],
    revenueGenerated: 189.0,
  },
  {
    id: "exc-004",
    clientId: "c7",
    clientName: "Pedro Henrique Costa",
    code: "PEDRO10",
    discountType: "fixo",
    discountValue: 10,
    minOrder: 25,
    maxUses: 1,
    usedCount: 0,
    reason: "pedido_cancelado",
    status: "ativo",
    createdAt: "2026-02-15",
    expiresAt: "2026-03-15",
    sendChannels: ["whatsapp"],
    revenueGenerated: 0,
  },
  {
    id: "exc-005",
    clientId: "c8",
    clientName: "Fernanda Ribeiro",
    code: "FERVIP15",
    discountType: "percentual",
    discountValue: 15,
    minOrder: 0,
    maxUses: 1,
    usedCount: 1,
    reason: "cliente_vip",
    status: "expirado",
    createdAt: "2026-01-15",
    expiresAt: "2026-02-15",
    sendChannels: ["email", "notificacao"],
    revenueGenerated: 132.8,
  },
]

export interface ExclusiveSuggestion {
  id: string
  clientId: string
  clientName: string
  message: string
  reason: ExclusiveReason
  suggestedDiscount: number
  suggestedDiscountType: DiscountType
}

export const smartSuggestions: ExclusiveSuggestion[] = [
  {
    id: "sug-001",
    clientId: "c5",
    clientName: "Roberto Almeida",
    message: "Roberto esta ha 8 meses sem comprar. Deseja enviar um cupom de R$15 para recupera-lo?",
    reason: "recuperacao_inativo",
    suggestedDiscount: 15,
    suggestedDiscountType: "fixo",
  },
  {
    id: "sug-002",
    clientId: "c12",
    clientName: "Camila Rodrigues",
    message: "Camila fez 6 pedidos nos ultimos 3 meses. Enviar recompensa VIP de 15%?",
    reason: "cliente_vip",
    suggestedDiscount: 15,
    suggestedDiscountType: "percentual",
  },
  {
    id: "sug-003",
    clientId: "c7",
    clientName: "Pedro Henrique Costa",
    message: "Pedro teve um pedido cancelado recentemente. Enviar cupom de compensacao de R$10?",
    reason: "pedido_cancelado",
    suggestedDiscount: 10,
    suggestedDiscountType: "fixo",
  },
  {
    id: "sug-004",
    clientId: "c1",
    clientName: "Lucas Ferreira",
    message: "Lucas e cliente fiel com 8 pedidos. Enviar recompensa de fidelidade de 10%?",
    reason: "fidelidade",
    suggestedDiscount: 10,
    suggestedDiscountType: "percentual",
  },
]
