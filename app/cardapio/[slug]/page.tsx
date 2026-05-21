"use client"

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react"
import Image from "next/image"
import { useParams, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  ShoppingBag,
  Plus,
  Minus,
  X,
  ChevronUp,
  Truck,
  Store,
  MessageCircle,
  Search,
  Check,
  CreditCard,
  Banknote,
  QrCode,
  Flame,
  Sparkles,
  ArrowLeft,
  Loader2,
  Percent,
  Utensils,
  Timer,
  Receipt,
  UserRound,
  Star,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  formatPrice,
  type MenuProduct,
  type MenuCategory,
} from "@/lib/menu-data"

interface DeliveryFeeRule {
  id: string
  label: string
  fee: number
  neighborhoods: string[]
  isActive?: boolean
  sortOrder?: number
}

interface PublicRestaurant {
  id: string
  name: string
  slug?: string | null
  owner_id?: string | null

  description?: string | null
  phone?: string | null
  whatsapp?: string | null
  address?: string | null
  city?: string | null
  state?: string | null

  deliveryFee: number
  deliveryFeeRules?: DeliveryFeeRule[] | null
  openTime?: string | null
  closeTime?: string | null
  avgPrepTime?: number | null
  minimumOrder?: number | null
  estimatedDeliveryTime?: string | null

  deliveryEnabled?: boolean | null
  pickupEnabled?: boolean | null
  closedToday?: boolean | null
  closedMessage?: string | null
  activeDays?: string[] | null

  coverImageUrl?: string | null
  logoUrl?: string | null
  themeColor?: string | null
  themeMode?: string | null
  floatingCartBgColor?: string | null
  floatingCartTextColor?: string | null
  floatingCartNumberColor?: string | null

  ratingAverage?: number | null
  ratingCount?: number | null
}

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

const productMeta: Record<
  string,
  {
    badge?: { type: "popular" | "promo" | "new"; label: string; discount?: number }
  }
> = {
  "prod-1": { badge: { type: "popular", label: "Mais Pedido" } },
  "prod-2": { badge: { type: "promo", label: "15% OFF", discount: 15 } },
  "prod-3": {},
  "prod-5": { badge: { type: "popular", label: "Favorito" } },
  "prod-6": {},
  "prod-7": {},
  "prod-8": { badge: { type: "new", label: "Novo" } },
  "prod-10": { badge: { type: "popular", label: "Top 3" } },
  "prod-11": {},
  "prod-13": { badge: { type: "promo", label: "10% OFF", discount: 10 } },
  "prod-14": {},
  "prod-15": {},
}

const upsellSuggestions: Record<string, string[]> = {
  "cat-1": ["prod-13", "prod-6"],
  "cat-4": ["prod-6", "prod-8"],
}

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]

function normalizeNeighborhood(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function getActiveDeliveryRules(restaurant: PublicRestaurant) {
  if (!Array.isArray(restaurant.deliveryFeeRules)) return []

  return restaurant.deliveryFeeRules
    .filter((rule) => Array.isArray(rule.neighborhoods) && rule.neighborhoods.length > 0)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

function getStartingDeliveryFee(restaurant: PublicRestaurant) {
  const rules = getActiveDeliveryRules(restaurant)

  if (rules.length === 0) {
    return restaurant.deliveryFee
  }

  return Math.min(...rules.map((rule) => Number(rule.fee || 0)))
}

function timeToMinutes(value?: string | null, fallback = 0) {
  if (!value || !value.includes(":")) return fallback

  const [hours, minutes] = value.split(":").map(Number)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback

  return hours * 60 + minutes
}

function isOpenNow(restaurant: PublicRestaurant) {
  const now = new Date()
  const currentDay = WEEK_DAYS[now.getDay()]
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const activeDays =
    Array.isArray(restaurant.activeDays) && restaurant.activeDays.length > 0
      ? restaurant.activeDays
      : ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]

  if (restaurant.closedToday) return false
  if (!activeDays.includes(currentDay)) return false

  const openMinutes = timeToMinutes(restaurant.openTime, 11 * 60)
  const closeMinutes = timeToMinutes(restaurant.closeTime, 23 * 60)

  if (closeMinutes === openMinutes) return false

  if (closeMinutes > openMinutes) {
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  }

  return currentMinutes >= openMinutes || currentMinutes < closeMinutes
}

function formatPrepTimeLabel(restaurant: PublicRestaurant) {
  if (restaurant.estimatedDeliveryTime?.trim()) {
    return restaurant.estimatedDeliveryTime
  }

  const avg = Number(restaurant.avgPrepTime ?? 35)
  const min = Math.max(10, avg - 5)
  const max = avg + 10

  return `${min}-${max} min`
}

function MenuSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
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
        <div className="mt-4 h-44 skeleton-shimmer rounded-[28px]" />

        <div className="mt-4 flex gap-2 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-10 w-24 flex-shrink-0 rounded-full skeleton-shimmer"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm border border-gray-100"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
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

function ProductBadge({
  badge,
}: {
  badge: { type: "popular" | "promo" | "new"; label: string }
}) {
  return (
    <div
      className={cn(
        "absolute -top-2 left-3 z-10 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-md",
        badge.type === "popular" && "bg-gradient-to-r from-orange-500 to-amber-500 text-white",
        badge.type === "promo" && "bg-gradient-to-r from-blue-600 to-blue-500 text-white",
        badge.type === "new" && "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
      )}
    >
      {badge.type === "popular" && <Flame className="h-3 w-3" />}
      {badge.type === "promo" && <Percent className="h-3 w-3" />}
      {badge.type === "new" && <Sparkles className="h-3 w-3" />}
      {badge.label}
    </div>
  )
}

function ProductCard({
  product,
  accentColor,
  onSelect,
  onQuickAdd,
}: {
  product: MenuProduct
  accentColor: string
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
        "group relative flex cursor-pointer gap-3 rounded-[22px] p-3.5 transition-all duration-200 border border-gray-200 bg-white shadow-[0_4px_20px_-12px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgba(0,0,0,0.18)]",
        isPressing && "scale-[0.985]"
      )}
      onClick={onSelect}
      onMouseDown={() => setIsPressing(true)}
      onMouseUp={() => setIsPressing(false)}
      onMouseLeave={() => setIsPressing(false)}
      onTouchStart={() => setIsPressing(true)}
      onTouchEnd={() => setIsPressing(false)}
    >
      {badge && <ProductBadge badge={badge} />}

      <div className="min-w-0 flex-1 pt-1">
        <h4 className="line-clamp-1 pr-2 text-[15px] font-extrabold leading-tight text-gray-900">
          {product.name}
        </h4>

        <p className="mt-1.5 line-clamp-2 min-h-[40px] text-[12px] leading-5 text-gray-500">
          {product.description?.trim() || "Toque para ver mais detalhes deste item."}
        </p>

        <div className="mt-3 flex items-end gap-2">
          {discount > 0 && (
            <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">
              -{discount}%
            </span>
          )}

          <div className="flex flex-col">
            {discount > 0 && (
              <span className="text-[11px] text-gray-400 line-through">
                {formatPrice(originalPrice)}
              </span>
            )}

            <span className="text-base font-black leading-none tracking-tight text-gray-900">
              {formatPrice(product.price)}
            </span>
          </div>
        </div>
      </div>

      <div className="relative h-[104px] w-[104px] flex-shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
        {product.imageUrl ? (
          <>
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              loading="lazy"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="104px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
            <Utensils className="h-8 w-8 text-gray-300" />
          </div>
        )}

        <button
          onClick={handleQuickAdd}
          className={cn(
            "absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-all duration-300 overflow-hidden",
            isAdding ? "bg-green-500 scale-110" : "hover:scale-105 active:scale-95"
          )}
          style={
            isAdding
              ? undefined
              : {
                  backgroundColor: accentColor,
                  boxShadow: `0 12px 24px -12px ${accentColor}`,
                }
          }
          aria-label={`Adicionar ${product.name}`}
        >
          {showRipple && (
            <span className="absolute inset-0 animate-ping rounded-full bg-white/30" />
          )}

          {isAdding ? (
            <Check className="h-4.5 w-4.5 text-white" strokeWidth={3} />
          ) : (
            <Plus className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
          )}
        </button>
      </div>
    </div>
  )
}

function ModifierGroupComponent({
  group,
  selected,
  accentColor,
  onToggle,
}: {
  group: ModifierGroup
  selected: ModifierOption[]
  accentColor: string
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
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-600">
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
                  ? "ring-2"
                  : isDisabled
                    ? "bg-gray-50 opacity-50 cursor-not-allowed"
                    : "bg-gray-50 hover:bg-gray-100"
              )}
              style={
                isSelected
                  ? {
                      backgroundColor: `${accentColor}14`,
                      borderColor: accentColor,
                      boxShadow: `0 0 0 2px ${accentColor}`,
                    }
                  : undefined
              }
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                    isSelected ? "border-transparent text-white" : "border-gray-300"
                  )}
                  style={
                    isSelected
                      ? { borderColor: accentColor, backgroundColor: accentColor }
                      : undefined
                  }
                >
                  {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>

                <span
                  className={cn(
                    "text-sm",
                    isSelected ? "font-semibold text-gray-900" : "text-gray-700"
                  )}
                >
                  {option.name}
                </span>
              </div>

              {option.price > 0 && (
                <span className="text-xs font-bold" style={{ color: accentColor }}>
                  +{formatPrice(option.price)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ProductModal({
  product,
  categoryId,
  accentColor,
  onClose,
  onAddToCart,
}: {
  product: MenuProduct
  categoryId: string
  accentColor: string
  onClose: () => void
  onAddToCart: (item: Omit<CartItem, "id">) => void
}) {
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState("")
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, ModifierOption[]>>({})

  const modifierGroups = mockModifierGroups[categoryId] || []

  const modifiersTotal = Object.values(selectedModifiers)
    .flat()
    .reduce((sum, opt) => sum + opt.price, 0)

  const unitPrice = product.price + modifiersTotal
  const totalPrice = unitPrice * quantity

  const requiredGroups = modifierGroups.filter((g) => g.required)
  const allRequiredSelected = requiredGroups.every(
    (g) => (selectedModifiers[g.id] || []).length >= g.minSelect
  )

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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl animate-in slide-in-from-bottom-4 duration-300 sm:rounded-3xl">
        {product.imageUrl && (
          <div className="relative h-52 w-full flex-shrink-0 sm:h-60">
            <Image src={product.imageUrl} alt={product.name} fill className="rounded-t-3xl object-cover" />
            <div className="absolute inset-0 rounded-t-3xl bg-gradient-to-t from-black/50 to-transparent" />

            <button
              onClick={onClose}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm"
            >
              <X className="h-5 w-5 text-gray-700" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-5 p-5">
            {!product.imageUrl && (
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100"
                >
                  <X className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            )}

            <div>
              <h3 className="text-xl font-bold text-gray-900">{product.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{product.description}</p>

              <p className="mt-2 text-lg font-bold" style={{ color: accentColor }}>
                A partir de {formatPrice(product.price)}
              </p>
            </div>

            {modifierGroups.length > 0 && (
              <div className="space-y-5 border-t border-gray-100 pt-3">
                {modifierGroups.map((group) => (
                  <ModifierGroupComponent
                    key={group.id}
                    group={group}
                    accentColor={accentColor}
                    selected={selectedModifiers[group.id] || []}
                    onToggle={(opt) => handleModifierToggle(group, opt)}
                  />
                ))}
              </div>
            )}

            <div className="border-t border-gray-100 pt-3">
              <label className="text-sm font-bold text-gray-900">Alguma observacao?</label>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Sem cebola, molho a parte..."
                className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500/20"
                rows={2}
              />
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 rounded-b-3xl border-t border-gray-100 bg-white p-4">
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
                "flex-1 rounded-xl py-3.5 text-sm font-bold transition-all text-white",
                allRequiredSelected
                  ? "shadow-lg hover:opacity-95 active:scale-[0.98]"
                  : "cursor-not-allowed bg-gray-200 text-gray-400"
              )}
              style={
                allRequiredSelected
                  ? {
                      backgroundColor: accentColor,
                      boxShadow: `0 12px 28px -10px ${accentColor}`,
                    }
                  : undefined
              }
            >
              Adicionar {formatPrice(totalPrice)}
            </button>
          </div>

          {!allRequiredSelected && requiredGroups.length > 0 && (
            <p className="mt-2 text-center text-xs text-red-500">
              Selecione as opcoes obrigatorias
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function UpsellModal({
  suggestions,
  accentColor,
  onAdd,
  onSkip,
}: {
  suggestions: MenuProduct[]
  accentColor: string
  onAdd: (product: MenuProduct) => void
  onSkip: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onSkip} />

      <div className="relative z-10 w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 sm:rounded-3xl">
        <div className="mb-4 text-center">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: `${accentColor}14` }}
          >
            <Sparkles className="h-6 w-6" style={{ color: accentColor }} />
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
                <div className="relative h-14 w-14 overflow-hidden rounded-lg">
                  <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="56px" />
                </div>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-200">
                  <Utensils className="h-6 w-6 text-gray-400" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{product.name}</p>
                <p className="truncate text-xs text-gray-500">{product.description}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: accentColor }}>
                  {formatPrice(product.price)}
                </span>

                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: accentColor }}
                >
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

type NeighborhoodOption = {
  key: string
  neighborhood: string
  fee: number
  ruleId: string
  ruleLabel: string
}

type PixPaymentData = {
  orderId: string
  paymentId: string
  qrCodeBase64: string | null
  qrCodeUrl: string | null
  qrCode: string | null
  pixCopyPaste: string | null
  ticketUrl: string | null
  status: string | null
  publicOrderNumber: string | null
  expiresAt: string | null
}

type OrderPaymentStatusResponse = {
  success: boolean
  order?: Partial<CustomerVisibleOrder> & {
    id: string
    payment_status?: string | null
  }
  error?: string
}

type PublicCustomerProfile = {
  name: string
  phone: string
  document: string
  address?: {
    customerAddress: string
    selectedNeighborhoodKey: string
  }
}

type CustomerVisibleOrder = {
  id: string
  restaurant_id?: string | null
  public_order_number?: string | null
  status?: string | null
  payment_status?: string | null
  total?: number | string | null
  payment_method?: string | null
  order_type?: "delivery" | "pickup" | string | null
  delivery_fee?: number | string | null
  service_fee?: number | string | null
  customer_received_at?: string | null
  customer_rating?: number | null
  customer_review?: string | null
  created_at?: string | null
  items?: Array<{
    name?: string | null
    product_name?: string | null
    quantity?: number | null
    price?: number | string | null
    unit_price?: number | string | null
  }> | null
}

type OrderStep = {
  key: string
  label: string
}

const ONLINE_SERVICE_FEE = 1.5

function onlyDigits(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "")
}

function formatCpfPreview(value: string) {
  const digits = onlyDigits(value)

  if (digits.length !== 11) return value

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

function formatPhonePreview(value: string) {
  const digits = onlyDigits(value)

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  return value
}

function formatPaymentMethodLabel(method?: string | null) {
  const normalizedMethod = normalizeOrderStatus(method)

  if (["cash", "dinheiro"].includes(normalizedMethod)) return "Dinheiro"
  if (["pix"].includes(normalizedMethod)) return "Pix"

  if (
    [
      "card",
      "cartao",
      "cartao_na_entrega",
      "card_on_delivery",
      "credit_card",
      "debit_card",
    ].includes(normalizedMethod)
  ) {
    return "Cartão na entrega"
  }

  return method || "Não informado"
}

function normalizeOrderStatus(status?: string | null) {
  return (status || "pending")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
}

function normalizeCustomerOrderType(orderType?: string | null) {
  const normalizedType = (orderType || "delivery")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")

  if (
    [
      "pickup",
      "retirada",
      "retirada_no_local",
      "balcao",
      "retirar",
    ].includes(normalizedType)
  ) {
    return "pickup"
  }

  return "delivery"
}

function getOrderSteps(orderType?: string | null): OrderStep[] {
  if (orderType === "pickup") {
    return [
      { key: "pending", label: "Em análise" },
      { key: "preparing", label: "Em preparo" },
      { key: "ready", label: "Pronto" },
      { key: "completed", label: "Retirado" },
    ]
  }

  return [
    { key: "pending", label: "Em análise" },
    { key: "preparing", label: "Em preparo" },
    { key: "delivering", label: "Saiu pra entrega" },
    { key: "completed", label: "Entregue" },
  ]
}

function getOrderProgressIndex(
  status?: string | null,
  orderType?: string | null,
  customerReceivedAt?: string | null
) {
  const normalizedStatus = normalizeOrderStatus(status)
  const normalizedType = normalizeCustomerOrderType(orderType)

  if (["cancelled", "canceled", "cancelado"].includes(normalizedStatus)) {
    return -1
  }

  const isCompletedStatus = [
    "completed",
    "delivered",
    "finished",
    "done",
    "entregue",
    "finalizado",
    "retirado",
  ].includes(normalizedStatus)

  if (isCompletedStatus) {
    return customerReceivedAt ? 3 : 2
  }

  if (normalizedType === "pickup") {
    if (
      [
        "ready",
        "ready_for_pickup",
        "pronto",
        "pronto_para_retirada",
      ].includes(normalizedStatus)
    ) {
      return 2
    }

    if (
      [
        "accepted",
        "aceito",
        "preparing",
        "in_preparation",
        "in_progress",
        "em_preparo",
        "preparo",
      ].includes(normalizedStatus)
    ) {
      return 1
    }

    return 0
  }

  if (
    [
      "delivering",
      "out_for_delivery",
      "on_route",
      "em_rota",
      "saiu_para_entrega",
      "saiu_pra_entrega",
    ].includes(normalizedStatus)
  ) {
    return 2
  }

  if (
    [
      "accepted",
      "aceito",
      "preparing",
      "in_preparation",
      "in_progress",
      "em_preparo",
      "preparo",
    ].includes(normalizedStatus)
  ) {
    return 1
  }

  return 0
}

function getOrderStatusLabel(
  status?: string | null,
  orderType?: string | null,
  customerReceivedAt?: string | null
) {
  const normalizedStatus = normalizeOrderStatus(status)
  const normalizedType = normalizeCustomerOrderType(orderType)

  if (["cancelled", "canceled", "cancelado"].includes(normalizedStatus)) {
    return "Cancelado"
  }

  const isCompletedStatus = [
    "completed",
    "delivered",
    "finished",
    "done",
    "entregue",
    "finalizado",
    "retirado",
  ].includes(normalizedStatus)

  if (isCompletedStatus) {
    if (!customerReceivedAt) {
      return normalizedType === "pickup"
        ? "Aguardando retirada"
        : "Aguardando confirmação"
    }

    return normalizedType === "pickup" ? "Pedido retirado" : "Pedido entregue"
  }

  if (
    normalizedType === "pickup" &&
    [
      "ready",
      "ready_for_pickup",
      "pronto",
      "pronto_para_retirada",
    ].includes(normalizedStatus)
  ) {
    return "Pronto para retirada"
  }

  if (
    [
      "delivering",
      "out_for_delivery",
      "on_route",
      "em_rota",
      "saiu_para_entrega",
      "saiu_pra_entrega",
    ].includes(normalizedStatus)
  ) {
    return "Saiu para entrega"
  }

  if (
    [
      "accepted",
      "aceito",
      "preparing",
      "in_preparation",
      "in_progress",
      "em_preparo",
      "preparo",
    ].includes(normalizedStatus)
  ) {
    return "Em preparo"
  }

  return "Em análise"
}

function OrderTrackingCard({
  order,
  accentColor,
  restaurantWhatsApp,
  onConfirmReceived,
}: {
  order: CustomerVisibleOrder
  accentColor: string
  restaurantWhatsApp?: string | null
  onConfirmReceived: (rating: number, review: string) => void
}) {
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [rating, setRating] = useState(order.customer_rating ?? 0)
  const [review, setReview] = useState(order.customer_review ?? "")

  useEffect(() => {
    setRating(order.customer_rating ?? 0)
    setReview(order.customer_review ?? "")
  }, [order.customer_rating, order.customer_review])

  const orderType = normalizeCustomerOrderType(order.order_type)
  const steps = getOrderSteps(orderType)
  const progressIndex = getOrderProgressIndex(
  order.status,
  orderType,
  order.customer_received_at
)
  const normalizedStatus = normalizeOrderStatus(order.status)
  const isCancelled = ["cancelled", "canceled"].includes(normalizedStatus)
  const canConfirmReceived = !isCancelled && progressIndex >= 2
  const alreadyReceived = Boolean(order.customer_received_at)
  const whatsappPhone = restaurantWhatsApp?.replace(/\D/g, "") || ""

  const handleSubmitReview = () => {
    if (rating <= 0) {
      alert("Selecione uma nota para o restaurante.")
      return
    }

    onConfirmReceived(rating, review.trim())
    setShowReviewForm(false)
  }

  return (
    <div className="mx-auto mt-4 max-w-2xl px-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="overflow-hidden rounded-[26px] border border-blue-100 bg-white shadow-[0_20px_60px_-35px_rgba(37,99,235,0.55)]">
        <div className="bg-gradient-to-br from-blue-600 to-blue-500 p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-white/75">
                Acompanhe seu pedido
              </p>

              <h3 className="mt-1 text-xl font-black">
                Pedido #{order.public_order_number || order.id.slice(0, 8)}
              </h3>

              <p className="mt-1 text-sm font-medium text-white/80">
                {getOrderStatusLabel(order.status, orderType, order.customer_received_at)}
              </p>
            </div>

            <div className="rounded-2xl bg-white/15 px-3 py-2 text-right backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase text-white/70">Total</p>
              <p className="text-base font-black">{formatPrice(Number(order.total || 0))}</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {isCancelled ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              Este pedido foi cancelado pelo restaurante.
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-2">
                {steps.map((step, index) => {
                  const isDone = progressIndex >= index
                  const isCurrent = progressIndex === index

                  return (
                    <div key={step.key} className="relative flex flex-1 flex-col items-center text-center">
                      {index < steps.length - 1 && (
                        <div
                          className={cn(
                            "absolute left-1/2 top-4 h-1 w-full rounded-full",
                            progressIndex > index ? "bg-blue-500" : "bg-gray-200"
                          )}
                        />
                      )}

                      <div
                        className={cn(
                          "relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-4 border-white text-xs font-black shadow-sm",
                          isDone ? "text-white" : "bg-gray-200 text-gray-400",
                          isCurrent && "ring-4 ring-blue-100"
                        )}
                        style={isDone ? { backgroundColor: accentColor } : undefined}
                      >
                        {isDone ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
                      </div>

                      <span
                        className={cn(
                          "mt-2 text-[11px] font-bold leading-tight",
                          isDone ? "text-gray-900" : "text-gray-400"
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-gray-50 p-3">
              <p className="text-[10px] font-bold uppercase text-gray-400">Tipo</p>
              <p className="mt-1 text-sm font-black text-gray-900">
                {orderType === "delivery" ? "Entrega" : "Retirada"}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-3">
              <p className="text-[10px] font-bold uppercase text-gray-400">Pagamento</p>
              <p className="mt-1 text-sm font-black text-gray-900">
                {formatPaymentMethodLabel(order.payment_method)}
              </p>
            </div>
          </div>

          {alreadyReceived ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                <Check className="h-5 w-5" strokeWidth={3} />
              </div>

              <p className="text-sm font-black text-green-700">Recebimento confirmado</p>

              {order.customer_rating ? (
                <p className="mt-1 text-xs font-semibold text-green-700">
                  Obrigado pela avaliação de {order.customer_rating} estrela{order.customer_rating > 1 ? "s" : ""}.
                </p>
              ) : null}
            </div>
          ) : showReviewForm ? (
            <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
              <p className="text-sm font-black text-gray-900">{orderType === "pickup" ? "Você já retirou seu pedido?" : "Seu pedido chegou?"}</p>
              <p className="mt-1 text-xs text-gray-500">Confirme o recebimento e avalie sua experiência.</p>

              <div className="mt-3 flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="rounded-full p-1 transition-transform active:scale-95"
                  >
                    <Star
                      className={cn(
                        "h-7 w-7",
                        rating >= star ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                      )}
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={review}
                onChange={(event) => setReview(event.target.value)}
                placeholder="Comentário opcional"
                rows={2}
                className="mt-3 w-full resize-none rounded-xl border border-orange-100 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              />

              <button
                type="button"
                onClick={handleSubmitReview}
                className="mt-3 w-full rounded-xl py-3 text-sm font-black text-white shadow-lg"
                style={{ backgroundColor: accentColor }}
              >
                Confirmar e enviar avaliação
              </button>
            </div>
          ) : canConfirmReceived ? (
            <button
              type="button"
              onClick={() => setShowReviewForm(true)}
              className="w-full rounded-xl py-3 text-sm font-black text-white shadow-lg active:scale-[0.98]"
              style={{ backgroundColor: accentColor }}
            >
              {orderType === "pickup" ? "Já retirei meu pedido" : "Já recebi meu pedido"}
            </button>
          ) : (
            <div className="rounded-2xl bg-gray-50 p-4 text-center text-xs font-semibold text-gray-500">
              O restaurante vai atualizar o andamento por aqui.
            </div>
          )}

          {whatsappPhone ? (
            <a
              href={`https://wa.me/${whatsappPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 shadow-sm"
            >
              <MessageCircle className="h-4 w-4 text-green-500" />
              Falar com o restaurante
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CustomerStartModal({
  open,
  restaurantName,
  accentColor,
  initialCustomer,
  onSave,
}: {
  open: boolean
  restaurantName: string
  accentColor: string
  initialCustomer: PublicCustomerProfile | null
  onSave: (customer: PublicCustomerProfile) => void
}) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [document, setDocument] = useState("")

  useEffect(() => {
    if (!open) return

    setName(initialCustomer?.name ?? "")
    setPhone(initialCustomer?.phone ?? "")
    setDocument(initialCustomer?.document ?? "")
  }, [open, initialCustomer])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedName = name.trim()
    const normalizedPhone = onlyDigits(phone)
    const normalizedDocument = onlyDigits(document)

    if (!normalizedName) {
      alert("Informe seu nome.")
      return
    }

    if (normalizedPhone.length < 10) {
      alert("Informe um telefone válido.")
      return
    }

    if (normalizedDocument.length !== 11) {
      alert("Informe um CPF válido.")
      return
    }

    onSave({
      name: normalizedName,
      phone: normalizedPhone,
      document: normalizedDocument,
      address: initialCustomer?.address,
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
      <div className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="mb-5 text-center">
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{ backgroundColor: accentColor }}
          >
            <UserRound className="h-7 w-7" />
          </div>

          <h2 className="text-xl font-black text-gray-900">Entre no cardápio</h2>

          <p className="mt-1 text-sm text-gray-500">
            Identifique-se uma vez para comprar mais rápido em {restaurantName}.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase text-gray-500">
              Nome *
            </label>

            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Seu nome"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500/20"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-gray-500">
              Telefone / WhatsApp *
            </label>

            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(00) 00000-0000"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500/20"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-gray-500">
              CPF *
            </label>

            <input
              type="text"
              value={document}
              onChange={(event) => setDocument(event.target.value)}
              placeholder="000.000.000-00"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500/20"
            />

            <p className="mt-1 text-xs text-gray-400">
              Necessário para pagamento Pix online.
            </p>
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-xl py-3.5 text-sm font-black text-white shadow-lg hover:opacity-95 active:scale-[0.98]"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 14px 28px -12px ${accentColor}`,
            }}
          >
            Entrar no cardápio
          </button>
        </form>
      </div>
    </div>
  )
}

function CartSheet({
  items,
  open,
  onClose,
  onUpdateQuantity,
  onRemove,
  onClearCart,
  restaurant,
  accentColor,
  deliveryEnabled,
  pickupEnabled,
  tableNumber,
  customer,
  onEditCustomer,
  onSaveAddress,
  onOrderCreated,
}: {
  items: CartItem[]
  open: boolean
  onClose: () => void
  onUpdateQuantity: (cartItemId: string, delta: number) => void
  onRemove: (cartItemId: string) => void
  onClearCart: () => void
  restaurant: PublicRestaurant
  accentColor: string
  deliveryEnabled: boolean
  pickupEnabled: boolean
  tableNumber?: string | null
  customer: PublicCustomerProfile | null
  onEditCustomer: () => void
  onSaveAddress: (address: PublicCustomerProfile["address"]) => void
  onOrderCreated: (order: CustomerVisibleOrder) => void
}) {
  const [step, setStep] = useState<"cart" | "checkout">("cart")
  const [orderType, setOrderType] = useState<"delivery" | "pickup">(
    deliveryEnabled ? "delivery" : "pickup"
  )
  const [customerAddress, setCustomerAddress] = useState("")
  const [selectedNeighborhoodKey, setSelectedNeighborhoodKey] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [couponCode, setCouponCode] = useState("")
  const [couponApplied, setCouponApplied] = useState(false)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pixPayment, setPixPayment] = useState<PixPaymentData | null>(null)
  const [pixCopied, setPixCopied] = useState(false)
  const [paymentApproved, setPaymentApproved] = useState(false)
  const [paymentCheckError, setPaymentCheckError] = useState("")

  const deliveryRules = useMemo(() => getActiveDeliveryRules(restaurant), [restaurant])

  const neighborhoodOptions = useMemo<NeighborhoodOption[]>(() => {
    return deliveryRules.flatMap((rule) =>
      rule.neighborhoods.map((neighborhood) => ({
        key: `${rule.id}:${normalizeNeighborhood(neighborhood)}`,
        neighborhood,
        fee: Number(rule.fee || 0),
        ruleId: rule.id,
        ruleLabel: rule.label,
      }))
    )
  }, [deliveryRules])

  const selectedNeighborhoodOption = useMemo(
    () =>
      neighborhoodOptions.find((option) => option.key === selectedNeighborhoodKey) ?? null,
    [neighborhoodOptions, selectedNeighborhoodKey]
  )

  const hasNeighborhoodRules = neighborhoodOptions.length > 0

  useEffect(() => {
    if (!deliveryEnabled && orderType === "delivery") {
      setOrderType("pickup")
    }

    if (!pickupEnabled && orderType === "pickup") {
      setOrderType("delivery")
    }
  }, [deliveryEnabled, pickupEnabled, orderType])

  useEffect(() => {
    if (orderType !== "delivery") {
      setSelectedNeighborhoodKey("")
      return
    }

    if (!hasNeighborhoodRules) return

    const optionStillExists = neighborhoodOptions.some(
      (option) => option.key === selectedNeighborhoodKey
    )

    if (!optionStillExists) {
      setSelectedNeighborhoodKey(neighborhoodOptions[0]?.key ?? "")
    }
  }, [hasNeighborhoodRules, neighborhoodOptions, orderType, selectedNeighborhoodKey])

  useEffect(() => {
    if (!open) {
      setStep("cart")
      setPixPayment(null)
      setPixCopied(false)
      setPaymentApproved(false)
      setPaymentCheckError("")
      setIsProcessing(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || !customer?.address) return

    setCustomerAddress(customer.address.customerAddress ?? "")
    setSelectedNeighborhoodKey(customer.address.selectedNeighborhoodKey ?? "")
  }, [open, customer?.address])

  useEffect(() => {
    if (!isPixPaymentResetSafe(paymentMethod)) {
      setPixPayment(null)
      setPixCopied(false)
      setPaymentApproved(false)
      setPaymentCheckError("")
    }
  }, [paymentMethod])

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const serviceFee = items.length > 0 ? ONLINE_SERVICE_FEE : 0
  const deliveryFee =
    orderType === "delivery"
      ? hasNeighborhoodRules
        ? selectedNeighborhoodOption?.fee ?? 0
        : restaurant.deliveryFee
      : 0

  const total = subtotal + serviceFee + deliveryFee - couponDiscount
  const normalizedPaymentMethod = paymentMethod.trim().toLowerCase()
  const isPixPayment = normalizedPaymentMethod === "pix"
  const sanitizedCustomerDocument = onlyDigits(customer?.document)

  const primaryButtonLabel = isPixPayment
    ? paymentApproved
      ? "Concluir pedido"
      : pixPayment
        ? "Aguardando pagamento"
        : "Gerar Pix"
    : "Confirmar pedido"

  const formattedCustomerAddress =
    orderType !== "delivery"
      ? ""
      : selectedNeighborhoodOption
        ? `${customerAddress.trim()} - Bairro: ${selectedNeighborhoodOption.neighborhood}`
        : customerAddress.trim()

  function isPixPaymentResetSafe(currentPaymentMethod: string) {
    return currentPaymentMethod.trim().toLowerCase() === "pix"
  }

  const validateForm = () => {
    if (!customer?.name?.trim()) {
      alert("Cadastre seu nome antes de finalizar.")
      onEditCustomer()
      return false
    }

    if (!customer?.phone?.trim()) {
      alert("Cadastre seu telefone antes de finalizar.")
      onEditCustomer()
      return false
    }

    if (sanitizedCustomerDocument.length !== 11) {
      alert("Atualize seu CPF antes de finalizar.")
      onEditCustomer()
      return false
    }

    if (orderType === "delivery" && hasNeighborhoodRules && !selectedNeighborhoodOption) {
      alert("Selecione o bairro de entrega")
      return false
    }

    if (orderType === "delivery" && !customerAddress.trim()) {
      alert("Informe rua, número e complemento")
      return false
    }

    return true
  }

  const handleCopyPixCode = async () => {
    const code = pixPayment?.pixCopyPaste || pixPayment?.qrCode || ""

    if (!code) {
      alert("Nao foi encontrado o codigo Pix para copiar.")
      return
    }

    try {
      await navigator.clipboard.writeText(code)
      setPixCopied(true)
      setTimeout(() => setPixCopied(false), 2000)
    } catch {
      alert("Nao foi possivel copiar o codigo Pix.")
    }
  }

  const finishPaidOrder = () => {
    if (pixPayment?.orderId) {
      onOrderCreated({
        id: pixPayment.orderId,
        public_order_number: pixPayment.publicOrderNumber,
        status: "pending",
        payment_status: "paid",
        total,
        payment_method: "Pix",
        order_type: orderType,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        created_at: new Date().toISOString(),
        items: items.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        })),
      })
    }

    onClearCart()
    onClose()
    setStep("cart")
    setPixPayment(null)
    setPixCopied(false)
    setPaymentApproved(false)
    setPaymentCheckError("")
  }

  const checkPixPaymentStatus = useCallback(async () => {
    if (!pixPayment?.orderId) return

    try {
      const params = new URLSearchParams({
        orderId: pixPayment.orderId,
        restaurantId: restaurant.id,
      })

      const response = await fetch(`/api/public/orders/status?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      })

      const data = (await response.json()) as OrderPaymentStatusResponse

      if (!response.ok) {
        throw new Error(data?.error || "Erro ao consultar pagamento.")
      }

      if (data.order?.payment_status === "paid") {
        setPaymentApproved(true)
        setPaymentCheckError("")
        setPixPayment((prev) => (prev ? { ...prev, status: "paid" } : prev))
      }
    } catch (error) {
      setPaymentCheckError(
        error instanceof Error
          ? error.message
          : "Erro ao consultar status do pagamento."
      )
    }
  }, [pixPayment?.orderId, restaurant.id])

  useEffect(() => {
    if (!open || !isPixPayment || !pixPayment?.orderId || paymentApproved) return

    void checkPixPaymentStatus()

    const intervalId = window.setInterval(() => {
      void checkPixPaymentStatus()
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [
    open,
    isPixPayment,
    pixPayment?.orderId,
    paymentApproved,
    checkPixPaymentStatus,
  ])

  const createPublicOrder = async (paymentMethodLabel: string) => {
    if (!customer) {
      throw new Error("Cliente não identificado.")
    }

    if (orderType === "delivery") {
      onSaveAddress({
        customerAddress: customerAddress.trim(),
        selectedNeighborhoodKey,
      })
    }

    const response = await fetch("/api/public/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: restaurant.id,
        tableId: tableNumber || null,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerAddress: orderType === "delivery" ? formattedCustomerAddress : undefined,
        neighborhood:
          orderType === "delivery" ? selectedNeighborhoodOption?.neighborhood ?? undefined : undefined,
        orderType,
        paymentMethod: paymentMethodLabel,
        deliveryFee,
        serviceFee,
        couponCode: couponCode || null,
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          notes: item.notes,
          modifiers: item.modifiers,
        })),
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Erro ao criar pedido.")
    }

    return data.order as {
      id: string
      public_order_number: string
      status?: string | null
      payment_status?: string | null
      total?: number | string | null
      payment_method?: string | null
      order_type?: string | null
      delivery_fee?: number | string | null
      service_fee?: number | string | null
      created_at?: string | null
    }
  }

  const processOnlinePayment = async () => {
    if (!validateForm()) return
    if (pixPayment) return

    setPaymentApproved(false)
    setPaymentCheckError("")
    setIsProcessing(true)

    try {
      const createdOrder = await createPublicOrder("Pix")

      const response = await fetch("/api/asaas/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couponCode: couponCode || null,
          restaurantId: restaurant.id,
          orderId: createdOrder.id,
          publicOrderNumber: createdOrder.public_order_number,
          customerName: customer?.name ?? "",
          customerPhone: customer?.phone ?? "",
          customerDocument: sanitizedCustomerDocument,
          customerAddress: orderType === "delivery" ? formattedCustomerAddress : undefined,
          customerNeighborhood:
            orderType === "delivery"
              ? selectedNeighborhoodOption?.neighborhood ?? null
              : null,
          orderType,
          deliveryFee,
          serviceFee,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Erro ao processar pagamento Pix.")
      }

      const hasPixData = Boolean(
        data?.qrCodeBase64 || data?.qrCodeUrl || data?.pixCopyPaste || data?.qrCode
      )

      if (!hasPixData) {
        throw new Error(
          data?.error || "Pagamento Pix nao retornou os dados esperados."
        )
      }

      setPixPayment({
        orderId: createdOrder.id,
        paymentId: String(data?.paymentId ?? createdOrder.id),
        qrCodeBase64: data?.qrCodeBase64 ?? null,
        qrCodeUrl: data?.qrCodeUrl ?? null,
        qrCode: data?.qrCode ?? null,
        pixCopyPaste: data?.pixCopyPaste ?? data?.qrCode ?? null,
        ticketUrl: data?.ticketUrl ?? null,
        status: data?.status ?? null,
        publicOrderNumber:
          data?.publicOrderNumber ?? createdOrder.public_order_number ?? null,
        expiresAt: data?.expiresAt ?? null,
      })
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao processar pagamento")
    } finally {
      setIsProcessing(false)
    }
  }

  const createManualPaymentOrder = async () => {
    if (!validateForm()) return

    if (!paymentMethod) {
      alert("Selecione a forma de pagamento")
      return
    }

    setIsProcessing(true)

    try {
      const createdOrder = await createPublicOrder(paymentMethod)

      onOrderCreated({
        id: createdOrder.id,
        public_order_number: createdOrder.public_order_number,
        status: createdOrder.status ?? "pending",
        payment_status: createdOrder.payment_status ?? "pending",
        total: createdOrder.total ?? total,
        payment_method: createdOrder.payment_method ?? paymentMethod,
        order_type: createdOrder.order_type ?? orderType,
        delivery_fee: createdOrder.delivery_fee ?? deliveryFee,
        service_fee: createdOrder.service_fee ?? serviceFee,
        created_at: createdOrder.created_at ?? new Date().toISOString(),
        items: items.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        })),
      })

      onClearCart()
      onClose()
      setStep("cart")
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao criar pedido")
    } finally {
      setIsProcessing(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl animate-in slide-in-from-bottom-4 duration-300 sm:rounded-3xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3">
            {step === "checkout" && (
              <button
                onClick={() => setStep("cart")}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100"
              >
                <ArrowLeft className="h-4 w-4 text-gray-600" />
              </button>
            )}

            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: accentColor }}
            >
              <ShoppingBag className="h-4 w-4" />
            </div>

            <h3 className="text-lg font-bold text-gray-900">
              {step === "cart" ? "Seu Pedido" : "Finalizar"}
            </h3>

            {step === "cart" && items.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                {items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {step === "cart" ? (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShoppingBag className="mb-3 h-12 w-12 text-gray-200" />
                  <p className="text-sm font-medium text-gray-400">Carrinho vazio</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="rounded-xl bg-gray-50 p-3">
                    <div className="flex items-start gap-3">
                      {item.product.imageUrl ? (
                        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
                          <Image
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-gray-200">
                          <Utensils className="h-5 w-5 text-gray-400" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {item.product.name}
                        </p>

                        {item.modifiers.length > 0 && (
                          <p className="text-[11px] text-gray-500">
                            {item.modifiers.map((m) => m.option.name).join(", ")}
                          </p>
                        )}

                        <p className="mt-1 text-sm font-bold" style={{ color: accentColor }}>
                          {formatPrice(item.unitPrice * item.quantity)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-end gap-1 border-t border-gray-200/50 pt-2">
                      <button
                        onClick={() =>
                          item.quantity <= 1 ? onRemove(item.id) : onUpdateQuantity(item.id, -1)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white"
                      >
                        {item.quantity <= 1 ? (
                          <X className="h-3.5 w-3.5 text-red-500" />
                        ) : (
                          <Minus className="h-3.5 w-3.5 text-gray-500" />
                        )}
                      </button>

                      <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>

                      <button
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: accentColor }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="flex-shrink-0 border-t border-gray-100 bg-white px-5 py-4">
                <div className="mb-3 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>

                  <div className="flex justify-between text-gray-500">
                    <span>Taxa de serviço online</span>
                    <span>{formatPrice(serviceFee)}</span>
                  </div>
                </div>

                <button
                  onClick={() => setStep("checkout")}
                  className="flex w-full items-center justify-between rounded-xl px-5 py-4 text-white shadow-lg hover:opacity-95 active:scale-[0.98]"
                  style={{
                    backgroundColor: accentColor,
                    boxShadow: `0 14px 30px -10px ${accentColor}`,
                  }}
                >
                  <span className="text-sm font-bold">Continuar</span>
                  <span className="text-sm font-bold">{formatPrice(subtotal + serviceFee)}</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <label className="text-xs font-semibold uppercase text-gray-500">
                  Cupom de desconto
                </label>

                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Digite seu cupom"
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                  />

                  <button
                    onClick={() => {
                      if (!couponCode.trim()) return

                      if (couponCode.toUpperCase() === "DESCONTO10") {
                        setCouponDiscount(subtotal * 0.1)
                        setCouponApplied(true)
                      } else {
                        alert("Cupom inválido")
                      }
                    }}
                    className="rounded-xl px-4 text-sm font-bold text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    Aplicar
                  </button>
                </div>

                {couponApplied && (
                  <p className="mt-1 text-xs text-green-600">Cupom aplicado com sucesso</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-gray-500">
                  Tipo de pedido
                </label>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    ...(deliveryEnabled
                      ? [{ id: "delivery", label: "Entrega", icon: Truck }]
                      : []),
                    ...(pickupEnabled
                      ? [{ id: "pickup", label: "Retirada", icon: Store }]
                      : []),
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setOrderType(type.id as "delivery" | "pickup")}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all",
                        orderType === type.id
                          ? "text-white shadow-md"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                      style={orderType === type.id ? { backgroundColor: accentColor } : undefined}
                    >
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-blue-600">
                      Cliente identificado
                    </p>

                    <h4 className="mt-1 text-base font-black text-gray-900">
                      {customer?.name ?? "Cliente"}
                    </h4>

                    <p className="mt-1 text-sm text-gray-600">
                      {formatPhonePreview(customer?.phone ?? "")}
                    </p>

                    <p className="text-xs text-gray-500">
                      CPF: {formatCpfPreview(customer?.document ?? "")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={onEditCustomer}
                    className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 shadow-sm"
                  >
                    Alterar
                  </button>
                </div>
              </div>

              {orderType === "delivery" && (
                <div className="space-y-3">
                  {hasNeighborhoodRules && (
                    <div>
                      <label className="text-xs font-semibold uppercase text-gray-500">Bairro *</label>

                      <select
                        value={selectedNeighborhoodKey}
                        onChange={(e) => setSelectedNeighborhoodKey(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500/20"
                      >
                        <option value="">Selecione seu bairro</option>

                        {neighborhoodOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.neighborhood} • {formatPrice(option.fee)}
                          </option>
                        ))}
                      </select>

                      {selectedNeighborhoodOption && (
                        <p className="mt-2 text-xs text-gray-500">
                          Taxa aplicada:{" "}
                          <span className="font-semibold text-gray-900">
                            {formatPrice(selectedNeighborhoodOption.fee)}
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-500">
                      {hasNeighborhoodRules ? "Rua, numero e complemento *" : "Endereco *"}
                    </label>

                    <textarea
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder={
                        hasNeighborhoodRules
                          ? "Rua, numero, complemento e referencia"
                          : "Rua, numero, bairro..."
                      }
                      rows={2}
                      className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500/20"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase text-gray-500">
                  Forma de pagamento
                </label>

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
                        paymentMethod === method.label ? "ring-2" : "bg-gray-50 hover:bg-gray-100"
                      )}
                      style={
                        paymentMethod === method.label
                          ? {
                              backgroundColor: `${accentColor}12`,
                              boxShadow: `0 0 0 2px ${accentColor}`,
                            }
                          : undefined
                      }
                    >
                      <method.icon
                        className={cn(
                          "h-5 w-5",
                          paymentMethod === method.label ? "text-gray-900" : "text-gray-400"
                        )}
                      />

                      <span
                        className={cn(
                          "text-sm",
                          paymentMethod === method.label ? "font-semibold" : "text-gray-700"
                        )}
                      >
                        {method.label}
                      </span>

                      {paymentMethod === method.label && (
                        <Check className="ml-auto h-4 w-4" style={{ color: accentColor }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {isPixPayment && pixPayment && (
                <div
                  className={cn(
                    "rounded-2xl border p-4",
                    paymentApproved
                      ? "border-green-200 bg-green-50"
                      : "border-emerald-200 bg-emerald-50"
                  )}
                >
                  {paymentApproved ? (
                    <div className="text-center">
                      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white">
                        <Check className="h-7 w-7" strokeWidth={3} />
                      </div>

                      <p className="text-base font-black text-green-700">
                        Pagamento aprovado!
                      </p>

                      <p className="mt-1 text-sm text-green-700">
                        Recebemos seu Pix com sucesso. Seu pedido foi enviado para o restaurante.
                      </p>

                      {pixPayment.publicOrderNumber && (
                        <p className="mt-2 text-xs font-semibold text-gray-600">
                          Pedido #{pixPayment.publicOrderNumber}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="mb-3">
                        <p className="text-sm font-bold text-emerald-700">
                          Pix gerado com sucesso
                        </p>

                        <p className="text-xs text-emerald-600">
                          Escaneie o QR Code ou copie o codigo abaixo para pagar.
                        </p>

                        {pixPayment.publicOrderNumber && (
                          <p className="mt-1 text-xs font-medium text-gray-600">
                            Pedido #{pixPayment.publicOrderNumber}
                          </p>
                        )}
                      </div>

                      {(pixPayment.qrCodeUrl || pixPayment.qrCodeBase64) && (
                        <div className="mb-4 flex justify-center">
                          <div className="rounded-2xl bg-white p-3 shadow-sm">
                            <img
                              src={
                                pixPayment.qrCodeUrl ||
                                `data:image/png;base64,${pixPayment.qrCodeBase64}`
                              }
                              alt="QR Code Pix"
                              className="h-48 w-48"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold uppercase text-gray-500">
                          Pix copia e cola
                        </label>

                        <textarea
                          readOnly
                          value={pixPayment.pixCopyPaste || pixPayment.qrCode || ""}
                          rows={4}
                          className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-700 focus:outline-none"
                        />
                      </div>

                      <div className="mt-3 grid gap-2">
                        <button
                          onClick={handleCopyPixCode}
                          className="rounded-xl py-3 text-sm font-bold text-white"
                          style={{ backgroundColor: accentColor }}
                        >
                          {pixCopied ? "Codigo copiado" : "Copiar codigo Pix"}
                        </button>

                        {pixPayment.ticketUrl && (
                          <a
                            href={pixPayment.ticketUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl border border-gray-200 bg-white py-3 text-center text-sm font-semibold text-gray-700"
                          >
                            Abrir link do pagamento
                          </a>
                        )}

                        <div className="flex items-center justify-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold text-emerald-700">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Aguardando confirmacao automatica do pagamento...
                        </div>

                        {paymentCheckError && (
                          <p className="text-center text-xs text-red-600">
                            {paymentCheckError}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex-shrink-0 space-y-3 border-t border-gray-100 bg-white px-5 py-4">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>

                <div className="flex justify-between text-gray-500">
                  <span>Taxa de serviço online</span>
                  <span>{formatPrice(serviceFee)}</span>
                </div>

                {couponDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Desconto</span>
                    <span>-{formatPrice(couponDiscount)}</span>
                  </div>
                )}

                {orderType === "delivery" && selectedNeighborhoodOption && (
                  <div className="flex justify-between text-gray-500">
                    <span>Bairro</span>
                    <span>{selectedNeighborhoodOption.neighborhood}</span>
                  </div>
                )}

                {orderType === "delivery" && (
                  <div className="flex justify-between text-gray-500">
                    <span>Entrega</span>
                    <span>{formatPrice(deliveryFee)}</span>
                  </div>
                )}

                <div className="flex justify-between border-t border-gray-100 pt-1 text-base font-bold text-gray-900">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  if (isPixPayment) {
                    if (paymentApproved) {
                      finishPaidOrder()
                      return
                    }

                    void processOnlinePayment()
                    return
                  }

                  void createManualPaymentOrder()
                }}
                disabled={isProcessing || (isPixPayment && !!pixPayment && !paymentApproved)}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white shadow-lg hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
                style={{
                  backgroundColor: accentColor,
                  boxShadow: `0 14px 28px -12px ${accentColor}`,
                }}
              >
                {isProcessing && isPixPayment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : paymentApproved ? (
                  <Check className="h-4 w-4" />
                ) : isPixPayment ? (
                  <CreditCard className="h-4 w-4" />
                ) : (
                  <Check className="h-4 w-4" />
                )}

                {isProcessing && isPixPayment ? "Processando..." : primaryButtonLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function FloatingCartButton({
  count,
  total,
  bgColor,
  textColor,
  numberColor,
  onClick,
}: {
  count: number
  total: number
  bgColor: string
  textColor: string
  numberColor: string
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
        "fixed bottom-20 left-4 right-4 z-40 mx-auto flex max-w-lg items-center justify-between rounded-2xl px-5 py-4",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0",
        "animate-in slide-in-from-bottom-6 duration-500",
        bounce && "animate-bounce"
      )}
      style={{ backgroundColor: bgColor, boxShadow: `0 16px 34px -12px ${bgColor}` }}
    >
      <div className="flex items-center gap-3" style={{ color: textColor }}>
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
          <ShoppingBag className="h-4 w-4" />

          <span
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold"
            style={{ color: numberColor }}
          >
            {count}
          </span>
        </div>

        <div className="flex flex-col items-start">
          <span className="text-[10px] font-medium opacity-80">Ver carrinho</span>
          <span className="text-sm font-bold" style={{ color: numberColor }}>
            {count} {count === 1 ? "item" : "itens"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2" style={{ color: textColor }}>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-medium opacity-80">Total</span>
          <span className="text-base font-bold" style={{ color: numberColor }}>
            {formatPrice(total)}
          </span>
        </div>

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
          <ChevronUp className="h-5 w-5" />
        </div>
      </div>
    </button>
  )
}

function WhatsAppFloatingButton({ whatsapp }: { whatsapp?: string | null }) {
  if (!whatsapp) return null

  const phone = whatsapp.replace(/\D/g, "")

  if (!phone) return null

  return (
    <a
      href={`https://wa.me/${phone}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group fixed bottom-6 right-4 z-40"
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-green-500/40" />

      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-green-500 shadow-lg">
        <MessageCircle className="h-6 w-6 text-white" />
      </span>
    </a>
  )
}

export default function CardapioPublicoPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const tableNumber = searchParams.get("mesa")
  const [logoFailedToLoad, setLogoFailedToLoad] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const [mounted, setMounted] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<{
    product: MenuProduct
    categoryId: string
  } | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [upsellProducts, setUpsellProducts] = useState<MenuProduct[] | null>(null)
  const [activeOrder, setActiveOrder] = useState<CustomerVisibleOrder | null>(null)
  const [restaurant, setRestaurant] = useState<PublicRestaurant | null>(null)
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [isLoadingMenu, setIsLoadingMenu] = useState(true)
  const [publicCustomer, setPublicCustomer] = useState<PublicCustomerProfile | null>(null)
  const [customerModalOpen, setCustomerModalOpen] = useState(false)

  const categoryRefs = useRef<Record<string, HTMLElement | null>>({})
  const categoryNavRef = useRef<HTMLDivElement>(null)

  const activeOrderId = activeOrder?.id ?? ""
  const activeOrderPublicNumber = activeOrder?.public_order_number ?? ""

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    async function loadPublicMenu() {
      try {
        setIsLoadingMenu(true)

        const response = await fetch(`/api/public/menu/${slug}`, {
          method: "GET",
          cache: "no-store",
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Erro ao carregar cardápio público.")
        }

        setRestaurant((result.restaurant ?? null) as PublicRestaurant | null)
        setCategories((result.categories ?? []) as MenuCategory[])
      } catch (error) {
        console.error("Erro ao carregar cardápio público:", error)
        setRestaurant(null)
        setCategories([])
      } finally {
        setIsLoadingMenu(false)
      }
    }

    loadPublicMenu()
  }, [slug])

  useEffect(() => {
    if (!mounted || !restaurant?.id) return

    const storageKey = `clickfood_customer_${restaurant.id}`
    const savedCustomer = window.localStorage.getItem(storageKey)

    if (!savedCustomer) {
      setCustomerModalOpen(true)
      return
    }

    try {
      const parsedCustomer = JSON.parse(savedCustomer) as PublicCustomerProfile

      if (
        parsedCustomer?.name &&
        parsedCustomer?.phone &&
        onlyDigits(parsedCustomer.document).length === 11
      ) {
        setPublicCustomer(parsedCustomer)
        setCustomerModalOpen(false)
        return
      }

      setCustomerModalOpen(true)
    } catch {
      setCustomerModalOpen(true)
    }
  }, [mounted, restaurant?.id])

  useEffect(() => {
    if (!mounted || !restaurant?.id || tableNumber) return

    const storageKey = `clickfood_active_order_${restaurant.id}`
    const savedOrder = window.localStorage.getItem(storageKey)

    if (!savedOrder) return

    try {
      const parsedOrder = JSON.parse(savedOrder) as CustomerVisibleOrder

      if (parsedOrder?.id) {
        setActiveOrder(parsedOrder)
      }
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }, [mounted, restaurant?.id, tableNumber])

  useEffect(() => {
    async function fetchComanda() {
      if (!restaurant?.id || !tableNumber) return

      const { data } = await supabase
        .from("orders")
        .select("*, items:order_items(*)")
        .eq("restaurant_id", restaurant.id)
        .eq("table_id", tableNumber)
        .in("status", ["preparing", "delivering", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (data) {
        setActiveOrder(data as CustomerVisibleOrder)
      }
    }

    fetchComanda()
  }, [restaurant?.id, tableNumber, supabase])

  useEffect(() => {
    if (!restaurant?.id || (!activeOrderId && !activeOrderPublicNumber)) return
    if (activeOrder?.customer_received_at) return

    let cancelled = false

    const refreshActiveOrder = async () => {
      try {
        if (typeof navigator !== "undefined" && !navigator.onLine) return

        const params = new URLSearchParams({
          restaurantId: restaurant.id,
          _: String(Date.now()),
        })

        if (activeOrderId) {
          params.set("orderId", activeOrderId)
        } else if (activeOrderPublicNumber) {
          params.set("publicOrderNumber", activeOrderPublicNumber)
        }

        const response = await fetch(`/api/public/orders/status?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        })

        if (!response.ok) return

        const data = (await response.json()) as OrderPaymentStatusResponse

        if (cancelled || !data.order) return

        setActiveOrder((currentOrder) => {
          if (!currentOrder) return currentOrder

          const nextOrder: CustomerVisibleOrder = {
            ...currentOrder,
            ...(data.order as CustomerVisibleOrder),
            customer_received_at:
              data.order?.customer_received_at ?? currentOrder.customer_received_at ?? null,
            customer_rating:
              data.order?.customer_rating ?? currentOrder.customer_rating ?? null,
            customer_review:
              data.order?.customer_review ?? currentOrder.customer_review ?? null,
            items: currentOrder.items ?? null,
          }

          if (restaurant?.id && !tableNumber && !nextOrder.customer_received_at) {
            window.localStorage.setItem(
              `clickfood_active_order_${restaurant.id}`,
              JSON.stringify(nextOrder)
            )
          }

          return nextOrder
        })
      } catch (error) {
        if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
          return
        }

        console.error("Erro ao atualizar acompanhamento do pedido:", error)
      }
    }

    void refreshActiveOrder()

    const intervalId = window.setInterval(() => {
      void refreshActiveOrder()
    }, 2500)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [
    restaurant?.id,
    activeOrderId,
    activeOrderPublicNumber,
    tableNumber,
    activeOrder?.customer_received_at,
  ])

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id)
    }
  }, [categories, activeCategory])

  useEffect(() => {
    if (!mounted) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.id)

            const tab = document.getElementById(`tab-${entry.target.id}`)

            if (tab && categoryNavRef.current) {
              tab.scrollIntoView({
                behavior: "smooth",
                inline: "center",
                block: "nearest",
              })
            }
          }
        }
      },
      { rootMargin: "-180px 0px -60% 0px", threshold: 0 }
    )

    Object.values(categoryRefs.current).forEach((el) => {
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [mounted, categories])

  const addToCart = useCallback((item: Omit<CartItem, "id">) => {
    setCart((prev) => [...prev, { ...item, id: `cart-${Date.now()}-${Math.random()}` }])
  }, [])

  const handleAddWithUpsell = useCallback(
    (item: Omit<CartItem, "id">, categoryId: string) => {
      addToCart(item)

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
    },
    [categories, addToCart]
  )

  const updateCartQuantity = useCallback((cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.id === cartItemId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
      )
    )
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
        products: cat.products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q)
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

  if (!mounted || isLoadingMenu) return <MenuSkeleton />

  if (!restaurant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="p-8 text-center">
          <Store className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <h1 className="text-xl font-bold text-gray-900">Restaurante nao encontrado</h1>
          <p className="mt-2 text-gray-500">Verifique o endereco e tente novamente</p>
        </div>
      </div>
    )
  }

 const CLICKFOOD_BLUE = "#2563eb"
const CLICKFOOD_ORANGE = "#f97316"

const themeColor = CLICKFOOD_BLUE
const accentColor = CLICKFOOD_ORANGE
const isDarkMode = false
const minimumOrder = restaurant.minimumOrder ?? 0
const estimatedDeliveryTime = formatPrepTimeLabel(restaurant)
const deliveryEnabled = restaurant.deliveryEnabled ?? true
const pickupEnabled = restaurant.pickupEnabled ?? true
const startingDeliveryFee = getStartingDeliveryFee(restaurant)
const floatingCartBgColor = accentColor
const floatingCartTextColor = "#ffffff"
const floatingCartNumberColor = "#ffffff"
const restaurantIsOpen = isOpenNow(restaurant)

const ratingAverage = Number(restaurant.ratingAverage ?? 0)
const ratingCount = Number(restaurant.ratingCount ?? 0)
const hasRating = ratingCount > 0 && ratingAverage > 0

const savePublicCustomer = (customer: PublicCustomerProfile) => {
  if (!restaurant?.id) return

  const storageKey = `clickfood_customer_${restaurant.id}`

  window.localStorage.setItem(storageKey, JSON.stringify(customer))
  setPublicCustomer(customer)
  setCustomerModalOpen(false)
}

const savePublicCustomerAddress = (address: PublicCustomerProfile["address"]) => {
  if (!restaurant?.id || !publicCustomer) return

  const nextCustomer: PublicCustomerProfile = {
    ...publicCustomer,
    address,
  }

  const storageKey = `clickfood_customer_${restaurant.id}`

  window.localStorage.setItem(storageKey, JSON.stringify(nextCustomer))
  setPublicCustomer(nextCustomer)
}

const saveActiveOrder = (order: CustomerVisibleOrder) => {
  if (!restaurant?.id) return

  const nextOrder: CustomerVisibleOrder = {
    ...order,
    restaurant_id: order.restaurant_id ?? restaurant.id,
  }

  if (!tableNumber) {
    window.localStorage.setItem(
      `clickfood_active_order_${restaurant.id}`,
      JSON.stringify(nextOrder)
    )
  }

  setActiveOrder(nextOrder)
}

const confirmActiveOrderReceived = async (rating: number, review: string) => {
  if (!restaurant?.id || !activeOrder) return

  const receivedAt = new Date().toISOString()

  const optimisticOrder: CustomerVisibleOrder = {
    ...activeOrder,
    customer_received_at: receivedAt,
    customer_rating: rating,
    customer_review: review,
  }

  if (!tableNumber) {
    window.localStorage.removeItem(`clickfood_active_order_${restaurant.id}`)
  }

  setActiveOrder(optimisticOrder)

  try {
    const response = await fetch("/api/public/orders/confirm-received", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        restaurantId: restaurant.id,
        orderId: activeOrder.id,
        rating,
        review,
      }),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Erro ao salvar avaliação.")
    }

    if (data.order) {
      setActiveOrder((currentOrder) =>
        currentOrder
          ? {
              ...currentOrder,
              ...data.order,
              items: currentOrder.items ?? null,
            }
          : currentOrder
      )
    }
  } catch (error) {
    alert(
      error instanceof Error
        ? error.message
        : "Não foi possível salvar sua avaliação."
    )
  }
}

  return (
    <div className={cn("min-h-screen pb-32", isDarkMode ? "bg-neutral-950" : "bg-gray-50")}>
      <div className="mx-auto max-w-2xl px-4 pt-4">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div
            className={cn(
              "overflow-hidden rounded-[28px] border shadow-2xl",
              isDarkMode ? "border-white/10 bg-neutral-900" : "border-gray-200 bg-white"
            )}
            style={{ boxShadow: "0 30px 80px -35px rgba(0,0,0,0.45)" }}
          >
            <div className="relative h-[220px] md:h-[260px]">
              {restaurant.coverImageUrl ? (
                <Image
                  src={restaurant.coverImageUrl}
                  alt={`Capa de ${restaurant.name}`}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 45%, #111827 100%)`,
                  }}
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15" />

              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at top right, rgba(255,255,255,0.22), transparent 30%)",
                }}
              />

              <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/10">
                  <span className="relative flex h-2 w-2">
                    <span
                      className={cn(
                        "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                        restaurantIsOpen ? "bg-green-400" : "bg-red-400"
                      )}
                    />
                    <span
                      className={cn(
                        "relative inline-flex h-2 w-2 rounded-full",
                        restaurantIsOpen ? "bg-green-400" : "bg-red-400"
                      )}
                    />
                  </span>

                  {restaurantIsOpen ? "Aberto" : "Fechado"}
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/10">
                  <Timer className="h-3.5 w-3.5" />
                  {estimatedDeliveryTime}
                </span>

                {hasRating && (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/10">
    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
    {ratingAverage.toFixed(1)} ({ratingCount} {ratingCount === 1 ? "avaliação" : "avaliações"})
  </span>
)}

                {deliveryEnabled ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/10">
                    <Truck className="h-3.5 w-3.5" />
                    Entrega a partir de {formatPrice(startingDeliveryFee)}
                  </span>
                ) : pickupEnabled ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/10">
                    <Store className="h-3.5 w-3.5" />
                    Retirada no local
                  </span>
                ) : null}

                {tableNumber && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    <Utensils className="h-3.5 w-3.5" />
                    Mesa {tableNumber}
                  </span>
                )}
              </div>

              <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
                <div className="flex items-end gap-4">
                  <div
                    className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white shadow-xl ring-1 ring-black/5 md:h-24 md:w-24"
                    style={{ boxShadow: "0 18px 40px -18px rgba(0,0,0,0.55)" }}
                  >
                    {restaurant.logoUrl && !logoFailedToLoad ? (
                      <Image
                        src={restaurant.logoUrl}
                        alt={restaurant.name}
                        width={96}
                        height={96}
                        className="h-full w-full object-cover"
                        onError={() => setLogoFailedToLoad(true)}
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center"
                        style={{ backgroundColor: themeColor }}
                      >
                        <Store className="h-8 w-8 text-white md:h-10 md:w-10" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-2xl font-black tracking-tight text-white md:text-3xl">
                      {restaurant.name}
                    </h1>

                    {restaurant.description ? (
                      <p className="mt-2 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/80">
                        {restaurant.description}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-white/70">
                        Cardapio digital com pedido rapido e visual mais profissional.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "grid grid-cols-3 border-t",
                isDarkMode ? "border-white/10 bg-neutral-900" : "border-gray-200 bg-white"
              )}
            >
              <div className="flex flex-col items-center justify-center px-3 py-4 text-center">
                <span
                  className={cn(
                    "text-[11px] font-medium uppercase tracking-wide",
                    isDarkMode ? "text-white/50" : "text-gray-500"
                  )}
                >
                  Pedido minimo
                </span>

                <span
                  className={cn(
                    "mt-1 text-sm font-bold",
                    isDarkMode ? "text-white" : "text-gray-900"
                  )}
                >
                  {formatPrice(minimumOrder)}
                </span>
              </div>

              <div
                className={cn(
                  "flex flex-col items-center justify-center border-x px-3 py-4 text-center",
                  isDarkMode ? "border-white/10" : "border-gray-200"
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-medium uppercase tracking-wide",
                    isDarkMode ? "text-white/50" : "text-gray-500"
                  )}
                >
                  {deliveryEnabled ? "Entrega" : "Retirada"}
                </span>

                <span
                  className={cn(
                    "mt-1 text-sm font-bold",
                    isDarkMode ? "text-white" : "text-gray-900"
                  )}
                >
                  {deliveryEnabled ? `A partir de ${formatPrice(startingDeliveryFee)}` : "No local"}
                </span>
              </div>

              <div className="flex flex-col items-center justify-center px-3 py-4 text-center">
                <span
                  className={cn(
                    "text-[11px] font-medium uppercase tracking-wide",
                    isDarkMode ? "text-white/50" : "text-gray-500"
                  )}
                >
                  Tempo medio
                </span>

                <span
                  className={cn(
                    "mt-1 text-sm font-bold",
                    isDarkMode ? "text-white" : "text-gray-900"
                  )}
                >
                  {estimatedDeliveryTime}
                </span>
              </div>
            </div>
          </div>
        </div>

        {!restaurantIsOpen && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {restaurant.closedMessage?.trim()
              ? restaurant.closedMessage
              : "Estamos fechados no momento. Voltamos em breve!"}
          </div>
        )}

        {activeOrder && (
          <OrderTrackingCard
            order={activeOrder}
            accentColor={accentColor}
            restaurantWhatsApp={restaurant.whatsapp}
            onConfirmReceived={confirmActiveOrderReceived}
          />
        )}

        <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
          <div className="group relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-black/10 to-black/5 blur-xl opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />

            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-gray-700" />

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="O que voce deseja hoje?"
                className={cn(
                  "w-full rounded-xl py-3.5 pl-11 pr-4 text-sm placeholder:text-gray-400 shadow-sm transition-all duration-200 focus:outline-none focus:shadow-md border border-gray-200 bg-white text-gray-900 focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20"
                )}
              />

              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 transition-colors hover:bg-gray-100"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {filteredCategories.length > 1 && (
        <div className="sticky top-2 z-30 mt-5">
          <div className="mx-auto max-w-2xl px-4">
            <div className="rounded-2xl border px-2 py-2 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.18)] backdrop-blur-xl border-gray-200/80 bg-white/88">
              <div
                ref={categoryNavRef}
                className="-mx-1 flex gap-2 overflow-x-auto px-1 scrollbar-hide"
              >
                {filteredCategories.map((cat) => (
                  <button
                    key={cat.id}
                    id={`tab-${cat.id}`}
                    onClick={() => scrollToCategory(cat.id)}
                    className={cn(
                      "flex-shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200",
                      activeCategory === cat.id
                        ? "text-white shadow-lg"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                    )}
                    style={
                      activeCategory === cat.id
                        ? {
                            backgroundColor: themeColor,
                            boxShadow: `0 14px 30px -16px ${themeColor}`,
                          }
                        : undefined
                    }
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto mt-5 max-w-2xl space-y-8 px-4 pb-28">
        {filteredCategories.map((category) => (
          <section
            key={category.id}
            id={category.id}
            ref={(el) => {
              categoryRefs.current[category.id] = el
            }}
            className="scroll-mt-28"
          >
            <div className="mb-4">
              <h2 className="text-xl font-black tracking-tight text-gray-900">
                {category.name}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {category.products.length}{" "}
                {category.products.length === 1 ? "item disponivel" : "itens disponiveis"}
              </p>
            </div>

            <div className="space-y-3">
              {category.products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  accentColor={themeColor}
                  onSelect={() => setSelectedProduct({ product, categoryId: category.id })}
                  onQuickAdd={() => {
                    handleAddWithUpsell(
                      {
                        product,
                        quantity: 1,
                        notes: "",
                        modifiers: [],
                        unitPrice: product.price,
                      },
                      category.id
                    )
                  }}
                />
              ))}
            </div>
          </section>
        ))}

        {filteredCategories.length === 0 && searchQuery && (
          <div className="py-12 text-center">
            <Search className="mx-auto mb-3 h-12 w-12 text-gray-200" />
            <p className="text-sm font-medium text-gray-400">Nenhum produto encontrado</p>
            <p className="mt-1 text-xs text-gray-300">Tente buscar por outro termo</p>
          </div>
        )}
      </div>

      <FloatingCartButton
        count={cartCount}
        total={cartTotal}
        bgColor={floatingCartBgColor}
        textColor={floatingCartTextColor}
        numberColor={floatingCartNumberColor}
        onClick={() => setCartOpen(true)}
      />

      {restaurant && <WhatsAppFloatingButton whatsapp={restaurant.whatsapp} />}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct.product}
          categoryId={selectedProduct.categoryId}
          accentColor={themeColor}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(item) => handleAddWithUpsell(item, selectedProduct.categoryId)}
        />
      )}

      {upsellProducts && (
        <UpsellModal
          suggestions={upsellProducts}
          accentColor={themeColor}
          onAdd={(product) => {
            addToCart({
              product,
              quantity: 1,
              notes: "",
              modifiers: [],
              unitPrice: product.price,
            })

            setUpsellProducts(null)
          }}
          onSkip={() => setUpsellProducts(null)}
        />
      )}

      <CustomerStartModal
        open={customerModalOpen}
        restaurantName={restaurant.name}
        accentColor={themeColor}
        initialCustomer={publicCustomer}
        onSave={savePublicCustomer}
      />

      <CartSheet
        items={cart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onUpdateQuantity={updateCartQuantity}
        onRemove={removeFromCart}
        onClearCart={() => setCart([])}
        restaurant={restaurant}
        accentColor={themeColor}
        deliveryEnabled={deliveryEnabled}
        pickupEnabled={pickupEnabled}
        tableNumber={tableNumber}
        customer={publicCustomer}
        onEditCustomer={() => setCustomerModalOpen(true)}
        onSaveAddress={savePublicCustomerAddress}
        onOrderCreated={saveActiveOrder}
      />
    </div>
  )
}