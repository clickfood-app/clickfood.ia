"use client"

import { Minus, Plus, Trash2, MessageSquare } from "lucide-react"
import type { OrderItem, OrderType } from "@/lib/order-types"

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
    return `R$ ${value.toFixed(2).replace(".", ",")}`
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-3">
              <MessageSquare className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum item adicionado</p>
            <p className="text-xs text-muted-foreground mt-1">Adicione produtos ao pedido</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} un</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground whitespace-nowrap">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-muted"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-muted"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-100 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Observation */}
                <input
                  type="text"
                  value={item.observation || ""}
                  onChange={(e) => onUpdateObservation(item.id, e.target.value)}
                  placeholder="Observacao do item..."
                  className="mt-2 h-8 w-full rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="mt-4 border-t border-border pt-4 space-y-2">
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
              onChange={(e) => {
                const val = e.target.value.replace(",", ".")
                const num = parseFloat(val)
                onDiscountChange(isNaN(num) ? 0 : num)
              }}
              placeholder="0,00"
              className="h-7 w-20 rounded-md border border-input bg-background px-2 text-right text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-base font-semibold text-foreground">Total</span>
          <span className="text-xl font-bold text-[hsl(var(--primary))]">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  )
}
