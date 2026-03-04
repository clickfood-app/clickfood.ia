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
  name: "Restaurante AdminPro",
  cnpj: "12.345.678/0001-99",
  phone: "(11) 3456-7890",
  whatsapp: "(11) 98765-4321",
  email: "contato@adminpro.com.br",
  address: "Rua das Flores, 123 - Centro",
  city: "Sao Paulo",
  state: "SP",
  cep: "01234-567",
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
  { id: "pm-2", name: "Pix", enabled: true, fee: 0, notes: "Chave: CNPJ" },
  { id: "pm-3", name: "Cartao de Credito", enabled: true, fee: 3.5, notes: "Ate 12x" },
  { id: "pm-4", name: "Cartao de Debito", enabled: true, fee: 1.5, notes: "" },
  { id: "pm-5", name: "Vale Refeicao", enabled: false, fee: 5, notes: "Alelo, Sodexo, VR" },
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
  fixedFee: 8.5,
  minOrderValue: 25,
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
  name: "Plano Unico",
  status: "ativo",
  renewalDate: "2026-03-24",
  billingCycle: "mensal",
  price: 149.9,
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
