"use client";

import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ChefHat,
  CircleCheck,
  CircleX,
  Printer,
  Truck,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  STAGE_LABELS,
  getPrimaryActionKind,
  getPrimaryActionLabel,
  type BoardStage,
  type DeliveryPersonOption,
  type OrderCardActions,
  type OrderCardView,
} from "../_lib/order-display";
import {
  ChangeNotices,
  DeliveryPersonPicker,
  ItemsList,
  KdsLockedState,
  LogisticsBlock,
  OrderNoteBlock,
  OrderNumber,
  OrderTypeBadge,
  OriginBadge,
  PaymentStatusPill,
  PixReviewNotice,
  PrimaryActionButton,
} from "./order-card-sections";

type OrderDetailsDrawerProps = {
  view: OrderCardView | null;
  stage: BoardStage | null;
  onClose: () => void;
  isBusy: boolean;
  kdsEnabled: boolean;
  deliveryPeople: DeliveryPersonOption[];
  actions: OrderCardActions;
};

function DetailsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 tabular-nums",
        strong
          ? "pt-2 text-base font-black text-zinc-50"
          : "text-sm text-zinc-300",
      )}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const secondaryButtonClassName =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold text-zinc-200 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-40";

export function OrderDetailsDrawer({
  view,
  stage,
  onClose,
  isBusy,
  kdsEnabled,
  deliveryPeople,
  actions,
}: OrderDetailsDrawerProps) {
  const open = Boolean(view && stage);

  // Mantém o último pedido aberto visível durante a animação de saída.
  const [shown, setShown] = useState<{
    view: OrderCardView;
    stage: BoardStage;
  } | null>(null);

  if (view && stage && (shown?.view !== view || shown?.stage !== stage)) {
    setShown({ view, stage });
  }

  // Reinicia o seletor de motoboy quando outro pedido é aberto.
  const [pickerOrderId, setPickerOrderId] = useState<string | null>(null);
  const [deliveryPickerOpen, setDeliveryPickerOpen] = useState(false);
  const [selectedDeliveryPersonId, setSelectedDeliveryPersonId] = useState("");

  if (view && view.id !== pickerOrderId) {
    setPickerOrderId(view.id);
    setDeliveryPickerOpen(false);
    setSelectedDeliveryPersonId(view.deliveryPersonId ?? "");
  }

  const currentView = shown?.view ?? null;
  const currentStage = shown?.stage ?? null;

  const kdsLocked = currentStage === "preparation" && kdsEnabled;
  const primaryActionKind =
    currentView && currentStage
      ? getPrimaryActionKind(currentStage, currentView.isDelivery)
      : null;

  const handlePrimaryAction = () => {
    if (!currentView || !primaryActionKind) return;

    if (primaryActionKind === "pickDeliveryPerson") {
      setDeliveryPickerOpen(true);
      return;
    }

    if (primaryActionKind === "accept") actions.onAccept(currentView.id);
    if (primaryActionKind === "markReady") actions.onMarkReady(currentView.id);
    if (primaryActionKind === "finish") actions.onFinish(currentView.id);

    onClose();
  };

  const handleFinishDelivery = () => {
    if (!currentView) return;

    actions.onSendToRoute(currentView.id, selectedDeliveryPersonId);
    setDeliveryPickerOpen(false);
    onClose();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />

        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col bg-[#111113] shadow-2xl shadow-black ring-1 ring-white/10 duration-300 focus:outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
          {currentView && currentStage && (
            <>
              <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
                <div className="min-w-0 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                    Pedido · {STAGE_LABELS[currentStage]}
                  </p>

                  <Dialog.Title className="flex flex-wrap items-center gap-2">
                    <OrderNumber
                      number={currentView.number}
                      className="text-2xl leading-none"
                    />
                    <OrderTypeBadge typeLabel={currentView.typeLabel} />
                    <OriginBadge label={currentView.originLabel} />
                  </Dialog.Title>

                  <Dialog.Description className="text-sm text-zinc-400">
                    <span className="font-bold text-zinc-100">
                      {currentView.customerName}
                    </span>{" "}
                    · {currentView.customerPhone} · {currentView.createdAtLabel}
                  </Dialog.Description>
                </div>

                <Dialog.Close
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-zinc-50"
                  aria-label="Fechar detalhes"
                >
                  <X className="h-4 w-4" aria-hidden />
                </Dialog.Close>
              </header>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                <DetailsSection
                  title={
                    currentView.typeLabel === "Entrega"
                      ? "Entrega"
                      : currentView.typeLabel === "Mesa"
                        ? "Mesa"
                        : "Retirada"
                  }
                >
                  <LogisticsBlock view={currentView} />

                  {(currentView.deliveryPersonName || currentView.customerCpf) && (
                    <div className="space-y-1 text-sm text-zinc-300">
                      {currentView.deliveryPersonName && (
                        <p>
                          <span className="font-bold text-zinc-100">
                            Motoboy:
                          </span>{" "}
                          {currentView.deliveryPersonName}
                        </p>
                      )}

                      {currentView.customerCpf && (
                        <p>
                          <span className="font-bold text-zinc-100">CPF:</span>{" "}
                          {currentView.customerCpf}
                        </p>
                      )}
                    </div>
                  )}
                </DetailsSection>

                {currentView.isPixReview && currentStage === "analysis" && (
                  <PixReviewNotice
                    proofUrl={currentView.pixProofUrl}
                    variant="details"
                  />
                )}

                <DetailsSection
                  title={`Itens · ${currentView.items.length} ${
                    currentView.items.length === 1 ? "item" : "itens"
                  }`}
                >
                  <div className="rounded-lg bg-white/[0.03] px-3 py-3 ring-1 ring-inset ring-white/[0.06]">
                    <ItemsList items={currentView.items} expanded />
                  </div>
                </DetailsSection>

                {currentView.orderNote && (
                  <OrderNoteBlock note={currentView.orderNote} />
                )}

                <DetailsSection title="Pagamento">
                  <div className="space-y-3 rounded-lg bg-white/[0.03] px-3 py-3 ring-1 ring-inset ring-white/[0.06]">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-zinc-50">
                        {currentView.paymentLabel}
                      </p>
                      <PaymentStatusPill
                        tone={currentView.paymentTone}
                        label={currentView.paymentStatusLabel}
                      />
                    </div>

                    <div className="space-y-1.5 border-t border-white/[0.06] pt-3">
                      <SummaryRow
                        label="Subtotal"
                        value={currentView.subtotalLabel}
                      />
                      {currentView.deliveryFeeLabel && (
                        <SummaryRow
                          label="Taxa de entrega"
                          value={currentView.deliveryFeeLabel}
                        />
                      )}
                      {currentView.discountLabel && (
                        <SummaryRow
                          label="Desconto"
                          value={`-${currentView.discountLabel}`}
                        />
                      )}
                      <div className="border-t border-white/[0.06]">
                        <SummaryRow
                          label="Total"
                          value={currentView.totalLabel}
                          strong
                        />
                      </div>
                    </div>

                    <ChangeNotices view={currentView} />

                    {currentView.pixProofUrl &&
                      !(currentView.isPixReview && currentStage === "analysis") && (
                        <a
                          href={currentView.pixProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-xs font-bold text-zinc-300 underline underline-offset-2 transition hover:text-zinc-50"
                        >
                          Ver comprovante Pix
                        </a>
                      )}
                  </div>
                </DetailsSection>

                <DetailsSection title="Linha do tempo">
                  <ol className="space-y-1.5">
                    {currentView.timeline.map((entry) => (
                      <li
                        key={entry.label}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="text-zinc-400">{entry.label}</span>
                        <span className="tabular-nums text-zinc-100">
                          {entry.value}
                        </span>
                      </li>
                    ))}
                  </ol>
                </DetailsSection>
              </div>

              <footer className="space-y-3 border-t border-white/[0.06] bg-[#0D0D0F] px-5 py-4">
                {currentStage === "ready" &&
                  currentView.isDelivery &&
                  deliveryPickerOpen && (
                    <DeliveryPersonPicker
                      deliveryPeople={deliveryPeople}
                      value={selectedDeliveryPersonId}
                      onChange={setSelectedDeliveryPersonId}
                      onBack={() => setDeliveryPickerOpen(false)}
                      onConfirm={handleFinishDelivery}
                      isBusy={isBusy}
                    />
                  )}

                <div className="flex flex-wrap items-center gap-2">
                  {currentStage !== "analysis" && (
                    <button
                      type="button"
                      onClick={() => actions.onPrint(currentView.id, "kitchen")}
                      className={secondaryButtonClassName}
                    >
                      <ChefHat className="h-4 w-4" aria-hidden />
                      Cozinha
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => actions.onPrint(currentView.id, "receipt")}
                    className={secondaryButtonClassName}
                  >
                    <Printer className="h-4 w-4" aria-hidden />
                    Recibo
                  </button>

                  <button
                    type="button"
                    onClick={() => actions.onRequestCancel(currentView.id)}
                    disabled={isBusy}
                    className={cn(
                      secondaryButtonClassName,
                      "text-red-300 ring-red-500/25 hover:bg-red-500/10 hover:text-red-200",
                    )}
                  >
                    <CircleX className="h-4 w-4" aria-hidden />
                    Cancelar
                  </button>

                  {kdsLocked ? (
                    <KdsLockedState className="min-w-[180px]" />
                  ) : (
                    <PrimaryActionButton
                      label={getPrimaryActionLabel(currentStage, currentView)}
                      onClick={handlePrimaryAction}
                      disabled={isBusy}
                      isBusy={isBusy}
                      className="min-w-[180px]"
                      icon={
                        primaryActionKind === "pickDeliveryPerson" ? (
                          <Truck className="h-4 w-4 shrink-0" aria-hidden />
                        ) : (
                          <CircleCheck className="h-4 w-4 shrink-0" aria-hidden />
                        )
                      }
                    />
                  )}
                </div>
              </footer>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
