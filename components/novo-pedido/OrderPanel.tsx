"use client";

import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight, Minus, Pencil, Plus, ShoppingBag, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { OrderItem, OrderType } from "@/lib/order-types";
import { formatCurrency } from "./shared";

interface OrderPanelProps {
  mobile?: boolean;
  orderType: OrderType;
  items: OrderItem[];
  totalItems: number;
  showPaymentStep: boolean;
  isOrderEmpty: boolean;
  /** Seção de cliente, endereço e observações (renderizada pela página). */
  details: ReactNode;
  /** Etapa de pagamento: substitui a comanda quando `showPaymentStep` é true. */
  paymentStep: ReactNode;
  subtotal: number;
  deliveryFee: number;
  deliveryNeighborhoodName: string | null;
  discount: number;
  onDiscountChange: (value: number) => void;
  total: number;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onEditItem: (item: OrderItem) => void;
  onRemoveItem: (itemId: string) => void;
  onClear: () => void;
  onBackToOrder: () => void;
  onContinueToPayment: () => void;
  onClose?: () => void;
}

function ItemRow({
  item,
  onUpdateQuantity,
  onEditItem,
  onRemoveItem,
}: {
  item: OrderItem;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onEditItem: (item: OrderItem) => void;
  onRemoveItem: (itemId: string) => void;
}) {
  const modifierNames = (item.modifiers || []).map((modifier) => modifier.optionName).filter(Boolean);

  return (
    <li className="rounded-2xl border border-white/[0.07] bg-[#0d0d0d] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-bold leading-5 text-white">{item.name}</p>

          {modifierNames.length > 0 && (
            <p className="mt-1 text-xs leading-5 text-zinc-500">{modifierNames.join(" · ")}</p>
          )}

          {item.observation && (
            <p className="mt-2 border-l-2 border-yellow-400/60 pl-2 text-xs leading-5 text-zinc-400">
              {item.observation}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-black tabular-nums text-white">{formatCurrency(item.price * item.quantity)}</p>
          {item.quantity > 1 && (
            <p className="mt-0.5 text-[11px] tabular-nums text-zinc-600">{formatCurrency(item.price)} cada</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
        <div className="flex h-9 items-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b0b0b]">
          <button
            type="button"
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
            aria-label="Diminuir quantidade"
            className="flex h-9 w-9 items-center justify-center text-zinc-400 transition hover:bg-white/[0.05] hover:text-white"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-black tabular-nums text-white">{item.quantity}</span>
          <button
            type="button"
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
            aria-label="Aumentar quantidade"
            className="flex h-9 w-9 items-center justify-center text-zinc-400 transition hover:bg-white/[0.05] hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onEditItem(item)}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#0b0b0b] px-3 text-xs font-semibold text-zinc-300 transition hover:border-white/20 hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
          <button
            type="button"
            onClick={() => onRemoveItem(item.id)}
            aria-label="Remover item"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-[#0b0b0b] text-zinc-500 transition hover:border-red-500/30 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

export default function OrderPanel({
  mobile = false,
  orderType,
  items,
  totalItems,
  showPaymentStep,
  isOrderEmpty,
  details,
  paymentStep,
  subtotal,
  deliveryFee,
  deliveryNeighborhoodName,
  discount,
  onDiscountChange,
  total,
  onUpdateQuantity,
  onEditItem,
  onRemoveItem,
  onClear,
  onBackToOrder,
  onContinueToPayment,
  onClose,
}: OrderPanelProps) {
  const isDelivery = orderType === "delivery";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#080808]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {showPaymentStep && (
            <button
              type="button"
              onClick={onBackToOrder}
              aria-label="Voltar para o pedido"
              className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {showPaymentStep ? "Fechamento" : "Comanda"}
            </p>
            <h2 className="mt-0.5 truncate text-base font-bold text-white">
              {showPaymentStep ? "Pagamento" : "Pedido atual"}
            </h2>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!showPaymentStep && (
            <>
              <span className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-bold tabular-nums text-zinc-200">
                {totalItems} {totalItems === 1 ? "item" : "itens"}
              </span>
              <button
                type="button"
                onClick={onClear}
                disabled={isOrderEmpty}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar
              </button>
            </>
          )}

          {mobile && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar pedido"
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-[#111] text-zinc-400 transition hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {showPaymentStep ? (
        paymentStep
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="p-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] px-6 py-12 text-center">
                  <ShoppingBag className="h-7 w-7 text-zinc-600" />
                  <h3 className="mt-3 text-sm font-bold text-zinc-300">Nenhum item adicionado</h3>
                  <p className="mt-1 max-w-[230px] text-sm leading-5 text-zinc-600">
                    Toque em um produto do catálogo para iniciar o pedido.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onUpdateQuantity={onUpdateQuantity}
                      onEditItem={onEditItem}
                      onRemoveItem={onRemoveItem}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div className="px-4 pb-5">{details}</div>
          </div>

          <div className="shrink-0 space-y-3 border-t border-white/[0.07] bg-[#0b0b0b] p-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Subtotal</span>
                <span className="font-semibold tabular-nums text-zinc-200">{formatCurrency(subtotal)}</span>
              </div>

              {isDelivery && (
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-zinc-500">
                    Taxa de entrega
                    {deliveryNeighborhoodName && <span className="text-zinc-600"> · {deliveryNeighborhoodName}</span>}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-semibold tabular-nums",
                      deliveryNeighborhoodName ? "text-zinc-200" : "text-yellow-300",
                    )}
                  >
                    {deliveryNeighborhoodName ? formatCurrency(deliveryFee) : "A definir"}
                  </span>
                </div>
              )}

              <label className="flex items-center justify-between gap-3">
                <span className="text-zinc-500">Desconto</span>
                <span className="flex h-9 w-28 items-center rounded-xl border border-white/[0.08] bg-[#0b0b0b] px-3 focus-within:border-yellow-400/60">
                  <span className="text-xs text-zinc-600">R$</span>
                  <input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(event) => onDiscountChange(Math.max(0, Number(event.target.value || 0)))}
                    aria-label="Valor do desconto em reais"
                    className="min-w-0 flex-1 bg-transparent text-right text-sm font-semibold tabular-nums text-white outline-none"
                  />
                </span>
              </label>
            </div>

            <div className="flex items-end justify-between rounded-2xl bg-yellow-400/[0.07] px-4 py-3">
              <span className="text-sm font-bold text-zinc-200">Total</span>
              <span className="text-3xl font-black tabular-nums tracking-tight text-yellow-400">
                {formatCurrency(total)}
              </span>
            </div>

            <button
              type="button"
              onClick={onContinueToPayment}
              disabled={items.length === 0}
              className={cn(
                "flex h-12 w-full items-center justify-between rounded-xl px-4 text-sm font-bold transition",
                items.length > 0
                  ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/15 hover:bg-yellow-300 active:scale-[0.99]"
                  : "cursor-not-allowed bg-[#151515] text-zinc-600",
              )}
            >
              Continuar para pagamento
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
