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
  Upload,
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
  pixKey?: string | null
  pix_key?: string | null
  pixKeyType?: string | null
  pix_key_type?: string | null
  pixReceiverName?: string | null
  pix_receiver_name?: string | null
  pixReceiverCity?: string | null
  pix_receiver_city?: string | null
  pixInstructions?: string | null
  pix_instructions?: string | null
  pixEnabled?: boolean | null
  pix_enabled?: boolean | null
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

type PromotionAwareProduct = MenuProduct & {
  originalPrice?: number | string | null
  original_price?: number | string | null
  promotionalPrice?: number | string | null
  promotional_price?: number | string | null
  isPromotional?: boolean | null
  is_promotional?: boolean | null
  discountPercentage?: number | string | null
  discount_percentage?: number | string | null
  badge?: {
    type?: "popular" | "promo" | "new" | string
    label?: string
    discount?: number
  } | null
}

type ProductAvailabilityRule = {
  id?: string
  displayCategoryId?: string | null
  display_category_id?: string | null
  weekdays?: Array<number | string> | null
  weekday?: number | string | null
  startTime?: string | null
  start_time?: string | null
  endTime?: string | null
  end_time?: string | null
  isActive?: boolean | null
  is_active?: boolean | null
}

type ScheduledMenuProduct = MenuProduct & {
  availabilityType?: "always" | "scheduled" | string | null
  availability_type?: "always" | "scheduled" | string | null
  availabilityRules?: ProductAvailabilityRule[] | null
  availability_rules?: ProductAvailabilityRule[] | null
  productAvailabilityRules?: ProductAvailabilityRule[] | null
  product_availability_rules?: ProductAvailabilityRule[] | null
}

type ProductAvailabilityStatus = {
  isAvailable: boolean
  displayCategoryId: string | null
  isScheduled: boolean
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

function getProductAvailabilityType(product: MenuProduct) {
  const scheduledProduct = product as ScheduledMenuProduct

  return scheduledProduct.availabilityType ?? scheduledProduct.availability_type ?? "always"
}

function getProductAvailabilityRules(product: MenuProduct) {
  const scheduledProduct = product as ScheduledMenuProduct

  const rules =
    scheduledProduct.availabilityRules ??
    scheduledProduct.availability_rules ??
    scheduledProduct.productAvailabilityRules ??
    scheduledProduct.product_availability_rules ??
    []

  return Array.isArray(rules) ? rules : []
}

function getRuleWeekdays(rule: ProductAvailabilityRule) {
  if (Array.isArray(rule.weekdays)) {
    return rule.weekdays
      .map((weekday) => Number(weekday))
      .filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)
  }

  const weekday = Number(rule.weekday)

  if (Number.isInteger(weekday) && weekday >= 0 && weekday <= 6) {
    return [weekday]
  }

  return []
}

function isTimeInsideRange(currentMinutes: number, startMinutes: number, endMinutes: number) {
  if (startMinutes === endMinutes) return true

  if (endMinutes > startMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes
}

function getProductAvailabilityStatus(
  product: MenuProduct,
  now = new Date()
): ProductAvailabilityStatus {
  const availabilityType = getProductAvailabilityType(product)
  const isScheduled = availabilityType === "scheduled"

  if (!isScheduled) {
    return {
      isAvailable: true,
      displayCategoryId: null,
      isScheduled: false,
    }
  }

  const currentWeekday = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const activeRule = getProductAvailabilityRules(product).find((rule) => {
    const isRuleActive = rule.isActive ?? rule.is_active ?? true

    if (!isRuleActive) return false

    const weekdays = getRuleWeekdays(rule)

    if (!weekdays.includes(currentWeekday)) return false

    const startTime = rule.startTime ?? rule.start_time ?? null
    const endTime = rule.endTime ?? rule.end_time ?? null

    if (!startTime && !endTime) return true

    const startMinutes = timeToMinutes(startTime, 0)
    const endMinutes = timeToMinutes(endTime, 24 * 60)

    return isTimeInsideRange(currentMinutes, startMinutes, endMinutes)
  })

  if (!activeRule) {
    return {
      isAvailable: false,
      displayCategoryId: null,
      isScheduled: true,
    }
  }

  return {
    isAvailable: true,
    displayCategoryId: activeRule.displayCategoryId ?? activeRule.display_category_id ?? null,
    isScheduled: true,
  }
}

function getVisibleMenuCategories(categories: MenuCategory[], now = new Date()) {
  const categoryMap = new Map<string, MenuCategory>()
  const orderedCategories: MenuCategory[] = []

  categories.forEach((category) => {
    const emptyCategory = {
      ...category,
      products: [],
    }

    categoryMap.set(category.id, emptyCategory)
    orderedCategories.push(emptyCategory)
  })

  const addedProducts = new Set<string>()

  categories.forEach((category) => {
    category.products.forEach((product) => {
      const availability = getProductAvailabilityStatus(product, now)

      if (!availability.isAvailable) return

      const targetCategory =
        categoryMap.get(availability.displayCategoryId ?? "") ?? categoryMap.get(category.id)

      if (!targetCategory) return

      const productKey = `${targetCategory.id}:${product.id}`

      if (addedProducts.has(productKey)) return

      targetCategory.products.push(product)
      addedProducts.add(productKey)
    })
  })

  return orderedCategories.filter((category) => category.products.length > 0)
}

function isScheduledProduct(product: MenuProduct) {
  return getProductAvailabilityType(product) === "scheduled"
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

      <div className="mx-auto max-w-[480px] px-3 -mt-14 relative z-10">
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


// BLOCO: promoções e ofertas em destaque do cardápio público.
// Usa productMeta como fonte temporária para não mexer no banco agora.
// Depois, essa mesma função pode ler campos reais do Supabase.
type PromotionalMenuProduct = MenuProduct & {
  originalPrice?: number | null
  original_price?: number | null
  promotionalPrice?: number | null
  promotional_price?: number | null
  isPromotional?: boolean | null
  is_promotional?: boolean | null
  discountPercentage?: number | null
  discount_percentage?: number | null
}

function getProductPromotion(product: MenuProduct) {
  const promotionalProduct = product as PromotionalMenuProduct

  const realOriginalPrice = Number(
    promotionalProduct.originalPrice ?? promotionalProduct.original_price ?? 0
  )

  const realPromotionalPrice = Number(
    promotionalProduct.promotionalPrice ?? promotionalProduct.promotional_price ?? 0
  )

  const realDiscountPercentage = Number(
    promotionalProduct.discountPercentage ?? promotionalProduct.discount_percentage ?? 0
  )

  const realPromotionIsActive =
    Boolean(promotionalProduct.isPromotional ?? promotionalProduct.is_promotional) &&
    realOriginalPrice > 0 &&
    realPromotionalPrice > 0 &&
    realPromotionalPrice < realOriginalPrice

  if (realPromotionIsActive) {
    return {
      badge: {
        type: "promo" as const,
        label: `${realDiscountPercentage || Math.round(((realOriginalPrice - realPromotionalPrice) / realOriginalPrice) * 100)}% OFF`,
        discount:
          realDiscountPercentage ||
          Math.round(((realOriginalPrice - realPromotionalPrice) / realOriginalPrice) * 100),
      },
      discount:
        realDiscountPercentage ||
        Math.round(((realOriginalPrice - realPromotionalPrice) / realOriginalPrice) * 100),
      originalPrice: realOriginalPrice,
      promotionalPrice: realPromotionalPrice,
      isPromotional: true,
    }
  }

  const badge = productMeta[product.id]?.badge
  const discount = badge?.type === "promo" ? Number(badge.discount || 0) : 0

  const originalPrice =
    discount > 0 && discount < 100
      ? product.price / (1 - discount / 100)
      : null

  return {
    badge,
    discount,
    originalPrice,
    promotionalPrice: discount > 0 ? product.price : null,
    isPromotional: discount > 0,
  }
}
function FeaturedOfferCard({
  product,
  categoryId,
  accentColor,
  onSelect,
  onQuickAdd,
}: {
  product: MenuProduct
  categoryId: string
  accentColor: string
  onSelect: (product: MenuProduct, categoryId: string) => void
  onQuickAdd: (product: MenuProduct, categoryId: string) => void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const { discount, originalPrice } = getProductPromotion(product)

  const handleQuickAdd = (event: React.MouseEvent<HTMLButtonElement>) => {
  event.stopPropagation()

  if (productHasRequiredModifiers(product)) {
    onSelect(product, categoryId)
    return
  }

  setIsAdding(true)
  onQuickAdd(product, categoryId)

  setTimeout(() => {
    setIsAdding(false)
  }, 650)
}

  const handleOpenProduct = () => {
    onSelect(product, categoryId)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      handleOpenProduct()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpenProduct}
      onKeyDown={handleKeyDown}
      className="group min-w-[176px] max-w-[176px] cursor-pointer overflow-hidden rounded-[22px] border border-orange-100 bg-white text-left shadow-[0_16px_40px_-28px_rgba(15,23,42,0.8)] transition-all active:scale-[0.98]"
    >
      <div className="relative h-[112px] w-full overflow-hidden bg-gray-100">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            loading="lazy"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="176px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-50 to-blue-50">
            <Utensils className="h-8 w-8 text-orange-300" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-1 text-[10px] font-black text-white shadow-lg">
          <Percent className="h-3 w-3" />
          -{discount}%
        </div>

        <button
          type="button"
          onClick={handleQuickAdd}
          className={cn(
            "absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-lg transition-all",
            isAdding ? "scale-110 bg-green-500" : "active:scale-95"
          )}
          style={
            isAdding
              ? undefined
              : {
                  backgroundColor: accentColor,
                }
          }
          aria-label={`Adicionar ${product.name}`}
        >
          {isAdding ? (
            <Check className="h-4 w-4" strokeWidth={3} />
          ) : (
            <Plus className="h-4 w-4" strokeWidth={3} />
          )}
        </button>
      </div>

      <div className="p-3">
        <h3 className="line-clamp-2 min-h-[38px] text-sm font-black leading-tight text-gray-900">
          {product.name}
        </h3>

        <div className="mt-2">
          {originalPrice && (
            <p className="text-[11px] font-semibold text-gray-400 line-through">
              {formatPrice(originalPrice)}
            </p>
          )}

          <p className="text-base font-black leading-none text-green-600">
            {formatPrice(product.price)}
          </p>
        </div>
      </div>
    </div>
  )
}

function FeaturedOffersSection({
  items,
  accentColor,
  onSelect,
  onQuickAdd,
}: {
  items: Array<{ product: MenuProduct; categoryId: string }>
  accentColor: string
  onSelect: (product: MenuProduct, categoryId: string) => void
  onQuickAdd: (product: MenuProduct, categoryId: string) => void
}) {
  if (items.length === 0) return null

  return (
    <section className="mt-5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-orange-600">
            <Flame className="h-3.5 w-3.5" />
            Ofertas
          </div>

          <h2 className="mt-2 text-lg font-black tracking-tight text-gray-900">
            Promoções em destaque
          </h2>
        </div>

        <p className="text-xs font-semibold text-gray-400">
          {items.length} {items.length === 1 ? "oferta" : "ofertas"}
        </p>
      </div>

      <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-1 scrollbar-hide">
        {items.slice(0, 8).map(({ product, categoryId }) => (
          <FeaturedOfferCard
            key={product.id}
            product={product}
            categoryId={categoryId}
            accentColor={accentColor}
            onSelect={onSelect}
            onQuickAdd={onQuickAdd}
          />
        ))}
      </div>
    </section>
  )
}

// BLOCO: card compacto de produto para melhorar leitura e conversão no mobile.
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
  const { badge, discount, originalPrice, isPromotional } = getProductPromotion(product)

  const handleQuickAdd = (e: React.MouseEvent) => {
  e.stopPropagation()

  if (productHasRequiredModifiers(product)) {
    onSelect()
    return
  }

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
        "group relative flex cursor-pointer gap-3 rounded-[18px] border border-gray-200 bg-white p-3 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.7)] transition-all duration-200 active:scale-[0.985]",
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

      <div className="min-w-0 flex-1 pt-0.5">
        <h4 className="line-clamp-1 pr-1 text-[14px] font-black leading-tight text-gray-900">
          {product.name}
        </h4>

        <p className="mt-1 line-clamp-2 min-h-[34px] text-[12px] leading-[17px] text-gray-500">
          {product.description?.trim() || "Toque para ver mais detalhes deste item."}
        </p>

        {isScheduledProduct(product) && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-blue-700">
            <Timer className="h-3 w-3" />
            Prato do dia
          </div>
        )}

        <div className="mt-2.5 flex items-end gap-2">
          {isPromotional && (
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black text-orange-600">
              -{discount}%
            </span>
          )}

          <div className="flex flex-col">
            {isPromotional && originalPrice && (
              <span className="text-[11px] font-semibold text-gray-400 line-through">
                {formatPrice(originalPrice)}
              </span>
            )}

            {Number(product.price) > 0 && (
  <span
    className={cn(
      "text-[15px] font-black leading-none tracking-tight",
      isPromotional ? "text-green-600" : "text-gray-900"
    )}
  >
    {formatPrice(product.price)}
  </span>
)}
          </div>
        </div>
      </div>

      <div className="relative h-[88px] w-[88px] flex-shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
        {product.imageUrl ? (
          <>
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              loading="lazy"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="88px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
            <Utensils className="h-7 w-7 text-gray-300" />
          </div>
        )}

        <button
          onClick={handleQuickAdd}
          className={cn(
            "absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full shadow-lg transition-all duration-300",
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
            <Check className="h-4 w-4 text-white" strokeWidth={3} />
          ) : (
            <Plus className="h-4 w-4 text-white" strokeWidth={3} />
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
  onIncrease,
  onDecrease,
}: {
  group: ModifierGroup
  selected: ModifierOption[]
  accentColor: string
  onIncrease: (option: ModifierOption) => void
  onDecrease: (option: ModifierOption) => void
}) {
  const isRadio = group.maxSelect === 1
  const totalSelected = selected.length
  const reachedMax = !isRadio && totalSelected >= group.maxSelect

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
            {totalSelected}/{group.maxSelect}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {group.options.map((option) => {
          const selectedCount = selected.filter((s) => s.id === option.id).length
          const isSelected = selectedCount > 0
          const isDisabled = !isSelected && reachedMax

          if (isRadio) {
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onIncrease(option)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all",
                  isSelected ? "ring-2" : "bg-gray-50 hover:bg-gray-100"
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
          }

          return (
            <div
              key={option.id}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-all",
                isSelected
                  ? "ring-2"
                  : isDisabled
                    ? "bg-gray-50 opacity-50"
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
              <div className="min-w-0 flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-black transition-all",
                    isSelected ? "border-transparent text-white" : "border-gray-300 text-gray-400"
                  )}
                  style={
                    isSelected
                      ? { borderColor: accentColor, backgroundColor: accentColor }
                      : undefined
                  }
                >
                  {isSelected ? `${selectedCount}x` : <Plus className="h-3.5 w-3.5" />}
                </div>

                <div className="min-w-0">
                  <p
                    className={cn(
                      "truncate text-sm",
                      isSelected ? "font-semibold text-gray-900" : "text-gray-700"
                    )}
                  >
                    {option.name}
                  </p>

                  {option.price > 0 && (
                    <p className="mt-0.5 text-xs font-bold" style={{ color: accentColor }}>
                      +{formatPrice(option.price)} cada
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onDecrease(option)}
                  disabled={!isSelected}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>

                <span className="w-5 text-center text-sm font-black text-gray-900">
                  {selectedCount}
                </span>

                <button
                  type="button"
                  onClick={() => onIncrease(option)}
                  disabled={reachedMax}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                  style={reachedMax ? undefined : { backgroundColor: accentColor }}
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
}

type MenuProductWithModifiers = MenuProduct & {
  modifierGroups?: ModifierGroup[] | null
  modifier_groups?: ModifierGroup[] | null
}
function getProductModifierGroups(product: MenuProduct): ModifierGroup[] {
  const productWithModifiers = product as MenuProductWithModifiers

  const modifierGroupsSource =
    productWithModifiers.modifierGroups ??
    productWithModifiers.modifier_groups ??
    []

  return Array.isArray(modifierGroupsSource)
    ? modifierGroupsSource.filter(
        (group): group is ModifierGroup =>
          Boolean(group) &&
          Array.isArray(group.options) &&
          group.options.length > 0
      )
    : []
}

function productHasRequiredModifiers(product: MenuProduct) {
  return getProductModifierGroups(product).some(
    (group) => group.required && group.minSelect > 0
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

  const productWithModifiers = product as MenuProductWithModifiers

const modifierGroups = getProductModifierGroups(product)
const productPromotion = getProductPromotion(product)

  const modifiersTotal = Object.values(selectedModifiers)
    .flat()
    .reduce((sum, opt) => sum + opt.price, 0)

  const unitPrice = product.price + modifiersTotal
  const totalPrice = unitPrice * quantity

  const requiredGroups = modifierGroups.filter((g) => g.required)
  const allRequiredSelected = requiredGroups.every(
    (g) => (selectedModifiers[g.id] || []).length >= g.minSelect
  )

 const handleModifierIncrease = (group: ModifierGroup, option: ModifierOption) => {
  setSelectedModifiers((prev) => {
    const current = prev[group.id] || []
    const isSelected = current.some((o) => o.id === option.id)

    if (group.maxSelect === 1) {
      return { ...prev, [group.id]: isSelected ? [] : [option] }
    }

    if (current.length >= group.maxSelect) {
      return prev
    }

    return { ...prev, [group.id]: [...current, option] }
  })
}

const handleModifierDecrease = (group: ModifierGroup, option: ModifierOption) => {
  setSelectedModifiers((prev) => {
    const current = prev[group.id] || []
    const optionIndex = current.findIndex((o) => o.id === option.id)

    if (optionIndex === -1) {
      return prev
    }

    const next = [...current]
    next.splice(optionIndex, 1)

    return { ...prev, [group.id]: next }
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

              {isScheduledProduct(product) && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-blue-700">
                  <Timer className="h-3.5 w-3.5" />
                  Disponível hoje
                </div>
              )}

              <p className="mt-2 text-sm leading-relaxed text-gray-500">{product.description}</p>

              <div className="mt-3">
                {productPromotion.isPromotional && productPromotion.originalPrice ? (
                  <p className="text-sm font-semibold text-gray-400 line-through">
                    {formatPrice(productPromotion.originalPrice)}
                  </p>
                ) : null}

                {Number(product.price) > 0 && (
  <p
    className={cn(
      "text-lg font-black",
      productPromotion.isPromotional ? "text-green-600" : ""
    )}
    style={productPromotion.isPromotional ? undefined : { color: accentColor }}
  >
    A partir de {formatPrice(product.price)}
  </p>
)}
              </div>
            </div>

{modifierGroups.length > 0 && (
  <div className="space-y-5 border-t border-gray-100 pt-3">
    {modifierGroups.map((group) => (
      <ModifierGroupComponent
        key={group.id}
        group={group}
        accentColor={accentColor}
        selected={selectedModifiers[group.id] || []}
        onIncrease={(opt) => handleModifierIncrease(group, opt)}
        onDecrease={(opt) => handleModifierDecrease(group, opt)}
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
  const firstSuggestion = suggestions[0]

  if (!firstSuggestion) return null

  return (
    <div className="fixed bottom-24 left-3 right-3 z-50 mx-auto max-w-lg animate-in slide-in-from-bottom-3 duration-300">
      <div className="overflow-hidden rounded-[24px] border border-blue-100 bg-white shadow-[0_28px_70px_-30px_rgba(15,23,42,0.75)]">
        <div className="border-b border-blue-50 bg-gradient-to-r from-blue-50 to-orange-50 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
            Oferta rápida
          </p>

          <h3 className="mt-1 text-sm font-black text-gray-900">
            Quer adicionar algo que combina?
          </h3>
        </div>

        <div className="flex items-center gap-3 p-3">
          {firstSuggestion.imageUrl ? (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gray-100">
              <Image
                src={firstSuggestion.imageUrl}
                alt={firstSuggestion.name}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-50">
              <Utensils className="h-7 w-7 text-blue-300" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
              Sugestão para seu pedido
            </p>

            <h3 className="mt-0.5 line-clamp-1 text-sm font-black text-gray-900">
              {firstSuggestion.name}
            </h3>

            <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-gray-500">
              {firstSuggestion.description || "Adicione agora com um toque."}
            </p>

            <p className="mt-1 text-sm font-black text-gray-900">
              {formatPrice(firstSuggestion.price)}
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              onClick={() => onAdd(firstSuggestion)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg active:scale-95"
              style={{ backgroundColor: accentColor }}
              aria-label={`Adicionar ${firstSuggestion.name}`}
            >
              <Plus className="h-5 w-5" strokeWidth={3} />
            </button>

            <button
              type="button"
              onClick={onSkip}
              className="flex h-8 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400 active:scale-95"
              aria-label="Fechar sugestão"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {suggestions.length > 1 && (
          <div className="border-t border-gray-100 px-3 pb-3 pt-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {suggestions.slice(1, 4).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onAdd(product)}
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-2.5 py-2 text-left active:scale-95"
                >
                  <span className="max-w-[120px] truncate text-xs font-black text-gray-800">
                    {product.name}
                  </span>

                  <span className="text-xs font-black" style={{ color: accentColor }}>
                    + {formatPrice(product.price)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={onSkip}
            className="w-full rounded-xl border border-gray-100 bg-gray-50 py-2.5 text-xs font-black text-gray-500 active:scale-[0.98]"
          >
            Agora não
          </button>
        </div>
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
  paymentId?: string | null
  qrCodeBase64?: string | null
  qrCodeUrl?: string | null
  qrCode?: string | null
  pixCopyPaste?: string | null
  ticketUrl?: string | null
  status?: string | null
  publicOrderNumber: string | null
  expiresAt?: string | null
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
    id?: string | null
    product_id?: string | null
    name?: string | null
    product_name?: string | null
    quantity?: number | null
    price?: number | string | null
    unit_price?: number | string | null
    notes?: string | null
    modifiers?: SelectedModifier[] | NormalizedOrderModifier[] | null
  }> | null
}

type LoyaltyCampaignSummary = {
  id: string
  title: string
  reward_description: string
  required_orders: number
  is_active: boolean
}

type CustomerLoyaltyProgress = {
  id: string
  restaurant_id: string
  campaign_id: string
  customer_phone: string
  customer_name: string | null
  current_orders: number
  required_orders: number
  reward_available: boolean
  reward_redeemed: boolean
  last_order_id: string | null
  created_at: string
  updated_at: string
  loyalty_campaigns: LoyaltyCampaignSummary | null
}

type LoyaltyStatusResponse = {
  success: boolean
  has_loyalty: boolean
  order_status?: string | null
  loyalty?: CustomerLoyaltyProgress | null
  error?: string
}

type OrderStep = {
  key: string
  label: string
}

type PublicUpsellRule = {
  id: string
  title?: string | null
  name?: string | null
  description?: string | null
  offeredTitle?: string | null
  offered_title?: string | null
  offeredDescription?: string | null
  offered_description?: string | null
  isActive?: boolean | null
  is_active?: boolean | null
  triggerType?: string | null
  trigger_type?: string | null
  triggerProductId?: string | null
  trigger_product_id?: string | null
  triggerCategoryId?: string | null
  trigger_category_id?: string | null
  offerProductId?: string | null
  offer_product_id?: string | null
  offeredProductId?: string | null
  offered_product_id?: string | null
  minSubtotal?: number | string | null
  min_subtotal?: number | string | null
  minimumCartTotal?: number | string | null
  minimum_cart_total?: number | string | null
  sortOrder?: number | string | null
  sort_order?: number | string | null
  priority?: number | string | null
}

type NormalizedOrderModifier = {
  groupId?: string | null
  groupName?: string | null
  optionId?: string | null
  optionName?: string | null
  optionPrice?: number | string | null
  option?: ModifierOption
}

type PublicCashbackStatus = {
  hasCampaign: boolean
  campaign: {
    id: string
    name: string | null
    description: string | null
    redeemAmount: number
    redeemMinimumOrderAmount: number
  } | null
  wallet: {
    id: string
    balance: number
    totalEarned: number
    totalRedeemed: number
    customerName: string | null
    customerPhone: string | null
  } | null
  canRedeem: boolean
}

type PublicMenuCampaigns = {
  upsellRules: PublicUpsellRule[]
}

const ONLINE_SERVICE_FEE = 0

function onlyDigits(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "")
}

function isValidBrazilianMobilePhone(value: string | null | undefined) {
  const digits = onlyDigits(value)

  if (!/^([1-9]{2})9\d{8}$/.test(digits)) {
    return false
  }

  const localNumber = digits.slice(2)

  if (/^(\d)\1{8}$/.test(localNumber)) {
    return false
  }

  return true
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

function parseCurrencyInput(value: string) {
  const sanitizedValue = value
    .replace(/\s/g, "")
    .replace(/[^\d.,]/g, "")

  if (!sanitizedValue) return null

  const normalizedValue = sanitizedValue.includes(",")
    ? sanitizedValue.replace(/\./g, "").replace(",", ".")
    : sanitizedValue

  const parsedValue = Number(normalizedValue)

  return Number.isFinite(parsedValue) ? parsedValue : null
}

function sanitizePixText(value: string | null | undefined, maxLength: number, fallback: string) {
  const normalized = (value || fallback)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()

  return (normalized || fallback).slice(0, maxLength)
}

function normalizePixKeyForPayload(pixKey: string, pixKeyType?: string | null) {
  const type = normalizeOrderStatus(pixKeyType)
  const value = pixKey.trim()

  if (!value) return ""

  if (["cpf", "cnpj"].includes(type)) {
    return onlyDigits(value)
  }

  if (["telefone", "phone", "celular", "mobile"].includes(type)) {
    const digits = onlyDigits(value)

    if (!digits) return value.replace(/\s+/g, "")
    if (digits.startsWith("55")) return `+${digits}`
    if (digits.length === 10 || digits.length === 11) return `+55${digits}`

    return value.replace(/\s+/g, "")
  }

  if (["email", "e_mail", "e-mail"].includes(type)) {
    return value.toLowerCase()
  }

  return value.replace(/\s+/g, "")
}

function formatPixAmount(value: number) {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0

  return safeValue.toFixed(2)
}

function buildPixField(id: string, value: string) {
  const size = String(value.length).padStart(2, "0")

  return `${id}${size}${value}`
}

function calculatePixCrc16(payload: string) {
  let crc = 0xffff

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8

    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc <<= 1
      }

      crc &= 0xffff
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0")
}

function buildManualPixPayload({
  pixKey,
  pixKeyType,
  receiverName,
  city,
  amount,
  txid,
}: {
  pixKey: string
  pixKeyType?: string | null
  receiverName: string
  city?: string | null
  amount: number
  txid: string
}) {
  const safePixKey = normalizePixKeyForPayload(pixKey, pixKeyType)

  if (!safePixKey) return ""

  const merchantAccountInfo =
    buildPixField("00", "br.gov.bcb.pix") +
    buildPixField("01", safePixKey)

  const additionalData = buildPixField(
    "05",
    sanitizePixText(txid, 25, "CLICKFOOD")
  )

  const payloadWithoutCrc =
    buildPixField("00", "01") +
    buildPixField("01", "11") +
    buildPixField("26", merchantAccountInfo) +
    buildPixField("52", "0000") +
    buildPixField("53", "986") +
    buildPixField("54", formatPixAmount(amount)) +
    buildPixField("58", "BR") +
    buildPixField("59", sanitizePixText(receiverName, 25, "RESTAURANTE")) +
    buildPixField("60", sanitizePixText(city, 15, "BRASILIA")) +
    buildPixField("62", additionalData) +
    "6304"

  return `${payloadWithoutCrc}${calculatePixCrc16(payloadWithoutCrc)}`
}


function formatPaymentMethodLabel(method?: string | null) {
  const normalizedMethod = normalizeOrderStatus(method)

  if (["cash", "dinheiro"].includes(normalizedMethod)) return "Dinheiro"
  if (["pix", "pix_manual", "pix_direto"].includes(normalizedMethod)) return "Pix"

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

  if (
    [
      "waiting_payment",
      "aguardando_pagamento",
      "waiting_customer_payment",
    ].includes(normalizedStatus)
  ) {
    return "Aguardando pagamento"
  }

  if (
    [
      "waiting_pix_confirmation",
      "aguardando_confirmacao_pix",
      "awaiting_pix_review",
    ].includes(normalizedStatus)
  ) {
    return "Aguardando conferência Pix"
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

function LoyaltyProgressCard({
  loyalty,
  accentColor,
}: {
  loyalty: CustomerLoyaltyProgress
  accentColor: string
}) {
  const campaign = loyalty.loyalty_campaigns

  const requiredOrders = Math.max(
    1,
    Number(campaign?.required_orders ?? loyalty.required_orders ?? 10)
  )

  const currentOrders = Math.min(
    Number(loyalty.current_orders ?? 0),
    requiredOrders
  )

  const remainingOrders = Math.max(requiredOrders - currentOrders, 0)

  const rewardDescription =
    campaign?.reward_description?.trim() || "uma recompensa especial"

  const rewardAvailable =
    loyalty.reward_available && !loyalty.reward_redeemed

  const progressPercentage = Math.min(
    (currentOrders / requiredOrders) * 100,
    100
  )

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-orange-300/30 bg-[#111827] text-white shadow-[0_24px_70px_-35px_rgba(0,0,0,0.75)]">
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-orange-500/25 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-blue-600/20 blur-3xl" />

      <div className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 shadow-lg ring-1 ring-white/15 backdrop-blur-md">
              {rewardAvailable ? (
                <Sparkles className="h-6 w-6 text-orange-300" />
              ) : (
                <Receipt className="h-6 w-6 text-orange-300" />
              )}
            </div>

            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">
                Card Fidelidade
              </p>

              <h4 className="mt-1 text-xl font-black leading-tight">
                {rewardAvailable
                  ? "Prêmio desbloqueado"
                  : `${currentOrders}/${requiredOrders} selos acumulados`}
              </h4>

              <p className="mt-1 max-w-[260px] text-sm leading-relaxed text-white/70">
                {rewardAvailable
                  ? "Seu benefício já está liberado para resgate."
                  : remainingOrders === 1
                    ? "Falta 1 pedido para liberar sua recompensa."
                    : `Faltam ${remainingOrders} pedidos para liberar sua recompensa.`}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-right backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase text-white/50">
              Progresso
            </p>

            <p className="text-lg font-black text-white">
              {Math.round(progressPercentage)}%
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wide text-white/45">
                Recompensa
              </p>

              <p className="mt-1 text-base font-black text-white">
                {rewardDescription}
              </p>
            </div>

            <div className="rounded-full bg-orange-400/15 px-3 py-1 text-xs font-black text-orange-300 ring-1 ring-orange-300/20">
              {currentOrders}/{requiredOrders}
            </div>
          </div>

          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full shadow-[0_0_18px_rgba(249,115,22,0.65)] transition-all duration-700"
              style={{
                width: `${progressPercentage}%`,
                background: rewardAvailable
                  ? "linear-gradient(to right, #facc15, #f97316)"
                  : `linear-gradient(to right, ${accentColor}, #fb923c)`,
              }}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-2.5">
          {Array.from({ length: requiredOrders }).map((_, index) => {
            const isFilled = index < currentOrders

            return (
              <div
                key={index}
                className={cn(
                  "relative flex aspect-square items-center justify-center rounded-2xl border text-sm font-black transition-all",
                  isFilled
                    ? "border-orange-300/30 bg-orange-500 text-white shadow-[0_12px_28px_-14px_rgba(249,115,22,0.9)]"
                    : "border-white/10 bg-white/[0.06] text-white/30"
                )}
              >
                {isFilled ? (
                  <>
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent" />
                    <Check className="relative h-4 w-4" strokeWidth={3} />
                  </>
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
            )
          })}
        </div>

        {rewardAvailable ? (
          <div className="mt-5 rounded-3xl border border-yellow-300/25 bg-yellow-300/10 p-4 text-center">
            <p className="text-sm font-black text-yellow-200">
              Seu prêmio está liberado.
            </p>

            <p className="mt-1 text-xs font-medium text-yellow-100/75">
              Mostre este card ao restaurante no próximo pedido.
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.06] p-4 text-center">
            <p className="text-xs font-semibold text-white/60">
              Continue comprando para completar seu card e liberar sua recompensa.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function getOrderTrackingMessage({
  progressIndex,
  orderType,
  alreadyReceived,
  isCancelled,
}: {
  progressIndex: number
  orderType: "delivery" | "pickup"
  alreadyReceived: boolean
  isCancelled: boolean
}) {
  if (isCancelled) {
    return {
      title: "Pedido cancelado",
      description: "O restaurante cancelou este pedido. Fale com o atendimento se tiver alguma dúvida.",
    }
  }

  if (alreadyReceived) {
    return {
      title: orderType === "pickup" ? "Pedido retirado" : "Pedido entregue",
      description: "Obrigado por confirmar. Sua avaliação ajuda o restaurante a melhorar.",
    }
  }

  if (progressIndex <= 0) {
    return {
      title: "Recebemos seu pedido",
      description: "O restaurante está conferindo tudo para começar o preparo.",
    }
  }

  if (progressIndex === 1) {
    return {
      title: "Seu pedido está em preparo",
      description: "A cozinha já recebeu seu pedido e está caprichando.",
    }
  }

  if (orderType === "pickup") {
    return {
      title: "Pedido pronto para retirada",
      description: "Pode ir até o restaurante para retirar seu pedido.",
    }
  }

  return {
    title: "Seu pedido saiu para entrega",
    description: "O entregador já está levando seu pedido até você.",
  }
}

function OrderTrackingCard({
  order,
  accentColor,
  restaurantWhatsApp,
  hasActiveLoyaltyCampaign,
  onConfirmReceived,
}: {
  order: CustomerVisibleOrder
  accentColor: string
  restaurantWhatsApp?: string | null
  hasActiveLoyaltyCampaign: boolean
  onConfirmReceived: (rating: number, review: string) => Promise<void> | void
}) {
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [rating, setRating] = useState(order.customer_rating ?? 0)
  const [review, setReview] = useState(order.customer_review ?? "")
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)

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
  const isCancelled = ["cancelled", "canceled", "cancelado"].includes(normalizedStatus)
  const canConfirmReceived = !isCancelled && progressIndex >= 2
  const alreadyReceived = Boolean(order.customer_received_at)
  const whatsappPhone = restaurantWhatsApp?.replace(/\D/g, "") || ""
  const orderNumber = order.public_order_number || order.id.slice(0, 8)
  const safeProgressIndex = Math.max(0, Math.min(progressIndex, steps.length - 1))

  const trackingMessage = getOrderTrackingMessage({
    progressIndex: safeProgressIndex,
    orderType,
    alreadyReceived,
    isCancelled,
  })

  const handleSubmitReview = async () => {
    if (rating <= 0) {
      alert("Selecione uma nota para o restaurante.")
      return
    }

    try {
      setIsSubmittingReview(true)
      await onConfirmReceived(rating, review.trim())
      setShowReviewForm(false)
    } finally {
      setIsSubmittingReview(false)
    }
  }

  return (
    <div className="mx-auto mt-3 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-[0_14px_45px_-32px_rgba(15,23,42,0.75)]">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
                Acompanhe seu pedido
              </p>

              <h3 className="mt-1 text-base font-black leading-tight text-gray-900">
                {trackingMessage.title}
              </h3>

              <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-gray-500">
                {trackingMessage.description}
              </p>
            </div>

            <div className="shrink-0 rounded-2xl bg-gray-50 px-3 py-2 text-right ring-1 ring-gray-100">
              <p className="text-[9px] font-black uppercase text-gray-400">Pedido</p>
              <p className="text-xs font-black text-gray-900">#{orderNumber}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl bg-gray-50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-gray-900">
                {getOrderStatusLabel(order.status, orderType, order.customer_received_at)}
              </p>

              <p className="mt-0.5 text-[11px] font-semibold text-gray-500">
                {orderType === "delivery" ? "Entrega" : "Retirada"} •{" "}
                {formatPaymentMethodLabel(order.payment_method)}
              </p>
            </div>

            <p className="text-sm font-black text-gray-900">
              {formatPrice(Number(order.total || 0))}
            </p>
          </div>

          {isCancelled ? (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
              Este pedido foi cancelado pelo restaurante.
            </div>
          ) : (
            <div className="mt-4">
              <div className="flex items-start">
                {steps.map((step, index) => {
                  const isDone = progressIndex >= index
                  const isCurrent = progressIndex === index

                  return (
                    <React.Fragment key={step.key}>
                      <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                        <div
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black transition-all",
                            isDone ? "text-white" : "bg-gray-200 text-gray-400",
                            isCurrent && "ring-4 ring-blue-100"
                          )}
                          style={isDone ? { backgroundColor: accentColor } : undefined}
                        >
                          {isDone ? "●" : "○"}
                        </div>

                        <span
                          className={cn(
                            "mt-1.5 text-[10px] font-black leading-tight",
                            isDone ? "text-gray-900" : "text-gray-400"
                          )}
                        >
                          {step.label}
                        </span>
                      </div>

                      {index < steps.length - 1 && (
                        <div
                          className={cn(
                            "mt-3 h-0.5 w-7 rounded-full",
                            progressIndex > index ? "" : "bg-gray-200"
                          )}
                          style={progressIndex > index ? { backgroundColor: accentColor } : undefined}
                        />
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            </div>
          )}

          {alreadyReceived ? (
            <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-500 text-white">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </div>

                <div>
                  <p className="text-xs font-black text-green-800">
                    Recebimento confirmado
                  </p>

                  <p className="mt-1 text-[11px] font-semibold leading-relaxed text-green-700">
                    {hasActiveLoyaltyCampaign
                      ? "Seu selo de fidelidade será contado automaticamente na sua conta."
                      : "Obrigado por confirmar. Sua avaliação ajuda o restaurante a melhorar."}
                  </p>
                </div>
              </div>
            </div>
          ) : showReviewForm ? (
            <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
              <p className="text-sm font-black text-gray-900">
                {orderType === "pickup" ? "Como foi sua retirada?" : "Como foi seu pedido?"}
              </p>

              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Confirme o recebimento e avalie sua experiência.
              </p>

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
                placeholder="Comentário opcional. Ex: chegou rápido, lanche muito bom..."
                rows={3}
                className="mt-3 w-full resize-none rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              />

              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={isSubmittingReview}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black text-white shadow-lg disabled:opacity-60"
                style={{ backgroundColor: accentColor }}
              >
                {isSubmittingReview ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando avaliação...
                  </>
                ) : (
                  "Confirmar e enviar avaliação"
                )}
              </button>
            </div>
          ) : canConfirmReceived ? (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-black text-gray-900">
                {orderType === "pickup" ? "Você já retirou seu pedido?" : "Seu pedido chegou?"}
              </p>

              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => setShowReviewForm(true)}
                  className="w-full rounded-xl py-3 text-sm font-black text-white shadow-lg active:scale-[0.98]"
                  style={{ backgroundColor: accentColor }}
                >
                  {orderType === "pickup" ? "Sim, já retirei" : "Sim, recebi"}
                </button>

                {whatsappPhone ? (
                  <a
                    href={`https://wa.me/${whatsappPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 shadow-sm"
                  >
                    <MessageCircle className="h-4 w-4 text-green-500" />
                    Tive um problema
                  </a>
                ) : null}
              </div>
            </div>
          ) : whatsappPhone ? (
            <a
              href={`https://wa.me/${whatsappPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 shadow-sm"
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
  mode = "checkout",
  requireDocument = true,
  onClose,
  onSave,
}: {
  open: boolean
  restaurantName: string
  accentColor: string
  initialCustomer: PublicCustomerProfile | null
  mode?: "checkout" | "profile"
  requireDocument?: boolean
  onClose: () => void
  onSave: (customer: PublicCustomerProfile) => Promise<void> | void
}) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [document, setDocument] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return

    setName(initialCustomer?.name ?? "")
    setPhone(initialCustomer?.phone ? formatPhonePreview(initialCustomer.phone) : "")
    setDocument(initialCustomer?.document ? formatCpfPreview(initialCustomer.document) : "")
  }, [open, initialCustomer])

  const title =
    mode === "checkout" ? "Finalize seu pedido" : "Entrar ou criar conta"

  const description =
    mode === "checkout"
      ? `Entre ou cadastre seu WhatsApp para acompanhar o pedido, cashback e fidelidade em ${restaurantName}.`
      : `Use o mesmo nome e WhatsApp dos pedidos anteriores para acessar histórico, cashback e fidelidade em ${restaurantName}.`

  const buttonLabel =
    mode === "checkout" ? "Continuar pedido" : "Entrar / cadastrar"

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedName = name.trim()
    const normalizedPhone = onlyDigits(phone)
    const normalizedDocument = onlyDigits(document)

    if (!normalizedName) {
      alert("Informe seu nome.")
      return
    }

    if (!isValidBrazilianMobilePhone(normalizedPhone)) {
      alert("Informe um celular/WhatsApp válido com DDD.")
      return
    }

    if (requireDocument && normalizedDocument.length !== 11) {
      alert("Informe um CPF válido.")
      return
    }

    try {
      setIsSubmitting(true)

      await onSave({
        name: normalizedName,
        phone: normalizedPhone,
        document: normalizedDocument,
        address: initialCustomer?.address,
      })
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível entrar nessa conta."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 pr-8">
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{ backgroundColor: accentColor }}
          >
            <UserRound className="h-6 w-6" />
          </div>

          <h2 className="text-xl font-black text-gray-900">{title}</h2>

          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            {description}
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
              onChange={(event) => setPhone(formatPhonePreview(event.target.value))}
              placeholder="(00) 00000-0000"
              maxLength={15}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500/20"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase text-gray-500">
                CPF {requireDocument ? "*" : ""}
              </label>

              {!requireDocument && (
                <span className="text-[11px] font-semibold text-gray-400">
                  opcional agora
                </span>
              )}
            </div>

            <input
              type="text"
              value={document}
              onChange={(event) => setDocument(formatCpfPreview(event.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500/20"
            />

            <p className="mt-1 text-xs text-gray-400">
              {requireDocument
                ? "Necessário apenas quando o restaurante exigir identificação completa."
                : "Opcional para pedido com Pix direto."}
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white shadow-lg hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 14px 28px -12px ${accentColor}`,
            }}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Verificando conta..." : buttonLabel}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50"
          >
            Continuar vendo o cardápio
          </button>
        </form>
      </div>
    </div>
  )
}

function ProfileLoyaltyCoins({
  loyalty,
  accentColor,
}: {
  loyalty: CustomerLoyaltyProgress | null
  accentColor: string
}) {
  const campaign = loyalty?.loyalty_campaigns

  const requiredOrders = Math.max(
    1,
    Number(campaign?.required_orders ?? loyalty?.required_orders ?? 10)
  )

  const currentOrders = Math.min(
    Number(loyalty?.current_orders ?? 0),
    requiredOrders
  )

  const remainingOrders = Math.max(requiredOrders - currentOrders, 0)
  const rewardDescription =
    campaign?.reward_description?.trim() || "uma recompensa especial"

  const rewardAvailable =
    Boolean(loyalty?.reward_available) && !loyalty?.reward_redeemed

  const progressPercentage = Math.min(
    Math.round((currentOrders / requiredOrders) * 100),
    100
  )

  const visibleCoins = Math.min(requiredOrders, 10)
  const hiddenCoins = Math.max(requiredOrders - visibleCoins, 0)

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-blue-50 p-4 shadow-[0_18px_50px_-36px_rgba(249,115,22,0.75)]">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-orange-300/25 blur-3xl" />
      <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-blue-400/15 blur-3xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-300 via-orange-400 to-orange-500 text-white shadow-[0_14px_26px_-14px_rgba(249,115,22,0.95)]">
              <div className="absolute inset-1 rounded-xl bg-white/20" />
              <span className="relative text-xl font-black leading-none">$</span>
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-500">
                Card Fidelidade
              </p>

              <h4 className="mt-1 text-lg font-black leading-tight text-gray-900">
                {currentOrders}/{requiredOrders} moedas
              </h4>

              <p className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-gray-500">
                {rewardAvailable
                  ? "Recompensa liberada para resgate."
                  : loyalty
                    ? remainingOrders === 1
                      ? "Falta 1 pedido para liberar sua recompensa."
                      : `Faltam ${remainingOrders} pedidos para liberar sua recompensa.`
                    : "Faça pedidos para acumular moedas quando houver campanha ativa."}
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-full border border-orange-100 bg-white/85 px-2.5 py-1 text-xs font-black text-orange-600 shadow-sm">
            {progressPercentage}%
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white shadow-inner ring-1 ring-orange-100">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progressPercentage}%`,
              background: rewardAvailable
                ? "linear-gradient(to right, #facc15, #f97316)"
                : `linear-gradient(to right, ${accentColor}, #facc15)`,
            }}
          />
        </div>

        <div className="mt-3 flex items-center gap-1.5 overflow-hidden">
          {Array.from({ length: visibleCoins }).map((_, index) => {
            const isFilled = index < currentOrders
            const isNext = index === currentOrders && currentOrders < requiredOrders

            return (
              <div
                key={index}
                className={cn(
                  "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-black transition-all",
                  isFilled
                    ? "border-yellow-300 bg-gradient-to-br from-yellow-300 via-orange-400 to-orange-500 text-white shadow-[0_10px_20px_-12px_rgba(249,115,22,0.95)]"
                    : isNext
                      ? "animate-pulse border-orange-300 bg-white text-orange-400 shadow-[0_0_0_4px_rgba(249,115,22,0.08)]"
                      : "border-gray-200 bg-white/80 text-gray-300"
                )}
              >
                {isFilled ? (
                  <>
                    <span className="absolute left-1.5 top-1 h-1.5 w-1.5 rounded-full bg-white/55" />
                    <span className="relative text-[11px] leading-none">$</span>
                  </>
                ) : isNext ? (
                  <Sparkles className="h-3.5 w-3.5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
            )
          })}

          {hiddenCoins > 0 && (
            <div className="flex h-7 shrink-0 items-center rounded-full border border-gray-200 bg-white/80 px-2 text-[10px] font-black text-gray-400">
              +{hiddenCoins}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-orange-100 bg-white/75 px-3 py-2">
          <Sparkles className="h-4 w-4 shrink-0 text-orange-500" />

          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
              Recompensa
            </p>

            <p className="truncate text-sm font-black text-gray-900">
              {rewardDescription}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatOrderHistoryDate(value?: string | null) {
  if (!value) return "Data não informada"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return "Data não informada"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function CustomerProfileModal({
  open,
  customer,
  loyalty,
  cashbackStatus,
  orderHistory,
  activeOrder,
  accentColor,
  onClose,
  onLogin,
  onLogout,
  onRepeatOrder,
}: {
  open: boolean
  customer: PublicCustomerProfile | null
  loyalty: CustomerLoyaltyProgress | null
  cashbackStatus: PublicCashbackStatus | null
  orderHistory: CustomerVisibleOrder[]
  activeOrder: CustomerVisibleOrder | null
  accentColor: string
  onClose: () => void
  onLogin: () => void
  onLogout: () => void
  onRepeatOrder: (order: CustomerVisibleOrder) => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/60 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-[30px] bg-white shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        {!customer ? (
          <div className="p-5">
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{ backgroundColor: accentColor }}
            >
              <UserRound className="h-7 w-7" />
            </div>

            <h2 className="pr-8 text-xl font-black text-gray-900">
              Acesse sua conta
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Veja histórico de pedidos, acompanhe compras e acumule moedas no card fidelidade.
            </p>

            <div className="mt-5 rounded-[22px] border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-300 via-orange-400 to-orange-500 text-white shadow-lg">
                  <span className="text-lg font-black">$</span>
                </div>

                <div>
                  <p className="text-sm font-black text-gray-900">
                    Moedas de fidelidade
                  </p>

                  <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">
                    Cada pedido válido pode virar uma moeda, conforme a campanha definida pelo restaurante.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogin}
              className="mt-5 w-full rounded-xl py-3.5 text-sm font-black text-white shadow-lg active:scale-[0.98]"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 14px 28px -12px ${accentColor}`,
              }}
            >
              Entrar com WhatsApp
            </button>

            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-600"
            >
              Continuar vendo o cardápio
            </button>
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b border-gray-100 bg-white/95 p-5 pr-14 backdrop-blur-xl">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
                  style={{ backgroundColor: accentColor }}
                >
                  <UserRound className="h-6 w-6" />
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
                    Minha conta
                  </p>

                  <h2 className="mt-1 truncate text-xl font-black leading-tight text-gray-900">
                    Olá, {customer.name.split(" ")[0]}
                  </h2>

                  <p className="mt-1 text-sm font-semibold text-gray-500">
                    {formatPhonePreview(customer.phone)}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4 scrollbar-hide">
              {cashbackStatus?.wallet && cashbackStatus.wallet.balance > 0 && (
                <div className="mb-3 rounded-[22px] border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg">
                      <Sparkles className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                        Cashback disponível
                      </p>

                      <h3 className="mt-1 text-lg font-black text-gray-900">
                        {formatPrice(cashbackStatus.wallet.balance)} para usar
                      </h3>

                      <p className="mt-1 text-xs font-semibold leading-relaxed text-emerald-700">
                        {cashbackStatus.campaign?.redeemMinimumOrderAmount
                          ? `Use em pedidos acima de ${formatPrice(cashbackStatus.campaign.redeemMinimumOrderAmount)}.`
                          : "Use no próximo pedido elegível."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {loyalty?.loyalty_campaigns?.is_active && (
                <ProfileLoyaltyCoins loyalty={loyalty} accentColor={accentColor} />
              )}

              {activeOrder && !activeOrder.customer_received_at && (
                <div className="mt-3 rounded-[20px] border border-blue-100 bg-blue-50 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wide text-blue-600">
                        Pedido em andamento
                      </p>

                      <p className="mt-1 text-sm font-black text-gray-900">
                        #{activeOrder.public_order_number || activeOrder.id.slice(0, 8)}
                      </p>

                      <p className="truncate text-xs font-semibold text-gray-500">
                        {getOrderStatusLabel(
                          activeOrder.status,
                          activeOrder.order_type,
                          activeOrder.customer_received_at
                        )}
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-black text-gray-900">
                      {formatPrice(Number(activeOrder.total || 0))}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-gray-900">
                      Histórico de pedidos
                    </h3>

                    <p className="mt-0.5 text-xs font-semibold text-gray-400">
                      Role para ver seus pedidos anteriores
                    </p>
                  </div>

                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-500">
                    {orderHistory.length}
                  </span>
                </div>

                {orderHistory.length > 0 ? (
                  <div className="space-y-2.5">
                    {orderHistory.map((order) => {
                      const orderType = normalizeCustomerOrderType(order.order_type)
                      const orderItems = order.items ?? []
                      const itemsLabel = orderItems
                        .slice(0, 2)
                        .map((item) => item.name || item.product_name)
                        .filter(Boolean)
                        .join(", ")

                      return (
                        <div
                          key={order.id}
                          className="rounded-[20px] border border-gray-100 bg-gray-50 p-3.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-gray-900">
                                #{order.public_order_number || order.id.slice(0, 8)}
                              </p>

                              <p className="mt-0.5 text-xs font-semibold text-gray-500">
                                {formatOrderHistoryDate(order.created_at)}
                              </p>

                              <p className="mt-1 text-xs font-bold text-gray-500">
                                {orderType === "delivery" ? "Entrega" : "Retirada"} • {formatPaymentMethodLabel(order.payment_method)}
                              </p>
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="text-sm font-black text-gray-900">
                                {formatPrice(Number(order.total || 0))}
                              </p>

                              <p className="mt-1 rounded-full bg-white px-2 py-1 text-[10px] font-black text-gray-500 ring-1 ring-gray-200">
                                {getOrderStatusLabel(
                                  order.status,
                                  order.order_type,
                                  order.customer_received_at
                                )}
                              </p>
                            </div>
                          </div>

                          {itemsLabel && (
                            <p className="mt-2 line-clamp-1 text-xs font-semibold text-gray-400">
                              {itemsLabel}
                              {orderItems.length > 2 ? ` +${orderItems.length - 2} item${orderItems.length - 2 === 1 ? "" : "s"}` : ""}
                            </p>
                          )}

                          {orderItems.length > 0 && (
                            <button
                              type="button"
                              onClick={() => onRepeatOrder(order)}
                              className="mt-3 w-full rounded-xl border border-blue-100 bg-white py-2.5 text-xs font-black text-blue-700 shadow-sm active:scale-[0.98]"
                            >
                              Repetir pedido
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-dashed border-gray-200 bg-gray-50 p-5 text-center">
                    <Receipt className="mx-auto h-8 w-8 text-gray-300" />

                    <p className="mt-2 text-sm font-black text-gray-600">
                      Nenhum pedido ainda
                    </p>

                    <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-400">
                      Quando você fizer pedidos por aqui, eles vão aparecer nessa área.
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="mt-5 w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50"
              >
                Sair da conta
              </button>
            </div>
          </>
        )}
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
  const [needsChange, setNeedsChange] = useState(false)
  const [changeFor, setChangeFor] = useState("")
  const [pixCardOpen, setPixCardOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pixPayment, setPixPayment] = useState<PixPaymentData | null>(null)
  const [pixCopied, setPixCopied] = useState(false)
  const [pixProofFile, setPixProofFile] = useState<File | null>(null)
  const [pixProofPreview, setPixProofPreview] = useState("")
  const [paymentApproved, setPaymentApproved] = useState(false)
  const [paymentCheckError, setPaymentCheckError] = useState("")
  const [cashbackStatus, setCashbackStatus] = useState<{
  wallet: {
    id: string
    balance: number
    totalEarned: number
    totalRedeemed: number
    customerName: string | null
    customerPhone: string | null
  } | null
  campaign: {
    id: string
    name: string | null
    description: string | null
    redeemAmount: number
    redeemMinimumOrderAmount: number
  } | null
  canRedeem: boolean
} | null>(null)

const [useCashback, setUseCashback] = useState(false)
const [isLoadingCashback, setIsLoadingCashback] = useState(false)

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
      setPixProofFile(null)
      setPixProofPreview("")
      setPaymentApproved(false)
      setPaymentCheckError("")
      setPixCardOpen(false)
      setNeedsChange(false)
      setChangeFor("")
      setIsProcessing(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || !customer?.address) return

    setCustomerAddress(customer.address.customerAddress ?? "")
    setSelectedNeighborhoodKey(customer.address.selectedNeighborhoodKey ?? "")
  }, [open, customer?.address])

useEffect(() => {
  const customerPhone = onlyDigits(customer?.phone)

  if (!open || !restaurant.id || !customerPhone) {
    setCashbackStatus(null)
    setUseCashback(false)
    return
  }

  let cancelled = false

  async function loadCashbackStatus() {
    try {
      setIsLoadingCashback(true)

      const params = new URLSearchParams({
        restaurantId: restaurant.id,
        customerPhone,
        _: String(Date.now()),
      })

      const response = await fetch(`/api/public/cashback/status?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      })

      const data = await response.json()

      if (cancelled) return

      if (!response.ok || !data.success) {
        setCashbackStatus(null)
        setUseCashback(false)
        return
      }

      setCashbackStatus({
        wallet: data.wallet ?? null,
        campaign: data.campaign ?? null,
        canRedeem: Boolean(data.canRedeem),
      })
    } catch {
      if (!cancelled) {
        setCashbackStatus(null)
        setUseCashback(false)
      }
    } finally {
      if (!cancelled) {
        setIsLoadingCashback(false)
      }
    }
  }

  void loadCashbackStatus()

  return () => {
    cancelled = true
  }
}, [open, restaurant.id, customer?.phone])

  useEffect(() => {
    if (!isPixPaymentResetSafe(paymentMethod)) {
      setPixPayment(null)
      setPixCopied(false)
      setPaymentApproved(false)
      setPaymentCheckError("")
      setPixCardOpen(false)
    }

    if (paymentMethod.trim().toLowerCase() !== "dinheiro") {
      setNeedsChange(false)
      setChangeFor("")
    }
  }, [paymentMethod])

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const serviceFee = 0
  const deliveryFee =
    orderType === "delivery"
      ? hasNeighborhoodRules
        ? selectedNeighborhoodOption?.fee ?? 0
        : restaurant.deliveryFee
      : 0
  const cashbackWalletBalance = Number(cashbackStatus?.wallet?.balance ?? 0)
const cashbackRedeemAmount = Number(cashbackStatus?.campaign?.redeemAmount ?? 0)
const cashbackRedeemMin = Number(cashbackStatus?.campaign?.redeemMinimumOrderAmount ?? 0)

const maxCashbackDiscount = Math.min(
  cashbackWalletBalance,
  cashbackRedeemAmount > 0 ? cashbackRedeemAmount : cashbackWalletBalance
)

const canUseCashback =
  Boolean(cashbackStatus?.canRedeem) &&
  maxCashbackDiscount > 0 &&
  subtotal >= cashbackRedeemMin

const cashbackDiscount = useCashback && canUseCashback ? maxCashbackDiscount : 0
const cashbackMissingAmount = Math.max(cashbackRedeemMin - subtotal, 0)
const cashbackProgressPercent =
  cashbackRedeemMin > 0
    ? Math.min(100, Math.round((subtotal / cashbackRedeemMin) * 100))
    : 100

const total = Math.max(subtotal + deliveryFee - cashbackDiscount, 0)
  const normalizedPaymentMethod = paymentMethod.trim().toLowerCase()
  const isPixPayment = normalizedPaymentMethod === "pix"
  const isCashPayment = normalizedPaymentMethod === "dinheiro"
  const changeForAmount = parseCurrencyInput(changeFor)
  const pixKey = (restaurant.pixKey ?? restaurant.pix_key ?? "").trim()
  const pixReceiverName = (
    restaurant.pixReceiverName ??
    restaurant.pix_receiver_name ??
    restaurant.name
  ).trim()
  const pixKeyType = (restaurant.pixKeyType ?? restaurant.pix_key_type ?? "Chave Pix").trim()
  const pixCity = (
    restaurant.pixReceiverCity ??
    restaurant.pix_receiver_city ??
    restaurant.city ??
    "BRASILIA"
  ).trim()
  const manualPixTxid = useMemo(
    () => `CF${restaurant.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20)}`,
    [restaurant.id]
  )
  const manualPixCopyPaste = useMemo(
    () =>
      buildManualPixPayload({
        pixKey,
        pixKeyType,
        receiverName: pixReceiverName,
        city: pixCity,
        amount: total,
        txid: manualPixTxid,
      }),
    [manualPixTxid, pixCity, pixKey, pixKeyType, pixReceiverName, total]
  )
  const manualPixQrCodeUrl = manualPixCopyPaste
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
        manualPixCopyPaste
      )}`
    : ""

  const primaryButtonLabel = isPixPayment
    ? pixPayment
      ? "Abrir comprovante Pix"
      : "Pagar com Pix"
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

    if (!isValidBrazilianMobilePhone(customer?.phone)) {
  alert("Atualize seu celular/WhatsApp com DDD antes de finalizar.")
  onEditCustomer()
  return false
}

    if (isPixPayment && !pixKey) {
      alert("Este restaurante ainda não cadastrou a chave Pix.")
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

    if (isCashPayment && needsChange) {
      if (!changeForAmount || changeForAmount <= 0) {
        alert("Informe para quanto precisa de troco.")
        return false
      }

      if (changeForAmount < total) {
        alert("O valor para troco precisa ser maior ou igual ao total do pedido.")
        return false
      }
    }

    return true
  }

  const handleCopyPixCode = async () => {
    const codeToCopy = manualPixCopyPaste || pixKey

    if (!codeToCopy) {
      alert("Este restaurante ainda não cadastrou a chave Pix.")
      return
    }

    try {
      await navigator.clipboard.writeText(codeToCopy)
      setPixCopied(true)
      setTimeout(() => setPixCopied(false), 2000)
    } catch {
      alert("Nao foi possivel copiar o Pix.")
    }
  }
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

    const isManualPix = paymentMethodLabel === "pix_manual"

    const response = await fetch("/api/public/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: restaurant.id,
        tableId: tableNumber || null,
        customerName: customer.name,
        customerPhone: onlyDigits(customer.phone),
        customerAddress: orderType === "delivery" ? formattedCustomerAddress : undefined,
        neighborhood:
          orderType === "delivery"
            ? selectedNeighborhoodOption?.neighborhood ?? undefined
            : undefined,
        orderType,
        paymentMethod: paymentMethodLabel,
        needsChange: paymentMethodLabel.trim().toLowerCase() === "dinheiro" ? needsChange : false,
        changeFor:
          paymentMethodLabel.trim().toLowerCase() === "dinheiro" && needsChange
            ? changeForAmount
            : null,
        paymentStatus: isManualPix ? "waiting_customer_payment" : undefined,
        status: isManualPix ? "waiting_payment" : undefined,
        deliveryFee,
        serviceFee,
        cashback:
          useCashback && canUseCashback && cashbackStatus?.wallet?.id
            ? {
                walletId: cashbackStatus.wallet.id,
                campaignId: cashbackStatus.campaign?.id ?? null,
                amount: cashbackDiscount,
              }
            : null,
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

  const startManualPixProofFlow = async () => {
    if (!validateForm()) return

    setIsProcessing(true)
    setPaymentCheckError("")

    try {
      const createdOrder = await createPublicOrder("pix_manual")

      setPixPayment({
        orderId: createdOrder.id,
        paymentId: createdOrder.id,
        publicOrderNumber: createdOrder.public_order_number ?? null,
        status: "waiting_customer_payment",
      })
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao criar pedido Pix.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePixProofFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    if (!file) {
      setPixProofFile(null)
      setPixProofPreview("")
      return
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Envie uma imagem PNG, JPG ou WEBP.")
      event.target.value = ""
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("O comprovante deve ter no máximo 5 MB.")
      event.target.value = ""
      return
    }

    if (pixProofPreview) {
      URL.revokeObjectURL(pixProofPreview)
    }

    setPixProofFile(file)
    setPixProofPreview(URL.createObjectURL(file))
  }

  const submitManualPixProof = async () => {
    if (!pixPayment?.orderId) {
      alert("Pedido Pix não encontrado.")
      return
    }

    if (!pixProofFile) {
      alert("Anexe a foto do comprovante para continuar.")
      return
    }

    setIsProcessing(true)
    setPaymentCheckError("")

    try {
      const formData = new FormData()

      formData.append("restaurantId", restaurant.id)
      formData.append("orderId", pixPayment.orderId)
      formData.append("proof", pixProofFile)

      const response = await fetch("/api/public/orders/pix-proof", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao enviar comprovante.")
      }

      onOrderCreated({
        id: pixPayment.orderId,
        public_order_number: pixPayment.publicOrderNumber,
        status: "waiting_pix_confirmation",
        payment_status: "awaiting_review",
        total,
        payment_method: "pix_manual",
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

      onClearCart()
      onClose()
      setStep("cart")
      setPixPayment(null)
      setPixCopied(false)
      setPixProofFile(null)
      setPixProofPreview("")
      setPaymentCheckError("")
    } catch (error) {
      setPaymentCheckError(
        error instanceof Error
          ? error.message
          : "Erro ao enviar comprovante."
      )
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
    <>
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

                  {serviceFee > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Taxa de serviço online</span>
                      <span>{formatPrice(serviceFee)}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (!customer?.name || !isValidBrazilianMobilePhone(customer.phone)) {
                      onEditCustomer()
                      return
                    }

                    setStep("checkout")
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-5 py-4 text-white shadow-lg hover:opacity-95 active:scale-[0.98]"
                  style={{
                    backgroundColor: accentColor,
                    boxShadow: `0 14px 30px -10px ${accentColor}`,
                  }}
                >
                  <span className="text-sm font-bold">Continuar</span>
                  <span className="text-sm font-bold">{formatPrice(subtotal)}</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">

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

              {isLoadingCashback ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    <p className="text-sm font-bold text-gray-500">
                      Verificando cashback...
                    </p>
                  </div>
                </div>
              ) : cashbackStatus?.wallet && cashbackWalletBalance > 0 ? (
                <div
                  className={cn(
                    "overflow-hidden rounded-[22px] border shadow-[0_18px_50px_-36px_rgba(15,23,42,0.55)]",
                    canUseCashback
                      ? useCashback
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-emerald-100 bg-white"
                      : "border-amber-100 bg-amber-50"
                  )}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm",
                          canUseCashback ? "bg-emerald-500" : "bg-amber-500"
                        )}
                      >
                        <Sparkles className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p
                              className={cn(
                                "text-[10px] font-black uppercase tracking-[0.16em]",
                                canUseCashback ? "text-emerald-700" : "text-amber-700"
                              )}
                            >
                              Cashback disponível
                            </p>

                            <h4 className="mt-1 text-sm font-black text-gray-900">
                              Você tem {formatPrice(cashbackWalletBalance)} de saldo
                            </h4>
                          </div>

                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black",
                              canUseCashback
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            )}
                          >
                            {canUseCashback ? "Liberado" : "Bloqueado"}
                          </span>
                        </div>

                        <p className="mt-2 text-xs font-semibold leading-relaxed text-gray-600">
                          Use até {formatPrice(maxCashbackDiscount)} em pedidos acima de {formatPrice(cashbackRedeemMin)} em produtos.
                          <span className="font-black text-gray-800"> A entrega não entra nessa conta.</span>
                        </p>

                        <div className="mt-3 rounded-2xl bg-white/75 p-3 ring-1 ring-black/5">
                          <div className="flex items-center justify-between text-[11px] font-black text-gray-500">
                            <span>Produtos</span>
                            <span>{formatPrice(subtotal)} / {formatPrice(cashbackRedeemMin)}</span>
                          </div>

                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                canUseCashback ? "bg-emerald-500" : "bg-amber-500"
                              )}
                              style={{ width: `${cashbackProgressPercent}%` }}
                            />
                          </div>

                          {!canUseCashback && cashbackMissingAmount > 0 ? (
                            <p className="mt-2 text-[11px] font-black text-amber-700">
                              Faltam {formatPrice(cashbackMissingAmount)} em produtos para liberar.
                            </p>
                          ) : (
                            <p className="mt-2 text-[11px] font-black text-emerald-700">
                              Cashback liberado para este pedido.
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => canUseCashback && setUseCashback((current) => !current)}
                          disabled={!canUseCashback}
                          className={cn(
                            "mt-3 w-full rounded-xl py-2.5 text-xs font-black transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
                            useCashback
                              ? "bg-emerald-600 text-white"
                              : canUseCashback
                                ? "border border-emerald-200 bg-white text-emerald-700"
                                : "border border-amber-200 bg-white text-amber-700"
                          )}
                        >
                          {useCashback
                            ? `Cashback aplicado: -${formatPrice(cashbackDiscount)}`
                            : canUseCashback
                              ? `Usar ${formatPrice(maxCashbackDiscount)} de cashback`
                              : `Adicione mais ${formatPrice(cashbackMissingAmount)} em produtos`}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

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
                      onClick={() => {
                        setPaymentMethod(method.label)

                        if (method.id !== "dinheiro") {
                          setNeedsChange(false)
                          setChangeFor("")
                        }

                        if (method.id === "pix") {
                          setPixCardOpen(true)
                        } else {
                          setPixCardOpen(false)
                        }
                      }}
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

              {isCashPayment && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                      <Banknote className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-gray-900">
                        Precisa de troco?
                      </p>

                      <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">
                        Total do pedido: {formatPrice(total)}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNeedsChange(false)
                            setChangeFor("")
                          }}
                          className={cn(
                            "rounded-xl px-3 py-2.5 text-xs font-black transition-all active:scale-[0.98]",
                            !needsChange
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "border border-emerald-200 bg-white text-emerald-700"
                          )}
                        >
                          Não preciso
                        </button>

                        <button
                          type="button"
                          onClick={() => setNeedsChange(true)}
                          className={cn(
                            "rounded-xl px-3 py-2.5 text-xs font-black transition-all active:scale-[0.98]",
                            needsChange
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "border border-emerald-200 bg-white text-emerald-700"
                          )}
                        >
                          Sim, preciso
                        </button>
                      </div>

                      {needsChange && (
                        <div className="mt-3">
                          <label className="text-[10px] font-black uppercase tracking-wide text-emerald-700">
                            Troco para quanto?
                          </label>

                          <input
                            type="text"
                            inputMode="decimal"
                            value={changeFor}
                            onChange={(event) => setChangeFor(event.target.value)}
                            placeholder="Ex: 100,00"
                            className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />

                          {changeForAmount !== null && changeForAmount >= total && (
                            <p className="mt-2 text-xs font-bold text-emerald-700">
                              Troco estimado: {formatPrice(changeForAmount - total)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {isPixPayment && (
                <button
                  type="button"
                  onClick={() => setPixCardOpen(true)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-left transition-colors hover:bg-blue-100/70"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                      <QrCode className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-black text-gray-900">
                        {pixPayment ? "Comprovante Pix pendente" : "Pagamento Pix selecionado"}
                      </p>

                      <p className="truncate text-xs font-semibold text-gray-500">
                        {pixPayment
                          ? "Toque para anexar o comprovante."
                          : "Toque para abrir o QR Code e o Pix copia e cola."}
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100">
                    Abrir
                  </span>
                </button>
              )}
            </div>

            <div className="flex-shrink-0 space-y-3 border-t border-gray-100 bg-white px-5 py-4">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>

                {serviceFee > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Taxa de serviço online</span>
                    <span>{formatPrice(serviceFee)}</span>
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

                {cashbackDiscount > 0 && (
                  <div className="flex justify-between font-bold text-emerald-600">
                    <span>Cashback aplicado</span>
                    <span>-{formatPrice(cashbackDiscount)}</span>
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
                    setPixCardOpen(true)
                    return
                  }

                  void createManualPaymentOrder()
                }}
                disabled={isProcessing}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white shadow-lg hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
                style={{
                  backgroundColor: accentColor,
                  boxShadow: `0 14px 28px -12px ${accentColor}`,
                }}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPixPayment ? (
                  <QrCode className="h-4 w-4" />
                ) : (
                  <Check className="h-4 w-4" />
                )}

                {isProcessing ? "Processando..." : primaryButtonLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>

    {isPixPayment && pixCardOpen && step === "checkout" && (
      <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
        <div
          className="absolute inset-0"
          onClick={() => {
            if (!isProcessing) {
              setPixCardOpen(false)
            }
          }}
          aria-hidden="true"
        />

        <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
          <button
            type="button"
            onClick={() => setPixCardOpen(false)}
            disabled={isProcessing}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 disabled:opacity-50"
            aria-label="Fechar Pix"
          >
            <X className="h-4 w-4" />
          </button>

          {!pixPayment ? (
            <div className="pr-0">
              <div className="pr-10">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
                  Pagamento Pix
                </p>

                <h4 className="mt-1 text-xl font-black text-gray-900">
                  Pague direto ao restaurante
                </h4>

                <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">
                  Escaneie o QR Code ou copie o Pix copia e cola. Depois toque em
                  <span className="font-black text-gray-800"> Já paguei</span> para anexar o comprovante.
                </p>
              </div>

              <div className="mt-4 rounded-[24px] border border-blue-100 bg-blue-50/70 p-3 text-center">
                <p className="text-[10px] font-black uppercase tracking-wide text-blue-600">
                  Valor do Pix
                </p>

                <p className="mt-1 text-2xl font-black text-blue-950">
                  {formatPrice(total)}
                </p>

                <div className="mt-4 rounded-[22px] border border-gray-100 bg-white p-3">
                  {manualPixQrCodeUrl ? (
                    <div className="flex justify-center">
                      <img
                        src={manualPixQrCodeUrl}
                        alt="QR Code Pix"
                        className="h-52 w-52 rounded-xl"
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">
                      Cadastre uma chave Pix válida para gerar o QR Code.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                    Recebedor
                  </p>

                  <p className="mt-1 truncate text-sm font-black text-gray-900">
                    {pixReceiverName}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                    Cidade
                  </p>

                  <p className="mt-1 truncate text-sm font-black text-gray-900">
                    {pixCity || "BRASIL"}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-gray-400">
                Pix copia e cola
              </p>

              <textarea
                readOnly
                value={manualPixCopyPaste}
                rows={3}
                className="mt-1 w-full resize-none rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none"
              />

              <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-gray-400">
                {pixKeyType}
              </p>

              <p className="mt-1 break-all rounded-xl bg-gray-50 px-3 py-2 text-sm font-bold text-gray-800">
                {pixKey || "Chave Pix não cadastrada"}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyPixCode}
                  disabled={!manualPixCopyPaste && !pixKey}
                  className="rounded-xl border border-gray-200 bg-white py-3 text-sm font-black text-gray-700 disabled:opacity-50"
                >
                  {pixCopied ? "Copiado" : "Copiar Pix"}
                </button>

                <button
                  type="button"
                  onClick={() => void startManualPixProofFlow()}
                  disabled={isProcessing || !manualPixCopyPaste}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-black text-white shadow-lg disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Já paguei
                </button>
              </div>
            </div>
          ) : (
            <div className="pr-0">
              <div className="pr-10">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
                  Comprovante Pix
                </p>

                <h4 className="mt-1 text-xl font-black text-gray-900">
                  Agora anexe o print do pagamento
                </h4>

                <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">
                  O restaurante vai conferir valor, data, horário e destinatário antes de iniciar o preparo.
                </p>
              </div>

              {pixPayment.publicOrderNumber && (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2">
                  <p className="text-[9px] font-black uppercase text-blue-500">
                    Pedido gerado
                  </p>

                  <p className="text-sm font-black text-blue-900">
                    #{pixPayment.publicOrderNumber}
                  </p>
                </div>
              )}

              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-blue-200 bg-blue-50/60 px-4 py-6 text-center transition-colors hover:bg-blue-50">
                <Upload className="h-7 w-7 text-blue-600" />

                <span className="mt-2 text-sm font-black text-gray-900">
                  {pixProofFile ? "Trocar comprovante" : "Anexar foto do comprovante"}
                </span>

                <span className="mt-1 text-xs font-semibold text-gray-400">
                  PNG, JPG ou WEBP até 5 MB
                </span>

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePixProofFileChange}
                  className="hidden"
                />
              </label>

              {pixProofPreview && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-blue-100 bg-white">
                  <img
                    src={pixProofPreview}
                    alt="Comprovante Pix"
                    className="max-h-64 w-full object-contain"
                  />
                </div>
              )}

              {paymentCheckError && (
                <p className="mt-3 text-center text-xs font-bold text-red-600">
                  {paymentCheckError}
                </p>
              )}

              <button
                type="button"
                onClick={() => void submitManualPixProof()}
                disabled={isProcessing || !pixProofFile}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-black text-white shadow-lg disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Enviar comprovante
              </button>
            </div>
          )}
        </div>
      </div>
    )}
    </>
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
  const [menuCampaigns, setMenuCampaigns] = useState<PublicMenuCampaigns>({
    upsellRules: [],
  })
  const [activeOrder, setActiveOrder] = useState<CustomerVisibleOrder | null>(null)
  const [restaurant, setRestaurant] = useState<PublicRestaurant | null>(null)
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [isLoadingMenu, setIsLoadingMenu] = useState(true)
  const [publicCustomer, setPublicCustomer] = useState<PublicCustomerProfile | null>(null)
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [customerModalMode, setCustomerModalMode] = useState<"checkout" | "profile">("checkout")
  const [customerModalRequiresDocument, setCustomerModalRequiresDocument] = useState(true)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [customerLoyalty, setCustomerLoyalty] = useState<CustomerLoyaltyProgress | null>(null)
  const [customerCashback, setCustomerCashback] = useState<PublicCashbackStatus | null>(null)
  const [customerOrderHistory, setCustomerOrderHistory] = useState<CustomerVisibleOrder[]>([])
  const [availabilityClock, setAvailabilityClock] = useState(() => new Date())

  const categoryRefs = useRef<Record<string, HTMLElement | null>>({})
  const categoryNavRef = useRef<HTMLDivElement>(null)

  const activeOrderId = activeOrder?.id ?? ""
  const activeOrderPublicNumber = activeOrder?.public_order_number ?? ""

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const intervalId = window.setInterval(() => {
      setAvailabilityClock(new Date())
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [mounted])

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

        const resultCampaigns = result.campaigns as Partial<PublicMenuCampaigns> | undefined

        setRestaurant((result.restaurant ?? null) as PublicRestaurant | null)
        setCategories((result.categories ?? []) as MenuCategory[])
        setMenuCampaigns({
          upsellRules: Array.isArray(resultCampaigns?.upsellRules)
            ? (resultCampaigns.upsellRules as PublicUpsellRule[])
            : Array.isArray(result.upsellRules)
              ? (result.upsellRules as PublicUpsellRule[])
              : [],
        })
      } catch (error) {
        console.error("Erro ao carregar cardápio público:", error)
        setRestaurant(null)
        setCategories([])
        setMenuCampaigns({ upsellRules: [] })
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
      setPublicCustomer(null)
      return
    }

    try {
      const parsedCustomer = JSON.parse(savedCustomer) as PublicCustomerProfile

      if (parsedCustomer?.name && isValidBrazilianMobilePhone(parsedCustomer?.phone)) {
        setPublicCustomer({
          ...parsedCustomer,
          phone: onlyDigits(parsedCustomer.phone),
          document: onlyDigits(parsedCustomer.document),
        })
        return
      }

      window.localStorage.removeItem(storageKey)
      setPublicCustomer(null)
    } catch {
      window.localStorage.removeItem(storageKey)
      setPublicCustomer(null)
    }
  }, [mounted, restaurant?.id])

  useEffect(() => {
    if (!mounted || !restaurant?.id || !publicCustomer?.phone) {
      setCustomerOrderHistory([])
      return
    }

    const historyKey = `clickfood_order_history_${restaurant.id}_${onlyDigits(publicCustomer.phone)}`
    const savedHistory = window.localStorage.getItem(historyKey)

    if (!savedHistory) {
      setCustomerOrderHistory([])
      return
    }

    try {
      const parsedHistory = JSON.parse(savedHistory) as CustomerVisibleOrder[]

      if (!Array.isArray(parsedHistory)) {
        setCustomerOrderHistory([])
        return
      }

      setCustomerOrderHistory(
        parsedHistory
          .filter((order) => order?.id)
          .sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime()
            const dateB = new Date(b.created_at || 0).getTime()

            return dateB - dateA
          })
      )
    } catch {
      window.localStorage.removeItem(historyKey)
      setCustomerOrderHistory([])
    }
  }, [mounted, restaurant?.id, publicCustomer?.phone])

  useEffect(() => {
    if (!mounted || !restaurant?.id || !publicCustomer?.phone) {
      setCustomerCashback(null)
      return
    }

    const restaurantId = restaurant.id
    const customerPhone = onlyDigits(publicCustomer.phone)

    if (!customerPhone) {
      setCustomerCashback(null)
      return
    }

    let cancelled = false

    async function loadCustomerProfile() {
      try {
        const params = new URLSearchParams({
          restaurantId,
          customerPhone,
          _: String(Date.now()),
        })

        const response = await fetch(`/api/public/customer/profile?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        })

        if (!response.ok) return

        const data = await response.json()

        if (cancelled || !data.success) return

        setCustomerCashback(data.cashback ?? null)

        if (Array.isArray(data.orders)) {
          setCustomerOrderHistory(data.orders)
        }

        if (data.activeOrder && !tableNumber) {
          setActiveOrder((current) => current ?? data.activeOrder)
        }
      } catch {
        if (!cancelled) setCustomerCashback(null)
      }
    }

    void loadCustomerProfile()

    return () => {
      cancelled = true
    }
  }, [mounted, restaurant?.id, publicCustomer?.phone, activeOrder?.customer_received_at, tableNumber])

 useEffect(() => {
  if (!restaurant?.id || !publicCustomer?.phone) {
    setCustomerLoyalty(null)
    return
  }

  const restaurantId = restaurant.id
  const customerPhone = onlyDigits(publicCustomer.phone)

  if (!customerPhone) {
    setCustomerLoyalty(null)
    return
  }

  let cancelled = false

  async function loadCustomerLoyalty() {
    try {
      const params = new URLSearchParams({
        restaurantId,
        customerPhone,
        _: String(Date.now()),
      })

      const response = await fetch(`/api/public/loyalty/status?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      })

      if (!response.ok) {
        if (!cancelled) setCustomerLoyalty(null)
        return
      }

      const data = (await response.json()) as LoyaltyStatusResponse

      if (cancelled) return

      setCustomerLoyalty(data.success && data.has_loyalty ? data.loyalty ?? null : null)
    } catch {
      if (!cancelled) setCustomerLoyalty(null)
    }
  }

  void loadCustomerLoyalty()

  return () => {
    cancelled = true
  }
}, [restaurant?.id, publicCustomer?.phone, activeOrder?.customer_received_at])

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

  const visibleCategories = useMemo(
    () => getVisibleMenuCategories(categories, availabilityClock),
    [categories, availabilityClock]
  )

  useEffect(() => {
    if (visibleCategories.length === 0) {
      setActiveCategory(null)
      return
    }

    const activeCategoryStillVisible = visibleCategories.some(
      (category) => category.id === activeCategory
    )

    if (!activeCategory || !activeCategoryStillVisible) {
      setActiveCategory(visibleCategories[0].id)
    }
  }, [visibleCategories, activeCategory])

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
  }, [mounted, visibleCategories])

  const productById = useMemo(() => {
    const map = new Map<string, MenuProduct>()

    visibleCategories.forEach((category) => {
      category.products.forEach((product) => {
        map.set(product.id, product)
      })
    })

    return map
  }, [visibleCategories])

  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart]
  )

  const addToCart = useCallback((item: Omit<CartItem, "id">) => {
    setCart((prev) => [...prev, { ...item, id: `cart-${Date.now()}-${Math.random()}` }])
  }, [])

  const handleAddWithUpsell = useCallback(
    (item: Omit<CartItem, "id">, categoryId: string) => {
      addToCart(item)

      const nextSubtotal = cartSubtotal + item.unitPrice * item.quantity
      const productsAlreadyInCart = new Set(cart.map((cartItem) => cartItem.product.id))
      productsAlreadyInCart.add(item.product.id)

      const usedOfferIds = new Set<string>()

      const suggestions = menuCampaigns.upsellRules
        .filter((rule) => {
          const isActive = rule.isActive ?? rule.is_active ?? true

          if (!isActive) return false

          const triggerProductId = rule.triggerProductId ?? rule.trigger_product_id ?? null
          const triggerCategoryId = rule.triggerCategoryId ?? rule.trigger_category_id ?? null
          const triggerType = String(rule.triggerType ?? rule.trigger_type ?? "product")
          const hasTrigger = Boolean(triggerProductId || triggerCategoryId)

          if (!hasTrigger && triggerType !== "cart_total") return false

          const matchesProduct = triggerProductId === item.product.id
          const matchesCategory = triggerCategoryId === categoryId
          const matchesCartTotal = triggerType === "cart_total"

          if (!matchesProduct && !matchesCategory && !matchesCartTotal) return false

          const minSubtotal = Number(
            rule.minSubtotal ??
              rule.min_subtotal ??
              rule.minimumCartTotal ??
              rule.minimum_cart_total ??
              0
          )

          if (Number.isFinite(minSubtotal) && minSubtotal > 0 && nextSubtotal < minSubtotal) {
            return false
          }

          return true
        })
        .sort((a, b) => Number(a.priority ?? a.sortOrder ?? a.sort_order ?? 0) - Number(b.priority ?? b.sortOrder ?? b.sort_order ?? 0))
        .map((rule) => {
          const offerProductId =
            rule.offerProductId ??
            rule.offer_product_id ??
            rule.offeredProductId ??
            rule.offered_product_id ??
            null

          if (!offerProductId) return null
          if (usedOfferIds.has(offerProductId)) return null
          if (productsAlreadyInCart.has(offerProductId)) return null

          const offerProduct = productById.get(offerProductId)

          if (!offerProduct) return null

          usedOfferIds.add(offerProductId)

          return offerProduct
        })
        .filter((product): product is MenuProduct => Boolean(product))
        .slice(0, 4)

      if (suggestions.length > 0) {
        setUpsellProducts(suggestions)
      }
    },
    [addToCart, cart, cartSubtotal, menuCampaigns.upsellRules, productById]
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
    if (!searchQuery.trim()) return visibleCategories

    const q = searchQuery.toLowerCase()

    return visibleCategories
      .map((cat) => ({
        ...cat,
        products: cat.products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.products.length > 0)
  }, [visibleCategories, searchQuery])

  const featuredProducts = useMemo(() => {
    return visibleCategories
      .flatMap((category) =>
        category.products.map((product) => ({
          product,
          categoryId: category.id,
        }))
      )
      .filter(({ product }) => getProductPromotion(product).isPromotional)
  }, [visibleCategories])

  const scrollToCategory = useCallback((categoryId: string) => {
    const el = categoryRefs.current[categoryId]

    if (el) {
      const yOffset = -160
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: "smooth" })
    }
  }, [])
  const handleRepeatOrder = useCallback(
  (order: CustomerVisibleOrder) => {
    const orderItems = Array.isArray(order.items) ? order.items : []

    if (orderItems.length === 0) {
      alert("Não encontramos os itens desse pedido para repetir.")
      return
    }

    const repeatedItems: CartItem[] = orderItems
      .map((orderItem) => {
        const productName = String(orderItem.name || orderItem.product_name || "").trim()

        if (!productName) return null

        const product = Array.from(productById.values()).find(
          (menuProduct) =>
            menuProduct.name.trim().toLowerCase() === productName.toLowerCase()
        )

        if (!product) return null

        const quantity = Math.max(1, Number(orderItem.quantity || 1))
        const unitPrice = Number(orderItem.unit_price ?? orderItem.price ?? product.price)

        const repeatedItem: CartItem = {
          id: `repeat-${Date.now()}-${Math.random()}`,
          product,
          quantity,
          notes: "",
          modifiers: [],
          unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : product.price,
        }

        return repeatedItem
      })
      .filter((item): item is CartItem => item !== null)

    if (repeatedItems.length === 0) {
      alert("Nenhum item desse pedido está disponível no cardápio atual.")
      return
    }

    setCart((current) => [...current, ...repeatedItems])
    setProfileModalOpen(false)
    setCartOpen(true)
  },
  [productById]
)
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

const openCustomerAccessModal = (
  mode: "checkout" | "profile" = "checkout",
  requireDocument = mode === "checkout"
) => {
  setCustomerModalMode(mode)
  setCustomerModalRequiresDocument(requireDocument)
  setCustomerModalOpen(true)
}

const savePublicCustomer = async (customer: PublicCustomerProfile) => {
  if (!restaurant?.id) return

  const normalizedCustomer: PublicCustomerProfile = {
    ...customer,
    phone: onlyDigits(customer.phone),
    document: onlyDigits(customer.document),
  }

  const response = await fetch("/api/public/customer/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      restaurantId: restaurant.id,
      name: normalizedCustomer.name,
      phone: normalizedCustomer.phone,
      document: normalizedCustomer.document,
      address: normalizedCustomer.address?.customerAddress ?? null,
      neighborhoodKey: normalizedCustomer.address?.selectedNeighborhoodKey ?? null,
    }),
  })

  const data = await response.json()

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Não foi possível entrar nessa conta.")
  }

  const confirmedCustomer: PublicCustomerProfile = {
    name: data.customer?.name ?? normalizedCustomer.name,
    phone: onlyDigits(data.customer?.phone ?? normalizedCustomer.phone),
    document: onlyDigits(data.customer?.document ?? normalizedCustomer.document),
    address: normalizedCustomer.address,
  }

  const storageKey = `clickfood_customer_${restaurant.id}`

  window.localStorage.setItem(storageKey, JSON.stringify(confirmedCustomer))
  setPublicCustomer(confirmedCustomer)
  setCustomerModalOpen(false)
}

const logoutPublicCustomer = () => {
  if (restaurant?.id) {
    window.localStorage.removeItem(`clickfood_customer_${restaurant.id}`)
  }

  setPublicCustomer(null)
  setCustomerLoyalty(null)
  setCustomerCashback(null)
  setCustomerOrderHistory([])
  setProfileModalOpen(false)
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

  if (publicCustomer?.phone) {
    const historyKey = `clickfood_order_history_${restaurant.id}_${onlyDigits(publicCustomer.phone)}`
    const currentHistory = (() => {
      try {
        const savedHistory = window.localStorage.getItem(historyKey)
        const parsedHistory = savedHistory ? JSON.parse(savedHistory) : []

        return Array.isArray(parsedHistory) ? parsedHistory : []
      } catch {
        return []
      }
    })() as CustomerVisibleOrder[]

    const nextHistory = [
      nextOrder,
      ...currentHistory.filter((historyOrder) => historyOrder?.id !== nextOrder.id),
    ].slice(0, 20)

    window.localStorage.setItem(historyKey, JSON.stringify(nextHistory))
    setCustomerOrderHistory(nextHistory)
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

  if (publicCustomer?.phone) {
    const historyKey = `clickfood_order_history_${restaurant.id}_${onlyDigits(publicCustomer.phone)}`

    try {
      const savedHistory = window.localStorage.getItem(historyKey)
      const parsedHistory = savedHistory ? JSON.parse(savedHistory) : []
      const currentHistory = Array.isArray(parsedHistory) ? parsedHistory : []

      const nextHistory = [
        optimisticOrder,
        ...currentHistory.filter((historyOrder: CustomerVisibleOrder) => historyOrder?.id !== optimisticOrder.id),
      ].slice(0, 20)

      window.localStorage.setItem(historyKey, JSON.stringify(nextHistory))
      setCustomerOrderHistory(nextHistory)
    } catch {
      setCustomerOrderHistory((currentHistory) => [
        optimisticOrder,
        ...currentHistory.filter((historyOrder) => historyOrder.id !== optimisticOrder.id),
      ].slice(0, 20))
    }
  }

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
        notifyRestaurant: true,
        notificationType: "order_review",
        notificationTitle: "Nova avaliação recebida",
        notificationMessage: review
          ? `Cliente avaliou o pedido #${activeOrder.public_order_number || activeOrder.id.slice(0, 8)} com ${rating} estrela${rating > 1 ? "s" : ""}: ${review}`
          : `Cliente avaliou o pedido #${activeOrder.public_order_number || activeOrder.id.slice(0, 8)} com ${rating} estrela${rating > 1 ? "s" : ""}.`,
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
      {/* BLOCO: topo compacto do restaurante */}
      <div className="mx-auto max-w-[480px] px-3 pt-3">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-[0_22px_60px_-38px_rgba(15,23,42,0.8)]">
            <div className="relative h-[178px] overflow-hidden">
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
                    background: `linear-gradient(135deg, ${themeColor} 0%, #1e293b 60%, ${accentColor} 100%)`,
                  }}
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

              <div className="absolute left-3 top-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/15 px-3 py-1.5 text-xs font-black text-white backdrop-blur-md">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      restaurantIsOpen ? "bg-green-400" : "bg-red-400"
                    )}
                  />
                  {restaurantIsOpen ? "Aberto" : "Fechado"}
                </span>

                {tableNumber && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/15 px-3 py-1.5 text-xs font-black text-white backdrop-blur-md">
                    <Utensils className="h-3.5 w-3.5" />
                    Mesa {tableNumber}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setProfileModalOpen(true)}
                className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/90 text-gray-900 shadow-lg backdrop-blur-md transition-transform active:scale-95"
                aria-label="Acessar minha conta"
              >
                <UserRound className="h-5 w-5" />
                {publicCustomer && (
                  <span
                    className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white"
                    style={{ backgroundColor: accentColor }}
                  />
                )}
              </button>

              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="flex items-end gap-3">
                  <div className="flex h-[62px] w-[62px] shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-white/30 bg-white shadow-xl">
                    {restaurant.logoUrl && !logoFailedToLoad ? (
                      <Image
                        src={restaurant.logoUrl}
                        alt={restaurant.name}
                        width={90}
                        height={90}
                        className="h-full w-full object-cover"
                        onError={() => setLogoFailedToLoad(true)}
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center"
                        style={{ backgroundColor: themeColor }}
                      >
                        <Store className="h-7 w-7 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 pb-0.5">
                    <h1 className="truncate text-xl font-black tracking-tight text-white">
                      {restaurant.name}
                    </h1>

                    <p className="mt-1 line-clamp-1 text-sm font-medium text-white/80">
                      {restaurant.description?.trim() || "Cardápio digital com pedido rápido."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3">
              <div className="rounded-2xl bg-gray-50 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                  Mínimo
                </p>

                <p className="mt-1 truncate text-sm font-black text-gray-900">
                  {formatPrice(minimumOrder)}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                  {deliveryEnabled ? "Entrega" : "Retirada"}
                </p>

                <p className="mt-1 truncate text-sm font-black text-gray-900">
                 {deliveryEnabled ? formatPrice(startingDeliveryFee) : "No local"}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                  Tempo
                </p>

                <p className="mt-1 truncate text-sm font-black text-gray-900">
                  {estimatedDeliveryTime}
                </p>
              </div>
            </div>

            {hasRating && (
              <div className="border-t border-gray-100 px-3 pb-3">
                <div className="flex items-center justify-center gap-1.5 rounded-2xl bg-yellow-50 px-3 py-2 text-xs font-black text-yellow-700">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  {ratingAverage.toFixed(1)} ({ratingCount} {ratingCount === 1 ? "avaliação" : "avaliações"})
                </div>
              </div>
            )}
          </div>
        </div>

        {!restaurantIsOpen && (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {restaurant.closedMessage?.trim()
              ? restaurant.closedMessage
              : "Estamos fechados no momento. Voltamos em breve!"}
          </div>
        )}

        {activeOrder && (
          <OrderTrackingCard
            order={activeOrder}
            accentColor={themeColor}
            restaurantWhatsApp={restaurant.whatsapp}
            hasActiveLoyaltyCampaign={Boolean(customerLoyalty?.loyalty_campaigns?.is_active)}
            onConfirmReceived={confirmActiveOrderReceived}
          />
        )}

        {/* BLOCO: busca do cardápio */}
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
      <div className="mx-auto max-w-[480px] px-3">
        <FeaturedOffersSection
          items={featuredProducts}
          accentColor={themeColor}
          onSelect={(product, categoryId) => {
            setSelectedProduct({ product, categoryId })
          }}
          onQuickAdd={(product, categoryId) => {
            handleAddWithUpsell(
              {
                product,
                quantity: 1,
                notes: "",
                modifiers: [],
                unitPrice: product.price,
              },
              categoryId
            )
          }}
        />
      </div>

      {/* BLOCO: categorias fixas no topo ao rolar */}
      {filteredCategories.length > 1 && (
        <div className="sticky top-2 z-30 mt-5">
          <div className="mx-auto max-w-[480px] px-3">
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

      {/* BLOCO: lista principal de produtos */}
      <div className="mx-auto mt-5 max-w-[480px] space-y-7 px-3 pb-28">
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
            const upsellCategoryId =
              visibleCategories.find((category) =>
                category.products.some((menuProduct) => menuProduct.id === product.id)
              )?.id ?? ""

            if (productHasRequiredModifiers(product) && upsellCategoryId) {
              setSelectedProduct({ product, categoryId: upsellCategoryId })
              setUpsellProducts(null)
              return
            }

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

      <CustomerProfileModal
        open={profileModalOpen}
        customer={publicCustomer}
        loyalty={customerLoyalty}
        cashbackStatus={customerCashback}
        orderHistory={customerOrderHistory}
        activeOrder={activeOrder}
        accentColor={themeColor}
        onClose={() => setProfileModalOpen(false)}
        onLogin={() => {
          setProfileModalOpen(false)
          openCustomerAccessModal("profile", false)
        }}
        onLogout={logoutPublicCustomer}
       onRepeatOrder={handleRepeatOrder}
      />

      <CustomerStartModal
        open={customerModalOpen}
        restaurantName={restaurant.name}
        accentColor={themeColor}
        initialCustomer={publicCustomer}
        mode={customerModalMode}
        requireDocument={customerModalRequiresDocument}
        onClose={() => setCustomerModalOpen(false)}
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
        onEditCustomer={() => openCustomerAccessModal("checkout", false)}
        onSaveAddress={savePublicCustomerAddress}
        onOrderCreated={saveActiveOrder}
      />
    </div>
  )
}