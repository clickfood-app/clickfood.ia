// ── Menu Data Layer ──
// Public-facing menu data, multi-tenant ready for Supabase.

import { supabase } from "./supabase"
import {
  defaultStoreData,
  defaultOperationData,
  defaultDeliveryData,
} from "@/lib/settings-data"

// ── Product Image Map (fallback local opcional) ──
export const productImageMap: Record<string, string> = {
  "prod-1": "/images/menu/x-burger.jpg",
  "prod-2": "/images/menu/x-bacon.jpg",
  "prod-3": "/images/menu/frango-crocante.jpg",
  "prod-5": "/images/menu/x-tudo.jpg",
  "prod-6": "/images/menu/refrigerante.jpg",
  "prod-7": "/images/menu/suco-natural.jpg",
  "prod-8": "/images/menu/milkshake.jpg",
  "prod-10": "/images/menu/brownie.jpg",
  "prod-11": "/images/menu/churros.jpg",
  "prod-13": "/images/menu/batata-frita.jpg",
  "prod-14": "/images/menu/onion-rings.jpg",
  "prod-15": "/images/menu/nuggets.jpg",
}

// ── Restaurant ──
export interface Restaurant {
  id: string
  name: string
  slug: string
  description: string
  logoUrl?: string | null
  phone: string
  whatsapp: string
  address: string
  city: string
  state: string
  openTime: string
  closeTime: string
  avgPrepTime: number
  deliveryFee: number
  minimumOrder: number
  estimatedDeliveryTime: string
  deliveryEnabled: boolean
  pickupEnabled: boolean
  themeColor?: string | null
  coverImageUrl?: string | null
  themeMode?: string | null
  floatingCartBgColor?: string | null
  floatingCartTextColor?: string | null
  floatingCartNumberColor?: string | null
}

// ── Public menu types ──
export interface MenuProduct {
  id: string
  restaurantId: string
  categoryId: string | null
  category: string
  name: string
  description: string
  price: number
  cost: number
  active: boolean
  salesCount: number
  order: number
  image: string | null
  imageSize?: number | null
  imageUrl: string | null
}

export interface MenuCategory {
  id: string
  name: string
  description: string
  order: number
  active: boolean
  products: MenuProduct[]
}

type RestaurantRow = {
  id: string
  slug: string
  name: string
  description: string | null
  logo_url: string | null
  phone: string | null
  whatsapp?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  open_time?: string | null
  close_time?: string | null
  avg_prep_time?: number | null
  delivery_fee?: number | null
  minimum_order?: number | null
  estimated_delivery_time?: string | null
  delivery_enabled?: boolean | null
  pickup_enabled?: boolean | null
  theme_color?: string | null
  cover_image_url?: string | null
  theme_mode?: string | null
  floating_cart_bg_color?: string | null
  floating_cart_text_color?: string | null
  floating_cart_number_color?: string | null
}

type CategoryRow = {
  id: string
  restaurant_id: string
  name: string
  sort_order: number | null
  is_active: boolean | null
  created_at?: string | null
}

type ProductRow = {
  id: string
  restaurant_id: string
  category_id: string | null
  name: string
  description: string | null
  price: number | string | null
  image_url: string | null
  is_available: boolean | null
  sort_order: number | null
  created_at?: string | null
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export async function getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .single()

  if (error || !data) {
    if (slug === "adminpro-restaurante") {
      return {
        id: "rest-adminpro",
        slug: "adminpro-restaurante",
        name: defaultStoreData.name,
        description:
          "Hamburguer artesanal, lanches especiais e muito sabor. Delivery e retirada.",
        logoUrl: null,
        phone: defaultStoreData.phone,
        whatsapp: defaultStoreData.whatsapp,
        address: defaultStoreData.address,
        city: defaultStoreData.city,
        state: defaultStoreData.state,
        openTime: defaultOperationData.openTime,
        closeTime: defaultOperationData.closeTime,
        avgPrepTime: defaultOperationData.avgPrepTime,
        deliveryFee: defaultDeliveryData.fixedFee,
        minimumOrder: defaultDeliveryData.minOrderValue,
        estimatedDeliveryTime: "30-45 min",
        deliveryEnabled: true,
        pickupEnabled: defaultDeliveryData.pickupEnabled,
        themeColor: null,
        coverImageUrl: null,
        themeMode: "dark",
        floatingCartBgColor: null,
        floatingCartTextColor: null,
        floatingCartNumberColor: null,
      }
    }

    return null
  }

  const row = data as RestaurantRow

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    logoUrl: row.logo_url ?? null,
    phone: row.phone ?? "",
    whatsapp: row.whatsapp ?? row.phone ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    openTime: row.open_time ?? defaultOperationData.openTime,
    closeTime: row.close_time ?? defaultOperationData.closeTime,
    avgPrepTime: toNumber(row.avg_prep_time, defaultOperationData.avgPrepTime),
    deliveryFee: toNumber(row.delivery_fee, defaultDeliveryData.fixedFee),
    minimumOrder: toNumber(row.minimum_order, 0),
    estimatedDeliveryTime: row.estimated_delivery_time ?? "30-45 min",
    deliveryEnabled:
      typeof row.delivery_enabled === "boolean" ? row.delivery_enabled : true,
    pickupEnabled:
      typeof row.pickup_enabled === "boolean"
        ? row.pickup_enabled
        : defaultDeliveryData.pickupEnabled,
    themeColor: row.theme_color ?? null,
    coverImageUrl: row.cover_image_url ?? null,
    themeMode: row.theme_mode ?? "dark",
    floatingCartBgColor: row.floating_cart_bg_color ?? row.theme_color ?? null,
    floatingCartTextColor: row.floating_cart_text_color ?? null,
    floatingCartNumberColor: row.floating_cart_number_color ?? null,
  }
}

export async function getMenuCategories(slug: string): Promise<MenuCategory[]> {
  const restaurant = await getRestaurantBySlug(slug)

  if (!restaurant?.id) {
    return []
  }

  const [categoriesResult, productsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, restaurant_id, name, sort_order, is_active, created_at")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),

    supabase
      .from("products")
      .select(
        "id, restaurant_id, category_id, name, description, price, image_url, is_available, sort_order, created_at"
      )
      .eq("restaurant_id", restaurant.id)
      .eq("is_available", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ])

  if (categoriesResult.error) {
    console.error("Erro ao buscar categorias:", {
      message: categoriesResult.error.message,
      details: categoriesResult.error.details,
      hint: categoriesResult.error.hint,
      code: categoriesResult.error.code,
      full: categoriesResult.error,
    })
    return []
  }

  if (productsResult.error) {
    console.error("Erro ao buscar produtos:", {
      message: productsResult.error.message,
      details: productsResult.error.details,
      hint: productsResult.error.hint,
      code: productsResult.error.code,
      full: productsResult.error,
    })
    return []
  }

  const categoryRows = (categoriesResult.data ?? []) as CategoryRow[]
  const productRows = (productsResult.data ?? []) as ProductRow[]

  const categoryMap = new Map<string, CategoryRow>()
  categoryRows.forEach((category) => {
    categoryMap.set(category.id, category)
  })

  const productsByCategory = new Map<string, MenuProduct[]>()

  for (const row of productRows) {
    const category = row.category_id ? categoryMap.get(row.category_id) : null
    const categoryKey = row.category_id ?? "sem-categoria"
    const categoryName = category?.name ?? "Sem categoria"

    const product: MenuProduct = {
      id: row.id,
      restaurantId: row.restaurant_id,
      categoryId: row.category_id,
      category: categoryName,
      name: row.name,
      description: row.description ?? "",
      price: toNumber(row.price, 0),
      cost: 0,
      active: row.is_available ?? true,
      salesCount: 0,
      order: toNumber(row.sort_order, 0),
      image: row.image_url ?? null,
      imageSize: null,
      imageUrl: row.image_url ?? productImageMap[row.id] ?? null,
    }

    const current = productsByCategory.get(categoryKey) ?? []
    current.push(product)
    productsByCategory.set(categoryKey, current)
  }

  const result: MenuCategory[] = []

  for (const category of categoryRows) {
    const products = (productsByCategory.get(category.id) ?? []).sort(
      (a, b) => a.order - b.order
    )

    if (products.length === 0) continue

    result.push({
      id: category.id,
      name: category.name,
      description: "",
      order: toNumber(category.sort_order, 0),
      active: category.is_active ?? true,
      products,
    })
  }

  const uncategorizedProducts = (productsByCategory.get("sem-categoria") ?? []).sort(
    (a, b) => a.order - b.order
  )

  if (uncategorizedProducts.length > 0) {
    result.push({
      id: "sem-categoria",
      name: "Sem categoria",
      description: "",
      order: 999999,
      active: true,
      products: uncategorizedProducts,
    })
  }

  return result.sort((a, b) => a.order - b.order)
}

export function isRestaurantOpen(restaurant: Restaurant): boolean {
  const now = new Date()
  const h = now.getUTCHours()
  const m = now.getUTCMinutes()
  const currentMinutes = h * 60 + m

  const [openH, openM] = restaurant.openTime.split(":").map(Number)
  const [closeH, closeM] = restaurant.closeTime.split(":").map(Number)

  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  if (closeMinutes > openMinutes) {
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  }

  return currentMinutes >= openMinutes || currentMinutes < closeMinutes
}

export function formatPrice(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return "R$ 0,00"
  }

  const formatted = Number(value).toFixed(2).replace(".", ",")
  return `R$ ${formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`
}