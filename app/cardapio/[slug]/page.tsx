"use client"

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react"
import Image from "next/image"
import { useParams, useSearchParams } from "next/navigation"
import {
  Clock, MapPin, Phone, ShoppingBag, Plus, Minus, X,
  ChevronUp, Truck, Store, MessageCircle, Search, Star,
  Check, CreditCard, Banknote, QrCode, ChevronRight,
  Flame, Sparkles, Info, ArrowLeft, Loader2, ChevronDown,
  Percent, Utensils, Heart, BadgeCheck, Timer, Gift,
} from "lucide-react"
import { getMercadoPagoConnection } from "@/lib/mercadopago"
import { getCoverFromStorage } from "@/components/settings/cover-image-upload"
import { cn } from "@/lib/utils"
import {
  getRestaurantBySlug,
  getMenuCategories,
  formatPrice,
  type MenuProduct,
  type MenuCategory,
  type Restaurant,
} from "@/lib/menu-data"

// ── Types ──
interface ModifierOption {
  id: string
  name: string
  price: number
}

interface ModifierGroup {
  id: string
  name: string
  required: boolean
  minSelect: number
  maxSelect: number
  options: ModifierOption[]
}

interface SelectedModifier {
  groupId: string
  groupName: string
  option: ModifierOption
}

interface CartItem {
  id: string
  product: MenuProduct
  quantity: number
  notes: string
  modifiers: SelectedModifier[]
  unitPrice: number
}

// ── Mock Data (ready for Supabase) ──
const mockModifierGroups: Record<string, ModifierGroup[]> = {
  "cat-1": [
    {
      id: "bread",
      name: "Tipo de Pao",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      options: [
        { id: "bread-brioche", name: "Pao Brioche", price: 0 },
        { id: "bread-australian", name: "Pao Australiano", price: 2 },
        { id: "bread-integral", name: "Pao Integral", price: 1 },
      ],
    },
    {
      id: "meat",
      name: "Ponto da Carne",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      options: [
        { id: "meat-medium", name: "Ao Ponto", price: 0 },
        { id: "meat-well", name: "Bem Passada", price: 0 },
        { id: "meat-rare", name: "Mal Passada", price: 0 },
      ],
    },
    {
      id: "extras",
      name: "Extras",
      required: false,
      minSelect: 0,
      maxSelect: 5,
      options: [
        { id: "extra-bacon", name: "Extra Bacon", price: 5 },
        { id: "extra-cheese", name: "Extra Queijo", price: 4 },
        { id: "extra-egg", name: "Ovo Frito", price: 3 },
        { id: "extra-cheddar", name: "Cheddar Cremoso", price: 4 },
        { id: "extra-onion", name: "Cebola Caramelizada", price: 3 },
      ],
    },
    {
      id: "sauces",
      name: "Molhos Adicionais",
      required: false,
      minSelect: 0,
      maxSelect: 3,
      options: [
        { id: "sauce-special", name: "Molho Especial", price: 0 },
        { id: "sauce-bbq", name: "Barbecue", price: 0 },
        { id: "sauce-mustard", name: "Mostarda e Mel", price: 0 },
        { id: "sauce-mayo", name: "Maionese Temperada", price: 2 },
        { id: "sauce-hot", name: "Molho Picante", price: 2 },
      ],
    },
  ],
  "cat-2": [
    {
      id: "ice",
      name: "Gelo",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      options: [
        { id: "ice-normal", name: "Com Gelo", price: 0 },
        { id: "ice-none", name: "Sem Gelo", price: 0 },
        { id: "ice-little", name: "Pouco Gelo", price: 0 },
      ],
    },
  ],
}

// Product badges and ratings (mock - ready for Supabase)
const productMeta: Record<string, { badge?: { type: "popular" | "promo" | "new"; label: string; discount?: number }; rating: number; reviews: number }> = {
  "prod-1": { badge: { type: "popular", label: "Mais Pedido" }, rating: 4.8, reviews: 142 },
  "prod-2": { badge: { type: "promo", label: "15% OFF", discount: 15 }, rating: 4.7, reviews: 98 },
  "prod-3": { rating: 4.5, reviews: 67 },
  "prod-5": { badge: { type: "popular", label: "Favorito" }, rating: 4.9, reviews: 85 },
  "prod-6": { rating: 4.3, reviews: 130 },
  "prod-7": { rating: 4.6, reviews: 56 },
  "prod-8": { badge: { type: "new", label: "Novo" }, rating: 4.4, reviews: 43 },
  "prod-10": { badge: { type: "popular", label: "Top 3" }, rating: 4.8, reviews: 74 },
  "prod-11": { rating: 4.2, reviews: 38 },
  "prod-13": { badge: { type: "promo", label: "10% OFF", discount: 10 }, rating: 4.6, reviews: 110 },
  "prod-14": { rating: 4.4, reviews: 52 },
  "prod-15": { rating: 4.0, reviews: 4 },
}

// Upsell suggestions
const upsellSuggestions: Record<string, string[]> = {
  "cat-1": ["prod-13", "prod-6"], // Lanches -> Batata + Refrigerante
  "cat-4": ["prod-6", "prod-8"], // Acompanhamentos -> Refrigerante + Milkshake
}

// ── Premium Skeleton Loader with shimmer ──
function MenuSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skeleton-shimmer {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>
      <div className="relative h-44 bg-gradient-to-br from-blue-500 to-indigo-600" />
      <div className="mx-auto max-w-2xl px-4 -mt-14 relative z-10">
        <div className="flex gap-4 items-end">
          <div className="h-20 w-20 rounded-2xl skeleton-shimmer ring-4 ring-white shadow-lg" />
          <div className="flex-1 space-y-2.5 pb-1">
            <div className="h-5 skeleton-shimmer rounded-lg w-2/3" />
            <div className="h-3.5 skeleton-shimmer rounded-lg w-1/2" />
          </div>
        </div>
        <div className="mt-5 h-12 skeleton-shimmer rounded-xl" />
        <div className="mt-4 h-32 skeleton-shimmer rounded-2xl" />
        <div className="mt-6 flex gap-2 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 w-24 flex-shrink-0 rounded-full skeleton-shimmer" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
        <div className="mt-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm border border-gray-100" style={{ animationDelay: `${i * 0.15}s` }}>
              <div className="flex-1 space-y-2.5">
                <div className="h-4 skeleton-shimmer rounded-lg w-3/4" />
                <div className="h-3 skeleton-shimmer rounded-lg w-full" />
                <div className="h-3 skeleton-shimmer rounded-lg w-2/3" />
                <div className="h-5 skeleton-shimmer rounded-lg w-1/4 mt-1" />
              </div>
              <div className="h-24 w-24 flex-shrink-0 rounded-xl skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Star Rating Component ──
function StarRating({ rating, reviews }: { rating: number; reviews: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "h-3 w-3",
              star <= Math.floor(rating) ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"
            )}
          />
        ))}
      </div>
      <span className="text-[10px] font-medium text-gray-500">
        {rating.toFixed(1)} ({reviews})
      </span>
    </div>
  )
}

// ── Badge Component ──
function ProductBadge({ badge }: { badge: { type: "popular" | "promo" | "new"; label: string } }) {
  return (
    <div className={cn(
      "absolute -top-2 left-3 z-10 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-md",
      badge.type === "popular" && "bg-gradient-to-r from-orange-500 to-amber-500 text-white",
      badge.type === "promo" && "bg-gradient-to-r from-blue-600 to-blue-500 text-white",
      badge.type === "new" && "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
    )}>
      {badge.type === "popular" && <Flame className="h-3 w-3" />}
      {badge.type === "promo" && <Percent className="h-3 w-3" />}
      {badge.type === "new" && <Sparkles className="h-3 w-3" />}
      {badge.label}
    </div>
  )
}

// ── Promo Banner ──
function PromoBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 p-4 text-white shadow-lg">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
      <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/10" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 text-xs font-medium text-blue-100">
          <Sparkles className="h-4 w-4" />
          PROMOCAO DO DIA
        </div>
        <h3 className="mt-1 text-lg font-bold">Combo Familia</h3>
        <p className="text-sm text-blue-100">2 Lanches + 2 Bebidas + Batata</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-2xl font-bold">R$ 79,90</span>
          <span className="rounded bg-white/20 px-2 py-0.5 text-xs font-medium line-through">R$ 99,90</span>
        </div>
      </div>
    </div>
  )
}

// ── Highlights Section ──
function HighlightsSection({
  categories,
  onSelectProduct,
}: {
  categories: MenuCategory[]
  onSelectProduct: (product: MenuProduct, categoryId: string) => void
}) {
  const popularProducts = useMemo(() => {
    const all = categories.flatMap((c) => c.products.map((p) => ({ ...p, categoryId: c.id })))
    return all
      .filter((p) => productMeta[p.id]?.badge?.type === "popular")
      .slice(0, 4)
  }, [categories])

  const promoProducts = useMemo(() => {
    const all = categories.flatMap((c) => c.products.map((p) => ({ ...p, categoryId: c.id })))
    return all
      .filter((p) => productMeta[p.id]?.badge?.type === "promo")
      .slice(0, 4)
  }, [categories])

  if (popularProducts.length === 0 && promoProducts.length === 0) return null

  return (
    <div className="space-y-5">
      {/* Popular */}
      {popularProducts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100">
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Mais Pedidos</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {popularProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => onSelectProduct(product, product.categoryId)}
                className="flex-shrink-0 w-36 rounded-xl bg-white p-2 shadow-sm border border-gray-100 transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="relative h-24 w-full rounded-lg overflow-hidden bg-gray-100">
                  {product.imageUrl ? (
                    <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="144px" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Utensils className="h-8 w-8 text-gray-300" />
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs font-semibold text-gray-900 truncate">{product.name}</p>
                <p className="text-xs font-bold text-blue-600">{formatPrice(product.price)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Promos */}
      {promoProducts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
              <Percent className="h-4 w-4 text-blue-600" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Promocoes</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {promoProducts.map((product) => {
              const meta = productMeta[product.id]
              const discount = meta?.badge?.discount || 0
              const originalPrice = product.price / (1 - discount / 100)
              return (
                <button
                  key={product.id}
                  onClick={() => onSelectProduct(product, product.categoryId)}
                  className="flex-shrink-0 w-36 rounded-xl bg-white p-2 shadow-sm border border-blue-100 transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] relative"
                >
                  <div className="absolute -top-1.5 -right-1.5 z-10 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    -{discount}%
                  </div>
                  <div className="relative h-24 w-full rounded-lg overflow-hidden bg-gray-100">
                    {product.imageUrl ? (
                      <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="144px" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Utensils className="h-8 w-8 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-gray-900 truncate">{product.name}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-blue-600">{formatPrice(product.price)}</span>
                    <span className="text-[10px] text-gray-400 line-through">{formatPrice(originalPrice)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Product Card with Premium Microinteractions ──
function ProductCard({
  product,
  onSelect,
  onQuickAdd,
}: {
  product: MenuProduct
  onSelect: () => void
  onQuickAdd: () => void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [isPressing, setIsPressing] = useState(false)
  const [showRipple, setShowRipple] = useState(false)
  const meta = productMeta[product.id]
  const badge = meta?.badge
  const discount = badge?.type === "promo" ? badge.discount || 0 : 0
  const originalPrice = discount > 0 ? product.price / (1 - discount / 100) : 0

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsAdding(true)
    setShowRipple(true)
    
    // Haptic-like visual feedback
    if (navigator.vibrate) navigator.vibrate(10)
    
    onQuickAdd()
    setTimeout(() => {
      setIsAdding(false)
      setShowRipple(false)
    }, 700)
  }

  return (
    <div
      className={cn(
        "group relative flex cursor-pointer gap-3 rounded-2xl bg-white p-3.5 border border-gray-100/80 transition-all duration-300 ease-out",
        "shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),0_4px_16px_-4px_rgba(0,0,0,0.05)]",
        "hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08),0_12px_32px_-8px_rgba(0,0,0,0.06)]",
        "hover:border-gray-200/80 hover:-translate-y-0.5",
        isPressing && "scale-[0.98] shadow-sm"
      )}
      onClick={onSelect}
      onMouseDown={() => setIsPressing(true)}
      onMouseUp={() => setIsPressing(false)}
      onMouseLeave={() => setIsPressing(false)}
      onTouchStart={() => setIsPressing(true)}
      onTouchEnd={() => setIsPressing(false)}
    >
      {badge && <ProductBadge badge={badge} />}

      <div className="flex-1 min-w-0 py-0.5">
        <h4 className="text-sm font-bold text-gray-900 truncate pr-2 group-hover:text-blue-600 transition-colors">{product.name}</h4>
        {meta && <StarRating rating={meta.rating} reviews={meta.reviews} />}
        <p className="mt-1.5 text-xs text-gray-500 line-clamp-2 leading-relaxed">{product.description}</p>
        <div className="mt-2.5 flex items-center gap-2">
          <p className="text-sm font-bold text-blue-600">{formatPrice(product.price)}</p>
          {discount > 0 && (
            <span className="text-xs text-gray-400 line-through">{formatPrice(originalPrice)}</span>
          )}
        </div>
      </div>

      <div className="relative flex-shrink-0">
        {product.imageUrl ? (
          <div className="relative h-24 w-24 overflow-hidden rounded-xl ring-1 ring-black/5">
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              loading="lazy"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
              sizes="96px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 ring-1 ring-black/5">
            <Utensils className="h-8 w-8 text-gray-300" />
          </div>
        )}
        
        {/* Add button with ripple effect */}
        <button
          onClick={handleQuickAdd}
          className={cn(
            "absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all duration-300 ease-out overflow-hidden",
            isAdding
              ? "bg-green-500 scale-110 rotate-0"
              : "bg-blue-600 hover:bg-blue-700 hover:scale-110 hover:shadow-xl hover:shadow-blue-600/30 active:scale-95"
          )}
          aria-label={`Adicionar ${product.name}`}
        >
          {showRipple && (
            <span className="absolute inset-0 animate-ping bg-white/30 rounded-full" />
          )}
          <span className={cn(
            "transition-all duration-300",
            isAdding ? "rotate-0 scale-100" : "rotate-0"
          )}>
            {isAdding ? (
              <Check className="h-5 w-5 text-white" strokeWidth={3} />
            ) : (
              <Plus className="h-5 w-5 text-white" strokeWidth={2.5} />
            )}
          </span>
        </button>
      </div>
    </div>
  )
}

// ── Modifier Group ──
function ModifierGroupComponent({
  group,
  selected,
  onToggle,
}: {
  group: ModifierGroup
  selected: ModifierOption[]
  onToggle: (option: ModifierOption) => void
}) {
  const isRadio = group.maxSelect === 1
  const reachedMax = !isRadio && selected.length >= group.maxSelect

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-gray-900">{group.name}</h4>
          {group.required && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 uppercase">
              Obrigatorio
            </span>
          )}
        </div>
        {!isRadio && group.maxSelect > 1 && (
          <span className="text-xs text-gray-400">
            {selected.length}/{group.maxSelect}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {group.options.map((option) => {
          const isSelected = selected.some((s) => s.id === option.id)
          const isDisabled = !isSelected && reachedMax

          return (
            <button
              key={option.id}
              onClick={() => !isDisabled && onToggle(option)}
              disabled={isDisabled}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all",
                isSelected
                  ? "bg-blue-50 ring-2 ring-blue-500"
                  : isDisabled
                  ? "bg-gray-50 opacity-50 cursor-not-allowed"
                  : "bg-gray-50 hover:bg-gray-100"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                  isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300"
                )}>
                  {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>
                <span className={cn("text-sm", isSelected ? "font-semibold text-gray-900" : "text-gray-700")}>
                  {option.name}
                </span>
              </div>
              {option.price > 0 && (
                <span className="text-xs font-bold text-blue-600">+{formatPrice(option.price)}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Product Modal ──
function ProductModal({
  product,
  categoryId,
  onClose,
  onAddToCart,
}: {
  product: MenuProduct
  categoryId: string
  onClose: () => void
  onAddToCart: (item: Omit<CartItem, "id">) => void
}) {
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState("")
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, ModifierOption[]>>({})

  const modifierGroups = mockModifierGroups[categoryId] || []
  const meta = productMeta[product.id]

  const modifiersTotal = Object.values(selectedModifiers).flat().reduce((sum, opt) => sum + opt.price, 0)
  const unitPrice = product.price + modifiersTotal
  const totalPrice = unitPrice * quantity

  const requiredGroups = modifierGroups.filter((g) => g.required)
  const allRequiredSelected = requiredGroups.every((g) => selectedModifiers[g.id]?.length >= g.minSelect)

  const handleModifierToggle = (group: ModifierGroup, option: ModifierOption) => {
    setSelectedModifiers((prev) => {
      const current = prev[group.id] || []
      const isSelected = current.some((o) => o.id === option.id)

      if (group.maxSelect === 1) {
        return { ...prev, [group.id]: isSelected ? [] : [option] }
      }

      if (isSelected) {
        return { ...prev, [group.id]: current.filter((o) => o.id !== option.id) }
      }
      if (current.length < group.maxSelect) {
        return { ...prev, [group.id]: [...current, option] }
      }
      return prev
    })
  }

  const handleAddToCart = () => {
    const modifiers: SelectedModifier[] = []
    modifierGroups.forEach((group) => {
      const selected = selectedModifiers[group.id] || []
      selected.forEach((opt) => {
        modifiers.push({ groupId: group.id, groupName: group.name, option: opt })
      })
    })

    onAddToCart({ product, quantity, notes, modifiers, unitPrice })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {product.imageUrl && (
          <div className="relative h-52 sm:h-60 w-full flex-shrink-0">
            <Image src={product.imageUrl} alt={product.name} fill className="object-cover rounded-t-3xl" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-t-3xl" />
            <button
              onClick={onClose}
              className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm"
            >
              <X className="h-5 w-5 text-gray-700" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            {!product.imageUrl && (
              <div className="flex justify-end">
                <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                  <X className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold text-gray-900">{product.name}</h3>
              {meta && <StarRating rating={meta.rating} reviews={meta.reviews} />}
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">{product.description}</p>
              <p className="mt-2 text-lg font-bold text-blue-600">A partir de {formatPrice(product.price)}</p>
            </div>

            {modifierGroups.length > 0 && (
              <div className="space-y-5 pt-3 border-t border-gray-100">
                {modifierGroups.map((group) => (
                  <ModifierGroupComponent
                    key={group.id}
                    group={group}
                    selected={selectedModifiers[group.id] || []}
                    onToggle={(opt) => handleModifierToggle(group, opt)}
                  />
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-gray-100">
              <label className="text-sm font-bold text-gray-900">Alguma observacao?</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Sem cebola, molho a parte..."
                className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                rows={2}
              />
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-gray-100 p-4 bg-white rounded-b-3xl">
          <div className="flex items-center gap-4">
            <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-11 w-11 items-center justify-center text-gray-500 hover:text-gray-700"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-sm font-bold">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="flex h-11 w-11 items-center justify-center text-gray-500 hover:text-gray-700"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={!allRequiredSelected}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all",
                allRequiredSelected
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 active:scale-[0.98]"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              )}
            >
              Adicionar {formatPrice(totalPrice)}
            </button>
          </div>
          {!allRequiredSelected && requiredGroups.length > 0 && (
            <p className="mt-2 text-center text-xs text-red-500">Selecione as opcoes obrigatorias</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Upsell Modal ──
function UpsellModal({
  suggestions,
  onAdd,
  onSkip,
}: {
  suggestions: MenuProduct[]
  onAdd: (product: MenuProduct) => void
  onSkip: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onSkip} />
      <div className="relative z-10 w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="text-center mb-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mb-3">
            <Sparkles className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Que tal adicionar?</h3>
          <p className="text-sm text-gray-500">Sugestoes que combinam com seu pedido</p>
        </div>
        <div className="space-y-2">
          {suggestions.map((product) => (
            <button
              key={product.id}
              onClick={() => onAdd(product)}
              className="flex w-full items-center gap-3 rounded-xl bg-gray-50 p-3 text-left transition-all hover:bg-gray-100"
            >
              {product.imageUrl ? (
                <div className="relative h-14 w-14 rounded-lg overflow-hidden">
                  <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="56px" />
                </div>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-200">
                  <Utensils className="h-6 w-6 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                <p className="text-xs text-gray-500 truncate">{product.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-blue-600">{formatPrice(product.price)}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
                  <Plus className="h-4 w-4 text-white" />
                </div>
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={onSkip}
          className="mt-4 w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Nao, obrigado
        </button>
      </div>
    </div>
  )
}

// ── Cart Sheet ──
function CartSheet({
  items,
  open,
  onClose,
  onUpdateQuantity,
  onRemove,
  restaurant,
}: {
  items: CartItem[]
  open: boolean
  onClose: () => void
  onUpdateQuantity: (cartItemId: string, delta: number) => void
  onRemove: (cartItemId: string) => void
  restaurant: Restaurant
}) {
  const [step, setStep] = useState<"cart" | "checkout">("cart")
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const mpConnection = typeof window !== "undefined" ? getMercadoPagoConnection(restaurant.id) : null
  const hasMercadoPago = !!mpConnection?.tokens?.access_token

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const serviceFee = Math.round(subtotal * 0.05)
  const deliveryFee = orderType === "delivery" ? restaurant.deliveryFee : 0
  const total = subtotal + serviceFee + deliveryFee

  const processOnlinePayment = async () => {
    if (!validateForm()) return
    setIsProcessing(true)
    try {
      const response = await fetch("/api/mercadopago/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          items: items.map((i) => ({
            title: i.product.name,
            quantity: i.quantity,
            unit_price: i.unitPrice,
          })),
          customerName,
          customerPhone,
          customerAddress: orderType === "delivery" ? customerAddress : undefined,
          orderType,
          deliveryFee,
          serviceFee,
          accessToken: mpConnection?.tokens?.access_token,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      window.location.href = data.checkoutUrl
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao processar pagamento")
      setIsProcessing(false)
    }
  }

  const validateForm = () => {
    if (!customerName.trim()) { alert("Informe seu nome"); return false }
    if (!customerPhone.trim()) { alert("Informe seu telefone"); return false }
    if (orderType === "delivery" && !customerAddress.trim()) { alert("Informe o endereco"); return false }
    return true
  }

  const sendWhatsAppOrder = () => {
    if (!validateForm()) return
    if (!paymentMethod) { alert("Selecione a forma de pagamento"); return }

    let message = `*NOVO PEDIDO - ${restaurant.name}*\n\n`
    message += `*Cliente:* ${customerName}\n*Telefone:* ${customerPhone}\n`
    message += `*Tipo:* ${orderType === "delivery" ? "Entrega" : "Retirada"}\n`
    if (orderType === "delivery") message += `*Endereco:* ${customerAddress}\n`
    message += `*Pagamento:* ${paymentMethod}\n\n*--- ITENS ---*\n`
    items.forEach((item) => {
      message += `${item.quantity}x ${item.product.name} - ${formatPrice(item.unitPrice * item.quantity)}\n`
      if (item.modifiers.length > 0) {
        item.modifiers.forEach((m) => { message += `   • ${m.option.name}\n` })
      }
    })
    message += `\n*Subtotal:* ${formatPrice(subtotal)}\n*Taxa:* ${formatPrice(serviceFee)}\n`
    if (orderType === "delivery") message += `*Entrega:* ${formatPrice(deliveryFee)}\n`
    message += `*TOTAL:* ${formatPrice(total)}`

    const phone = restaurant.whatsapp.replace(/\D/g, "")
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank")
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            {step === "checkout" && (
              <button onClick={() => setStep("cart")} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                <ArrowLeft className="h-4 w-4 text-gray-600" />
              </button>
            )}
            <ShoppingBag className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">{step === "cart" ? "Seu Pedido" : "Finalizar"}</h3>
            {step === "cart" && items.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                {items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
            <X className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {step === "cart" ? (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShoppingBag className="h-12 w-12 text-gray-200 mb-3" />
                  <p className="text-sm font-medium text-gray-400">Carrinho vazio</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="rounded-xl bg-gray-50 p-3">
                    <div className="flex items-start gap-3">
                      {item.product.imageUrl ? (
                        <div className="relative h-14 w-14 flex-shrink-0 rounded-lg overflow-hidden">
                          <Image src={item.product.imageUrl} alt={item.product.name} fill className="object-cover" sizes="56px" />
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-gray-200">
                          <Utensils className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.product.name}</p>
                        {item.modifiers.length > 0 && (
                          <p className="text-[11px] text-gray-500">{item.modifiers.map((m) => m.option.name).join(", ")}</p>
                        )}
                        <p className="text-sm font-bold text-blue-600 mt-1">{formatPrice(item.unitPrice * item.quantity)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-gray-200/50">
                      <button
                        onClick={() => item.quantity <= 1 ? onRemove(item.id) : onUpdateQuantity(item.id, -1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-200"
                      >
                        {item.quantity <= 1 ? <X className="h-3.5 w-3.5 text-red-500" /> : <Minus className="h-3.5 w-3.5 text-gray-500" />}
                      </button>
                      <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {items.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-4 flex-shrink-0 bg-white">
                <div className="space-y-1 text-sm mb-3">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Taxa de servico</span>
                    <span>{formatPrice(serviceFee)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setStep("checkout")}
                  className="w-full flex items-center justify-between rounded-xl bg-blue-600 px-5 py-4 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 active:scale-[0.98]"
                >
                  <span className="text-sm font-bold">Continuar</span>
                  <span className="text-sm font-bold">{formatPrice(subtotal + serviceFee)}</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Tipo de pedido</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { id: "delivery", label: "Entrega", icon: Truck },
                    { id: "pickup", label: "Retirada", icon: Store },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setOrderType(type.id as "delivery" | "pickup")}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all",
                        orderType === type.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Seu nome *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Como podemos te chamar?"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Telefone *</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {orderType === "delivery" && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Endereco *</label>
                  <textarea
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Rua, numero, bairro..."
                    rows={2}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Forma de pagamento</label>
                <div className="mt-2 space-y-2">
                  {[
                    { id: "dinheiro", label: "Dinheiro", icon: Banknote },
                    { id: "pix", label: "Pix", icon: QrCode },
                    { id: "cartao", label: "Cartao na entrega", icon: CreditCard },
                  ].map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.label)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all",
                        paymentMethod === method.label ? "bg-blue-50 ring-2 ring-blue-500" : "bg-gray-50 hover:bg-gray-100"
                      )}
                    >
                      <method.icon className={cn("h-5 w-5", paymentMethod === method.label ? "text-blue-600" : "text-gray-400")} />
                      <span className={cn("text-sm", paymentMethod === method.label ? "font-semibold" : "text-gray-700")}>
                        {method.label}
                      </span>
                      {paymentMethod === method.label && <Check className="ml-auto h-4 w-4 text-blue-600" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 px-5 py-4 flex-shrink-0 bg-white space-y-3">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Taxa de servico</span>
                  <span>{formatPrice(serviceFee)}</span>
                </div>
                {orderType === "delivery" && (
                  <div className="flex justify-between text-gray-500">
                    <span>Entrega</span>
                    <span>{formatPrice(deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-100">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {hasMercadoPago && (
                  <button
                    onClick={processOnlinePayment}
                    disabled={isProcessing}
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    {isProcessing ? "..." : "Pagar pelo Site"}
                  </button>
                )}
                <button
                  onClick={sendWhatsAppOrder}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all active:scale-[0.98]",
                    hasMercadoPago
                      ? "bg-green-500 text-white shadow-lg shadow-green-500/25 hover:bg-green-600"
                      : "bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 col-span-2"
                  )}
                >
                  <MessageCircle className="h-4 w-4" />
                  {hasMercadoPago ? "WhatsApp" : "Pedir pelo WhatsApp"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Floating Cart Button with Premium Animation ──
function FloatingCartButton({
  count,
  total,
  onClick,
}: {
  count: number
  total: number
  onClick: () => void
}) {
  const [bounce, setBounce] = useState(false)
  const prevCount = useRef(count)

  useEffect(() => {
    if (count > prevCount.current) {
      setBounce(true)
      setTimeout(() => setBounce(false), 400)
    }
    prevCount.current = count
  }, [count])

  if (count === 0) return null

  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-20 left-4 right-4 z-40 flex items-center justify-between rounded-2xl px-5 py-4 text-white max-w-lg mx-auto",
        "bg-gradient-to-r from-blue-600 to-blue-700",
        "shadow-[0_8px_32px_-4px_rgba(37,99,235,0.5),0_4px_16px_-2px_rgba(37,99,235,0.3)]",
        "transition-all duration-300 ease-out",
        "hover:shadow-[0_12px_40px_-4px_rgba(37,99,235,0.6),0_8px_24px_-2px_rgba(37,99,235,0.4)]",
        "hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0",
        "animate-in slide-in-from-bottom-6 duration-500",
        bounce && "animate-bounce"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm",
          bounce && "animate-ping-once"
        )}>
          <ShoppingBag className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-blue-600">
            {count}
          </span>
        </div>
        <div className="flex flex-col items-start">
          <span className="text-[10px] font-medium text-blue-200">Ver carrinho</span>
          <span className="text-sm font-bold">{count} {count === 1 ? "item" : "itens"}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-medium text-blue-200">Total</span>
          <span className="text-base font-bold">{formatPrice(total)}</span>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
          <ChevronUp className="h-5 w-5" />
        </div>
      </div>
    </button>
  )
}

// ── WhatsApp Floating Button with Pulse ──
function WhatsAppFloatingButton({ whatsapp }: { whatsapp: string }) {
  const phone = whatsapp.replace(/\D/g, "")
  
  return (
    <a
      href={`https://wa.me/${phone}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-4 z-40 group"
      aria-label="Falar pelo WhatsApp"
    >
      {/* Pulse ring */}
      <span className="absolute inset-0 rounded-full bg-green-500/40 animate-ping" />
      
      {/* Button */}
      <span className={cn(
        "relative flex h-14 w-14 items-center justify-center rounded-full",
        "bg-gradient-to-br from-green-500 to-green-600",
        "shadow-[0_4px_20px_-2px_rgba(34,197,94,0.5)]",
        "transition-all duration-300 ease-out",
        "group-hover:scale-110 group-hover:shadow-[0_8px_30px_-2px_rgba(34,197,94,0.6)]",
        "group-active:scale-95"
      )}>
        <MessageCircle className="h-6 w-6 text-white fill-white" />
      </span>
      
      {/* Tooltip */}
      <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
        Fale conosco
        <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900" />
      </span>
    </a>
  )
}

// ── Main Page ──
export default function CardapioPublicoPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const tableNumber = searchParams.get("mesa")

  const [mounted, setMounted] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<{ product: MenuProduct; categoryId: string } | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [upsellProducts, setUpsellProducts] = useState<MenuProduct[] | null>(null)
  const [lastAddedCategory, setLastAddedCategory] = useState<string | null>(null)

  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const categoryNavRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const restaurant = useMemo(() => getRestaurantBySlug(slug), [slug])
  const categories = useMemo(() => getMenuCategories(slug), [slug])

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id)
    }
  }, [categories, activeCategory])

  // Scroll spy
  useEffect(() => {
    if (!mounted) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.id)
            const tab = document.getElementById(`tab-${entry.target.id}`)
            if (tab && categoryNavRef.current) {
              tab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
            }
          }
        }
      },
      { rootMargin: "-180px 0px -60% 0px", threshold: 0 }
    )
    Object.values(categoryRefs.current).forEach((el) => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [mounted, categories])

  const addToCart = useCallback((item: Omit<CartItem, "id">) => {
    setCart((prev) => [...prev, { ...item, id: `cart-${Date.now()}-${Math.random()}` }])
  }, [])

  const handleAddWithUpsell = useCallback((item: Omit<CartItem, "id">, categoryId: string) => {
    addToCart(item)
    setLastAddedCategory(categoryId)
    
    // Check for upsell suggestions
    const suggestionIds = upsellSuggestions[categoryId]
    if (suggestionIds) {
      const allProducts = categories.flatMap((c) => c.products)
      const suggestions = suggestionIds
        .map((id) => allProducts.find((p) => p.id === id))
        .filter((p): p is MenuProduct => !!p)
      if (suggestions.length > 0) {
        setUpsellProducts(suggestions)
      }
    }
  }, [categories, addToCart])

  const updateCartQuantity = useCallback((cartItemId: string, delta: number) => {
    setCart((prev) => prev.map((i) => 
      i.id === cartItemId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
    ))
  }, [])

  const removeFromCart = useCallback((cartItemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== cartItemId))
  }, [])

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories
    const q = searchQuery.toLowerCase()
    return categories
      .map((cat) => ({
        ...cat,
        products: cat.products.filter((p) =>
          p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.products.length > 0)
  }, [categories, searchQuery])

  const scrollToCategory = useCallback((categoryId: string) => {
    const el = categoryRefs.current[categoryId]
    if (el) {
      const yOffset = -160
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: "smooth" })
    }
  }, [])

  if (!mounted) return <MenuSkeleton />
  if (!restaurant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <Store className="mx-auto h-16 w-16 text-gray-300 mb-4" />
          <h1 className="text-xl font-bold text-gray-900">Restaurante nao encontrado</h1>
          <p className="text-gray-500 mt-2">Verifique o endereco e tente novamente</p>
        </div>
      </div>
    )
  }

  {/* Get cover image if exists */}
  const coverImageUrl = typeof window !== "undefined" ? getCoverFromStorage(restaurant.id) : null

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Hero with cover image or animated gradient */}
      <div className="relative overflow-hidden">
        {coverImageUrl ? (
          // Custom cover image
          <div className="relative h-56 md:h-64">
            <Image
              src={coverImageUrl}
              alt={`Capa ${restaurant.name}`}
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
            {/* Restaurant info on cover */}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-20">
              <div className="mx-auto max-w-2xl">
                <div className="flex items-center gap-2 text-white/90 text-xs mb-1">
                  <Timer className="h-3.5 w-3.5" />
                  <span>30-45 min</span>
                  <span className="mx-1">•</span>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span>4.8 (250+)</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Default animated gradient
          <div className="h-44 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 relative">
            {/* Animated background shapes */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl animate-pulse" />
              <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-indigo-400/20 blur-2xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-32 rounded-full bg-blue-400/20 blur-xl" />
            </div>
            {/* Subtle grid pattern */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-gray-50 via-gray-50/80 to-transparent" />
      </div>

      <div className="mx-auto max-w-2xl px-4 -mt-16 relative z-10">
        {/* Restaurant Header with entrance animation */}
        <div className="flex gap-4 items-end animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="h-20 w-20 rounded-2xl bg-white shadow-xl ring-4 ring-white overflow-hidden flex items-center justify-center transition-transform hover:scale-105">
            {restaurant.logoUrl ? (
              <Image src={restaurant.logoUrl} alt={restaurant.name} width={80} height={80} className="object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Store className="h-8 w-8 text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{restaurant.name}</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-semibold text-green-700">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
                Aberto
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                <BadgeCheck className="h-3 w-3" />
                Verificado
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{restaurant.description}</p>
          </div>
        </div>

        {/* Info Bar with glass effect */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
          <div className="flex items-center gap-1.5 rounded-full bg-white/80 backdrop-blur-sm px-3 py-1.5 shadow-sm border border-gray-100 text-xs whitespace-nowrap">
            <Timer className="h-3.5 w-3.5 text-blue-600" />
            <span className="font-medium text-gray-700">30-45 min</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/80 backdrop-blur-sm px-3 py-1.5 shadow-sm border border-gray-100 text-xs whitespace-nowrap">
            <Truck className="h-3.5 w-3.5 text-blue-600" />
            <span className="font-medium text-gray-700">Entrega {formatPrice(restaurant.deliveryFee)}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/80 backdrop-blur-sm px-3 py-1.5 shadow-sm border border-gray-100 text-xs whitespace-nowrap">
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            <span className="font-medium text-gray-700">4.8 (250+)</span>
          </div>
          {tableNumber && (
            <div className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 shadow-sm text-xs whitespace-nowrap">
              <Utensils className="h-3.5 w-3.5 text-white" />
              <span className="font-semibold text-white">Mesa {tableNumber}</span>
            </div>
          )}
        </div>

        {/* Search Bar with focus animation */}
        <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
          <div className="relative group">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 to-indigo-500/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="O que voce deseja hoje?"
                className="w-full rounded-xl border border-gray-200 bg-white py-3.5 pl-11 pr-4 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 shadow-sm focus:shadow-md"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Promo Banner */}
        {!searchQuery && (
          <div className="mt-4">
            <PromoBanner />
          </div>
        )}

        {/* Highlights */}
        {!searchQuery && (
          <div className="mt-6">
            <HighlightsSection
              categories={categories}
              onSelectProduct={(product, categoryId) => setSelectedProduct({ product, categoryId })}
            />
          </div>
        )}
      </div>

      {/* Sticky Category Nav with glass effect */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100 mt-6 shadow-sm">
        <div className="mx-auto max-w-2xl px-4">
          <div ref={categoryNavRef} className="flex gap-2 overflow-x-auto py-3 scrollbar-hide -mx-4 px-4">
            {categories.map((cat, index) => (
              <button
                key={cat.id}
                id={`tab-${cat.id}`}
                onClick={() => scrollToCategory(cat.id)}
                style={{ animationDelay: `${index * 50}ms` }}
                className={cn(
                  "flex-shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-2",
                  activeCategory === cat.id
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105"
                    : "bg-white text-gray-600 hover:bg-gray-50 hover:text-blue-600 border border-gray-200 hover:border-blue-200"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Categories & Products */}
      <div className="mx-auto max-w-2xl px-4 mt-4 space-y-8">
        {filteredCategories.map((category) => (
          <div
            key={category.id}
            id={category.id}
            ref={(el) => { categoryRefs.current[category.id] = el }}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-3">{category.name}</h2>
            <div className="space-y-3">
              {category.products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelect={() => setSelectedProduct({ product, categoryId: category.id })}
                  onQuickAdd={() => {
                    handleAddWithUpsell(
                      { product, quantity: 1, notes: "", modifiers: [], unitPrice: product.price },
                      category.id
                    )
                  }}
                />
              ))}
            </div>
          </div>
        ))}

        {filteredCategories.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <Search className="mx-auto h-12 w-12 text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-400">Nenhum produto encontrado</p>
            <p className="text-xs text-gray-300 mt-1">Tente buscar por outro termo</p>
          </div>
        )}
      </div>

      {/* Floating Cart */}
      <FloatingCartButton count={cartCount} total={cartTotal} onClick={() => setCartOpen(true)} />

      {/* WhatsApp Button */}
      <WhatsAppFloatingButton whatsapp={restaurant.whatsapp} />

      {/* Product Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct.product}
          categoryId={selectedProduct.categoryId}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(item) => handleAddWithUpsell(item, selectedProduct.categoryId)}
        />
      )}

      {/* Upsell Modal */}
      {upsellProducts && (
        <UpsellModal
          suggestions={upsellProducts}
          onAdd={(product) => {
            addToCart({ product, quantity: 1, notes: "", modifiers: [], unitPrice: product.price })
            setUpsellProducts(null)
          }}
          onSkip={() => setUpsellProducts(null)}
        />
      )}

      {/* Cart Sheet */}
      <CartSheet
        items={cart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onUpdateQuantity={updateCartQuantity}
        onRemove={removeFromCart}
        restaurant={restaurant}
      />
    </div>
  )
}
