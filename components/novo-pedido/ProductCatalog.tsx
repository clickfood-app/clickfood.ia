"use client";

import { useMemo, useState } from "react";
import { Plus, Search, SearchX, Store, Truck, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { OrderItem, OrderType } from "@/lib/order-types";
import {
  formatCurrency,
  getProductGroups,
  getProductImage,
  getProductInitials,
  PLACEHOLDER_IMAGE,
  type ProductWithModifiers,
} from "./shared";

interface ProductCatalogProps {
  orderType: OrderType;
  onOrderTypeChange: (type: OrderType) => void;
  products: ProductWithModifiers[];
  filteredProducts: ProductWithModifiers[];
  categories: Array<{ id: string; name: string }>;
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  items: OrderItem[];
  onSelectProduct: (product: ProductWithModifiers) => void;
}

const ORDER_TYPE_OPTIONS: Array<{
  value: OrderType;
  label: string;
  description: string;
  icon: typeof Store;
}> = [
  {
    value: "pickup",
    label: "Balcão",
    description: "Consumo ou retirada no balcão",
    icon: Store,
  },
  {
    value: "delivery",
    label: "Entrega",
    description: "Pedido enviado ao endereço do cliente",
    icon: Truck,
  },
];

function ProductImage({ product }: { product: ProductWithModifiers }) {
  const image = getProductImage(product);

  if (image === PLACEHOLDER_IMAGE) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1c1c1c] to-[#0c0c0c]">
        <span className="text-2xl font-black tracking-wider text-zinc-600">
          {getProductInitials(product.name)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={image}
      alt={product.name}
      loading="lazy"
      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
      onError={(event) => {
        event.currentTarget.src = PLACEHOLDER_IMAGE;
      }}
    />
  );
}

export default function ProductCatalog({
  orderType,
  onOrderTypeChange,
  products,
  filteredProducts,
  categories,
  selectedCategory,
  onSelectCategory,
  searchTerm,
  onSearchChange,
  items,
  onSelectProduct,
}: ProductCatalogProps) {
  const [showCodeHint, setShowCodeHint] = useState(false);

  const isSearching = searchTerm.trim().length > 0;

  const quantityByProduct = useMemo(() => {
    const totals = new Map<string, number>();

    items.forEach((item) => {
      totals.set(item.productId, (totals.get(item.productId) || 0) + Number(item.quantity || 0));
    });

    return totals;
  }, [items]);

  const selectedCategoryLabel =
    selectedCategory === "all"
      ? "Todos os produtos"
      : categories.find((category) => category.id === selectedCategory)?.name || "Produtos";

  return (
    <section className="flex min-h-0 min-w-0 flex-col bg-[#050505]">
      <header className="shrink-0 space-y-4 border-b border-white/[0.07] bg-gradient-to-b from-[#0e0e0e] to-[#050505] px-4 pb-4 pt-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:block">
              Painel / Novo pedido
            </p>
            <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-white">
              {orderType === "delivery" ? "Pedido para entrega" : "Atendimento de balcão"}
            </h1>
          </div>

          <div
            role="group"
            aria-label="Modalidade do pedido"
            className="grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.08] bg-[#0c0c0c] p-1 md:w-[360px]"
          >
            {ORDER_TYPE_OPTIONS.map((option) => {
              const active = orderType === option.value;
              const Icon = option.icon;

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  title={option.description}
                  onClick={() => onOrderTypeChange(option.value)}
                  className={cn(
                    "flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400",
                    active
                      ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20"
                      : "text-zinc-400 hover:bg-white/[0.05] hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && searchTerm) {
                  event.preventDefault();
                  onSearchChange("");
                }
              }}
              placeholder="Buscar produto pelo nome, categoria ou descrição"
              aria-label="Buscar produto"
              className="h-12 w-full rounded-xl border border-white/[0.08] bg-[#101010] pl-11 pr-11 text-sm font-medium text-white outline-none transition placeholder:text-zinc-600 hover:border-white/15 focus:border-yellow-400 focus:bg-[#141414] focus:ring-4 focus:ring-yellow-400/15"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowCodeHint((current) => !current)}
            aria-pressed={showCodeHint}
            className={cn(
              "flex h-12 shrink-0 items-center gap-2 rounded-xl border px-4 text-xs font-bold transition",
              showCodeHint
                ? "border-yellow-400/40 bg-yellow-400/[0.08] text-yellow-300"
                : "border-white/[0.08] bg-[#101010] text-zinc-400 hover:border-white/20 hover:text-white",
            )}
          >
            Código
          </button>
        </div>

        {showCodeHint && (
          <p className="-mt-2 rounded-lg border border-white/[0.07] bg-[#0c0c0c] px-3 py-2 text-xs text-zinc-500">
            Leitura de código de barras ainda não está disponível neste PDV. Use a busca por nome.
          </p>
        )}

        <div
          role="group"
          aria-label="Categorias"
          className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((category) => {
            const active = selectedCategory === category.id;
            const count =
              category.id === "all"
                ? products.length
                : products.filter((product) => product.category === category.id).length;

            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectCategory(category.id)}
                className={cn(
                  "inline-flex h-10 shrink-0 snap-start items-center gap-2 rounded-xl border px-4 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400",
                  active
                    ? isSearching
                      ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-300/70"
                      : "border-yellow-400 bg-yellow-400 text-black shadow-md shadow-yellow-400/15"
                    : "border-white/[0.08] bg-[#101010] text-zinc-400 hover:border-white/20 hover:text-zinc-100",
                )}
              >
                {category.id === "all" ? "Todos" : category.name}
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[11px] font-black tabular-nums",
                    active && !isSearching ? "bg-black/15 text-black" : "bg-white/[0.06] text-zinc-400",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-5 sm:px-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="truncate text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
            {isSearching ? "Resultados da busca" : selectedCategoryLabel}
          </h2>

          <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-500">
            {filteredProducts.length} {filteredProducts.length === 1 ? "item" : "itens"}
            {isSearching && " · todas as categorias"}
          </span>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] xl:gap-4">
            {filteredProducts.map((product) => {
              const groups = getProductGroups(product);
              const hasRequiredChoices = groups.some((group) => group.required);
              const quantityInOrder = quantityByProduct.get(product.id) || 0;

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelectProduct(product)}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d0d0d] text-left transition duration-200 hover:-translate-y-0.5 hover:border-yellow-400/35 hover:shadow-xl hover:shadow-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 active:translate-y-0 active:scale-[0.985]"
                >
                  <div className="relative aspect-[5/4] w-full overflow-hidden bg-[#111]">
                    <ProductImage product={product} />

                    {groups.length > 0 && (
                      <span
                        className={cn(
                          "absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur",
                          hasRequiredChoices
                            ? "bg-yellow-400 text-black"
                            : "bg-black/60 text-zinc-200 ring-1 ring-white/10",
                        )}
                      >
                        {hasRequiredChoices ? "Escolha obrigatória" : "Personalizável"}
                      </span>
                    )}

                    {quantityInOrder > 0 && (
                      <span className="absolute right-2.5 top-2.5 rounded-lg bg-white px-2 py-0.5 text-[11px] font-black text-black shadow-md">
                        {quantityInOrder}x
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                    <p className="line-clamp-1 text-sm font-bold text-zinc-50">{product.name}</p>
                    <p className="line-clamp-2 min-h-8 text-xs leading-4 text-zinc-500">
                      {product.description || product.categoryName || "Produto"}
                    </p>

                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <span className="text-base font-black tabular-nums text-yellow-400">
                        {formatCurrency(Number(product.price || 0))}
                      </span>
                      <span
                        aria-hidden="true"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-400 text-black shadow-md shadow-yellow-400/15 transition group-hover:bg-yellow-300"
                      >
                        <Plus className="h-5 w-5" strokeWidth={3} />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.09] bg-[#0a0a0a] px-6 text-center">
            <SearchX className="h-7 w-7 text-zinc-600" />
            <h3 className="mt-3 text-sm font-bold text-zinc-300">Nenhum produto encontrado</h3>
            <p className="mt-1 max-w-xs text-sm text-zinc-600">
              {products.length === 0
                ? "Ative produtos no cardápio para vendê-los no PDV."
                : "Tente outra categoria ou altere o termo da busca."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
