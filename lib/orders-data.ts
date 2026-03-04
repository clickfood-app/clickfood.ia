// ── Orders History mock data generator ──
// Generates deterministic order data from existing clients and products.
// Structured for future Supabase migration (server-side filtering/pagination).

import { MOCK_CLIENTS } from "@/lib/clients-data"
import { initialProducts } from "@/lib/products-data"
import { formatDate } from "@/lib/utils/format-date"

export { formatDate }

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

// ── Types ──

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
  date: string // ISO string YYYY-MM-DD
  createdAt: string // ISO datetime
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

// ── Data Generation ──

const paymentMethods: PaymentMethod[] = ["Pix", "Cartao", "Dinheiro", "Vale Refeicao"]
const statuses: OrderStatus[] = ["finished", "finished", "finished", "finished", "finished", "pending", "preparing", "cancelled"]

const activeProducts = initialProducts.filter((p) => p.active)

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function generateOrders(): Order[] {
  const orders: Order[] = []
  let orderId = 1000

  // Generate orders from existing client orders
  for (const client of MOCK_CLIENTS) {
    for (const co of client.orders) {
      orderId++
      const seed = orderId * 7 + client.id.charCodeAt(1) * 13

      // Map client order items to OrderItems
      const items: OrderItem[] = co.items.map((itemStr, idx) => {
        const qtyMatch = itemStr.match(/x(\d+)/)
        const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1
        const cleanName = itemStr.replace(/\s*x\d+/, "").trim()

        // Try to find matching product
        const matched = activeProducts.find((p) =>
          cleanName.toLowerCase().includes(p.name.toLowerCase().split(" ")[0])
        )

        const unitPrice = matched ? matched.price : 35 + (seed % 30)
        return {
          productId: matched?.id || `gen-${idx}`,
          name: cleanName,
          quantity: qty,
          unitPrice,
          subtotal: qty * unitPrice,
        }
      })

      const total = co.total > 0 ? co.total : items.reduce((s, i) => s + i.subtotal, 0)

      const statusMap: Record<string, OrderStatus> = {
        "Entregue": "finished",
        "Em trânsito": "preparing",
        "Cancelado": "cancelled",
        "Pendente": "pending",
      }

      orders.push({
        id: `PED-${orderId}`,
        clientName: client.name,
        clientPhone: client.phone,
        status: statusMap[co.status] || "finished",
        paymentMethod: paymentMethods[seed % paymentMethods.length],
        items,
        total,
        date: co.date,
        createdAt: `${co.date}T${12 + (seed % 10)}:${(seed % 60).toString().padStart(2, "0")}:00`,
      })
    }
  }

  // Generate additional orders to fill 150+ entries for pagination demo
  const baseDate = new Date(2026, 1, 23) // Feb 23 2026

  for (let i = 0; i < 100; i++) {
    orderId++
    const seed = orderId * 11 + i * 37

    const daysAgo = Math.floor(seededRandom(seed) * 90)
    const date = new Date(baseDate)
    date.setDate(date.getDate() - daysAgo)
    const dateISO = date.toISOString().split("T")[0]

    const clientIdx = Math.floor(seededRandom(seed + 1) * MOCK_CLIENTS.length)
    const client = MOCK_CLIENTS[clientIdx]

    const numItems = 1 + Math.floor(seededRandom(seed + 2) * 3)
    const items: OrderItem[] = []
    let total = 0

    for (let j = 0; j < numItems; j++) {
      const prodIdx = Math.floor(seededRandom(seed + 3 + j) * activeProducts.length)
      const prod = activeProducts[prodIdx]
      const qty = 1 + Math.floor(seededRandom(seed + 10 + j) * 2)
      const subtotal = qty * prod.price
      items.push({
        productId: prod.id,
        name: prod.name,
        quantity: qty,
        unitPrice: prod.price,
        subtotal,
      })
      total += subtotal
    }

    total = Math.round(total * 100) / 100

    orders.push({
      id: `PED-${orderId}`,
      clientName: client.name,
      clientPhone: client.phone,
      status: statuses[Math.floor(seededRandom(seed + 4) * statuses.length)],
      paymentMethod: paymentMethods[Math.floor(seededRandom(seed + 5) * paymentMethods.length)],
      items,
      total,
      date: dateISO,
      createdAt: `${dateISO}T${12 + Math.floor(seededRandom(seed + 6) * 10)}:${Math.floor(seededRandom(seed + 7) * 60).toString().padStart(2, "0")}:00`,
    })
  }

  // Sort by date descending
  orders.sort((a, b) => b.date.localeCompare(a.date))

  return orders
}

const ALL_ORDERS = generateOrders()

// ── Filtering (client-side, prepared for server-side migration) ──

export function filterOrders(filters: OrderFilters): Order[] {
  let result = [...ALL_ORDERS]

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

// ── Summary ──

export function getOrderSummary(orders: Order[]): OrderSummary {
  const finished = orders.filter((o) => o.status !== "cancelled")
  const totalRevenue = finished.reduce((s, o) => s + o.total, 0)
  return {
    totalOrders: orders.length,
    totalRevenue,
    averageTicket: finished.length > 0 ? totalRevenue / finished.length : 0,
    cancelledCount: orders.filter((o) => o.status === "cancelled").length,
  }
}

// ── Pagination ──

export function paginateOrders(
  orders: Order[],
  page: number,
  perPage: number
): { data: Order[]; totalPages: number; totalItems: number } {
  const totalItems = orders.length
  const totalPages = Math.ceil(totalItems / perPage)
  const start = (page - 1) * perPage
  return {
    data: orders.slice(start, start + perPage),
    totalPages,
    totalItems,
  }
}

// ── CSV Export ──

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

// ── Status helpers ──

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
