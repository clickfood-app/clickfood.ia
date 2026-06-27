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

function isPayableDeliveryOrder(order: Pick<OrderRow, "delivery_fee" | "status">) {
  const deliveryFee = Number(order.delivery_fee || 0)

  return (
    deliveryFee > 0 &&
    !isCancelledStatus(order.status) &&
    (isOnRouteStatus(order.status) || isDeliveredStatus(order.status))
  )
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

function getLocalDateString(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getTodayDateString() {
  return getLocalDateString(new Date())
}

function getYesterdayDateString() {
  const date = new Date()
  date.setDate(date.getDate() - 1)

  return getLocalDateString(date)
}

function getOrderAccountingDate(order: Pick<OrderRow, "delivered_at" | "out_for_delivery_at" | "created_at">) {
  return order.delivered_at || order.out_for_delivery_at || order.created_at
}

function isFinalizedDeliveryOrder(
  order: Pick<CourierOrderItem, "status" | "delivered_at"> | Pick<OrderRow, "status" | "delivered_at">
) {
  return Boolean(order.delivered_at) || isDeliveredStatus(order.status)
}

function isOrderStillOnRoute(
  order: Pick<CourierOrderItem, "status" | "delivered_at"> | Pick<OrderRow, "status" | "delivered_at">
) {
  return isOnRouteStatus(order.status) && !isFinalizedDeliveryOrder(order)
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
  const [showSettlementPanel, setShowSettlementPanel] = useState(false)
  const [settlementHistoryDate, setSettlementHistoryDate] = useState(getTodayDateString())
  const [deliveryHistoryDate, setDeliveryHistoryDate] = useState(getYesterdayDateString())
  const [expandedCourierId, setExpandedCourierId] = useState<string | null>(null)
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

  async function loadOrdersToSettle() {
    if (!restaurant?.id) return

    try {
      setOrdersLoading(true)

      const session = await ensureSupabaseSession()

      if (!session) {
        setOrdersLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, public_order_number, customer_name, delivery_person_id, delivery_fee, status, created_at, out_for_delivery_at, delivered_at, cancelled_at"
        )
        .eq("restaurant_id", restaurant.id)
        .not("delivery_person_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1000)

      if (error) throw error

      setOrders((data || []) as OrderRow[])
      setLastUpdatedAt(new Date())
    } catch (err) {
      console.error("Erro ao carregar pedidos com motoboy:", err)
      setError(getErrorMessage(err, "Erro ao carregar pedidos com motoboy."))
    } finally {
      setOrdersLoading(false)
    }
  }

  async function loadSettlements() {
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
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(1000)

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
      loadOrdersToSettle(),
      loadSettlements(),
    ])
  }

  async function refreshAll() {
    if (!restaurant?.id) return

    setError(null)
    setRefreshing(true)

    try {
      await Promise.all([
        loadDeliveryPeople(true),
        loadOrdersToSettle(),
        loadSettlements(),
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

    if (courier.pendingToReceiveToday > 0 && courier.is_active) {
      setError("Esse motoboy possui taxas em aberto. Feche as taxas antes de desativar.")
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

    if (courier.pendingToReceiveToday > 0) {
      setError("Esse motoboy possui taxas em aberto. Feche as taxas antes de excluir.")
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

    if (courier.ordersToday.length === 0 || courier.pendingToReceiveToday <= 0) {
      setError("Esse motoboy não tem taxa em aberto para fechar.")
      return
    }

    const confirmed = window.confirm(
      `Fechar ${formatCurrency(courier.pendingToReceiveToday)} em taxas para ${courier.name}?`
    )

    if (!confirmed) return

    try {
      setSettlingCourierId(courier.id)
      setError(null)

      const settlementDate = getTodayDateString()
      const orderIds = courier.ordersToday.map((order) => order.id)

      const { error } = await supabase.from("delivery_settlements").insert({
        restaurant_id: restaurant.id,
        delivery_person_id: courier.id,
        settlement_date: settlementDate,
        total_amount: courier.pendingToReceiveToday,
        total_orders: courier.ordersToday.length,
        order_ids: orderIds,
        payment_method: "pix",
        status: "paid",
        paid_at: new Date().toISOString(),
      })

      if (error) {
        if (error.code !== "23505") {
          throw error
        }

        const { data: existingSettlement, error: fetchError } = await supabase
          .from("delivery_settlements")
          .select(
            "id, restaurant_id, delivery_person_id, settlement_date, total_amount, total_orders, order_ids, payment_method, status, paid_at, notes, created_at"
          )
          .eq("restaurant_id", restaurant.id)
          .eq("delivery_person_id", courier.id)
          .eq("settlement_date", settlementDate)
          .eq("status", "paid")
          .maybeSingle()

        if (fetchError) throw fetchError
        if (!existingSettlement) throw new Error("Não foi possível localizar o fechamento existente.")

        const existingOrderIds = Array.isArray(existingSettlement.order_ids)
          ? existingSettlement.order_ids
          : []
        const mergedOrderIds = Array.from(new Set([...existingOrderIds, ...orderIds]))

        const { error: updateError } = await supabase
          .from("delivery_settlements")
          .update({
            total_amount: Number(existingSettlement.total_amount || 0) + courier.pendingToReceiveToday,
            total_orders: mergedOrderIds.length,
            order_ids: mergedOrderIds,
            paid_at: new Date().toISOString(),
          })
          .eq("id", existingSettlement.id)
          .eq("restaurant_id", restaurant.id)

        if (updateError) throw updateError
      }

      await Promise.all([loadOrdersToSettle(), loadSettlements()])
    } catch (err) {
      console.error("Erro ao fechar taxas do motoboy:", err)
      setError(getErrorMessage(err, "Erro ao fechar taxas do motoboy."))
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
      void loadOrdersToSettle()
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
          void loadOrdersToSettle()
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
          void loadSettlements()
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

  const paidOrderIds = useMemo(() => {
    return new Set(
      settlements.flatMap((settlement) =>
        Array.isArray(settlement.order_ids) ? settlement.order_ids : []
      )
    )
  }, [settlements])

  const deliveryPeopleWithStats = useMemo<DeliveryPersonWithStats[]>(() => {
    return deliveryPeople
      .map((courier) => {
        const courierOrders = orders
          .filter((order) => order.delivery_person_id === courier.id)
          .filter((order) => isPayableDeliveryOrder(order))
          .filter((order) => !paidOrderIds.has(order.id))
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

        const openOrders = courierOrders.length

        const onRouteOrders = courierOrders.filter((order) =>
          isOrderStillOnRoute(order)
        ).length

        const deliveredToday = courierOrders.filter((order) =>
          isFinalizedDeliveryOrder(order)
        ).length

        const totalToReceiveToday = courierOrders.reduce(
          (sum, order) => sum + Number(order.delivery_fee || 0),
          0
        )

        const settlementToday =
          settlements.find(
            (settlement) =>
              settlement.delivery_person_id === courier.id &&
              settlement.settlement_date === getTodayDateString() &&
              settlement.status === "paid"
          ) || null

        const isPaidToday = Boolean(settlementToday) && totalToReceiveToday <= 0

        return {
          ...courier,
          openOrders,
          onRouteOrders,
          deliveredToday,
          totalToReceiveToday,
          pendingToReceiveToday: totalToReceiveToday,
          ordersToday: courierOrders,
          settlementToday,
          isPaidToday,
        }
      })
      .sort((a, b) => {
        if (a.pendingToReceiveToday !== b.pendingToReceiveToday) {
          return b.pendingToReceiveToday - a.pendingToReceiveToday
        }
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
        return a.name.localeCompare(b.name, "pt-BR")
      })
  }, [deliveryPeople, orders, paidOrderIds, settlements])

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
  const totalOrdersToday = deliveryPeopleWithStats.reduce(
    (sum, item) => sum + item.ordersToday.length,
    0
  )
  const totalPendingToday = deliveryPeopleWithStats.reduce(
    (sum, item) => sum + item.pendingToReceiveToday,
    0
  )
  const couriersWithOpenSettlement = deliveryPeopleWithStats.filter(
    (item) => item.pendingToReceiveToday > 0 && item.ordersToday.length > 0
  )
  const settlementHistory = settlements.filter(
    (settlement) => settlement.settlement_date === settlementHistoryDate
  )
  const totalSettledInDate = settlementHistory.reduce(
    (sum, settlement) => sum + Number(settlement.total_amount || 0),
    0
  )

  const deliveryHistoryByCourier = useMemo(() => {
    const payableOrdersInDate = orders
      .filter((order) => order.delivery_person_id)
      .filter((order) => isPayableDeliveryOrder(order))
      .filter((order) => getLocalDateString(getOrderAccountingDate(order)) === deliveryHistoryDate)

    return deliveryPeople
      .map((courier) => {
        const courierOrders = payableOrdersInDate
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

        const settledOrders = courierOrders.filter((order) => paidOrderIds.has(order.id))
        const openOrdersInDate = courierOrders.filter((order) => !paidOrderIds.has(order.id))

        return {
          courier,
          orders: courierOrders,
          settledOrders,
          openOrders: openOrdersInDate,
          totalAmount: courierOrders.reduce((sum, order) => sum + order.delivery_fee, 0),
          settledAmount: settledOrders.reduce((sum, order) => sum + order.delivery_fee, 0),
          openAmount: openOrdersInDate.reduce((sum, order) => sum + order.delivery_fee, 0),
        }
      })
      .filter((item) => item.orders.length > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount)
  }, [deliveryHistoryDate, deliveryPeople, orders, paidOrderIds])

  const totalDeliveryHistoryAmount = deliveryHistoryByCourier.reduce(
    (sum, item) => sum + item.totalAmount,
    0
  )
  const totalDeliveryHistoryOpen = deliveryHistoryByCourier.reduce(
    (sum, item) => sum + item.openAmount,
    0
  )
  const totalDeliveryHistorySettled = deliveryHistoryByCourier.reduce(
    (sum, item) => sum + item.settledAmount,
    0
  )
  const totalDeliveryHistoryOrders = deliveryHistoryByCourier.reduce(
    (sum, item) => sum + item.orders.length,
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
              Veja as taxas abertas, quanto falta repassar e feche os valores sem perder nada após meia-noite.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettlementPanel((current) => !current)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 text-sm font-bold text-emerald-400 transition hover:bg-emerald-500/15"
            >
              <Wallet className="h-4 w-4" />
              Fechamento de taxas
            </button>

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
                A repassar em aberto
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
              Pedidos no acerto
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-2xl font-black text-foreground">
                {ordersLoading ? "..." : totalOrdersToday}
              </p>
              <p className="text-xs font-bold text-muted-foreground">
                {ordersLoading ? "" : `${totalOrdersToday} taxa(s) aberta(s)`}
              </p>
            </div>
          </div>
        </div>

        {showSettlementPanel ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-black text-emerald-400">
                    Taxas em aberto
                  </h2>
                  <p className="text-xs font-semibold text-muted-foreground">
                    Esses valores continuam acumulando até você fechar, mesmo virando o dia.
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-400/30 bg-background px-3 py-2 text-right">
                  <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                    Total aberto
                  </p>
                  <p className="text-lg font-black text-emerald-400">
                    {formatCurrency(totalPendingToday)}
                  </p>
                </div>
              </div>

              {ordersLoading ? (
                <div className="rounded-xl border border-dashed border-emerald-400/30 bg-background px-3 py-5 text-center text-xs text-muted-foreground">
                  Carregando taxas em aberto...
                </div>
              ) : couriersWithOpenSettlement.length === 0 ? (
                <div className="rounded-xl border border-dashed border-emerald-400/30 bg-background px-3 py-5 text-center text-xs text-muted-foreground">
                  Nenhuma taxa em aberto no momento.
                </div>
              ) : (
                <div className="space-y-2">
                  {couriersWithOpenSettlement.map((courier) => (
                    <div
                      key={courier.id}
                      className="grid gap-3 rounded-xl border border-emerald-400/30 bg-background p-3 sm:grid-cols-[minmax(0,1fr)_90px_120px_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">
                          {courier.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {courier.pix_key
                            ? `${formatPixKeyType(courier.pix_key_type)}: ${courier.pix_key}`
                            : "Pix não cadastrado"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                          Pedidos
                        </p>
                        <p className="text-sm font-black text-foreground">
                          {courier.ordersToday.length}
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                          Valor
                        </p>
                        <p className="text-sm font-black text-emerald-400">
                          {formatCurrency(courier.pendingToReceiveToday)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleMarkSettlementPaid(courier)}
                        disabled={settlingCourierId === courier.id || settlementsLoading}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-3 text-xs font-bold text-emerald-400 transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {settlingCourierId === courier.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Fechar taxa
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-black text-foreground">
                    Histórico de fechamentos
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Filtre por data para conferir quanto já foi repassado.
                  </p>
                </div>

                <input
                  type="date"
                  value={settlementHistoryDate}
                  onChange={(e) => setSettlementHistoryDate(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-bold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div className="mb-3 rounded-xl border border-border bg-background px-3 py-2">
                <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                  Total fechado na data
                </p>
                <p className="text-lg font-black text-foreground">
                  {formatCurrency(totalSettledInDate)}
                </p>
              </div>

              {settlementsLoading ? (
                <div className="rounded-xl border border-dashed border-border bg-background px-3 py-5 text-center text-xs text-muted-foreground">
                  Carregando histórico...
                </div>
              ) : settlementHistory.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-background px-3 py-5 text-center text-xs text-muted-foreground">
                  Nenhum fechamento encontrado nessa data.
                </div>
              ) : (
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {settlementHistory.map((settlement) => {
                    const courier = deliveryPeople.find(
                      (item) => item.id === settlement.delivery_person_id
                    )

                    return (
                      <div key={settlement.id} className="bg-background p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-foreground">
                              {courier?.name || "Motoboy removido"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {settlement.total_orders} pedido(s) fechado(s)
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-black text-foreground">
                              {formatCurrency(settlement.total_amount)}
                            </p>
                            <p className="text-[11px] font-semibold text-muted-foreground">
                              {settlement.paid_at ? formatTime(settlement.paid_at) : "Pago"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-base font-black text-foreground">
                    Histórico por data dos pedidos
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Use esse filtro para achar taxas de ontem ou de qualquer dia. O valor em aberto aparece mesmo se virou meia-noite.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryHistoryDate(getYesterdayDateString())}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground transition hover:bg-muted/40"
                  >
                    Ver ontem
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryHistoryDate(getTodayDateString())}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground transition hover:bg-muted/40"
                  >
                    Ver hoje
                  </button>
                  <input
                    type="date"
                    value={deliveryHistoryDate}
                    onChange={(e) => setDeliveryHistoryDate(e.target.value)}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-bold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              <div className="mb-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                    Pedidos na data
                  </p>
                  <p className="mt-1 text-lg font-black text-foreground">
                    {ordersLoading ? "..." : totalDeliveryHistoryOrders}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                    Total de taxas
                  </p>
                  <p className="mt-1 text-lg font-black text-foreground">
                    {ordersLoading ? "..." : formatCurrency(totalDeliveryHistoryAmount)}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
                  <p className="text-[11px] font-black uppercase tracking-wide text-emerald-400">
                    Ainda em aberto
                  </p>
                  <p className="mt-1 text-lg font-black text-emerald-400">
                    {ordersLoading ? "..." : formatCurrency(totalDeliveryHistoryOpen)}
                  </p>
                </div>

                <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-3">
                  <p className="text-[11px] font-black uppercase tracking-wide text-yellow-400">
                    Já fechado
                  </p>
                  <p className="mt-1 text-lg font-black text-yellow-400">
                    {ordersLoading ? "..." : formatCurrency(totalDeliveryHistorySettled)}
                  </p>
                </div>
              </div>

              {ordersLoading ? (
                <div className="rounded-xl border border-dashed border-border bg-background px-3 py-5 text-center text-xs text-muted-foreground">
                  Carregando pedidos da data...
                </div>
              ) : deliveryHistoryByCourier.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-background px-3 py-5 text-center text-xs text-muted-foreground">
                  Nenhuma taxa encontrada nessa data.
                </div>
              ) : (
                <div className="space-y-3">
                  {deliveryHistoryByCourier.map((item) => (
                    <div
                      key={item.courier.id}
                      className="rounded-xl border border-border bg-background p-3"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-black text-foreground">
                            {item.courier.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.orders.length} pedido(s) · {formatCurrency(item.totalAmount)} em taxas
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-right sm:min-w-[240px]">
                          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2">
                            <p className="text-[11px] font-bold text-emerald-400">Aberto</p>
                            <p className="text-sm font-black text-emerald-400">
                              {formatCurrency(item.openAmount)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-3 py-2">
                            <p className="text-[11px] font-bold text-yellow-400">Fechado</p>
                            <p className="text-sm font-black text-yellow-400">
                              {formatCurrency(item.settledAmount)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
                        {item.orders.map((order) => {
                          const isSettled = paidOrderIds.has(order.id)

                          return (
                            <div
                              key={order.id}
                              className="grid gap-2 bg-card px-3 py-2 text-xs sm:grid-cols-[90px_minmax(0,1fr)_90px_90px] sm:items-center"
                            >
                              <p className="font-black text-foreground">
                                #{getOrderNumber(order)}
                              </p>
                              <p className="truncate text-muted-foreground">
                                {order.customer_name || "Cliente sem nome"}
                              </p>
                              <p className="font-black text-foreground">
                                {formatCurrency(order.delivery_fee)}
                              </p>
                              <span
                                className={`w-fit rounded-full px-2 py-1 text-[11px] font-black ${
                                  isSettled
                                    ? "bg-yellow-400/10 text-yellow-400"
                                    : "bg-emerald-500/10 text-emerald-400"
                                }`}
                              >
                                {isSettled ? "Fechado" : "Em aberto"}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

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
                  const isCourierExpanded = expandedCourierId === courier.id

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
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedCourierId((current) =>
                                      current === courier.id ? null : courier.id
                                    )
                                  }
                                  aria-expanded={isCourierExpanded}
                                  className="max-w-full truncate text-left text-lg font-black text-foreground transition hover:text-primary"
                                  title={
                                    isCourierExpanded
                                      ? "Ocultar pedidos do motoboy"
                                      : "Ver pedidos do motoboy"
                                  }
                                >
                                  {courier.name}
                                </button>

                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                                    courier.pendingToReceiveToday > 0
                                      ? "bg-yellow-400/10 text-yellow-400"
                                      : courier.is_active
                                        ? "bg-emerald-500/10 text-emerald-400"
                                        : "bg-[#111111] text-zinc-500"
                                  }`}
                                >
                                  {courier.pendingToReceiveToday > 0
                                    ? "Taxas abertas"
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
                              Taxas abertas
                            </p>
                            <p className="text-lg font-black text-foreground">
                              {ordersLoading ? "..." : courier.ordersToday.length}
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
                            settlingCourierId === courier.id ||
                            settlementsLoading ||
                            courier.pendingToReceiveToday <= 0
                          }
                          className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            courier.pendingToReceiveToday <= 0
                              ? "border border-border bg-card text-muted-foreground"
                              : "border border-emerald-400/30 bg-[#0A0A0A] text-emerald-400 hover:bg-emerald-500/15"
                          }`}
                        >
                          {settlingCourierId === courier.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          {courier.pendingToReceiveToday <= 0 ? "Sem taxa aberta" : "Fechar taxa"}
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

                      {isCourierExpanded ? (
                        <div className="mt-4 rounded-xl border border-border bg-card p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                              Pedidos com taxa em aberto
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
                              Nenhuma taxa em aberto para esse motoboy.
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

                                  <span className="inline-flex w-fit items-center justify-center rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2 py-1 text-[10px] font-bold text-yellow-400">
                                    Taxa aberta
                                  </span>

                                  <p className="font-black text-foreground sm:text-right">
                                    {formatCurrency(order.delivery_fee)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
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
