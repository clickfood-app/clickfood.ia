"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChefHat,
  Clock3,
  Loader2,
  Package,
  Printer,
  RefreshCcw,
  Search,
  Settings2,
  Truck,
  Volume2,
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

type NewOrderAlert = {
  orderId: string
  orderNumber: string
  customerName: string
  total: number | string | null
  createdAt: string
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

function isOrderVisibleOnBoard(order: Partial<OrderRow>) {
  if (getBoardStatus(order.status) === null) return false

  const paymentMethod = String(order.payment_method || "").trim().toLowerCase()
  const paymentStatus = String(order.payment_status || "").trim().toLowerCase()

  if (paymentMethod === "pix") {
    return paymentStatus === "paid"
  }

  return true
}

function getAudioContextConstructor() {
  if (typeof window === "undefined") return null

  const audioWindow = window as Window &
    typeof globalThis & {
      webkitAudioContext?: typeof AudioContext
    }

  return window.AudioContext || audioWindow.webkitAudioContext || null
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

function isDeliveryOrder(order: OrderRow) {
  const deliveryFee = Number(order.delivery_fee || 0)
  const notes = normalizeStatus(order.notes)

  const isLocalOrPickup =
    notes.includes("retirada") ||
    notes.includes("retirar") ||
    notes.includes("balcao") ||
    notes.includes("balcão") ||
    notes.includes("pedido local") ||
    notes.includes("mesa") ||
    notes.includes("comanda") ||
    notes.includes("consumo local")

  if (isLocalOrPickup) return false

  const hasDeliverySignal =
    deliveryFee > 0 ||
    Boolean(order.delivery_person_id) ||
    notes.includes("delivery") ||
    notes.includes("entrega") ||
    notes.includes("entregar") ||
    notes.includes("endereco") ||
    notes.includes("endereço") ||
    notes.includes("bairro") ||
    notes.includes("rua")

  return hasDeliverySignal
}

function getOrderTypeLabel(order: OrderRow) {
  return isDeliveryOrder(order) ? "Entrega" : "Retirada"
}

function isPaidOrder(order: OrderRow) {
  return normalizeStatus(order.payment_status) === "paid"
}

function getPaymentBadgeClasses(paymentStatus: string | null) {
  const normalized = normalizeStatus(paymentStatus)

  if (normalized === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }

  if (normalized === "failed" || normalized === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700"
  }

  return "border-amber-200 bg-amber-50 text-amber-700"
}

function getOrderTypeClasses(order: OrderRow) {
  if (isDeliveryOrder(order)) {
    return "border-blue-200 bg-blue-50 text-blue-700"
  }

  return "border-purple-200 bg-purple-50 text-purple-700"
}

function getOrderFlowHint(order: OrderRow, status: BoardStatus) {
  const isDelivery = isDeliveryOrder(order)
  const isPaid = isPaidOrder(order)

  if (status === "analysis") {
    if (isPaid) return "Pedido pago. Pode aceitar com segurança."
    return "Pagamento pendente. Confira a forma de pagamento."
  }

  if (status === "preparation") {
    if (isDelivery) return "Entrega: selecione o motoboy antes de enviar."
    return "Retirada: não precisa selecionar motoboy."
  }

  if (isDelivery) return "Pedido em rota com entregador vinculado."

  return "Retirada pronta para finalizar."
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



function escapeReceiptText(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function printOrderReceipt(
  order: OrderRow,
  items: OrderItem[],
  deliveryPeople: DeliveryPerson[]
) {
  const receiptWindow = window.open("", "_blank", "width=420,height=700")

  if (!receiptWindow) {
    alert("Não foi possível abrir a impressão. Libere pop-ups para imprimir o pedido.")
    return
  }

  const isDelivery = isDeliveryOrder(order)
  const deliveryPersonName = getDeliveryPersonName(
    deliveryPeople,
    order.delivery_person_id
  )

  const itemsHtml =
    items.length > 0
      ? items
          .map(
            (item) => `
              <tr>
                <td>${escapeReceiptText(item.quantity)}x ${escapeReceiptText(item.name)}</td>
                <td class="right">${escapeReceiptText(formatBRL(item.total))}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="2">Itens não carregados</td></tr>`

  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Pedido #${escapeReceiptText(getOrderNumber(order))}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 4mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            width: 72mm;
            margin: 0 auto;
            color: #000;
            background: #fff;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 11px;
            line-height: 1.35;
          }

          .center {
            text-align: center;
          }

          .title {
            font-size: 16px;
            font-weight: 900;
            margin: 0 0 2mm;
          }

          .muted {
            font-size: 10px;
          }

          .divider {
            border-top: 1px dashed #000;
            margin: 3mm 0;
          }

          .row {
            display: flex;
            justify-content: space-between;
            gap: 3mm;
            margin: 1mm 0;
          }

          .label {
            font-weight: 900;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          td {
            padding: 1mm 0;
            vertical-align: top;
          }

          .right {
            text-align: right;
            white-space: nowrap;
          }

          .total {
            font-size: 15px;
            font-weight: 900;
          }

          .obs {
            white-space: pre-wrap;
            word-break: break-word;
          }

          @media print {
            button {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="center">
          <p class="title">PEDIDO #${escapeReceiptText(getOrderNumber(order))}</p>
          <p class="muted">${escapeReceiptText(new Date(order.created_at).toLocaleString("pt-BR"))}</p>
        </div>

        <div class="divider"></div>

        <div class="row">
          <span class="label">Tipo:</span>
          <span>${escapeReceiptText(isDelivery ? "Entrega" : "Retirada / Local")}</span>
        </div>
        <div class="row">
          <span class="label">Pagamento:</span>
          <span>${escapeReceiptText(getPaymentLabel(order.payment_method))} - ${escapeReceiptText(getPaymentStatusLabel(order.payment_status))}</span>
        </div>
        <div class="row">
          <span class="label">Cliente:</span>
          <span>${escapeReceiptText(getCustomerName(order))}</span>
        </div>
        <div class="row">
          <span class="label">Telefone:</span>
          <span>${escapeReceiptText(getCustomerPhone(order))}</span>
        </div>
        ${
          isDelivery
            ? `
              <div class="row">
                <span class="label">Motoboy:</span>
                <span>${escapeReceiptText(deliveryPersonName || "Não selecionado")}</span>
              </div>
              <div class="row">
                <span class="label">Taxa entrega:</span>
                <span>${escapeReceiptText(formatBRL(order.delivery_fee))}</span>
              </div>
            `
            : ""
        }

        <div class="divider"></div>

        <table>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="row total">
          <span>TOTAL</span>
          <span>${escapeReceiptText(formatBRL(order.total))}</span>
        </div>

        ${
          order.notes
            ? `
              <div class="divider"></div>
              <div>
                <p class="label">OBSERVAÇÃO:</p>
                <p class="obs">${escapeReceiptText(order.notes)}</p>
              </div>
            `
            : ""
        }

        <div class="divider"></div>
        <p class="center muted">ClickFood</p>

        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `

  receiptWindow.document.open()
  receiptWindow.document.write(html)
  receiptWindow.document.close()
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
  onPrint: (order: OrderRow, items: OrderItem[]) => void
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
  onPrint,
  onAssignDeliveryPerson,
}: OrderCardProps) {
  const styles = columnStyles[status]
  const isBusy = busyOrderId === order.id
  const isDelivery = isDeliveryOrder(order)
  const isPaid = isPaidOrder(order)
  const TypeIcon = isDelivery ? Truck : Package

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

  const visibleItems = items.slice(0, 3)
  const hiddenItemsCount = Math.max(0, items.length - visibleItems.length)

  return (
    <article
      className={[
        "group overflow-hidden rounded-xl border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
        isLate ? "border-red-300 ring-1 ring-red-100" : "border-slate-200/80",
      ].join(" ")}
    >
      <div
        className={[
          "h-1",
          isLate
            ? "bg-red-500"
            : status === "analysis"
              ? "bg-amber-500"
              : status === "preparation"
                ? "bg-blue-600"
                : "bg-emerald-600",
        ].join(" ")}
      />

      {isLate && (
        <div className="border-b border-red-100 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Pedido atrasado
          </div>
        </div>
      )}

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-base font-black leading-none text-slate-950">
                #{getOrderNumber(order)}
              </h3>

              {status === "analysis" && acceptRemainingMs <= 10000 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-700">
                  Alta
                </span>
              )}
            </div>

            <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-slate-700">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <UserRound className="h-3.5 w-3.5 text-slate-500" />
              </div>

              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900">
                  {getCustomerName(order)}
                </p>
                <p className="truncate text-[11px] font-medium text-slate-500">
                  {getCustomerPhone(order)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={[
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                getOrderTypeClasses(order),
              ].join(" ")}
            >
              <TypeIcon className="h-3 w-3" />
              {getOrderTypeLabel(order)}
            </span>

            <span
              className={[
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                getPaymentBadgeClasses(order.payment_status),
              ].join(" ")}
            >
              {isPaid ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <Clock3 className="h-3 w-3" />
              )}
              {getPaymentStatusLabel(order.payment_status)}
            </span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5">
          <p className="min-w-0 truncate text-[11px] font-semibold text-slate-700">
            {getOrderFlowHint(order, status)}
          </p>

          <p className="shrink-0 text-[11px] font-black text-slate-800">
            {getPaymentLabel(order.payment_method)}
          </p>
        </div>

        <div className="mt-2">
          {status === "analysis" && (
            <>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-bold",
                    acceptRemainingMs <= 10000
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  ].join(" ")}
                >
                  <Clock3 className="h-3 w-3" />
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
                    "h-full rounded-full transition-all",
                    acceptRemainingMs <= 10000 ? "bg-red-500" : "bg-emerald-500",
                  ].join(" ")}
                  style={{ width: `${acceptProgress}%` }}
                />
              </div>
            </>
          )}

          {status === "preparation" && (
            <>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-bold",
                    preparationRemainingMs <= 0
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  ].join(" ")}
                >
                  <Clock3 className="h-3 w-3" />
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
                    "h-full rounded-full transition-all",
                    preparationRemainingMs <= 0 ? "bg-red-500" : String(styles.progress),
                  ].join(" ")}
                  style={{ width: `${preparationProgress}%` }}
                />
              </div>
            </>
          )}

          {status === "on_route" && (
            <>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">
                  <Truck className="h-3 w-3" />
                  {order.out_for_delivery_at
                    ? formatElapsedTime(order.out_for_delivery_at, nowMs)
                    : "Em rota"}
                </span>

                <span className="text-slate-400">
                  saiu às {order.out_for_delivery_at ? formatTimeOnly(order.out_for_delivery_at) : "--:--"}
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-2/3 rounded-full bg-emerald-500" />
              </div>
            </>
          )}
        </div>

        <div className="mt-2 rounded-lg border border-slate-100 bg-white p-2 shadow-inner">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Itens
            </p>

            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
              {items.length} item(ns)
            </span>
          </div>

          {visibleItems.length > 0 ? (
            <div className="space-y-1">
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1 text-[10px] font-black text-slate-600">
                      {item.quantity}x
                    </span>

                    <span className="truncate font-semibold text-slate-700">
                      {item.name}
                    </span>
                  </div>

                  {item.total > 0 && (
                    <span className="shrink-0 text-[11px] font-bold text-slate-500">
                      {formatBRL(item.total)}
                    </span>
                  )}
                </div>
              ))}

              {hiddenItemsCount > 0 && (
                <p className="text-[11px] font-medium text-slate-500">
                  +{hiddenItemsCount} item(ns)
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Itens do pedido não carregados.
            </p>
          )}
        </div>

        {order.notes && (
          <div className="mt-2 max-h-14 overflow-hidden rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5">
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-700">
              Observação
            </p>
            <p className="mt-0.5 text-xs text-amber-900">{order.notes}</p>
          </div>
        )}

        {isDelivery && (status === "preparation" || status === "on_route") && (
          <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/70 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-blue-600" />
                <p className="text-[10px] font-black uppercase tracking-wide text-blue-700">
                  Motoboy
                </p>
              </div>

              {deliveryPersonName ? (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Atribuído
                </span>
              ) : (
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                  Necessário
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
                className="h-9 w-full rounded-lg border border-blue-100 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {deliveryPeople.length === 0
                    ? "Nenhum entregador cadastrado"
                    : "Selecionar motoboy"}
                </option>

                {deliveryPeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                    {person.phone ? ` • ${person.phone}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                  {deliveryPersonName?.charAt(0).toUpperCase() || "M"}
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {deliveryPersonName || "Motoboy não definido"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Taxa: {formatBRL(order.delivery_fee)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-2 border-t border-slate-100 pt-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Total
              </p>
              <p className="text-lg font-black text-slate-950">
                {formatBRL(order.total)}
              </p>
            </div>

            {isDelivery && Number(order.delivery_fee || 0) > 0 && (
              <p className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                Entrega {formatBRL(order.delivery_fee)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => onPrint(order, items)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            title="Imprimir pedido"
          >
            <Printer className="h-4 w-4" />
          </button>

          {status === "analysis" && (
            <>
              <button
                type="button"
                onClick={() => onAccept(order)}
                disabled={isBusy}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Aceitar
              </button>

              <button
                type="button"
                onClick={() => onCancel(order)}
                disabled={isBusy}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle className="h-3.5 w-3.5" />
                Negar
              </button>
            </>
          )}

          {status === "preparation" && (
            <button
              type="button"
              onClick={() => (isDelivery ? onSendToRoute(order) : onFinish(order))}
              disabled={isBusy || (isDelivery && !order.delivery_person_id)}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isDelivery ? (
                <Truck className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {isDelivery ? "Enviar" : "Finalizar"}
            </button>
          )}

          {status === "on_route" && (
            <button
              type="button"
              onClick={() => onFinish(order)}
              disabled={isBusy}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
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
  onPrint: (order: OrderRow, items: OrderItem[]) => void
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
  onPrint,
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
              onPrint={onPrint}
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
  const [orderAlertsEnabled, setOrderAlertsEnabled] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("default")
  const [newOrderAlert, setNewOrderAlert] = useState<NewOrderAlert | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const audioUnlockedRef = useRef(false)
  const alertTimeoutRef = useRef<number | null>(null)
  const previousVisibleOrderIdsRef = useRef<Set<string>>(new Set())
  const notifiedOrderIdsRef = useRef<Set<string>>(new Set())
  const hasSeededVisibleOrdersRef = useRef(false)

  const resumeOrderAudio = useCallback(async () => {
    const AudioContextConstructor = getAudioContextConstructor()

    if (!AudioContextConstructor) return null

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor()
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume()
    }

    audioUnlockedRef.current = audioContextRef.current.state === "running"

    return audioContextRef.current
  }, [])

  const playNewOrderSound = useCallback(async () => {
    try {
      const audioContext = await resumeOrderAudio()

      if (!audioContext) return false

      const masterGain = audioContext.createGain()
      masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime)
      masterGain.gain.exponentialRampToValueAtTime(0.42, audioContext.currentTime + 0.03)
      masterGain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 1.1)
      masterGain.connect(audioContext.destination)

      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator()
        const toneGain = audioContext.createGain()

        oscillator.type = "square"
        oscillator.frequency.setValueAtTime(frequency, startTime)

        toneGain.gain.setValueAtTime(0.0001, startTime)
        toneGain.gain.exponentialRampToValueAtTime(0.9, startTime + 0.015)
        toneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

        oscillator.connect(toneGain)
        toneGain.connect(masterGain)

        oscillator.start(startTime)
        oscillator.stop(startTime + duration + 0.04)
      }

      const start = audioContext.currentTime + 0.02

      playTone(784, start, 0.2)
      playTone(988, start + 0.24, 0.22)
      playTone(1319, start + 0.5, 0.26)

      audioUnlockedRef.current = true
      return true
    } catch (err) {
      console.warn("Não foi possível tocar o alerta sonoro:", err)
      audioUnlockedRef.current = false
      return false
    }
  }, [resumeOrderAudio])

  const disableOrderAlerts = useCallback(() => {
    setOrderAlertsEnabled(false)

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("clickfood_order_alerts_enabled")
    }
  }, [])

  const enableOrderAlerts = useCallback(async () => {
    const soundWorked = await playNewOrderSound()

    if (!soundWorked) {
      setError(
        "O alerta visual foi ativado, mas o navegador não liberou o som. Clique novamente em Ativar alertas e confira se a aba não está mutada."
      )
    } else {
      setError(null)
    }

    setOrderAlertsEnabled(true)

    if (typeof window !== "undefined") {
      window.localStorage.setItem("clickfood_order_alerts_enabled", "true")
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission()
        setNotificationPermission(permission)
      } else {
        setNotificationPermission(Notification.permission)
      }
    } else {
      setNotificationPermission("unsupported")
    }
  }, [playNewOrderSound])

  const showNewOrderAlert = useCallback(
    (order: OrderRow) => {
      if (!order.id) return
      if (notifiedOrderIdsRef.current.has(order.id)) return

      notifiedOrderIdsRef.current.add(order.id)

      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          notifiedOrderIdsRef.current.delete(order.id)
        }, 2 * 60 * 1000)
      }

      const alert: NewOrderAlert = {
        orderId: order.id,
        orderNumber: `#${getOrderNumber(order)}`,
        customerName: getCustomerName(order),
        total: order.total,
        createdAt: order.created_at,
      }

      setNewOrderAlert(alert)

      if (typeof window !== "undefined") {
        if (alertTimeoutRef.current) {
          window.clearTimeout(alertTimeoutRef.current)
        }

        alertTimeoutRef.current = window.setTimeout(() => {
          setNewOrderAlert(null)
        }, 9000)
      }

      if (orderAlertsEnabled) {
        void playNewOrderSound()
      }

      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const notification = new Notification("Novo pedido recebido", {
          body: `${alert.orderNumber} • ${alert.customerName} • ${formatBRL(alert.total)}`,
          tag: `clickfood-order-${order.id}`,
        })

        notification.onclick = () => {
          window.focus()
          notification.close()
        }
      }
    },
    [orderAlertsEnabled, playNewOrderSound]
  )

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

      const visibleOrders = ((data || []) as OrderRow[]).filter(isOrderVisibleOnBoard)

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

  async function registerLoyaltyOrder(orderId: string) {
  const session = await ensureSupabaseSession()

  if (!session?.access_token) {
    throw new Error("Sessão expirada. Entre novamente para registrar fidelidade.")
  }

  const response = await fetch("/api/loyalty/register-order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      order_id: orderId,
    }),
  })

  const result = await response.json().catch(() => null)

  if (!response.ok || result?.success === false) {
    throw new Error(result?.error || "Erro ao registrar fidelidade.")
  }

  return result
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
      if (!isDeliveryOrder(order)) {
        payload = {
          status: "delivered",
          delivered_at: nowIso,
        }
      } else {
        if (!order.delivery_person_id) {
          setError("Selecione um motoboy antes de enviar o pedido para entrega.")
          return
        }

        payload = {
          status: "out_for_delivery",
          out_for_delivery_at: nowIso,
        }
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

    if (payload.status === "delivered") {
      try {
        await registerLoyaltyOrder(order.id)
      } catch (loyaltyError) {
        console.error(
          "Pedido finalizado, mas fidelidade não registrada:",
          loyaltyError
        )

        setError(
          getErrorMessage(
            loyaltyError,
            "Pedido finalizado, mas não foi possível registrar a fidelidade."
          )
        )
      }
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
    if (typeof window === "undefined") return

    setOrderAlertsEnabled(
      window.localStorage.getItem("clickfood_order_alerts_enabled") === "true"
    )

    if ("Notification" in window) {
      setNotificationPermission(Notification.permission)
    } else {
      setNotificationPermission("unsupported")
    }

    return () => {
      if (alertTimeoutRef.current) {
        window.clearTimeout(alertTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!restaurant?.id) {
      previousVisibleOrderIdsRef.current = new Set()
      notifiedOrderIdsRef.current = new Set()
      hasSeededVisibleOrdersRef.current = false
      return
    }

    const visibleOrders = orders.filter(isOrderVisibleOnBoard)
    const nextIds = new Set(visibleOrders.map((order) => order.id))

    if (!hasSeededVisibleOrdersRef.current) {
      previousVisibleOrderIdsRef.current = nextIds
      hasSeededVisibleOrdersRef.current = true
      return
    }

    const newestIncomingOrder = visibleOrders
      .filter((order) => !previousVisibleOrderIdsRef.current.has(order.id))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]

    previousVisibleOrderIdsRef.current = nextIds

    if (newestIncomingOrder) {
      showNewOrderAlert(newestIncomingOrder)
    }
  }, [orders, restaurant?.id, showNewOrderAlert])

  useEffect(() => {
    if (authLoading) {
      setLoading(true)
      return
    }

    if (!user || !restaurant?.id) {
      setOrders([])
      setOrderItemsByOrderId({})
      setDeliveryPeople([])
      setNewOrderAlert(null)
      previousVisibleOrderIdsRef.current = new Set()
      notifiedOrderIdsRef.current = new Set()
      hasSeededVisibleOrdersRef.current = false
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

              <button
                type="button"
                onClick={() => {
                  if (orderAlertsEnabled) {
                    disableOrderAlerts()
                    return
                  }

                  void enableOrderAlerts()
                }}
                className={[
                  "inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition",
                  orderAlertsEnabled
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
                ].join(" ")}
                title={
                  notificationPermission === "denied"
                    ? "O navegador bloqueou notificações de desktop, mas o som do painel pode funcionar."
                    : undefined
                }
              >
                {orderAlertsEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <BellRing className="h-4 w-4" />
                )}
                {orderAlertsEnabled ? "Alertas ativos" : "Ativar alertas"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {newOrderAlert && (
            <div className="mt-3 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                    <BellRing className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-black text-emerald-900">
                      Novo pedido recebido
                    </p>

                    <p className="mt-0.5 text-sm font-semibold text-emerald-800">
                      {newOrderAlert.orderNumber} • {newOrderAlert.customerName}
                    </p>

                    <p className="mt-1 text-xs font-medium text-emerald-700">
                      Total {formatBRL(newOrderAlert.total)}. O pedido já entrou na fila de análise.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setNewOrderAlert(null)}
                  className="rounded-full p-1 text-emerald-700 transition hover:bg-emerald-100"
                  aria-label="Fechar alerta de novo pedido"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
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
                onPrint={(order, items) => printOrderReceipt(order, items, deliveryPeople)}
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
                onPrint={(order, items) => printOrderReceipt(order, items, deliveryPeople)}
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
                onPrint={(order, items) => printOrderReceipt(order, items, deliveryPeople)}
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