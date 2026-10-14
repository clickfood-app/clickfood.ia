"use client";

import { Check, Minus, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  formatCurrency,
  getProductImage,
  getProductInitials,
  PLACEHOLDER_IMAGE,
  type ManualModifierGroup,
  type ManualModifierOption,
  type ProductWithModifiers,
} from "./shared";

interface ProductCustomizationDialogProps {
  product: ProductWithModifiers;
  editing: boolean;
  quantity: number;
  observation: string;
  selectedOptions: Record<string, string[]>;
  unitPrice: number;
  totalPrice: number;
  canConfirm: boolean;
  onClose: () => void;
  onQuantityChange: (quantity: number) => void;
  onObservationChange: (value: string) => void;
  onToggleOption: (group: ManualModifierGroup, option: ManualModifierOption) => void;
  onConfirm: () => void;
}

export default function ProductCustomizationDialog({
  product,
  editing,
  quantity,
  observation,
  selectedOptions,
  unitPrice,
  totalPrice,
  canConfirm,
  onClose,
  onQuantityChange,
  onObservationChange,
  onToggleOption,
  onConfirm,
}: ProductCustomizationDialogProps) {
  const groups = (product.modifierGroups || product.modifier_groups || []) as ManualModifierGroup[];
  const image = getProductImage(product);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Editar item" : "Personalizar item"}
        className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/[0.08] bg-[#090909] shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="h-20 w-24 shrink-0 overflow-hidden rounded-2xl bg-[#131313]">
              {image === PLACEHOLDER_IMAGE ? (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1c1c1c] to-[#0c0c0c] text-lg font-black text-zinc-600">
                  {getProductInitials(product.name)}
                </div>
              ) : (
                <img
                  src={image}
                  alt={product.name}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.src = PLACEHOLDER_IMAGE;
                  }}
                />
              )}
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                {editing ? "Editar item" : "Personalizar item"}
              </p>
              <h3 className="mt-1 line-clamp-2 text-xl font-bold leading-6 text-white">{product.name}</h3>
              <p className="mt-1 text-sm font-semibold tabular-nums text-yellow-400">
                {formatCurrency(unitPrice)}
                <span className="ml-1.5 text-xs font-medium text-zinc-500">por unidade</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar personalização"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#111] text-zinc-400 transition hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          {groups.map((group) => {
            const selectedIds = selectedOptions[group.id] || [];
            const isSatisfied = selectedIds.length >= group.minSelect && selectedIds.length <= group.maxSelect;
            const rule = group.required
              ? `Escolha de ${group.minSelect} até ${group.maxSelect}`
              : `Opcional · até ${group.maxSelect}`;

            return (
              <section key={group.id} className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white">{group.name}</h4>
                    <p className="mt-0.5 text-xs text-zinc-500">{rule}</p>
                  </div>

                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
                      isSatisfied ? "bg-emerald-500/10 text-emerald-400" : "bg-yellow-400/10 text-yellow-300",
                    )}
                  >
                    {isSatisfied && <Check className="h-3 w-3" />}
                    {group.required ? "Obrigatório" : "Opcional"}
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {group.options.map((option) => {
                    const active = selectedIds.includes(option.id);

                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onToggleOption(group, option)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                          active
                            ? "border-yellow-400/60 bg-yellow-400/[0.07]"
                            : "border-white/[0.08] bg-[#0d0d0d] hover:border-white/15",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center border transition",
                            group.maxSelect <= 1 ? "rounded-full" : "rounded-md",
                            active ? "border-yellow-400 bg-yellow-400 text-black" : "border-white/20 bg-transparent",
                          )}
                        >
                          {active && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-200">{option.name}</span>
                        <span className="shrink-0 text-xs font-bold tabular-nums text-zinc-400">
                          {Number(option.price || 0) > 0 ? `+ ${formatCurrency(option.price)}` : "Grátis"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <section className={cn(groups.length > 0 && "border-t border-white/[0.07] pt-6")}>
            <label className="block">
              <span className="text-sm font-bold text-white">Observação do item</span>
              <span className="mt-0.5 block text-xs text-zinc-500">Use para alterações específicas deste produto.</span>
              <textarea
                value={observation}
                onChange={(event) => onObservationChange(event.target.value)}
                rows={2}
                placeholder="Ex.: sem cebola, molho à parte..."
                className="mt-3 w-full resize-none rounded-xl border border-white/[0.08] bg-[#0d0d0d] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-yellow-400/60 focus:ring-4 focus:ring-yellow-400/10"
              />
            </label>
          </section>
        </div>

        <div className="flex items-center gap-3 border-t border-white/[0.07] bg-[#0b0b0b] p-4 sm:p-5">
          <div className="flex h-12 shrink-0 items-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d0d0d]">
            <button
              type="button"
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              aria-label="Diminuir quantidade"
              className="flex h-12 w-11 items-center justify-center text-zinc-400 transition hover:bg-white/[0.05] hover:text-white"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-base font-black tabular-nums text-white">{quantity}</span>
            <button
              type="button"
              onClick={() => onQuantityChange(quantity + 1)}
              aria-label="Aumentar quantidade"
              className="flex h-12 w-11 items-center justify-center text-zinc-400 transition hover:bg-white/[0.05] hover:text-white"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={cn(
              "flex h-12 min-w-0 flex-1 items-center justify-between rounded-xl px-5 text-sm font-bold transition",
              canConfirm
                ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/15 hover:bg-yellow-300 active:scale-[0.99]"
                : "cursor-not-allowed bg-[#151515] text-zinc-600",
            )}
          >
            <span className="truncate">{editing ? "Salvar alterações" : "Adicionar ao pedido"}</span>
            <span className="shrink-0 tabular-nums">{formatCurrency(totalPrice)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
