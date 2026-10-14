"use client";

import { AlertTriangle, ChevronDown, MapPin, NotebookPen, UserRound, UserRoundPlus } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import { cn } from "@/lib/utils";
import type { CustomerData, DeliveryAddress, OrderType } from "@/lib/order-types";
import { formatCurrency, type DeliveryNeighborhoodOption } from "./shared";

export const pdvFieldClass =
  "h-11 w-full rounded-xl border border-white/[0.08] bg-[#0b0b0b] px-3.5 text-sm text-white outline-none transition placeholder:text-zinc-600 hover:border-white/15 focus:border-yellow-400/60 focus:ring-4 focus:ring-yellow-400/10 disabled:cursor-not-allowed disabled:opacity-50";

export function PdvSection({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="space-y-3.5 rounded-2xl border border-white/[0.07] bg-[#0c0c0c] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-zinc-400">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">{title}</h3>
            {description && <p className="mt-0.5 text-xs leading-4 text-zinc-500">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PdvField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

interface CustomerDeliveryFieldsProps {
  orderType: OrderType;
  customer: CustomerData;
  onCustomerChange: Dispatch<SetStateAction<CustomerData>>;
  showCustomerFields: boolean;
  onToggleCustomerFields: () => void;
  address: DeliveryAddress;
  onAddressChange: Dispatch<SetStateAction<DeliveryAddress>>;
  neighborhoodOptions: DeliveryNeighborhoodOption[];
  selectedNeighborhoodId: string;
  onSelectNeighborhood: (optionId: string) => void;
  selectedNeighborhood: DeliveryNeighborhoodOption | undefined;
}

/**
 * Dados do cliente, endereço de entrega e observações. Mostra só o que a modalidade usa:
 * no balcão o cliente é opcional e fica recolhido; na entrega o endereço é obrigatório.
 */
export default function CustomerDeliveryFields({
  orderType,
  customer,
  onCustomerChange,
  showCustomerFields,
  onToggleCustomerFields,
  address,
  onAddressChange,
  neighborhoodOptions,
  selectedNeighborhoodId,
  onSelectNeighborhood,
  selectedNeighborhood,
}: CustomerDeliveryFieldsProps) {
  const isDelivery = orderType === "delivery";
  const hasCustomerData = Boolean(customer.name || customer.phone);
  const customerOpen = isDelivery || showCustomerFields;

  return (
    <div className="space-y-3">
      <PdvSection
        icon={UserRound}
        title="Cliente"
        description={isDelivery ? "Nome e telefone para contato do entregador." : "Opcional no balcão."}
        action={
          !isDelivery && (
            <button
              type="button"
              onClick={onToggleCustomerFields}
              aria-expanded={showCustomerFields}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-semibold transition",
                showCustomerFields || hasCustomerData
                  ? "border-yellow-400/40 bg-yellow-400/[0.08] text-yellow-300"
                  : "border-white/[0.08] bg-[#0b0b0b] text-zinc-400 hover:border-white/20 hover:text-white",
              )}
            >
              {hasCustomerData ? <UserRound className="h-3.5 w-3.5" /> : <UserRoundPlus className="h-3.5 w-3.5" />}
              {customer.name || "Adicionar cliente"}
              <ChevronDown className={cn("h-3.5 w-3.5 transition", showCustomerFields && "rotate-180")} />
            </button>
          )
        }
      >
        {customerOpen && (
          <div className="grid grid-cols-2 gap-3">
            <PdvField label="Nome" className="col-span-2 sm:col-span-1">
              <input
                type="text"
                value={customer.name}
                onChange={(event) => onCustomerChange({ ...customer, name: event.target.value })}
                placeholder={isDelivery ? "Nome do cliente" : "Opcional"}
                className={pdvFieldClass}
              />
            </PdvField>
            <PdvField label="Telefone" className="col-span-2 sm:col-span-1">
              <input
                type="tel"
                inputMode="tel"
                value={customer.phone}
                onChange={(event) => onCustomerChange({ ...customer, phone: event.target.value })}
                placeholder="Opcional"
                className={pdvFieldClass}
              />
            </PdvField>
          </div>
        )}
      </PdvSection>

      {isDelivery && (
        <PdvSection
          icon={MapPin}
          title="Endereço de entrega"
          description="O bairro escolhido define a taxa automaticamente."
        >
          <div className="grid grid-cols-2 gap-3">
            <PdvField label="Rua" className="col-span-2">
              <input
                type="text"
                value={address.street}
                onChange={(event) => onAddressChange({ ...address, street: event.target.value })}
                placeholder="Nome da rua"
                className={pdvFieldClass}
              />
            </PdvField>

            <PdvField label="Número">
              <input
                type="text"
                value={address.number}
                onChange={(event) => onAddressChange({ ...address, number: event.target.value })}
                placeholder="Nº"
                className={pdvFieldClass}
              />
            </PdvField>

            <PdvField label="Complemento">
              <input
                type="text"
                value={address.complement || ""}
                onChange={(event) => onAddressChange({ ...address, complement: event.target.value })}
                placeholder="Opcional"
                className={pdvFieldClass}
              />
            </PdvField>

            <PdvField label="Bairro" className="col-span-2">
              <select
                value={selectedNeighborhoodId}
                onChange={(event) => onSelectNeighborhood(event.target.value)}
                disabled={neighborhoodOptions.length === 0}
                className={cn(pdvFieldClass, "appearance-none pr-9")}
              >
                <option value="">Selecione o bairro</option>
                {neighborhoodOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.neighborhood} — {formatCurrency(option.fee)}
                  </option>
                ))}
              </select>
            </PdvField>

            <PdvField label="Cidade" className="col-span-2">
              <input
                type="text"
                value={address.city}
                onChange={(event) => onAddressChange({ ...address, city: event.target.value })}
                placeholder="Cidade"
                className={pdvFieldClass}
              />
            </PdvField>
          </div>

          {neighborhoodOptions.length === 0 ? (
            <p className="flex items-start gap-2 rounded-xl border border-yellow-400/20 bg-yellow-400/[0.05] px-3 py-2.5 text-xs text-yellow-200">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              Nenhuma área de entrega ativa foi encontrada.
            </p>
          ) : selectedNeighborhood ? (
            <div className="flex items-center justify-between rounded-xl bg-emerald-500/[0.08] px-3.5 py-2.5 text-xs">
              <span className="font-semibold text-emerald-300">Taxa para {selectedNeighborhood.neighborhood}</span>
              <span className="text-sm font-black tabular-nums text-emerald-400">
                {formatCurrency(selectedNeighborhood.fee)}
              </span>
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-xl bg-yellow-400/[0.06] px-3.5 py-2.5 text-xs font-semibold text-yellow-200">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Selecione o bairro para aplicar a taxa de entrega.
            </p>
          )}
        </PdvSection>
      )}

      <PdvSection
        icon={NotebookPen}
        title="Observações e instruções"
        description={
          isDelivery
            ? "Instruções para o entregador e detalhes do pedido."
            : "Detalhes do pedido, como embalagem ou chamada no balcão."
        }
      >
        <textarea
          value={customer.observation || ""}
          onChange={(event) => onCustomerChange({ ...customer, observation: event.target.value })}
          rows={2}
          placeholder={
            isDelivery
              ? "Ex.: portão azul, interfone 12, deixar na portaria..."
              : "Ex.: embalar para viagem, chamar o cliente no balcão..."
          }
          className={cn(pdvFieldClass, "h-auto resize-none py-2.5 leading-5")}
        />
      </PdvSection>
    </div>
  );
}
