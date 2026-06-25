"use client"

import { Minus, Plus, Trash2, MessageSquare } from "lucide-react"
import type { OrderItem, OrderItemModifier, OrderType } from "@/lib/order-types"

interface OrderSummaryProps {
  items: OrderItem[]
  orderType: OrderType
  deliveryFee: number
  discount: number
  onUpdateQuantity: (itemId: string, quantity: number) => void
  onUpdateObservation: (itemId: string, observation: string) => void
  onRemoveItem: (itemId: string) => void
  onDiscountChange: (discount: number) => void
}

export default function OrderSummary({
  items,
  orderType,
  deliveryFee,
  discount,
  onUpdateQuantity,
  onUpdateObservation,
  onRemoveItem,
  onDiscountChange,
}: OrderSummaryProps) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const finalDeliveryFee = orderType === "delivery" ? deliveryFee : 0
  const total = Math.max(0, subtotal + finalDeliveryFee - discount)

  const formatCurrency = (value: number) => {
    return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`
  }

  const formatModifier = (modifier: OrderItemModifier) => {
    const price = modifier.optionPrice > 0 ? ` +${formatCurrency(modifier.optionPrice)}` : ""

    return `${modifier.groupName}: ${modifier.optionName}${price}`
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-7 w-7 text-muted-foreground" />
            </div>

            <p className="text-sm font-medium text-muted-foreground">
              Nenhum item adicionado
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Adicione produtos ao pedido
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const modifiers = Array.isArray(item.modifiers) ? item.modifiers : []

              return (
                <div key={item.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.name}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.price)} un
                      </p>
                    </div>

                    <p className="whitespace-nowrap text-sm font-semibold text-foreground">
                      {formatCurrency(item.price * item.quantity)}
                    </p>
                  </div>

                  {modifiers.length > 0 && (
                    <div className="mt-2 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-2 py-1.5">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-yellow-400">
                        Opções
                      </p>

                      <div className="space-y-0.5">
                        {modifiers.map((modifier, index) => (
                          <p
                            key={`${modifier.groupId}-${modifier.optionId}-${index}`}
                            className="text-[11px] font-semibold leading-relaxed text-yellow-400"
                          >
                            • {formatModifier(modifier)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-muted"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>

                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-muted"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-100 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={item.observation || ""}
                    onChange={(event) => onUpdateObservation(item.id, event.target.value)}
                    placeholder="Observação do item..."
                    className="mt-2 h-8 w-full rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground"
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
        </div>

        {orderType === "delivery" && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Taxa de entrega</span>
            <span className="font-medium text-foreground">{formatCurrency(finalDeliveryFee)}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Desconto</span>

          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">R$</span>

            <input
              type="text"
              value={discount > 0 ? discount.toFixed(2).replace(".", ",") : ""}
              onChange={(event) => {
                const val = event.target.value.replace(",", ".")
                const num = parseFloat(val)

                onDiscountChange(Number.isNaN(num) ? 0 : num)
              }}
              placeholder="0,00"
              className="h-7 w-20 rounded-md border border-input bg-background px-2 text-right text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-base font-semibold text-foreground">Total</span>
          <span className="text-xl font-bold text-[hsl(var(--primary))]">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  )
}