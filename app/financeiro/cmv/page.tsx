"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BarChart3,
  Calculator,
  Loader2,
  PackageSearch,
  Percent,
  RefreshCcw,
  Search,
  TrendingUp,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Restaurant = {
  id: string
  name: string | null
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
  is_available?: boolean | null
  is_active?: boolean | null
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
  unit?: string | null
}

type StockItemRecord = {
  id: string
  name?: string | null
  title?: string | null
  unit?: string | null
  current_quantity?: number | string | null
  quantity?: number | string | null
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

type ProductCmv = {
  id: string
  name: string
  salePrice: number
  recipeCost: number
  grossProfit: number
  cmvPercentage: number
  marginPercentage: number
  recipeItemsCount: number
  missingCostItems: number
  inputNames: string[]
  status: "healthy" | "attention" | "danger" | "no_recipe" | "no_price" | "missing_cost"
  statusLabel: string
}

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

function getProductName(product: ProductRecord) {
  return product.name || product.title || "Produto sem nome"
}

function getStockName(stockItem?: StockItemRecord) {
  return stockItem?.name || stockItem?.title || "Insumo não encontrado"
}

function getProductPrice(product: ProductRecord) {
  return firstPositiveNumber(
    product.price,
    product.sale_price,
    product.selling_price,
    product.final_price,
    product.base_price,
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

function getStatus(product: ProductCmv) {
  if (product.salePrice <= 0) {
    return {
      status: "no_price" as const,
      label: "Sem preço",
    }
  }

  if (product.recipeItemsCount === 0) {
    return {
      status: "no_recipe" as const,
      label: "Sem ficha",
    }
  }

  if (product.missingCostItems > 0) {
    return {
      status: "missing_cost" as const,
      label: "Insumo sem custo",
    }
  }

  if (product.cmvPercentage >= 45) {
    return {
      status: "danger" as const,
      label: "CMV alto",
    }
  }

  if (product.cmvPercentage >= 35) {
    return {
      status: "attention" as const,
      label: "Atenção",
    }
  }

  return {
    status: "healthy" as const,
    label: "Saudável",
  }
}

export default function CmvMargemPage() {
  const supabase = createClient()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [recipeItems, setRecipeItems] = useState<RecipeItemRecord[]>([])
  const [stockItems, setStockItems] = useState<StockItemRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    "all" | ProductCmv["status"]
  >("all")

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

      const [productsResponse, recipeItemsResponse, stockItemsResponse] =
        await Promise.all([
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

      if (productsResponse.error) throw productsResponse.error
      if (recipeItemsResponse.error) throw recipeItemsResponse.error
      if (stockItemsResponse.error) throw stockItemsResponse.error

      setProducts((productsResponse.data || []) as ProductRecord[])
      setRecipeItems((recipeItemsResponse.data || []) as RecipeItemRecord[])
      setStockItems((stockItemsResponse.data || []) as StockItemRecord[])
    } catch (err) {
      console.error("Erro ao carregar CMV e Margem:", err)
      setError("Não foi possível carregar os dados de CMV e margem.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const calculatedProducts = useMemo<ProductCmv[]>(() => {
    const stockById = new Map(stockItems.map((item) => [item.id, item]))

    return products.map((product) => {
      const productRecipeItems = recipeItems.filter(
        (item) => item.product_id === product.id,
      )

      let recipeCost = 0
      let missingCostItems = 0

      const inputNames = productRecipeItems.map((item) => {
        const stockItem = item.stock_item_id
          ? stockById.get(item.stock_item_id)
          : undefined

        const quantity = getRecipeQuantity(item)
        const unitCost = getStockUnitCost(stockItem)

        if (quantity > 0 && unitCost <= 0) {
          missingCostItems += 1
        }

        recipeCost += quantity * unitCost

        return getStockName(stockItem)
      })

      const salePrice = getProductPrice(product)
      const grossProfit = salePrice - recipeCost
      const cmvPercentage = salePrice > 0 ? (recipeCost / salePrice) * 100 : 0
      const marginPercentage =
        salePrice > 0 ? (grossProfit / salePrice) * 100 : 0

      const baseProduct: ProductCmv = {
        id: product.id,
        name: getProductName(product),
        salePrice,
        recipeCost,
        grossProfit,
        cmvPercentage,
        marginPercentage,
        recipeItemsCount: productRecipeItems.length,
        missingCostItems,
        inputNames,
        status: "healthy",
        statusLabel: "Saudável",
      }

      const status = getStatus(baseProduct)

      return {
        ...baseProduct,
        status: status.status,
        statusLabel: status.label,
      }
    })
  }, [products, recipeItems, stockItems])

  const filteredProducts = useMemo(() => {
    return calculatedProducts.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase())

      const matchesStatus =
        statusFilter === "all" || product.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [calculatedProducts, searchTerm, statusFilter])

  const summary = useMemo(() => {
    const productsWithPrice = calculatedProducts.filter(
      (product) => product.salePrice > 0,
    )

    const productsWithRecipe = calculatedProducts.filter(
      (product) => product.recipeItemsCount > 0,
    )

    const totalSalePrice = productsWithPrice.reduce(
      (sum, product) => sum + product.salePrice,
      0,
    )

    const totalRecipeCost = productsWithPrice.reduce(
      (sum, product) => sum + product.recipeCost,
      0,
    )

    const totalGrossProfit = totalSalePrice - totalRecipeCost

    const weightedCmv =
      totalSalePrice > 0 ? (totalRecipeCost / totalSalePrice) * 100 : 0

    const weightedMargin =
      totalSalePrice > 0 ? (totalGrossProfit / totalSalePrice) * 100 : 0

    const bestMarginProduct = [...calculatedProducts]
      .filter(
        (product) =>
          product.salePrice > 0 &&
          product.recipeItemsCount > 0 &&
          product.missingCostItems === 0,
      )
      .sort((a, b) => b.marginPercentage - a.marginPercentage)[0]

    const alertProducts = calculatedProducts.filter((product) =>
      ["danger", "attention", "no_recipe", "no_price", "missing_cost"].includes(
        product.status,
      ),
    )

    return {
      totalProducts: calculatedProducts.length,
      productsWithRecipe: productsWithRecipe.length,
      totalSalePrice,
      totalRecipeCost,
      totalGrossProfit,
      weightedCmv,
      weightedMargin,
      bestMarginProduct,
      alertProducts: alertProducts.length,
      healthyProducts: calculatedProducts.filter(
        (product) => product.status === "healthy",
      ).length,
      attentionProducts: calculatedProducts.filter(
        (product) => product.status === "attention",
      ).length,
      dangerProducts: calculatedProducts.filter(
        (product) => product.status === "danger",
      ).length,
      missingCostProducts: calculatedProducts.filter(
        (product) => product.status === "missing_cost",
      ).length,
      noRecipeProducts: calculatedProducts.filter(
        (product) => product.status === "no_recipe",
      ).length,
      noPriceProducts: calculatedProducts.filter(
        (product) => product.status === "no_price",
      ).length,
    }
  }, [calculatedProducts])

  const recipeCoverage =
    summary.totalProducts > 0
      ? (summary.productsWithRecipe / summary.totalProducts) * 100
      : 0

  const statusOptions = [
    { value: "all", label: "Todos" },
    { value: "healthy", label: "Saudáveis" },
    { value: "attention", label: "Atenção" },
    { value: "danger", label: "CMV alto" },
    { value: "missing_cost", label: "Sem custo" },
    { value: "no_recipe", label: "Sem ficha" },
    { value: "no_price", label: "Sem preço" },
  ] as const

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">
                  <Calculator className="h-5 w-5" />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-black text-slate-950 sm:text-xl">
                      CMV e Margem
                    </h1>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                      Controle gerencial
                    </span>
                  </div>

                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Custo da ficha técnica, margem, lucro bruto e produtos que precisam de ajuste.
                  </p>

                  {restaurant?.name ? (
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      {restaurant.name}
                    </p>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={refreshing}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <Loader2 className="h-7 w-7 animate-spin" />
                <p className="text-sm font-bold">
                  Carregando CMV e margem...
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                      <PackageSearch className="h-4 w-4" />
                    </div>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                      {summary.productsWithRecipe}/{summary.totalProducts}
                    </span>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                      Produtos com ficha
                    </p>
                    <div className="mt-1 flex items-end justify-between gap-3">
                      <p className="text-2xl font-black text-slate-950">
                        {summary.productsWithRecipe}
                      </p>
                      <p className="text-sm font-black text-blue-600">
                        {formatPercent(recipeCoverage)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">
                    <Percent className="h-4 w-4" />
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                      CMV médio
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-2xl font-black",
                        summary.weightedCmv >= 45
                          ? "text-red-600"
                          : summary.weightedCmv >= 35
                            ? "text-amber-600"
                            : "text-emerald-600",
                      )}
                    >
                      {formatPercent(summary.weightedCmv)}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                    <TrendingUp className="h-4 w-4" />
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                      Margem média
                    </p>
                    <p className="mt-1 text-2xl font-black text-slate-950">
                      {formatPercent(summary.weightedMargin)}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100">
                    <AlertTriangle className="h-4 w-4" />
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                      Produtos em alerta
                    </p>
                    <p className="mt-1 text-2xl font-black text-slate-950">
                      {summary.alertProducts}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.6fr_0.9fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-slate-500" />
                      <h2 className="text-sm font-black text-slate-950">
                        Resumo financeiro dos produtos
                      </h2>
                    </div>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                      Base: preço de venda x ficha técnica
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                        Preço somado
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-950">
                        {formatMoney(summary.totalSalePrice)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                        Custo somado
                      </p>
                      <p className="mt-1 text-lg font-black text-orange-600">
                        {formatMoney(summary.totalRecipeCost)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                        Lucro bruto estimado
                      </p>
                      <p className="mt-1 text-lg font-black text-emerald-600">
                        {formatMoney(summary.totalGrossProfit)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-950">
                      Melhor margem
                    </p>

                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                      Destaque
                    </span>
                  </div>

                  {summary.bestMarginProduct ? (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                      <p className="line-clamp-1 text-sm font-black text-emerald-950">
                        {summary.bestMarginProduct.name}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[11px] font-black uppercase text-emerald-700/70">
                            Margem
                          </p>
                          <p className="text-base font-black text-emerald-700">
                            {formatPercent(
                              summary.bestMarginProduct.marginPercentage,
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-black uppercase text-emerald-700/70">
                            Lucro
                          </p>
                          <p className="text-base font-black text-emerald-700">
                            {formatMoney(summary.bestMarginProduct.grossProfit)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-500">
                      Cadastre ficha técnica e custo dos insumos para calcular.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-sm font-black text-slate-950">
                      Diagnóstico operacional
                    </h2>
                    <p className="text-xs font-medium text-slate-500">
                      Onde o restaurante precisa corrigir cadastro, custo ou margem.
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                    <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700/70">
                      Saudáveis
                    </p>
                    <p className="mt-1 text-xl font-black text-emerald-700">
                      {summary.healthyProducts}
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
                    <p className="text-[11px] font-black uppercase tracking-wide text-amber-700/70">
                      Atenção
                    </p>
                    <p className="mt-1 text-xl font-black text-amber-700">
                      {summary.attentionProducts}
                    </p>
                  </div>

                  <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-3">
                    <p className="text-[11px] font-black uppercase tracking-wide text-red-700/70">
                      CMV alto
                    </p>
                    <p className="mt-1 text-xl font-black text-red-700">
                      {summary.dangerProducts}
                    </p>
                  </div>

                  <div className="rounded-xl border border-purple-100 bg-purple-50 px-3 py-3">
                    <p className="text-[11px] font-black uppercase tracking-wide text-purple-700/70">
                      Sem custo
                    </p>
                    <p className="mt-1 text-xl font-black text-purple-700">
                      {summary.missingCostProducts}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                      Sem ficha
                    </p>
                    <p className="mt-1 text-xl font-black text-slate-900">
                      {summary.noRecipeProducts}
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-sm font-black text-slate-950">
                        Produtos analisados
                      </h2>
                      <p className="text-xs font-medium text-slate-500">
                        Lista compacta com preço, custo, CMV, margem e status.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="Buscar produto..."
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100 sm:w-64"
                        />
                      </div>

                      <select
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(
                            event.target.value as typeof statusFilter,
                          )
                        }
                        className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-3">Produto</th>
                        <th className="px-4 py-3">Preço</th>
                        <th className="px-4 py-3">Custo ficha</th>
                        <th className="px-4 py-3">CMV</th>
                        <th className="px-4 py-3">Margem</th>
                        <th className="px-4 py-3">Lucro bruto</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map((product) => (
                          <tr
                            key={product.id}
                            className="border-b border-slate-100 text-sm last:border-0 hover:bg-slate-50/80"
                          >
                            <td className="px-4 py-3">
                              <div>
                                <p className="line-clamp-1 font-black text-slate-950">
                                  {product.name}
                                </p>
                                <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-400">
                                  {product.recipeItemsCount > 0
                                    ? `${product.recipeItemsCount} insumo(s): ${product.inputNames
                                        .slice(0, 3)
                                        .join(", ")}${
                                        product.inputNames.length > 3
                                          ? "..."
                                          : ""
                                      }`
                                    : "Nenhuma ficha técnica cadastrada"}
                                </p>
                              </div>
                            </td>

                            <td className="px-4 py-3 font-black text-slate-900">
                              {formatMoney(product.salePrice)}
                            </td>

                            <td className="px-4 py-3 font-black text-orange-600">
                              {formatMoney(product.recipeCost)}
                            </td>

                            <td className="px-4 py-3">
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

                            <td className="px-4 py-3 font-black text-slate-900">
                              {formatPercent(product.marginPercentage)}
                            </td>

                            <td
                              className={cn(
                                "px-4 py-3 font-black",
                                product.grossProfit > 0
                                  ? "text-emerald-600"
                                  : "text-red-600",
                              )}
                            >
                              {formatMoney(product.grossProfit)}
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-xs font-black",
                                  product.status === "healthy" &&
                                    "bg-emerald-100 text-emerald-700",
                                  product.status === "attention" &&
                                    "bg-amber-100 text-amber-700",
                                  product.status === "danger" &&
                                    "bg-red-100 text-red-700",
                                  product.status === "missing_cost" &&
                                    "bg-purple-100 text-purple-700",
                                  product.status === "no_recipe" &&
                                    "bg-slate-100 text-slate-600",
                                  product.status === "no_price" &&
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
                            colSpan={7}
                            className="px-4 py-10 text-center text-sm font-bold text-slate-500"
                          >
                            Nenhum produto encontrado para os filtros atuais.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                  <div>
                    <p className="font-black">Importante</p>
                    <p className="mt-1 font-semibold">
                      O CMV depende do custo cadastrado nos insumos do estoque.
                      Se algum insumo estiver sem custo, o produto vai aparecer
                      como “Insumo sem custo” e a margem pode ficar incorreta.
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