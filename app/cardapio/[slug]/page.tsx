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
  ChevronDown,
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
  efiPixEnabled?: boolean | null
  efi_pix_enabled?: boolean | null
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
    badge?: {
      type: "popular" | "promo" | "new"
      label: string
      discount?: number
    }
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

function normalizeNeighborhood(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function normalizeNeighborhoodKey(value: string | null | undefined) {
  return normalizeNeighborhood(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function isValidNeighborhoodName(value: string | null | undefined) {
  const normalizedValue = normalizeNeighborhoodKey(value)

  if (!normalizedValue) return false

  return ![
    "bairro",
    "padrao",
    "bairro_padrao",
    "default",
    "selecione",
    "selecione_seu_bairro",
    "selecionar_bairro",
    "nao_informado",
  ].includes(normalizedValue)
}

function timeToMinutes(value?: string | null, fallback = 0) {
  if (!value || !value.includes(":")) return fallback

  const [hours, minutes] = value.split(":").map(Number)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback

  return hours * 60 + minutes
}

function getProductAvailabilityType(product: MenuProduct) {
  const scheduledProduct = product as ScheduledMenuProduct

  return (
    scheduledProduct.availabilityType ??
    scheduledProduct.availability_type ??
    "always"
  )
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
      .filter(
        (weekday) =>
          Number.isInteger(weekday) && weekday >= 0 && weekday <= 6
      )
  }

  const weekday = Number(rule.weekday)

  if (Number.isInteger(weekday) && weekday >= 0 && weekday <= 6) {
    return [weekday]
  }

  return []
}

function isTimeInsideRange(
  currentMinutes: number,
  startMinutes: number,
  endMinutes: number
) {
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
    displayCategoryId:
      activeRule.displayCategoryId ??
      activeRule.display_category_id ??
      null,
    isScheduled: true,
  }
}

function getVisibleMenuCategories(
  categories: MenuCategory[],
  now = new Date()
) {
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
        categoryMap.get(availability.displayCategoryId ?? "") ??
        categoryMap.get(category.id)

      if (!targetCategory) return

      const productKey = `${targetCategory.id}:${product.id}`

      if (addedProducts.has(productKey)) return

      targetCategory.products.push(product)
      addedProducts.add(productKey)
    })
  })

  return orderedCategories.filter(
    (category) => category.products.length > 0
  )
}

function isScheduledProduct(product: MenuProduct) {
  return getProductAvailabilityType(product) === "scheduled"
}

function isOpenNow(restaurant: PublicRestaurant) {
  const now = new Date()
  const currentDay = WEEK_DAYS[now.getDay()]
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const activeDays =
    Array.isArray(restaurant.activeDays) &&
    restaurant.activeDays.length > 0
      ? restaurant.activeDays
      : ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]

  if (restaurant.closedToday) return false
  if (!activeDays.includes(currentDay)) return false

  const openMinutes = timeToMinutes(restaurant.openTime, 11 * 60)
  const closeMinutes = timeToMinutes(restaurant.closeTime, 23 * 60)

  if (closeMinutes === openMinutes) return false

  if (closeMinutes > openMinutes) {
    return (
      currentMinutes >= openMinutes &&
      currentMinutes < closeMinutes
    )
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
    <div className="min-h-screen bg-slate-50">
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
          background: linear-gradient(
            90deg,
            #f0f0f0 25%,
            #e0e0e0 50%,
            #f0f0f0 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>

      <div className="relative h-[156px] bg-gradient-to-br from-blue-600 to-orange-500" />

      <div className="relative z-10 mx-auto -mt-14 max-w-[480px] px-3">
        <div className="flex items-end gap-4">
          <div className="h-20 w-20 rounded-2xl skeleton-shimmer ring-4 ring-white shadow-lg" />

          <div className="flex-1 space-y-2.5 pb-1">
            <div className="h-5 w-2/3 rounded-lg skeleton-shimmer" />
            <div className="h-3.5 w-1/2 rounded-lg skeleton-shimmer" />
          </div>
        </div>

        <div className="mt-5 h-12 rounded-xl skeleton-shimmer" />
        <div className="mt-4 h-44 rounded-[28px] skeleton-shimmer" />

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
              className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <div className="flex-1 space-y-2.5">
                <div className="h-4 w-3/4 rounded-lg skeleton-shimmer" />
                <div className="h-3 w-full rounded-lg skeleton-shimmer" />
                <div className="h-3 w-2/3 rounded-lg skeleton-shimmer" />
                <div className="mt-1 h-5 w-1/4 rounded-lg skeleton-shimmer" />
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
  badge: {
    type: "popular" | "promo" | "new"
    label: string
  }
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wide",
        badge.type === "popular" &&
          "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
        badge.type === "promo" &&
          "bg-orange-50 text-orange-700 ring-1 ring-orange-100",
        badge.type === "new" &&
          "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
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
    promotionalProduct.originalPrice ??
      promotionalProduct.original_price ??
      0
  )

  const realPromotionalPrice = Number(
    promotionalProduct.promotionalPrice ??
      promotionalProduct.promotional_price ??
      0
  )

  const realDiscountPercentage = Number(
    promotionalProduct.discountPercentage ??
      promotionalProduct.discount_percentage ??
      0
  )

  const realPromotionIsActive =
    Boolean(
      promotionalProduct.isPromotional ??
        promotionalProduct.is_promotional
    ) &&
    realOriginalPrice > 0 &&
    realPromotionalPrice > 0 &&
    realPromotionalPrice < realOriginalPrice

  if (realPromotionIsActive) {
    return {
      badge: {
        type: "promo" as const,
        label: `${
          realDiscountPercentage ||
          Math.round(
            ((realOriginalPrice - realPromotionalPrice) /
              realOriginalPrice) *
              100
          )
        }% OFF`,
        discount:
          realDiscountPercentage ||
          Math.round(
            ((realOriginalPrice - realPromotionalPrice) /
              realOriginalPrice) *
              100
          ),
      },
      discount:
        realDiscountPercentage ||
        Math.round(
          ((realOriginalPrice - realPromotionalPrice) /
            realOriginalPrice) *
            100
        ),
      originalPrice: realOriginalPrice,
      promotionalPrice: realPromotionalPrice,
      isPromotional: true,
    }
  }

  const badge = productMeta[product.id]?.badge
  const discount =
    badge?.type === "promo" ? Number(badge.discount || 0) : 0

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

function formatMenuProductDescription(
  description?: string | null
) {
  const cleanedDescription = (description || "")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim()

  if (!cleanedDescription) {
    return "Toque para ver detalhes e personalizar este item."
  }

  const lowerDescription =
    cleanedDescription.toLocaleLowerCase("pt-BR")

  return lowerDescription.replace(
    /(^|[.!?]\s+)([a-záàâãéèêíïóôõöúçñ])/g,
    (_match, prefix, letter) => {
      return `${prefix}${String(letter).toLocaleUpperCase("pt-BR")}`
    }
  )
}

function getPromotionLabel(discount: number) {
  if (!Number.isFinite(discount) || discount <= 0) {
    return "Oferta"
  }

  return `${Math.round(discount)}% OFF`
}

function MenuImagePlaceholder({
  compact = false,
}: {
  compact?: boolean
}) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-50 via-white to-orange-50">
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-white text-blue-600 shadow-sm ring-1 ring-blue-100",
          compact ? "h-10 w-10" : "h-14 w-14"
        )}
      >
        <Utensils
          className={compact ? "h-5 w-5" : "h-7 w-7"}
        />
      </div>
    </div>
  )
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
  onSelect: (
    product: MenuProduct,
    categoryId: string
  ) => void
  onQuickAdd: (
    product: MenuProduct,
    categoryId: string
  ) => void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const { discount, originalPrice } =
    getProductPromotion(product)

  const handleQuickAdd = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
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

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ) => {
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
      className="group min-w-[132px] max-w-[132px] cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-left shadow-sm transition-colors hover:border-blue-300 active:scale-[0.99]"
    >
      <div className="relative h-[96px] overflow-hidden rounded-lg bg-slate-100">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            loading="lazy"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="132px"
          />
        ) : (
          <MenuImagePlaceholder compact />
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-1.5 pt-7">
          <span className="inline-flex rounded-md bg-white px-1.5 py-0.5 text-[9px] font-black text-orange-600 shadow-sm">
            {discount > 0
              ? getPromotionLabel(discount)
              : "Destaque"}
          </span>
        </div>

        <button
          type="button"
          onClick={handleQuickAdd}
          className={cn(
            "absolute right-1.5 top-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-all",
            isAdding
              ? "scale-105 bg-emerald-500"
              : "active:scale-95"
          )}
          style={
            isAdding
              ? undefined
              : { backgroundColor: accentColor }
          }
          aria-label={`Adicionar ${product.name}`}
        >
          {isAdding ? (
            <Check
              className="h-3.5 w-3.5"
              strokeWidth={3}
            />
          ) : (
            <Plus
              className="h-4 w-4"
              strokeWidth={3}
            />
          )}
        </button>
      </div>

      <div className="flex min-w-0 flex-col px-1 pb-1 pt-2">
        <h3 className="line-clamp-2 min-h-[32px] text-[12px] font-black leading-4 text-slate-900">
          {product.name}
        </h3>

        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="min-w-0">
            {originalPrice && (
              <p className="text-[10px] font-bold text-slate-400 line-through">
                {formatPrice(originalPrice)}
              </p>
            )}

            <p className="text-[12px] font-black leading-none text-orange-600">
              A partir de {formatPrice(product.price)}
            </p>
          </div>
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
  items: Array<{
    product: MenuProduct
    categoryId: string
  }>
  accentColor: string
  onSelect: (
    product: MenuProduct,
    categoryId: string
  ) => void
  onQuickAdd: (
    product: MenuProduct,
    categoryId: string
  ) => void
}) {
  if (items.length === 0) return null

  return (
    <section className="mt-5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-[17px] font-black tracking-tight text-slate-900">
          Destaques
        </h2>

        <span className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700 ring-1 ring-blue-100">
          Ver todos
        </span>
      </div>

      <div className="-mx-3 flex gap-2.5 overflow-x-auto px-3 pb-2 scrollbar-hide">
        {items
          .slice(0, 8)
          .map(({ product, categoryId }) => (
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

  const {
    badge,
    discount,
    originalPrice,
    isPromotional,
  } = getProductPromotion(product)

  const formattedDescription =
    formatMenuProductDescription(product.description)

  const handleQuickAdd = (
    event: React.MouseEvent
  ) => {
    event.stopPropagation()

    if (productHasRequiredModifiers(product)) {
      onSelect()
      return
    }

    setIsAdding(true)
    setShowRipple(true)

    if (navigator.vibrate) {
      navigator.vibrate(10)
    }

    onQuickAdd()

    setTimeout(() => {
      setIsAdding(false)
      setShowRipple(false)
    }, 700)
  }

  return (
    <div
      className={cn(
        "group relative grid cursor-pointer grid-cols-[1fr_88px] gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200 hover:border-blue-300 active:scale-[0.99]",
        isPressing && "scale-[0.99]"
      )}
      onClick={onSelect}
      onMouseDown={() => setIsPressing(true)}
      onMouseUp={() => setIsPressing(false)}
      onMouseLeave={() => setIsPressing(false)}
      onTouchStart={() => setIsPressing(true)}
      onTouchEnd={() => setIsPressing(false)}
    >
      <div className="min-w-0 py-0.5">
        <div className="flex flex-wrap items-center gap-1.5 pr-1">
          {badge && <ProductBadge badge={badge} />}

          {isScheduledProduct(product) && (
            <div className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700 ring-1 ring-blue-100">
              <Timer className="h-3 w-3" />
              Hoje
            </div>
          )}
        </div>

        <h4 className="mt-2 line-clamp-2 text-[14px] font-black leading-[17px] tracking-tight text-slate-900">
          {product.name}
        </h4>

        <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-[17px] text-slate-500">
          {formattedDescription}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {isPromotional && (
            <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[10px] font-black text-orange-700 ring-1 ring-orange-100">
              -{getPromotionLabel(discount)}
            </span>
          )}

          <div className="flex min-w-0 items-baseline gap-2">
            {isPromotional && originalPrice && (
              <span className="text-[11px] font-bold text-slate-400 line-through">
                {formatPrice(originalPrice)}
              </span>
            )}

            {Number(product.price) > 0 && (
              <span className="text-[15px] font-black leading-none tracking-tight text-orange-600">
                A partir de {formatPrice(product.price)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="relative h-[88px] w-[88px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        {product.imageUrl ? (
          <>
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              loading="lazy"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="88px"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
          </>
        ) : (
          <MenuImagePlaceholder compact />
        )}

        <button
          type="button"
          onClick={handleQuickAdd}
          className={cn(
            "absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg text-white shadow-md transition-all duration-300",
            isAdding
              ? "scale-105 bg-emerald-500"
              : "hover:scale-105 active:scale-95"
          )}
          style={
            isAdding
              ? undefined
              : { backgroundColor: accentColor }
          }
          aria-label={`Adicionar ${product.name}`}
        >
          {showRipple && (
            <span className="absolute inset-0 animate-ping rounded-lg bg-white/40" />
          )}

          {isAdding ? (
            <Check
              className="h-4.5 w-4.5 text-white"
              strokeWidth={3}
            />
          ) : (
            <Plus
              className="h-5 w-5 text-white"
              strokeWidth={3}
            />
          )}
        </button>
      </div>
    </div>
  )
}