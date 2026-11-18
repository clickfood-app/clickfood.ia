"use client";

import type { ReactNode } from "react";
import { CircleCheck, ChefHat, Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

import { STAGE_LABELS, type BoardStage } from "../_lib/order-display";

const STAGE_DOT_CLASSES: Record<BoardStage, string> = {
  analysis: "bg-yellow-400",
  preparation: "bg-zinc-200",
  ready: "bg-emerald-400",
};

const STAGE_EMPTY_ICONS: Record<BoardStage, typeof Inbox> = {
  analysis: Inbox,
  preparation: ChefHat,
  ready: CircleCheck,
};

export function getStageSubtitle(stage: BoardStage, kdsEnabled: boolean) {
  if (stage === "analysis") return "Conferir e aceitar";
  if (stage === "preparation") {
    return kdsEnabled ? "Cozinha controla pelo KDS" : "Produção na cozinha";
  }

  return "Retirar ou entregar";
}

export function StageCountPill({
  stage,
  count,
  total,
  isFiltered,
}: {
  stage: BoardStage;
  count: number;
  total: number;
  isFiltered: boolean;
}) {
  const highlight = stage === "analysis" && count > 0;

  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-black tabular-nums",
        highlight ? "bg-yellow-400 text-black" : "bg-white/[0.07] text-zinc-200",
      )}
      title={
        isFiltered && count !== total
          ? `${count} de ${total} pedidos nesta etapa`
          : undefined
      }
    >
      {isFiltered && count !== total ? `${count}/${total}` : count}
    </span>
  );
}

export function StageEmptyState({
  stage,
  isFiltered,
  compact = false,
}: {
  stage: BoardStage;
  isFiltered: boolean;
  compact?: boolean;
}) {
  const Icon = STAGE_EMPTY_ICONS[stage];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] text-center",
        compact ? "px-4 py-5" : "px-6 py-10",
      )}
    >
      <Icon className="h-5 w-5 text-zinc-600" aria-hidden />

      <p className="mt-2 text-xs font-bold text-zinc-400">
        {isFiltered ? "Nenhum pedido com esse filtro" : "Nenhum pedido aqui"}
      </p>

      {!compact && !isFiltered && (
        <p className="mt-0.5 max-w-[220px] text-[11px] leading-relaxed text-zinc-600">
          Os pedidos desta etapa aparecem automaticamente.
        </p>
      )}
    </div>
  );
}

type OrderBoardColumnProps = {
  stage: BoardStage;
  count: number;
  total: number;
  isFiltered: boolean;
  kdsEnabled: boolean;
  children: ReactNode;
};

export function OrderBoardColumn({
  stage,
  count,
  total,
  isFiltered,
  kdsEnabled,
  children,
}: OrderBoardColumnProps) {
  return (
    <section
      aria-label={STAGE_LABELS[stage]}
      className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-[#0D0D0F] ring-1 ring-inset ring-white/[0.06]"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className={cn("h-2 w-2 shrink-0 rounded-full", STAGE_DOT_CLASSES[stage])}
          />

          <div className="min-w-0">
            <h2 className="text-[13px] font-black uppercase tracking-[0.14em] text-zinc-50">
              {STAGE_LABELS[stage]}
            </h2>

            <p className="truncate text-[11px] text-zinc-500">
              {getStageSubtitle(stage, kdsEnabled)}
            </p>
          </div>
        </div>

        <StageCountPill
          stage={stage}
          count={count}
          total={total}
          isFiltered={isFiltered}
        />
      </header>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain p-2.5 [scrollbar-width:thin]">
        {count === 0 ? (
          <StageEmptyState stage={stage} isFiltered={isFiltered} />
        ) : (
          children
        )}
      </div>
    </section>
  );
}
