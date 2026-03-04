// Staff Management Data Layer
// Prepared for Supabase integration: restaurant_id, staff_id, orders, delivery_logs, staff_payments

export type StaffType = "funcionario" | "entregador"
export type PaymentModel = "mensal" | "diaria" | "turno" | "entrega" | "percentual"
export type PaymentStatus = "pendente" | "pago"

export interface StaffMember {
  id: string
  restaurantId: string
  name: string
  role: string
  type: StaffType
  paymentModel: PaymentModel
  baseValue: number // Base salary or per-delivery value
  pixKey?: string
  phone: string
  active: boolean
  createdAt: string
  // Computed (from delivery_logs / staff_payments)
  todayEarnings: number
  monthEarnings: number
  deliveriesToday?: number // Only for delivery staff
  deliveriesMonth?: number
  avgDaily: number
  status: PaymentStatus
}

export interface PaymentRecord {
  id: string
  staffId: string
  amount: number
  date: string
  period: string // e.g. "01/01/2026 - 15/01/2026"
  method: "pix" | "dinheiro" | "transferencia"
  status: "realizado" | "agendado"
}

export interface DeliveryLog {
  id: string
  staffId: string
  orderId: string
  customerName: string
  address: string
  value: number
  date: string
  time: string
}

// Manual payment / financial adjustments
export type ManualPaymentType = "bonus" | "hora_extra" | "vale" | "desconto" | "ajuste"
export type ManualPaymentMethod = "pix" | "dinheiro" | "transferencia" | "nao_pago"
export type ManualPaymentStatus = "pendente" | "pago"

export interface ManualPayment {
  id: string
  staffId: string
  restaurantId: string
  type: ManualPaymentType
  amount: number
  description: string
  date: string
  paymentMethod: ManualPaymentMethod
  status: ManualPaymentStatus
}

export function formatManualPaymentType(type: ManualPaymentType): string {
  const labels: Record<ManualPaymentType, string> = {
    bonus: "Bonus",
    hora_extra: "Hora Extra",
    vale: "Vale/Adiantamento",
    desconto: "Desconto",
    ajuste: "Ajuste Manual",
  }
  return labels[type]
}

export function formatManualPaymentMethod(method: ManualPaymentMethod): string {
  const labels: Record<ManualPaymentMethod, string> = {
    pix: "Pix",
    dinheiro: "Dinheiro",
    transferencia: "Transferencia",
    nao_pago: "Nao pago ainda",
  }
  return labels[method]
}

export function isNegativePaymentType(type: ManualPaymentType): boolean {
  return type === "desconto" || type === "vale"
}

// Mock data for UI development
const mockStaff: StaffMember[] = [
  {
    id: "s1",
    restaurantId: "r1",
    name: "Carlos Silva",
    role: "Cozinheiro Chefe",
    type: "funcionario",
    paymentModel: "mensal",
    baseValue: 3500,
    pixKey: "carlos.silva@email.com",
    phone: "(11) 99999-1111",
    active: true,
    createdAt: "2024-03-15",
    todayEarnings: 116.67,
    monthEarnings: 2916.67,
    avgDaily: 116.67,
    status: "pago",
  },
  {
    id: "s2",
    restaurantId: "r1",
    name: "Ana Santos",
    role: "Auxiliar de Cozinha",
    type: "funcionario",
    paymentModel: "mensal",
    baseValue: 2200,
    pixKey: "ana.santos@email.com",
    phone: "(11) 99999-2222",
    active: true,
    createdAt: "2024-06-01",
    todayEarnings: 73.33,
    monthEarnings: 1833.33,
    avgDaily: 73.33,
    status: "pendente",
  },
  {
    id: "s3",
    restaurantId: "r1",
    name: "Pedro Oliveira",
    role: "Atendente",
    type: "funcionario",
    paymentModel: "diaria",
    baseValue: 120,
    pixKey: "pedro.pix@banco.com",
    phone: "(11) 99999-3333",
    active: true,
    createdAt: "2024-09-10",
    todayEarnings: 120,
    monthEarnings: 2640,
    avgDaily: 120,
    status: "pendente",
  },
  {
    id: "s4",
    restaurantId: "r1",
    name: "Lucas Ferreira",
    role: "Entregador",
    type: "entregador",
    paymentModel: "entrega",
    baseValue: 8,
    pixKey: "lucas.ferreira@pix.com",
    phone: "(11) 99999-4444",
    active: true,
    createdAt: "2024-07-20",
    todayEarnings: 96,
    monthEarnings: 1920,
    deliveriesToday: 12,
    deliveriesMonth: 240,
    avgDaily: 80,
    status: "pendente",
  },
  {
    id: "s5",
    restaurantId: "r1",
    name: "Rafael Costa",
    role: "Entregador",
    type: "entregador",
    paymentModel: "entrega",
    baseValue: 8,
    pixKey: "rafael.costa@pix.com",
    phone: "(11) 99999-5555",
    active: true,
    createdAt: "2024-08-05",
    todayEarnings: 64,
    monthEarnings: 1600,
    deliveriesToday: 8,
    deliveriesMonth: 200,
    avgDaily: 66.67,
    status: "pago",
  },
  {
    id: "s6",
    restaurantId: "r1",
    name: "Mariana Lima",
    role: "Entregadora",
    type: "entregador",
    paymentModel: "percentual",
    baseValue: 10, // 10% per order
    pixKey: "mariana.lima@pix.com",
    phone: "(11) 99999-6666",
    active: true,
    createdAt: "2024-10-01",
    todayEarnings: 85,
    monthEarnings: 1700,
    deliveriesToday: 10,
    deliveriesMonth: 200,
    avgDaily: 70.83,
    status: "pendente",
  },
  {
    id: "s7",
    restaurantId: "r1",
    name: "Bruno Almeida",
    role: "Garcom",
    type: "funcionario",
    paymentModel: "turno",
    baseValue: 80,
    pixKey: "bruno.almeida@pix.com",
    phone: "(11) 99999-7777",
    active: true,
    createdAt: "2024-11-15",
    todayEarnings: 80,
    monthEarnings: 1760,
    avgDaily: 80,
    status: "pago",
  },
  {
    id: "s8",
    restaurantId: "r1",
    name: "Juliana Rocha",
    role: "Caixa",
    type: "funcionario",
    paymentModel: "mensal",
    baseValue: 2800,
    phone: "(11) 99999-8888",
    active: false,
    createdAt: "2024-01-10",
    todayEarnings: 0,
    monthEarnings: 0,
    avgDaily: 93.33,
    status: "pago",
  },
]

const mockPayments: PaymentRecord[] = [
  {
    id: "p1",
    staffId: "s1",
    amount: 3500,
    date: "2026-01-31",
    period: "01/01/2026 - 31/01/2026",
    method: "pix",
    status: "realizado",
  },
  {
    id: "p2",
    staffId: "s1",
    amount: 3500,
    date: "2025-12-31",
    period: "01/12/2025 - 31/12/2025",
    method: "pix",
    status: "realizado",
  },
  {
    id: "p3",
    staffId: "s4",
    amount: 1840,
    date: "2026-01-31",
    period: "01/01/2026 - 31/01/2026",
    method: "pix",
    status: "realizado",
  },
  {
    id: "p4",
    staffId: "s4",
    amount: 1920,
    date: "2025-12-31",
    period: "01/12/2025 - 31/12/2025",
    method: "transferencia",
    status: "realizado",
  },
]

const mockManualPayments: ManualPayment[] = [
  { id: "mp1", staffId: "s1", restaurantId: "r1", type: "bonus", amount: 200, description: "Bonus por meta atingida", date: "2026-02-25", paymentMethod: "pix", status: "pago" },
  { id: "mp2", staffId: "s2", restaurantId: "r1", type: "hora_extra", amount: 80, description: "4 horas extras sabado", date: "2026-02-22", paymentMethod: "dinheiro", status: "pago" },
  { id: "mp3", staffId: "s3", restaurantId: "r1", type: "vale", amount: 150, description: "Adiantamento solicitado", date: "2026-02-20", paymentMethod: "pix", status: "pago" },
  { id: "mp4", staffId: "s4", restaurantId: "r1", type: "bonus", amount: 100, description: "Bonus entregador do mes", date: "2026-02-26", paymentMethod: "nao_pago", status: "pendente" },
  { id: "mp5", staffId: "s1", restaurantId: "r1", type: "desconto", amount: 50, description: "Desconto falta injustificada", date: "2026-02-18", paymentMethod: "pix", status: "pago" },
]

const mockDeliveries: DeliveryLog[] = [
  { id: "d1", staffId: "s4", orderId: "4820", customerName: "Maria Silva", address: "Rua das Flores, 123", value: 8, date: "2026-02-27", time: "11:30" },
  { id: "d2", staffId: "s4", orderId: "4821", customerName: "Joao Santos", address: "Av. Brasil, 456", value: 8, date: "2026-02-27", time: "12:15" },
  { id: "d3", staffId: "s4", orderId: "4822", customerName: "Ana Costa", address: "Rua Paulista, 789", value: 8, date: "2026-02-27", time: "13:00" },
  { id: "d4", staffId: "s4", orderId: "4823", customerName: "Pedro Lima", address: "Av. Faria Lima, 1000", value: 8, date: "2026-02-27", time: "13:45" },
  { id: "d5", staffId: "s4", orderId: "4824", customerName: "Carla Rocha", address: "Rua Augusta, 200", value: 8, date: "2026-02-27", time: "14:30" },
  { id: "d6", staffId: "s4", orderId: "4825", customerName: "Bruno Alves", address: "Rua Oscar Freire, 500", value: 8, date: "2026-02-27", time: "15:15" },
  { id: "d7", staffId: "s5", orderId: "4826", customerName: "Fernanda Dias", address: "Av. Paulista, 1500", value: 8, date: "2026-02-27", time: "11:00" },
  { id: "d8", staffId: "s5", orderId: "4827", customerName: "Ricardo Gomes", address: "Rua Consolacao, 300", value: 8, date: "2026-02-27", time: "12:00" },
  { id: "d9", staffId: "s6", orderId: "4828", customerName: "Patricia Nunes", address: "Av. Reboucas, 800", value: 8.5, date: "2026-02-27", time: "11:45" },
  { id: "d10", staffId: "s6", orderId: "4829", customerName: "Marcos Souza", address: "Rua Haddock Lobo, 100", value: 9, date: "2026-02-27", time: "13:30" },
]

// Data access functions
export function getStaffMembers(): StaffMember[] {
  return mockStaff.filter(s => s.active)
}

export function getActiveDeliveryStaff(): StaffMember[] {
  return mockStaff.filter(s => s.active && s.type === "entregador")
}

export function getAllStaffMembers(): StaffMember[] {
  return mockStaff
}

export function getStaffById(id: string): StaffMember | undefined {
  return mockStaff.find(s => s.id === id)
}

export function getPaymentsByStaffId(staffId: string): PaymentRecord[] {
  return mockPayments.filter(p => p.staffId === staffId)
}

export function getDeliveriesByStaffId(staffId: string): DeliveryLog[] {
  return mockDeliveries.filter(d => d.staffId === staffId)
}

export function getTodayDeliveriesByStaffId(staffId: string): DeliveryLog[] {
  const today = "2026-02-27"
  return mockDeliveries.filter(d => d.staffId === staffId && d.date === today)
}

export function getManualPaymentsByStaffId(staffId: string): ManualPayment[] {
  return mockManualPayments.filter(p => p.staffId === staffId)
}

export function getAllManualPayments(): ManualPayment[] {
  return mockManualPayments
}

export function calculateStaffFinancials(staffId: string, monthEarnings: number) {
  const manualPayments = getManualPaymentsByStaffId(staffId)
  
  let totalPositive = 0
  let totalNegative = 0
  
  for (const payment of manualPayments) {
    if (isNegativePaymentType(payment.type)) {
      totalNegative += payment.amount
    } else {
      totalPositive += payment.amount
    }
  }
  
  const grossTotal = monthEarnings + totalPositive
  const adjustments = totalPositive - totalNegative
  const netTotal = grossTotal - totalNegative
  
  return {
    grossTotal,
    adjustments,
    netTotal,
    totalPositive,
    totalNegative,
  }
}

// Summary calculations
export function getStaffSummary() {
  const staff = getStaffMembers()
  const funcionarios = staff.filter(s => s.type === "funcionario")
  const entregadores = staff.filter(s => s.type === "entregador")

  const totalTodayStaff = staff.reduce((sum, s) => sum + s.todayEarnings, 0)
  const totalTodayFuncionarios = funcionarios.reduce((sum, s) => sum + s.todayEarnings, 0)
  const totalTodayEntregadores = entregadores.reduce((sum, s) => sum + s.todayEarnings, 0)

  // Mock revenue for percentage calculation
  const todayRevenue = 4500
  const percentOfRevenue = todayRevenue > 0 ? (totalTodayStaff / todayRevenue) * 100 : 0

  // Mock yesterday's values for variation
  const yesterdayTotal = 580
  const yesterdayFuncionarios = 350
  const yesterdayEntregadores = 230

  return {
    totalToday: totalTodayStaff,
    totalTodayVariation: totalTodayStaff > 0 ? ((totalTodayStaff - yesterdayTotal) / yesterdayTotal) * 100 : 0,
    funcionariosToday: totalTodayFuncionarios,
    funcionariosVariation: totalTodayFuncionarios > 0 ? ((totalTodayFuncionarios - yesterdayFuncionarios) / yesterdayFuncionarios) * 100 : 0,
    entregadorestoday: totalTodayEntregadores,
    entregadoresVariation: totalTodayEntregadores > 0 ? ((totalTodayEntregadores - yesterdayEntregadores) / yesterdayEntregadores) * 100 : 0,
    percentOfRevenue,
    percentVariation: 2.1, // Mock
    totalStaff: staff.length,
    totalFuncionarios: funcionarios.length,
    totalEntregadores: entregadores.length,
  }
}

// Format helpers
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function formatPaymentModel(model: PaymentModel): string {
  const labels: Record<PaymentModel, string> = {
    mensal: "Mensal",
    diaria: "Diaria",
    turno: "Por Turno",
    entrega: "Por Entrega",
    percentual: "Percentual",
  }
  return labels[model]
}

export function formatStaffType(type: StaffType): string {
  return type === "funcionario" ? "Funcionario" : "Entregador"
}
