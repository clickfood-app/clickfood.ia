"use client";

import type { ReactNode } from "react";
import {
  Banknote,
  Bot,
  ChefHat,
  Globe,
  Loader2,
  MapPin,
  MessageSquareText,
  ShieldAlert,
  ShoppingBag,
  Store,
  Truck,
  UtensilsCrossed,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  formatGuestCount,
  splitOrderNumber,
  type DeliveryPersonOption,
  type OrderCardView,
  type OrderItemView,
  type PaymentTone,
  type StageTiming,
  type TimingTone,
} from "../_lib/order-display";

export function OrderNumber({
  number,
  className,
}: {
  number: string;
  className?: string;
}) {
  const { lead, tail } = splitOrderNumber(number);

  return (
    <span
      className={cn("font-black tabular-nums tracking-tight", className)}
    >
      <span className="text-zinc-500">#</span>
      {lead && <span className="text-zinc-400">{lead}</span>}
      <span className="text-zinc-50">{tail}</span>
    </span>
  );
}

const TYPE_ICONS: Record<string, typeof Truck> = {
  Entrega: Truck,
  Retirada: ShoppingBag,
  Mesa: UtensilsCrossed,
};

export function OrderTypeBadge({ typeLabel }: { typeLabel: string }) {
  const Icon = TYPE_ICONS[typeLabel] ?? ShoppingBag;

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-100">
      <Icon className="h-3 w-3" aria-hidden />
      {typeLabel}
    </span>
  );
}

export function OriginBadge({ label }: { label: string | null }) {
  if (!label) return null;

  if (label === "IA") {
    return (
      <span
        title="Pedido criado pelo robô (IA)"
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-100 ring-1 ring-inset ring-white/20"
      >
        <Bot className="h-3 w-3" aria-hidden />
        IA
      </span>
    );
  }

  const Icon = label === "PDV" ? Store : Globe;

  return (
    <span
      title={`Origem: ${label}`}
      className="inline-flex items-center gap-1 px-0.5 text-[11px] font-semibold text-zinc-500"
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

export function NewBadge() {
  return (
    <span className="rounded-md bg-yellow-400 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-black">
      Novo
    </span>
  );
}

const TIMER_TONE_CLASSES: Record<TimingTone, string> = {
  new: "bg-white/[0.05] text-zinc-100 ring-white/10",
  neutral: "bg-white/[0.05] text-zinc-100 ring-white/10",
  attention: "bg-yellow-400/10 text-yellow-300 ring-yellow-400/30",
  warning: "bg-orange-500/10 text-orange-300 ring-orange-500/35",
  late: "bg-red-500/15 text-red-300 ring-red-500/40",
};

export function TimerChip({ timing }: { timing: StageTiming }) {
  return (
    <div
      title={timing.title}
      className={cn(
        "flex shrink-0 flex-col items-end rounded-lg px-2 py-1 ring-1 ring-inset",
        TIMER_TONE_CLASSES[timing.tone],
      )}
    >
      <span className="text-[15px] font-black leading-tight tabular-nums">
        {timing.value}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-[0.12em] opacity-80">
        {timing.caption}
      </span>
    </div>
  );
}

export function LogisticsBlock({ view }: { view: OrderCardView }) {
  if (view.typeLabel === "Mesa") {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-white/[0.035] px-3 py-2 ring-1 ring-inset ring-white/[0.08]">
        <UtensilsCrossed className="h-4 w-4 text-zinc-200" aria-hidden />
        <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-50">
          Mesa{view.tableNumber ? ` ${view.tableNumber}` : ""}
        </span>
        {view.guestCount && (
          <span className="text-xs text-zinc-400">
            · {formatGuestCount(view.guestCount)}
          </span>
        )}
      </div>
    );
  }

  if (view.typeLabel === "Entrega") {
    return (
      <div className="rounded-lg bg-white/[0.035] px-3 py-2.5 ring-1 ring-inset ring-white/[0.06]">
        <div className="flex gap-2">
          <MapPin
            className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400"
            aria-hidden
          />
          <p
            title={view.address ?? undefined}
            className={cn(
              "line-clamp-3 text-[13px] font-semibold leading-snug",
              view.address ? "text-zinc-100" : "italic text-zinc-500",
            )}
          >
            {view.address ?? "Endereço não informado"}
          </p>
        </div>

        {(view.neighborhood || view.deliveryFeeLabel) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-6">
            {view.neighborhood && (
              <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-zinc-50">
                {view.neighborhood}
              </span>
            )}

            {view.deliveryFeeLabel && (
              <span className="text-xs text-zinc-400">
                Taxa{" "}
                <span className="font-bold tabular-nums text-zinc-200">
                  {view.deliveryFeeLabel}
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-white/[0.035] px-3 py-2 ring-1 ring-inset ring-white/[0.08]">
      <ShoppingBag className="h-4 w-4 text-zinc-200" aria-hidden />
      <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-50">
        Retirada no balcão
      </span>
    </div>
  );
}

type ItemsListProps = {
  items: OrderItemView[];
  expanded?: boolean;
  onToggleExpanded?: () => void;
  itemLimit?: number;
  modifierLimit?: number;
};

export function ItemsList({
  items,
  expanded = true,
  onToggleExpanded,
  itemLimit = 6,
  modifierLimit = 4,
}: ItemsListProps) {
  if (items.length === 0) {
    return (
      <p className="text-xs italic text-zinc-500">
        Itens ainda não carregados.
      </p>
    );
  }

  const visibleItems = expanded ? items : items.slice(0, itemLimit);
  const hiddenItemsCount = items.length - visibleItems.length;
  const canCollapse =
    items.length > itemLimit ||
    items.some((item) => item.modifiers.length > modifierLimit);

  return (
    <div>
      <ul className="space-y-2">
        {visibleItems.map((item) => {
          const visibleModifiers = expanded
            ? item.modifiers
            : item.modifiers.slice(0, modifierLimit);
          const hiddenModifiersCount =
            item.modifiers.length - visibleModifiers.length;

          return (
            <li key={item.id}>
              <div className="flex items-baseline gap-2">
                <span className="w-7 shrink-0 text-sm font-black tabular-nums text-zinc-50">
                  {item.quantity}×
                </span>

                <span className="min-w-0 flex-1 break-words text-[13px] font-bold leading-snug text-zinc-100">
                  {item.name}
                </span>

                {item.totalLabel && (
                  <span className="shrink-0 text-xs tabular-nums text-zinc-400">
                    {item.totalLabel}
                  </span>
                )}
              </div>

              {visibleModifiers.map((modifier, index) => (
                <p
                  key={`${item.id}-modifier-${index}`}
                  className="pl-9 text-xs leading-snug text-zinc-400"
                >
                  {modifier}
                </p>
              ))}

              {hiddenModifiersCount > 0 && (
                <p className="pl-9 text-xs text-zinc-500">
                  + {hiddenModifiersCount}{" "}
                  {hiddenModifiersCount === 1 ? "complemento" : "complementos"}
                </p>
              )}

              {item.notes && (
                <p className="mt-0.5 whitespace-pre-line break-words pl-9 text-xs font-semibold leading-snug text-orange-300">
                  Obs.: {item.notes}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {onToggleExpanded && canCollapse && (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="mt-2 text-xs font-bold text-zinc-400 underline-offset-2 transition hover:text-zinc-100 hover:underline"
        >
          {expanded
            ? "Mostrar menos"
            : hiddenItemsCount > 0
              ? `Ver mais ${hiddenItemsCount} ${hiddenItemsCount === 1 ? "item" : "itens"}`
              : "Ver todos os complementos"}
        </button>
      )}
    </div>
  );
}

export function OrderNoteBlock({ note }: { note: string }) {
  return (
    <div className="rounded-lg bg-orange-500/[0.07] px-3 py-2 ring-1 ring-inset ring-orange-500/20">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-orange-300">
        <MessageSquareText className="h-3 w-3" aria-hidden />
        Obs. do pedido
      </p>

      <p className="mt-1 whitespace-pre-line break-words text-[13px] leading-snug text-zinc-100">
        {note}
      </p>
    </div>
  );
}

export function PixReviewNotice({
  proofUrl,
  variant = "card",
}: {
  proofUrl: string | null;
  variant?: "card" | "details";
}) {
  return (
    <div className="rounded-lg bg-orange-500/10 px-3 py-2 ring-1 ring-inset ring-orange-500/30">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-orange-300">
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
        Pix a conferir
      </p>

      <p className="mt-1 text-xs leading-relaxed text-zinc-300">
        {variant === "details"
          ? "Verifique o comprovante na conversa do WhatsApp. Aceitar o pedido também registra o pagamento como conferido."
          : "Confira o comprovante no WhatsApp antes de aceitar. Se não houver pagamento, cancele o pedido."}
      </p>

      {proofUrl && (
        <a
          href={proofUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-flex text-xs font-bold text-orange-200 underline underline-offset-2 transition hover:text-orange-100"
        >
          Ver comprovante enviado
        </a>
      )}
    </div>
  );
}

const PAYMENT_TONE_CLASSES: Record<PaymentTone, string> = {
  paid: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
  review: "bg-orange-500/10 text-orange-300 ring-orange-500/30",
  cancelled: "bg-red-500/10 text-red-300 ring-red-500/30",
  pending: "bg-white/[0.05] text-zinc-300 ring-white/10",
};

export function PaymentStatusPill({
  tone,
  label,
}: {
  tone: PaymentTone;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ring-1 ring-inset",
        PAYMENT_TONE_CLASSES[tone],
      )}
    >
      {label}
    </span>
  );
}

export function ChangeNotices({ view }: { view: OrderCardView }) {
  if (view.change) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-orange-500/[0.07] px-3 py-2 text-xs ring-1 ring-inset ring-orange-500/20">
        <span className="flex items-center gap-1.5 text-zinc-200">
          <Banknote className="h-3.5 w-3.5 text-orange-300" aria-hidden />
          Troco para{" "}
          <span className="font-black tabular-nums text-zinc-50">
            {view.change.forLabel}
          </span>
        </span>

        <span className="ml-auto font-black tabular-nums text-orange-200">
          levar {view.change.amountLabel}
        </span>
      </div>
    );
  }

  if (view.pdvChange) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-orange-500/[0.07] px-3 py-2 text-xs ring-1 ring-inset ring-orange-500/20">
        <Banknote className="h-3.5 w-3.5 text-orange-300" aria-hidden />

        {view.pdvChange.received && (
          <span className="text-zinc-200">
            Valor informado{" "}
            <span className="font-black tabular-nums text-zinc-50">
              {view.pdvChange.received}
            </span>
          </span>
        )}

        {view.pdvChange.change && (
          <span className="ml-auto font-black tabular-nums text-orange-200">
            Troco {view.pdvChange.change}
          </span>
        )}
      </div>
    );
  }

  return null;
}

export function PaymentSummary({ view }: { view: OrderCardView }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <p className="truncate text-[13px] font-bold text-zinc-100">
          {view.paymentLabel}
        </p>

        <PaymentStatusPill
          tone={view.paymentTone}
          label={view.paymentStatusLabel}
        />
      </div>

      <div className="shrink-0 text-right">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
          Total
        </p>

        <p className="text-xl font-black leading-tight tabular-nums text-zinc-50">
          {view.totalLabel}
        </p>
      </div>
    </div>
  );
}

export function PrimaryActionButton({
  label,
  onClick,
  disabled,
  isBusy,
  icon,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isBusy?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-400 px-3 py-1.5 text-[12px] font-black uppercase leading-tight tracking-[0.04em] text-black transition hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#161619] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {isBusy ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        icon
      )}
      <span className="text-center">{label}</span>
    </button>
  );
}

export function KdsLockedState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-white/[0.04] px-3 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-300 ring-1 ring-inset ring-white/10",
        className,
      )}
      title="Com o KDS ligado, a cozinha marca o pedido como pronto."
    >
      <ChefHat className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">Na cozinha · KDS</span>
    </div>
  );
}

type DeliveryPersonPickerProps = {
  deliveryPeople: DeliveryPersonOption[];
  value: string;
  onChange: (deliveryPersonId: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  isBusy: boolean;
};

export function DeliveryPersonPicker({
  deliveryPeople,
  value,
  onChange,
  onBack,
  onConfirm,
  isBusy,
}: DeliveryPersonPickerProps) {
  return (
    <div className="rounded-lg bg-white/[0.035] p-3 ring-1 ring-inset ring-white/10">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-zinc-100">
          <Truck className="h-4 w-4" aria-hidden />
        </span>

        <div className="min-w-0">
          <p className="text-xs font-black text-zinc-50">
            Quem fará a entrega?
          </p>
          <p className="text-[11px] text-zinc-400">
            Selecione o motoboy antes de concluir.
          </p>
        </div>
      </div>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={isBusy || deliveryPeople.length === 0}
        className="mt-2.5 h-9 w-full rounded-lg border border-white/10 bg-[#111113] px-2.5 text-xs font-bold text-zinc-100 outline-none transition focus:border-yellow-400/60 focus:ring-2 focus:ring-yellow-400/20 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Selecionar motoboy"
      >
        <option value="">
          {deliveryPeople.length === 0
            ? "Nenhum motoboy cadastrado"
            : "Selecione um motoboy"}
        </option>

        {deliveryPeople.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
            {person.phone ? ` · ${person.phone}` : ""}
          </option>
        ))}
      </select>

      <div className="mt-2.5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isBusy}
          className="h-8 px-2 text-xs font-bold text-zinc-400 transition hover:text-zinc-100 disabled:opacity-50"
        >
          Voltar
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={isBusy || !value}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-yellow-400 px-3 text-xs font-black text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          )}
          Confirmar finalização
        </button>
      </div>
    </div>
  );
}
