"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Clock3,
  Loader2,
  RefreshCcw,
  Search,
  Settings2,
  Truck,
  UserRound,
  XCircle,
} from "lucide-react"

import AdminLayout from "@/components/admin-layout"
import { useAuth } from "@/components/auth/auth-provider"
import { createClient } from "@/lib/supabase/client"

type OrderRow = {
  id: string
  public_order_number: string | number | null
  customer_name: string | null
  customer_phone: string | null
  status: string | null
  total: number | string | null
  payment_method: string | null
  notes: string | null
  created_at: string
  delivery_person_id: string | null
  accepted_at: string | null
  preparation_started_at: string | null
  out_for_delivery_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  accept_by: string | null
}

type DeliveryPerson = {
  id: string
  name: string
  phone: string | null
  is_active: boolean
  created_at: string
}

type BoardStatus = "analysis" | "preparation" | "on_route"

const supabase = createClient()

const OPEN_ORDER_STATUSES = [
  "pending",
  "pendente",
  "in_analysis",
  "em_analise",
  "analise",
  "em análise",
  "accepted",
  "aceito",
  "preparing",
  "em_preparo",
  "em preparo",
  "waiting",
  "aguardando",
  "ready",
  "pronto",
  "out_for_delivery",
  "saiu_para_entrega",
  "delivering",
  "on_route",
  "em_rota",
  "em rota",
]

async function ensureSupabaseSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error) {
    return error
  }

  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }

    const message = [
      maybeError.message,
      maybeError.details,
      maybeError.hint,
      maybeError.code,
    ]
      .filter(Boolean)
      .join(" • ")

    if (message) return message
  }

  return fallback
}

function normalizeStatus(status: string | null | undefined) {
  return (status || "").trim().toLowerCase()
}

function isAnalysisStatus(status: string | null | undefined) {
  const value = normalizeStatus(status)

  return (
    value === "pending" ||
    value === "pendente" ||
    value === "in_analysis" ||
    value === "em_analise" ||
    value === "analise" ||
    value === "em análise"
  )
}

function isPreparationStatus(status: string | null | undefined) {
  const value = normalizeStatus(status)

  return (
    value === "accepted" ||
    value === "aceito" ||
    value === "preparing" ||
    value === "em_preparo" ||
    value === "em preparo" ||
    value === "waiting" ||
    value === "aguardando" ||
    value === "ready" ||
    value === "pronto"
  )
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

function getBoardStatus(status: string | null | undefined): BoardStatus | null {
  if (isAnalysisStatus(status)) return "analysis"
  if (isPreparationStatus(status)) return "preparation"
  if (isOnRouteStatus(status)) return "on_route"
  return null
}

function formatBRL(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatTimeOnly(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatElapsedTime(value: string, nowMs: number) {
  const createdAt = new Date(value).getTime()
  const diffInMinutes = Math.max(0, Math.floor((nowMs - createdAt) / 60000))

  if (diffInMinutes < 1) return "Agora"
  if (diffInMinutes < 60) return `${diffInMinutes} min`

  const hours = Math.floor(diffInMinutes / 60)
  const minutes = diffInMinutes % 60

  if (hours < 24) {
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`
  }

  const days = Math.floor(hours / 24)
  return `${days}d`
}

function formatCountdown(ms: number) {
  const safeMs = Math.max(0, ms)
  const totalSeconds = Math.floor(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function getOrderNumber(order: OrderRow) {
  if (order.public_order_number !== null && order.public_order_number !== undefined) {
    return String(order.public_order_number)
  }

  return order.id.slice(0, 8)
}

function getCustomerName(order: OrderRow) {
  return order.customer_name?.trim() || "Cliente sem nome"
}

function getCustomerPhone(order: OrderRow) {
  return order.customer_phone?.trim() || "Sem telefone"
}

function getCustomerInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
}

function getAcceptDeadline(order: OrderRow) {
  if (order.accept_by) {
    return new Date(order.accept_by)
  }

  const createdAt = new Date(order.created_at)
  return new Date(createdAt.getTime() + 30 * 1000)
}

function getPreparationBaseTime(order: OrderRow) {
  return order.preparation_started_at || order.accepted_at || order.created_at
}

function getPreparationDeadline(order: OrderRow, averagePrepTimeMinutes: number) {
  const base = new Date(getPreparationBaseTime(order))
  return new Date(base.getTime() + averagePrepTimeMinutes * 60 * 1000)
}

function getAcceptProgressPercent(order: OrderRow, nowMs: number) {
  const deadline = getAcceptDeadline(order).getTime()
  const createdAt = new Date(order.created_at).getTime()
  const total = Math.max(1, deadline - createdAt)
  const elapsed = Math.min(Math.max(0, nowMs - createdAt), total)
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

function getDeliveryPersonName(
  deliveryPeople: DeliveryPerson[],
  deliveryPersonId: string | null
) {
  if (!deliveryPersonId) return null
  return deliveryPeople.find((person) => person.id === deliveryPersonId)?.name || null
}

function getPaymentLabel(paymentMethod: string | null) {
  if (!paymentMethod) return "—"

  const normalized = paymentMethod.toLowerCase()

  if (normalized === "pix") return "PIX"
  if (normalized === "cash" || normalized === "dinheiro") return "Dinheiro"
  if (normalized === "credit_card" || normalized === "credito") return "Crédito"
  if (normalized === "debit_card" || normalized === "debito") return "Débito"

  return paymentMethod
}

type BoardColumnProps = {
  title: string
  description: string
  status: BoardStatus
  orders: OrderRow[]
  deliveryPeople: DeliveryPerson[]
  averagePrepTimeMinutes: number
  nowMs: number
  busyOrderId: string | null
  onAccept: (order: OrderRow) => void
  onCancel: (order: OrderRow) => void
  onSendToRoute: (order: OrderRow) => void
  onFinish: (order: OrderRow) => void
  onAssignDeliveryPerson: (orderId: string, deliveryPersonId: string) => void
}

function BoardColumn({
  title,
  description,
  status,
  orders,
  deliveryPeople,
  averagePrepTimeMinutes,
  nowMs,
  busyOrderId,
  onAccept,
  onCancel,
  onSendToRoute,
  onFinish,
  onAssignDeliveryPerson,
}: BoardColumnProps) {
  const tone =
    status === "analysis"
      ? {
          column: "border-amber-200 bg-amber-50/40",
          iconWrap: "border-amber-200 bg-amber-100 text-amber-700",
          card: "border-amber-200/80 bg-white shadow-[0_14px_30px_-20px_rgba(245,158,11,0.55)]",
          badge: "bg-amber-100 text-amber-800 border-amber-200",
          line: "bg-amber-500",
        }
      : status === "preparation"
        ? {
            column: "border-orange-200 bg-orange-50/40",
            iconWrap: "border-orange-200 bg-orange-100 text-orange-700",
            card: "border-orange-200/80 bg-white shadow-[0_14px_30px_-20px_rgba(249,115,22,0.55)]",
            badge: "bg-orange-100 text-orange-800 border-orange-200",
            line: "bg-orange-500",
          }
        : {
            column: "border-emerald-200 bg-emerald-50/40",
            iconWrap: "border-emerald-200 bg-emerald-100 text-emerald-700",
            card: "border-emerald-200/80 bg-white shadow-[0_14px_30px_-20px_rgba(16,185,129,0.55)]",
            badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
            line: "bg-emerald-500",
          }

  const icon =
    status === "analysis" ? (
      <Clock3 className="h-5 w-5" />
    ) : status === "preparation" ? (
      <ChefHat className="h-5 w-5" />
    ) : (
      <Truck className="h-5 w-5" />
    )

  return (
    <div className={`flex min-h-[720px] min-w-[360px] flex-col rounded-[28px] border ${tone.column}`}>
      <div className="border-b border-black/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${tone.iconWrap}`}>
            {icon}
          </div>

          <div>
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          <div className={`ml-auto rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}>
            {orders.length} pedido(s)
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {orders.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-[24px] border border-dashed border-border bg-background/70 p-6 text-center">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Nenhum pedido aqui
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Os pedidos vão aparecer em tempo real.
              </p>
            </div>
          </div>
        ) : (
          orders.map((order) => {
            const isBusy = busyOrderId === order.id
            const customerName = getCustomerName(order)
            const acceptDeadline = getAcceptDeadline(order)
            const acceptRemainingMs = acceptDeadline.getTime() - nowMs
            const acceptProgress = getAcceptProgressPercent(order, nowMs)

            const prepDeadline = getPreparationDeadline(order, averagePrepTimeMinutes)
            const prepRemainingMs = prepDeadline.getTime() - nowMs
            const deliveryPersonName = getDeliveryPersonName(
              deliveryPeople,
              order.delivery_person_id
            )

            const acceptTone =
              acceptRemainingMs <= 0
                ? "border-red-300 bg-red-50 text-red-700"
                : acceptRemainingMs <= 10000
                  ? "border-red-300 bg-red-50 text-red-700"
                  : acceptRemainingMs <= 20000
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-emerald-300 bg-emerald-50 text-emerald-700"

            const prepTone =
              prepRemainingMs <= 0
                ? "border-red-300 bg-red-50 text-red-700"
                : prepRemainingMs <= 5 * 60 * 1000
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-emerald-300 bg-emerald-50 text-emerald-700"

            return (
              <div
                key={order.id}
                className={`overflow-hidden rounded-[26px] border ${tone.card}`}
              >
                <div className={`h-1.5 w-full ${tone.line}`} />

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-foreground">
                          Pedido #{getOrderNumber(order)}
                        </p>
                        <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                          {getPaymentLabel(order.payment_method)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Entrou às {formatTimeOnly(order.created_at)} • {formatDateTime(order.created_at)}
                      </p>
                    </div>

                    <div className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground">
                      {formatElapsedTime(order.created_at, nowMs)}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3 rounded-[22px] border border-border bg-muted/30 p-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">
                      {getCustomerInitials(customerName) || "CL"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">
                        {customerName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {getCustomerPhone(order)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-[20px] border border-border bg-background p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Total
                      </p>
                      <p className="mt-1 text-base font-bold text-foreground">
                        {formatBRL(order.total)}
                      </p>
                    </div>

                    <div className="rounded-[20px] border border-border bg-background p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Pagamento
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {getPaymentLabel(order.payment_method)}
                      </p>
                    </div>
                  </div>

                  {order.notes ? (
                    <div className="mt-4 rounded-[20px] border border-border bg-background p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Observação
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {order.notes}
                      </p>
                    </div>
                  ) : null}

                  {status === "analysis" && (
                    <div className="mt-4 rounded-[22px] border border-border bg-background p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <p className="text-sm font-bold text-foreground">
                            Prazo para aceitar
                          </p>
                        </div>

                        <div className={`rounded-full border px-3 py-1 text-xs font-bold ${acceptTone}`}>
                          {acceptRemainingMs > 0
                            ? formatCountdown(acceptRemainingMs)
                            : "Tempo esgotado"}
                        </div>
                      </div>

                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${
                            acceptRemainingMs <= 0
                              ? "bg-red-500"
                              : acceptRemainingMs <= 10000
                                ? "bg-red-500"
                                : acceptRemainingMs <= 20000
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                          }`}
                          style={{ width: `${acceptProgress}%` }}
                        />
                      </div>

                      <p className="mt-2 text-xs text-muted-foreground">
                        Limite até {formatTimeOnly(acceptDeadline.toISOString())}
                      </p>
                    </div>
                  )}

                  {status === "preparation" && (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-[22px] border border-border bg-background p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <ChefHat className="h-4 w-4 text-orange-600" />
                            <p className="text-sm font-bold text-foreground">
                              Preparo
                            </p>
                          </div>

                          <div className={`rounded-full border px-3 py-1 text-xs font-bold ${prepTone}`}>
                            {prepRemainingMs > 0
                              ? `Faltam ${Math.ceil(prepRemainingMs / 60000)} min`
                              : "Atrasado"}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-[18px] bg-muted/40 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Início
                            </p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {formatTimeOnly(getPreparationBaseTime(order))}
                            </p>
                          </div>

                          <div className="rounded-[18px] bg-muted/40 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Saída prevista
                            </p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {formatTimeOnly(prepDeadline.toISOString())}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-border bg-background p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <UserRound className="h-4 w-4 text-primary" />
                          <p className="text-sm font-bold text-foreground">
                            Entregador
                          </p>
                        </div>

                        <select
                          value={order.delivery_person_id || ""}
                          onChange={(e) =>
                            onAssignDeliveryPerson(order.id, e.target.value)
                          }
                          disabled={isBusy || deliveryPeople.length === 0}
                          className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">
                            {deliveryPeople.length === 0
                              ? "Nenhum entregador cadastrado"
                              : "Selecionar entregador"}
                          </option>

                          {deliveryPeople.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name}
                              {person.phone ? ` • ${person.phone}` : ""}
                            </option>
                          ))}
                        </select>

                        {deliveryPersonName ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Responsável atual: <span className="font-semibold text-foreground">{deliveryPersonName}</span>
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-amber-700">
                            Escolha um entregador antes de enviar para rota.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {status === "on_route" && (
                    <div className="mt-4 rounded-[22px] border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-emerald-600" />
                            <p className="text-sm font-bold text-foreground">
                              Em rota
                            </p>
                          </div>

                          <p className="mt-2 text-sm text-foreground">
                            {deliveryPersonName || "Entregador não definido"}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            Saiu às{" "}
                            {order.out_for_delivery_at
                              ? formatTimeOnly(order.out_for_delivery_at)
                              : "—"}
                          </p>
                        </div>

                        <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          {order.out_for_delivery_at
                            ? `${formatElapsedTime(order.out_for_delivery_at, nowMs)} em rota`
                            : "Em rota"}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {status === "analysis" && (
                      <>
                        <button
                          type="button"
                          onClick={() => onAccept(order)}
                          disabled={isBusy}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          Aceitar pedido
                        </button>

                        <button
                          type="button"
                          onClick={() => onCancel(order)}
                          disabled={isBusy}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <XCircle className="h-4 w-4" />
                          Cancelar
                        </button>
                      </>
                    )}

                    {status === "preparation" && (
                      <button
                        type="button"
                        onClick={() => onSendToRoute(order)}
                        disabled={isBusy || !order.delivery_person_id}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Truck className="h-4 w-4" />
                        )}
                        Enviar para rota
                      </button>
                    )}

                    {status === "on_route" && (
                      <button
                        type="button"
                        onClick={() => onFinish(order)}
                        disabled={isBusy}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Finalizar pedido
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default function PedidosPage() {
  const { restaurant, user, isLoading: authLoading } = useAuth()

  const [orders, setOrders] = useState<OrderRow[]>([])
  const [deliveryPeople, setDeliveryPeople] = useState<DeliveryPerson[]>([])
  const [averagePrepTimeMinutes, setAveragePrepTimeMinutes] = useState(30)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [savingPrepTime, setSavingPrepTime] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [nowMs, setNowMs] = useState(Date.now())

  async function loadOrders(showRefresh = false) {
    if (!restaurant?.id) return

    try {
      if (showRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError(null)

      const session = await ensureSupabaseSession()

      if (!session) {
        setLoading(false)
        setRefreshing(false)
        return
      }

      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, public_order_number, customer_name, customer_phone, status, total, payment_method, notes, created_at, delivery_person_id, accepted_at, preparation_started_at, out_for_delivery_at, delivered_at, cancelled_at, accept_by"
        )
        .eq("restaurant_id", restaurant.id)
        .in("status", OPEN_ORDER_STATUSES)
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      setOrders((data || []) as OrderRow[])
      setLastUpdatedAt(new Date())
    } catch (err) {
      console.error("Erro ao buscar pedidos:", err)
      setError(getErrorMessage(err, "Erro ao buscar pedidos."))
      setOrders([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function loadDeliveryPeople() {
    if (!restaurant?.id) return

    try {
      const session = await ensureSupabaseSession()

      if (!session) {
        return
      }

      const { data, error } = await supabase
        .from("delivery_people")
        .select("id, name, phone, is_active, created_at")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("name", { ascending: true })

      if (error) {
        throw error
      }

      setDeliveryPeople((data || []) as DeliveryPerson[])
    } catch (err) {
      console.error("Erro ao carregar entregadores:", err)
      setError(getErrorMessage(err, "Erro ao carregar entregadores."))
    }
  }

  async function loadRestaurantSettings() {
    if (!restaurant?.id) return

    try {
      const session = await ensureSupabaseSession()

      if (!session) {
        return
      }

      const { data, error } = await supabase
        .from("restaurants")
        .select("average_prep_time_minutes")
        .eq("id", restaurant.id)
        .single()

      if (error) {
        throw error
      }

      setAveragePrepTimeMinutes(Number(data.average_prep_time_minutes || 30))
    } catch (err) {
      console.error("Erro ao carregar configurações do restaurante:", err)
      setError(getErrorMessage(err, "Erro ao carregar configurações do restaurante."))
    }
  }

  async function updateAveragePrepTime(nextValue: number) {
    if (!restaurant?.id) return

    const previousValue = averagePrepTimeMinutes

    try {
      setSavingPrepTime(true)
      setAveragePrepTimeMinutes(nextValue)

      const { error } = await supabase
        .from("restaurants")
        .update({ average_prep_time_minutes: nextValue })
        .eq("id", restaurant.id)

      if (error) {
        throw error
      }
    } catch (err) {
      console.error("Erro ao salvar tempo médio:", err)
      setAveragePrepTimeMinutes(previousValue)
      setError(getErrorMessage(err, "Erro ao salvar tempo médio."))
    } finally {
      setSavingPrepTime(false)
    }
  }

  async function loadInitialData() {
    if (!restaurant?.id) return

    setError(null)

    await loadOrders()
    void loadDeliveryPeople()
    void loadRestaurantSettings()
  }

  async function refreshAll() {
    if (!restaurant?.id) return

    setError(null)

    await Promise.all([
      loadOrders(true),
      loadDeliveryPeople(),
      loadRestaurantSettings(),
    ])
  }

  async function assignDeliveryPerson(orderId: string, deliveryPersonId: string) {
    const previousOrders = orders

    try {
      setBusyOrderId(orderId)
      setError(null)

      setOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                delivery_person_id: deliveryPersonId || null,
              }
            : order
        )
      )

      const { error } = await supabase
        .from("orders")
        .update({
          delivery_person_id: deliveryPersonId || null,
        })
        .eq("id", orderId)
        .eq("restaurant_id", restaurant?.id)

      if (error) {
        throw error
      }
    } catch (err) {
      console.error("Erro ao vincular entregador:", err)
      setOrders(previousOrders)
      setError(getErrorMessage(err, "Erro ao vincular entregador."))
    } finally {
      setBusyOrderId(null)
    }
  }

  async function updateOrder(order: OrderRow, action: "accept" | "cancel" | "route" | "finish") {
    const previousOrders = orders
    const nowIso = new Date().toISOString()

    try {
      setBusyOrderId(order.id)
      setError(null)

      let payload: Partial<OrderRow> = {}

      if (action === "accept") {
        payload = {
          status: "accepted",
          accepted_at: nowIso,
          preparation_started_at: nowIso,
        }
      }

      if (action === "cancel") {
        payload = {
          status: "cancelled",
          cancelled_at: nowIso,
        }
      }

      if (action === "route") {
        if (!order.delivery_person_id) {
          setError("Selecione um entregador antes de enviar para rota.")
          return
        }

        payload = {
          status: "out_for_delivery",
          out_for_delivery_at: nowIso,
        }
      }

      if (action === "finish") {
        payload = {
          status: "delivered",
          delivered_at: nowIso,
        }
      }

      setOrders((current) =>
        current.map((item) =>
          item.id === order.id
            ? {
                ...item,
                ...payload,
              }
            : item
        )
      )

      const { error } = await supabase
        .from("orders")
        .update(payload)
        .eq("id", order.id)
        .eq("restaurant_id", restaurant?.id)

      if (error) {
        throw error
      }
    } catch (err) {
      console.error("Erro ao atualizar pedido:", err)
      setOrders(previousOrders)
      setError(getErrorMessage(err, "Erro ao atualizar pedido."))
    } finally {
      setBusyOrderId(null)
    }
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (authLoading) {
      setLoading(true)
      return
    }

    if (!user || !restaurant?.id) {
      setOrders([])
      setDeliveryPeople([])
      setLoading(false)
      setRefreshing(false)
      setError(null)
      return
    }

    void loadInitialData()

    const refreshInterval = window.setInterval(() => {
      void loadOrders(true)
    }, 15000)

    const ordersChannel = supabase
      .channel(`orders-live-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          void loadOrders(true)
        }
      )
      .subscribe()

    const deliveryPeopleChannel = supabase
      .channel(`delivery-people-live-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_people",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          void loadDeliveryPeople()
        }
      )
      .subscribe()

    return () => {
      window.clearInterval(refreshInterval)
      void supabase.removeChannel(ordersChannel)
      void supabase.removeChannel(deliveryPeopleChannel)
    }
  }, [authLoading, restaurant?.id, user?.id])

  useEffect(() => {
    if (!restaurant?.id || !user?.id) return

    const handlePageBack = () => {
      if (document.visibilityState === "visible") {
        void loadOrders(true)
        void loadDeliveryPeople()
        void loadRestaurantSettings()
      }
    }

    const handleWindowFocus = () => {
      void loadOrders(true)
      void loadDeliveryPeople()
      void loadRestaurantSettings()
    }

    document.addEventListener("visibilitychange", handlePageBack)
    window.addEventListener("focus", handleWindowFocus)

    return () => {
      document.removeEventListener("visibilitychange", handlePageBack)
      window.removeEventListener("focus", handleWindowFocus)
    }
  }, [restaurant?.id, user?.id])

  const openOrders = useMemo(() => {
    return orders.filter((order) => getBoardStatus(order.status) !== null)
  }, [orders])

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return openOrders.filter((order) => {
      if (!normalizedSearch) return true

      const customerName = getCustomerName(order).toLowerCase()
      const customerPhone = getCustomerPhone(order).toLowerCase()
      const orderNumber = getOrderNumber(order).toLowerCase()

      return (
        customerName.includes(normalizedSearch) ||
        customerPhone.includes(normalizedSearch) ||
        orderNumber.includes(normalizedSearch)
      )
    })
  }, [openOrders, search])

  const analysisOrders = useMemo(
    () => filteredOrders.filter((order) => getBoardStatus(order.status) === "analysis"),
    [filteredOrders]
  )

  const preparationOrders = useMemo(
    () => filteredOrders.filter((order) => getBoardStatus(order.status) === "preparation"),
    [filteredOrders]
  )

  const onRouteOrders = useMemo(
    () => filteredOrders.filter((order) => getBoardStatus(order.status) === "on_route"),
    [filteredOrders]
  )

  const totalOpenOrders =
    analysisOrders.length + preparationOrders.length + onRouteOrders.length

  return (
    <AdminLayout title="Pedidos" description="Central operacional do restaurante">
      <div className="flex flex-col gap-6">
        <div className="overflow-hidden rounded-[30px] border border-border bg-card">
          <div className="bg-gradient-to-r from-foreground to-foreground/90 px-6 py-6 text-white">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </span>
                  Operação em tempo real
                </div>

                <h1 className="text-3xl font-black tracking-tight">
                  Central de pedidos
                </h1>
                <p className="mt-1 text-sm text-white/70">
                  Aceite rápido, preparo controlado e saída organizada por entregador.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-white/60">
                    Em análise
                  </p>
                  <p className="mt-1 text-2xl font-black">{analysisOrders.length}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-white/60">
                    Em preparo
                  </p>
                  <p className="mt-1 text-2xl font-black">{preparationOrders.length}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-white/60">
                    Em rota
                  </p>
                  <p className="mt-1 text-2xl font-black">{onRouteOrders.length}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-white/60">
                    Abertos
                  </p>
                  <p className="mt-1 text-2xl font-black">
                    {loading ? "..." : totalOpenOrders}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border bg-card px-6 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative w-full max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar cliente, telefone ou pedido..."
                    className="h-12 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2.5">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    Tempo médio:
                  </span>

                  <select
                    value={averagePrepTimeMinutes}
                    onChange={(e) => updateAveragePrepTime(Number(e.target.value))}
                    disabled={savingPrepTime}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  >
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={20}>20 min</option>
                    <option value={25}>25 min</option>
                    <option value={30}>30 min</option>
                    <option value={35}>35 min</option>
                    <option value={40}>40 min</option>
                    <option value={45}>45 min</option>
                    <option value={50}>50 min</option>
                    <option value={60}>60 min</option>
                  </select>

                  {savingPrepTime ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : null}
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

        {loading ? (
          <div className="flex items-center justify-center rounded-[30px] border border-border bg-card py-20">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando operação...
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[1140px] grid-cols-3 gap-4">
              <BoardColumn
                title="Em análise"
                description="Pedidos aguardando confirmação"
                status="analysis"
                orders={analysisOrders}
                deliveryPeople={deliveryPeople}
                averagePrepTimeMinutes={averagePrepTimeMinutes}
                nowMs={nowMs}
                busyOrderId={busyOrderId}
                onAccept={(order) => void updateOrder(order, "accept")}
                onCancel={(order) => void updateOrder(order, "cancel")}
                onSendToRoute={(order) => void updateOrder(order, "route")}
                onFinish={(order) => void updateOrder(order, "finish")}
                onAssignDeliveryPerson={(orderId, deliveryPersonId) =>
                  void assignDeliveryPerson(orderId, deliveryPersonId)
                }
              />

              <BoardColumn
                title="Em preparo"
                description="Pedidos em produção"
                status="preparation"
                orders={preparationOrders}
                deliveryPeople={deliveryPeople}
                averagePrepTimeMinutes={averagePrepTimeMinutes}
                nowMs={nowMs}
                busyOrderId={busyOrderId}
                onAccept={(order) => void updateOrder(order, "accept")}
                onCancel={(order) => void updateOrder(order, "cancel")}
                onSendToRoute={(order) => void updateOrder(order, "route")}
                onFinish={(order) => void updateOrder(order, "finish")}
                onAssignDeliveryPerson={(orderId, deliveryPersonId) =>
                  void assignDeliveryPerson(orderId, deliveryPersonId)
                }
              />

              <BoardColumn
                title="Em rota"
                description="Pedidos com entregador"
                status="on_route"
                orders={onRouteOrders}
                deliveryPeople={deliveryPeople}
                averagePrepTimeMinutes={averagePrepTimeMinutes}
                nowMs={nowMs}
                busyOrderId={busyOrderId}
                onAccept={(order) => void updateOrder(order, "accept")}
                onCancel={(order) => void updateOrder(order, "cancel")}
                onSendToRoute={(order) => void updateOrder(order, "route")}
                onFinish={(order) => void updateOrder(order, "finish")}
                onAssignDeliveryPerson={(orderId, deliveryPersonId) =>
                  void assignDeliveryPerson(orderId, deliveryPersonId)
                }
              />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}