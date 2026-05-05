import { createClient } from "@/lib/supabase/client"
import type { Expense, Supplier } from "@/lib/finance-data"

const supabase = createClient()

type SupplierRow = {
  id: string
  restaurant_id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  pix_key: string | null
  notes: string | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

type ExpenseRow = {
  id: string
  restaurant_id: string
  supplier_id: string | null
  title: string
  description: string | null
  category: string
  amount: number | string
  expense_date: string
  due_date: string | null
  payment_date: string | null
  payment_method: string | null
  status: string | null
  is_recurring: boolean
  recurrence_type: string | null
  created_at: string | null
  updated_at: string | null
  supplier?: {
    id: string
    name: string
  } | null
}

type DbPaymentMethod =
  | "pix"
  | "dinheiro"
  | "cartao_credito"
  | "cartao_debito"
  | "boleto"

type UiPaymentMethod =
  | "Pix"
  | "Dinheiro"
  | "Cartão de Crédito"
  | "Cartão de Débito"
  | "Boleto"

type DbExpenseStatus = "pago" | "pendente"
type UiExpenseStatus = "Pago" | "Pendente"

export type CreateSupplierInput = {
  name: string
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  pix_key?: string | null
  notes?: string | null
}

export type CreateExpenseInput = {
  supplier_id?: string | null
  title: string
  description?: string | null
  category: string
  amount: number
  payment_method?: string | null
  status: string
  expense_date: string
  due_date?: string | null
  payment_date?: string | null
  is_recurring?: boolean
  recurrence_type?: string | null
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>

function normalizeText(value: string | null | undefined) {
  return value?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

function normalizePaymentMethodForDb(
  value: string | null | undefined
): DbPaymentMethod | null {
  if (!value) return null

  const normalized = normalizeText(value)

  const map: Record<string, DbPaymentMethod> = {
    pix: "pix",
    dinheiro: "dinheiro",
    boleto: "boleto",
    cartao_credito: "cartao_credito",
    cartao_debito: "cartao_debito",
    credito: "cartao_credito",
    debito: "cartao_debito",
    "cartao de credito": "cartao_credito",
    "cartao de debito": "cartao_debito",
  }

  return map[normalized ?? ""] ?? null
}

function paymentMethodDbToUi(
  value: string | null | undefined
): UiPaymentMethod {
  const normalized = normalizePaymentMethodForDb(value)

  const map: Record<DbPaymentMethod, UiPaymentMethod> = {
    pix: "Pix",
    dinheiro: "Dinheiro",
    cartao_credito: "Cartão de Crédito",
    cartao_debito: "Cartão de Débito",
    boleto: "Boleto",
  }

  return normalized ? map[normalized] : "Pix"
}

function normalizeExpenseStatusForDb(
  value: string | null | undefined
): DbExpenseStatus {
  const normalized = normalizeText(value)

  if (normalized === "pago") return "pago"
  return "pendente"
}

function expenseStatusDbToUi(value: string | null | undefined): UiExpenseStatus {
  return normalizeExpenseStatusForDb(value) === "pago" ? "Pago" : "Pendente"
}

function safeTrim(value: string | null | undefined) {
  return value?.trim() || null
}

function mapSupplierRow(row: SupplierRow): Supplier {
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    name: row.name,
    contact_name: row.contact_name,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    created_at: row.created_at ?? undefined,
  }
}

function mapExpenseRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    supplier_id: row.supplier_id,
    supplier: row.supplier?.name ?? null,
    description: row.title,
    category: row.category,
    amount: Number(row.amount ?? 0),
    discountPercent: 0,
    paymentMethod: paymentMethodDbToUi(row.payment_method) as Expense["paymentMethod"],
    status: expenseStatusDbToUi(row.status) as Expense["status"],
    issueDate: row.expense_date,
    dueDate: row.due_date ?? row.expense_date,
    paidAt: row.payment_date,
    createdAt: row.created_at ?? undefined,
  }
}

export async function getMyRestaurantId() {
  const { data, error } = await supabase.rpc("get_my_restaurant_id")

  if (error) {
    throw new Error(`Erro ao buscar restaurante: ${error.message}`)
  }

  if (!data) {
    throw new Error("Restaurante não encontrado")
  }

  return data as string
}

export async function listSuppliers(restaurantId: string) {
  const { data, error } = await supabase
    .from("finance_suppliers")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("name", { ascending: true })

  if (error) {
    throw new Error(`Erro ao listar fornecedores: ${error.message}`)
  }

  return ((data ?? []) as SupplierRow[]).map(mapSupplierRow)
}

export async function createSupplier(
  restaurantId: string,
  input: CreateSupplierInput
) {
  const payload = {
    restaurant_id: restaurantId,
    name: input.name.trim(),
    contact_name: safeTrim(input.contact_name),
    phone: safeTrim(input.phone),
    email: safeTrim(input.email),
    pix_key: safeTrim(input.pix_key),
    notes: safeTrim(input.notes),
  }

  const { data, error } = await supabase
    .from("finance_suppliers")
    .insert(payload)
    .select("*")
    .single()

  if (error) {
    throw new Error(`Erro ao criar fornecedor: ${error.message}`)
  }

  return mapSupplierRow(data as SupplierRow)
}

export async function deleteSupplier(id: string) {
  const { error } = await supabase.from("finance_suppliers").delete().eq("id", id)

  if (error) {
    throw new Error(`Erro ao excluir fornecedor: ${error.message}`)
  }

  return true
}

export async function listExpenses(restaurantId: string) {
  const { data, error } = await supabase
    .from("finance_expenses")
    .select(`
      *,
      supplier:finance_suppliers (
        id,
        name
      )
    `)
    .eq("restaurant_id", restaurantId)
    .order("expense_date", { ascending: false })

  if (error) {
    throw new Error(`Erro ao listar despesas: ${error.message}`)
  }

  return ((data ?? []) as ExpenseRow[]).map(mapExpenseRow)
}

export async function createExpense(
  restaurantId: string,
  input: CreateExpenseInput
) {
  const payload = {
    restaurant_id: restaurantId,
    supplier_id: input.supplier_id ?? null,
    title: input.title.trim(),
    description: safeTrim(input.description),
    category: input.category.trim() || "geral",
    amount: input.amount,
    payment_method: normalizePaymentMethodForDb(input.payment_method),
    status: normalizeExpenseStatusForDb(input.status),
    expense_date: input.expense_date,
    due_date: input.due_date ?? null,
    payment_date: input.payment_date ?? null,
    is_recurring: input.is_recurring ?? false,
    recurrence_type: input.recurrence_type ?? null,
  }

  const { data, error } = await supabase
    .from("finance_expenses")
    .insert(payload)
    .select(`
      *,
      supplier:finance_suppliers (
        id,
        name
      )
    `)
    .single()

  if (error) {
    throw new Error(`Erro ao criar despesa: ${error.message}`)
  }

  return mapExpenseRow(data as ExpenseRow)
}

export async function updateExpense(id: string, input: UpdateExpenseInput) {
  const payload = {
    ...(input.supplier_id !== undefined && { supplier_id: input.supplier_id ?? null }),
    ...(input.title !== undefined && { title: input.title.trim() }),
    ...(input.description !== undefined && {
      description: safeTrim(input.description),
    }),
    ...(input.category !== undefined && {
      category: input.category.trim() || "geral",
    }),
    ...(input.amount !== undefined && { amount: input.amount }),
    ...(input.payment_method !== undefined && {
      payment_method: normalizePaymentMethodForDb(input.payment_method),
    }),
    ...(input.status !== undefined && {
      status: normalizeExpenseStatusForDb(input.status),
    }),
    ...(input.expense_date !== undefined && { expense_date: input.expense_date }),
    ...(input.due_date !== undefined && { due_date: input.due_date ?? null }),
    ...(input.payment_date !== undefined && {
      payment_date: input.payment_date ?? null,
    }),
    ...(input.is_recurring !== undefined && { is_recurring: input.is_recurring }),
    ...(input.recurrence_type !== undefined && {
      recurrence_type: input.recurrence_type ?? null,
    }),
  }

  const { data, error } = await supabase
    .from("finance_expenses")
    .update(payload)
    .eq("id", id)
    .select(`
      *,
      supplier:finance_suppliers (
        id,
        name
      )
    `)
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar despesa: ${error.message}`)
  }

  return mapExpenseRow(data as ExpenseRow)
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("finance_expenses").delete().eq("id", id)

  if (error) {
    throw new Error(`Erro ao excluir despesa: ${error.message}`)
  }

  return true
}