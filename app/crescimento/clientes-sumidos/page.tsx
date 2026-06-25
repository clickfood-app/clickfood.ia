"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarDays,
  Clock,
  Crown,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCcw,
  Search,
  ShoppingBag,
  Target,
  TrendingDown,
  UserX,
  Users,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Restaurant = {
  id: string
  name: string | null
}

type OrderRecord = {
  id: string
  created_at: string | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_address?: string | null
  customer_neighborhood?: string | null
  status?: string | null
  payment_status?: string | null
  subtotal?: number | string | null
  total?: number | string | null
  delivery_fee?: number | string | null
}

type OrderItemRecord = {
  id: string
  order_id: string | null
  product_id?: string | null
  product_name?: string | null
  name?: string | null
  item_name?: string | null
  title?: string | null
  quantity?: number | string | null
  qty?: number | string | null
  amount?: number | string | null
}

type LostCustomer = {
  key: string
  name: string
  phone: string
  address: string
  neighborhood: string
  ordersCount: number
  totalSpent: number
  averageTicket: number
  lastOrderDate: Date
  lastOrderId: string
  daysInactive: number
  favoriteProduct: string
  favoriteProductQuantity: number
  status: "attention" | "risk" | "lost" | "critical"
  statusLabel: string
  recoveryPriority: "Alta" | "Média" | "Baixa"
  suggestedOffer: string
  aiContext: string
}

type InactiveFilter = "5" | "7" | "15" | "30" | "60" | "all"
type PaymentFilter = "paid" | "all"
type SortFilter = "days" | "spent" | "orders" | "ticket"

const LOST_AFTER_DAYS = 5

const ORDER_SELECTS = [
  "id, created_at, customer_name, customer_phone, customer_address, customer_neighborhood, status, payment_status, subtotal, total, delivery_fee",
  "id, created_at, customer_name, customer_phone, status, payment_status, subtotal, total, delivery_fee",
  "id, created_at, customer_name, customer_phone, status, subtotal, total, delivery_fee",
  "id, created_at, customer_name, customer_phone, total",
] as const

const ORDER_ITEM_SELECTS = [
  "id, order_id, product_id, product_name, name, item_name, title, quantity, qty, amount",
  "id, order_id, product_name, quantity",
  "id, order_id, name, quantity",
  "id, order_id, quantity",
  "id, order_id",
] as const

const ORDER_ITEM_CHUNK_SIZE = 400

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

function formatMoney(value: number) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".")
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function getOrderTotal(order: OrderRecord) {
  const total = toNumber(order.total)
  if (total > 0) return total

  return toNumber(order.subtotal) + toNumber(order.delivery_fee)
}

function normalizeText(value?: string | null) {
  return String(value || "").trim()
}

function normalizePhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "")
}

function formatPhone(value: string) {
  if (!value) return "Sem telefone"

  if (value.length === 11) {
    return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`
  }

  if (value.length === 10) {
    return `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`
  }

  return value
}

function getWhatsAppPhone(value: string) {
  const phone = normalizePhone(value)

  if (!phone) return ""

  if (phone.startsWith("55")) return phone

  if (phone.length === 10 || phone.length === 11) {
    return `55${phone}`
  }

  return phone
}

function getDaysInactive(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

function getCustomerStatus(daysInactive: number) {
  if (daysInactive >= 60) {
    return {
      status: "critical" as const,
      label: "Crítico",
    }
  }

  if (daysInactive >= 30) {
    return {
      status: "lost" as const,
      label: "Sumido",
    }
  }

  if (daysInactive >= 15) {
    return {
      status: "risk" as const,
      label: "Em risco",
    }
  }

  return {
    status: "attention" as const,
    label: "Sumido recente",
  }
}

function getRecoveryPriority(customer: {
  daysInactive: number
  totalSpent: number
  ordersCount: number
}): LostCustomer["recoveryPriority"] {
  if (
    customer.daysInactive >= 30 &&
    customer.totalSpent >= 150 &&
    customer.ordersCount >= 2
  ) {
    return "Alta"
  }

  if (customer.daysInactive >= LOST_AFTER_DAYS && customer.totalSpent >= 80) {
    return "Média"
  }

  return "Baixa"
}

function getOrderItemName(item: OrderItemRecord) {
  return (
    item.product_name ||
    item.name ||
    item.item_name ||
    item.title ||
    "Produto sem nome"
  )
}

function getOrderItemQuantity(item: OrderItemRecord) {
  const quantity =
    toNumber(item.quantity) || toNumber(item.qty) || toNumber(item.amount)

  return quantity > 0 ? quantity : 1
}

function getCustomerKey(order: OrderRecord) {
  const phone = normalizePhone(order.customer_phone)
  const name = normalizeText(order.customer_name).toLowerCase()

  if (phone) return `phone:${phone}`
  if (name) return `name:${name}`

  return `order:${order.id}`
}

function buildWhatsAppMessage(customer: LostCustomer, restaurantName?: string | null) {
  const firstName = customer.name.split(" ")[0] || customer.name
  const storeName = restaurantName || "a gente"
  const offer =
    customer.suggestedOffer ||
    "Hoje temos opções bem caprichadas no cardápio. Quer que eu te mande as sugestões?"

  return encodeURIComponent(
    `Oi, ${firstName}! Tudo bem? Aqui é do ${storeName}. Notei que faz ${customer.daysInactive} dias que você não pede com a gente e queria te chamar pra matar a saudade 😄\n\n${offer}`,
  )
}

function buildSuggestedOffer(customer: {
  favoriteProduct: string
  averageTicket: number
  daysInactive: number
  ordersCount: number
}) {
  const hasFavoriteProduct =
    customer.favoriteProduct &&
    customer.favoriteProduct !== "Sem item identificado"

  if (customer.daysInactive >= 30 && hasFavoriteProduct) {
    return `Oferta de reativação: desconto especial ou brinde no ${customer.favoriteProduct}, com validade curta para trazer o cliente de volta hoje.`
  }

  if (customer.averageTicket >= 80) {
    return "Oferta para ticket alto: combo premium com brinde, sobremesa ou entrega grátis acima do ticket médio desse cliente."
  }

  if (customer.ordersCount >= 3 && hasFavoriteProduct) {
    return `Oferta de recorrência: repetir o ${customer.favoriteProduct} com um benefício simples, como adicional grátis ou taxa de entrega reduzida.`
  }

  if (hasFavoriteProduct) {
    return `Oferta direta: chamar o cliente com foco no ${customer.favoriteProduct}, que é o item com maior chance de conversão.`
  }

  return "Oferta inicial: enviar uma sugestão curta com 2 opções campeãs do cardápio e um benefício para comprar hoje."
}

function buildAiContext(customer: LostCustomer) {
  return [
    `Cliente: ${customer.name}`,
    `Telefone: ${formatPhone(customer.phone)}`,
    `Último pedido: ${formatDate(customer.lastOrderDate)}`,
    `Dias sem comprar: ${customer.daysInactive}`,
    `Pedidos anteriores: ${customer.ordersCount}`,
    `Total gasto: ${formatMoney(customer.totalSpent)}`,
    `Ticket médio: ${formatMoney(customer.averageTicket)}`,
    `Produto preferido: ${customer.favoriteProduct}`,
    `Prioridade: ${customer.recoveryPriority}`,
    `Sugestão de oferta: ${customer.suggestedOffer}`,
  ].join("\n")
}

function getReadableError(error: unknown) {
  if (!error) return "Erro desconhecido."

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "object") {
    const err = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }

    return [err.message, err.details, err.hint, err.code]
      .filter(Boolean)
      .join(" | ")
  }

  return String(error)
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
}

export default function ClientesSumidosPage() {
  const supabase = createClient()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [orderItems, setOrderItems] = useState<OrderItemRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [inactiveFilter, setInactiveFilter] = useState<InactiveFilter>("5")
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all")
  const [sortFilter, setSortFilter] = useState<SortFilter>("days")
  const [searchTerm, setSearchTerm] = useState("")

  async function fetchOrders(restaurantId: string) {
    let lastError: unknown = null

    for (const selectFields of ORDER_SELECTS) {
      const { data, error } = await supabase
        .from("orders")
        .select(selectFields)
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(2000)

      if (!error) {
        return ((data || []) as unknown) as OrderRecord[]
      }

      lastError = error
    }

    throw lastError
  }

  async function fetchOrderItems(orderIds: string[]) {
    if (orderIds.length === 0) return []

    let lastError: unknown = null
    const orderIdChunks = chunkArray(orderIds, ORDER_ITEM_CHUNK_SIZE)

    for (const selectFields of ORDER_ITEM_SELECTS) {
      const loadedItems: OrderItemRecord[] = []
      let hasError = false

      for (const orderIdChunk of orderIdChunks) {
        const { data, error } = await supabase
          .from("order_items")
          .select(selectFields)
          .in("order_id", orderIdChunk)

        if (error) {
          lastError = error
          hasError = true
          break
        }

        loadedItems.push(...(((data || []) as unknown) as OrderItemRecord[]))
      }

      if (!hasError) {
        return loadedItems
      }
    }

    throw lastError
  }

  async function loadData(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError

      if (!user) {
        setError("Usuário não autenticado.")
        setOrders([])
        setOrderItems([])
        return
      }

      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle()

      if (restaurantError) throw restaurantError

      if (!restaurantData) {
        setError("Nenhum restaurante encontrado para este usuário.")
        setRestaurant(null)
        setOrders([])
        setOrderItems([])
        return
      }

      setRestaurant(restaurantData)

      const loadedOrders = await fetchOrders(restaurantData.id)
      const orderIds = loadedOrders.map((order) => order.id).filter(Boolean)
      const loadedOrderItems = await fetchOrderItems(orderIds)

      setOrders(loadedOrders)
      setOrderItems(loadedOrderItems)
    } catch (err) {
      const readableError = getReadableError(err)

      console.error("Erro ao carregar clientes sumidos:", readableError, err)
      setError(`Não foi possível carregar os clientes sumidos. ${readableError}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lostCustomers = useMemo<LostCustomer[]>(() => {
    const validOrders = orders.filter((order) => {
      const status = String(order.status || "").toLowerCase()
      const paymentStatus = String(order.payment_status || "").toLowerCase()

      const isCanceled =
        status === "cancelled" ||
        status === "canceled" ||
        status === "cancelado" ||
        status === "rejected" ||
        status === "recusado"

      if (isCanceled) return false

      if (paymentFilter === "paid") {
        return (
          !paymentStatus ||
          paymentStatus === "paid" ||
          paymentStatus === "confirmed" ||
          paymentStatus === "approved"
        )
      }

      return true
    })

    const orderItemsByOrderId = new Map<string, OrderItemRecord[]>()

    for (const item of orderItems) {
      if (!item.order_id) continue

      const current = orderItemsByOrderId.get(item.order_id) || []
      current.push(item)
      orderItemsByOrderId.set(item.order_id, current)
    }

    const grouped = new Map<
      string,
      {
        key: string
        name: string
        phone: string
        address: string
        neighborhood: string
        ordersCount: number
        totalSpent: number
        lastOrderDate: Date
        lastOrderId: string
        productCounter: Map<string, number>
      }
    >()

    for (const order of validOrders) {
      if (!order.created_at) continue

      const orderDate = new Date(order.created_at)

      if (Number.isNaN(orderDate.getTime())) continue

      const key = getCustomerKey(order)
      const phone = normalizePhone(order.customer_phone)
      const name = normalizeText(order.customer_name) || "Cliente sem nome"
      const address = normalizeText(order.customer_address)
      const neighborhood = normalizeText(order.customer_neighborhood)

      const current =
        grouped.get(key) ||
        {
          key,
          name,
          phone,
          address,
          neighborhood,
          ordersCount: 0,
          totalSpent: 0,
          lastOrderDate: orderDate,
          lastOrderId: order.id,
          productCounter: new Map<string, number>(),
        }

      current.ordersCount += 1
      current.totalSpent += getOrderTotal(order)

      if (orderDate > current.lastOrderDate) {
        current.lastOrderDate = orderDate
        current.lastOrderId = order.id
        current.name = name
        current.phone = phone
        current.address = address
        current.neighborhood = neighborhood
      }

      const items = orderItemsByOrderId.get(order.id) || []

      for (const item of items) {
        const productName = getOrderItemName(item)
        const quantity = getOrderItemQuantity(item)

        current.productCounter.set(
          productName,
          (current.productCounter.get(productName) || 0) + quantity,
        )
      }

      grouped.set(key, current)
    }

    const customers = Array.from(grouped.values()).map((customer) => {
      const daysInactive = getDaysInactive(customer.lastOrderDate)
      const averageTicket =
        customer.ordersCount > 0 ? customer.totalSpent / customer.ordersCount : 0

      const favoriteProductEntry = Array.from(
        customer.productCounter.entries(),
      ).sort((a, b) => b[1] - a[1])[0]

      const status = getCustomerStatus(daysInactive)

      const baseCustomer = {
        key: customer.key,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        neighborhood: customer.neighborhood,
        ordersCount: customer.ordersCount,
        totalSpent: customer.totalSpent,
        averageTicket,
        lastOrderDate: customer.lastOrderDate,
        lastOrderId: customer.lastOrderId,
        daysInactive,
        favoriteProduct: favoriteProductEntry?.[0] || "Sem item identificado",
        favoriteProductQuantity: favoriteProductEntry?.[1] || 0,
        status: status.status,
        statusLabel: status.label,
        recoveryPriority: "Baixa" as LostCustomer["recoveryPriority"],
      }

      const customerWithPriority = {
        ...baseCustomer,
        recoveryPriority: getRecoveryPriority(baseCustomer),
      }

      const customerWithOffer = {
        ...customerWithPriority,
        suggestedOffer: buildSuggestedOffer(customerWithPriority),
        aiContext: "",
      }

      return {
        ...customerWithOffer,
        aiContext: buildAiContext(customerWithOffer),
      }
    })

    return customers.filter((customer) => customer.daysInactive >= LOST_AFTER_DAYS).sort((a, b) => {
      if (sortFilter === "spent") return b.totalSpent - a.totalSpent
      if (sortFilter === "orders") return b.ordersCount - a.ordersCount
      if (sortFilter === "ticket") return b.averageTicket - a.averageTicket

      return b.daysInactive - a.daysInactive
    })
  }, [orders, orderItems, paymentFilter, sortFilter])

  const filteredCustomers = useMemo(() => {
    return lostCustomers.filter((customer) => {
      const minInactiveDays =
        inactiveFilter === "all" ? 0 : Number(inactiveFilter)

      const matchesInactive = customer.daysInactive >= minInactiveDays

      const search = searchTerm.toLowerCase()

      const matchesSearch =
        customer.name.toLowerCase().includes(search) ||
        customer.phone.includes(normalizePhone(searchTerm)) ||
        customer.neighborhood.toLowerCase().includes(search) ||
        customer.favoriteProduct.toLowerCase().includes(search)

      return matchesInactive && matchesSearch
    })
  }, [lostCustomers, inactiveFilter, searchTerm])

  const summary = useMemo(() => {
    const critical = lostCustomers.filter(
      (customer) => customer.daysInactive >= 60,
    ).length

    const lost = lostCustomers.filter(
      (customer) => customer.daysInactive >= 30,
    ).length

    const risk = lostCustomers.filter(
      (customer) => customer.daysInactive >= LOST_AFTER_DAYS,
    ).length

    const potentialRevenue = filteredCustomers.reduce(
      (sum, customer) => sum + customer.averageTicket,
      0,
    )

    const highPriority = filteredCustomers.filter(
      (customer) => customer.recoveryPriority === "Alta",
    ).length

    return {
      totalCustomers: lostCustomers.length,
      filteredCustomers: filteredCustomers.length,
      critical,
      lost,
      risk,
      potentialRevenue,
      highPriority,
    }
  }, [lostCustomers, filteredCustomers])

  function handleOpenWhatsApp(customer: LostCustomer) {
    const phone = getWhatsAppPhone(customer.phone)

    if (!phone) return

    const message = buildWhatsAppMessage(customer, restaurant?.name)
    const url = `https://wa.me/${phone}?text=${message}`

    window.open(url, "_blank", "noopener,noreferrer")
  }

  const inactiveOptions = [
    { value: "5", label: "+5 dias" },
    { value: "7", label: "+7 dias" },
    { value: "15", label: "+15 dias" },
    { value: "30", label: "+30 dias" },
    { value: "60", label: "+60 dias" },
    { value: "all", label: "Todos" },
  ] as const

  const paymentOptions = [
    { value: "all", label: "Todos válidos" },
    { value: "paid", label: "Pagos/confirmados" },
  ] as const

  const sortOptions = [
    { value: "days", label: "Mais sumidos" },
    { value: "spent", label: "Maior gasto" },
    { value: "orders", label: "Mais pedidos" },
    { value: "ticket", label: "Maior ticket" },
  ] as const

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#111111] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                    <UserX className="h-5 w-5" />
                  </div>

                  <div>
                    <h1 className="text-xl font-bold text-white">
                      Clientes Sumidos
                    </h1>
                    <p className="text-sm text-zinc-500">
                      Clientes com mais de 5 dias sem comprar, prontos para
                      recuperação por WhatsApp e futura IA.
                    </p>
                  </div>
                </div>

                {restaurant?.name ? (
                  <p className="text-xs font-medium text-zinc-500">
                    Restaurante: {restaurant.name}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={inactiveFilter}
                  onChange={(event) =>
                    setInactiveFilter(event.target.value as InactiveFilter)
                  }
                  className="h-10 rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold text-zinc-500 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100"
                >
                  {inactiveOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0A0A0A] px-4 text-sm font-semibold text-zinc-500 transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                  Atualizar
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-white/10 bg-[#0A0A0A]">
              <div className="flex flex-col items-center gap-3 text-zinc-500">
                <Loader2 className="h-7 w-7 animate-spin" />
                <p className="text-sm font-medium">
                  Carregando clientes sumidos...
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#111111] text-zinc-500">
                      <Users className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-[#111111] px-2.5 py-1 text-xs font-black text-zinc-500">
                      Base
                    </span>
                  </div>
                  <p className="text-sm font-medium text-zinc-500">
                    Clientes identificados
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {summary.totalCustomers}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-zinc-500">
                    Clientes no filtro
                  </p>
                  <p className="mt-1 text-2xl font-black text-red-600">
                    {summary.filteredCustomers}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                    <BadgeDollarSign className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-zinc-500">
                    Receita recuperável
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {formatMoney(summary.potentialRevenue)}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-400">
                    <Target className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-zinc-500">
                    Prioridade alta
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {summary.highPriority}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-zinc-500" />
                    <h2 className="text-base font-bold text-white">
                      Mapa de inatividade
                    </h2>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-yellow-400/10 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-yellow-400">
                        +5 dias
                      </p>
                      <p className="mt-1 text-lg font-black text-yellow-400">
                        {summary.risk}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-red-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-red-600/80">
                        +30 dias
                      </p>
                      <p className="mt-1 text-lg font-black text-red-700">
                        {summary.lost}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#111111] p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                        +60 dias
                      </p>
                      <p className="mt-1 text-lg font-black text-white">
                        {summary.critical}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">
                        Melhor oportunidade
                      </p>
                      <p className="text-xs font-medium text-zinc-500">
                        Cliente com maior chance de retorno financeiro.
                      </p>
                    </div>

                    <Crown className="h-5 w-5 text-yellow-500" />
                  </div>

                  {filteredCustomers[0] ? (
                    <div className="rounded-2xl bg-yellow-50 p-4">
                      <p className="line-clamp-1 text-base font-black text-yellow-950">
                        {filteredCustomers[0].name}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs font-bold uppercase text-yellow-700/70">
                            Já gastou
                          </p>
                          <p className="font-black text-yellow-800">
                            {formatMoney(filteredCustomers[0].totalSpent)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase text-yellow-700/70">
                            Sumido há
                          </p>
                          <p className="font-black text-yellow-800">
                            {filteredCustomers[0].daysInactive} dias
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-[#111111] p-4 text-sm font-medium text-zinc-500">
                      Nenhum cliente encontrado no filtro atual.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] shadow-sm">
                <div className="border-b border-white/10 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-base font-bold text-white">
                        Lista de clientes para recuperar
                      </h2>
                      <p className="text-sm text-zinc-500">
                        Use o botão do WhatsApp para chamar o cliente com uma
                        mensagem pronta.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input
                          value={searchTerm}
                          onChange={(event) =>
                            setSearchTerm(event.target.value)
                          }
                          placeholder="Buscar cliente..."
                          className="h-10 w-full rounded-xl border border-white/10 bg-[#0A0A0A] pl-9 pr-3 text-sm font-medium outline-none transition placeholder:text-zinc-500 focus:border-red-400 focus:ring-4 focus:ring-red-100 sm:w-64"
                        />
                      </div>

                      <select
                        value={paymentFilter}
                        onChange={(event) =>
                          setPaymentFilter(event.target.value as PaymentFilter)
                        }
                        className="h-10 rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold text-zinc-500 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100"
                      >
                        {paymentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={sortFilter}
                        onChange={(event) =>
                          setSortFilter(event.target.value as SortFilter)
                        }
                        className="h-10 rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold text-zinc-500 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100"
                      >
                        {sortOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-5 lg:grid-cols-2">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((customer) => (
                      <div
                        key={customer.key}
                        className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm transition hover:border-red-200 hover:bg-red-50/20"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <h3 className="line-clamp-1 text-base font-black text-white">
                                {customer.name}
                              </h3>

                              <span
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-xs font-black",
                                  customer.status === "attention" &&
                                    "bg-yellow-400/10 text-yellow-400",
                                  customer.status === "risk" &&
                                    "bg-yellow-400/10 text-yellow-400",
                                  customer.status === "lost" &&
                                    "bg-red-100 text-red-700",
                                  customer.status === "critical" &&
                                    "bg-[#111111] text-white",
                                )}
                              >
                                {customer.statusLabel}
                              </span>

                              <span
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-xs font-black",
                                  customer.recoveryPriority === "Alta" &&
                                    "bg-emerald-500/10 text-emerald-400",
                                  customer.recoveryPriority === "Média" &&
                                    "bg-yellow-400/10 text-yellow-400",
                                  customer.recoveryPriority === "Baixa" &&
                                    "bg-[#111111] text-zinc-500",
                                )}
                              >
                                Prioridade {customer.recoveryPriority}
                              </span>
                            </div>

                            <div className="grid gap-2 text-sm text-zinc-500">
                              <div className="flex items-center gap-2">
                                <MessageCircle className="h-4 w-4 text-zinc-500" />
                                <span className="font-semibold">
                                  {formatPhone(customer.phone)}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <CalendarDays className="h-4 w-4 text-zinc-500" />
                                <span className="font-semibold">
                                  Último pedido em{" "}
                                  {formatDate(customer.lastOrderDate)} • há{" "}
                                  {customer.daysInactive} dias
                                </span>
                              </div>

                              {customer.neighborhood ? (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-zinc-500" />
                                  <span className="font-semibold">
                                    {customer.neighborhood}
                                  </span>
                                </div>
                              ) : null}

                              <div className="flex items-center gap-2">
                                <ShoppingBag className="h-4 w-4 text-zinc-500" />
                                <span className="font-semibold">
                                  Preferência: {customer.favoriteProduct}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3">
                              <p className="text-xs font-black uppercase tracking-wide text-yellow-400">
                                Sugestão para IA
                              </p>
                              <p className="mt-1 text-sm font-semibold leading-relaxed text-yellow-400">
                                {customer.suggestedOffer}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenWhatsApp(customer)}
                            disabled={!customer.phone}
                            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-[#111111]"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Chamar
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div className="rounded-2xl bg-[#111111] p-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                              Pedidos
                            </p>
                            <p className="mt-1 text-base font-black text-white">
                              {customer.ordersCount}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-[#111111] p-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                              Gasto total
                            </p>
                            <p className="mt-1 text-base font-black text-white">
                              {formatMoney(customer.totalSpent)}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-[#111111] p-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                              Ticket médio
                            </p>
                            <p className="mt-1 text-base font-black text-white">
                              {formatMoney(customer.averageTicket)}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-red-50 p-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-red-500">
                              Sem comprar
                            </p>
                            <p className="mt-1 text-base font-black text-red-700">
                              {customer.daysInactive}d
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full rounded-3xl border border-dashed border-white/10 bg-[#111111] p-10 text-center">
                      <UserX className="mx-auto h-8 w-8 text-zinc-500" />
                      <p className="mt-3 text-sm font-bold text-zinc-500">
                        Nenhum cliente encontrado
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        Tente mudar o filtro de dias ou buscar por outro nome.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-400">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
                  <div>
                    <p className="font-black">Como usar essa aba</p>
                    <p className="mt-1 font-medium">
                      Priorize clientes com ticket médio alto, mais pedidos e
                      muitos dias sem comprar. Esta tela já deixa o contexto
                      organizado para a futura IA montar ofertas personalizadas
                      com base em histórico, produto preferido e chance de retorno.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}