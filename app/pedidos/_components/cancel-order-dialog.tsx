"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { TriangleAlert } from "lucide-react";

import type { OrderCardView } from "../_lib/order-display";
import { OrderNumber } from "./order-card-sections";

type CancelOrderDialogProps = {
  open: boolean;
  // null quando o pedido saiu da central (finalizado/cancelado em outro lugar).
  view: OrderCardView | null;
  isBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function CancelOrderDialog({
  open,
  view,
  isBusy,
  onOpenChange,
  onConfirm,
}: CancelOrderDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/75 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />

        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#141416] p-5 shadow-2xl shadow-black ring-1 ring-white/10 focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/30">
              <TriangleAlert className="h-5 w-5" aria-hidden />
            </span>

            <div className="min-w-0">
              <AlertDialog.Title className="text-base font-black text-zinc-50">
                {view ? (
                  <>
                    Cancelar o pedido{" "}
                    <OrderNumber number={view.number} className="text-base" />?
                  </>
                ) : (
                  "Pedido não está mais em aberto"
                )}
              </AlertDialog.Title>

              <AlertDialog.Description className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                {view ? (
                  <>
                    <span className="font-bold text-zinc-200">
                      {view.customerName}
                    </span>{" "}
                    · {view.totalLabel}. O pedido será marcado como cancelado.
                    Essa ação não pode ser desfeita por esta tela.
                  </>
                ) : (
                  "Ele foi finalizado ou cancelado em outro lugar. Nada foi alterado."
                )}
              </AlertDialog.Description>
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-bold text-zinc-200 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-zinc-50">
              Voltar
            </AlertDialog.Cancel>

            {view && (
              <AlertDialog.Action
                onClick={onConfirm}
                disabled={isBusy}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-red-500 px-4 text-sm font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar pedido
              </AlertDialog.Action>
            )}
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
