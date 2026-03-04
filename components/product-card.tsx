"use client"

import { useState, useCallback } from "react"
import {
  Check,
  X,
  Pencil,
  Flame,
  AlertTriangle,
  Moon,
  Calculator,
  ImageIcon,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type Product,
  type ViewMode,
  type ProductIndicator,
  getProfit,
  getMargin,
} from "@/lib/products-data"
import ImageUpload from "@/components/image-upload"

interface ProductCardProps {
  product: Product
  indicator: ProductIndicator
  viewMode: ViewMode
  selected: boolean
  onToggleSelect: (id: string) => void
  onUpdate: (id: string, updates: Partial<Product>) => void
  onDelete?: (id: string) => void
}

export default function ProductCard({
  product,
  indicator,
  viewMode,
  selected,
  onToggleSelect,
  onUpdate,
  onDelete,
}: ProductCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editPrice, setEditPrice] = useState(product.price)
  const [editCost, setEditCost] = useState(product.cost)
  const [editDescription, setEditDescription] = useState(product.description)
  const [editImage, setEditImage] = useState<string | null>(product.image)
  const [showSimulator, setShowSimulator] = useState(false)
  const [simPrice, setSimPrice] = useState(product.price)
  const [saveFlash, setSaveFlash] = useState(false)

  const profit = getProfit(product.price, product.cost)
  const margin = getMargin(product.price, product.cost)

  const startEditing = useCallback(() => {
    setEditPrice(product.price)
    setEditCost(product.cost)
    setEditDescription(product.description)
    setEditImage(product.image)
    setIsEditing(true)
  }, [product.price, product.cost, product.description, product.image])

  const cancelEditing = useCallback(() => {
    setIsEditing(false)
    setEditPrice(product.price)
    setEditCost(product.cost)
    setEditDescription(product.description)
    setEditImage(product.image)
  }, [product.price, product.cost, product.description, product.image])

  const saveEditing = useCallback(() => {
    onUpdate(product.id, {
      price: editPrice,
      cost: editCost,
      description: editDescription,
      image: editImage,
    })
    setIsEditing(false)
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 1200)
  }, [product.id, editPrice, editCost, editDescription, editImage, onUpdate])

  const toggleActive = useCallback(() => {
    onUpdate(product.id, { active: !product.active })
  }, [product.id, product.active, onUpdate])

  const simProfit = getProfit(simPrice, product.cost)
  const simMargin = getMargin(simPrice, product.cost)

  // --- Menu view (customer-facing simulation) ---
  if (viewMode === "menu") {
    return (
      <div
        className={cn(
          "rounded-xl border border-border bg-card overflow-hidden transition-all duration-200",
          !product.active && "opacity-40 pointer-events-none"
        )}
      >
        {/* Product image */}
        {product.image ? (
          <div className="h-40 w-full overflow-hidden bg-muted/30">
            <img
              src={product.image || "/placeholder.svg"}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-muted/30">
            <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-card-foreground truncate">
                {product.name}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            </div>
            <span className="flex-shrink-0 rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-bold text-[hsl(var(--primary-foreground))]">
              R$ {product.price.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // --- Management view ---
  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card transition-all duration-200",
        !product.active
          ? "border-border/50 opacity-60"
          : "border-border hover:border-[hsl(var(--primary))]/30 hover:shadow-md",
        selected && "ring-2 ring-[hsl(var(--primary))] border-[hsl(var(--primary))]",
        saveFlash && "ring-2 ring-green-500 border-green-500"
      )}
    >
      {/* Save feedback overlay */}
      {saveFlash && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-green-500/10 pointer-events-none">
          <span className="flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white">
            <Check className="h-3.5 w-3.5" /> Salvo
          </span>
        </div>
      )}

      <div className="p-5">
        {/* Top row: checkbox, thumbnail, name, indicator, status toggle */}
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(product.id)}
            className="mt-1 h-4 w-4 rounded border-border accent-[hsl(var(--primary))] cursor-pointer"
            aria-label={`Selecionar ${product.name}`}
          />

          {/* Thumbnail */}
          {!isEditing && (
            <div className="flex-shrink-0">
              {product.image ? (
                <div className="h-12 w-12 overflow-hidden rounded-lg border border-border">
                  <img
                    src={product.image || "/placeholder.svg"}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                  <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                </div>
              )}
            </div>
          )}

          <div className="min-w-0 flex-1">
            {/* Name + indicator */}
            <div className="flex items-center gap-2">
              <h3
                className={cn(
                  "text-base font-semibold truncate",
                  product.active ? "text-card-foreground" : "text-muted-foreground line-through"
                )}
              >
                {product.name}
              </h3>
              {indicator === "best-seller" && (
                <span
                  className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                  title="Produto mais vendido"
                >
                  <Flame className="h-3 w-3" /> Mais vendido
                </span>
              )}
              {indicator === "low-margin" && (
                <span
                  className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                  title="Margem de lucro baixa"
                >
                  <AlertTriangle className="h-3 w-3" /> Margem baixa
                </span>
              )}
              {indicator === "low-sales" && (
                <span
                  className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  title="Baixa saida"
                >
                  <Moon className="h-3 w-3" /> Baixa saida
                </span>
              )}
            </div>

            <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed line-clamp-1">
              {product.description}
            </p>
          </div>

          {/* Status toggle + edit button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={toggleActive}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
                product.active ? "bg-[hsl(var(--primary))]" : "bg-muted-foreground/30"
              )}
              aria-label={product.active ? "Desativar produto" : "Ativar produto"}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
                  product.active && "translate-x-5"
                )}
              />
            </button>

            {!isEditing && (
              <>
                <button
                  onClick={startEditing}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Editar produto"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {onDelete && (
                  <button
                    onClick={() => onDelete(product.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600"
                    aria-label="Excluir produto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Edit mode: image upload + description */}
        {isEditing && (
          <div className="mt-4 flex flex-col gap-4 rounded-lg border border-dashed border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5 p-4">
            <div className="flex gap-4 flex-col sm:flex-row">
              {/* Image upload */}
              <div className="flex-shrink-0 sm:w-56">
                <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Imagem do produto
                </label>
                <ImageUpload value={editImage} onChange={setEditImage} />
              </div>
              {/* Description */}
              <div className="flex-1">
                <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Descricao
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] leading-relaxed"
                  placeholder="Descricao do produto..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Price / Cost / Profit row */}
        <div className="mt-4 flex items-end gap-4 flex-wrap">
          {isEditing ? (
            <>
              {/* Inline edit fields */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Preco de venda
                </label>
                <div className="flex items-center gap-1 rounded-lg border border-[hsl(var(--primary))]/40 bg-background px-2.5 py-1.5">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <input
                    type="number"
                    step="0.10"
                    min="0"
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-20 bg-transparent text-sm font-semibold text-foreground outline-none"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Custo
                </label>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <input
                    type="number"
                    step="0.10"
                    min="0"
                    value={editCost}
                    onChange={(e) => setEditCost(Number(e.target.value))}
                    className="w-20 bg-transparent text-sm font-semibold text-foreground outline-none"
                  />
                </div>
              </div>
              {/* Live profit preview */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Lucro previsto
                </span>
                <span
                  className={cn(
                    "text-sm font-bold",
                    getProfit(editPrice, editCost) > 0 ? "text-green-600" : "text-destructive"
                  )}
                >
                  R$ {getProfit(editPrice, editCost).toFixed(2)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({getMargin(editPrice, editCost).toFixed(1)}%)
                  </span>
                </span>
              </div>
              {/* Save / Cancel */}
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={saveEditing}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white transition-colors hover:bg-green-700"
                  aria-label="Salvar alteracoes"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={cancelEditing}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
                  aria-label="Cancelar edicao"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Read-only display */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Preco
                </span>
                <span className="text-lg font-bold text-card-foreground">
                  R$ {product.price.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Custo
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  R$ {product.cost.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Lucro
                </span>
                <span
                  className={cn(
                    "text-sm font-bold",
                    profit > 0 ? "text-green-600" : "text-destructive"
                  )}
                >
                  R$ {profit.toFixed(2)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({margin.toFixed(1)}%)
                  </span>
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Vendas
                </span>
                <span className="text-sm font-medium text-card-foreground">
                  {product.salesCount}
                </span>
              </div>

              {/* Simulator toggle */}
              <button
                onClick={() => {
                  setSimPrice(product.price)
                  setShowSimulator(!showSimulator)
                }}
                className={cn(
                  "ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  showSimulator
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "bg-secondary text-secondary-foreground hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))]"
                )}
              >
                <Calculator className="h-3.5 w-3.5" />
                Simular
              </button>
            </>
          )}
        </div>

        {/* Price simulator */}
        {showSimulator && !isEditing && (
          <div className="mt-3 flex items-center gap-4 rounded-lg border border-dashed border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Novo preco:</span>
              <div className="flex items-center gap-1 rounded-md border border-[hsl(var(--primary))]/30 bg-background px-2 py-1">
                <span className="text-xs text-muted-foreground">R$</span>
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  value={simPrice}
                  onChange={(e) => setSimPrice(Number(e.target.value))}
                  className="w-20 bg-transparent text-sm font-semibold text-foreground outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Lucro estimado:</span>
              <span className={cn("font-bold", simProfit > 0 ? "text-green-600" : "text-destructive")}>
                R$ {simProfit.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">
                ({simMargin.toFixed(1)}%)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
