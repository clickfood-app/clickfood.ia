// ── Menu Data Layer ──
// Public-facing menu data, multi-tenant ready for Supabase.
// Each restaurant has a slug, store info, and products from products-data.

import { initialProducts, initialCategories, type Product, type Category } from "@/lib/products-data"
import { defaultStoreData, defaultOperationData, defaultDeliveryData } from "@/lib/settings-data"

// ── Product Image Map ──
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

// ── Restaurant (tenant) ──
export interface Restaurant {
  id: string
  slug: string
  name: string
  description: string
  logoUrl: string | null
  phone: string
  whatsapp: string
  address: string
  city: string
  state: string
  openTime: string
  closeTime: string
  avgPrepTime: number
  deliveryFee: number
  minOrderValue: number
  avgDeliveryTime: number
  pickupEnabled: boolean
}

export interface MenuProduct extends Product {
  imageUrl: string | null
}

export interface MenuCategory extends Category {
  products: MenuProduct[]
}

// ── Get restaurant by slug (mock, ready for Supabase) ──
export function getRestaurantBySlug(slug: string): Restaurant | null {
  // In production: fetch from Supabase where slug = slug
  if (slug === "adminpro-restaurante") {
    return {
      id: "rest-adminpro",
      slug: "adminpro-restaurante",
      name: defaultStoreData.name,
      description: "Hamburguer artesanal, lanches especiais e muito sabor. Delivery e retirada.",
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
      minOrderValue: defaultDeliveryData.minOrderValue,
      avgDeliveryTime: defaultDeliveryData.avgDeliveryTime,
      pickupEnabled: defaultDeliveryData.pickupEnabled,
    }
  }
  return null
}

// ── Get menu categories with products ──
export function getMenuCategories(slug: string): MenuCategory[] {
  // In production: fetch from Supabase where restaurant_slug = slug AND active = true
  if (slug !== "adminpro-restaurante") return []

  const activeProducts = initialProducts.filter((p) => p.active)

  return initialCategories
    .map((cat) => ({
      ...cat,
      products: activeProducts
        .filter((p) => p.category === cat.id)
        .sort((a, b) => a.order - b.order)
        .map((p) => ({
          ...p,
          imageUrl: productImageMap[p.id] || null,
        })),
    }))
    .filter((cat) => cat.products.length > 0)
}

// ── Check if restaurant is currently open ──
export function isRestaurantOpen(restaurant: Restaurant): boolean {
  // Deterministic check based on hours only (no timezone issues)
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
  // Wraps midnight
  return currentMinutes >= openMinutes || currentMinutes < closeMinutes
}

// ── Format price ──
export function formatPrice(value: number): string {
  const formatted = value.toFixed(2).replace(".", ",")
  return `R$ ${formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`
}
