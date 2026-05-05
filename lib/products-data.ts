export interface Product {
  id: string
  name: string
  description: string
  price: number
  cost: number
  category: string
  active: boolean
  salesCount: number
  order: number
  image: string | null
  imageSize?: number
}

export interface Category {
  id: string
  name: string
  description?: string
  order: number
  active: boolean
}

export type ViewMode = "management" | "menu"

export type SortOption = "manual" | "name" | "price" | "profit"

export type ProductQuickFilter = "low-margin" | "low-sales" | "no-image" | "no-cost"

export type ProductIndicator = "best-seller" | "low-margin" | "low-sales" | null

export const LOW_MARGIN_THRESHOLD = 20
export const LOW_SALES_THRESHOLD = 5

export function hasLowMargin(product: Product): boolean {
  return product.active && getMargin(product.price, product.cost) < LOW_MARGIN_THRESHOLD
}

export function hasLowSales(product: Product): boolean {
  return product.active && product.salesCount < LOW_SALES_THRESHOLD
}

export function hasImage(product: Product): boolean {
  return Boolean(product.image)
}

export function hasRegisteredCost(product: Product): boolean {
  return product.cost > 0
}

export function getProductIndicator(
  product: Product,
  allProducts: Product[]
): ProductIndicator {
  if (allProducts.length === 0) return null

  const maxSales = Math.max(...allProducts.map((p) => p.salesCount))

  if (product.salesCount === maxSales && product.salesCount > 0) return "best-seller"
  if (hasLowMargin(product)) return "low-margin"
  if (hasLowSales(product)) return "low-sales"
  return null
}

export function getProfit(price: number, cost: number): number {
  return price - cost
}

export function getMargin(price: number, cost: number): number {
  if (price <= 0) return 0
  return ((price - cost) / price) * 100
}

export const initialCategories: Category[] = []

export const initialProducts: Product[] = []
