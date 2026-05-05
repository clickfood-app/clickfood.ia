import { formatDate } from "@/lib/utils/format-date"

export { formatDate }

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export type OrderStatus = "pending" | "preparing" | "finished" | "cancelled"
export type PaymentMethod = "Pix" | "Cartao" | "Dinheiro" | "Vale Refeicao"

export interface OrderItem {
  productId: string
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface Order {
  id: string
  clientName: string
  clientPhone: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  items: OrderItem[]
  total: number
  date: string
  createdAt: string
}

export interface OrderFilters {
  search: string
  dateFrom: string
  dateTo: string
  status: OrderStatus | "all"
  paymentMethod: PaymentMethod | "all"
  minValue: string
  maxValue: string
}

export const DEFAULT_FILTERS: OrderFilters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  status: "all",
  paymentMethod: "all",
  minValue: "",
  maxValue: "",
}

export interface OrderSummary {
  totalOrders: number
  totalRevenue: number
  averageTicket: number
  cancelledCount: number
}

export interface PaginatedOrdersResponse {
  data: Order[]
  totalPages: number
  totalItems: number
}

function buildQueryString(filters: OrderFilters, page = 1, perPage = 10) {
  const params = new URLSearchParams()

  if (filters.search) params.set("search", filters.search)
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
  if (filters.dateTo) params.set("dateTo", filters.dateTo)
  if (filters.status !== "all") params.set("status", filters.status)
  if (filters.paymentMethod !== "all") params.set("paymentMethod", filters.paymentMethod)
  if (filters.minValue) params.set("minValue", filters.minValue)
  if (filters.maxValue) params.set("maxValue", filters.maxValue)

  params.set("page", String(page))
  params.set("perPage", String(perPage))

  return params.toString()
}

export async function fetchOrders(
  filters: OrderFilters,
  page = 1,
  perPage = 10
): Promise<PaginatedOrdersResponse> {
  const query = buildQueryString(filters, page, perPage)

  const response = await fetch(`/api/orders?${query}`, {
    method: "GET",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("Falha ao buscar pedidos")
  }

  return response.json()
}

export function filterOrders(filters: OrderFilters, orders: Order[]): Order[] {
  let result = [...orders]

  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (o) =>
        o.clientName.toLowerCase().includes(q) ||
        o.clientPhone.includes(q) ||
        o.id.toLowerCase().includes(q)
    )
  }

  if (filters.dateFrom) {
    result = result.filter((o) => o.date >= filters.dateFrom)
  }

  if (filters.dateTo) {
    result = result.filter((o) => o.date <= filters.dateTo)
  }

  if (filters.status !== "all") {
    result = result.filter((o) => o.status === filters.status)
  }

  if (filters.paymentMethod !== "all") {
    result = result.filter((o) => o.paymentMethod === filters.paymentMethod)
  }

  if (filters.minValue) {
    const min = parseFloat(filters.minValue)
    if (!isNaN(min)) result = result.filter((o) => o.total >= min)
  }

  if (filters.maxValue) {
    const max = parseFloat(filters.maxValue)
    if (!isNaN(max)) result = result.filter((o) => o.total <= max)
  }

  return result
}

export function getOrderSummary(orders: Order[]): OrderSummary {
  const finished = orders.filter((o) => o.status !== "cancelled")
  const totalRevenue = finished.reduce((sum, order) => sum + order.total, 0)

  return {
    totalOrders: orders.length,
    totalRevenue,
    averageTicket: finished.length > 0 ? totalRevenue / finished.length : 0,
    cancelledCount: orders.filter((o) => o.status === "cancelled").length,
  }
}

export function paginateOrders(
  orders: Order[],
  page: number,
  perPage: number
): PaginatedOrdersResponse {
  const totalItems = orders.length
  const totalPages = Math.ceil(totalItems / perPage)
  const start = (page - 1) * perPage

  return {
    data: orders.slice(start, start + perPage),
    totalPages,
    totalItems,
  }
}

export function exportOrdersCSV(orders: Order[]): string {
  const header = "ID,Cliente,Telefone,Status,Pagamento,Total,Data"

  const rows = orders.map((o) =>
    [
      o.id,
      `"${o.clientName}"`,
      o.clientPhone,
      o.status,
      o.paymentMethod,
      o.total.toFixed(2),
      formatDate(o.date),
    ].join(",")
  )

  return [header, ...rows].join("\n")
}

export const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  pending: {
    label: "Pendente",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  preparing: {
    label: "Preparando",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  finished: {
    label: "Concluido",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-red-100 text-red-800 border-red-200",
  },
}

export const ALL_STATUSES: OrderStatus[] = ["pending", "preparing", "finished", "cancelled"]
export const ALL_PAYMENT_METHODS: PaymentMethod[] = ["Pix", "Cartao", "Dinheiro", "Vale Refeicao"]