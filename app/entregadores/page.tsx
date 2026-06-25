"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Copy,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react"

import AdminLayout from "@/components/admin-layout"
import { useAuth } from "@/components/auth/auth-provider"
import { createClient } from "@/lib/supabase/client"

type DeliveryPersonRow = {
  id: string
  restaurant_id: string
  name: string
  phone: string | null
  pix_key: string | null
  pix_key_type: string | null
  notes: string | null
  is_active: boolean
  deleted_at: string | null
  created_at: string
}

type OrderRow = {
  id: string
  public_order_number: string | number | null
  customer_name: string | null
  delivery_person_id: string | null
  delivery_fee: number | string | null
  status: string | null
  created_at: string
  out_for_delivery_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
}

type DeliverySettlementRow = {
  id: string
  restaurant_id: string
  delivery_person_id: string
  settlement_date: string
  total_amount: number | string
  total_orders: number
  order_ids: string[]
  payment_method: string
  status: string
  paid_at: string
  notes: string | null
  created_at: string
}

type CourierOrderItem = {
  id: string
  public_order_number: string | number | null
  customer_name: string | null
  delivery_fee: number
  status: string | null
  created_at: string
  out_for_delivery_at: string | null
  delivered_at: string | null
}

type DeliveryPersonWithStats = DeliveryPersonRow & {
  openOrders: number
  onRouteOrders: number
  deliveredToday: number
  totalToReceiveToday: number
  pendingToReceiveToday: number
  ordersToday: CourierOrderItem[]
  settlementToday: DeliverySettlementRow | null
  isPaidToday: boolean
}

const supabase = createClient()

async function ensureSupabaseSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session
}

function normalizeStatus(status: string | null | undefined) {
  return (status || "").trim().toLowerCase()
}

function isOnRouteStatus(status: string | null | undefined) {
  const value = normalizeStatus(status)

  return (
    value === "out_for_delivery" ||
    value === "saiu_para_entrega" ||
    value === "delivering" ||
    value === "on_route" ||
    value === "em_rota" ||
    value === "em rota"
  )
}

function isDeliveredStatus(status: string | null | undefined) {
  const value = normalizeStatus(status)

  return (
    value === "delivered" ||
    value === "entregue" ||
    value === "finished" ||
    value === "completed" ||
    value === "concluido" ||
    value === "concluído"
  )
}

function isCancelledStatus(status: string | null | undefined) {
  const value = normalizeStatus(status)

  return value === "cancelled" || value === "canceled" || value === "cancelado"
}

function isOpenStatus(status: string | null | undefined) {
  return !isDeliveredStatus(status) && !isCancelledStatus(status)
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
}

function formatPhone(phone: string | null) {
  if (!phone) return "Sem telefone"

  const digits = phone.replace(/\D/g, "")

  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
  }

  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3")
  }

  return phone
}

function formatPixKeyType(type: string | null) {
  if (type === "cpf") return "CPF"
  if (type === "phone") return "Telefone"
  if (type === "email") return "E-mail"
  if (type === "random") return "Aleatória"

  return "Pix"
}

function normalizeWhatsappPhone(phone: string | null) {
  if (!phone) return null

  const digits = phone.replace(/\D/g, "")

  if (!digits) return null
  if (digits.startsWith("55")) return digits

  return `55${digits}`
}

function getWhatsappUrl(phone: string | null) {
  const normalizedPhone = normalizeWhatsappPhone(phone)

  if (!normalizedPhone) return null

  return `https://wa.me/${normalizedPhone}`
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function getOrderNumber(order: {
  id: string
  public_order_number: string | number | null
}) {
  if (order.public_order_number !== null && order.public_order_number !== undefined) {
    return String(order.public_order_number)
  }

  return order.id.slice(0, 8)
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: string }).message
    if (message) return message
  }

  return fallback
}

function getTodayStartIso() {
  const now = new Date()
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  )

  return start.toISOString()
}

function getTodayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getStatusLabel(status: string | null | undefined) {
  if (isOnRouteStatus(status)) return "Em rota"
  if (isDeliveredStatus(status)) return "Entregue"
  if (isCancelledStatus(status)) return "Cancelado"
  return "Aberto"
}

function getStatusTone(status: string | null | undefined) {
  if (isOnRouteStatus(status)) return "border-emerald-400/30 bg-emerald-500/10 text-emerald-400"
  if (isDeliveredStatus(status)) return "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
  if (isCancelledStatus(status)) return "border-red-200 bg-red-50 text-red-700"
  return "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
}

export default function EntregadoresPage() {
  const { restaurant, user, isLoading: authLoading } = useAuth()

  const [deliveryPeople, setDeliveryPeople] = useState<DeliveryPersonRow[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [settlements, setSettlements] = useState<DeliverySettlementRow[]>([])

  const [loadingPage, setLoadingPage] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyCourierId, setBusyCourierId] = useState<string | null>(null)
  const [settlingCourierId, setSettlingCourierId] = useState<string | null>(null)
  const [settlementsLoading, setSettlementsLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const [editingCourierId, setEditingCourierId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [pixKeyType, setPixKeyType] = useState("")
  const [pixKey, setPixKey] = useState("")
  const [notes, setNotes] = useState("")

  function resetForm() {
    setEditingCourierId(null)
    setName("")
    setPhone("")
    setPixKeyType("")
    setPixKey("")
    setNotes("")
    setShowForm(false)
  }

  async function loadDeliveryPeople(showRefresh = false) {
    if (!restaurant?.id) return

    try {
      if (showRefresh) {
        setRefreshing(true)
      } else {
        setLoadingPage(true)
      }

      const session = await ensureSupabaseSession()

      if (!session) {
        setLoadingPage(false)
        setRefreshing(false)
        return
      }

      const { data, error } = await supabase
        .from("delivery_people")
        .select("id, restaurant_id, name, phone, pix_key, pix_key_type, notes, is_active, deleted_at, created_at")
        .eq("restaurant_id", restaurant.id)
        .is("deleted_at", null)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false })

      if (error) throw error

      setDeliveryPeople((data || []) as DeliveryPersonRow[])
      setLastUpdatedAt(new Date())
    } catch (err) {
      console.error("Erro ao carregar motoboys:", err)
      setError(getErrorMessage(err, "Erro ao carregar motoboys."))
    } finally {
      setLoadingPage(false)
      setRefreshing(false)
    }
  }

  async function loadOrdersToday() {
    if (!restaurant?.id) return

    try {
      setOrdersLoading(true)

      const session = await ensureSupabaseSession()

      if (!session) {
        setOrdersLoading(false)
        return
      }

      const todayStartIso = getTodayStartIso()

      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, public_order_number, customer_name, delivery_person_id, delivery_fee, status, created_at, out_for_delivery_at, delivered_at, cancelled_at"
        )
        .eq("restaurant_id", restaurant.id)
        .not("delivery_person_id", "is", null)
        .gte("created_at", todayStartIso)
        .order("created_at", { ascending: false })

      if (error) throw error

      setOrders((data || []) as OrderRow[])
      setLastUpdatedAt(new Date())
    } catch (err) {
      console.error("Erro ao carregar pedidos de hoje:", err)
      setError(getErrorMessage(err, "Erro ao carregar pedidos do dia."))
    } finally {
      setOrdersLoading(false)
    }
  }

  async function loadSettlementsToday() {
    if (!restaurant?.id) return

    try {
      setSettlementsLoading(true)

      const session = await ensureSupabaseSession()

      if (!session) {
        setSettlementsLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("delivery_settlements")
        .select(
          "id, restaurant_id, delivery_person_id, settlement_date, total_amount, total_orders, order_ids, payment_method, status, paid_at, notes, created_at"
        )
        .eq("restaurant_id", restaurant.id)
        .eq("settlement_date", getTodayDateString())
        .eq("status", "paid")

      if (error) throw error

      setSettlements((data || []) as DeliverySettlementRow[])
    } catch (err) {
      console.error("Erro ao carregar repasses pagos:", err)
      setError(getErrorMessage(err, "Erro ao carregar repasses pagos."))
    } finally {
      setSettlementsLoading(false)
    }
  }

  async function loadInitialData() {
    if (!restaurant?.id) return

    setError(null)

    await Promise.all([
      loadDeliveryPeople(),
      loadOrdersToday(),
      loadSettlementsToday(),
    ])
  }

  async function refreshAll() {
    if (!restaurant?.id) return

    setError(null)
    setRefreshing(true)

    try {
      await Promise.all([
        loadDeliveryPeople(true),
        loadOrdersToday(),
        loadSettlementsToday(),
      ])
    } finally {
      setRefreshing(false)
    }
  }

  async function handleSaveCourier() {
    if (!restaurant?.id) return

    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    const trimmedPixKeyType = pixKeyType.trim()
    const trimmedPixKey = pixKey.trim()
    const trimmedNotes = notes.trim()

    if (!trimmedName) {
      setError("Digite o nome do motoboy.")
      return
    }

    try {
      setSaving(true)
      setError(null)

      if (editingCourierId) {
        const { error } = await supabase
          .from("delivery_people")
          .update({
            name: trimmedName,
            phone: trimmedPhone || null,
            pix_key_type: trimmedPixKeyType || null,
            pix_key: trimmedPixKey || null,
            notes: trimmedNotes || null,
          })
          .eq("id", editingCourierId)
          .eq("restaurant_id", restaurant.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from("delivery_people")
          .insert({
            restaurant_id: restaurant.id,
            name: trimmedName,
            phone: trimmedPhone || null,
            pix_key_type: trimmedPixKeyType || null,
            pix_key: trimmedPixKey || null,
            notes: trimmedNotes || null,
          })

        if (error) throw error
      }

      resetForm()
      await loadDeliveryPeople(true)
    } catch (err) {
      console.error("Erro ao salvar motoboy:", err)
      setError(getErrorMessage(err, "Erro ao salvar motoboy."))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(courier: DeliveryPersonWithStats) {
    if (!restaurant?.id) return

    if (courier.onRouteOrders > 0 && courier.is_active) {
      setError("Esse motoboy está em rota. Finalize a entrega antes de desativar.")
      return
    }

    try {
      setBusyCourierId(courier.id)
      setError(null)

      const { error } = await supabase
        .from("delivery_people")
        .update({
          is_active: !courier.is_active,
        })
        .eq("id", courier.id)
        .eq("restaurant_id", restaurant.id)

      if (error) throw error

      await loadDeliveryPeople(true)
    } catch (err) {
      console.error("Erro ao atualizar motoboy:", err)
      setError(getErrorMessage(err, "Erro ao atualizar motoboy."))
    } finally {
      setBusyCourierId(null)
    }
  }

  async function handleDeleteCourier(courier: DeliveryPersonWithStats) {
    if (!restaurant?.id) return

    if (courier.onRouteOrders > 0) {
      setError("Esse motoboy está em rota. Finalize a entrega antes de excluir.")
      return
    }

    const confirmed = window.confirm(
      `Excluir ${courier.name}? Ele será removido da tela, mas o histórico dos pedidos continua salvo.`
    )

    if (!confirmed) return

    try {
      setBusyCourierId(courier.id)
      setError(null)

      const { error } = await supabase
        .from("delivery_people")
        .update({
          is_active: false,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", courier.id)
        .eq("restaurant_id", restaurant.id)

      if (error) throw error

      if (editingCourierId === courier.id) {
        resetForm()
      }

      await loadDeliveryPeople(true)
    } catch (err) {
      console.error("Erro ao excluir motoboy:", err)
      setError(getErrorMessage(err, "Erro ao excluir motoboy."))
    } finally {
      setBusyCourierId(null)
    }
  }

  async function handleCopyPix(courier: DeliveryPersonWithStats) {
    if (!courier.pix_key) {
      setError("Esse motoboy ainda não tem chave Pix cadastrada.")
      return
    }

    try {
      await navigator.clipboard.writeText(courier.pix_key)
      setError(null)
    } catch (err) {
      console.error("Erro ao copiar Pix:", err)
      setError("Não foi possível copiar a chave Pix.")
    }
  }

  async function handleMarkSettlementPaid(courier: DeliveryPersonWithStats) {
    if (!restaurant?.id) return

    if (courier.isPaidToday) {
      setError("Esse repasse já foi marcado como pago hoje.")
      return
    }

    if (courier.ordersToday.length === 0 || courier.totalToReceiveToday <= 0) {
      setError("Esse motoboy não tem valor para repassar hoje.")
      return
    }

    const confirmed = window.confirm(
      `Marcar ${formatCurrency(courier.totalToReceiveToday)} como pago para ${courier.name}?`
    )

    if (!confirmed) return

    try {
      setSettlingCourierId(courier.id)
      setError(null)

      const orderIds = courier.ordersToday.map((order) => order.id)

      const { error } = await supabase.from("delivery_settlements").insert({
        restaurant_id: restaurant.id,
        delivery_person_id: courier.id,
        settlement_date: getTodayDateString(),
        total_amount: courier.totalToReceiveToday,
        total_orders: courier.ordersToday.length,
        order_ids: orderIds,
        payment_method: "pix",
        status: "paid",
        paid_at: new Date().toISOString(),
      })

      if (error) {
        if (error.code === "23505") {
          throw new Error("Esse repasse já foi marcado como pago hoje.")
        }

        throw error
      }

      await loadSettlementsToday()
    } catch (err) {
      console.error("Erro ao marcar repasse como pago:", err)
      setError(getErrorMessage(err, "Erro ao marcar repasse como pago."))
    } finally {
      setSettlingCourierId(null)
    }
  }

  function handleEditCourier(courier: DeliveryPersonRow) {
    setEditingCourierId(courier.id)
    setName(courier.name)
    setPhone(courier.phone || "")
    setPixKeyType(courier.pix_key_type || "")
    setPixKey(courier.pix_key || "")
    setNotes(courier.notes || "")
    setShowForm(true)
  }

  useEffect(() => {
    if (authLoading) {
      setLoadingPage(true)
      return
    }

    if (!user || !restaurant?.id) {
      setDeliveryPeople([])
      setOrders([])
      setSettlements([])
      setLoadingPage(false)
      setOrdersLoading(false)
      setRefreshing(false)
      setError(null)
      return
    }

    void loadInitialData()

    const ordersRefreshInterval = window.setInterval(() => {
      void loadOrdersToday()
    }, 15000)

    const deliveryPeopleChannel = supabase
      .channel(`delivery-people-page-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_people",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          void loadDeliveryPeople(true)
        }
      )
      .subscribe()

    const ordersChannel = supabase
      .channel(`delivery-people-orders-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          void loadOrdersToday()
        }
      )
      .subscribe()

    const settlementsChannel = supabase
      .channel(`delivery-settlements-page-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_settlements",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          void loadSettlementsToday()
        }
      )
      .subscribe()

    return () => {
      window.clearInterval(ordersRefreshInterval)
      void supabase.removeChannel(deliveryPeopleChannel)
      void supabase.removeChannel(ordersChannel)
      void supabase.removeChannel(settlementsChannel)
    }
  }, [authLoading, restaurant?.id, user?.id])

  useEffect(() => {
    if (!restaurant?.id || !user?.id) return

    const handlePageBack = () => {
      if (document.visibilityState === "visible") {
        void refreshAll()
      }
    }

    const handleWindowFocus = () => {
      void refreshAll()
    }

    document.addEventListener("visibilitychange", handlePageBack)
    window.addEventListener("focus", handleWindowFocus)

    return () => {
      document.removeEventListener("visibilitychange", handlePageBack)
      window.removeEventListener("focus", handleWindowFocus)
    }
  }, [restaurant?.id, user?.id])

  const deliveryPeopleWithStats = useMemo<DeliveryPersonWithStats[]>(() => {
    return deliveryPeople
      .map((courier) => {
        const courierOrders = orders
          .filter((order) => order.delivery_person_id === courier.id)
          .map((order) => ({
            id: order.id,
            public_order_number: order.public_order_number,
            customer_name: order.customer_name,
            delivery_fee: Number(order.delivery_fee || 0),
            status: order.status,
            created_at: order.created_at,
            out_for_delivery_at: order.out_for_delivery_at,
            delivered_at: order.delivered_at,
          }))

        const openOrders = courierOrders.filter((order) =>
          isOpenStatus(order.status)
        ).length

        const onRouteOrders = courierOrders.filter((order) =>
          isOnRouteStatus(order.status)
        ).length

        const deliveredToday = courierOrders.filter((order) =>
          isDeliveredStatus(order.status)
        ).length

        const totalToReceiveToday = courierOrders.reduce(
          (sum, order) => sum + Number(order.delivery_fee || 0),
          0
        )

        const settlementToday =
          settlements.find(
            (settlement) =>
              settlement.delivery_person_id === courier.id &&
              settlement.status === "paid"
          ) || null

        const isPaidToday = Boolean(settlementToday)

        return {
          ...courier,
          openOrders,
          onRouteOrders,
          deliveredToday,
          totalToReceiveToday,
          pendingToReceiveToday: isPaidToday ? 0 : totalToReceiveToday,
          ordersToday: courierOrders,
          settlementToday,
          isPaidToday,
        }
      })
      .sort((a, b) => {
        if (a.onRouteOrders !== b.onRouteOrders) return b.onRouteOrders - a.onRouteOrders
        if (a.pendingToReceiveToday !== b.pendingToReceiveToday) {
          return b.pendingToReceiveToday - a.pendingToReceiveToday
        }
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
        return a.name.localeCompare(b.name, "pt-BR")
      })
  }, [deliveryPeople, orders, settlements])

  const filteredCouriers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) return deliveryPeopleWithStats

    return deliveryPeopleWithStats.filter((courier) => {
      return (
        courier.name.toLowerCase().includes(normalizedSearch) ||
        (courier.phone || "").toLowerCase().includes(normalizedSearch) ||
        (courier.pix_key || "").toLowerCase().includes(normalizedSearch) ||
        courier.ordersToday.some((order) =>
          getOrderNumber(order).toLowerCase().includes(normalizedSearch)
        )
      )
    })
  }, [deliveryPeopleWithStats, search])

  const activeCouriers = deliveryPeopleWithStats.filter((item) => item.is_active).length
  const onRouteOrders = deliveryPeopleWithStats.reduce(
    (sum, item) => sum + item.onRouteOrders,
    0
  )
  const totalOrdersToday = deliveryPeopleWithStats.reduce(
    (sum, item) => sum + item.ordersToday.length,
    0
  )
  const totalPendingToday = deliveryPeopleWithStats.reduce(
    (sum, item) => sum + item.pendingToReceiveToday,
    0
  )

  return (
    <AdminLayout>
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Entregadores
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Veja quem está com pedido, quanto falta repassar e marque o pagamento do dia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Novo motoboy
            </button>

            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={refreshing}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-400">
                A repassar hoje
              </p>
              <Wallet className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-400">
              {ordersLoading ? "..." : formatCurrency(totalPendingToday)}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
              Motoboys ativos
            </p>
            <p className="mt-2 text-2xl font-black text-foreground">
              {loadingPage ? "..." : activeCouriers}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
              Pedidos com motoboy
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-2xl font-black text-foreground">
                {ordersLoading ? "..." : totalOrdersToday}
              </p>
              <p className="text-xs font-bold text-muted-foreground">
                {ordersLoading ? "" : `${onRouteOrders} em rota`}
              </p>
            </div>
          </div>
        </div>

        {showForm ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-black text-foreground">
                  {editingCourierId ? "Editar motoboy" : "Cadastrar motoboy"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Preencha só o necessário. Pix pode ficar vazio e ser editado depois.
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                className="h-9 rounded-xl border border-border px-3 text-xs font-bold text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
              >
                Cancelar
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_0.8fr_1.2fr]">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: João da Moto"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Telefone
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="31999999999"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Tipo Pix
                </label>
                <select
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">Selecione</option>
                  <option value="cpf">CPF</option>
                  <option value="phone">Telefone</option>
                  <option value="email">E-mail</option>
                  <option value="random">Aleatória</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Chave Pix
                </label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="CPF, telefone, e-mail ou aleatória"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observação opcional"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
              />

              <button
                type="button"
                onClick={() => void handleSaveCourier()}
                disabled={saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingCourierId ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {editingCourierId ? "Salvar" : "Cadastrar"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar motoboy ou número do pedido..."
                  className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <p className="text-xs font-semibold text-muted-foreground">
                {lastUpdatedAt
                  ? `Atualizado às ${lastUpdatedAt.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "Aguardando dados"}
              </p>
            </div>
          </div>

          <div className="p-4">
            {loadingPage ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-border bg-background text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando entregadores...
              </div>
            ) : filteredCouriers.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background px-6 text-center">
                <p className="text-sm font-bold text-foreground">
                  Nenhum entregador encontrado
                </p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Cadastre um motoboy ou limpe a busca para ver a lista completa.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCouriers.map((courier) => {
                  const whatsappUrl = getWhatsappUrl(courier.phone)
                  const isBusy = busyCourierId === courier.id

                  return (
                    <div
                      key={courier.id}
                      className="rounded-2xl border border-border bg-background p-4"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-black text-primary">
                              {getInitials(courier.name) || "MB"}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-lg font-black text-foreground">
                                  {courier.name}
                                </h3>

                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                                    courier.onRouteOrders > 0
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : courier.is_active
                                        ? "bg-yellow-400/10 text-yellow-400"
                                        : "bg-[#111111] text-zinc-500"
                                  }`}
                                >
                                  {courier.onRouteOrders > 0
                                    ? "Em rota"
                                    : courier.is_active
                                      ? "Ativo"
                                      : "Inativo"}
                                </span>

                                {courier.isPaidToday ? (
                                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-400">
                                    Pago hoje
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="h-3.5 w-3.5" />
                                  {formatPhone(courier.phone)}
                                </span>
                                <span>
                                  Pix: {courier.pix_key ? formatPixKeyType(courier.pix_key_type) : "não cadastrado"}
                                </span>
                              </div>

                              {courier.notes ? (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {courier.notes}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[360px]">
                          <div className="rounded-xl border border-border bg-card px-3 py-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                              Pedidos
                            </p>
                            <p className="text-lg font-black text-foreground">
                              {ordersLoading ? "..." : courier.ordersToday.length}
                            </p>
                          </div>

                          <div className="rounded-xl border border-border bg-card px-3 py-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                              Em rota
                            </p>
                            <p className="text-lg font-black text-foreground">
                              {ordersLoading ? "..." : courier.onRouteOrders}
                            </p>
                          </div>

                          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-400">
                              A pagar
                            </p>
                            <p className="text-lg font-black text-emerald-400">
                              {ordersLoading ? "..." : formatCurrency(courier.pendingToReceiveToday)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {whatsappUrl ? (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/15"
                          >
                            <MessageCircle className="h-4 w-4" />
                            WhatsApp
                          </a>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => void handleCopyPix(courier)}
                          disabled={!courier.pix_key}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Copy className="h-4 w-4" />
                          Copiar Pix
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleMarkSettlementPaid(courier)}
                          disabled={
                            courier.isPaidToday ||
                            settlingCourierId === courier.id ||
                            settlementsLoading ||
                            courier.totalToReceiveToday <= 0
                          }
                          className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            courier.isPaidToday
                              ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-400"
                              : "border border-emerald-400/30 bg-[#0A0A0A] text-emerald-400 hover:bg-emerald-500/15"
                          }`}
                        >
                          {settlingCourierId === courier.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          {courier.isPaidToday ? "Pago" : "Marcar pago"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEditCourier(courier)}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground transition hover:bg-muted/40"
                        >
                          <UserRound className="h-4 w-4" />
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleToggleActive(courier)}
                          disabled={isBusy}
                          className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            courier.is_active
                              ? "border border-white/10 bg-[#0A0A0A] text-zinc-500 hover:bg-[#111111]"
                              : "border border-emerald-400/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15"
                          }`}
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : courier.is_active ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          {courier.is_active ? "Desativar" : "Ativar"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDeleteCourier(courier)}
                          disabled={isBusy}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Excluir
                        </button>
                      </div>

                      <div className="mt-4 rounded-xl border border-border bg-card p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                            Pedidos vinculados hoje
                          </p>
                          <p className="text-xs font-semibold text-muted-foreground">
                            Taxa de entrega do motoboy
                          </p>
                        </div>

                        {ordersLoading ? (
                          <div className="rounded-xl border border-dashed border-border bg-background px-3 py-5 text-center text-xs text-muted-foreground">
                            Carregando pedidos...
                          </div>
                        ) : courier.ordersToday.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border bg-background px-3 py-5 text-center text-xs text-muted-foreground">
                            Nenhum pedido vinculado hoje.
                          </div>
                        ) : (
                          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                            {courier.ordersToday.map((order) => (
                              <div
                                key={order.id}
                                className="grid gap-2 bg-background px-3 py-2 text-xs sm:grid-cols-[120px_minmax(0,1fr)_110px_110px] sm:items-center"
                              >
                                <p className="font-black text-foreground">
                                  #{getOrderNumber(order)}
                                </p>

                                <p className="truncate text-muted-foreground">
                                  {order.customer_name || "Cliente não informado"}
                                </p>

                                <span
                                  className={`inline-flex w-fit items-center justify-center rounded-full border px-2 py-1 text-[10px] font-bold ${getStatusTone(order.status)}`}
                                >
                                  {getStatusLabel(order.status)}
                                </span>

                                <p className="font-black text-foreground sm:text-right">
                                  {formatCurrency(order.delivery_fee)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
