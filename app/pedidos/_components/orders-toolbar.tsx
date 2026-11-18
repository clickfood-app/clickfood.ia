"use client";

import * as Popover from "@radix-ui/react-popover";
import {
  BellRing,
  ChefHat,
  ChevronDown,
  History,
  Loader2,
  Package,
  Printer,
  RefreshCcw,
  Search,
  Settings2,
  Volume2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { OrderTypeFilter } from "../_lib/order-display";
import { OrdersSummary, type OrdersSummaryCounts } from "./orders-summary";

type ViewMode = "operation" | "history";

const TYPE_FILTERS: Array<{ value: OrderTypeFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "Entrega", label: "Entrega" },
  { value: "Retirada", label: "Retirada" },
  { value: "Mesa", label: "Mesa" },
];

const PREP_TIME_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 60];

const toolbarButtonClassName =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold text-zinc-200 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 data-[state=open]:bg-white/[0.08] data-[state=open]:text-zinc-50";

const popoverContentClassName =
  "z-50 rounded-xl bg-[#1C1C20] p-3 shadow-2xl shadow-black/60 ring-1 ring-white/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95";

const popoverButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold text-zinc-200 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-40";

export type BatchPrintControls = {
  visibleCount: number;
  selectedCount: number;
  onSelectAll: () => void;
  onPrintKitchen: () => void;
  onPrintReceipts: () => void;
  onClear: () => void;
};

export type OperationSettingsControls = {
  averagePrepTimeMinutes: number;
  savingPrepTime: boolean;
  onChangePrepTime: (minutes: number) => void;
  kdsEnabled: boolean;
  onToggleKds: () => void;
  autoAcceptOrders: boolean;
  savingAutoAcceptOrders: boolean;
  onToggleAutoAccept: () => void;
};

export type NewOrderAlertView = {
  orderNumber: string;
  customerName: string;
  totalLabel: string;
};

type OrdersToolbarProps = {
  activeView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  updatedLabel: string;
  isDataFresh: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: OrderTypeFilter;
  onTypeFilterChange: (value: OrderTypeFilter) => void;
  typeCounts: Record<OrderTypeFilter, number>;
  summary: OrdersSummaryCounts;
  alertsEnabled: boolean;
  notificationDenied: boolean;
  onToggleAlerts: () => void;
  batchPrint: BatchPrintControls;
  settings: OperationSettingsControls;
  newOrderAlert: NewOrderAlertView | null;
  onDismissNewOrderAlert: () => void;
  error: string | null;
};

function ToggleStatus({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em]",
        active
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-white/[0.06] text-zinc-400",
      )}
    >
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

export function OrdersToolbar({
  activeView,
  onChangeView,
  updatedLabel,
  isDataFresh,
  isRefreshing,
  onRefresh,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  typeCounts,
  summary,
  alertsEnabled,
  notificationDenied,
  onToggleAlerts,
  batchPrint,
  settings,
  newOrderAlert,
  onDismissNewOrderAlert,
  error,
}: OrdersToolbarProps) {
  const isOperation = activeView === "operation";

  return (
    <section className="shrink-0 rounded-xl bg-[#0D0D0F] ring-1 ring-inset ring-white/[0.06]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-yellow-400" />

          <h1 className="whitespace-nowrap text-sm font-black uppercase tracking-[0.18em] text-zinc-50">
            Central de pedidos
          </h1>

          {isOperation && (
            <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-zinc-500">
              {isRefreshing ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isDataFresh ? "bg-emerald-400" : "bg-zinc-600",
                  )}
                />
              )}
              {updatedLabel}
            </span>
          )}
        </div>

        {isOperation && newOrderAlert && (
          <div
            role="status"
            title={`Novo pedido ${newOrderAlert.orderNumber} · ${newOrderAlert.customerName} · ${newOrderAlert.totalLabel}`}
            className="flex min-w-[160px] max-w-xl flex-1 items-center gap-2 rounded-lg bg-yellow-400/10 py-1 pl-2.5 pr-1 ring-1 ring-inset ring-yellow-400/30 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1"
          >
            <BellRing className="h-3.5 w-3.5 shrink-0 text-yellow-300" aria-hidden />

            <span className="min-w-0 flex-1 truncate text-xs font-bold text-yellow-100">
              Novo pedido {newOrderAlert.orderNumber} ·{" "}
              {newOrderAlert.customerName} · {newOrderAlert.totalLabel}
            </span>

            <button
              type="button"
              onClick={onDismissNewOrderAlert}
              className="shrink-0 rounded-md p-1 text-yellow-200/80 transition hover:bg-yellow-400/10 hover:text-yellow-100"
              aria-label="Fechar alerta de novo pedido"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex shrink-0 rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-inset ring-white/[0.08]">
            <button
              type="button"
              onClick={() => onChangeView("operation")}
              className={cn(
                "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-bold transition",
                isOperation
                  ? "bg-white/[0.1] text-zinc-50"
                  : "text-zinc-400 hover:text-zinc-100",
              )}
            >
              <Package className="h-3.5 w-3.5" aria-hidden />
              Operação
            </button>

            <button
              type="button"
              onClick={() => onChangeView("history")}
              className={cn(
                "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-bold transition",
                !isOperation
                  ? "bg-white/[0.1] text-zinc-50"
                  : "text-zinc-400 hover:text-zinc-100",
              )}
            >
              <History className="h-3.5 w-3.5" aria-hidden />
              Histórico
            </button>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className={toolbarButtonClassName}
            title="Atualizar"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCcw className="h-4 w-4" aria-hidden />
            )}
            <span className="hidden 2xl:inline">Atualizar</span>
          </button>

          {isOperation && (
            <button
              type="button"
              onClick={onToggleAlerts}
              className={cn(
                toolbarButtonClassName,
                alertsEnabled &&
                  "bg-yellow-400/10 text-yellow-200 ring-yellow-400/30 hover:bg-yellow-400/15 hover:text-yellow-100",
              )}
              title={
                notificationDenied
                  ? "O navegador bloqueou notificações de desktop, mas o som do painel pode funcionar."
                  : alertsEnabled
                    ? "Alertas ativos"
                    : "Alertas"
              }
              aria-label={alertsEnabled ? "Alertas ativos" : "Alertas"}
            >
              {alertsEnabled ? (
                <Volume2 className="h-4 w-4" aria-hidden />
              ) : (
                <BellRing className="h-4 w-4" aria-hidden />
              )}
              <span className="hidden 2xl:inline">
                {alertsEnabled ? "Alertas ativos" : "Alertas"}
              </span>
            </button>
          )}

          {isOperation && (
            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={toolbarButtonClassName}
                  disabled={batchPrint.visibleCount === 0}
                  title="Impressão em lote"
                >
                  <Printer className="h-4 w-4" aria-hidden />
                  <span className="hidden 2xl:inline">Imprimir</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                </button>
              </Popover.Trigger>

              <Popover.Portal>
                <Popover.Content
                  align="end"
                  sideOffset={8}
                  className={cn(popoverContentClassName, "w-[300px]")}
                >
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-200">
                    Impressão em lote
                  </p>

                  <p className="mt-0.5 text-xs text-zinc-500">
                    {batchPrint.selectedCount > 0
                      ? `${batchPrint.selectedCount} selecionado(s)`
                      : `${batchPrint.visibleCount} pedido(s) visível(is)`}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={batchPrint.onSelectAll}
                      className={popoverButtonClassName}
                    >
                      Selecionar todos
                    </button>

                    <button
                      type="button"
                      onClick={batchPrint.onClear}
                      disabled={batchPrint.selectedCount === 0}
                      className={popoverButtonClassName}
                    >
                      Limpar
                    </button>

                    <button
                      type="button"
                      onClick={batchPrint.onPrintKitchen}
                      disabled={batchPrint.selectedCount === 0}
                      className={popoverButtonClassName}
                    >
                      <ChefHat className="h-4 w-4" aria-hidden />
                      Cozinha ({batchPrint.selectedCount})
                    </button>

                    <button
                      type="button"
                      onClick={batchPrint.onPrintReceipts}
                      disabled={batchPrint.selectedCount === 0}
                      className={popoverButtonClassName}
                    >
                      <Printer className="h-4 w-4" aria-hidden />
                      Recibos ({batchPrint.selectedCount})
                    </button>
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          )}

          {isOperation && (
            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={toolbarButtonClassName}
                  title="Ajustes da operação"
                >
                  <Settings2 className="h-4 w-4" aria-hidden />
                  <span className="hidden 2xl:inline">Ajustes</span>
                </button>
              </Popover.Trigger>

              <Popover.Portal>
                <Popover.Content
                  align="end"
                  sideOffset={8}
                  className={cn(
                    popoverContentClassName,
                    "w-[min(340px,calc(100vw-2rem))]",
                  )}
                >
                  <label
                    htmlFor="average-prep-time"
                    className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-300"
                  >
                    Tempo médio de preparo
                  </label>

                  <div className="mt-1.5 flex items-center gap-2">
                    <select
                      id="average-prep-time"
                      value={settings.averagePrepTimeMinutes}
                      onChange={(event) =>
                        settings.onChangePrepTime(Number(event.target.value))
                      }
                      disabled={settings.savingPrepTime}
                      className="h-9 flex-1 rounded-lg border border-white/10 bg-[#111113] px-3 text-sm font-bold text-zinc-100 outline-none focus:border-yellow-400/60 focus:ring-2 focus:ring-yellow-400/20"
                    >
                      {PREP_TIME_OPTIONS.map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes} min
                        </option>
                      ))}
                    </select>

                    {settings.savingPrepTime && (
                      <Loader2
                        className="h-4 w-4 animate-spin text-zinc-300"
                        aria-hidden
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={settings.onToggleKds}
                    className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.04]"
                  >
                    <div>
                      <p className="text-sm font-bold text-zinc-50">KDS</p>
                      <p className="text-xs text-zinc-400">
                        {settings.kdsEnabled
                          ? "A cozinha controla quando fica pronto."
                          : "A tela de pedidos controla o preparo."}
                      </p>
                    </div>

                    <ToggleStatus active={settings.kdsEnabled} />
                  </button>

                  <button
                    type="button"
                    onClick={settings.onToggleAutoAccept}
                    disabled={settings.savingAutoAcceptOrders}
                    className="mt-2 flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div>
                      <p className="text-sm font-bold text-zinc-50">
                        Aceite automático
                      </p>
                      <p className="text-xs text-zinc-400">
                        Pix manual continua exigindo aceite do atendente.
                      </p>
                    </div>

                    {settings.savingAutoAcceptOrders ? (
                      <Loader2
                        className="h-4 w-4 animate-spin text-zinc-300"
                        aria-hidden
                      />
                    ) : (
                      <ToggleStatus active={settings.autoAcceptOrders} />
                    )}
                  </button>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          )}
        </div>
      </div>

      {isOperation && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/[0.06] px-4 py-2.5">
          <div className="relative w-full sm:w-64 2xl:w-80">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden
            />

            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar pedido, cliente ou telefone"
              aria-label="Buscar pedido, cliente ou telefone"
              className="h-9 w-full rounded-lg border border-white/10 bg-[#161619] pl-9 pr-3 text-sm font-semibold text-zinc-100 outline-none transition placeholder:font-normal placeholder:text-zinc-500 focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/15"
            />
          </div>

          <div
            className="scrollbar-none flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-white/[0.03] p-0.5 ring-1 ring-inset ring-white/[0.06]"
            role="group"
            aria-label="Filtrar por tipo"
          >
            {TYPE_FILTERS.map((filter) => {
              const isActive = typeFilter === filter.value;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => onTypeFilterChange(filter.value)}
                  aria-pressed={isActive}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-black uppercase tracking-[0.1em] transition",
                    isActive
                      ? "bg-yellow-400 text-black"
                      : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100",
                  )}
                >
                  {filter.label}
                  <span
                    className={cn(
                      "tabular-nums",
                      isActive ? "text-black/60" : "text-zinc-600",
                    )}
                  >
                    {typeCounts[filter.value]}
                  </span>
                </button>
              );
            })}
          </div>

          <OrdersSummary counts={summary} className="xl:ml-auto" />
        </div>
      )}

      {error && (
        <div className="border-t border-white/[0.06] px-4 py-2.5">
          <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200 ring-1 ring-inset ring-red-500/30">
            {error}
          </div>
        </div>
      )}
    </section>
  );
}
