"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChefHat,
  Clock3,
  Loader2,
  PackageCheck,
  RefreshCcw,
  Search,
  Timer,
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
  restaurant_id: string
  public_order_number?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_address?: string | null
  customer_neighborhood?: string | null
  table_number?: string | number | null
  guest_count?: number | string | null
  status?: string | null
  payment_status?: string | null
  payment_method?: string | null
  order_type?: string | null
  delivery_type?: string | null
  notes?: string | null
  total?: number | string | null
  created_at?: string | null
  updated_at?: string | null
  waiter_name?: string | null
  order_source?: string | null
  [key: string]: unknown
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
  unit_price?: number | string | null
  price?: number | string | null
  total_price?: number | string | null
  subtotal?: number | string | null
  notes?: string | null
  observation?: string | null
  created_at?: string | null
  [key: string]: unknown
}

type KitchenGroup = "preparing" | "ready"

type KitchenOrder = OrderRecord & {
  items: OrderItemRecord[]
  elapsedMinutes: number
  group: KitchenGroup
}

type ItemDetails = {
  name: string
  modifiers: string[]
  observation: string
}

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

const preparingStatuses = new Set([
  "preparing",
  "em_preparo",
  "in_preparation",
  "preparo",
  "accepted",
  "approved",
  "confirmed",
  "aceito",
  "aprovado",
  "confirmado",
])

const readyStatuses = new Set(["ready", "pronto", "done", "prepared"])

const cancelledStatuses = new Set([
  "cancelled",
  "canceled",
  "cancelado",
])

const finishedStatuses = new Set([
  "delivered",
  "entregue",
  "completed",
  "finalizado",
  "finished",
])

const scrollbarClassName =
  "[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,.75)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#111111]"

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

function formatMoney(value: unknown) {
  const number = toNumber(value)
  return moneyFormatter.format(Number.isFinite(number) ? number : 0)
}

function normalizeText(value: unknown) {
  return String(value || "").toLowerCase().trim()
}

function normalizeStatus(status?: string | null) {
  return normalizeText(status)
}

function normalizePaymentStatus(status?: string | null) {
  return normalizeText(status)
}

function normalizePaymentMethod(method?: string | null) {
  return normalizeText(method)
}

function getRawItemName(item: OrderItemRecord) {
  return (
    String(item.product_name || "").trim() ||
    String(item.name || "").trim() ||
    String(item.item_name || "").trim() ||
    String(item.title || "").trim() ||
    "Produto sem nome"
  )
}

function getItemQuantity(item: OrderItemRecord) {
  return toNumber(item.quantity) || toNumber(item.qty) || toNumber(item.amount) || 1
}

function parseMaybeJson(value: unknown) {
  if (typeof value !== "string") return value

  const trimmed = value.trim()

  if (!trimmed) return value

  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    return value
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function extractModifierNames(value: unknown): string[] {
  const parsed = parseMaybeJson(value)

  if (!parsed) return []

  if (typeof parsed === "string") {
    const trimmed = parsed.trim()
    return trimmed ? [trimmed] : []
  }

  if (Array.isArray(parsed)) {
    return parsed
      .flatMap((item) => {
        if (!item) return []

        if (typeof item === "string") {
          return item.trim() ? [item.trim()] : []
        }

        if (typeof item === "object") {
          const record = item as Record<string, unknown>

          const name =
            String(record.option_name || "").trim() ||
            String(record.name || "").trim() ||
            String(record.title || "").trim() ||
            String(record.label || "").trim()

          return name ? [name] : []
        }

        return []
      })
      .filter(Boolean)
  }

  if (typeof parsed === "object") {
    const record = parsed as Record<string, unknown>

    const name =
      String(record.option_name || "").trim() ||
      String(record.name || "").trim() ||
      String(record.title || "").trim() ||
      String(record.label || "").trim()

    return name ? [name] : []
  }

  return []
}

function getItemDetails(item: OrderItemRecord): ItemDetails {
  const rawName = getRawItemName(item)
  let name = rawName
  const modifiers = new Set<string>()

  const parenthesisMatch = rawName.match(/^(.*?)\s*\(([^()]*)\)\s*$/)

  if (parenthesisMatch) {
    name = parenthesisMatch[1].trim() || rawName

    parenthesisMatch[2]
      .split(",")
      .map((modifier) => modifier.trim())
      .filter(Boolean)
      .forEach((modifier) => modifiers.add(modifier))
  }

  const possibleModifierFields = [
    item.modifiers,
    item.selected_modifiers,
    item.options,
    item.addons,
    item.complements,
    item.extras,
    item.modifier_options,
  ]

  possibleModifierFields.forEach((field) => {
    extractModifierNames(field).forEach((modifier) => modifiers.add(modifier))
  })

  const observation =
    String(item.notes || "").trim() ||
    String(item.observation || "").trim() ||
    String(item.item_notes || "").trim() ||
    String(item.special_instructions || "").trim()

  return {
    name,
    modifiers: Array.from(modifiers),
    observation,
  }
}

function getOrderNumber(order: OrderRecord) {
  if (order.public_order_number) return `#${order.public_order_number}`

  return `#${order.id.slice(0, 8).toUpperCase()}`
}

function isCanceledStatus(status?: string | null) {
  return cancelledStatuses.has(normalizeStatus(status))
}

function isFinishedStatus(status?: string | null) {
  return finishedStatuses.has(normalizeStatus(status))
}

function isWaiterOrTableOrder(order: OrderRecord) {
  const source = normalizeText(order.order_source)
  const paymentMethod = normalizePaymentMethod(order.payment_method)

  return Boolean(
    source === "waiter" ||
      source === "garcom" ||
      paymentMethod === "mesa" ||
      order.table_number,
  )
}

function getKitchenGroup(order: OrderRecord): KitchenGroup | null {
  const normalized = normalizeStatus(order.status)

  if (readyStatuses.has(normalized)) return "ready"
  if (preparingStatuses.has(normalized)) return "preparing"

  if (
    isWaiterOrTableOrder(order) &&
    ["pending", "analysis", "em_analise", "aguardando"].includes(normalized)
  ) {
    return "preparing"
  }

  return null
}

function shouldShowOrderOnKds(order: OrderRecord) {
  if (isCanceledStatus(order.status)) return false
  if (isFinishedStatus(order.status)) return false

  const group = getKitchenGroup(order)

  if (!group) return false

  const paymentMethod = normalizePaymentMethod(order.payment_method)
  const paymentStatus = normalizePaymentStatus(order.payment_status)
  const isPix = paymentMethod.includes("pix")

  if (isPix && paymentStatus !== "paid") {
    return false
  }

  return true
}

function getElapsedMinutes(createdAt?: string | null) {
  if (!createdAt) return 0

  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) return 0

  const diff = Date.now() - date.getTime()

  return Math.max(0, Math.floor(diff / (1000 * 60)))
}

function getElapsedLabel(minutes: number) {
  if (minutes < 60) return `${minutes}min`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  return `${hours}h ${rest}min`
}

function getOrderTimeLabel(createdAt?: string | null) {
  if (!createdAt) return ""

  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) return ""

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getOrderTypeLabel(order: OrderRecord) {
  const type = normalizeText(order.order_type || order.delivery_type)

  if (order.table_number) return `Mesa ${order.table_number}`
  if (type.includes("delivery")) return "Delivery"
  if (type.includes("retirada") || type.includes("pickup")) return "Retirada"
  if (type.includes("local")) return "No local"

  return "Pedido"
}

function getCustomerLine(order: OrderRecord) {
  const parts = [getOrderTypeLabel(order)]

  if (order.waiter_name) parts.push(`Garçom: ${order.waiter_name}`)
  if (!order.table_number && order.customer_name) parts.push(order.customer_name)
  if (order.customer_neighborhood) parts.push(order.customer_neighborhood)

  return parts.join(" • ")
}

function orderMatchesSearch(order: KitchenOrder, searchTerm: string) {
  const search = searchTerm.toLowerCase().trim()

  if (!search) return true

  const matchesOrder =
    getOrderNumber(order).toLowerCase().includes(search) ||
    String(order.customer_name || "").toLowerCase().includes(search) ||
    String(order.waiter_name || "").toLowerCase().includes(search) ||
    String(order.table_number || "").toLowerCase().includes(search) ||
    String(order.notes || "").toLowerCase().includes(search)

  const matchesItems = order.items.some((item) => {
    const details = getItemDetails(item)

    return (
      details.name.toLowerCase().includes(search) ||
      details.modifiers.some((modifier) => modifier.toLowerCase().includes(search)) ||
      details.observation.toLowerCase().includes(search)
    )
  })

  return matchesOrder || matchesItems
}

type KitchenOrderCardProps = {
  order: KitchenOrder
  index?: number
  mode: KitchenGroup
  updatingOrderId: string | null
  onUpdateStatus: (order: KitchenOrder, nextStatus: string) => void
}

function KitchenOrderCard({
  order,
  index,
  mode,
  updatingOrderId,
  onUpdateStatus,
}: KitchenOrderCardProps) {
  const isLate = order.elapsedMinutes >= 30
  const isUpdating = updatingOrderId === order.id
  const orderTime = getOrderTimeLabel(order.created_at)

  return (
    <article
      className={cn(
        "rounded-lg border bg-[#0A0A0A] shadow-sm",
        isLate && mode === "preparing"
          ? "border-red-300 ring-2 ring-red-100"
          : "border-white/10",
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {typeof index === "number" ? (
              <span className="rounded bg-[#050505] px-2 py-1 text-[11px] font-black text-white">
                {String(index + 1).padStart(2, "0")}
              </span>
            ) : null}

            <h3 className="truncate text-lg font-black leading-none text-white">
              {getOrderNumber(order)}
            </h3>

            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-black",
                mode === "preparing"
                  ? "bg-yellow-400 text-black"
                  : "bg-emerald-500 text-white",
              )}
            >
              {mode === "preparing" ? "PREPARO" : "PRONTO"}
            </span>
          </div>

          <p className="mt-1 text-xs font-black text-white">
            {getCustomerLine(order)}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-zinc-500">
            {orderTime ? <span>Entrada: {orderTime}</span> : null}
            {order.guest_count ? <span>{toNumber(order.guest_count)} pessoa(s)</span> : null}
            <span>{formatMoney(order.total)}</span>
          </div>
        </div>

        <div
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-black",
            isLate && mode === "preparing"
              ? "bg-red-100 text-red-700"
              : mode === "preparing"
                ? "bg-yellow-400/10 text-yellow-400"
                : "bg-emerald-500/10 text-emerald-400",
          )}
        >
          {mode === "ready" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Timer className="h-3.5 w-3.5" />
          )}
          {mode === "ready" ? "OK" : getElapsedLabel(order.elapsedMinutes)}
        </div>
      </div>

      <div className="space-y-2 px-3 py-2.5">
        {order.notes ? (
          <div className="rounded-md border border-yellow-400/30 bg-yellow-400/10 px-2 py-1.5 text-xs font-black text-yellow-400">
            <div className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
              <p>Obs pedido: {order.notes}</p>
            </div>
          </div>
        ) : null}

        {order.items.length > 0 ? (
          <div className="space-y-1.5">
            {order.items.map((item, itemIndex) => {
              const quantity = getItemQuantity(item)
              const details = getItemDetails(item)

              return (
                <div
                  key={`${item.id}-${itemIndex}`}
                  className="rounded-md border border-white/10 bg-[#111111] px-2 py-2"
                >
                  <div className="grid grid-cols-[38px_minmax(0,1fr)] gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-[#050505] text-sm font-black text-white">
                      {quantity}x
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-black leading-snug text-white">
                        {details.name}
                      </p>

                      {details.modifiers.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {details.modifiers.map((modifier, modifierIndex) => (
                            <span
                              key={`${modifier}-${modifierIndex}`}
                              className="rounded bg-[#0A0A0A] px-1.5 py-0.5 text-[11px] font-bold text-zinc-500 ring-1 ring-yellow-400/20"
                            >
                              + {modifier}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {details.observation ? (
                        <p className="mt-1 rounded bg-yellow-400/10 px-1.5 py-0.5 text-[11px] font-black text-yellow-400">
                          Obs item: {details.observation}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-md border border-red-200 bg-red-50 px-2 py-2 text-xs font-black text-red-700">
            Pedido sem itens carregados. Verificar order_items.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
        <span className="text-[11px] font-black text-zinc-500">
          {order.items.length} item(ns)
        </span>

        {mode === "preparing" ? (
          <button
            type="button"
            onClick={() => onUpdateStatus(order, "ready")}
            disabled={isUpdating}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-yellow-400 px-3 text-xs font-black text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-yellow-400/10"
          >
            {isUpdating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Pronto
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onUpdateStatus(order, "preparing")}
            disabled={isUpdating}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-emerald-400/30 bg-[#0A0A0A] px-3 text-xs font-black text-emerald-400 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUpdating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowLeft className="h-3.5 w-3.5" />
            )}
            Voltar
          </button>
        )}
      </div>
    </article>
  )
}

export default function KdsPage() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [orderItems, setOrderItems] = useState<OrderItemRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

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
        setOrders([])
        setOrderItems([])
        return
      }

      setRestaurant(restaurantData)

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurantData.id)
        .order("created_at", { ascending: true })
        .limit(160)

      if (ordersError) throw ordersError

      const loadedOrders = (ordersData || []) as OrderRecord[]
      const visibleOrders = loadedOrders.filter(shouldShowOrderOnKds)
      const orderIds = visibleOrders.map((order) => order.id)

      let loadedItems: OrderItemRecord[] = []

      if (orderIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", orderIds)

        if (itemsError) throw itemsError

        loadedItems = ((itemsData || []) as OrderItemRecord[]).sort((a, b) => {
          const aDate = a.created_at ? new Date(a.created_at).getTime() : 0
          const bDate = b.created_at ? new Date(b.created_at).getTime() : 0

          return aDate - bDate
        })
      }

      setOrders(visibleOrders)
      setOrderItems(loadedItems)
    } catch (err) {
      console.error("Erro ao carregar KDS:", err)
      setError("Não foi possível carregar a tela KDS.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!restaurant?.id) return

    const channel = supabase
      .channel(`kds-orders-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          loadData(true)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
        },
        () => {
          loadData(true)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id])

  const kitchenOrders = useMemo<KitchenOrder[]>(() => {
    return orders
      .map((order) => {
        const group = getKitchenGroup(order)

        if (!group) return null

        const items = orderItems.filter((item) => item.order_id === order.id)

        return {
          ...order,
          items,
          group,
          elapsedMinutes: getElapsedMinutes(order.created_at),
        }
      })
      .filter((order): order is KitchenOrder => Boolean(order))
      .filter((order) => orderMatchesSearch(order, searchTerm))
      .sort((a, b) => {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0

        return aDate - bDate
      })
  }, [orders, orderItems, searchTerm])

  const groupedOrders = useMemo(() => {
    return {
      preparing: kitchenOrders.filter((order) => order.group === "preparing"),
      ready: kitchenOrders.filter((order) => order.group === "ready"),
    }
  }, [kitchenOrders])

  const summary = useMemo(() => {
    const lateOrders = groupedOrders.preparing.filter(
      (order) => order.elapsedMinutes >= 30,
    )

    return {
      total: kitchenOrders.length,
      preparing: groupedOrders.preparing.length,
      ready: groupedOrders.ready.length,
      late: lateOrders.length,
    }
  }, [kitchenOrders.length, groupedOrders])

  async function handleUpdateStatus(order: KitchenOrder, nextStatus: string) {
  try {
    setUpdatingOrderId(order.id)
    setError(null)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.access_token) {
      throw new Error("Sessão inválida. Faça login novamente.")
    }

    const response = await fetch("/api/kds/status", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        order_id: order.id,
        status: nextStatus,
      }),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Não foi possível atualizar o pedido.")
    }

    await loadData(true)
  } catch (err) {
    console.error("Erro ao atualizar pedido no KDS:", err)

    setError(
      err instanceof Error
        ? err.message
        : "Não foi possível atualizar o status do pedido.",
    )
  } finally {
    setUpdatingOrderId(null)
  }
}

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#111111] px-3 py-3 text-white sm:px-4">
        <div className="mx-auto flex max-w-[1700px] flex-col gap-3">
          <header className="rounded-xl border border-white/10 bg-[#0A0A0A] p-3 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-400 text-black">
                  <ChefHat className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <h1 className="text-xl font-black tracking-tight text-white">
                    KDS - Cozinha
                  </h1>

                  <p className="truncate text-xs font-bold text-zinc-500">
                    {restaurant?.name || "Restaurante"} • fila da cozinha
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-lg border border-white/10 bg-[#111111] px-3 py-2">
                    <p className="text-[10px] font-black uppercase text-zinc-500">
                      Total
                    </p>
                    <p className="text-lg font-black leading-none text-white">
                      {summary.total}
                    </p>
                  </div>

                  <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-3 py-2">
                    <p className="text-[10px] font-black uppercase text-yellow-400">
                      Preparo
                    </p>
                    <p className="text-lg font-black leading-none text-yellow-400">
                      {summary.preparing}
                    </p>
                  </div>

                  <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2">
                    <p className="text-[10px] font-black uppercase text-emerald-400">
                      Prontos
                    </p>
                    <p className="text-lg font-black leading-none text-emerald-400">
                      {summary.ready}
                    </p>
                  </div>

                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-[10px] font-black uppercase text-red-600">
                      +30min
                    </p>
                    <p className="text-lg font-black leading-none text-red-600">
                      {summary.late}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1 lg:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Buscar pedido, mesa, garçom ou item..."
                      className="h-10 w-full rounded-lg border border-white/10 bg-[#0A0A0A] pl-9 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => loadData(true)}
                    disabled={refreshing}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0A0A0A] px-3 text-sm font-black text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
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
          </header>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-white/10 bg-[#0A0A0A] shadow-sm">
              <div className="flex flex-col items-center gap-3 text-zinc-500">
                <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
                <p className="text-sm font-bold">Carregando KDS...</p>
              </div>
            </div>
          ) : (
            <div className="grid min-h-0 gap-3 lg:grid-cols-2">
              <section className="flex h-[calc(100vh-185px)] min-h-[470px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0A0A0A] shadow-sm">
                <div className="flex shrink-0 items-center justify-between border-b border-yellow-400/30 bg-yellow-400/10 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400 text-black">
                      <ChefHat className="h-4 w-4" />
                    </div>

                    <div>
                      <h2 className="text-base font-black text-yellow-400">
                        Em preparo
                      </h2>
                      <p className="text-[11px] font-bold text-yellow-400">
                        Ordem de chegada.
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-yellow-400 px-2.5 py-1 text-xs font-black text-black">
                    {groupedOrders.preparing.length}
                  </span>
                </div>

                <div
                  className={cn(
                    "flex-1 space-y-2 overflow-y-auto p-2.5",
                    scrollbarClassName,
                  )}
                >
                  {groupedOrders.preparing.length > 0 ? (
                    groupedOrders.preparing.map((order, index) => (
                      <KitchenOrderCard
                        key={order.id}
                        order={order}
                        index={index}
                        mode="preparing"
                        updatingOrderId={updatingOrderId}
                        onUpdateStatus={handleUpdateStatus}
                      />
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-white/10 bg-[#111111] p-6 text-center">
                      <Clock3 className="mx-auto h-8 w-8 text-zinc-500" />
                      <p className="mt-3 text-sm font-black text-zinc-500">
                        Nenhum pedido em preparo
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-500">
                        Quando o garçom enviar, aparece aqui.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section className="flex h-[calc(100vh-185px)] min-h-[470px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0A0A0A] shadow-sm">
                <div className="flex shrink-0 items-center justify-between border-b border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
                      <PackageCheck className="h-4 w-4" />
                    </div>

                    <div>
                      <h2 className="text-base font-black text-emerald-400">
                        Prontos
                      </h2>
                      <p className="text-[11px] font-bold text-emerald-400">
                        Finalizados pela cozinha.
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-black text-white">
                    {groupedOrders.ready.length}
                  </span>
                </div>

                <div
                  className={cn(
                    "flex-1 space-y-2 overflow-y-auto p-2.5",
                    scrollbarClassName,
                  )}
                >
                  {groupedOrders.ready.length > 0 ? (
                    groupedOrders.ready.map((order) => (
                      <KitchenOrderCard
                        key={order.id}
                        order={order}
                        mode="ready"
                        updatingOrderId={updatingOrderId}
                        onUpdateStatus={handleUpdateStatus}
                      />
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-white/10 bg-[#111111] p-6 text-center">
                      <Clock3 className="mx-auto h-8 w-8 text-zinc-500" />
                      <p className="mt-3 text-sm font-black text-zinc-500">
                        Nenhum pedido pronto
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-500">
                        Quando finalizar, aparece aqui.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}