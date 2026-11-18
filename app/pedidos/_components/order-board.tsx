"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import {
  STAGE_LABELS,
  type BoardStage,
  type DeliveryPersonOption,
  type OrderCardActions,
  type OrderCardView,
} from "../_lib/order-display";
import { OrderCard } from "./order-card";
import {
  OrderBoardColumn,
  StageCountPill,
  StageEmptyState,
  getStageSubtitle,
} from "./order-board-column";

const BOARD_STAGES: BoardStage[] = ["analysis", "preparation", "ready"];

type BoardLayout = "desktop" | "tablet" | "mobile";

// Desktop (>= 1280px) é a prioridade: 3 colunas grandes com rolagem própria.
function useBoardLayout(): BoardLayout {
  const [layout, setLayout] = useState<BoardLayout>("desktop");

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const desktopQuery = window.matchMedia("(min-width: 1280px)");
    const tabletQuery = window.matchMedia("(min-width: 768px)");

    const update = () => {
      setLayout(
        desktopQuery.matches
          ? "desktop"
          : tabletQuery.matches
            ? "tablet"
            : "mobile",
      );
    };

    update();
    desktopQuery.addEventListener("change", update);
    tabletQuery.addEventListener("change", update);

    return () => {
      desktopQuery.removeEventListener("change", update);
      tabletQuery.removeEventListener("change", update);
    };
  }, []);

  return layout;
}

type OrderBoardProps = {
  columns: Record<BoardStage, OrderCardView[]>;
  totals: Record<BoardStage, number>;
  isFiltered: boolean;
  nowMs: number;
  busyOrderId: string | null;
  kdsEnabled: boolean;
  deliveryPeople: DeliveryPersonOption[];
  actions: OrderCardActions;
};

export function OrderBoard({
  columns,
  totals,
  isFiltered,
  nowMs,
  busyOrderId,
  kdsEnabled,
  deliveryPeople,
  actions,
}: OrderBoardProps) {
  const layout = useBoardLayout();
  const [activeStage, setActiveStage] = useState<BoardStage>("analysis");

  const renderCards = (stage: BoardStage) =>
    columns[stage].map((view) => (
      <OrderCard
        key={view.id}
        view={view}
        stage={stage}
        nowMs={nowMs}
        isBusy={busyOrderId === view.id}
        kdsEnabled={kdsEnabled}
        deliveryPeople={deliveryPeople}
        actions={actions}
      />
    ));

  if (layout === "desktop") {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-1 gap-3">
        {BOARD_STAGES.map((stage) => (
          <OrderBoardColumn
            key={stage}
            stage={stage}
            count={columns[stage].length}
            total={totals[stage]}
            isFiltered={isFiltered}
            kdsEnabled={kdsEnabled}
          >
            {renderCards(stage)}
          </OrderBoardColumn>
        ))}
      </div>
    );
  }

  if (layout === "tablet") {
    return (
      <div className="space-y-3">
        <div
          role="tablist"
          aria-label="Etapas dos pedidos"
          className="sticky top-16 z-20 grid grid-cols-3 gap-1 rounded-xl bg-[#0D0D0F]/95 p-1 ring-1 ring-inset ring-white/[0.06] backdrop-blur"
        >
          {BOARD_STAGES.map((stage) => {
            const isActive = activeStage === stage;

            return (
              <button
                key={stage}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveStage(stage)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition",
                  isActive
                    ? "bg-white/[0.09] text-zinc-50"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100",
                )}
              >
                {STAGE_LABELS[stage]}
                <StageCountPill
                  stage={stage}
                  count={columns[stage].length}
                  total={totals[stage]}
                  isFiltered={isFiltered}
                />
              </button>
            );
          })}
        </div>

        <p className="px-1 text-[11px] text-zinc-500">
          {getStageSubtitle(activeStage, kdsEnabled)}
        </p>

        {columns[activeStage].length === 0 ? (
          <StageEmptyState stage={activeStage} isFiltered={isFiltered} />
        ) : (
          <div className="grid grid-cols-2 items-start gap-3">
            {renderCards(activeStage)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {BOARD_STAGES.map((stage) => (
        <section key={stage} aria-label={STAGE_LABELS[stage]}>
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <h2 className="text-[13px] font-black uppercase tracking-[0.14em] text-zinc-50">
                {STAGE_LABELS[stage]}
              </h2>
              <p className="truncate text-[11px] text-zinc-500">
                {getStageSubtitle(stage, kdsEnabled)}
              </p>
            </div>

            <StageCountPill
              stage={stage}
              count={columns[stage].length}
              total={totals[stage]}
              isFiltered={isFiltered}
            />
          </div>

          {columns[stage].length === 0 ? (
            <StageEmptyState stage={stage} isFiltered={isFiltered} compact />
          ) : (
            <div className="space-y-2.5">{renderCards(stage)}</div>
          )}
        </section>
      ))}
    </div>
  );
}
