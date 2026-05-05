// ===============================
// TIPOS BASE
// ===============================

export type PaymentMethod =
  | "Dinheiro"
  | "Pix"
  | "Cartão de Crédito"
  | "Cartão de Débito"
  | "Boleto"
  | "Transferência"

export type ExpenseStatus = "Pago" | "Pendente"

// ===============================
// FORNECEDORES
// ===============================

export interface Supplier {
  id: string
  restaurant_id: string
  name: string
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  notes?: string | null
  created_at?: string
}

// ===============================
// DESPESAS
// ===============================

export interface Expense {
  id: string
  restaurant_id: string

  supplier_id?: string | null
  supplier?: string | null

  description: string
  category?: string | null

  amount: number
  discountPercent: number

  paymentMethod: PaymentMethod
  status: ExpenseStatus

  issueDate?: string | null
  dueDate: string
  paidAt?: string | null

  createdAt?: string
}

// ===============================
// FLUXO DIÁRIO
// ===============================

export interface DailyFinance {
  date: string
  dateISO: string
  income: number
  expenses: number
}

// ===============================
// ESTADOS INICIAIS
// ===============================

export const initialSuppliers: Supplier[] = []
export const initialExpenses: Expense[] = []
export const dailyFinanceData: DailyFinance[] = []

// ===============================
// MÉTODOS DE PAGAMENTO
// ===============================

export const PAYMENT_METHODS: PaymentMethod[] = [
  "Dinheiro",
  "Pix",
  "Cartão de Crédito",
  "Cartão de Débito",
  "Boleto",
  "Transferência",
]

// ===============================
// UTILITÁRIOS
// ===============================

export function computeFinalAmount(
  amount: number,
  discountPercent: number = 0
): number {
  const finalValue = amount * (1 - discountPercent / 100)
  return Number(finalValue.toFixed(2))
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}