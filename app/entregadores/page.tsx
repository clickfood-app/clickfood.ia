"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bike,
  CheckCircle2,
  Clock3,
  Loader2,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Truck,
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
  is_active: boolean
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

type CourierFilter = "all" | "active" | "inactive"

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
  lastRouteAt: string | null
  ordersToday: CourierOrderItem[]
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
    value === "completed"
  )
}

function isCancelledStatus(status: string | null | undefined) {
  const value = normalizeStatus(status)

  return (
    value === "cancelled" ||
    value === "canceled" ||
    value === "cancelado"
  )
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
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

function getStatusLabel(status: string | null | undefined) {
  if (isOnRouteStatus(status)) return "Em rota"
  if (isDeliveredStatus(status)) return "Entregue"
  if (isCancelledStatus(status)) return "Cancelado"
  return "Aberto"
}

function getStatusTone(status: string | null | undefined) {
  if (isOnRouteStatus(status)) return "bg-emerald-100 text-emerald-700"
  if (isDeliveredStatus(status)) return "bg-blue-100 text-blue-700"
  if (isCancelledStatus(status)) return "bg-red-100 text-red-700"
  return "bg-amber-100 text-amber-700"
}

export default function EntregadoresPage() {
  const { restaurant, user, isLoading: authLoading } = useAuth()

  const [deliveryPeople, setDeliveryPeople] = useState<DeliveryPersonRow[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])

  const [loadingPage, setLoadingPage] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyCourierId, setBusyCourierId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<CourierFilter>("all")
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null)

  const [editingCourierId, setEditingCourierId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")

  function resetForm() {
    setEditingCourierId(null)
    setName("")
    setPhone("")
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
        .select("id, restaurant_id, name, phone, is_active, created_at")
        .eq("restaurant_id", restaurant.id)
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

  async function loadInitialData() {
    if (!restaurant?.id) return

    setError(null)
    await loadDeliveryPeople()
    void loadOrdersToday()
  }

  async function refreshAll() {
    if (!restaurant?.id) return

    setError(null)
    setRefreshing(true)

    try {
      await Promise.all([loadDeliveryPeople(true), loadOrdersToday()])
    } finally {
      setRefreshing(false)
    }
  }

  async function handleSaveCourier() {
    if (!restaurant?.id) return

    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()

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

  function handleEditCourier(courier: DeliveryPersonRow) {
    setEditingCourierId(courier.id)
    setName(courier.name)
    setPhone(courier.phone || "")
  }

  useEffect(() => {
    if (authLoading) {
      setLoadingPage(true)
      return
    }

    if (!user || !restaurant?.id) {
      setDeliveryPeople([])
      setOrders([])
      setLoadingPage(false)
      setOrdersLoading(false)
      setRefreshing(false)
      setError(null)
      return
    }

    void loadInitialData()

    const ordersRefreshInterval = window.setInterval(() => {
      void loadOrdersToday()
    }, 20000)

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

    return () => {
      window.clearInterval(ordersRefreshInterval)
      void supabase.removeChannel(deliveryPeopleChannel)
      void supabase.removeChannel(ordersChannel)
    }
  }, [authLoading, restaurant?.id, user?.id])

  useEffect(() => {
    if (!restaurant?.id || !user?.id) return

    const handlePageBack = () => {
      if (document.visibilityState === "visible") {
        void loadDeliveryPeople(true)
        void loadOrdersToday()
      }
    }

    const handleWindowFocus = () => {
      void loadDeliveryPeople(true)
      void loadOrdersToday()
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

        const sortedRouteDates = courierOrders
          .map((order) => order.out_for_delivery_at)
          .filter(Boolean)
          .sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())

        return {
          ...courier,
          openOrders,
          onRouteOrders,
          deliveredToday,
          totalToReceiveToday,
          lastRouteAt: (sortedRouteDates[0] as string | undefined) || null,
          ordersToday: courierOrders,
        }
      })
      .sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
        if (a.totalToReceiveToday !== b.totalToReceiveToday) {
          return b.totalToReceiveToday - a.totalToReceiveToday
        }
        if (a.onRouteOrders !== b.onRouteOrders) return b.onRouteOrders - a.onRouteOrders
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
  }, [deliveryPeople, orders])

  const filteredCouriers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return deliveryPeopleWithStats.filter((courier) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && courier.is_active) ||
        (filter === "inactive" && !courier.is_active)

      if (!matchesFilter) return false

      if (!normalizedSearch) return true

      return (
        courier.name.toLowerCase().includes(normalizedSearch) ||
        (courier.phone || "").toLowerCase().includes(normalizedSearch)
      )
    })
  }, [deliveryPeopleWithStats, filter, search])

  useEffect(() => {
    if (filteredCouriers.length === 0) {
      setSelectedCourierId(null)
      return
    }

    const stillExists = filteredCouriers.some(
      (courier) => courier.id === selectedCourierId
    )

    if (!stillExists) {
      setSelectedCourierId(filteredCouriers[0].id)
    }
  }, [filteredCouriers, selectedCourierId])

  const selectedCourier =
    filteredCouriers.find((courier) => courier.id === selectedCourierId) || null

  const totalCouriers = deliveryPeopleWithStats.length
  const activeCouriers = deliveryPeopleWithStats.filter((item) => item.is_active).length
  const onRouteCouriers = deliveryPeopleWithStats.filter(
    (item) => item.onRouteOrders > 0
  ).length
  const totalToPayToday = deliveryPeopleWithStats.reduce(
    (sum, item) => sum + item.totalToReceiveToday,
    0
  )

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6 p-6">
        <div className="overflow-hidden rounded-[28px] border border-border bg-card">
          <div className="bg-gradient-to-r from-[#11131a] via-[#171b24] to-[#1f2430] px-6 py-6 text-white">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </span>
                  Fechamento em tempo real
                </div>

                <h1 className="text-3xl font-black tracking-tight">
                  Motoboys e repasses
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-white/70">
                  Veja quanto cada motoboy tem para receber e quais pedidos estão vinculados a ele hoje.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-white/55">
                    Motoboys
                  </p>
                  <p className="mt-2 text-3xl font-black">{totalCouriers}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-white/55">
                    Ativos
                  </p>
                  <p className="mt-2 text-3xl font-black">{activeCouriers}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-white/55">
                    Em rota
                  </p>
                  <p className="mt-2 text-3xl font-black">{onRouteCouriers}</p>
                </div>

                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-100/70">
                    Total do dia
                  </p>
                  <p className="mt-2 text-3xl font-black text-emerald-300">
                    {formatCurrency(totalToPayToday)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border bg-card px-6 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative w-full max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar motoboy..."
                    className="h-12 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-border bg-background p-1">
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      filter === "all"
                        ? "bg-foreground text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Todos
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilter("active")}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      filter === "active"
                        ? "bg-foreground text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Ativos
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilter("inactive")}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      filter === "inactive"
                        ? "bg-foreground text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Inativos
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  {lastUpdatedAt
                    ? `Atualizado às ${lastUpdatedAt.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}`
                    : "Aguardando dados..."}
                </p>

                <button
                  type="button"
                  onClick={() => void refreshAll()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/40"
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

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="rounded-[24px] border border-border bg-card p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {editingCourierId ? (
                    <UserRound className="h-5 w-5" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </div>

                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {editingCourierId ? "Editar motoboy" : "Cadastrar motoboy"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Cadastro real conectado ao Supabase.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: João da Moto"
                    className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: 31999999999"
                    className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveCourier()}
                    disabled={saving}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : editingCourierId ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {editingCourierId ? "Salvar alterações" : "Cadastrar motoboy"}
                  </button>

                  {editingCourierId ? (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-muted/40"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancelar edição
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 rounded-[20px] border border-border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Regra do fechamento
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      O total do motoboy é a soma das taxas de entrega dos pedidos vinculados a ele no dia.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-border bg-card p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Motoboys
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Selecione um motoboy para ver os detalhes.
                  </p>
                </div>

                {loadingPage ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
              </div>

              <div className="space-y-2">
                {loadingPage ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
                    Carregando motoboys...
                  </div>
                ) : filteredCouriers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
                    Nenhum motoboy encontrado.
                  </div>
                ) : (
                  filteredCouriers.map((courier) => (
                    <button
                      key={courier.id}
                      type="button"
                      onClick={() => setSelectedCourierId(courier.id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        selectedCourierId === courier.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">
                            {getInitials(courier.name) || "MB"}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-foreground">
                              {courier.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {courier.phone ? formatPhone(courier.phone) : "Sem telefone"}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            courier.onRouteOrders > 0
                              ? "bg-emerald-100 text-emerald-700"
                              : courier.is_active
                                ? "bg-blue-100 text-blue-700"
                                : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {courier.onRouteOrders > 0
                            ? "Em rota"
                            : courier.is_active
                              ? "Ativo"
                              : "Inativo"}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">
                          {courier.ordersToday.length} pedido(s) hoje
                        </span>
                        <span className="font-bold text-emerald-700">
                          {ordersLoading ? "..." : formatCurrency(courier.totalToReceiveToday)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            {!selectedCourier ? (
              <div className="flex min-h-[500px] items-center justify-center rounded-[24px] border border-border bg-card">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
                    <Bike className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">
                    Selecione um motoboy
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Escolha um motoboy na lista para ver os pedidos e o total a receber.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="overflow-hidden rounded-[24px] border border-border bg-card">
                  <div className="border-b border-border px-5 py-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-lg font-black text-primary">
                          {getInitials(selectedCourier.name) || "MB"}
                        </div>

                        <div>
                          <h2 className="text-2xl font-black text-foreground">
                            {selectedCourier.name}
                          </h2>
                          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            {selectedCourier.phone
                              ? formatPhone(selectedCourier.phone)
                              : "Sem telefone"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div
                          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                            selectedCourier.onRouteOrders > 0
                              ? "bg-emerald-100 text-emerald-700"
                              : selectedCourier.is_active
                                ? "bg-blue-100 text-blue-700"
                                : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {selectedCourier.onRouteOrders > 0
                            ? "Em rota"
                            : selectedCourier.is_active
                              ? "Ativo"
                              : "Inativo"}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleEditCourier(selectedCourier)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/40"
                        >
                          <UserRound className="h-4 w-4" />
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleToggleActive(selectedCourier)}
                          disabled={busyCourierId === selectedCourier.id}
                          className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            selectedCourier.is_active
                              ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {busyCourierId === selectedCourier.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : selectedCourier.is_active ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          {selectedCourier.is_active ? "Desativar" : "Ativar"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-border bg-background p-4">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Pedidos hoje
                      </p>
                      <p className="mt-2 text-2xl font-black text-foreground">
                        {ordersLoading ? "..." : selectedCourier.ordersToday.length}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-background p-4">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Abertos
                      </p>
                      <p className="mt-2 text-2xl font-black text-foreground">
                        {ordersLoading ? "..." : selectedCourier.openOrders}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-background p-4">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Em rota
                      </p>
                      <p className="mt-2 text-2xl font-black text-foreground">
                        {ordersLoading ? "..." : selectedCourier.onRouteOrders}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-[11px] uppercase tracking-wide text-emerald-700/70">
                        Total a receber
                      </p>
                      <p className="mt-2 text-2xl font-black text-emerald-700">
                        {ordersLoading ? "..." : formatCurrency(selectedCourier.totalToReceiveToday)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_320px]">
                  <div className="rounded-[24px] border border-border bg-card p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-foreground">
                          Pedidos do dia
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Número do pedido e taxa vinculada ao motoboy.
                        </p>
                      </div>

                      <div className="text-right text-xs text-muted-foreground">
                        <p>
                          Última saída:{" "}
                          {ordersLoading
                            ? "..."
                            : selectedCourier.lastRouteAt
                              ? formatTime(selectedCourier.lastRouteAt)
                              : "—"}
                        </p>
                      </div>
                    </div>

                    {ordersLoading ? (
                      <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-12 text-center text-sm text-muted-foreground">
                        Carregando pedidos do dia...
                      </div>
                    ) : selectedCourier.ordersToday.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-12 text-center text-sm text-muted-foreground">
                        Nenhum pedido vinculado hoje.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-border">
                        <div className="grid grid-cols-[1.1fr_1.2fr_120px_120px] gap-3 border-b border-border bg-muted/40 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                          <span>Pedido</span>
                          <span>Cliente</span>
                          <span>Taxa</span>
                          <span>Status</span>
                        </div>

                        <div className="divide-y divide-border">
                          {selectedCourier.ordersToday.map((order) => (
                            <div
                              key={order.id}
                              className="grid grid-cols-[1.1fr_1.2fr_120px_120px] gap-3 px-4 py-4"
                            >
                              <div>
                                <p className="text-sm font-bold text-foreground">
                                  #{getOrderNumber(order)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatTime(order.created_at)}
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {order.customer_name || "Cliente sem nome"}
                                </p>
                              </div>

                              <div className="text-sm font-black text-foreground">
                                {formatCurrency(order.delivery_fee)}
                              </div>

                              <div>
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${getStatusTone(order.status)}`}
                                >
                                  {getStatusLabel(order.status)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-border bg-card p-5">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-emerald-700" />
                        <p className="text-sm font-bold text-foreground">
                          Resumo do repasse
                        </p>
                      </div>

                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-[11px] uppercase tracking-wide text-emerald-700/70">
                          Total a receber hoje
                        </p>
                        <p className="mt-2 text-3xl font-black text-emerald-700">
                          {ordersLoading ? "..." : formatCurrency(selectedCourier.totalToReceiveToday)}
                        </p>
                      </div>

                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Pedidos hoje</span>
                          <span className="font-semibold text-foreground">
                            {ordersLoading ? "..." : selectedCourier.ordersToday.length}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Pedidos abertos</span>
                          <span className="font-semibold text-foreground">
                            {ordersLoading ? "..." : selectedCourier.openOrders}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Pedidos em rota</span>
                          <span className="font-semibold text-foreground">
                            {ordersLoading ? "..." : selectedCourier.onRouteOrders}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Entregues hoje</span>
                          <span className="font-semibold text-foreground">
                            {ordersLoading ? "..." : selectedCourier.deliveredToday}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-border bg-card p-5">
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-bold text-foreground">
                          Dados do motoboy
                        </p>
                      </div>

                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Telefone</span>
                          <span className="font-semibold text-foreground">
                            {selectedCourier.phone
                              ? formatPhone(selectedCourier.phone)
                              : "Sem telefone"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Cadastrado em</span>
                          <span className="font-semibold text-foreground">
                            {formatDate(selectedCourier.created_at)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Última saída</span>
                          <span className="font-semibold text-foreground">
                            {ordersLoading
                              ? "..."
                              : selectedCourier.lastRouteAt
                                ? formatTime(selectedCourier.lastRouteAt)
                                : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-border bg-card p-5">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Regra da operação
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            O valor mostrado aqui é a soma das taxas dos pedidos atribuídos a esse motoboy no dia.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}