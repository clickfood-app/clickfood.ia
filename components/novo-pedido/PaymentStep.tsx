"use client";

import { Banknote, Check, CreditCard, Loader2, QrCode, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";
import type { OrderType, PaymentMethod } from "@/lib/order-types";
import { formatCurrency, type PaymentStatus } from "./shared";

const PAYMENT_METHODS: Array<{ id: PaymentMethod; name: string; icon: typeof QrCode }> = [
  { id: "pix" as PaymentMethod, name: "Pix", icon: QrCode },
  { id: "dinheiro" as PaymentMethod, name: "Dinheiro", icon: Banknote },
  { id: "credito" as PaymentMethod, name: "Crédito", icon: CreditCard },
  { id: "debito" as PaymentMethod, name: "Débito", icon: Wallet },
];

const PAYMENT_STATUS_OPTIONS: Array<{ id: PaymentStatus; label: string; description: string }> = [
  { id: "pending", label: "Pendente", description: "O cliente ainda vai pagar" },
  { id: "paid", label: "Já pago", description: "Pagamento já confirmado" },
];

const CASH_SHORTCUTS = [50, 100, 200];

interface PaymentStepProps {
  orderType: OrderType;
  totalItems: number;
  total: number;
  customerName: string;
  deliveryNeighborhoodName: string | null;
  paymentStatus: PaymentStatus;
  onPaymentStatusChange: (status: PaymentStatus) => void;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  receivedAmount: string;
  onReceivedAmountChange: (value: string) => void;
  changeAmount: number;
  canSubmit: boolean;
  blockingMessage: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
    </div>
  );
}

/**
 * Etapa de pagamento. Mostra o valor a cobrar em destaque, a situação e a forma de pagamento,
 * e no dinheiro um campo de troco com atalhos. O resumo final e o botão de confirmar ficam fixos.
 */
export default function PaymentStep({
  orderType,
  totalItems,
  total,
  customerName,
  deliveryNeighborhoodName,
  paymentStatus,
  onPaymentStatusChange,
  paymentMethod,
  onPaymentMethodChange,
  receivedAmount,
  onReceivedAmountChange,
  changeAmount,
  canSubmit,
  blockingMessage,
  isSubmitting,
  onSubmit,
}: PaymentStepProps) {
  const isDelivery = orderType === "delivery";
  const received = Number(receivedAmount || 0);
  const isCash = paymentMethod === "dinheiro";
  const missingAmount = Math.max(0, total - received);
  const cashShortcuts = Array.from(new Set([total, ...CASH_SHORTCUTS])).filter(
    (value) => value >= total && value > 0,
  );
  const selectedPaymentLabel = PAYMENT_METHODS.find((method) => method.id === paymentMethod)?.name || "Não informado";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        <div className="rounded-2xl border border-yellow-400/15 bg-gradient-to-br from-yellow-400/[0.08] to-transparent p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Valor a cobrar</p>
          <p className="mt-2 text-4xl font-black tabular-nums tracking-tight text-yellow-400">
            {formatCurrency(total)}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            {totalItems} {totalItems === 1 ? "item" : "itens"} · {isDelivery ? "Entrega" : "Balcão"}
            {isDelivery && deliveryNeighborhoodName && ` · ${deliveryNeighborhoodName}`}
          </p>
        </div>

        <section>
          <SectionTitle title="Situação do pagamento" description="Informe se o valor já foi recebido." />
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_STATUS_OPTIONS.map((option) => {
              const active = paymentStatus === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPaymentStatusChange(option.id)}
                  className={cn(
                    "flex min-h-[72px] flex-col items-start justify-center rounded-xl border px-4 py-3 text-left transition",
                    active
                      ? "border-yellow-400 bg-yellow-400 text-black shadow-lg shadow-yellow-400/15"
                      : "border-white/[0.08] bg-[#0c0c0c] text-zinc-300 hover:border-white/20",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-bold">
                    {active && <Check className="h-3.5 w-3.5" />}
                    {option.label}
                  </span>
                  <span className={cn("mt-1 text-[11px] leading-4", active ? "text-black/65" : "text-zinc-500")}>
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <SectionTitle title="Forma de pagamento" description="Como o cliente pagou ou vai pagar." />
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((method) => {
              const active = paymentMethod === method.id;
              const Icon = method.icon;

              return (
                <button
                  key={method.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPaymentMethodChange(method.id)}
                  className={cn(
                    "flex h-14 items-center gap-3 rounded-xl border px-4 text-left text-sm font-bold transition",
                    active
                      ? "border-yellow-400 bg-yellow-400/10 text-yellow-300"
                      : "border-white/[0.08] bg-[#0c0c0c] text-zinc-400 hover:border-white/20 hover:text-white",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {method.name}
                </button>
              );
            })}
          </div>
        </section>

        {isCash && (
          <section className="space-y-3 rounded-2xl border border-white/[0.07] bg-[#0c0c0c] p-4">
            <SectionTitle title="Troco" description="Informe o valor entregue pelo cliente para calcular o troco." />

            <div className="flex flex-wrap gap-2">
              {cashShortcuts.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onReceivedAmountChange(String(value))}
                  className={cn(
                    "h-9 rounded-lg border px-3 text-xs font-bold transition",
                    Number(receivedAmount) === value
                      ? "border-yellow-400 bg-yellow-400 text-black"
                      : "border-white/[0.08] bg-[#111] text-zinc-300 hover:border-white/20 hover:text-white",
                  )}
                >
                  {value === total ? "Valor exato" : formatCurrency(value)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Valor recebido
                </span>
                <span className="flex h-11 items-center rounded-xl border border-white/[0.08] bg-[#0b0b0b] px-3.5 focus-within:border-yellow-400/60">
                  <span className="text-xs text-zinc-600">R$</span>
                  <input
                    type="number"
                    min={0}
                    value={receivedAmount}
                    onChange={(event) => onReceivedAmountChange(event.target.value)}
                    placeholder="0,00"
                    className="min-w-0 flex-1 bg-transparent pl-2 text-sm font-bold tabular-nums text-white outline-none placeholder:text-zinc-700"
                  />
                </span>
              </label>

              <div className="block min-w-0">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {received > 0 && received < total ? "Faltam" : "Troco"}
                </span>
                <div
                  className={cn(
                    "flex h-11 items-center justify-end rounded-xl border px-3.5 text-base font-black tabular-nums",
                    received > 0 && received < total
                      ? "border-yellow-400/30 bg-yellow-400/[0.06] text-yellow-300"
                      : "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-400",
                  )}
                >
                  {formatCurrency(received > 0 && received < total ? missingAmount : changeAmount)}
                </div>
              </div>
            </div>
          </section>
        )}

        {blockingMessage && (
          <p className="rounded-xl border border-yellow-400/20 bg-yellow-400/[0.06] px-3.5 py-3 text-xs leading-5 text-yellow-200">
            {blockingMessage}
          </p>
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t border-white/[0.07] bg-[#0b0b0b] p-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <span className="text-zinc-500">Pagamento</span>
          <span className="text-right font-semibold text-zinc-200">
            {PAYMENT_STATUS_OPTIONS.find((option) => option.id === paymentStatus)?.label} · {selectedPaymentLabel}
          </span>
          <span className="text-zinc-500">Cliente</span>
          <span className="truncate text-right font-semibold text-zinc-200">{customerName || "Não informado"}</span>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || isSubmitting}
          className={cn(
            "flex h-14 w-full items-center justify-between rounded-xl px-5 text-sm font-bold transition",
            canSubmit && !isSubmitting
              ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/15 hover:bg-yellow-300 active:scale-[0.99]"
              : "cursor-not-allowed bg-[#151515] text-zinc-600",
          )}
        >
          <span className="flex items-center gap-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isSubmitting ? "Processando pedido..." : "Confirmar pedido"}
          </span>
          <span className="tabular-nums">{formatCurrency(total)}</span>
        </button>
      </div>
    </div>
  );
}
