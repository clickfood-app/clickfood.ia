"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Crown,
  Loader2,
  Medal,
  Package,
  Percent,
  RefreshCcw,
  Search,
  ShoppingBag,
  Star,
  TrendingUp,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Restaurant = {
  id: string
  name: string | null
}

type OrderRecord = {
  id: string
  created_at: string | null
  status?: string | null
  payment_status?: string | null
  total?: number | string | null
}

type OrderItemRecord = {
  id: string
  order_id: string | null
  product_id?: string | null
  product_name?: string | null
  name?: string | null
  item_name?: string | null
  title?: string | null
  quantity?: number | string | null
  qty?: number | string | null
  amount?: number | string | null
  unit_price?: number | string | null
  price?: number | string | null
  product_price?: number | string | null
  sale_price?: number | string | null
  total_price?: number | string | null
  subtotal?: number | string | null
  total?: number | string | null
  line_total?: number | string | null
  item_total?: number | string | null
}

type ProductRecord = {
  id: string
  name?: string | null
  title?: string | null
  price?: number | string | null
  sale_price?: number | string | null
  selling_price?: number | string | null
  final_price?: number | string | null
  base_price?: number | string | null
}

type RecipeItemRecord = {
  id: string
  product_id: string | null
  stock_item_id: string | null
  quantity?: number | string | null
  amount?: number | string | null
  used_quantity?: number | string | null
  quantity_used?: number | string | null
  required_quantity?: number | string | null
}

type StockItemRecord = {
  id: string
  name?: string | null
  title?: string | null
  unit_cost?: number | string | null
  cost_per_unit?: number | string | null
  average_cost?: number | string | null
  current_cost?: number | string | null
  last_cost?: number | string | null
  cost?: number | string | null
  price?: number | string | null
  purchase_price?: number | string | null
  last_purchase_price?: number | string | null
}

type ProductRanking = {
  key: string
  productId: string | null
  name: string
  quantitySold: number
  revenue: number
  averagePrice: number
  recipeCost: number
  totalCost: number
  grossProfit: number
  cmvPercentage: number
  marginPercentage: number
  revenueShare: number
  ordersCount: number
  hasRecipe: boolean
  missingCostItems: number
  status: "star" | "high_margin" | "low_margin" | "no_recipe" | "attention"
  statusLabel: string
}

type PeriodFilter = "today" | "7d" | "30d" | "90d" | "all"
type PaymentFilter = "paid" | "pending" | "all"
type SortFilter = "revenue" | "quantity" | "profit" | "margin" | "cmv"

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

function formatMoney(value: number) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0)
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%"
  return `${value.toFixed(1).replace(".", ",")}%`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".")
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function firstPositiveNumber(...values: unknown[]) {
  for (const value of values) {
    const number = toNumber(value)
    if (number > 0) return number
  }

  return 0
}

function getProductName(product?: ProductRecord | null) {
  return product?.name || product?.title || "Produto sem nome"
}

function getOrderItemName(item: OrderItemRecord, product?: ProductRecord | null) {
  return (
    item.product_name ||
    item.name ||
    item.item_name ||
    item.title ||
    getProductName(product)
  )
}

function getProductPrice(product?: ProductRecord | null) {
  if (!product) return 0

  return firstPositiveNumber(
    product.price,
    product.sale_price,
    product.selling_price,
    product.final_price,
    product.base_price,
  )
}

function getItemQuantity(item: OrderItemRecord) {
  return (
    firstPositiveNumber(item.quantity, item.qty, item.amount) ||
    1
  )
}

function getItemUnitPrice(item: OrderItemRecord, product?: ProductRecord | null) {
  return firstPositiveNumber(
    item.unit_price,
    item.price,
    item.product_price,
    item.sale_price,
    getProductPrice(product),
  )
}

function getItemTotal(item: OrderItemRecord, product?: ProductRecord | null) {
  const quantity = getItemQuantity(item)
  const unitPrice = getItemUnitPrice(item, product)

  return (
    firstPositiveNumber(
      item.total_price,
      item.subtotal,
      item.total,
      item.line_total,
      item.item_total,
    ) ||
    quantity * unitPrice
  )
}

function getRecipeQuantity(item: RecipeItemRecord) {
  return firstPositiveNumber(
    item.quantity,
    item.amount,
    item.used_quantity,
    item.quantity_used,
    item.required_quantity,
  )
}

function getStockUnitCost(stockItem?: StockItemRecord) {
  if (!stockItem) return 0

  return firstPositiveNumber(
    stockItem.unit_cost,
    stockItem.cost_per_unit,
    stockItem.average_cost,
    stockItem.current_cost,
    stockItem.last_cost,
    stockItem.cost,
    stockItem.purchase_price,
    stockItem.last_purchase_price,
    stockItem.price,
  )
}

function getPeriodStart(period: PeriodFilter) {
  const now = new Date()
  const start = new Date(now)

  if (period === "today") {
    start.setHours(0, 0, 0, 0)
    return start
  }

  if (period === "7d") {
    start.setDate(now.getDate() - 7)
    return start
  }

  if (period === "30d") {
    start.setDate(now.getDate() - 30)
    return start
  }

  if (period === "90d") {
    start.setDate(now.getDate() - 90)
    return start
  }

  return null
}

function getStatus(product: ProductRanking) {
  if (!product.hasRecipe) {
    return {
      status: "no_recipe" as const,
      label: "Sem ficha",
    }
  }

  if (product.marginPercentage < 25) {
    return {
      status: "low_margin" as const,
      label: "Margem baixa",
    }
  }

  if (product.revenueShare >= 20 && product.marginPercentage >= 35) {
    return {
      status: "star" as const,
      label: "Produto estrela",
    }
  }

  if (product.marginPercentage >= 45) {
    return {
      status: "high_margin" as const,
      label: "Alta margem",
    }
  }

  return {
    status: "attention" as const,
    label: "Monitorar",
  }
}

export default function RankingProdutosPage() {
  const supabase = createClient()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [orderItems, setOrderItems] = useState<OrderItemRecord[]>([])
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [recipeItems, setRecipeItems] = useState<RecipeItemRecord[]>([])
  const [stockItems, setStockItems] = useState<StockItemRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("30d")
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("paid")
  const [sortFilter, setSortFilter] = useState<SortFilter>("revenue")
  const [searchTerm, setSearchTerm] = useState("")

  async function loadData(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError

      if (!user) {
        setError("Usuário não autenticado.")
        return
      }

      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle()

      if (restaurantError) throw restaurantError

      if (!restaurantData) {
        setError("Nenhum restaurante encontrado para este usuário.")
        return
      }

      setRestaurant(restaurantData)

      const startDate = getPeriodStart(periodFilter)

      let ordersQuery = supabase
        .from("orders")
        .select("id, created_at, status, payment_status, total")
        .eq("restaurant_id", restaurantData.id)
        .order("created_at", { ascending: false })

      if (startDate) {
        ordersQuery = ordersQuery.gte("created_at", startDate.toISOString())
      }

      const [
        ordersResponse,
        productsResponse,
        recipeItemsResponse,
        stockItemsResponse,
      ] = await Promise.all([
        ordersQuery,
        supabase
          .from("products")
          .select("*")
          .eq("restaurant_id", restaurantData.id)
          .order("name", { ascending: true }),
        supabase
          .from("product_recipe_items")
          .select("*")
          .eq("restaurant_id", restaurantData.id),
        supabase
          .from("stock_items")
          .select("*")
          .eq("restaurant_id", restaurantData.id)
          .order("name", { ascending: true }),
      ])

      if (ordersResponse.error) throw ordersResponse.error
      if (productsResponse.error) throw productsResponse.error
      if (recipeItemsResponse.error) throw recipeItemsResponse.error
      if (stockItemsResponse.error) throw stockItemsResponse.error

      const loadedOrders = (ordersResponse.data || []) as OrderRecord[]
      const orderIds = loadedOrders.map((order) => order.id)

      let loadedOrderItems: OrderItemRecord[] = []

      if (orderIds.length > 0) {
        const { data: orderItemsData, error: orderItemsError } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", orderIds)

        if (orderItemsError) throw orderItemsError

        loadedOrderItems = (orderItemsData || []) as OrderItemRecord[]
      }

      setOrders(loadedOrders)
      setOrderItems(loadedOrderItems)
      setProducts((productsResponse.data || []) as ProductRecord[])
      setRecipeItems((recipeItemsResponse.data || []) as RecipeItemRecord[])
      setStockItems((stockItemsResponse.data || []) as StockItemRecord[])
    } catch (err) {
      console.error("Erro ao carregar ranking de produtos:", err)
      setError("Não foi possível carregar o ranking de produtos.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodFilter])

  const ranking = useMemo<ProductRanking[]>(() => {
    const productById = new Map(products.map((product) => [product.id, product]))
    const stockById = new Map(stockItems.map((item) => [item.id, item]))

    const recipeCostByProductId = new Map<
      string,
      {
        cost: number
        hasRecipe: boolean
        missingCostItems: number
      }
    >()

    for (const product of products) {
      const productRecipeItems = recipeItems.filter(
        (item) => item.product_id === product.id,
      )

      let cost = 0
      let missingCostItems = 0

      for (const item of productRecipeItems) {
        const stockItem = item.stock_item_id
          ? stockById.get(item.stock_item_id)
          : undefined

        const quantity = getRecipeQuantity(item)
        const unitCost = getStockUnitCost(stockItem)

        if (quantity > 0 && unitCost <= 0) {
          missingCostItems += 1
        }

        cost += quantity * unitCost
      }

      recipeCostByProductId.set(product.id, {
        cost,
        hasRecipe: productRecipeItems.length > 0,
        missingCostItems,
      })
    }

    const validOrders = orders.filter((order) => {
      const status = String(order.status || "").toLowerCase()
      const paymentStatus = String(order.payment_status || "").toLowerCase()

      const isCanceled =
        status === "cancelled" ||
        status === "canceled" ||
        status === "cancelado"

      if (isCanceled) return false

      if (paymentFilter === "paid") {
        return paymentStatus === "paid"
      }

      if (paymentFilter === "pending") {
        return paymentStatus !== "paid"
      }

      return true
    })

    const validOrderIds = new Set(validOrders.map((order) => order.id))

    const grouped = new Map<
      string,
      {
        productId: string | null
        name: string
        quantitySold: number
        revenue: number
        orders: Set<string>
      }
    >()

    for (const item of orderItems) {
      if (!item.order_id || !validOrderIds.has(item.order_id)) continue

      const productId = item.product_id || null
      const product = productId ? productById.get(productId) : null
      const name = getOrderItemName(item, product)
      const key = productId || name.toLowerCase().trim()

      const quantity = getItemQuantity(item)
      const revenue = getItemTotal(item, product)

      const current =
        grouped.get(key) ||
        {
          productId,
          name,
          quantitySold: 0,
          revenue: 0,
          orders: new Set<string>(),
        }

      current.quantitySold += quantity
      current.revenue += revenue
      current.orders.add(item.order_id)

      grouped.set(key, current)
    }

    const totalRevenue = Array.from(grouped.values()).reduce(
      (sum, item) => sum + item.revenue,
      0,
    )

    const calculated = Array.from(grouped.entries()).map(([key, item]) => {
      const recipeInfo = item.productId
        ? recipeCostByProductId.get(item.productId)
        : null

      const recipeCost = recipeInfo?.cost || 0
      const hasRecipe = Boolean(recipeInfo?.hasRecipe)
      const totalCost = recipeCost * item.quantitySold
      const grossProfit = item.revenue - totalCost
      const averagePrice =
        item.quantitySold > 0 ? item.revenue / item.quantitySold : 0
      const cmvPercentage =
        item.revenue > 0 ? (totalCost / item.revenue) * 100 : 0
      const marginPercentage =
        item.revenue > 0 ? (grossProfit / item.revenue) * 100 : 0
      const revenueShare =
        totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0

      const baseProduct: ProductRanking = {
        key,
        productId: item.productId,
        name: item.name,
        quantitySold: item.quantitySold,
        revenue: item.revenue,
        averagePrice,
        recipeCost,
        totalCost,
        grossProfit,
        cmvPercentage,
        marginPercentage,
        revenueShare,
        ordersCount: item.orders.size,
        hasRecipe,
        missingCostItems: recipeInfo?.missingCostItems || 0,
        status: "attention",
        statusLabel: "Monitorar",
      }

      const status = getStatus(baseProduct)

      return {
        ...baseProduct,
        status: status.status,
        statusLabel: status.label,
      }
    })

    return calculated.sort((a, b) => {
      if (sortFilter === "quantity") return b.quantitySold - a.quantitySold
      if (sortFilter === "profit") return b.grossProfit - a.grossProfit
      if (sortFilter === "margin") return b.marginPercentage - a.marginPercentage
      if (sortFilter === "cmv") return b.cmvPercentage - a.cmvPercentage

      return b.revenue - a.revenue
    })
  }, [
    orders,
    orderItems,
    products,
    recipeItems,
    stockItems,
    paymentFilter,
    sortFilter,
  ])

  const filteredRanking = useMemo(() => {
    return ranking.filter((product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }, [ranking, searchTerm])

  const summary = useMemo(() => {
    const totalQuantity = ranking.reduce(
      (sum, product) => sum + product.quantitySold,
      0,
    )

    const totalRevenue = ranking.reduce(
      (sum, product) => sum + product.revenue,
      0,
    )

    const totalProfit = ranking.reduce(
      (sum, product) => sum + product.grossProfit,
      0,
    )

    const totalCost = ranking.reduce(
      (sum, product) => sum + product.totalCost,
      0,
    )

    const averageTicket = totalQuantity > 0 ? totalRevenue / totalQuantity : 0
    const averageMargin =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    const averageCmv = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0

    const productsWithoutRecipe = ranking.filter(
      (product) => !product.hasRecipe,
    ).length

    return {
      totalProducts: ranking.length,
      totalQuantity,
      totalRevenue,
      totalProfit,
      totalCost,
      averageTicket,
      averageMargin,
      averageCmv,
      productsWithoutRecipe,
      topProduct: ranking[0],
    }
  }, [ranking])

  const periodOptions = [
    { value: "today", label: "Hoje" },
    { value: "7d", label: "7 dias" },
    { value: "30d", label: "30 dias" },
    { value: "90d", label: "90 dias" },
    { value: "all", label: "Tudo" },
  ] as const

  const paymentOptions = [
    { value: "paid", label: "Pagos" },
    { value: "pending", label: "Pendentes" },
    { value: "all", label: "Todos" },
  ] as const

  const sortOptions = [
    { value: "revenue", label: "Faturamento" },
    { value: "quantity", label: "Quantidade" },
    { value: "profit", label: "Lucro bruto" },
    { value: "margin", label: "Margem" },
    { value: "cmv", label: "CMV" },
  ] as const

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                    <Medal className="h-5 w-5" />
                  </div>

                  <div>
                    <h1 className="text-xl font-bold text-slate-950">
                      Ranking de Produtos
                    </h1>
                    <p className="text-sm text-slate-500">
                      Veja quais produtos mais vendem, mais faturam e quais
                      entregam melhor margem.
                    </p>
                  </div>
                </div>

                {restaurant?.name ? (
                  <p className="text-xs font-medium text-slate-400">
                    Restaurante: {restaurant.name}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={periodFilter}
                  onChange={(event) =>
                    setPeriodFilter(event.target.value as PeriodFilter)
                  }
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  {periodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                  Atualizar
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <Loader2 className="h-7 w-7 animate-spin" />
                <p className="text-sm font-medium">
                  Carregando ranking de produtos...
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
                      Itens
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    Quantidade vendida
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {formatNumber(summary.totalQuantity)}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    Faturamento em produtos
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {formatMoney(summary.totalRevenue)}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                    <Percent className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    Margem média
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-2xl font-black",
                      summary.averageMargin >= 40
                        ? "text-emerald-600"
                        : summary.averageMargin >= 25
                          ? "text-amber-600"
                          : "text-red-600",
                    )}
                  >
                    {formatPercent(summary.averageMargin)}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 text-purple-600">
                    <Crown className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    Produto líder
                  </p>
                  <p className="mt-1 line-clamp-1 text-lg font-black text-slate-950">
                    {summary.topProduct?.name || "Sem vendas"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-slate-700" />
                    <h2 className="text-base font-bold text-slate-950">
                      Resumo do ranking
                    </h2>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Produtos vendidos
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-950">
                        {summary.totalProducts}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Custo estimado
                      </p>
                      <p className="mt-1 text-lg font-black text-orange-600">
                        {formatMoney(summary.totalCost)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Lucro bruto
                      </p>
                      <p className="mt-1 text-lg font-black text-emerald-600">
                        {formatMoney(summary.totalProfit)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Ticket médio item
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-950">
                        {formatMoney(summary.averageTicket)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-950">
                        Alertas
                      </p>
                      <p className="text-xs font-medium text-slate-500">
                        Pontos que podem distorcer o ranking.
                      </p>
                    </div>

                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-2xl bg-amber-50 p-3">
                      <span className="text-sm font-semibold text-amber-800">
                        Sem ficha técnica
                      </span>
                      <span className="text-sm font-black text-amber-900">
                        {summary.productsWithoutRecipe}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                      <span className="text-sm font-semibold text-slate-600">
                        CMV médio
                      </span>
                      <span className="text-sm font-black text-slate-950">
                        {formatPercent(summary.averageCmv)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-950">
                        Ranking detalhado
                      </h2>
                      <p className="text-sm text-slate-500">
                        Ordene por faturamento, quantidade, lucro, margem ou
                        CMV.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={searchTerm}
                          onChange={(event) =>
                            setSearchTerm(event.target.value)
                          }
                          placeholder="Buscar produto..."
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 sm:w-64"
                        />
                      </div>

                      <select
                        value={paymentFilter}
                        onChange={(event) =>
                          setPaymentFilter(event.target.value as PaymentFilter)
                        }
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      >
                        {paymentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={sortFilter}
                        onChange={(event) =>
                          setSortFilter(event.target.value as SortFilter)
                        }
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      >
                        {sortOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1080px] text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-black uppercase tracking-wide text-slate-400">
                        <th className="px-5 py-3">Rank</th>
                        <th className="px-5 py-3">Produto</th>
                        <th className="px-5 py-3">Qtd.</th>
                        <th className="px-5 py-3">Faturamento</th>
                        <th className="px-5 py-3">Lucro bruto</th>
                        <th className="px-5 py-3">Margem</th>
                        <th className="px-5 py-3">CMV</th>
                        <th className="px-5 py-3">Participação</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredRanking.length > 0 ? (
                        filteredRanking.map((product, index) => (
                          <tr
                            key={product.key}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                          >
                            <td className="px-5 py-4">
                              <div
                                className={cn(
                                  "flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-black",
                                  index === 0 &&
                                    "bg-yellow-100 text-yellow-700",
                                  index === 1 &&
                                    "bg-slate-200 text-slate-700",
                                  index === 2 &&
                                    "bg-orange-100 text-orange-700",
                                  index > 2 && "bg-slate-100 text-slate-500",
                                )}
                              >
                                {index === 0 ? (
                                  <Crown className="h-4 w-4" />
                                ) : index === 1 || index === 2 ? (
                                  <Star className="h-4 w-4" />
                                ) : (
                                  index + 1
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div>
                                <p className="font-bold text-slate-950">
                                  {product.name}
                                </p>
                                <p className="mt-1 text-xs font-medium text-slate-400">
                                  {product.ordersCount} pedido(s) • ticket médio{" "}
                                  {formatMoney(product.averagePrice)}
                                </p>
                              </div>
                            </td>

                            <td className="px-5 py-4 text-sm font-black text-slate-900">
                              {formatNumber(product.quantitySold)}
                            </td>

                            <td className="px-5 py-4 text-sm font-black text-slate-900">
                              {formatMoney(product.revenue)}
                            </td>

                            <td
                              className={cn(
                                "px-5 py-4 text-sm font-black",
                                product.grossProfit >= 0
                                  ? "text-emerald-600"
                                  : "text-red-600",
                              )}
                            >
                              {formatMoney(product.grossProfit)}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                {product.marginPercentage >= 35 ? (
                                  <ArrowUp className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <ArrowDown className="h-4 w-4 text-red-500" />
                                )}
                                <span
                                  className={cn(
                                    "text-sm font-black",
                                    product.marginPercentage >= 35
                                      ? "text-emerald-600"
                                      : product.marginPercentage >= 25
                                        ? "text-amber-600"
                                        : "text-red-600",
                                  )}
                                >
                                  {formatPercent(product.marginPercentage)}
                                </span>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-xs font-black",
                                  product.cmvPercentage >= 45
                                    ? "bg-red-100 text-red-700"
                                    : product.cmvPercentage >= 35
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-emerald-100 text-emerald-700",
                                )}
                              >
                                {formatPercent(product.cmvPercentage)}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-blue-500"
                                    style={{
                                      width: `${Math.min(
                                        product.revenueShare,
                                        100,
                                      )}%`,
                                    }}
                                  />
                                </div>

                                <span className="text-xs font-black text-slate-600">
                                  {formatPercent(product.revenueShare)}
                                </span>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-xs font-black",
                                  product.status === "star" &&
                                    "bg-yellow-100 text-yellow-700",
                                  product.status === "high_margin" &&
                                    "bg-emerald-100 text-emerald-700",
                                  product.status === "low_margin" &&
                                    "bg-red-100 text-red-700",
                                  product.status === "no_recipe" &&
                                    "bg-slate-100 text-slate-600",
                                  product.status === "attention" &&
                                    "bg-blue-100 text-blue-700",
                                )}
                              >
                                {product.statusLabel}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-5 py-12 text-center text-sm font-medium text-slate-500"
                          >
                            Nenhum produto encontrado para os filtros atuais.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                <div className="flex gap-3">
                  <Package className="mt-0.5 h-5 w-5 flex-none" />
                  <div>
                    <p className="font-black">Como esse ranking é calculado?</p>
                    <p className="mt-1 font-medium">
                      A quantidade e o faturamento vêm dos itens dos pedidos. A
                      margem e o CMV usam a ficha técnica do produto. Produtos
                      sem ficha aparecem no ranking, mas o lucro pode ficar
                      incompleto até cadastrar os insumos.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}