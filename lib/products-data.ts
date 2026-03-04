export interface Product {
  id: string
  name: string
  description: string
  price: number
  cost: number
  category: string
  active: boolean
  /** Sales count for indicators */
  salesCount: number
  /** Order within its category */
  order: number
  /** Base64 data URL or image_url — ready for Supabase Storage migration */
  image: string | null
  /** Image size in bytes for validation */
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

export type SortOption = "name" | "price" | "profit"

export type ProductIndicator = "best-seller" | "low-margin" | "low-sales" | null

export function getProductIndicator(product: Product, allProducts: Product[]): ProductIndicator {
  const maxSales = Math.max(...allProducts.map((p) => p.salesCount))
  const margin = product.price > 0 ? ((product.price - product.cost) / product.price) * 100 : 0

  if (product.salesCount === maxSales && product.salesCount > 0) return "best-seller"
  if (margin < 20 && product.active) return "low-margin"
  if (product.salesCount < 5 && product.active) return "low-sales"
  return null
}

export function getProfit(price: number, cost: number): number {
  return price - cost
}

export function getMargin(price: number, cost: number): number {
  if (price <= 0) return 0
  return ((price - cost) / price) * 100
}

export const initialCategories: Category[] = [
  { id: "cat-1", name: "Lanches", description: "Hamburgueres, sanduiches e pratos principais", order: 0, active: true },
  { id: "cat-2", name: "Bebidas", description: "Refrigerantes, sucos e drinks", order: 1, active: true },
  { id: "cat-3", name: "Sobremesas", description: "Doces e sobremesas especiais", order: 2, active: true },
  { id: "cat-4", name: "Acompanhamentos", description: "Porcoes e complementos", order: 3, active: true },
]

export const initialProducts: Product[] = [
  {
    id: "prod-1",
    name: "X-Burger Clássico",
    description: "Pão brioche, burger 180g, queijo cheddar, alface, tomate e molho especial",
    price: 32.9,
    cost: 12.5,
    category: "cat-1",
    active: true,
    salesCount: 142,
    order: 0,
    image: null,
  },
  {
    id: "prod-2",
    name: "X-Bacon Duplo",
    description: "Pão brioche, 2 burgers, bacon crocante, queijo prato e molho barbecue",
    price: 42.9,
    cost: 18.0,
    category: "cat-1",
    active: true,
    salesCount: 98,
    order: 1,
    image: null,
  },
  {
    id: "prod-3",
    name: "Frango Crocante",
    description: "Filé de frango empanado, alface, tomate e maionese temperada",
    price: 28.9,
    cost: 11.0,
    category: "cat-1",
    active: true,
    salesCount: 67,
    order: 2,
    image: null,
  },
  {
    id: "prod-4",
    name: "Veggie Burger",
    description: "Burger de grão-de-bico, rúcula, tomate seco e molho tahine",
    price: 34.9,
    cost: 15.0,
    category: "cat-1",
    active: false,
    salesCount: 12,
    order: 3,
    image: null,
  },
  {
    id: "prod-5",
    name: "X-Tudo Especial",
    description: "Pão australiano, burger 200g, bacon, ovo, presunto, queijo e molho da casa",
    price: 48.9,
    cost: 22.0,
    category: "cat-1",
    active: true,
    salesCount: 85,
    order: 4,
    image: null,
  },
  {
    id: "prod-6",
    name: "Refrigerante Lata",
    description: "Coca-Cola, Guaraná ou Sprite - 350ml",
    price: 7.9,
    cost: 3.5,
    category: "cat-2",
    active: true,
    salesCount: 130,
    order: 0,
    image: null,
  },
  {
    id: "prod-7",
    name: "Suco Natural",
    description: "Laranja, limão, maracujá ou abacaxi - 400ml",
    price: 12.9,
    cost: 4.0,
    category: "cat-2",
    active: true,
    salesCount: 56,
    order: 1,
    image: null,
  },
  {
    id: "prod-8",
    name: "Milk Shake",
    description: "Chocolate, morango ou baunilha com chantilly - 500ml",
    price: 18.9,
    cost: 6.5,
    category: "cat-2",
    active: true,
    salesCount: 43,
    order: 2,
    image: null,
  },
  {
    id: "prod-9",
    name: "Água Mineral",
    description: "Com ou sem gás - 500ml",
    price: 4.9,
    cost: 1.2,
    category: "cat-2",
    active: true,
    salesCount: 3,
    order: 3,
    image: null,
  },
  {
    id: "prod-10",
    name: "Brownie de Chocolate",
    description: "Brownie artesanal com sorvete de creme e calda quente",
    price: 22.9,
    cost: 8.0,
    category: "cat-3",
    active: true,
    salesCount: 74,
    order: 0,
    image: null,
  },
  {
    id: "prod-11",
    name: "Churros Recheado",
    description: "Churros com doce de leite e canela",
    price: 14.9,
    cost: 13.0,
    category: "cat-3",
    active: true,
    salesCount: 38,
    order: 1,
    image: null,
  },
  {
    id: "prod-12",
    name: "Pudim Caseiro",
    description: "Pudim de leite condensado com calda de caramelo",
    price: 12.9,
    cost: 4.5,
    category: "cat-3",
    active: false,
    salesCount: 2,
    order: 2,
    image: null,
  },
  {
    id: "prod-13",
    name: "Batata Frita",
    description: "Porção de batata frita crocante com cheddar e bacon",
    price: 24.9,
    cost: 8.0,
    category: "cat-4",
    active: true,
    salesCount: 110,
    order: 0,
    image: null,
  },
  {
    id: "prod-14",
    name: "Onion Rings",
    description: "Anéis de cebola empanados com molho rosé",
    price: 19.9,
    cost: 6.0,
    category: "cat-4",
    active: true,
    salesCount: 52,
    order: 1,
    image: null,
  },
  {
    id: "prod-15",
    name: "Nuggets (10un)",
    description: "Nuggets de frango crocantes com molho barbecue",
    price: 22.9,
    cost: 9.0,
    category: "cat-4",
    active: true,
    salesCount: 4,
    order: 2,
    image: null,
  },
]
