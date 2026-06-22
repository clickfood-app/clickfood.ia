"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Armchair,
  Check,
  Clock3,
  CreditCard,
  Loader2,
  Minus,
  Pencil,
  Plus,
  QrCode,
  RefreshCcw,
  Search,
  ShoppingBag,
  Timer,
  Users,
  Wallet,
  X,
} from "lucide-react"

import AdminLayout from "@/components/admin-layout"
import { useAuth } from "@/components/auth/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { initialTables } from "@/lib/order-types"

type TableStatus = "available" | "occupied"

type PaymentMethod = "dinheiro" | "pix" | "credito" | "debito"

type TableView = {
  id: string
  number: string
  name: string
  capacity: number
  status: TableStatus
}

type RestaurantTableRow = {
  id: string
  restaurant_id: string
  number: string
  name: string | null
  capacity: number | null
  is_active: boolean | null
}

type OrderRow = {
  id: string
  public_order_number: string | number | null
  customer_name: string | null
  customer_phone: string | null
  status: string | null
  payment_status: string | null
  payment_method: string | null
  total: number | string | null
  notes: string | null
  table_id: string | null
  table_number: string | null
  guest_count: number | null
  created_at: string
}

type ProductRow = {
  id: string
  name: string
  price: number
  isAvailable: boolean
}

type SelectedProductItem = ProductRow & {
  quantity: number
  total: number
}

type TableWithOrders = TableView & {
  orders: OrderRow[]
  totalOpen: number
  totalAmount: number
  firstOrderAt: string | null
  latestOrderAt: string | null
  guestCount: number | null
  ticketPerPerson: number | null
  occupiedMinutes: number | null
  idleMinutes: number | null
  isIdle: boolean
}

const supabase = createClient()
const IDLE_LIMIT_MINUTES = 30

function normalizeStatus(status: string | null | undefined) {
  return (status || "").trim().toLowerCase()
}

function isUuid(value: string | null | undefined) {
  if (!value) return false

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function getStatusLabel(status: string | null | undefined) {
  const value = normalizeStatus(status)

  if (value === "pending") return "Pendente"
  if (value === "accepted") return "Aceito"
  if (value === "preparing") return "Preparando"
  if (value === "ready") return "Pronto"
  if (value === "delivering" || value === "out_for_delivery") return "Em rota"
  if (value === "delivered") return "Entregue"
  if (value === "finished" || value === "completed" || value === "finalizado") {
    return "Finalizado"
  }
  if (value === "cancelled" || value === "canceled" || value === "cancelado") {
    return "Cancelado"
  }

  return status || "Aberto"
}

function getOrderNumber(order: OrderRow) {
  if (order.public_order_number !== null && order.public_order_number !== undefined) {
    return String(order.public_order_number)
  }

  return order.id.slice(0, 8)
}

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatDuration(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return "—"

  const safeMinutes = Math.max(0, Math.floor(minutes))
  const hours = Math.floor(safeMinutes / 60)
  const mins = safeMinutes % 60

  if (hours <= 0) return `${mins}min`
  if (mins <= 0) return `${hours}h`

  return `${hours}h ${mins}min`
}

function minutesSince(date: string | null) {
  if (!date) return null

  const diff = Date.now() - new Date(date).getTime()

  return Math.max(0, Math.floor(diff / 60000))
}

function getErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message

  if (typeof error === "object") {
    const err = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }

    const parts = [
      err.message ? `message: ${err.message}` : "",
      err.details ? `details: ${err.details}` : "",
      err.hint ? `hint: ${err.hint}` : "",
      err.code ? `code: ${err.code}` : "",
    ].filter(Boolean)

    if (parts.length > 0) return parts.join(" | ")

    try {
      return JSON.stringify(error)
    } catch {
      return fallback
    }
  }

  return fallback
}

function extractTableNumberFromNotes(notes: string | null | undefined) {
  if (!notes) return null

  const match = notes.match(/mesa:\s*([^\n|]+)/i)

  if (!match?.[1]) return null

  return match[1].trim()
}

function buildInitialTables(): TableView[] {
  const parsedTables = (initialTables || []).map((table, index) => {
    const rawTable = table as unknown as {
      id?: string
      number?: string | number
      name?: string
      capacity?: number
      status?: string
    }

    const number = String(rawTable.number || index + 1)

    return {
      id: String(rawTable.id || `table-${number}`),
      number,
      name: rawTable.name || `Mesa ${number}`,
      capacity: Number(rawTable.capacity || 4),
      status: "available" as TableStatus,
    }
  })

  if (parsedTables.length > 0) {
    return parsedTables
  }

  return Array.from({ length: 12 }).map((_, index) => {
    const number = String(index + 1)

    return {
      id: `table-${number}`,
      number,
      name: `Mesa ${number}`,
      capacity: 4,
      status: "available" as TableStatus,
    }
  })
}

function mapRestaurantTableToTable(table: RestaurantTableRow): TableView {
  return {
    id: table.id,
    number: String(table.number),
    name: table.name || `Mesa ${table.number}`,
    capacity: Number(table.capacity || 4),
    status: "available",
  }
}

function mergeTables(defaultTables: TableView[], databaseTables: TableView[]) {
  const map = new Map<string, TableView>()

  defaultTables.forEach((table) => {
    map.set(table.number, table)
  })

  databaseTables.forEach((table) => {
    map.set(table.number, table)
  })

  return Array.from(map.values()).sort((a, b) => {
    const aNumber = Number(a.number)
    const bNumber = Number(b.number)

    if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) {
      return aNumber - bNumber
    }

    return a.number.localeCompare(b.number)
  })
}

function getPaymentMethodLabel(method: PaymentMethod) {
  if (method === "dinheiro") return "Dinheiro"
  if (method === "pix") return "Pix"
  if (method === "credito") return "Crédito"
  if (method === "debito") return "Débito"

  return method
}

function normalizeProduct(raw: Record<string, unknown>): ProductRow | null {
  const id = String(raw.id || "")
  const name = String(raw.name || raw.product_name || "").trim()
  const price = Number(raw.price || raw.sale_price || raw.value || 0)
  const status = normalizeStatus(String(raw.status || ""))

  if (!id || !name) return null

  const isAvailable =
    raw.is_available !== false &&
    raw.is_active !== false &&
    status !== "inactive" &&
    status !== "inativo" &&
    status !== "unavailable" &&
    status !== "indisponivel"

  return {
    id,
    name,
    price,
    isAvailable,
  }
}

function generatePublicOrderNumber() {
  return String(Date.now()).slice(-6)
}

export default function MesasPage() {
  const { restaurant, isLoading: authLoading } = useAuth()

  const [orders, setOrders] = useState<OrderRow[]>([])
  const [databaseTables, setDatabaseTables] = useState<TableView[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [paying, setPaying] = useState(false)
  const [savingTable, setSavingTable] = useState(false)
  const [savingGuests, setSavingGuests] = useState(false)
  const [savingItems, setSavingItems] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [selectedTableToPay, setSelectedTableToPay] =
    useState<TableWithOrders | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>("pix")

  const [tableEditModalOpen, setTableEditModalOpen] = useState(false)
  const [selectedTableToEdit, setSelectedTableToEdit] =
    useState<TableWithOrders | null>(null)
  const [editTableName, setEditTableName] = useState("")
  const [editTableCapacity, setEditTableCapacity] = useState(4)

  const [guestModalOpen, setGuestModalOpen] = useState(false)
  const [selectedTableToAdjustGuests, setSelectedTableToAdjustGuests] =
    useState<TableWithOrders | null>(null)
  const [editGuestCount, setEditGuestCount] = useState(1)

  const [addItemsModalOpen, setAddItemsModalOpen] = useState(false)
  const [selectedTableToAddItems, setSelectedTableToAddItems] =
    useState<TableWithOrders | null>(null)
  const [selectedProductQuantities, setSelectedProductQuantities] = useState<
    Record<string, number>
  >({})
  const [productSearch, setProductSearch] = useState("")

  const defaultTables = useMemo(() => buildInitialTables(), [])

  const baseTables = useMemo(() => {
    return mergeTables(defaultTables, databaseTables)
  }, [defaultTables, databaseTables])

  async function loadData(showRefresh = false) {
    if (!restaurant?.id) return

    try {
      if (showRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError(null)

      const [
        { data: ordersData, error: ordersError },
        { data: tablesData, error: tablesError },
        { data: productsData, error: productsError },
      ] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id, public_order_number, customer_name, customer_phone, status, payment_status, payment_method, total, notes, table_id, table_number, guest_count, created_at"
          )
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false })
          .limit(300),

        supabase
          .from("restaurant_tables")
          .select("id, restaurant_id, number, name, capacity, is_active")
          .eq("restaurant_id", restaurant.id)
          .eq("is_active", true),

        supabase
          .from("products")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("name", { ascending: true }),
      ])

      if (ordersError) throw ordersError
      if (tablesError) throw tablesError
      if (productsError) throw productsError

      setOrders((ordersData || []) as OrderRow[])
      setDatabaseTables(
        ((tablesData || []) as RestaurantTableRow[]).map(mapRestaurantTableToTable)
      )
      setProducts(
        ((productsData || []) as Record<string, unknown>[])
          .map(normalizeProduct)
          .filter((product): product is ProductRow => Boolean(product))
      )
      setLastUpdatedAt(new Date())
    } catch (err) {
      console.error("Erro ao buscar mesas/comandas:", err)
      setError(getErrorMessage(err, "Erro ao buscar mesas/comandas."))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (authLoading) return

    if (!restaurant?.id) {
      setLoading(false)
      return
    }

    void loadData()
  }, [authLoading, restaurant?.id])

  const openLocalOrders = useMemo(() => {
    return orders.filter((order) => {
      const tableNumber =
        order.table_number || extractTableNumberFromNotes(order.notes)
      const paymentStatus = normalizeStatus(order.payment_status)

      return (order.table_id || tableNumber) && paymentStatus !== "paid"
    })
  }, [orders])

  const tablesWithOrders = useMemo<TableWithOrders[]>(() => {
    return baseTables.map((table) => {
      const tableOrders = openLocalOrders.filter((order) => {
        const noteTableNumber = extractTableNumberFromNotes(order.notes)

        return (
          order.table_id === table.id ||
          order.table_number === table.number ||
          noteTableNumber === table.number ||
          noteTableNumber === table.id
        )
      })

      const totalAmount = tableOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      )

      const sortedOldestFirst = [...tableOrders].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )

      const sortedNewestFirst = [...tableOrders].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      const firstOrderAt = sortedOldestFirst[0]?.created_at || null
      const latestOrderAt = sortedNewestFirst[0]?.created_at || null

      const latestGuestOrder = sortedNewestFirst.find(
        (order) => Number(order.guest_count || 0) > 0
      )

      const guestCount = latestGuestOrder
        ? Number(latestGuestOrder.guest_count || 0)
        : null

      const ticketPerPerson =
        guestCount && guestCount > 0 ? totalAmount / guestCount : null

      const occupiedMinutes = minutesSince(firstOrderAt)
      const idleMinutes = minutesSince(latestOrderAt)

      return {
        ...table,
        status: tableOrders.length > 0 ? "occupied" : "available",
        orders: tableOrders,
        totalOpen: tableOrders.length,
        totalAmount,
        firstOrderAt,
        latestOrderAt,
        guestCount,
        ticketPerPerson,
        occupiedMinutes,
        idleMinutes,
        isIdle:
          tableOrders.length > 0 &&
          idleMinutes !== null &&
          idleMinutes >= IDLE_LIMIT_MINUTES,
      }
    })
  }, [baseTables, openLocalOrders])

  const filteredTables = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return tablesWithOrders

    return tablesWithOrders.filter((table) => {
      const orderNumbers = table.orders
        .map((order) => getOrderNumber(order))
        .join(" ")
        .toLowerCase()

      const customers = table.orders
        .map((order) => order.customer_name || "")
        .join(" ")
        .toLowerCase()

      return (
        table.number.toLowerCase().includes(query) ||
        table.name.toLowerCase().includes(query) ||
        orderNumbers.includes(query) ||
        customers.includes(query)
      )
    })
  }, [search, tablesWithOrders])

  const totalTables = tablesWithOrders.length
  const occupiedTables = tablesWithOrders.filter(
    (table) => table.status === "occupied"
  ).length
  const idleTables = tablesWithOrders.filter((table) => table.isIdle).length
  const availableTables = totalTables - occupiedTables
  const totalOpenOrders = openLocalOrders.length
  const totalConsumption = openLocalOrders.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0
  )

  const availableProducts = useMemo(() => {
    return products.filter((product) => product.isAvailable)
  }, [products])

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase()

    if (!query) return availableProducts

    return availableProducts.filter((product) =>
      product.name.toLowerCase().includes(query)
    )
  }, [availableProducts, productSearch])

  const selectedAddItems = useMemo<SelectedProductItem[]>(() => {
    return availableProducts
      .map((product) => {
        const quantity = Number(selectedProductQuantities[product.id] || 0)

        return {
          ...product,
          quantity,
          total: quantity * product.price,
        }
      })
      .filter((item) => item.quantity > 0)
  }, [availableProducts, selectedProductQuantities])

  const selectedAddItemsTotal = selectedAddItems.reduce(
    (sum, item) => sum + item.total,
    0
  )

  function openPaymentModal(table: TableWithOrders) {
    setSelectedTableToPay(table)
    setSelectedPaymentMethod("pix")
    setPaymentModalOpen(true)
    setError(null)
  }

  function closePaymentModal() {
    if (paying) return

    setPaymentModalOpen(false)
    setSelectedTableToPay(null)
    setSelectedPaymentMethod("pix")
  }

  function openTableEditModal(table: TableWithOrders) {
    setSelectedTableToEdit(table)
    setEditTableName(table.name)
    setEditTableCapacity(table.capacity || 4)
    setTableEditModalOpen(true)
    setError(null)
  }

  function closeTableEditModal() {
    if (savingTable) return

    setSelectedTableToEdit(null)
    setEditTableName("")
    setEditTableCapacity(4)
    setTableEditModalOpen(false)
  }

  function openGuestModal(table: TableWithOrders) {
    setSelectedTableToAdjustGuests(table)
    setEditGuestCount(table.guestCount || 1)
    setGuestModalOpen(true)
    setError(null)
  }

  function closeGuestModal() {
    if (savingGuests) return

    setSelectedTableToAdjustGuests(null)
    setEditGuestCount(1)
    setGuestModalOpen(false)
  }

  function openAddItemsModal(table: TableWithOrders) {
    setSelectedTableToAddItems(table)
    setSelectedProductQuantities({})
    setProductSearch("")
    setAddItemsModalOpen(true)
    setError(null)
  }

  function closeAddItemsModal() {
    if (savingItems) return

    setSelectedTableToAddItems(null)
    setSelectedProductQuantities({})
    setProductSearch("")
    setAddItemsModalOpen(false)
  }

  function updateProductQuantity(productId: string, quantity: number) {
    setSelectedProductQuantities((prev) => {
      const nextQuantity = Math.max(0, quantity)
      const next = { ...prev }

      if (nextQuantity <= 0) {
        delete next[productId]
      } else {
        next[productId] = nextQuantity
      }

      return next
    })
  }

  async function handleAddItemsToTable() {
    if (!selectedTableToAddItems || !restaurant?.id) return

    if (selectedAddItems.length === 0) {
      setError("Selecione pelo menos um item para adicionar na comanda.")
      return
    }

    try {
      setSavingItems(true)
      setError(null)

      const nowIso = new Date().toISOString()
      const guestCount = selectedTableToAddItems.guestCount || 1
      const customerName =
        selectedTableToAddItems.orders[0]?.customer_name ||
        `Mesa ${selectedTableToAddItems.number}`
      const customerPhone =
        selectedTableToAddItems.orders[0]?.customer_phone || "Não informado"
      const notes = `Pedido local | Mesa: ${selectedTableToAddItems.number} | Pessoas: ${guestCount}`

      const { data: createdOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          restaurant_id: restaurant.id,
          public_order_number: generatePublicOrderNumber(),
          customer_name: customerName,
          customer_phone: customerPhone,
          status: "accepted",
          payment_status: "pending",
          payment_method: null,
          subtotal: selectedAddItemsTotal,
          discount: 0,
          delivery_fee: 0,
          total: selectedAddItemsTotal,
          notes,
          table_id: isUuid(selectedTableToAddItems.id)
            ? selectedTableToAddItems.id
            : null,
          table_number: selectedTableToAddItems.number,
          guest_count: guestCount,
          accepted_at: nowIso,
          preparation_started_at: nowIso,
        })
        .select(
          "id, public_order_number, customer_name, customer_phone, status, payment_status, payment_method, total, notes, table_id, table_number, guest_count, created_at"
        )
        .single()

      if (orderError) throw orderError
      if (!createdOrder) throw new Error("Pedido criado sem retorno do banco.")

      const orderItems = selectedAddItems.map((item) => ({
        order_id: createdOrder.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.total,
      }))

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems)

      if (itemsError) throw itemsError

      setOrders((prev) => [createdOrder as OrderRow, ...prev])
      closeAddItemsModal()
      setLastUpdatedAt(new Date())
    } catch (err) {
      console.error("Erro ao adicionar itens na comanda:", err)
      setError(getErrorMessage(err, "Erro ao adicionar itens na comanda."))
    } finally {
      setSavingItems(false)
    }
  }

  async function handlePayTable() {
    if (!selectedTableToPay) return

    const orderIds = selectedTableToPay.orders.map((order) => order.id)

    if (orderIds.length === 0) {
      setError("Não existem pedidos abertos para pagar nessa mesa.")
      return
    }

    try {
      setPaying(true)
      setError(null)

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          payment_method: selectedPaymentMethod,
        })
        .in("id", orderIds)

      if (updateError) throw updateError

      setOrders((prev) =>
        prev.map((order) =>
          orderIds.includes(order.id)
            ? {
                ...order,
                payment_status: "paid",
                payment_method: selectedPaymentMethod,
              }
            : order
        )
      )

      setPaymentModalOpen(false)
      setSelectedTableToPay(null)
      setSelectedPaymentMethod("pix")
      setLastUpdatedAt(new Date())
    } catch (err) {
      console.error("Erro ao pagar comanda:", err)
      setError(getErrorMessage(err, "Erro ao pagar comanda."))
    } finally {
      setPaying(false)
    }
  }

  async function handleSaveTableEdit() {
    if (!selectedTableToEdit || !restaurant?.id) return

    const name = editTableName.trim() || `Mesa ${selectedTableToEdit.number}`
    const capacity = Math.max(1, Number(editTableCapacity || 1))

    try {
      setSavingTable(true)
      setError(null)

      if (isUuid(selectedTableToEdit.id)) {
        const { data, error: updateError } = await supabase
          .from("restaurant_tables")
          .update({
            name,
            capacity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedTableToEdit.id)
          .eq("restaurant_id", restaurant.id)
          .select("id, restaurant_id, number, name, capacity, is_active")
          .single()

        if (updateError) throw updateError

        const updatedTable = mapRestaurantTableToTable(data as RestaurantTableRow)

        setDatabaseTables((prev) =>
          mergeTables(
            prev.filter((table) => table.id !== updatedTable.id),
            [updatedTable]
          )
        )
      } else {
        const { data, error: insertError } = await supabase
          .from("restaurant_tables")
          .insert({
            restaurant_id: restaurant.id,
            number: selectedTableToEdit.number,
            name,
            capacity,
            is_active: true,
          })
          .select("id, restaurant_id, number, name, capacity, is_active")
          .single()

        if (insertError) throw insertError

        const createdTable = mapRestaurantTableToTable(data as RestaurantTableRow)

        setDatabaseTables((prev) => mergeTables(prev, [createdTable]))
      }

      closeTableEditModal()
      setLastUpdatedAt(new Date())
    } catch (err) {
      console.error("Erro ao editar mesa:", err)
      setError(getErrorMessage(err, "Erro ao editar mesa."))
    } finally {
      setSavingTable(false)
    }
  }

  async function handleSaveGuestCount() {
    if (!selectedTableToAdjustGuests) return

    const orderIds = selectedTableToAdjustGuests.orders.map((order) => order.id)

    if (orderIds.length === 0) {
      setError("Essa mesa não possui comanda aberta para ajustar pessoas.")
      return
    }

    const guestCount = Math.max(1, Number(editGuestCount || 1))

    try {
      setSavingGuests(true)
      setError(null)

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          guest_count: guestCount,
        })
        .in("id", orderIds)

      if (updateError) throw updateError

      setOrders((prev) =>
        prev.map((order) =>
          orderIds.includes(order.id)
            ? {
                ...order,
                guest_count: guestCount,
              }
            : order
        )
      )

      closeGuestModal()
      setLastUpdatedAt(new Date())
    } catch (err) {
      console.error("Erro ao ajustar pessoas:", err)
      setError(getErrorMessage(err, "Erro ao ajustar pessoas."))
    } finally {
      setSavingGuests(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Mesas
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe mesas livres, comandas abertas, pessoas e pagamentos do salão.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              {lastUpdatedAt
                ? `Atualizado às ${lastUpdatedAt.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}`
                : "Aguardando dados"}
            </div>

            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={refreshing}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
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

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Total de mesas
            </p>
            <p className="mt-2 text-2xl font-black text-foreground">
              {loading ? "..." : totalTables}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-300/80">
              Livres
            </p>
            <p className="mt-2 text-2xl font-black text-emerald-300">
              {loading ? "..." : availableTables}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-300/80">
              Ocupadas
            </p>
            <p className="mt-2 text-2xl font-black text-amber-300">
              {loading ? "..." : occupiedTables}
            </p>
          </div>

          <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-300/80">
              Ociosas
            </p>
            <p className="mt-2 text-2xl font-black text-orange-300">
              {loading ? "..." : idleTables}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Pedidos na comanda
            </p>
            <p className="mt-2 text-2xl font-black text-foreground">
              {loading ? "..." : totalOpenOrders}
            </p>
          </div>

          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-300/80">
              A receber
            </p>
            <p className="mt-2 text-2xl font-black text-violet-300">
              {loading ? "..." : formatCurrency(totalConsumption)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-black text-foreground">
                  Comandas por mesa
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  A mesa só libera quando a comanda for paga.
                </p>
              </div>

              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar mesa, cliente ou pedido..."
                  className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-border bg-background text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando mesas...
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background px-6 text-center">
                <Armchair className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-bold text-foreground">
                  Nenhuma mesa encontrada
                </p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Tente buscar por outro número de mesa, cliente ou pedido.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredTables.map((table) => {
                  const isOccupied = table.status === "occupied"

                  return (
                    <div
                      key={table.id}
                      className={`rounded-2xl border p-4 transition ${
                        isOccupied
                          ? table.isIdle
                            ? "border-orange-500/40 bg-orange-500/10"
                            : "border-amber-500/40 bg-amber-500/10"
                          : "border-emerald-400/40 bg-[#0b1728]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                              isOccupied
                                ? table.isIdle
                                  ? "bg-orange-500/15 text-orange-300"
                                  : "bg-amber-500/15 text-amber-300"
                                : "bg-emerald-500/15 text-emerald-300"
                            }`}
                          >
                            <Armchair className="h-5 w-5" />
                          </div>

                          <div>
                            <h3 className="text-lg font-black text-foreground">
                              Mesa {table.number}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {table.name} • Capacidade: {table.capacity}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                            isOccupied
                              ? table.isIdle
                                ? "bg-orange-500/15 text-orange-300"
                                : "bg-amber-500/15 text-amber-300"
                              : "bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {isOccupied ? (table.isIdle ? "Ociosa" : "Ocupada") : "Livre"}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => openTableEditModal(table)}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-foreground transition hover:bg-white/10"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar mesa
                        </button>

                        {isOccupied ? (
                          <button
                            type="button"
                            onClick={() => openGuestModal(table)}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-foreground transition hover:bg-white/10"
                          >
                            <Users className="h-3.5 w-3.5" />
                            Pessoas
                          </button>
                        ) : null}

                        {isOccupied ? (
                          <button
                            type="button"
                            onClick={() => openAddItemsModal(table)}
                            className="col-span-2 inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary text-xs font-black text-primary-foreground transition hover:opacity-90"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Adicionar itens
                          </button>
                        ) : null}
                      </div>

                      {isOccupied ? (
                        <div className="mt-4 space-y-3">
                          {table.isIdle ? (
                            <div className="flex items-start gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-200">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                              <div>
                                <p className="font-black">Possível mesa ociosa</p>
                                <p className="mt-0.5">
                                  Sem novo pedido há {formatDuration(table.idleMinutes)}.
                                </p>
                              </div>
                            </div>
                          ) : null}

                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                Pessoas
                              </p>
                              <p className="mt-1 text-xl font-black text-foreground">
                                {table.guestCount || "—"}
                              </p>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                Ticket/pessoa
                              </p>
                              <p className="mt-1 text-lg font-black text-foreground">
                                {table.ticketPerPerson
                                  ? formatCurrency(table.ticketPerPerson)
                                  : "—"}
                              </p>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                Ocupada há
                              </p>
                              <p className="mt-1 text-lg font-black text-foreground">
                                {formatDuration(table.occupiedMinutes)}
                              </p>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                Total
                              </p>
                              <p className="mt-1 text-lg font-black text-foreground">
                                {formatCurrency(table.totalAmount)}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                Pedidos vinculados
                              </p>

                              {table.latestOrderAt ? (
                                <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                                  <Timer className="h-3 w-3" />
                                  Último {formatTime(table.latestOrderAt)}
                                </p>
                              ) : null}
                            </div>

                            <div className="mt-3 space-y-2">
                              {table.orders.map((order) => (
                                <div
                                  key={order.id}
                                  className="rounded-xl border border-border bg-background px-3 py-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-black text-foreground">
                                      #{getOrderNumber(order)}
                                    </p>
                                    <p className="text-sm font-black text-foreground">
                                      {formatCurrency(order.total)}
                                    </p>
                                  </div>

                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span>
                                      {order.customer_name || "Cliente balcão"}
                                    </span>
                                    <span>•</span>
                                    <span>{getStatusLabel(order.status)}</span>
                                    <span>•</span>
                                    <span>Pagamento pendente</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => openPaymentModal(table)}
                            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700"
                          >
                            <Wallet className="h-4 w-4" />
                            Pagar comanda
                          </button>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl border border-emerald-400/30 bg-white/5 p-4 text-center">
                          <p className="text-sm font-bold text-emerald-300">
                            Mesa disponível
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Nenhuma comanda em aberto nesta mesa.
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {paymentModalOpen && selectedTableToPay ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-foreground">
                  Pagar comanda - Mesa {selectedTableToPay.number}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Selecione a forma de pagamento usada pelo cliente.
                </p>
              </div>

              <button
                type="button"
                onClick={closePaymentModal}
                disabled={paying}
                className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-5 rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Total da comanda
              </p>
              <p className="mt-1 text-3xl font-black text-foreground">
                {formatCurrency(selectedTableToPay.totalAmount)}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {selectedTableToPay.orders.map((order) => (
                  <span
                    key={order.id}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-foreground"
                  >
                    #{getOrderNumber(order)}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedPaymentMethod("dinheiro")}
                className={`rounded-2xl border p-4 text-left transition ${
                  selectedPaymentMethod === "dinheiro"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <Wallet className="mb-2 h-5 w-5" />
                <p className="text-sm font-black">Dinheiro</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPaymentMethod("pix")}
                className={`rounded-2xl border p-4 text-left transition ${
                  selectedPaymentMethod === "pix"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <QrCode className="mb-2 h-5 w-5" />
                <p className="text-sm font-black">Pix</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPaymentMethod("debito")}
                className={`rounded-2xl border p-4 text-left transition ${
                  selectedPaymentMethod === "debito"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <CreditCard className="mb-2 h-5 w-5" />
                <p className="text-sm font-black">Débito</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPaymentMethod("credito")}
                className={`rounded-2xl border p-4 text-left transition ${
                  selectedPaymentMethod === "credito"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <CreditCard className="mb-2 h-5 w-5" />
                <p className="text-sm font-black">Crédito</p>
              </button>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closePaymentModal}
                disabled={paying}
                className="h-11 rounded-xl border border-border px-5 text-sm font-bold text-foreground transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void handlePayTable()}
                disabled={paying}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {paying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Confirmar pagamento em {getPaymentMethodLabel(selectedPaymentMethod)}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tableEditModalOpen && selectedTableToEdit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-foreground">
                  Editar Mesa {selectedTableToEdit.number}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Altere o nome e a capacidade da mesa.
                </p>
              </div>

              <button
                type="button"
                onClick={closeTableEditModal}
                disabled={savingTable}
                className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-foreground">
                  Nome da mesa
                </label>
                <input
                  type="text"
                  value={editTableName}
                  onChange={(event) => setEditTableName(event.target.value)}
                  placeholder={`Mesa ${selectedTableToEdit.number}`}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold text-foreground">
                  Capacidade
                </label>
                <input
                  type="number"
                  min={1}
                  value={editTableCapacity}
                  onChange={(event) =>
                    setEditTableCapacity(
                      Math.max(1, Number(event.target.value || 1))
                    )
                  }
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeTableEditModal}
                disabled={savingTable}
                className="h-11 rounded-xl border border-border px-5 text-sm font-bold text-foreground transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void handleSaveTableEdit()}
                disabled={savingTable}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingTable ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Salvar mesa
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addItemsModalOpen && selectedTableToAddItems ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
            <div className="border-b border-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-foreground">
                    Adicionar itens - Mesa {selectedTableToAddItems.number}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Crie um novo lançamento dentro da mesma comanda.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeAddItemsModal}
                  disabled={savingItems}
                  className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Buscar produto..."
                    className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-violet-300/80">
                    Total novo
                  </p>
                  <p className="text-lg font-black text-violet-300">
                    {formatCurrency(selectedAddItemsTotal)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {availableProducts.length === 0 ? (
                <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 text-center">
                  <ShoppingBag className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-black text-foreground">
                    Nenhum produto disponível
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Cadastre produtos ativos no cardápio para adicionar itens na comanda.
                  </p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 text-center">
                  <Search className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-black text-foreground">
                    Nenhum produto encontrado
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Tente buscar por outro nome.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredProducts.map((product) => {
                    const quantity = selectedProductQuantities[product.id] || 0

                    return (
                      <div
                        key={product.id}
                        className={`rounded-2xl border p-3 transition ${
                          quantity > 0
                            ? "border-primary bg-primary/5"
                            : "border-border bg-background"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-foreground">
                              {product.name}
                            </p>
                            <p className="mt-1 text-sm font-bold text-muted-foreground">
                              {formatCurrency(product.price)}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateProductQuantity(product.id, quantity - 1)
                              }
                              disabled={quantity <= 0}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>

                            <span className="w-7 text-center text-sm font-black text-foreground">
                              {quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                updateProductQuantity(product.id, quantity + 1)
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-border p-5">
              {selectedAddItems.length > 0 ? (
                <div className="mb-4 rounded-2xl border border-border bg-muted/20 p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Itens selecionados
                  </p>

                  <div className="space-y-1">
                    {selectedAddItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="font-semibold text-foreground">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="font-black text-foreground">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeAddItemsModal}
                  disabled={savingItems}
                  className="h-11 rounded-xl border border-border px-5 text-sm font-bold text-foreground transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => void handleAddItemsToTable()}
                  disabled={savingItems || selectedAddItems.length === 0}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingItems ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Adicionar à comanda
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {guestModalOpen && selectedTableToAdjustGuests ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-foreground">
                  Pessoas - Mesa {selectedTableToAdjustGuests.number}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajuste a quantidade de pessoas na comanda.
                </p>
              </div>

              <button
                type="button"
                onClick={closeGuestModal}
                disabled={savingGuests}
                className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <label className="mb-3 block text-sm font-bold text-foreground">
                Quantidade de pessoas
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditGuestCount((prev) => Math.max(1, prev - 1))}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-lg font-black transition hover:bg-muted"
                >
                  -
                </button>

                <input
                  type="number"
                  min={1}
                  value={editGuestCount}
                  onChange={(event) =>
                    setEditGuestCount(
                      Math.max(1, Number(event.target.value || 1))
                    )
                  }
                  className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-center text-lg font-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />

                <button
                  type="button"
                  onClick={() => setEditGuestCount((prev) => prev + 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-lg font-black transition hover:bg-muted"
                >
                  +
                </button>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Isso recalcula o ticket médio por pessoa dessa mesa.
              </p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeGuestModal}
                disabled={savingGuests}
                className="h-11 rounded-xl border border-border px-5 text-sm font-bold text-foreground transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void handleSaveGuestCount()}
                disabled={savingGuests}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingGuests ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Salvar pessoas
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  )
}