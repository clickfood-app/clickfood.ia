"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
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
  cancelled_at: string | null
}

type DeliveryPersonWithStats = DeliveryPersonRow & {
  dayOrders: CourierOrderItem[]
  completedOrders: CourierOrderItem[]
  pendingPaymentOrders: CourierOrderItem[]
  dayAmount: number
  pendingAmount: number
  onRouteOrders: number
  allPendingAmount: number
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

  return [
    "out_for_delivery",
    "saiu_para_entrega",
    "delivering",
    "on_route",
    "em_rota",
    "em rota",
  ].includes(value)
}

function isDeliveredStatus(status: string | null | undefined) {
  const value = normalizeStatus(status)

  return [
    "delivered",
    "entregue",
    "finished",
    "completed",
    "concluido",
    "concluído",
  ].includes(value)
}

function isCancelledStatus(status: string | null | undefined) {
  return ["cancelled", "canceled", "cancelado"].includes(
    normalizeStatus(status)
  )
}

function isFinalizedDeliveryOrder(
  order:
    | Pick<CourierOrderItem, "status" | "delivered_at">
    | Pick<OrderRow, "status" | "delivered_at">
) {
  return Boolean(order.delivered_at) || isDeliveredStatus(order.status)
}

function isPayableDeliveryOrder(
  order: Pick<OrderRow, "delivery_fee" | "status" | "delivered_at">
) {
  return (
    Number(order.delivery_fee || 0) > 0 &&
    !isCancelledStatus(order.status) &&
    isFinalizedDeliveryOrder(order)
  )
}

function isOrderStillOnRoute(
  order:
    | Pick<CourierOrderItem, "status" | "delivered_at">
    | Pick<OrderRow, "status" | "delivered_at">
) {
  return isOnRouteStatus(order.status) && !isFinalizedDeliveryOrder(order)
}

function formatPixKeyType(type: string | null) {
  if (type === "cpf") return "CPF"
  if (type === "phone") return "Telefone"
  if (type === "email") return "E-mail"
  if (type === "random") return "Aleatória"

  return "Pix"
}

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—"

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function getOrderNumber(order: {
  id: string
  public_order_number: string | number | null
}) {
  return order.public_order_number !== null &&
    order.public_order_number !== undefined
    ? String(order.public_order_number)
    : order.id.slice(0, 8)
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

function formatDateKey(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-")

  return year && month && day ? `${day}/${month}/${year}` : value
}

function getOrderReferenceDate(
  order: Pick<OrderRow, "delivered_at" | "out_for_delivery_at" | "created_at">
) {
  return order.delivered_at || order.out_for_delivery_at || order.created_at
}

function getOrderStatusLabel(order: CourierOrderItem) {
  if (isCancelledStatus(order.status)) return "Cancelado"
  if (isFinalizedDeliveryOrder(order)) return "Entregue"
  if (isOrderStillOnRoute(order)) return "Em rota"

  return "Aguardando saída"
}

function getPaymentStatus(
  order: CourierOrderItem,
  paidOrderIds: Set<string>
) {
  if (isCancelledStatus(order.status)) {
    return {
      label: "Não aplicável",
      className: "bg-muted text-muted-foreground",
    }
  }

  if (!isFinalizedDeliveryOrder(order)) {
    return {
      label: "Em andamento",
      className: "bg-blue-500/10 text-blue-400",
    }
  }

  if (order.delivery_fee <= 0) {
    return {
      label: "Sem taxa",
      className: "bg-muted text-muted-foreground",
    }
  }

  if (paidOrderIds.has(order.id)) {
    return {
      label: "Pago",
      className: "bg-emerald-500/10 text-emerald-400",
    }
  }

  return {
    label: "Pendente",
    className: "bg-yellow-400/10 text-yellow-400",
  }
}

function getCourierPaymentStatus(courier: DeliveryPersonWithStats) {
  if (courier.completedOrders.length === 0) {
    return {
      label: "Sem entregas",
      className: "bg-muted text-muted-foreground",
    }
  }

  if (courier.dayAmount <= 0) {
    return {
      label: "Sem taxa",
      className: "bg-muted text-muted-foreground",
    }
  }

  if (courier.pendingAmount <= 0) {
    return {
      label: "Pago",
      className: "bg-emerald-500/10 text-emerald-400",
    }
  }

  if (courier.pendingAmount < courier.dayAmount) {
    return {
      label: "Parcial",
      className: "bg-orange-500/10 text-orange-400",
    }
  }

  return {
    label: "Pendente",
    className: "bg-yellow-400/10 text-yellow-400",
  }
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
  const [settlingCourierId, setSettlingCourierId] = useState<string | null>(
    null
  )
  const [settlementsLoading, setSettlementsLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)

  const [selectedDate, setSelectedDate] = useState(getTodayDateString())
  const [expandedCourierId, setExpandedCourierId] = useState<string | null>(
    null
  )

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

      if (!session) return

      const { data, error } = await supabase
        .from("delivery_people")
        .select(
          "id, restaurant_id, name, phone, pix_key, pix_key_type, notes, is_active, deleted_at, created_at"
        )
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

  async function loadOrders() {
    if (!restaurant?.id) return

    try {
      setOrdersLoading(true)

      const session = await ensureSupabaseSession()

      if (!session) return

      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, public_order_number, customer_name, delivery_person_id, delivery_fee, status, created_at, out_for_delivery_at, delivered_at, cancelled_at"
        )
        .eq("restaurant_id", restaurant.id)
        .not("delivery_person_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(2000)

      if (error) throw error

      setOrders((data || []) as OrderRow[])
      setLastUpdatedAt(new Date())
    } catch (err) {
      console.error("Erro ao carregar pedidos dos entregadores:", err)

      setError(
        getErrorMessage(err, "Erro ao carregar pedidos dos entregadores.")
      )
    } finally {
      setOrdersLoading(false)
    }
  }

  async function loadSettlements() {
    if (!restaurant?.id) return

    try {
      setSettlementsLoading(true)

      const session = await ensureSupabaseSession()

      if (!session) return

      const { data, error } = await supabase
        .from("delivery_settlements")
        .select(
          "id, restaurant_id, delivery_person_id, settlement_date, total_amount, total_orders, order_ids, payment_method, status, paid_at, notes, created_at"
        )
        .eq("restaurant_id", restaurant.id)
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(2000)

      if (error) throw error

      setSettlements((data || []) as DeliverySettlementRow[])
    } catch (err) {
      console.error("Erro ao carregar pagamentos dos entregadores:", err)

      setError(
        getErrorMessage(
          err,
          "Erro ao carregar pagamentos dos entregadores."
        )
      )
    } finally {
      setSettlementsLoading(false)
    }
  }

  async function loadInitialData() {
    if (!restaurant?.id) return

    setError(null)

    await Promise.all([
      loadDeliveryPeople(),
      loadOrders(),
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
        loadOrders(),
        loadSettlements(),
      ])
    } finally {
      setRefreshing(false)
    }
  }

  async function handleSaveCourier() {
    if (!restaurant?.id) return

    const trimmedName = name.trim()

    if (!trimmedName) {
      setError("Digite o nome do entregador.")
      return
    }

    try {
      setSaving(true)
      setError(null)

      const payload = {
        name: trimmedName,
        phone: phone.trim() || null,
        pix_key_type: pixKeyType.trim() || null,
        pix_key: pixKey.trim() || null,
        notes: notes.trim() || null,
      }

      if (editingCourierId) {
        const { error } = await supabase
          .from("delivery_people")
          .update(payload)
          .eq("id", editingCourierId)
          .eq("restaurant_id", restaurant.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from("delivery_people").insert({
          restaurant_id: restaurant.id,
          ...payload,
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

    if (courier.allPendingAmount > 0 && courier.is_active) {
      setError(
        "Esse entregador possui pagamentos pendentes. Confirme os pagamentos antes de desativar."
      )
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

    if (courier.allPendingAmount > 0) {
      setError(
        "Esse entregador possui pagamentos pendentes. Confirme os pagamentos antes de excluir."
      )
      return
    }

    const confirmed = window.confirm(
      `Excluir ${courier.name}? O histórico dos pedidos continuará salvo.`
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

      if (expandedCourierId === courier.id) {
        setExpandedCourierId(null)
      }

      await loadDeliveryPeople(true)
    } catch (err) {
      console.error("Erro ao excluir entregador:", err)
      setError(getErrorMessage(err, "Erro ao excluir entregador."))
    } finally {
      setBusyCourierId(null)
    }
  }

  async function handleMarkSettlementPaid(
    courier: DeliveryPersonWithStats
  ) {
    if (!restaurant?.id) return

    if (
      courier.pendingPaymentOrders.length === 0 ||
      courier.pendingAmount <= 0
    ) {
      setError(
        "Esse entregador não possui pagamento pendente nessa data."
      )
      return
    }

    const confirmed = window.confirm(
      `Confirmar o pagamento de ${formatCurrency(
        courier.pendingAmount
      )} para ${courier.name}, referente a ${
        courier.pendingPaymentOrders.length
      } entrega(s) de ${formatDateKey(selectedDate)}?`
    )

    if (!confirmed) return

    try {
      setSettlingCourierId(courier.id)
      setError(null)

      const orderIds = courier.pendingPaymentOrders.map(
        (order) => order.id
      )

      const { error } = await supabase
        .from("delivery_settlements")
        .insert({
          restaurant_id: restaurant.id,
          delivery_person_id: courier.id,
          settlement_date: selectedDate,
          total_amount: courier.pendingAmount,
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

        const {
          data: existingSettlement,
          error: fetchError,
        } = await supabase
          .from("delivery_settlements")
          .select(
            "id, restaurant_id, delivery_person_id, settlement_date, total_amount, total_orders, order_ids, payment_method, status, paid_at, notes, created_at"
          )
          .eq("restaurant_id", restaurant.id)
          .eq("delivery_person_id", courier.id)
          .eq("settlement_date", selectedDate)
          .eq("status", "paid")
          .maybeSingle()

        if (fetchError) throw fetchError

        if (!existingSettlement) {
          throw new Error(
            "Não foi possível localizar o pagamento já existente."
          )
        }

        const existingOrderIds = Array.isArray(
          existingSettlement.order_ids
        )
          ? existingSettlement.order_ids
          : []

        const existingOrderIdsSet = new Set(existingOrderIds)

        const newOrders = courier.pendingPaymentOrders.filter(
          (order) => !existingOrderIdsSet.has(order.id)
        )

        const mergedOrderIds = Array.from(
          new Set([
            ...existingOrderIds,
            ...newOrders.map((order) => order.id),
          ])
        )

        const amountToAdd = newOrders.reduce(
          (sum, order) => sum + order.delivery_fee,
          0
        )

        if (newOrders.length > 0 && amountToAdd > 0) {
          const { error: updateError } = await supabase
            .from("delivery_settlements")
            .update({
              total_amount:
                Number(existingSettlement.total_amount || 0) +
                amountToAdd,
              total_orders: mergedOrderIds.length,
              order_ids: mergedOrderIds,
              paid_at: new Date().toISOString(),
            })
            .eq("id", existingSettlement.id)
            .eq("restaurant_id", restaurant.id)

          if (updateError) throw updateError
        }
      }

      await Promise.all([loadOrders(), loadSettlements()])
    } catch (err) {
      console.error(
        "Erro ao confirmar pagamento do entregador:",
        err
      )

      setError(
        getErrorMessage(
          err,
          "Erro ao confirmar pagamento do entregador."
        )
      )
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
      void loadOrders()
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
          void loadOrders()
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

    document.addEventListener(
      "visibilitychange",
      handlePageBack
    )

    window.addEventListener("focus", handleWindowFocus)

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handlePageBack
      )

      window.removeEventListener("focus", handleWindowFocus)
    }
  }, [restaurant?.id, user?.id])

  const paidOrderIds = useMemo(() => {
    return new Set(
      settlements.flatMap((settlement) =>
        Array.isArray(settlement.order_ids)
          ? settlement.order_ids
          : []
      )
    )
  }, [settlements])

  const deliveryPeopleWithStats =
    useMemo<DeliveryPersonWithStats[]>(() => {
      return deliveryPeople
        .map((courier) => {
          const courierOrders = orders.filter(
            (order) => order.delivery_person_id === courier.id
          )

          const dayOrders = courierOrders
            .filter(
              (order) =>
                getLocalDateString(
                  getOrderReferenceDate(order)
                ) === selectedDate
            )
            .map((order) => ({
              id: order.id,
              public_order_number: order.public_order_number,
              customer_name: order.customer_name,
              delivery_fee: Number(order.delivery_fee || 0),
              status: order.status,
              created_at: order.created_at,
              out_for_delivery_at: order.out_for_delivery_at,
              delivered_at: order.delivered_at,
              cancelled_at: order.cancelled_at,
            }))

          const completedOrders = dayOrders.filter(
            (order) =>
              !isCancelledStatus(order.status) &&
              isFinalizedDeliveryOrder(order)
          )

          const pendingPaymentOrders = completedOrders.filter(
            (order) =>
              order.delivery_fee > 0 &&
              !paidOrderIds.has(order.id)
          )

          const dayAmount = completedOrders.reduce(
            (sum, order) => sum + order.delivery_fee,
            0
          )

          const pendingAmount = pendingPaymentOrders.reduce(
            (sum, order) => sum + order.delivery_fee,
            0
          )

          const onRouteOrders = dayOrders.filter(
            isOrderStillOnRoute
          ).length

          const allPendingAmount = courierOrders
            .filter(isPayableDeliveryOrder)
            .filter((order) => !paidOrderIds.has(order.id))
            .reduce(
              (sum, order) =>
                sum + Number(order.delivery_fee || 0),
              0
            )

          return {
            ...courier,
            dayOrders,
            completedOrders,
            pendingPaymentOrders,
            dayAmount,
            pendingAmount,
            onRouteOrders,
            allPendingAmount,
          }
        })
        .sort((a, b) => {
          if (a.pendingAmount !== b.pendingAmount) {
            return b.pendingAmount - a.pendingAmount
          }

          if (a.dayAmount !== b.dayAmount) {
            return b.dayAmount - a.dayAmount
          }

          if (a.is_active !== b.is_active) {
            return a.is_active ? -1 : 1
          }

          return a.name.localeCompare(b.name, "pt-BR")
        })
    }, [deliveryPeople, orders, paidOrderIds, selectedDate])

  const filteredCouriers = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return deliveryPeopleWithStats

    return deliveryPeopleWithStats.filter((courier) => {
      return (
        courier.name.toLowerCase().includes(term) ||
        (courier.phone || "").toLowerCase().includes(term) ||
        (courier.pix_key || "").toLowerCase().includes(term) ||
        courier.dayOrders.some(
          (order) =>
            getOrderNumber(order)
              .toLowerCase()
              .includes(term) ||
            (order.customer_name || "")
              .toLowerCase()
              .includes(term)
        )
      )
    })
  }, [deliveryPeopleWithStats, search])

  const expandedCourier = deliveryPeopleWithStats.find(
    (courier) => courier.id === expandedCourierId
  )

  const totalCompletedOrders = deliveryPeopleWithStats.reduce(
    (sum, courier) => sum + courier.completedOrders.length,
    0
  )

  const totalDayAmount = deliveryPeopleWithStats.reduce(
    (sum, courier) => sum + courier.dayAmount,
    0
  )

  const totalPendingAmount = deliveryPeopleWithStats.reduce(
    (sum, courier) => sum + courier.pendingAmount,
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
              Confira as entregas do dia e confirme o pagamento
              de cada entregador.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

        {showForm ? (
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-foreground">
                  {editingCourierId
                    ? "Editar entregador"
                    : "Cadastrar entregador"}
                </h2>

                <p className="text-xs text-muted-foreground">
                  Nome é obrigatório. Os outros campos são
                  opcionais.
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
                onChange={(event) =>
                  setPhone(event.target.value)
                }
                placeholder="Telefone"
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
              />

              <select
                value={pixKeyType}
                onChange={(event) =>
                  setPixKeyType(event.target.value)
                }
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
                onChange={(event) =>
                  setPixKey(event.target.value)
                }
                placeholder="Chave Pix"
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>

            <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                type="text"
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
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

        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => {
                      if (!event.target.value) return

                      setSelectedDate(event.target.value)
                      setExpandedCourierId(null)
                    }}
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-bold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />

                  {selectedDate !== getTodayDateString() ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(getTodayDateString())
                        setExpandedCourierId(null)
                      }}
                      className="h-10 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground transition hover:bg-muted/40"
                    >
                      Hoje
                    </button>
                  ) : null}
                </div>

                <div className="relative w-full sm:w-[320px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Buscar entregador, cliente ou pedido..."
                    className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                <div>
                  <span className="font-semibold text-muted-foreground">
                    Entregas
                  </span>

                  <span className="ml-2 font-black text-foreground">
                    {ordersLoading
                      ? "..."
                      : totalCompletedOrders}
                  </span>
                </div>

                <div>
                  <span className="font-semibold text-muted-foreground">
                    Total do dia
                  </span>

                  <span className="ml-2 font-black text-foreground">
                    {ordersLoading
                      ? "..."
                      : formatCurrency(totalDayAmount)}
                  </span>
                </div>

                <div>
                  <span className="font-semibold text-muted-foreground">
                    Pendente
                  </span>

                  <span className="ml-2 font-black text-yellow-400">
                    {ordersLoading
                      ? "..."
                      : formatCurrency(totalPendingAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-semibold text-muted-foreground">
              <span>{formatDateKey(selectedDate)}</span>

              <span>
                {lastUpdatedAt
                  ? `Atualizado às ${lastUpdatedAt.toLocaleTimeString(
                      "pt-BR",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}`
                  : "Aguardando dados"}
              </span>
            </div>
          </div>

          {loadingPage ? (
            <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando entregadores...
            </div>
          ) : filteredCouriers.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center px-5 text-center">
              <p className="text-sm font-bold text-foreground">
                Nenhum entregador encontrado
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Cadastre um entregador ou ajuste a busca.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden border-b border-border bg-background px-3 py-2 text-[11px] font-black uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[1.4fr_0.55fr_0.55fr_0.85fr_0.75fr_auto] md:items-center md:gap-3">
                <span>Entregador</span>
                <span>Entregas</span>
                <span>Em rota</span>
                <span>Valor do dia</span>
                <span>Pagamento</span>
                <span className="text-right">Ações</span>
              </div>

              <div className="divide-y divide-border">
                {filteredCouriers.map((courier) => {
                  const isBusy =
                    busyCourierId === courier.id

                  const isExpanded =
                    expandedCourierId === courier.id

                  const paymentStatus =
                    getCourierPaymentStatus(courier)

                  return (
                    <div
                      key={courier.id}
                      className="grid gap-3 px-3 py-3 transition hover:bg-muted/20 md:grid-cols-[1.4fr_0.55fr_0.55fr_0.85fr_0.75fr_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-black text-foreground">
                            {courier.name}
                          </p>

                          {!courier.is_active ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-black text-muted-foreground">
                              Inativo
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {courier.pix_key
                            ? `${formatPixKeyType(
                                courier.pix_key_type
                              )} cadastrado`
                            : "Pix não cadastrado"}
                        </p>
                      </div>

                      <div className="flex items-center justify-between md:block">
                        <span className="text-xs font-semibold text-muted-foreground md:hidden">
                          Entregas concluídas
                        </span>

                        <span className="text-sm font-black text-foreground">
                          {ordersLoading
                            ? "..."
                            : courier.completedOrders.length}
                        </span>
                      </div>

                      <div className="flex items-center justify-between md:block">
                        <span className="text-xs font-semibold text-muted-foreground md:hidden">
                          Em rota
                        </span>

                        <span className="text-sm font-black text-foreground">
                          {ordersLoading
                            ? "..."
                            : courier.onRouteOrders}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3 md:block">
                        <span className="text-xs font-semibold text-muted-foreground md:hidden">
                          Valor do dia
                        </span>

                        <div className="text-right md:text-left">
                          <p className="text-sm font-black text-foreground">
                            {ordersLoading
                              ? "..."
                              : formatCurrency(
                                  courier.dayAmount
                                )}
                          </p>

                          {courier.pendingAmount > 0 ? (
                            <p className="text-[11px] font-bold text-yellow-400">
                              {formatCurrency(
                                courier.pendingAmount
                              )}{" "}
                              pendente
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:block">
                        <span className="text-xs font-semibold text-muted-foreground md:hidden">
                          Pagamento
                        </span>

                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[11px] font-black ${paymentStatus.className}`}
                        >
                          {paymentStatus.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCourierId(
                              isExpanded
                                ? null
                                : courier.id
                            )
                          }
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground transition hover:bg-muted/40"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}

                          Entregas
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void handleMarkSettlementPaid(
                              courier
                            )
                          }
                          disabled={
                            settlingCourierId ===
                              courier.id ||
                            settlementsLoading ||
                            courier.pendingAmount <= 0
                          }
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:border-border disabled:bg-background disabled:text-muted-foreground disabled:opacity-60"
                        >
                          {settlingCourierId ===
                          courier.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}

                          {courier.pendingAmount > 0
                            ? "Confirmar"
                            : "Pago"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleEditCourier(courier)
                          }
                          title="Editar entregador"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:bg-muted/40"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void handleToggleActive(courier)
                          }
                          disabled={isBusy}
                          title={
                            courier.is_active
                              ? "Desativar entregador"
                              : "Ativar entregador"
                          }
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
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
                          onClick={() =>
                            void handleDeleteCourier(courier)
                          }
                          disabled={isBusy}
                          title="Excluir entregador"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {expandedCourier ? (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-black text-foreground">
                  Entregas de {expandedCourier.name}
                </h2>

                <p className="text-xs text-muted-foreground">
                  Pedidos atribuídos em{" "}
                  {formatDateKey(selectedDate)}.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setExpandedCourierId(null)
                }
                className="h-8 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground transition hover:bg-muted/40"
              >
                Fechar histórico
              </button>
            </div>

            {expandedCourier.dayOrders.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                Nenhum pedido atribuído a esse entregador
                nessa data.
              </div>
            ) : (
              <>
                <div className="hidden border-b border-border bg-background px-3 py-2 text-[11px] font-black uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[0.65fr_1.4fr_0.7fr_0.7fr_0.7fr_0.8fr_0.8fr] md:gap-3">
                  <span>Pedido</span>
                  <span>Cliente</span>
                  <span>Saída</span>
                  <span>Entrega</span>
                  <span>Taxa</span>
                  <span>Status</span>
                  <span>Pagamento</span>
                </div>

                <div className="divide-y divide-border">
                  {expandedCourier.dayOrders.map(
                    (order) => {
                      const paymentStatus =
                        getPaymentStatus(
                          order,
                          paidOrderIds
                        )

                      return (
                        <div
                          key={order.id}
                          className="grid grid-cols-2 gap-3 px-3 py-3 text-sm transition hover:bg-muted/20 md:grid-cols-[0.65fr_1.4fr_0.7fr_0.7fr_0.7fr_0.8fr_0.8fr] md:items-center"
                        >
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground md:hidden">
                              Pedido
                            </p>

                            <p className="font-black text-foreground">
                              #{getOrderNumber(order)}
                            </p>
                          </div>

                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-muted-foreground md:hidden">
                              Cliente
                            </p>

                            <p className="truncate font-bold text-foreground">
                              {order.customer_name ||
                                "Cliente não informado"}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground md:hidden">
                              Saída
                            </p>

                            <p className="font-semibold text-foreground">
                              {formatTime(
                                order.out_for_delivery_at
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground md:hidden">
                              Entrega
                            </p>

                            <p className="font-semibold text-foreground">
                              {formatTime(
                                order.delivered_at
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground md:hidden">
                              Taxa
                            </p>

                            <p className="font-black text-foreground">
                              {formatCurrency(
                                order.delivery_fee
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground md:hidden">
                              Status
                            </p>

                            <p className="font-bold text-foreground">
                              {getOrderStatusLabel(order)}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground md:hidden">
                              Pagamento
                            </p>

                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ${paymentStatus.className}`}
                            >
                              {paymentStatus.label}
                            </span>
                          </div>
                        </div>
                      )
                    }
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}

        <p className="px-1 text-[11px] font-semibold text-muted-foreground">
          O pagamento considera somente pedidos concluídos,
          com taxa de entrega e ainda não pagos.
        </p>
      </div>
    </AdminLayout>
  )
}