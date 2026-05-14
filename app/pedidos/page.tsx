"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Clock3,
  Loader2,
  Package,
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
  subtotal?: number | string | null
  discount?: number | string | null
  delivery_fee?: number | string | null
  payment_method: string | null
  payment_status: string | null
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

type OrderItem = {
  id: string
  order_id: string
  name: string
  quantity: number
  total: number
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

const columnStyles = {
  analysis: {
    title: "PENDENTES",
    description: "Aguardando confirmação",
    icon: Clock3,
    header: "bg-amber-500",
    body: "bg-amber-50/45",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    button: "bg-emerald-600 hover:bg-emerald-700 text-white",
    progress: "bg-emerald-500",
  },
  preparation: {
    title: "EM PREPARO",
    description: "Produção na cozinha",
    icon: ChefHat,
    header: "bg-blue-600",
    body: "bg-blue-50/40",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    button: "bg-blue-600 hover:bg-blue-700 text-white",
    progress: "bg-blue-500",
  },
  on_route: {
    title: "EM ROTA",
    description: "Saiu para entrega",
    icon: Truck,
    header: "bg-emerald-600",
    body: "bg-emerald-50/40",
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    button: "bg-purple-600 hover:bg-purple-700 text-white",
    progress: "bg-emerald-500",
  },
} satisfies Record<BoardStatus, Record<string, string | typeof Clock3>>

async function ensureSupabaseSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error

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

function formatTimeOnly(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatElapsedTime(value: string, nowMs: number) {
  const createdAt = new Date(value).getTime()
  const diffInMinutes = Math.max(0, Math.floor((nowMs - createdAt) / 60000))

  if (diffInMinutes < 1) return "agora"
  if (diffInMinutes < 60) return `${diffInMinutes}min`

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

function getAcceptDeadline(order: OrderRow) {
  if (order.accept_by) return new Date(order.accept_by)

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

function getProgressPercent(startDate: string, endDate: string, nowMs: number) {
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  const total = Math.max(1, end - start)
  const elapsed = Math.min(Math.max(0, nowMs - start), total)

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

  if (normalized === "pix") return "Pix"
  if (normalized === "cash" || normalized === "dinheiro") return "Dinheiro"
  if (normalized === "credit_card" || normalized === "credito") return "Crédito"
  if (normalized === "debit_card" || normalized === "debito") return "Débito"

  return paymentMethod
}

function getPaymentStatusLabel(paymentStatus: string | null) {
  const normalized = String(paymentStatus || "").toLowerCase()

  if (normalized === "paid") return "Pago"
  if (normalized === "pending") return "Pendente"
  if (normalized === "failed") return "Falhou"
  if (normalized === "cancelled") return "Cancelado"

  return paymentStatus || "—"
}

function getOrderTypeLabel(order: OrderRow) {
  const deliveryFee = Number(order.delivery_fee || 0)

  if (deliveryFee > 0) return "Delivery"

  return "Retirada"
}

function normalizeOrderItem(raw: Record<string, unknown>): OrderItem {
  const quantity = Number(raw.quantity || raw.qty || 1)
  const total = Number(
    raw.total_price ||
      raw.subtotal ||
      raw.total ||
      raw.price ||
      raw.unit_price ||
      0
  )

  const name =
    String(
      raw.product_name ||
        raw.menu_item_name ||
        raw.item_name ||
        raw.name ||
        "Item do pedido"
    ) || "Item do pedido"

  return {
    id: String(raw.id || crypto.randomUUID()),
    order_id: String(raw.order_id || ""),
    name,
    quantity,
    total,
  }
}

type OrderCardProps = {
  order: OrderRow
  status: BoardStatus
  items: OrderItem[]
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

function OrderCard({
  order,
  status,
  items,
  deliveryPeople,
  averagePrepTimeMinutes,
  nowMs,
  busyOrderId,
  onAccept,
  onCancel,
  onSendToRoute,
  onFinish,
  onAssignDeliveryPerson,
}: OrderCardProps) {
  const styles = columnStyles[status]
  const isBusy = busyOrderId === order.id

  const acceptDeadline = getAcceptDeadline(order)
  const acceptRemainingMs = acceptDeadline.getTime() - nowMs
  const acceptProgress = getProgressPercent(
    order.created_at,
    acceptDeadline.toISOString(),
    nowMs
  )

  const preparationBaseTime = getPreparationBaseTime(order)
  const preparationDeadline = getPreparationDeadline(order, averagePrepTimeMinutes)
  const preparationRemainingMs = preparationDeadline.getTime() - nowMs
  const preparationProgress = getProgressPercent(
    preparationBaseTime,
    preparationDeadline.toISOString(),
    nowMs
  )

  const deliveryPersonName = getDeliveryPersonName(
    deliveryPeople,
    order.delivery_person_id
  )

  const isLate =
    (status === "analysis" && acceptRemainingMs <= 0) ||
    (status === "preparation" && preparationRemainingMs <= 0)

  const visibleItems = items.slice(0, 4)
  const hiddenItemsCount = Math.max(0, items.length - visibleItems.length)

  return (
    <article
      className={[
        "overflow-hidden rounded-xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        isLate ? "border-red-300 ring-1 ring-red-200" : "border-slate-200",
      ].join(" ")}
    >
      {isLate && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Pedido atrasado
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-950">
                #{getOrderNumber(order)}
              </h3>

              {status === "analysis" && acceptRemainingMs <= 10000 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                  ALTA
                </span>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
              <UserRound className="h-4 w-4 text-slate-400" />
              <span className="truncate">{getCustomerName(order)}</span>
            </div>

            <p className="mt-1 pl-6 text-xs text-slate-400">
              {getCustomerPhone(order)}
            </p>
          </div>

          <span className="inline-flex shrink-0 items-center rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">
            {getOrderTypeLabel(order)}
          </span>
        </div>

        <div className="mt-4">
          {status === "analysis" && (
            <>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-bold",
                    acceptRemainingMs <= 0
                      ? "border-red-200 bg-red-50 text-red-700"
                      : acceptRemainingMs <= 10000
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  ].join(" ")}
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  {acceptRemainingMs > 0
                    ? formatCountdown(acceptRemainingMs)
                    : "Esgotado"}
                </span>

                <span className="text-slate-400">
                  entrou {formatElapsedTime(order.created_at, nowMs)}
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={[
                    "h-full rounded-full",
                    acceptRemainingMs <= 10000 ? "bg-red-500" : "bg-emerald-500",
                  ].join(" ")}
                  style={{ width: `${acceptProgress}%` }}
                />
              </div>
            </>
          )}

          {status === "preparation" && (
            <>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-bold",
                    preparationRemainingMs <= 0
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  ].join(" ")}
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  {preparationRemainingMs > 0
                    ? `${Math.ceil(preparationRemainingMs / 60000)}min`
                    : "Atrasado"}
                </span>

                <span className="text-slate-400">
                  {averagePrepTimeMinutes}min estimado
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={[
                    "h-full rounded-full",
                    preparationRemainingMs <= 0 ? "bg-red-500" : String(styles.progress),
                  ].join(" ")}
                  style={{ width: `${preparationProgress}%` }}
                />
              </div>
            </>
          )}

          {status === "on_route" && (
            <>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-bold text-emerald-700">
                  <Truck className="h-3.5 w-3.5" />
                  {order.out_for_delivery_at
                    ? formatElapsedTime(order.out_for_delivery_at, nowMs)
                    : "Em rota"}
                </span>

                <span className="text-slate-400">
                  saiu às{" "}
                  {order.out_for_delivery_at
                    ? formatTimeOnly(order.out_for_delivery_at)
                    : "--:--"}
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-2/3 rounded-full bg-emerald-500" />
              </div>
            </>
          )}
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          {visibleItems.length > 0 ? (
            <div className="space-y-2">
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Package className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate font-medium text-slate-700">
                      {item.quantity}x {item.name}
                    </span>
                  </div>

                  {item.total > 0 && (
                    <span className="shrink-0 text-slate-500">
                      {formatBRL(item.total)}
                    </span>
                  )}
                </div>
              ))}

              {hiddenItemsCount > 0 && (
                <p className="text-xs font-medium text-slate-500">
                  +{hiddenItemsCount} item(ns)
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Itens do pedido não carregados.
            </p>
          )}
        </div>

        {order.notes && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
              Observação
            </p>
            <p className="mt-1 text-sm text-amber-900">{order.notes}</p>
          </div>
        )}

        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              <p>{getPaymentLabel(order.payment_method)}</p>
              <p className="mt-1 font-semibold text-slate-600">
                {getPaymentStatusLabel(order.payment_status)}
              </p>
            </div>

            <p className="text-lg font-black text-slate-950">
              {formatBRL(order.total)}
            </p>
          </div>
        </div>

        {(status === "preparation" || status === "on_route") && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-slate-500" />
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Entregador
                </p>
              </div>

              {deliveryPersonName && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                  Atribuído
                </span>
              )}
            </div>

            {status === "preparation" ? (
              <select
                value={order.delivery_person_id || ""}
                onChange={(event) =>
                  onAssignDeliveryPerson(order.id, event.target.value)
                }
                disabled={isBusy || deliveryPeople.length === 0}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
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
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {deliveryPersonName?.charAt(0).toUpperCase() || "E"}
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {deliveryPersonName || "Entregador não definido"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Taxa: {formatBRL(order.delivery_fee)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {status === "analysis" && (
            <>
              <button
                type="button"
                onClick={() => onAccept(order)}
                disabled={isBusy}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Aceitar
              </button>

              <button
                type="button"
                onClick={() => onCancel(order)}
                disabled={isBusy}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" />
                Negar
              </button>
            </>
          )}

          {status === "preparation" && (
            <button
              type="button"
              onClick={() => onSendToRoute(order)}
              disabled={isBusy || !order.delivery_person_id}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Pronto / Enviar
            </button>
          )}

          {status === "on_route" && (
            <button
              type="button"
              onClick={() => onFinish(order)}
              disabled={isBusy}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 text-sm font-bold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Finalizar
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

type BoardColumnProps = {
  status: BoardStatus
  orders: OrderRow[]
  orderItemsByOrderId: Record<string, OrderItem[]>
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
  status,
  orders,
  orderItemsByOrderId,
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
  const styles = columnStyles[status]
  const Icon = styles.icon as typeof Clock3

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`${styles.header} px-4 py-3 text-white`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
              <Icon className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-sm font-black tracking-wide">{styles.title}</h2>
              <p className="text-xs font-medium text-white/80">
                {styles.description as string}
              </p>
            </div>
          </div>

          <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white/20 px-2 text-sm font-black">
            {orders.length}
          </span>
        </div>
      </div>

      <div className={`${styles.body} min-h-[calc(100vh-245px)] space-y-3 p-3`}>
        {orders.length === 0 ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/70 p-6 text-center">
            <div>
              <p className="text-sm font-bold text-slate-700">
                Nenhum pedido aqui
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Os pedidos aparecem automaticamente nessa etapa.
              </p>
            </div>
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              status={status}
              items={orderItemsByOrderId[order.id] || []}
              deliveryPeople={deliveryPeople}
              averagePrepTimeMinutes={averagePrepTimeMinutes}
              nowMs={nowMs}
              busyOrderId={busyOrderId}
              onAccept={onAccept}
              onCancel={onCancel}
              onSendToRoute={onSendToRoute}
              onFinish={onFinish}
              onAssignDeliveryPerson={onAssignDeliveryPerson}
            />
          ))
        )}
      </div>
    </section>
  )
}

export default function PedidosPage() {
  const { restaurant, user, isLoading: authLoading } = useAuth()

  const [orders, setOrders] = useState<OrderRow[]>([])
  const [orderItemsByOrderId, setOrderItemsByOrderId] = useState<
    Record<string, OrderItem[]>
  >({})
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

  async function loadOrderItems(orderIds: string[]) {
    if (orderIds.length === 0) {
      setOrderItemsByOrderId({})
      return
    }

    try {
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds)

      if (error) {
        console.warn("Itens dos pedidos não carregados:", error.message)
        setOrderItemsByOrderId({})
        return
      }

      const grouped: Record<string, OrderItem[]> = {}

      for (const rawItem of (data || []) as Record<string, unknown>[]) {
        const item = normalizeOrderItem(rawItem)

        if (!item.order_id) continue

        if (!grouped[item.order_id]) {
          grouped[item.order_id] = []
        }

        grouped[item.order_id].push(item)
      }

      setOrderItemsByOrderId(grouped)
    } catch (err) {
      console.warn("Erro inesperado ao carregar itens dos pedidos:", err)
      setOrderItemsByOrderId({})
    }
  }

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
          "id, public_order_number, customer_name, customer_phone, status, subtotal, discount, delivery_fee, total, payment_method, payment_status, notes, created_at, delivery_person_id, accepted_at, preparation_started_at, out_for_delivery_at, delivered_at, cancelled_at, accept_by"
        )
        .eq("restaurant_id", restaurant.id)
        .in("status", OPEN_ORDER_STATUSES)
        .order("created_at", { ascending: false })

      if (error) throw error

      const visibleOrders = ((data || []) as OrderRow[]).filter((order) => {
        const paymentMethod = String(order.payment_method || "").toLowerCase()
        const paymentStatus = String(order.payment_status || "").toLowerCase()

        if (paymentMethod !== "pix") return true

        return paymentStatus === "paid"
      })

      setOrders(visibleOrders)
      setLastUpdatedAt(new Date())

      void loadOrderItems(visibleOrders.map((order) => order.id))
    } catch (err) {
      console.error("Erro ao buscar pedidos:", err)
      setError(getErrorMessage(err, "Erro ao buscar pedidos."))
      setOrders([])
      setOrderItemsByOrderId({})
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function loadDeliveryPeople() {
    if (!restaurant?.id) return

    try {
      const session = await ensureSupabaseSession()

      if (!session) return

      const { data, error } = await supabase
        .from("delivery_people")
        .select("id, name, phone, is_active, created_at")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("name", { ascending: true })

      if (error) throw error

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

      if (!session) return

      const { data, error } = await supabase
        .from("restaurants")
        .select("average_prep_time_minutes")
        .eq("id", restaurant.id)
        .single()

      if (error) throw error

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

      if (error) throw error
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

      if (error) throw error
    } catch (err) {
      console.error("Erro ao vincular entregador:", err)
      setOrders(previousOrders)
      setError(getErrorMessage(err, "Erro ao vincular entregador."))
    } finally {
      setBusyOrderId(null)
    }
  }

  async function updateOrder(
    order: OrderRow,
    action: "accept" | "cancel" | "route" | "finish"
  ) {
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
          setError("Selecione um entregador antes de enviar o pedido.")
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

      if (error) throw error
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
      setOrderItemsByOrderId({})
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
    () =>
      filteredOrders.filter(
        (order) => getBoardStatus(order.status) === "preparation"
      ),
    [filteredOrders]
  )

  const onRouteOrders = useMemo(
    () => filteredOrders.filter((order) => getBoardStatus(order.status) === "on_route"),
    [filteredOrders]
  )

  return (
    <AdminLayout title="Pedidos" description="Central operacional do restaurante">
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar cliente, telefone ou pedido..."
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                />
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <Settings2 className="h-4 w-4 text-slate-500" />

                <span className="text-sm font-medium text-slate-700">
                  Tempo médio:
                </span>

                <select
                  value={averagePrepTimeMinutes}
                  onChange={(event) =>
                    updateAveragePrepTime(Number(event.target.value))
                  }
                  disabled={savingPrepTime}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
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

                {savingPrepTime && (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-slate-500">
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
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando operação...
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[1140px] grid-cols-3 gap-4">
              <BoardColumn
                status="analysis"
                orders={analysisOrders}
                orderItemsByOrderId={orderItemsByOrderId}
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
                status="preparation"
                orders={preparationOrders}
                orderItemsByOrderId={orderItemsByOrderId}
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
                status="on_route"
                orders={onRouteOrders}
                orderItemsByOrderId={orderItemsByOrderId}
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