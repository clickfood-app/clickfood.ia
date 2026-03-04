// ── Finance types and mock data ──

export type PaymentMethod = "Dinheiro" | "Cartão" | "Pix" | "Boleto"
export type ExpenseStatus = "Pago" | "Pendente"

export interface Supplier {
  id: string
  name: string
  contact: string
  note: string
}

// ── Initial suppliers (derived from SUPPLIERS list) ──
export const initialSuppliers: Supplier[] = [
  { id: "sup-001", name: "Distribuidora ABC", contact: "(11) 98765-4321", note: "Entrega toda terça-feira" },
  { id: "sup-002", name: "Atacadão Alimentos", contact: "(11) 91234-5678", note: "Pedido mínimo R$500" },
  { id: "sup-003", name: "Frigorífico Central", contact: "(21) 99876-5432", note: "Especialidade em cortes nobres" },
  { id: "sup-004", name: "Bebidas Express", contact: "(11) 97654-3210", note: "" },
  { id: "sup-005", name: "Hortifruti Campo Verde", contact: "(11) 93456-7890", note: "Produtos orgânicos disponíveis" },
  { id: "sup-006", name: "Embalagens Top", contact: "", note: "" },
  { id: "sup-007", name: "Limpeza Total", contact: "(11) 92345-6789", note: "" },
  { id: "sup-008", name: "Gás & Cia", contact: "(21) 98765-1234", note: "Entrega em até 2h" },
]

export interface Expense {
  id: string
  supplier: string
  description: string
  amount: number
  paymentMethod: PaymentMethod
  dueDate: string // ISO date string
  status: ExpenseStatus
  discountPercent: number // 0-100
}

export interface DailyFinance {
  date: string // "DD/MM" label for chart
  dateISO: string // ISO string for filtering
  income: number
  expenses: number
}

// ── Suppliers ──
export const SUPPLIERS = [
  "Distribuidora ABC",
  "Atacadão Alimentos",
  "Frigorífico Central",
  "Bebidas Express",
  "Hortifruti Campo Verde",
  "Embalagens Top",
  "Limpeza Total",
  "Gás & Cia",
]

export const PAYMENT_METHODS: PaymentMethod[] = [
  "Dinheiro",
  "Cartão",
  "Pix",
  "Boleto",
]

// ── Mock expenses ──
export const initialExpenses: Expense[] = [
  {
    id: "exp-001",
    supplier: "Distribuidora ABC",
    description: "Farinha de trigo 50kg",
    amount: 285.0,
    paymentMethod: "Boleto",
    dueDate: "2026-02-10",
    status: "Pago",
    discountPercent: 0,
  },
  {
    id: "exp-002",
    supplier: "Frigorífico Central",
    description: "Carne bovina - alcatra 30kg",
    amount: 1450.0,
    paymentMethod: "Pix",
    dueDate: "2026-02-08",
    status: "Pago",
    discountPercent: 5,
  },
  {
    id: "exp-003",
    supplier: "Bebidas Express",
    description: "Refrigerantes variados - 200un",
    amount: 640.0,
    paymentMethod: "Cartão",
    dueDate: "2026-02-12",
    status: "Pendente",
    discountPercent: 0,
  },
  {
    id: "exp-004",
    supplier: "Hortifruti Campo Verde",
    description: "Verduras e legumes - semanal",
    amount: 380.0,
    paymentMethod: "Dinheiro",
    dueDate: "2026-02-07",
    status: "Pago",
    discountPercent: 10,
  },
  {
    id: "exp-005",
    supplier: "Atacadão Alimentos",
    description: "Arroz, feijão e macarrão",
    amount: 920.0,
    paymentMethod: "Boleto",
    dueDate: "2026-02-15",
    status: "Pendente",
    discountPercent: 0,
  },
  {
    id: "exp-006",
    supplier: "Embalagens Top",
    description: "Marmitex descartáveis - 1000un",
    amount: 310.0,
    paymentMethod: "Pix",
    dueDate: "2026-02-09",
    status: "Pago",
    discountPercent: 0,
  },
  {
    id: "exp-007",
    supplier: "Limpeza Total",
    description: "Produtos de limpeza - mensal",
    amount: 195.0,
    paymentMethod: "Dinheiro",
    dueDate: "2026-02-06",
    status: "Pago",
    discountPercent: 0,
  },
  {
    id: "exp-008",
    supplier: "Gás & Cia",
    description: "Botijão de gás P45 x3",
    amount: 870.0,
    paymentMethod: "Pix",
    dueDate: "2026-02-14",
    status: "Pendente",
    discountPercent: 0,
  },
  {
    id: "exp-009",
    supplier: "Distribuidora ABC",
    description: "Óleo de soja 20L x10",
    amount: 520.0,
    paymentMethod: "Boleto",
    dueDate: "2026-02-11",
    status: "Pago",
    discountPercent: 8,
  },
  {
    id: "exp-010",
    supplier: "Frigorífico Central",
    description: "Frango inteiro 50kg",
    amount: 675.0,
    paymentMethod: "Cartão",
    dueDate: "2026-02-13",
    status: "Pendente",
    discountPercent: 0,
  },
]

// ── Mock daily finance data (last 30 days) ──
// Pre-computed static data to avoid hydration mismatch
export const dailyFinanceData: DailyFinance[] = [
  { date: "10/01", dateISO: "2026-01-10", income: 3850, expenses: 1450 },
  { date: "11/01", dateISO: "2026-01-11", income: 5200, expenses: 2100 },
  { date: "12/01", dateISO: "2026-01-12", income: 3200, expenses: 1350 },
  { date: "13/01", dateISO: "2026-01-13", income: 3450, expenses: 1520 },
  { date: "14/01", dateISO: "2026-01-14", income: 3680, expenses: 1380 },
  { date: "15/01", dateISO: "2026-01-15", income: 3920, expenses: 1620 },
  { date: "16/01", dateISO: "2026-01-16", income: 4100, expenses: 1780 },
  { date: "17/01", dateISO: "2026-01-17", income: 5450, expenses: 2250 },
  { date: "18/01", dateISO: "2026-01-18", income: 5680, expenses: 2380 },
  { date: "19/01", dateISO: "2026-01-19", income: 3150, expenses: 1290 },
  { date: "20/01", dateISO: "2026-01-20", income: 3380, expenses: 1410 },
  { date: "21/01", dateISO: "2026-01-21", income: 3520, expenses: 1480 },
  { date: "22/01", dateISO: "2026-01-22", income: 3750, expenses: 1550 },
  { date: "23/01", dateISO: "2026-01-23", income: 3980, expenses: 1680 },
  { date: "24/01", dateISO: "2026-01-24", income: 5320, expenses: 2180 },
  { date: "25/01", dateISO: "2026-01-25", income: 5580, expenses: 2320 },
  { date: "26/01", dateISO: "2026-01-26", income: 3280, expenses: 1360 },
  { date: "27/01", dateISO: "2026-01-27", income: 3420, expenses: 1440 },
  { date: "28/01", dateISO: "2026-01-28", income: 3680, expenses: 1520 },
  { date: "29/01", dateISO: "2026-01-29", income: 3850, expenses: 1610 },
  { date: "30/01", dateISO: "2026-01-30", income: 4020, expenses: 1720 },
  { date: "31/01", dateISO: "2026-01-31", income: 5480, expenses: 2240 },
  { date: "01/02", dateISO: "2026-02-01", income: 5720, expenses: 2360 },
  { date: "02/02", dateISO: "2026-02-02", income: 3180, expenses: 1320 },
  { date: "03/02", dateISO: "2026-02-03", income: 3350, expenses: 1390 },
  { date: "04/02", dateISO: "2026-02-04", income: 3580, expenses: 1480 },
  { date: "05/02", dateISO: "2026-02-05", income: 3820, expenses: 1580 },
  { date: "06/02", dateISO: "2026-02-06", income: 4050, expenses: 1690 },
  { date: "07/02", dateISO: "2026-02-07", income: 5380, expenses: 2200 },
  { date: "08/02", dateISO: "2026-02-08", income: 5620, expenses: 2340 },
]

// ── Utility: compute final amount with discount ──
export function computeFinalAmount(amount: number, discountPercent: number): number {
  return amount * (1 - discountPercent / 100)
}

// ── Utility: format currency BRL ──
// Using manual formatting to avoid hydration mismatch from locale differences
export function formatBRL(value: number): string {
  const formatted = value.toFixed(2).replace(".", ",")
  const parts = formatted.split(",")
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `R$ ${integerPart},${parts[1]}`
}
