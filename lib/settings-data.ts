// ── Settings Data Layer ──
// Types and default data for restaurant settings, prepared for Supabase integration.

// ── 1. Store Data ──

export interface StoreData {
  logoUrl: string
  name: string
  cnpj: string
  phone: string
  whatsapp: string
  email: string
  address: string
  city: string
  state: string
  cep: string
}

export const defaultStoreData: StoreData = {
  logoUrl: "",
  name: "Meu Restaurante",
  cnpj: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  city: "",
  state: "",
  cep: "",
}

// ── 2. Operation Hours ──

export interface DaySchedule {
  day: string
  dayShort: string
  active: boolean
}

export interface OperationData {
  openTime: string
  closeTime: string
  closedToday: boolean
  days: DaySchedule[]
  avgPrepTime: number // minutes
  closedMessage: string
}

export const defaultOperationData: OperationData = {
  openTime: "11:00",
  closeTime: "23:00",
  closedToday: false,
  days: [
    { day: "Segunda-feira", dayShort: "Seg", active: true },
    { day: "Terca-feira", dayShort: "Ter", active: true },
    { day: "Quarta-feira", dayShort: "Qua", active: true },
    { day: "Quinta-feira", dayShort: "Qui", active: true },
    { day: "Sexta-feira", dayShort: "Sex", active: true },
    { day: "Sabado", dayShort: "Sab", active: true },
    { day: "Domingo", dayShort: "Dom", active: false },
  ],
  avgPrepTime: 35,
  closedMessage: "Estamos fechados no momento. Voltamos em breve!",
}

// ── 3. Payment Methods ──

export interface PaymentMethod {
  id: string
  name: string
  enabled: boolean
  fee: number // percentage
  notes: string
}

export const defaultPaymentMethods: PaymentMethod[] = [
  { id: "pm-1", name: "Dinheiro", enabled: true, fee: 0, notes: "" },
  { id: "pm-2", name: "Pix", enabled: true, fee: 0, notes: "" },
  { id: "pm-3", name: "Cartao de Credito", enabled: true, fee: 0, notes: "" },
  { id: "pm-4", name: "Cartao de Debito", enabled: true, fee: 0, notes: "" },
  { id: "pm-5", name: "Vale Refeicao", enabled: false, fee: 0, notes: "" },
]

// ── 4. Delivery ──

export interface DeliveryData {
  fixedFee: number
  minOrderValue: number
  avgDeliveryTime: number // minutes
  deliveryRadius: number // km
  pickupEnabled: boolean
}

export const defaultDeliveryData: DeliveryData = {
  fixedFee: 0,
  minOrderValue: 0,
  avgDeliveryTime: 45,
  deliveryRadius: 10,
  pickupEnabled: true,
}

// ── 5. Plan & Subscription ──

export type PlanStatus = "ativo" | "inativo"
export type BillingCycle = "mensal" | "trimestral" | "anual"

export interface PlanData {
  name: string
  status: PlanStatus
  renewalDate: string
  billingCycle: BillingCycle
  price: number
}

export const defaultPlanData: PlanData = {
  name: "ClickFood",
  status: "ativo",
  renewalDate: "",
  billingCycle: "mensal",
  price: 0,
}

// ── Helpers ──

export const brazilStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function generatePaymentId(): string {
  return `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}