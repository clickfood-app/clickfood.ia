"use client";

import { AlertTriangle, ChevronDown, MapPin, Store, UserRound, UserRoundPlus } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import { cn } from "@/lib/utils";
import type { CustomerData, DeliveryAddress, OrderType } from "@/lib/order-types";
import { formatCurrency, type DeliveryNeighborhoodOption } from "./shared";

const fieldClass =
  "h-9 w-full rounded-lg border border-white/[0.08] bg-[#0b0b0b] px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 hover:border-white/15 focus:border-yellow-400/60 focus:ring-4 focus:ring-yellow-400/10 disabled:cursor-not-allowed disabled:opacity-50";

function Field({
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
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function GroupTitle({ children }: { children: ReactNode }) {
  return (
    <div className="col-span-12 flex items-center gap-3 pt-1 first:pt-0">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-400/80">{children}</span>
      <span className="h-px flex-1 bg-white/[0.06]" />
    </div>
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
 * Dados do atendimento (cliente, endereço, taxa e observações), exibidos na coluna do catálogo.
 * Entrega mostra tudo em uma grade compacta; balcão mostra o cliente recolhido e as observações.
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
  const HeaderIcon = isDelivery ? MapPin : Store;

  return (
    <section
      aria-label={isDelivery ? "Dados da entrega" : "Dados do atendimento"}
      className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#101010] to-[#0b0b0b] p-3.5 shadow-lg shadow-black/30"
    >
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400">
            <HeaderIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-white">
              {isDelivery ? "Dados da entrega" : "Dados do atendimento"}
            </h2>
            <p className="truncate text-xs text-zinc-500">
              {isDelivery
                ? "Cliente, endereço e taxa. O bairro define a taxa automaticamente."
                : "Identificação do cliente é opcional no balcão."}
            </p>
          </div>
        </div>

        {isDelivery ? (
          selectedNeighborhood && (
            <div className="flex shrink-0 items-center gap-2 rounded-lg bg-emerald-500/[0.09] px-3 py-1.5">
              <span className="text-[11px] font-semibold text-emerald-300">Taxa</span>
              <span className="text-sm font-black tabular-nums text-emerald-400">
                {formatCurrency(selectedNeighborhood.fee)}
              </span>
            </div>
          )
        ) : (
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
            <span className="max-w-[10rem] truncate">{customer.name || "Adicionar cliente"}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition", showCustomerFields && "rotate-180")} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-x-3 gap-y-2.5">
        {customerOpen && (
          <>
            {isDelivery && <GroupTitle>Cliente</GroupTitle>}
            <Field label="Nome" className="col-span-12 sm:col-span-7">
              <input
                type="text"
                value={customer.name}
                onChange={(event) => onCustomerChange({ ...customer, name: event.target.value })}
                placeholder={isDelivery ? "Nome do cliente" : "Opcional"}
                className={fieldClass}
              />
            </Field>
            <Field label="Telefone" className="col-span-12 sm:col-span-5">
              <input
                type="tel"
                inputMode="tel"
                value={customer.phone}
                onChange={(event) => onCustomerChange({ ...customer, phone: event.target.value })}
                placeholder="Opcional"
                className={fieldClass}
              />
            </Field>
          </>
        )}

        {isDelivery && (
          <>
            <GroupTitle>Endereço</GroupTitle>
            <Field label="Rua" className="col-span-12 sm:col-span-6">
              <input
                type="text"
                value={address.street}
                onChange={(event) => onAddressChange({ ...address, street: event.target.value })}
                placeholder="Nome da rua"
                className={fieldClass}
              />
            </Field>
            <Field label="Número" className="col-span-5 sm:col-span-2">
              <input
                type="text"
                value={address.number}
                onChange={(event) => onAddressChange({ ...address, number: event.target.value })}
                placeholder="Nº"
                className={fieldClass}
              />
            </Field>
            <Field label="Complemento" className="col-span-7 sm:col-span-4">
              <input
                type="text"
                value={address.complement || ""}
                onChange={(event) => onAddressChange({ ...address, complement: event.target.value })}
                placeholder="Opcional"
                className={fieldClass}
              />
            </Field>
            <Field label="Bairro e taxa" className="col-span-12 sm:col-span-7">
              <span className="relative block">
                <select
                  value={selectedNeighborhoodId}
                  onChange={(event) => onSelectNeighborhood(event.target.value)}
                  disabled={neighborhoodOptions.length === 0}
                  className={cn(fieldClass, "appearance-none pr-9")}
                >
                  <option value="">Selecione o bairro</option>
                  {neighborhoodOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.neighborhood} — {formatCurrency(option.fee)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              </span>
            </Field>
            <Field label="Cidade" className="col-span-12 sm:col-span-5">
              <input
                type="text"
                value={address.city}
                onChange={(event) => onAddressChange({ ...address, city: event.target.value })}
                placeholder="Cidade"
                className={fieldClass}
              />
            </Field>

            {neighborhoodOptions.length === 0 ? (
              <p className="col-span-12 flex items-start gap-2 rounded-lg border border-yellow-400/20 bg-yellow-400/[0.05] px-3 py-2 text-xs text-yellow-200">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                Nenhuma área de entrega ativa foi encontrada.
              </p>
            ) : (
              !selectedNeighborhood && (
                <p className="col-span-12 flex items-center gap-2 rounded-lg bg-yellow-400/[0.06] px-3 py-2 text-xs font-semibold text-yellow-200">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Selecione o bairro para aplicar a taxa de entrega.
                </p>
              )
            )}
          </>
        )}

        {isDelivery && <GroupTitle>Observações</GroupTitle>}
        <Field label={isDelivery ? "Instruções para o entregador" : "Observações do pedido"} className="col-span-12">
          <textarea
            value={customer.observation || ""}
            onChange={(event) => onCustomerChange({ ...customer, observation: event.target.value })}
            rows={1}
            placeholder={
              isDelivery
                ? "Ex.: portão azul, interfone 12, deixar na portaria..."
                : "Ex.: embalar para viagem, chamar o cliente no balcão..."
            }
            className={cn(fieldClass, "h-auto min-h-9 resize-none py-1.5 leading-5")}
          />
        </Field>
      </div>
    </section>
  );
}
