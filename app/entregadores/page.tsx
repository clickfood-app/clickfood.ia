"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Loader2,
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
  openFeeOrders: CourierOrderItem[]
  openFeeAmount: number
  onRouteOrders: number
  deliveredOrders: number
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

function formatPixKeyType(type: string | null) {
  if (type === "cpf") return "CPF"
  if (type === "phone") return "Telefone"
  if (type === "email") return "E-mail"
  if (type === "random") return "Aleatória"

  return "Pix"
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

function getDaysAgoDateString(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)

  return getLocalDateString(date)
}

function getCurrentMonthStartDateString() {
  const date = new Date()

  return getLocalDateString(new Date(date.getFullYear(), date.getMonth(), 1))
}

function getOrderAccountingDate(order: Pick<OrderRow, "delivered_at" | "out_for_delivery_at" | "created_at">) {
  return order.delivered_at || order.out_for_delivery_at || order.created_at
}

function getDateKey(value: Date | string) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  return getLocalDateString(value)
}

function isDateInsidePeriod(value: Date | string, startDate: string, endDate: string) {
  const dateKey = getDateKey(value)

  if (startDate && dateKey < startDate) return false
  if (endDate && dateKey > endDate) return false

  return true
}

function formatDateKey(value: string) {
  const dateKey = value.slice(0, 10)
  const [year, month, day] = dateKey.split("-")

  if (!year || !month || !day) return value

  return `${day}/${month}/${year}`
}

function getPeriodLabel(startDate: string, endDate: string) {
  if (!startDate && !endDate) return "Todas as taxas abertas"
  if (startDate && endDate && startDate === endDate) return formatDateKey(startDate)
  if (startDate && endDate) return `${formatDateKey(startDate)} até ${formatDateKey(endDate)}`
  if (startDate) return `A partir de ${formatDateKey(startDate)}`
  return `Até ${formatDateKey(endDate)}`
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
  const [showHistory, setShowHistory] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const [editingCourierId, setEditingCourierId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [pixKeyType, setPixKeyType] = useState("")
  const [pixKey, setPixKey] = useState("")
  const [notes, setNotes] = useState("")

  const hasInvalidPeriod = Boolean(startDate && endDate && startDate > endDate)

  function resetForm() {
    setEditingCourierId(null)
    setName("")
    setPhone("")
    setPixKeyType("")
    setPixKey("")
    setNotes("")
    setShowForm(false)
  }

  function applyAllOpenPeriod() {
    setStartDate("")
    setEndDate("")
  }

  function applyTodayPeriod() {
    const today = getTodayDateString()

    setStartDate(today)
    setEndDate(today)
  }

  function applyYesterdayPeriod() {
    const yesterday = getYesterdayDateString()

    setStartDate(yesterday)
    setEndDate(yesterday)
  }

  function applyLastSevenDaysPeriod() {
    setStartDate(getDaysAgoDateString(6))
    setEndDate(getTodayDateString())
  }

  function applyCurrentMonthPeriod() {
    setStartDate(getCurrentMonthStartDateString())
    setEndDate(getTodayDateString())
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
      console.error("Erro ao carregar entregadores:", err)
      setError(getErrorMessage(err, "Erro ao carregar entregadores."))
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
      console.error("Erro ao carregar pedidos dos entregadores:", err)
      setError(getErrorMessage(err, "Erro ao carregar pedidos dos entregadores."))
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
      console.error("Erro ao carregar fechamentos de taxas:", err)
      setError(getErrorMessage(err, "Erro ao carregar fechamentos de taxas."))
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
      setError("Digite o nome do entregador.")
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
      console.error("Erro ao salvar entregador:", err)
      setError(getErrorMessage(err, "Erro ao salvar entregador."))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(courier: DeliveryPersonWithStats) {
    if (!restaurant?.id) return

    if (courier.openFeeAmount > 0 && courier.is_active) {
      setError("Esse entregador possui taxas em aberto. Feche as taxas antes de desativar.")
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
      console.error("Erro ao atualizar entregador:", err)
      setError(getErrorMessage(err, "Erro ao atualizar entregador."))
    } finally {
      setBusyCourierId(null)
    }
  }

  async function handleDeleteCourier(courier: DeliveryPersonWithStats) {
    if (!restaurant?.id) return

    if (courier.openFeeAmount > 0) {
      setError("Esse entregador possui taxas em aberto. Feche as taxas antes de excluir.")
      return
    }

    const confirmed = window.confirm(
      `Excluir ${courier.name}? Ele será removido da tela, mas o histórico dos pedidos continuará salvo.`
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
      console.error("Erro ao excluir entregador:", err)
      setError(getErrorMessage(err, "Erro ao excluir entregador."))
    } finally {
      setBusyCourierId(null)
    }
  }

  async function handleMarkSettlementPaid(courier: DeliveryPersonWithStats) {
    if (!restaurant?.id) return

    if (hasInvalidPeriod) {
      setError("A data inicial não pode ser maior que a data final.")
      return
    }

    if (courier.openFeeOrders.length === 0 || courier.openFeeAmount <= 0) {
      setError("Esse entregador não tem taxa em aberto no período selecionado.")
      return
    }

    const confirmed = window.confirm(
      `Fechar ${formatCurrency(courier.openFeeAmount)} em taxas para ${courier.name}?`
    )

    if (!confirmed) return

    try {
      setSettlingCourierId(courier.id)
      setError(null)

      const settlementDate = getTodayDateString()
      const orderIds = courier.openFeeOrders.map((order) => order.id)

      const { error } = await supabase.from("delivery_settlements").insert({
        restaurant_id: restaurant.id,
        delivery_person_id: courier.id,
        settlement_date: settlementDate,
        total_amount: courier.openFeeAmount,
        total_orders: orderIds.length,
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

        const existingOrderIdsSet = new Set(existingOrderIds)
        const newOrders = courier.openFeeOrders.filter((order) => !existingOrderIdsSet.has(order.id))
        const newOrderIds = newOrders.map((order) => order.id)
        const mergedOrderIds = Array.from(new Set([...existingOrderIds, ...newOrderIds]))
        const amountToAdd = newOrders.reduce((sum, order) => sum + Number(order.delivery_fee || 0), 0)

        if (newOrderIds.length > 0 && amountToAdd > 0) {
          const { error: updateError } = await supabase
            .from("delivery_settlements")
            .update({
              total_amount: Number(existingSettlement.total_amount || 0) + amountToAdd,
              total_orders: mergedOrderIds.length,
              order_ids: mergedOrderIds,
              paid_at: new Date().toISOString(),
            })
            .eq("id", existingSettlement.id)
            .eq("restaurant_id", restaurant.id)

          if (updateError) throw updateError
        }
      }

      await Promise.all([loadOrdersToSettle(), loadSettlements()])
    } catch (err) {
      console.error("Erro ao fechar taxas do entregador:", err)
      setError(getErrorMessage(err, "Erro ao fechar taxas do entregador."))
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
        const openFeeOrders = orders
          .filter((order) => order.delivery_person_id === courier.id)
          .filter((order) => isPayableDeliveryOrder(order))
          .filter((order) => !paidOrderIds.has(order.id))
          .filter((order) => {
            if (hasInvalidPeriod) return false

            return isDateInsidePeriod(getOrderAccountingDate(order), startDate, endDate)
          })
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

        const openFeeAmount = openFeeOrders.reduce(
          (sum, order) => sum + Number(order.delivery_fee || 0),
          0
        )

        const onRouteOrders = openFeeOrders.filter((order) =>
          isOrderStillOnRoute(order)
        ).length

        const deliveredOrders = openFeeOrders.filter((order) =>
          isFinalizedDeliveryOrder(order)
        ).length

        return {
          ...courier,
          openFeeOrders,
          openFeeAmount,
          onRouteOrders,
          deliveredOrders,
        }
      })
      .sort((a, b) => {
        if (a.openFeeAmount !== b.openFeeAmount) {
          return b.openFeeAmount - a.openFeeAmount
        }

        if (a.openFeeOrders.length !== b.openFeeOrders.length) {
          return b.openFeeOrders.length - a.openFeeOrders.length
        }

        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1

        return a.name.localeCompare(b.name, "pt-BR")
      })
  }, [deliveryPeople, orders, paidOrderIds, startDate, endDate, hasInvalidPeriod])

  const filteredCouriers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) return deliveryPeopleWithStats

    return deliveryPeopleWithStats.filter((courier) => {
      return (
        courier.name.toLowerCase().includes(normalizedSearch) ||
        (courier.phone || "").toLowerCase().includes(normalizedSearch) ||
        (courier.pix_key || "").toLowerCase().includes(normalizedSearch) ||
        courier.openFeeOrders.some((order) =>
          getOrderNumber(order).toLowerCase().includes(normalizedSearch)
        )
      )
    })
  }, [deliveryPeopleWithStats, search])

  const activeCouriers = deliveryPeopleWithStats.filter((item) => item.is_active).length
  const totalOpenOrders = deliveryPeopleWithStats.reduce(
    (sum, item) => sum + item.openFeeOrders.length,
    0
  )
  const totalOpenAmount = deliveryPeopleWithStats.reduce(
    (sum, item) => sum + item.openFeeAmount,
    0
  )
  const totalOnRouteOrders = deliveryPeopleWithStats.reduce(
    (sum, item) => sum + item.onRouteOrders,
    0
  )
  const couriersWithOpenFee = deliveryPeopleWithStats.filter((item) => item.openFeeAmount > 0).length

  const settlementHistory = useMemo(() => {
    return settlements.filter((settlement) => {
      if (hasInvalidPeriod) return false

      return isDateInsidePeriod(settlement.settlement_date, startDate, endDate)
    })
  }, [settlements, startDate, endDate, hasInvalidPeriod])

  const totalSettledInPeriod = settlementHistory.reduce(
    (sum, settlement) => sum + Number(settlement.total_amount || 0),
    0
  )

  return (
    <AdminLayout>
      <div className="space-y-3 p-3 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
              Entregadores
            </h1>
            <p className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">
              Controle rápido das taxas em aberto por entregador.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHistory((current) => !current)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-bold text-foreground transition hover:bg-muted/40"
            >
              <Wallet className="h-4 w-4" />
              {showHistory ? "Ocultar histórico" : "Histórico"}
            </button>

            <button
              type="button"
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Novo entregador
            </button>

            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={refreshing}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-bold text-foreground transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 sm:text-sm">
            {error}
          </div>
        ) : null}

        {hasInvalidPeriod ? (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-800 sm:text-sm">
            A data inicial não pode ser maior que a data final.
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-card">
          <div className="space-y-3 border-b border-border p-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <button
                  type="button"
                  onClick={applyAllOpenPeriod}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground transition hover:bg-muted/40"
                >
                  Tudo aberto
                </button>

                <button
                  type="button"
                  onClick={applyTodayPeriod}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground transition hover:bg-muted/40"
                >
                  Hoje
                </button>

                <button
                  type="button"
                  onClick={applyYesterdayPeriod}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground transition hover:bg-muted/40"
                >
                  Ontem
                </button>

                <button
                  type="button"
                  onClick={applyLastSevenDaysPeriod}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground transition hover:bg-muted/40"
                >
                  7 dias
                </button>

                <button
                  type="button"
                  onClick={applyCurrentMonthPeriod}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground transition hover:bg-muted/40"
                >
                  Mês
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-xs font-bold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 sm:w-[150px]"
                />

                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-xs font-bold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 sm:w-[150px]"
                />
              </div>
            </div>

            <div className="grid gap-2 text-xs sm:grid-cols-5">
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="font-bold text-muted-foreground">Período</p>
                <p className="mt-0.5 truncate font-black text-foreground">
                  {getPeriodLabel(startDate, endDate)}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="font-bold text-muted-foreground">Total aberto</p>
                <p className="mt-0.5 font-black text-foreground">
                  {ordersLoading ? "..." : formatCurrency(totalOpenAmount)}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="font-bold text-muted-foreground">Entregas</p>
                <p className="mt-0.5 font-black text-foreground">
                  {ordersLoading ? "..." : totalOpenOrders}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="font-bold text-muted-foreground">Em rota</p>
                <p className="mt-0.5 font-black text-foreground">
                  {ordersLoading ? "..." : totalOnRouteOrders}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="font-bold text-muted-foreground">Com taxa</p>
                <p className="mt-0.5 font-black text-foreground">
                  {ordersLoading ? "..." : couriersWithOpenFee}
                </p>
              </div>
            </div>
          </div>

          {showForm ? (
            <div className="border-b border-border p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black text-foreground">
                    {editingCourierId ? "Editar entregador" : "Cadastrar entregador"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Nome é obrigatório. Os outros campos são opcionais.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetForm}
                  className="h-8 rounded-lg border border-border px-3 text-xs font-bold text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_0.8fr_1.2fr]">
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nome do entregador"
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                />

                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Telefone"
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                />

                <select
                  value={pixKeyType}
                  onChange={(event) => setPixKeyType(event.target.value)}
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">Tipo Pix</option>
                  <option value="cpf">CPF</option>
                  <option value="phone">Telefone</option>
                  <option value="email">E-mail</option>
                  <option value="random">Aleatória</option>
                </select>

                <input
                  type="text"
                  value={pixKey}
                  onChange={(event) => setPixKey(event.target.value)}
                  placeholder="Chave Pix"
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Observação opcional"
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                />

                <button
                  type="button"
                  onClick={() => void handleSaveCourier()}
                  disabled={saving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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

          <div className="border-b border-border p-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar entregador ou pedido..."
                  className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
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

          <div>
            {loadingPage ? (
              <div className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando entregadores...
              </div>
            ) : filteredCouriers.length === 0 ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center px-5 text-center">
                <p className="text-sm font-bold text-foreground">
                  Nenhum entregador encontrado
                </p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Cadastre um entregador ou ajuste os filtros da busca.
                </p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="border-b border-border bg-background text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-black">Entregador</th>
                        <th className="px-3 py-2 font-black">Entregas</th>
                        <th className="px-3 py-2 font-black">Em rota</th>
                        <th className="px-3 py-2 font-black">Entregues</th>
                        <th className="px-3 py-2 font-black">Aberto</th>
                        <th className="px-3 py-2 font-black">Status</th>
                        <th className="px-3 py-2 text-right font-black">Ações</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                      {filteredCouriers.map((courier) => {
                        const isBusy = busyCourierId === courier.id
                        const hasOpenFee = courier.openFeeAmount > 0

                        return (
                          <tr key={courier.id} className="bg-card transition hover:bg-muted/30">
                            <td className="px-3 py-2">
                              <p className="font-black text-foreground">
                                {courier.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {courier.pix_key
                                  ? `${formatPixKeyType(courier.pix_key_type)} cadastrado`
                                  : "Pix não cadastrado"}
                              </p>
                            </td>

                            <td className="px-3 py-2 font-bold text-foreground">
                              {ordersLoading ? "..." : courier.openFeeOrders.length}
                            </td>

                            <td className="px-3 py-2 font-bold text-foreground">
                              {ordersLoading ? "..." : courier.onRouteOrders}
                            </td>

                            <td className="px-3 py-2 font-bold text-foreground">
                              {ordersLoading ? "..." : courier.deliveredOrders}
                            </td>

                            <td className="px-3 py-2 font-black text-foreground">
                              {ordersLoading ? "..." : formatCurrency(courier.openFeeAmount)}
                            </td>

                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-[11px] font-black ${
                                  hasOpenFee
                                    ? "bg-yellow-400/10 text-yellow-400"
                                    : courier.is_active
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : "bg-[#111111] text-zinc-500"
                                }`}
                              >
                                {hasOpenFee ? "Taxa aberta" : courier.is_active ? "Ativo" : "Inativo"}
                              </span>
                            </td>

                            <td className="px-3 py-2">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void handleMarkSettlementPaid(courier)}
                                  disabled={
                                    settlingCourierId === courier.id ||
                                    settlementsLoading ||
                                    !hasOpenFee ||
                                    hasInvalidPeriod
                                  }
                                  className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                    hasOpenFee
                                      ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15"
                                      : "border border-border bg-background text-muted-foreground"
                                  }`}
                                >
                                  {settlingCourierId === courier.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}
                                  {hasOpenFee ? "Fechar" : "Sem taxa"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleEditCourier(courier)}
                                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-bold text-foreground transition hover:bg-muted/40"
                                >
                                  <UserRound className="h-3.5 w-3.5" />
                                  Editar
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void handleToggleActive(courier)}
                                  disabled={isBusy}
                                  className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-xs font-bold text-foreground transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isBusy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : courier.is_active ? (
                                    <XCircle className="h-3.5 w-3.5" />
                                  ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void handleDeleteCourier(courier)}
                                  disabled={isBusy}
                                  className="inline-flex h-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isBusy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-border md:hidden">
                  {filteredCouriers.map((courier) => {
                    const isBusy = busyCourierId === courier.id
                    const hasOpenFee = courier.openFeeAmount > 0

                    return (
                      <div key={courier.id} className="px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-foreground">
                              {courier.name}
                            </p>

                            <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                              {ordersLoading
                                ? "Carregando taxas..."
                                : `${courier.openFeeOrders.length} entrega(s) · ${courier.onRouteOrders} em rota · ${courier.deliveredOrders} entregue(s)`}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-sm font-black text-foreground">
                              {ordersLoading ? "..." : formatCurrency(courier.openFeeAmount)}
                            </p>
                            <p
                              className={`mt-0.5 text-[11px] font-black ${
                                hasOpenFee
                                  ? "text-yellow-400"
                                  : courier.is_active
                                    ? "text-emerald-400"
                                    : "text-zinc-500"
                              }`}
                            >
                              {hasOpenFee ? "Aberto" : courier.is_active ? "Ativo" : "Inativo"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
                          <button
                            type="button"
                            onClick={() => void handleMarkSettlementPaid(courier)}
                            disabled={
                              settlingCourierId === courier.id ||
                              settlementsLoading ||
                              !hasOpenFee ||
                              hasInvalidPeriod
                            }
                            className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              hasOpenFee
                                ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-400"
                                : "border border-border bg-background text-muted-foreground"
                            }`}
                          >
                            {settlingCourierId === courier.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            {hasOpenFee ? "Fechar" : "Sem taxa"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEditCourier(courier)}
                            className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground"
                          >
                            <UserRound className="h-3.5 w-3.5" />
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleToggleActive(courier)}
                            disabled={isBusy}
                            className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : courier.is_active ? (
                              "Desativar"
                            ) : (
                              "Ativar"
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDeleteCourier(courier)}
                            disabled={isBusy}
                            className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {showHistory ? (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex flex-col gap-1 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-black text-foreground">
                  Histórico de fechamentos
                </h2>
                <p className="text-xs text-muted-foreground">
                  Mostrando os fechamentos dentro do período selecionado.
                </p>
              </div>

              <div className="text-xs font-bold text-muted-foreground">
                Total fechado:{" "}
                <span className="font-black text-foreground">
                  {settlementsLoading ? "..." : formatCurrency(totalSettledInPeriod)}
                </span>
              </div>
            </div>

            {settlementsLoading ? (
              <div className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando histórico...
              </div>
            ) : settlementHistory.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                Nenhum fechamento encontrado no período selecionado.
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="border-b border-border bg-background text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-black">Data</th>
                        <th className="px-3 py-2 font-black">Entregador</th>
                        <th className="px-3 py-2 font-black">Pedidos</th>
                        <th className="px-3 py-2 font-black">Valor</th>
                        <th className="px-3 py-2 font-black">Hora</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                      {settlementHistory.map((settlement) => {
                        const courier = deliveryPeople.find(
                          (item) => item.id === settlement.delivery_person_id
                        )

                        return (
                          <tr key={settlement.id} className="bg-card transition hover:bg-muted/30">
                            <td className="px-3 py-2 font-bold text-foreground">
                              {formatDateKey(settlement.settlement_date)}
                            </td>

                            <td className="px-3 py-2 font-black text-foreground">
                              {courier?.name || "Entregador removido"}
                            </td>

                            <td className="px-3 py-2 font-bold text-foreground">
                              {settlement.total_orders}
                            </td>

                            <td className="px-3 py-2 font-black text-foreground">
                              {formatCurrency(settlement.total_amount)}
                            </td>

                            <td className="px-3 py-2 font-bold text-muted-foreground">
                              {settlement.paid_at ? formatTime(settlement.paid_at) : "Pago"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-border md:hidden">
                  {settlementHistory.map((settlement) => {
                    const courier = deliveryPeople.find(
                      (item) => item.id === settlement.delivery_person_id
                    )

                    return (
                      <div key={settlement.id} className="px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-foreground">
                              {courier?.name || "Entregador removido"}
                            </p>

                            <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                              {formatDateKey(settlement.settlement_date)} · {settlement.total_orders} pedido(s)
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-sm font-black text-foreground">
                              {formatCurrency(settlement.total_amount)}
                            </p>

                            <p className="mt-0.5 text-[11px] font-bold text-muted-foreground">
                              {settlement.paid_at ? formatTime(settlement.paid_at) : "Pago"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        ) : null}

        <p className="px-1 text-[11px] font-semibold text-muted-foreground">
          Entregadores ativos: {loadingPage ? "..." : activeCouriers}
        </p>
      </div>
    </AdminLayout>
  )
}