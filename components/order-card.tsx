"use client"

import { memo, useState, useEffect, useRef } from "react"
import {
  Clock, Loader2, Package, User, ChefHat, CreditCard,
  Bike, Store, UtensilsCrossed, AlertTriangle, MapPin,
  Phone, MessageSquare, ChevronDown, X
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface OrderItem {
  name: string
  quantity: number
  price: number
}

export type OrderType = "delivery" | "retirada" | "mesa"
export type OrderPayment = "pix" | "cartao" | "dinheiro" | "vale"
export type OrderPriority = "normal" | "alta" | "urgente"
export type KanbanStatus = "pendente" | "em_preparo" | "pronto" | "saiu_entrega" | "finalizado"

export type DeliveryStatus = "nao_atribuido" | "atribuido" | "entregue"

export interface KanbanOrder {
  id: string
  customerName: string
  customerPhone: string
  customerAddress?: string
  items: OrderItem[]
  total: number
  time: string
  status: KanbanStatus
  type: OrderType
  payment: OrderPayment
  priority: OrderPriority
  observations?: string
  createdAt: number // timestamp
  prepTime?: number
  tableNumber?: number
  // Delivery assignment (Supabase: delivery_person_id, delivery_fee)
  deliveryPersonId?: string
  deliveryPersonName?: string
  deliveryFee?: number
  deliveryStatus?: DeliveryStatus
}

interface OrderCardProps {
  order: KanbanOrder
  actions: {
    label: string
    color: string
    onClick: (prepTime?: number) => void
  }[]
  isExiting?: boolean
  onViewDetails?: (order: KanbanOrder) => void
  onAssignDelivery?: (order: KanbanOrder) => void
}

const TYPE_CONFIG: Record<OrderType, { label: string; icon: typeof Bike; className: string }> = {
  delivery: { label: "Delivery", icon: Bike, className: "bg-blue-100 text-blue-700" },
  retirada: { label: "Retirada", icon: Store, className: "bg-purple-100 text-purple-700" },
  mesa: { label: "Mesa", icon: UtensilsCrossed, className: "bg-amber-100 text-amber-700" },
}

const PAYMENT_LABELS: Record<OrderPayment, string> = {
  pix: "Pix",
  cartao: "Cartao",
  dinheiro: "Dinheiro",
  vale: "Vale Refeicao",
}

function OrderCardComponent({ order, actions, isExiting, onViewDetails, onAssignDelivery }: OrderCardProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [showPrepSelector, setShowPrepSelector] = useState(false)
  const [selectedPrepTime, setSelectedPrepTime] = useState(20)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const update = () => {
      setElapsed(Math.floor((Date.now() - order.createdAt) / 1000))
    }
    update()
    intervalRef.current = setInterval(update, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [order.createdAt])

  const elapsedMin = Math.floor(elapsed / 60)
  const isLate = order.prepTime ? elapsedMin > order.prepTime : elapsedMin > 30
  const isAlmostLate = order.prepTime ? elapsedMin > order.prepTime * 0.7 : elapsedMin > 20

  const timerColor = isLate
    ? "text-red-600 bg-red-50 border-red-200"
    : isAlmostLate
      ? "text-amber-600 bg-amber-50 border-amber-200"
      : "text-green-600 bg-green-50 border-green-200"

  const handleAction = (label: string, onClick: (prepTime?: number) => void) => {
    if (label === "Aceitar" && !showPrepSelector) {
      setShowPrepSelector(true)
      return
    }
    setLoadingAction(label)
    setTimeout(() => {
      onClick(label === "Aceitar" ? selectedPrepTime : undefined)
      setLoadingAction(null)
      setShowPrepSelector(false)
    }, 400)
  }

  // Progress bar percentage
  const maxTime = order.prepTime || 30
  const progressPct = Math.min(100, (elapsedMin / maxTime) * 100)
  const progressColor = isLate ? "bg-red-500" : isAlmostLate ? "bg-amber-400" : "bg-green-500"

  const typeConf = TYPE_CONFIG[order.type]
  const TypeIcon = typeConf.icon

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm transition-all duration-300",
        isExiting
          ? "scale-95 opacity-0 -translate-x-4"
          : "scale-100 opacity-100 translate-x-0",
        "hover:shadow-md",
        isLate ? "border-red-300 ring-1 ring-red-200" : "border-border"
      )}
    >
      {/* Late alert */}
      {isLate && order.status !== "finalizado" && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
          <span className="text-xs font-semibold text-red-700">Pedido atrasado!</span>
        </div>
      )}

      {/* Header: ID + Badges */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">#{order.id}</span>
          {order.priority !== "normal" && (
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
              order.priority === "urgente"
                ? "bg-red-100 text-red-700 animate-pulse"
                : "bg-amber-100 text-amber-700"
            )}>
              {order.priority}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", typeConf.className)}>
            <TypeIcon className="h-3 w-3" />
            {typeConf.label}
            {order.type === "mesa" && order.tableNumber ? ` ${order.tableNumber}` : ""}
          </span>
        </div>
      </div>

      {/* Customer */}
      <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <User className="h-3.5 w-3.5" />
        <span className="truncate">{order.customerName}</span>
      </div>

      {/* Timer bar */}
      {order.status !== "finalizado" && (
        <div className="mt-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className={cn("flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums", timerColor)}>
              <Clock className="h-3 w-3" />
              {elapsedMin}min
            </span>
            {order.prepTime && (
              <span className="text-[10px] text-muted-foreground">{order.prepTime}min estimado</span>
            )}
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-1000 ease-linear", progressColor)} style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Items summary */}
      <div className="mt-3 space-y-1 rounded-lg bg-secondary/60 px-3 py-2">
        {order.items.slice(0, 3).map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-foreground truncate">
              <Package className="h-3 w-3 text-muted-foreground shrink-0" />
              {item.quantity}x {item.name}
            </span>
            <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
              R$ {(item.quantity * item.price).toFixed(2).replace(".", ",")}
            </span>
          </div>
        ))}
        {order.items.length > 3 && (
          <p className="text-xs text-muted-foreground pt-0.5">+{order.items.length - 3} itens</p>
        )}
      </div>

      {/* Footer: Payment + Total */}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <CreditCard className="h-3 w-3" />
          {PAYMENT_LABELS[order.payment]}
        </span>
        <span className="text-base font-bold text-foreground tabular-nums">
          R$ {order.total.toFixed(2).replace(".", ",")}
        </span>
      </div>

      {/* Observations hint */}
      {order.observations && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5">
          <MessageSquare className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-700 line-clamp-2">{order.observations}</p>
        </div>
      )}

      {/* Delivery Person Section - Only for delivery orders */}
      {order.type === "delivery" && order.status !== "pendente" && (
        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bike className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Entregador</span>
            </div>
            {/* Delivery status badge */}
            {order.deliveryStatus === "entregue" ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">Entregue</span>
            ) : order.deliveryPersonId ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Atribuido</span>
            ) : (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Nao atribuido</span>
            )}
          </div>
          
          {order.deliveryPersonId && order.deliveryPersonName ? (
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  {order.deliveryPersonName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{order.deliveryPersonName}</p>
                  {order.deliveryFee && (
                    <p className="text-[10px] text-muted-foreground">R$ {order.deliveryFee.toFixed(2).replace(".", ",")} / entrega</p>
                  )}
                </div>
              </div>
              {order.deliveryStatus !== "entregue" && onAssignDelivery && (
                <button
                  onClick={() => onAssignDelivery(order)}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Trocar
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => onAssignDelivery?.(order)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 px-3 py-2 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50 hover:border-blue-400"
            >
              <Bike className="h-3.5 w-3.5" />
              Atribuir Entregador
            </button>
          )}
        </div>
      )}

      {/* Prep time selector */}
      {showPrepSelector && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Tempo de preparo</span>
            <span className="text-sm font-bold text-blue-700 tabular-nums">{selectedPrepTime} min</span>
          </div>
          <input
            type="range"
            min={5}
            max={80}
            step={5}
            value={selectedPrepTime}
            onChange={(e) => setSelectedPrepTime(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer accent-blue-600 bg-blue-200"
          />
          <div className="flex items-center justify-between text-[10px] text-blue-500">
            <span>5 min</span>
            <span>80 min</span>
          </div>
        </div>
      )}

      {/* Prep time badge (visible when prep started) */}
      {order.prepTime && order.status === "em_preparo" && !showPrepSelector && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1.5 text-xs font-medium text-blue-700">
          <ChefHat className="h-3.5 w-3.5" />
          Preparo: {order.prepTime} min
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        {showPrepSelector ? (
          <>
            <button
              onClick={() => setShowPrepSelector(false)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-all hover:bg-secondary active:scale-[0.97]"
            >
              Cancelar
            </button>
            <button
              disabled={loadingAction !== null}
              onClick={() => {
                const acceptAction = actions.find((a) => a.label === "Aceitar")
                if (acceptAction) handleAction("Aceitar", acceptAction.onClick)
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-green-700 active:scale-[0.97] disabled:opacity-70"
            >
              {loadingAction === "Aceitar" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </button>
          </>
        ) : (
          <>
            {actions.map((action) => (
              <button
                key={action.label}
                disabled={loadingAction !== null}
                onClick={() => handleAction(action.label, action.onClick)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-all",
                  "disabled:opacity-70 hover:brightness-110 active:scale-[0.97]",
                  action.color
                )}
              >
                {loadingAction === action.label ? <Loader2 className="h-4 w-4 animate-spin" /> : action.label}
              </button>
            ))}
            {onViewDetails && (
              <button
                onClick={() => onViewDetails(order)}
                className="flex items-center justify-center rounded-lg border border-border px-2.5 py-2 text-sm text-muted-foreground transition-all hover:bg-secondary active:scale-[0.97]"
                aria-label="Ver detalhes"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default memo(OrderCardComponent)

// ── Order Details Modal ──

interface OrderDetailsModalProps {
  order: KanbanOrder | null
  onClose: () => void
  actions: { label: string; color: string; onClick: () => void }[]
  statusHistory: { status: string; time: string }[]
  onAssignDelivery?: (order: KanbanOrder) => void
}

export function OrderDetailsModal({ order, onClose, actions, statusHistory, onAssignDelivery }: OrderDetailsModalProps) {
  if (!order) return null
  const typeConf = TYPE_CONFIG[order.type]
  const TypeIcon = typeConf.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-card-foreground">Pedido #{order.id}</h3>
            <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", typeConf.className)}>
              <TypeIcon className="h-3 w-3" />{typeConf.label}
            </span>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {/* Customer info */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</p>
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-card-foreground">
                <User className="h-3.5 w-3.5 text-muted-foreground" />{order.customerName}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />{order.customerPhone}
              </div>
              {order.customerAddress && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />{order.customerAddress}
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Itens do Pedido</p>
            <div className="rounded-lg border border-border divide-y divide-border">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-secondary text-[10px] font-bold text-muted-foreground">{item.quantity}x</span>
                    <span className="text-sm text-card-foreground">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-card-foreground">R$ {(item.quantity * item.price).toFixed(2).replace(".", ",")}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
                <span className="text-sm font-bold text-card-foreground">Total</span>
                <span className="text-lg font-bold text-card-foreground tabular-nums">R$ {order.total.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>
          </div>

          {/* Observations */}
          {order.observations && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Observacoes</p>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-800">{order.observations}</p>
              </div>
            </div>
          )}

          {/* Payment */}
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Pagamento:</span>
            <span className="text-sm font-semibold text-card-foreground">{PAYMENT_LABELS[order.payment]}</span>
          </div>

          {/* Delivery Person Section - Only for delivery orders */}
          {order.type === "delivery" && order.status !== "pendente" && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Entregador</p>
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bike className="h-4 w-4 text-muted-foreground" />
                    {order.deliveryPersonId && order.deliveryPersonName ? (
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                          {order.deliveryPersonName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-card-foreground">{order.deliveryPersonName}</p>
                          {order.deliveryFee && (
                            <p className="text-xs text-muted-foreground">Valor: R$ {order.deliveryFee.toFixed(2).replace(".", ",")}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Nenhum entregador atribuido</span>
                    )}
                  </div>
                  {/* Status badge */}
                  {order.deliveryStatus === "entregue" ? (
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">Entregue</span>
                  ) : order.deliveryPersonId ? (
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">Atribuido</span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Nao atribuido</span>
                  )}
                </div>
                {onAssignDelivery && order.deliveryStatus !== "entregue" && (
                  <button
                    onClick={() => onAssignDelivery(order)}
                    className="mt-3 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-100"
                  >
                    {order.deliveryPersonId ? "Trocar Entregador" : "Atribuir Entregador"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Status History */}
          {statusHistory.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Historico</p>
              <div className="space-y-2">
                {statusHistory.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />
                    <span className="font-medium text-card-foreground">{s.status}</span>
                    <span className="text-muted-foreground ml-auto text-xs tabular-nums">{s.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4 shrink-0">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-muted">
            Fechar
          </button>
          {actions.map((a) => (
            <button key={a.label} onClick={a.onClick} className={cn("rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97]", a.color)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
