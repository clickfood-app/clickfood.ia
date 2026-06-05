"use client"

import { useMemo, useState } from "react"
import { Check, Minus, Package, Plus, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Product, Category } from "@/lib/products-data"
import type { OrderItemDraft, OrderItemModifier } from "@/lib/order-types"

type ModifierOption = {
  id: string
  name: string
  price: number
}

type ModifierGroup = {
  id: string
  name: string
  required: boolean
  minSelect: number
  maxSelect: number
  options: ModifierOption[]
}

type ProductWithModifiers = Product & {
  modifierGroups?: ModifierGroup[] | null
  modifier_groups?: ModifierGroup[] | null
}

interface ProductSearchProps {
  products: ProductWithModifiers[]
  categories: Category[]
  onAddProduct: (itemDraft: OrderItemDraft) => void
}

function formatCurrency(value: number) {
  return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`
}

function getProductModifierGroups(product: ProductWithModifiers): ModifierGroup[] {
  const groups = product.modifierGroups ?? product.modifier_groups ?? []

  if (!Array.isArray(groups)) return []

  return groups.filter((group) => Array.isArray(group.options) && group.options.length > 0)
}

function productNeedsConfiguration(product: ProductWithModifiers) {
  return getProductModifierGroups(product).length > 0
}

export default function ProductSearch({
  products,
  categories,
  onAddProduct,
}: ProductSearchProps) {
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedProduct, setSelectedProduct] = useState<ProductWithModifiers | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [observation, setObservation] = useState("")
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, ModifierOption[]>>({})

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (!product.active) return false

      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory =
        selectedCategory === "all" || String(product.category) === selectedCategory

      return matchesSearch && matchesCategory
    })
  }, [products, search, selectedCategory])

  const sortedCategories = useMemo(() => {
    return [...categories]
      .filter((category) => category.active && category.id !== "all")
      .sort((a, b) => a.order - b.order)
  }, [categories])

  const modifierGroups = selectedProduct ? getProductModifierGroups(selectedProduct) : []

  const modifiersTotal = Object.values(selectedModifiers)
    .flat()
    .reduce((sum, option) => sum + Number(option.price || 0), 0)

  const unitPrice = Number(selectedProduct?.price || 0) + modifiersTotal
  const totalPrice = unitPrice * quantity

  const allRequiredSelected = modifierGroups.every((group) => {
    if (!group.required && group.minSelect <= 0) return true

    const selected = selectedModifiers[group.id] || []

    return selected.length >= Math.max(1, Number(group.minSelect || 1))
  })

  function resetModal() {
    setSelectedProduct(null)
    setQuantity(1)
    setObservation("")
    setSelectedModifiers({})
  }

  function buildItemDraft(product: ProductWithModifiers): OrderItemDraft {
    const modifiers: OrderItemModifier[] = []

    getProductModifierGroups(product).forEach((group) => {
      const selected = selectedModifiers[group.id] || []

      selected.forEach((option) => {
        modifiers.push({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          optionPrice: Number(option.price || 0),
        })
      })
    })

    return {
      productId: product.id,
      name: product.name,
      price:
        Number(product.price || 0) +
        modifiers.reduce((sum, modifier) => sum + modifier.optionPrice, 0),
      quantity,
      observation: observation.trim(),
      modifiers,
    }
  }

  function handleQuickAdd(product: ProductWithModifiers) {
    if (productNeedsConfiguration(product)) {
      setSelectedProduct(product)
      setQuantity(1)
      setObservation("")
      setSelectedModifiers({})
      return
    }

    onAddProduct({
      productId: product.id,
      name: product.name,
      price: Number(product.price || 0),
      quantity: 1,
      observation: "",
      modifiers: [],
    })
  }

  function handleModifierIncrease(group: ModifierGroup, option: ModifierOption) {
    setSelectedModifiers((current) => {
      const selected = current[group.id] || []
      const isSelected = selected.some((item) => item.id === option.id)

      if (group.maxSelect === 1) {
        return {
          ...current,
          [group.id]: isSelected ? [] : [option],
        }
      }

      if (selected.length >= group.maxSelect) return current

      return {
        ...current,
        [group.id]: [...selected, option],
      }
    })
  }

  function handleModifierDecrease(group: ModifierGroup, option: ModifierOption) {
    setSelectedModifiers((current) => {
      const selected = current[group.id] || []
      const optionIndex = selected.findIndex((item) => item.id === option.id)

      if (optionIndex === -1) return current

      const nextSelected = [...selected]
      nextSelected.splice(optionIndex, 1)

      return {
        ...current,
        [group.id]: nextSelected,
      }
    })
  }

  function handleConfirmConfiguredProduct() {
    if (!selectedProduct || !allRequiredSelected) return

    onAddProduct(buildItemDraft(selectedProduct))
    resetModal()
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar produto..."
          className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            selectedCategory === "all"
              ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          )}
        >
          Todos
        </button>

        {sortedCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setSelectedCategory(String(category.id))}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              selectedCategory === String(category.id)
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="grid max-h-[320px] grid-cols-1 gap-2 overflow-y-auto pr-1">
        {filteredProducts.map((product) => {
          const needsConfiguration = productNeedsConfiguration(product)

          return (
            <div
              key={product.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-10 w-10 rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {product.name}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(Number(product.price || 0))}
                    </p>

                    {needsConfiguration && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        Opções
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleQuickAdd(product)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90"
                title={needsConfiguration ? "Escolher opções" : "Adicionar produto"}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )
        })}

        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="mb-2 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum produto encontrado</p>
          </div>
        )}
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Configurar item
                </p>

                <h3 className="mt-1 truncate text-lg font-bold text-foreground">
                  {selectedProduct.name}
                </h3>

                <p className="mt-1 text-sm font-semibold text-[hsl(var(--primary))]">
                  {formatCurrency(unitPrice)} un
                </p>
              </div>

              <button
                type="button"
                onClick={resetModal}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[64vh] space-y-5 overflow-y-auto p-4">
              {modifierGroups.map((group) => {
                const selected = selectedModifiers[group.id] || []
                const totalSelected = selected.length
                const isRadio = group.maxSelect === 1
                const reachedMax = !isRadio && totalSelected >= group.maxSelect

                return (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          {group.name}
                        </h4>

                        <p className="text-xs text-muted-foreground">
                          {group.required || group.minSelect > 0
                            ? `Obrigatório • escolha ${Math.max(1, group.minSelect)}`
                            : "Opcional"}
                          {group.maxSelect > 1 ? ` • até ${group.maxSelect}` : ""}
                        </p>
                      </div>

                      {group.maxSelect > 1 && (
                        <span className="rounded-full bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
                          {totalSelected}/{group.maxSelect}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {group.options.map((option) => {
                        const selectedCount = selected.filter((item) => item.id === option.id).length
                        const isSelected = selectedCount > 0
                        const isDisabled = !isSelected && reachedMax

                        if (isRadio) {
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => handleModifierIncrease(group, option)}
                              className={cn(
                                "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left text-sm transition",
                                isSelected
                                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10"
                                  : "border-border bg-background hover:bg-muted/60"
                              )}
                            >
                              <span className="font-medium text-foreground">
                                {option.name}
                              </span>

                              <div className="flex items-center gap-2">
                                {option.price > 0 && (
                                  <span className="text-xs font-bold text-muted-foreground">
                                    +{formatCurrency(option.price)}
                                  </span>
                                )}

                                <span
                                  className={cn(
                                    "flex h-5 w-5 items-center justify-center rounded-full border",
                                    isSelected
                                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                                      : "border-border"
                                  )}
                                >
                                  {isSelected && <Check className="h-3 w-3" />}
                                </span>
                              </div>
                            </button>
                          )
                        }

                        return (
                          <div
                            key={option.id}
                            className={cn(
                              "flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-sm transition",
                              isSelected
                                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10"
                                : isDisabled
                                  ? "border-border bg-muted/40 opacity-60"
                                  : "border-border bg-background hover:bg-muted/60"
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">
                                {option.name}
                              </p>

                              {option.price > 0 && (
                                <p className="mt-0.5 text-xs font-bold text-muted-foreground">
                                  +{formatCurrency(option.price)} cada
                                </p>
                              )}
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleModifierDecrease(group, option)}
                                disabled={!isSelected}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>

                              <span className="w-5 text-center text-sm font-bold text-foreground">
                                {selectedCount}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleModifierIncrease(group, option)}
                                disabled={reachedMax}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              <div>
                <label className="mb-1.5 block text-sm font-bold text-foreground">
                  Observação do item
                </label>

                <input
                  type="text"
                  value={observation}
                  onChange={(event) => setObservation(event.target.value)}
                  placeholder="Ex: sem cebola, molho à parte..."
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>

            <div className="border-t border-border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <span className="w-10 text-center text-sm font-bold">
                    {quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() => setQuantity((current) => current + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-lg font-bold text-[hsl(var(--primary))]">
                  {formatCurrency(totalPrice)}
                </p>
              </div>

              <button
                type="button"
                onClick={handleConfirmConfiguredProduct}
                disabled={!allRequiredSelected}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-md transition hover:bg-[hsl(var(--primary))]/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              >
                <Check className="h-4 w-4" />
                Adicionar ao pedido
              </button>

              {!allRequiredSelected && (
                <p className="mt-2 text-center text-xs font-semibold text-destructive">
                  Selecione as opções obrigatórias.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}