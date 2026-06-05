"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Loader2,
  Package,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Product = Record<string, any>
type StockItem = Record<string, any>

type RecipeItem = {
  id: string
  restaurant_id: string
  product_id: string
  stock_item_id: string
  quantity: number
  unit: string | null
  waste_percentage: number
  cost_override: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

type RecipeForm = {
  stock_item_id: string
  quantity: string
  unit: string
  waste_percentage: string
  cost_override: string
  notes: string
}

const emptyForm: RecipeForm = {
  stock_item_id: "",
  quantity: "1",
  unit: "",
  waste_percentage: "0",
  cost_override: "",
  notes: "",
}

function parseNumber(value: string) {
  const normalized = String(value || "0").replace(",", ".")
  const number = Number(normalized)

  return Number.isFinite(number) ? number : 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0))
}

function onlyFilled(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getProductName(product?: Product) {
  if (!product) return "Produto não encontrado"

  return product.name || product.title || product.product_name || "Produto sem nome"
}

function getProductPrice(product?: Product) {
  if (!product) return 0

  return Number(
    product.price ||
      product.sale_price ||
      product.selling_price ||
      product.final_price ||
      0
  )
}

function getStockName(item?: StockItem) {
  if (!item) return "Insumo não encontrado"

  return item.name || item.title || item.item_name || "Insumo sem nome"
}

function getStockUnit(item?: StockItem) {
  if (!item) return ""

  return (
    item.base_unit_type ||
    item.unit ||
    item.measure_unit ||
    item.unit_measure ||
    "unidade"
  )
}

function getStockCost(item?: StockItem) {
  if (!item) return 0

  return Number(
    item.cost_per_base_unit ||
      item.unit_cost ||
      item.cost_per_unit ||
      item.average_cost ||
      item.price_per_unit ||
      item.cost ||
      0
  )
}

function getRecipeUnitCost(recipe: RecipeItem, stockItem?: StockItem) {
  if (recipe.cost_override !== null && recipe.cost_override !== undefined) {
    return Number(recipe.cost_override || 0)
  }

  return getStockCost(stockItem)
}

function calculateRecipeLineCost(recipe: RecipeItem, stockItem?: StockItem) {
  const quantity = Number(recipe.quantity || 0)
  const wastePercentage = Number(recipe.waste_percentage || 0)
  const unitCost = getRecipeUnitCost(recipe, stockItem)
  const wasteMultiplier = 1 + wastePercentage / 100

  return quantity * unitCost * wasteMultiplier
}

function getCmvStatus(cmv: number) {
  if (cmv <= 0) {
    return {
      label: "Sem preço/custo",
      className: "bg-slate-100 text-slate-700 ring-slate-200",
    }
  }

  if (cmv <= 35) {
    return {
      label: "Bom",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    }
  }

  if (cmv <= 45) {
    return {
      label: "Atenção",
      className: "bg-amber-50 text-amber-700 ring-amber-200",
    }
  }

  return {
    label: "Alto",
    className: "bg-red-50 text-red-700 ring-red-200",
  }
}

function SummaryBox({
  title,
  value,
  description,
  icon,
}: {
  title: string
  value: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 sm:px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 sm:text-xs">
            {title}
          </p>
          <p className="mt-1 truncate text-lg font-black text-slate-950 sm:text-xl">
            {value}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold text-slate-500 sm:text-xs">
            {description}
          </p>
        </div>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 sm:h-9 sm:w-9">
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function FichaTecnicaPage() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([])

  const [selectedProductId, setSelectedProductId] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [form, setForm] = useState<RecipeForm>(emptyForm)
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const stockById = useMemo(() => {
    const map = new Map<string, StockItem>()

    for (const item of stockItems) {
      map.set(item.id, item)
    }

    return map
  }, [stockItems])

  const selectedProduct = useMemo(() => {
    return products.find((product) => product.id === selectedProductId)
  }, [products, selectedProductId])

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase()

    if (!term) return products

    return products.filter((product) =>
      getProductName(product).toLowerCase().includes(term)
    )
  }, [products, productSearch])

  const currentRecipeItems = useMemo(() => {
    return recipeItems.filter((item) => item.product_id === selectedProductId)
  }, [recipeItems, selectedProductId])

  const recipeCost = useMemo(() => {
    return currentRecipeItems.reduce((sum, recipe) => {
      return sum + calculateRecipeLineCost(recipe, stockById.get(recipe.stock_item_id))
    }, 0)
  }, [currentRecipeItems, stockById])

  const productPrice = getProductPrice(selectedProduct)
  const estimatedMargin = productPrice - recipeCost
  const cmvPercentage = productPrice > 0 ? (recipeCost / productPrice) * 100 : 0
  const cmvStatus = getCmvStatus(cmvPercentage)

  const selectedStockItem = form.stock_item_id
    ? stockById.get(form.stock_item_id)
    : undefined

  const selectedStockCost = getStockCost(selectedStockItem)
  const formCostOverride = form.cost_override.trim()
    ? parseNumber(form.cost_override)
    : null
  const formUnitCost = formCostOverride !== null ? formCostOverride : selectedStockCost

  const formPreviewCost =
    parseNumber(form.quantity) *
    formUnitCost *
    (1 + parseNumber(form.waste_percentage) / 100)

  const loadPageData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error("Usuário não autenticado.")

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle()

      if (restaurantError) throw restaurantError
      if (!restaurant?.id) {
        throw new Error("Não foi possível encontrar o restaurante vinculado.")
      }

      setRestaurantId(restaurant.id)

      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })

      if (productsError) throw productsError

      const { data: stockData, error: stockError } = await supabase
        .from("stock_items")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("name", { ascending: true })

      if (stockError) throw stockError

      const { data: recipeData, error: recipeError } = await supabase
        .from("product_recipe_items")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })

      if (recipeError) throw recipeError

      const loadedProducts = (productsData || []) as Product[]

      setProducts(loadedProducts)
      setStockItems((stockData || []) as StockItem[])
      setRecipeItems((recipeData || []) as RecipeItem[])

      setSelectedProductId((current) => {
        if (current && loadedProducts.some((product) => product.id === current)) {
          return current
        }

        return loadedProducts[0]?.id || ""
      })
    } catch (error) {
      console.error("Erro ao carregar ficha técnica:", error)

      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a ficha técnica."
      )
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void loadPageData()
  }, [loadPageData])

  function resetForm() {
    setForm(emptyForm)
    setEditingRecipeId(null)
  }

  function handleSelectProduct(productId: string) {
    setSelectedProductId(productId)
    resetForm()
    setError(null)
    setSuccess(null)
  }

  function handleSelectStockItem(stockItemId: string) {
    const stockItem = stockById.get(stockItemId)

    setForm((current) => ({
      ...current,
      stock_item_id: stockItemId,
      unit: getStockUnit(stockItem),
    }))
  }

  function handleEditRecipeItem(recipe: RecipeItem) {
    const stockItem = stockById.get(recipe.stock_item_id)

    setEditingRecipeId(recipe.id)
    setError(null)
    setSuccess(null)

    setForm({
      stock_item_id: recipe.stock_item_id,
      quantity: String(recipe.quantity ?? ""),
      unit: recipe.unit || getStockUnit(stockItem),
      waste_percentage: String(recipe.waste_percentage ?? 0),
      cost_override:
        recipe.cost_override !== null && recipe.cost_override !== undefined
          ? String(recipe.cost_override)
          : "",
      notes: recipe.notes || "",
    })

    document.getElementById("recipe-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }

  async function handleSaveRecipeItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setError(null)
      setSuccess(null)

      if (!restaurantId) {
        throw new Error("Restaurante não encontrado.")
      }

      if (!selectedProductId) {
        throw new Error("Selecione um produto.")
      }

      if (!form.stock_item_id) {
        throw new Error("Selecione um insumo do estoque.")
      }

      const quantity = parseNumber(form.quantity)
      const wastePercentage = parseNumber(form.waste_percentage)
      const costOverride =
        form.cost_override.trim().length > 0 ? parseNumber(form.cost_override) : null

      if (quantity <= 0) {
        throw new Error("A quantidade usada precisa ser maior que zero.")
      }

      if (wastePercentage < 0) {
        throw new Error("A perda estimada não pode ser negativa.")
      }

      if (costOverride !== null && costOverride < 0) {
        throw new Error("O custo manual não pode ser negativo.")
      }

      setSaving(true)

      const stockItem = stockById.get(form.stock_item_id)

      const payload = {
        restaurant_id: restaurantId,
        product_id: selectedProductId,
        stock_item_id: form.stock_item_id,
        quantity,
        unit: onlyFilled(form.unit) || getStockUnit(stockItem),
        waste_percentage: wastePercentage,
        cost_override: costOverride,
        notes: onlyFilled(form.notes),
      }

      if (editingRecipeId) {
        const { data, error: updateError } = await supabase
          .from("product_recipe_items")
          .update(payload)
          .eq("id", editingRecipeId)
          .eq("restaurant_id", restaurantId)
          .select("*")
          .single()

        if (updateError) throw updateError
        if (!data) throw new Error("Não foi possível atualizar o insumo.")

        setRecipeItems((current) =>
          current.map((item) =>
            item.id === editingRecipeId ? (data as RecipeItem) : item
          )
        )

        setSuccess("Insumo atualizado na ficha técnica.")
      } else {
        const { data, error: insertError } = await supabase
          .from("product_recipe_items")
          .insert(payload)
          .select("*")
          .single()

        if (insertError) {
          if (insertError.code === "23505") {
            throw new Error("Esse insumo já está na ficha técnica deste produto.")
          }

          throw insertError
        }

        if (!data) throw new Error("Não foi possível adicionar o insumo.")

        setRecipeItems((current) => [data as RecipeItem, ...current])
        setSuccess("Insumo adicionado na ficha técnica.")
      }

      resetForm()
    } catch (error) {
      console.error("Erro ao salvar insumo:", error)

      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o insumo."
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRecipeItem(recipe: RecipeItem) {
    const shouldDelete = window.confirm(
      "Remover este insumo da ficha técnica?"
    )

    if (!shouldDelete) return

    try {
      if (!restaurantId) {
        throw new Error("Restaurante não encontrado.")
      }

      setDeletingId(recipe.id)
      setError(null)
      setSuccess(null)

      const { error: deleteError } = await supabase
        .from("product_recipe_items")
        .delete()
        .eq("id", recipe.id)
        .eq("restaurant_id", restaurantId)

      if (deleteError) throw deleteError

      setRecipeItems((current) => current.filter((item) => item.id !== recipe.id))

      if (editingRecipeId === recipe.id) {
        resetForm()
      }

      setSuccess("Insumo removido da ficha técnica.")
    } catch (error) {
      console.error("Erro ao remover insumo:", error)

      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível remover o insumo."
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AdminLayout title="Ficha Técnica">
      <div className="space-y-4 pb-24 sm:pb-0">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">
              Ficha Técnica
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Monte a composição dos produtos usando os itens do estoque.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadPageData()}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {success}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[380px] items-center justify-center rounded-xl border border-slate-200 bg-white">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando ficha técnica...
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Package className="h-6 w-6" />
            </div>

            <h2 className="mt-4 text-lg font-black text-slate-950">
              Nenhum produto encontrado
            </h2>

            <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
              Cadastre produtos no cardápio antes de montar ficha técnica.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-3 sm:p-4">
                <h2 className="text-base font-black text-slate-950">
                  Produtos
                </h2>

                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Escolha o produto para montar a ficha.
                </p>

                <div className="mt-3 flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Buscar produto..."
                    className="h-full w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="max-h-[320px] overflow-y-auto p-3 xl:max-h-[690px]">
                {filteredProducts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center text-sm font-semibold text-slate-500">
                    Nenhum produto encontrado.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredProducts.map((product) => {
                      const productRecipeItems = recipeItems.filter(
                        (item) => item.product_id === product.id
                      )

                      const productCost = productRecipeItems.reduce((sum, recipe) => {
                        return (
                          sum +
                          calculateRecipeLineCost(
                            recipe,
                            stockById.get(recipe.stock_item_id)
                          )
                        )
                      }, 0)

                      const productSalePrice = getProductPrice(product)
                      const productCmv =
                        productSalePrice > 0
                          ? (productCost / productSalePrice) * 100
                          : 0

                      const isSelected = selectedProductId === product.id

                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleSelectProduct(product.id)}
                          className={cn(
                            "w-full rounded-lg border p-3 text-left transition active:scale-[0.99]",
                            isSelected
                              ? "border-blue-300 bg-blue-50"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-slate-950">
                                {getProductName(product)}
                              </p>

                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                {productRecipeItems.length} insumo(s)
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-xs font-black text-slate-950">
                                {formatCurrency(productCost)}
                              </p>
                              <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                                CMV {productCmv.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>

            <div className="space-y-4">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryBox
                  title="Produto"
                  value={selectedProduct ? getProductName(selectedProduct) : "Selecione"}
                  description={`${currentRecipeItems.length} insumo(s) cadastrados`}
                  icon={<Package className="h-4 w-4" />}
                />

                <SummaryBox
                  title="Preço venda"
                  value={formatCurrency(productPrice)}
                  description="preço cadastrado"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />

                <SummaryBox
                  title="Custo ficha"
                  value={formatCurrency(recipeCost)}
                  description="custo estimado"
                  icon={<Calculator className="h-4 w-4" />}
                />

                <SummaryBox
                  title="Margem"
                  value={formatCurrency(estimatedMargin)}
                  description={`CMV ${cmvPercentage.toFixed(1)}%`}
                  icon={<ClipboardList className="h-4 w-4" />}
                />
              </section>

              <div
                className={cn(
                  "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
                  cmvStatus.className
                )}
              >
                Status do CMV: {cmvStatus.label}
              </div>

              {stockItems.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                  Cadastre itens no Controle de Estoque antes de montar a ficha técnica.
                </div>
              )}

              <section
                id="recipe-form"
                className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4"
              >
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-black text-slate-950">
                      {editingRecipeId ? "Editar insumo" : "Adicionar insumo"}
                    </h2>

                    <p className="text-sm font-semibold text-slate-500">
                      Use a mesma unidade cadastrada no estoque para evitar erro de cálculo.
                    </p>
                  </div>

                  {editingRecipeId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:w-auto"
                    >
                      <X className="h-4 w-4" />
                      Cancelar edição
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveRecipeItem} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1.4fr_0.6fr_0.5fr_0.5fr_0.7fr]">
                    <div className="col-span-2 lg:col-span-1">
                      <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Insumo do estoque
                      </label>

                      <select
                        value={form.stock_item_id}
                        onChange={(event) => handleSelectStockItem(event.target.value)}
                        disabled={stockItems.length === 0}
                        className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        <option value="">Selecione</option>

                        {stockItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {getStockName(item)} — {getStockUnit(item)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Quantidade
                      </label>

                      <input
                        value={form.quantity}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            quantity: event.target.value,
                          }))
                        }
                        placeholder="Ex: 0,2"
                        className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Unidade
                      </label>

                      <input
                        value={form.unit}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            unit: event.target.value,
                          }))
                        }
                        placeholder="kg"
                        className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Perda %
                      </label>

                      <input
                        value={form.waste_percentage}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            waste_percentage: event.target.value,
                          }))
                        }
                        placeholder="0"
                        className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Custo manual
                      </label>

                      <input
                        value={form.cost_override}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            cost_override: event.target.value,
                          }))
                        }
                        placeholder="Opcional"
                        className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div>
                      <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Observação
                      </label>

                      <input
                        value={form.notes}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        placeholder="Ex: porção padrão, perda no preparo, molho separado..."
                        className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={saving || !selectedProductId || stockItems.length === 0}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : editingRecipeId ? (
                        <Save className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}

                      {editingRecipeId ? "Salvar alteração" : "Adicionar insumo"}
                    </button>
                  </div>

                  {form.stock_item_id && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                      Custo previsto dessa linha:{" "}
                      <span className="text-slate-950">
                        {formatCurrency(formPreviewCost)}
                      </span>

                      {selectedStockCost <= 0 && formCostOverride === null && (
                        <span className="ml-2 text-amber-700">
                          Este insumo está sem custo no estoque. Informe custo manual para calcular CMV.
                        </span>
                      )}
                    </div>
                  )}
                </form>
              </section>

              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 p-3 sm:p-4">
                  <h2 className="text-base font-black text-slate-950">
                    Composição do produto
                  </h2>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Lista dos insumos usados nesse produto.
                  </p>
                </div>

                {currentRecipeItems.length === 0 ? (
                  <div className="flex min-h-[220px] flex-col items-center justify-center p-6 text-center sm:min-h-[260px]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <ClipboardList className="h-6 w-6" />
                    </div>

                    <h3 className="mt-4 text-base font-black text-slate-950">
                      Ficha técnica vazia
                    </h3>

                    <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
                      Adicione os insumos usados neste produto para calcular custo, CMV e margem.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 p-3 md:hidden">
                      {currentRecipeItems.map((recipe) => {
                        const stockItem = stockById.get(recipe.stock_item_id)
                        const unitCost = getRecipeUnitCost(recipe, stockItem)
                        const lineCost = calculateRecipeLineCost(recipe, stockItem)
                        const hasManualCost =
                          recipe.cost_override !== null &&
                          recipe.cost_override !== undefined

                        return (
                          <div
                            key={recipe.id}
                            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-950">
                                  {getStockName(stockItem)}
                                </p>

                                <p className="mt-1 text-xs font-bold text-slate-500">
                                  {formatQuantity(Number(recipe.quantity || 0))}{" "}
                                  {recipe.unit || getStockUnit(stockItem)}
                                </p>
                              </div>

                              <div className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
                                {Number(recipe.waste_percentage || 0).toFixed(1)}% perda
                              </div>
                            </div>

                            {recipe.notes && (
                              <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-500">
                                {recipe.notes}
                              </p>
                            )}

                            {!stockItem && (
                              <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-red-700">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Item não encontrado no estoque
                              </p>
                            )}

                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                  Custo unitário
                                </p>
                                <p className="mt-0.5 text-sm font-black text-slate-800">
                                  {formatCurrency(unitCost)}
                                </p>

                                {hasManualCost && (
                                  <p className="mt-0.5 text-[11px] font-semibold text-blue-700">
                                    custo manual
                                  </p>
                                )}
                              </div>

                              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                  Custo total
                                </p>
                                <p className="mt-0.5 text-sm font-black text-slate-950">
                                  {formatCurrency(lineCost)}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditRecipeItem(recipe)}
                                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                              >
                                <Edit3 className="h-4 w-4" />
                                Editar
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleDeleteRecipeItem(recipe)}
                                disabled={deletingId === recipe.id}
                                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingId === recipe.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                                Remover
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[900px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Insumo</th>
                            <th className="px-4 py-3">Quantidade usada</th>
                            <th className="px-4 py-3">Custo unitário</th>
                            <th className="px-4 py-3">Perda</th>
                            <th className="px-4 py-3">Custo total</th>
                            <th className="px-4 py-3 text-right">Ações</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-200">
                          {currentRecipeItems.map((recipe) => {
                            const stockItem = stockById.get(recipe.stock_item_id)
                            const unitCost = getRecipeUnitCost(recipe, stockItem)
                            const lineCost = calculateRecipeLineCost(recipe, stockItem)
                            const hasManualCost =
                              recipe.cost_override !== null &&
                              recipe.cost_override !== undefined

                            return (
                              <tr key={recipe.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3">
                                  <p className="font-black text-slate-950">
                                    {getStockName(stockItem)}
                                  </p>

                                  {recipe.notes && (
                                    <p className="mt-0.5 text-xs font-semibold text-slate-500">
                                      {recipe.notes}
                                    </p>
                                  )}

                                  {!stockItem && (
                                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-red-700">
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                      Item não encontrado no estoque
                                    </p>
                                  )}
                                </td>

                                <td className="px-4 py-3 font-bold text-slate-700">
                                  {formatQuantity(Number(recipe.quantity || 0))}{" "}
                                  {recipe.unit || getStockUnit(stockItem)}
                                </td>

                                <td className="px-4 py-3">
                                  <p className="font-bold text-slate-700">
                                    {formatCurrency(unitCost)}
                                  </p>

                                  {hasManualCost && (
                                    <p className="mt-0.5 text-xs font-semibold text-blue-700">
                                      custo manual
                                    </p>
                                  )}
                                </td>

                                <td className="px-4 py-3 font-bold text-slate-700">
                                  {Number(recipe.waste_percentage || 0).toFixed(1)}%
                                </td>

                                <td className="px-4 py-3">
                                  <p className="font-black text-slate-950">
                                    {formatCurrency(lineCost)}
                                  </p>
                                </td>

                                <td className="px-4 py-3">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleEditRecipeItem(recipe)}
                                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                      Editar
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteRecipeItem(recipe)}
                                      disabled={deletingId === recipe.id}
                                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {deletingId === recipe.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                      Remover
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}