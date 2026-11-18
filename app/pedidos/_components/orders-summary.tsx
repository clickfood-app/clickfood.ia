"use client";

import { cn } from "@/lib/utils";

type SummaryTone = "neutral" | "yellow" | "orange";

function SummaryChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: SummaryTone;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-2 py-1 ring-1 ring-inset",
        tone === "orange"
          ? "bg-orange-500/10 ring-orange-500/30"
          : "bg-white/[0.035] ring-white/[0.06]",
      )}
    >
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-[0.12em]",
          tone === "orange" ? "text-orange-300" : "text-zinc-400",
        )}
      >
        {label}
      </span>

      <span
        className={cn(
          "rounded px-1 text-sm font-black tabular-nums",
          tone === "yellow"
            ? "bg-yellow-400 text-black"
            : tone === "orange"
              ? "text-orange-200"
              : "text-zinc-50",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export type OrdersSummaryCounts = {
  analysis: number;
  preparation: number;
  ready: number;
  pixReview: number;
};

export function OrdersSummary({
  counts,
  className,
}: {
  counts: OrdersSummaryCounts;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      aria-label="Resumo da operação"
    >
      <SummaryChip
        label="Novos"
        value={counts.analysis}
        tone={counts.analysis > 0 ? "yellow" : "neutral"}
      />
      <SummaryChip label="Em preparo" value={counts.preparation} />
      <SummaryChip label="Prontos" value={counts.ready} />
      <SummaryChip
        label="Pix a conferir"
        value={counts.pixReview}
        tone={counts.pixReview > 0 ? "orange" : "neutral"}
      />
    </div>
  );
}
