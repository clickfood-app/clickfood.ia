"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChefHat,
  CircleX,
  Ellipsis,
  PanelRightOpen,
  Printer,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  getPrimaryActionKind,
  getPrimaryActionLabel,
  getStageTiming,
  formatClockTime,
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
  NewBadge,
  OrderNoteBlock,
  OrderNumber,
  OrderTypeBadge,
  OriginBadge,
  PaymentSummary,
  PixReviewNotice,
  PrimaryActionButton,
  TimerChip,
} from "./order-card-sections";

type OrderCardProps = {
  view: OrderCardView;
  stage: BoardStage;
  nowMs: number;
  isBusy: boolean;
  kdsEnabled: boolean;
  deliveryPeople: DeliveryPersonOption[];
  actions: OrderCardActions;
};

const BAR_CLASSES = {
  yellow: "bg-yellow-400",
  orange: "bg-orange-500",
  red: "bg-red-500",
} as const;

const menuItemClassName =
  "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-zinc-200 outline-none transition data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-white/[0.07] data-[highlighted]:text-zinc-50";

export function OrderCard({
  view,
  stage,
  nowMs,
  isBusy,
  kdsEnabled,
  deliveryPeople,
  actions,
}: OrderCardProps) {
  const [deliveryPickerOpen, setDeliveryPickerOpen] = useState(false);
  const [selectedDeliveryPersonId, setSelectedDeliveryPersonId] = useState(
    view.deliveryPersonId || "",
  );
  const [itemsExpanded, setItemsExpanded] = useState(false);

  const timing = getStageTiming(
    stage,
    view.createdAtMs,
    view.preparationDeadlineMs,
    nowMs,
  );

  const clockLabel = formatClockTime(view.createdAt);
  const kdsLocked = stage === "preparation" && kdsEnabled;
  const primaryActionKind = getPrimaryActionKind(stage, view.isDelivery);
  const primaryActionLabel = getPrimaryActionLabel(stage, view);
  const primaryActionDisabled = isBusy || kdsLocked;

  const handlePrimaryAction = () => {
    if (primaryActionKind === "accept") {
      actions.onAccept(view.id);
      return;
    }

    if (primaryActionKind === "markReady") {
      actions.onMarkReady(view.id);
      return;
    }

    if (primaryActionKind === "pickDeliveryPerson") {
      setDeliveryPickerOpen(true);
      return;
    }

    actions.onFinish(view.id);
  };

  const handleFinishDelivery = () => {
    actions.onSendToRoute(view.id, selectedDeliveryPersonId);
    setDeliveryPickerOpen(false);
  };

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-xl bg-[#161619] ring-1 ring-inset transition-shadow",
        timing.tone === "late"
          ? "ring-red-500/45"
          : timing.tone === "warning"
            ? "ring-orange-500/35"
            : "ring-white/[0.07] hover:ring-white/[0.14]",
        timing.isNew &&
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-500",
      )}
    >
      {timing.barTone && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 w-[3px]",
            BAR_CLASSES[timing.barTone],
          )}
        />
      )}

      <div className="space-y-3 p-3.5 pl-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <button
              type="button"
              onClick={() => actions.onOpenDetails(view.id)}
              title="Ver detalhes do pedido"
              className="block max-w-full rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60"
            >
              <OrderNumber number={view.number} className="text-xl leading-none" />
            </button>

            <div className="flex flex-wrap items-center gap-1.5">
              {timing.isNew && <NewBadge />}
              <OrderTypeBadge typeLabel={view.typeLabel} />
              <OriginBadge label={view.originLabel} />
            </div>
          </div>

          <TimerChip timing={timing} />
        </header>

        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight text-zinc-50">
            {view.customerName}
          </p>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs tabular-nums text-zinc-400">
            <span>{view.customerPhone}</span>
            {clockLabel && (
              <>
                <span aria-hidden className="text-zinc-600">
                  ·
                </span>
                <span>pedido às {clockLabel}</span>
              </>
            )}
          </p>
        </div>

        <LogisticsBlock view={view} />

        <ItemsList
          items={view.items}
          expanded={itemsExpanded}
          onToggleExpanded={() => setItemsExpanded((current) => !current)}
        />

        {view.orderNote && <OrderNoteBlock note={view.orderNote} />}

        {view.isPixReview && stage === "analysis" && (
          <PixReviewNotice proofUrl={view.pixProofUrl} />
        )}

        <div className="space-y-2 border-t border-white/[0.06] pt-3">
          <PaymentSummary view={view} />
          <ChangeNotices view={view} />
        </div>

        <div className="flex items-center gap-2">
          {kdsLocked ? (
            <KdsLockedState />
          ) : (
            <PrimaryActionButton
              label={primaryActionLabel}
              onClick={handlePrimaryAction}
              disabled={primaryActionDisabled}
              isBusy={isBusy}
            />
          )}

          <button
            type="button"
            onClick={() => actions.onPrint(view.id, "receipt")}
            title="Imprimir pedido"
            aria-label="Imprimir pedido"
            className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.08] hover:text-zinc-50"
          >
            <Printer className="h-4 w-4" aria-hidden />
          </button>

          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                title="Mais ações"
                aria-label="Mais ações do pedido"
                className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.08] hover:text-zinc-50 data-[state=open]:bg-white/[0.1] data-[state=open]:text-zinc-50"
              >
                <Ellipsis className="h-4 w-4" aria-hidden />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 min-w-[210px] rounded-xl bg-[#1C1C20] p-1 shadow-2xl shadow-black/60 ring-1 ring-white/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
              >
                <DropdownMenu.Item
                  className={menuItemClassName}
                  onSelect={() => actions.onOpenDetails(view.id)}
                >
                  <PanelRightOpen className="h-4 w-4" aria-hidden />
                  Ver detalhes
                </DropdownMenu.Item>

                {stage !== "analysis" && (
                  <DropdownMenu.Item
                    className={menuItemClassName}
                    onSelect={() => actions.onPrint(view.id, "kitchen")}
                  >
                    <ChefHat className="h-4 w-4" aria-hidden />
                    Imprimir cozinha
                  </DropdownMenu.Item>
                )}

                <DropdownMenu.Separator className="my-1 h-px bg-white/10" />

                <DropdownMenu.Item
                  disabled={isBusy}
                  className={cn(
                    menuItemClassName,
                    "text-red-300 data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-200",
                  )}
                  onSelect={() => actions.onRequestCancel(view.id)}
                >
                  <CircleX className="h-4 w-4" aria-hidden />
                  Cancelar pedido
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {stage === "ready" && view.isDelivery && deliveryPickerOpen && (
          <DeliveryPersonPicker
            deliveryPeople={deliveryPeople}
            value={selectedDeliveryPersonId}
            onChange={setSelectedDeliveryPersonId}
            onBack={() => setDeliveryPickerOpen(false)}
            onConfirm={handleFinishDelivery}
            isBusy={isBusy}
          />
        )}
      </div>
    </article>
  );
}
