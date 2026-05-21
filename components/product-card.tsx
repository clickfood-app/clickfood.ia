"use client"

import { useCallback, useState } from "react"
import {
  AlertTriangle,
  Calculator,
  ChevronDown,
  ChevronUp,
  Flame,
  ImageIcon,
  Moon,
  Pencil,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type Product,
  type ProductIndicator,
  type ViewMode,
  getMargin,
  getProfit,
} from "@/lib/products-data"

type PromotionType = "none" | "fixed" | "percentage"

type ProductWithPromotion = Product & {
  promotionActive?: boolean
  promotionType?: PromotionType
  promotionValue?: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function getPromotionDiscount(product: ProductWithPromotion) {
  if (!product.promotionActive || product.promotionType === "none") return 0

  if (product.promotionType === "percentage") {
    return Math.min(product.price, product.price * ((product.promotionValue ?? 0) / 100))
  }

  return Math.min(product.price, product.promotionValue ?? 0)
}

function getPromotionalPrice(product: ProductWithPromotion) {
  return Math.max(product.price - getPromotionDiscount(product), 0)
}

function getPromotionLabel(product: ProductWithPromotion) {
  if (!product.promotionActive || product.promotionType === "none") {
    return "Sem promoção"
  }

  if (product.promotionType === "percentage") {
    return `${product.promotionValue ?? 0}% OFF`
  }

  return `${formatCurrency(product.promotionValue ?? 0)} OFF`
}

interface ProductCardProps {
  product: ProductWithPromotion
  indicator: ProductIndicator
  viewMode: ViewMode
  selected: boolean
  allowSelection?: boolean
  onToggleSelect: (id: string) => void
  onToggleActive: (id: string) => void
  onEdit: (id: string) => void
  onDelete?: (id: string) => void
}

export default function ProductCard({
  product,
  indicator,
  viewMode,
  selected,
  allowSelection = true,
  onToggleSelect,
  onToggleActive,
  onEdit,
  onDelete,
}: ProductCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [showSimulator, setShowSimulator] = useState(false)
  const [simPrice, setSimPrice] = useState(product.price)

  const promotionDiscount = getPromotionDiscount(product)
  const finalPrice = getPromotionalPrice(product)
  const salePrice = product.promotionActive ? finalPrice : product.price
  const baseProfit = getProfit(product.price, product.cost)
  const baseMargin = getMargin(product.price, product.cost)
  const profit = getProfit(salePrice, product.cost)
  const margin = getMargin(salePrice, product.cost)
  const simProfit = getProfit(simPrice, product.cost)
  const simMargin = getMargin(simPrice, product.cost)

  const toggleSimulator = useCallback(() => {
    setSimPrice(product.price)
    setShowSimulator((prev) => !prev)
  }, [product.price])

  if (viewMode === "menu") {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-card transition-all duration-200",
          !product.active && "pointer-events-none opacity-40"
        )}
      >
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
              <h3 className="truncate text-base font-semibold text-card-foreground">{product.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
            </div>
            <div className="flex-shrink-0 rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-right text-sm font-bold text-[hsl(var(--primary-foreground))]">
              <p>{formatCurrency(salePrice)}</p>
              {product.promotionActive && (
                <p className="text-[11px] font-semibold opacity-80 line-through">
                  {formatCurrency(product.price)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "group rounded-xl border bg-card transition-all duration-200",
        !product.active
          ? "border-border/50 opacity-70"
          : "border-border hover:border-[hsl(var(--primary))]/30 hover:shadow-md",
        selected && "border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]"
      )}
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          {allowSelection ? (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(product.id)}
              className="mt-1 h-4 w-4 cursor-pointer rounded border-border accent-[hsl(var(--primary))]"
              aria-label={`Selecionar ${product.name}`}
            />
          ) : (
            <div className="mt-1 h-4 w-4 shrink-0" />
          )}

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

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={cn(
                  "truncate text-base font-semibold",
                  product.active ? "text-card-foreground" : "text-muted-foreground line-through"
                )}
              >
                {product.name}
              </h3>

              {indicator === "best-seller" && (
                <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                  <Flame className="h-3 w-3" />
                  Mais vendido
                </span>
              )}

              {indicator === "low-margin" && (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  Margem baixa
                </span>
              )}

              {indicator === "low-sales" && (
                <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <Moon className="h-3 w-3" />
                  Baixa saida
                </span>
              )}

              {product.promotionActive && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">
                  Promoção
                </span>
              )}
            </div>

            <p className="mt-0.5 line-clamp-1 text-sm leading-relaxed text-muted-foreground">
              {product.description || "Sem descricao cadastrada."}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => onToggleActive(product.id)}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
                product.active ? "bg-[hsl(var(--primary))]" : "bg-muted-foreground/30"
              )}
              aria-label={product.active ? "Desativar produto" : "Ativar produto"}
            >
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
                  product.active && "translate-x-5"
                )}
              />
            </button>

            <button
              onClick={() => onEdit(product.id)}
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
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Preço no cardápio
            </span>
            <span className="text-lg font-bold text-card-foreground">
              {formatCurrency(salePrice)}
            </span>
            {product.promotionActive && (
              <span className="text-xs font-medium text-muted-foreground line-through">
                {formatCurrency(product.price)}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Vendas
            </span>
            <span className="text-sm font-medium text-card-foreground">
              {product.salesCount}
            </span>
          </div>

          <button
            onClick={() => setShowDetails((prev) => !prev)}
            className={cn(
              "ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              showDetails
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "bg-secondary text-secondary-foreground hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))]"
            )}
          >
            {showDetails ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            Detalhes
          </button>
        </div>

        {showDetails && (
          <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-card-foreground">
                Financeiro do produto
              </p>

              <span
                className={cn(
                  "rounded-full px-2 py-1 text-[11px] font-bold",
                  product.promotionActive
                    ? "bg-orange-100 text-orange-700"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {getPromotionLabel(product)}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Custo
                </span>
                <p className="text-sm font-bold text-card-foreground">
                  {formatCurrency(product.cost)}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Desconto
                </span>
                <p className="text-sm font-bold text-orange-600">
                  {formatCurrency(promotionDiscount)}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Lucro
                </span>
                <p className={cn("text-sm font-bold", profit > 0 ? "text-emerald-600" : "text-destructive")}>
                  {formatCurrency(profit)}
                </p>
                {product.promotionActive && (
                  <p className="text-[11px] text-muted-foreground">
                    Base: {formatCurrency(baseProfit)}
                  </p>
                )}
              </div>

              <div>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Margem
                </span>
                <p className={cn("text-sm font-bold", margin >= 20 ? "text-emerald-600" : "text-amber-600")}>
                  {margin.toFixed(1)}%
                </p>
                {product.promotionActive && (
                  <p className="text-[11px] text-muted-foreground">
                    Base: {baseMargin.toFixed(1)}%
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={toggleSimulator}
              className={cn(
                "mt-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                showSimulator
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "bg-secondary text-secondary-foreground hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))]"
              )}
            >
              <Calculator className="h-3.5 w-3.5" />
              Simular preço
            </button>

            {showSimulator && (
              <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Novo preço:</span>
                  <div className="flex items-center gap-1 rounded-md border border-[hsl(var(--primary))]/30 bg-background px-2 py-1">
                    <span className="text-xs text-muted-foreground">R$</span>
                    <input
                      type="number"
                      step="0.10"
                      min="0"
                      value={simPrice}
                      onChange={(event) => setSimPrice(Number(event.target.value))}
                      className="w-20 bg-transparent text-sm font-semibold text-foreground outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Lucro estimado:</span>
                  <span className={cn("font-bold", simProfit > 0 ? "text-emerald-600" : "text-destructive")}>
                    {formatCurrency(simProfit)}
                  </span>
                  <span className="text-xs text-muted-foreground">({simMargin.toFixed(1)}%)</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}