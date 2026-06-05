// Types for manual order creation

export type OrderType = "local" | "pickup" | "delivery"

export type PaymentMethod =
  | "cash"
  | "dinheiro"
  | "pix"
  | "credit"
  | "credito"
  | "debit"
  | "debito"
  | "pending"

export interface OrderItemModifier {
  groupId: string | null
  groupName: string
  optionId: string | null
  optionName: string
  optionPrice: number
}

export interface OrderItem {
  id: string
  productId: string
  name: string
  price: number
  quantity: number
  observation?: string
  modifiers?: OrderItemModifier[]
}

export type OrderItemDraft = Omit<OrderItem, "id">

export interface Table {
  id: string
  number: number
  name?: string
  capacity: number
  status: "available" | "occupied" | "reserved"
}

export interface CustomerData {
  name: string
  phone: string
  observation?: string
}

export interface DeliveryAddress {
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  zipCode?: string
}

export interface ManualOrder {
  id?: string
  type: OrderType
  tableId?: string
  customer: CustomerData
  address?: DeliveryAddress
  items: OrderItem[]
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  paymentMethod: PaymentMethod
  status: "pending" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled"
  createdAt?: Date
}

// Initial mock tables
export const initialTables: Table[] = [
  { id: "table-1", number: 1, capacity: 4, status: "available" },
  { id: "table-2", number: 2, capacity: 4, status: "occupied" },
  { id: "table-3", number: 3, capacity: 6, status: "available" },
  { id: "table-4", number: 4, capacity: 2, status: "available" },
  { id: "table-5", number: 5, capacity: 8, status: "reserved" },
  { id: "table-6", number: 6, capacity: 4, status: "available" },
]

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  dinheiro: "Dinheiro",
  pix: "PIX",
  credit: "Cartão Crédito",
  credito: "Cartão Crédito",
  debit: "Cartão Débito",
  debito: "Cartão Débito",
  pending: "Pagamento Pendente",
}

export const orderTypeLabels: Record<OrderType, string> = {
  local: "Consumo no Local",
  pickup: "Retirada",
  delivery: "Entrega",
}