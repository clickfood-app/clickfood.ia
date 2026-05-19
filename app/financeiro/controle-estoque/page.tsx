"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  Boxes,
  Edit3,
  FolderPlus,
  Loader2,
  Package,
  PlusCircle,
  RefreshCcw,
  Save,
  Search,
  Tags,
  Trash2,
  Wallet,
  X,
} from "lucide-react"

type BaseUnitType =
  | "unidade"
  | "kg"
  | "g"
  | "litro"
  | "ml"
  | "pacote"
  | "caixa"
  | "porcao"

type StockCategory = {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  color: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type StockItem = {
  id: string
  restaurant_id: string
  name: string
  category: string | null
  category_id: string | null
  base_unit_type: BaseUnitType
  cost_per_base_unit: number | string
  current_quantity: number | string
  minimum_quantity: number | string
  is_active: boolean
  created_at: string
  updated_at: string
}

type StockForm = {
  name: string
  category_id: string
  base_unit_type: BaseUnitType
  cost_per_base_unit: string
  current_quantity: string
  minimum_quantity: string
}

const unitOptions: { value: BaseUnitType; label: string }[] = [
  { value: "unidade", label: "Unidade" },
  { value: "kg", label: "Kg" },
  { value: "g", label: "Gramas" },
  { value: "litro", label: "Litro" },
  { value: "ml", label: "ML" },
  { value: "pacote", label: "Pacote" },
  { value: "caixa", label: "Caixa" },
  { value: "porcao", label: "Porção" },
]

const emptyForm: StockForm = {
  name: "",
  category_id: "",
  base_unit_type: "unidade",
  cost_per_base_unit: "",
  current_quantity: "",
  minimum_quantity: "",
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0))
}

function parseNumber(value: string) {
  return Number(String(value || "0").replace(",", "."))
}

function getUnitLabel(unit: BaseUnitType) {
  return unitOptions.find((item) => item.value === unit)?.label || unit
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone = "slate",
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  tone?: "slate" | "green" | "amber" | "red" | "blue"
}) {
  const toneClass = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
  }[tone]

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{title}</p>

          <p className="mt-2 truncate text-2xl font-black tracking-tight text-slate-950">
            {value}
          </p>

          <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
            {subtitle}
          </p>
        </div>

        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1",
            toneClass
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

function Panel({
  title,
  subtitle,
  icon,
  children,
  className,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-black tracking-tight text-slate-950">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-sm leading-5 text-slate-500">{subtitle}</p>
          )}
        </div>

        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
      {message}
    </div>
  )
}

export default function ControleEstoquePage() {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [items, setItems] = useState<StockItem[]>([])
  const [categories, setCategories] = useState<StockCategory[]>([])
  const [form, setForm] = useState<StockForm>(emptyForm)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const resolveRestaurant = useCallback(async () => {
    if (restaurantId) return restaurantId

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
      .single()

    if (restaurantError) throw restaurantError
    if (!restaurant?.id) throw new Error("Restaurante não encontrado.")

    setRestaurantId(restaurant.id)

    return restaurant.id
  }, [restaurantId, supabase])

  const loadStockData = useCallback(async () => {
    try {
      setIsLoading(true)

      const resolvedRestaurantId = await resolveRestaurant()

      const { data: categoriesData, error: categoriesError } = await supabase
        .from("stock_categories")
        .select("id, restaurant_id, name, description, color, is_active, created_at, updated_at")
        .eq("restaurant_id", resolvedRestaurantId)
        .eq("is_active", true)
        .order("name", { ascending: true })

      if (categoriesError) throw categoriesError

      const { data: itemsData, error: itemsError } = await supabase
        .from("stock_items")
        .select(
          "id, restaurant_id, name, category, category_id, base_unit_type, cost_per_base_unit, current_quantity, minimum_quantity, is_active, created_at, updated_at"
        )
        .eq("restaurant_id", resolvedRestaurantId)
        .eq("is_active", true)
        .order("name", { ascending: true })

      if (itemsError) throw itemsError

      setCategories((categoriesData ?? []) as StockCategory[])
      setItems((itemsData ?? []) as StockItem[])
    } catch (error) {
      console.error("Erro ao carregar estoque:", error)

      toast({
        title: "Erro ao carregar estoque",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os itens do estoque.",
        variant: "destructive",
      })

      setCategories([])
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [resolveRestaurant, supabase, toast])

  useEffect(() => {
    void loadStockData()
  }, [loadStockData])

  const categoriesById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category]))
  }, [categories])

  const getItemCategoryName = useCallback(
    (item: StockItem) => {
      if (item.category_id && categoriesById.has(item.category_id)) {
        return categoriesById.get(item.category_id)?.name || null
      }

      return item.category || null
    },
    [categoriesById]
  )

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) return items

    return items.filter((item) => {
      const categoryName = getItemCategoryName(item)

      return (
        item.name.toLowerCase().includes(normalizedSearch) ||
        String(categoryName || "").toLowerCase().includes(normalizedSearch)
      )
    })
  }, [items, search, getItemCategoryName])

  const totalStockValue = useMemo(() => {
    return items.reduce((sum, item) => {
      return (
        sum +
        Number(item.current_quantity || 0) *
          Number(item.cost_per_base_unit || 0)
      )
    }, 0)
  }, [items])

  const lowStockItems = useMemo(() => {
    return items.filter((item) => {
      return (
        Number(item.minimum_quantity || 0) > 0 &&
        Number(item.current_quantity || 0) <= Number(item.minimum_quantity || 0)
      )
    })
  }, [items])

  const mostValuableItem = useMemo(() => {
    return [...items].sort((a, b) => {
      const valueA =
        Number(a.current_quantity || 0) * Number(a.cost_per_base_unit || 0)
      const valueB =
        Number(b.current_quantity || 0) * Number(b.cost_per_base_unit || 0)

      return valueB - valueA
    })[0]
  }, [items])

  const categorySummary = useMemo(() => {
    const summary = new Map<
      string,
      {
        id: string
        name: string
        totalValue: number
        itemsCount: number
      }
    >()

    for (const item of items) {
      const categoryId = item.category_id || "sem-categoria"
      const categoryName =
        item.category_id && categoriesById.has(item.category_id)
          ? categoriesById.get(item.category_id)?.name || "Sem categoria"
          : item.category || "Sem categoria"

      const current =
        summary.get(categoryId) ??
        ({
          id: categoryId,
          name: categoryName,
          totalValue: 0,
          itemsCount: 0,
        } satisfies {
          id: string
          name: string
          totalValue: number
          itemsCount: number
        })

      current.totalValue +=
        Number(item.current_quantity || 0) * Number(item.cost_per_base_unit || 0)
      current.itemsCount += 1

      summary.set(categoryId, current)
    }

    return Array.from(summary.values()).sort((a, b) => b.totalValue - a.totalValue)
  }, [items, categoriesById])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleEdit = (item: StockItem) => {
    setEditingId(item.id)

    setForm({
      name: item.name,
      category_id: item.category_id || "",
      base_unit_type: item.base_unit_type,
      cost_per_base_unit: String(item.cost_per_base_unit ?? ""),
      current_quantity: String(item.current_quantity ?? ""),
      minimum_quantity: String(item.minimum_quantity ?? ""),
    })

    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleCreateCategory = async () => {
    try {
      const resolvedRestaurantId = await resolveRestaurant()
      const name = newCategoryName.trim()

      if (!name) {
        toast({
          title: "Informe o nome da categoria",
          description: "Exemplo: Carnes, Grãos, Embalagens, Bebidas.",
          variant: "destructive",
        })
        return
      }

      setIsCreatingCategory(true)

      const { data, error } = await supabase
        .from("stock_categories")
        .insert({
          restaurant_id: resolvedRestaurantId,
          name,
        })
        .select("id")
        .single()

      if (error) throw error

      toast({
        title: "Categoria criada",
        description: "A categoria de insumos foi criada com sucesso.",
      })

      setNewCategoryName("")

      await loadStockData()

      if (data?.id) {
        setForm((current) => ({
          ...current,
          category_id: data.id,
        }))
      }
    } catch (error) {
      console.error("Erro ao criar categoria:", error)

      toast({
        title: "Erro ao criar categoria",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível criar a categoria.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingCategory(false)
    }
  }

  const handleSave = async () => {
    try {
      const resolvedRestaurantId = await resolveRestaurant()

      const name = form.name.trim()
      const selectedCategory = form.category_id
        ? categoriesById.get(form.category_id)
        : null

      const costPerBaseUnit = parseNumber(form.cost_per_base_unit)
      const currentQuantity = parseNumber(form.current_quantity)
      const minimumQuantity = parseNumber(form.minimum_quantity)

      if (!name) {
        toast({
          title: "Informe o nome do item",
          description: "Exemplo: arroz, carne, pão brioche, óleo.",
          variant: "destructive",
        })
        return
      }

      if (costPerBaseUnit < 0 || Number.isNaN(costPerBaseUnit)) {
        toast({
          title: "Custo inválido",
          description: "Informe um custo válido para esse item.",
          variant: "destructive",
        })
        return
      }

      if (currentQuantity < 0 || Number.isNaN(currentQuantity)) {
        toast({
          title: "Quantidade inválida",
          description: "Informe uma quantidade atual válida.",
          variant: "destructive",
        })
        return
      }

      if (minimumQuantity < 0 || Number.isNaN(minimumQuantity)) {
        toast({
          title: "Estoque mínimo inválido",
          description: "Informe uma quantidade mínima válida.",
          variant: "destructive",
        })
        return
      }

      setIsSaving(true)

      const payload = {
        restaurant_id: resolvedRestaurantId,
        name,
        category_id: selectedCategory?.id || null,
        category: selectedCategory?.name || null,
        base_unit_type: form.base_unit_type,
        cost_per_base_unit: costPerBaseUnit,
        current_quantity: currentQuantity,
        minimum_quantity: minimumQuantity,
        is_active: true,
      }

      if (editingId) {
        const { error } = await supabase
          .from("stock_items")
          .update(payload)
          .eq("id", editingId)
          .eq("restaurant_id", resolvedRestaurantId)

        if (error) throw error

        toast({
          title: "Item atualizado",
          description: "O item do estoque foi atualizado com sucesso.",
        })
      } else {
        const { error } = await supabase.from("stock_items").insert(payload)

        if (error) throw error

        toast({
          title: "Item cadastrado",
          description: "O item foi adicionado ao controle de estoque.",
        })
      }

      resetForm()
      await loadStockData()
    } catch (error) {
      console.error("Erro ao salvar item:", error)

      toast({
        title: "Erro ao salvar item",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o item.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (itemId: string) => {
    try {
      const resolvedRestaurantId = await resolveRestaurant()

      setDeletingId(itemId)

      const { error } = await supabase
        .from("stock_items")
        .update({ is_active: false })
        .eq("id", itemId)
        .eq("restaurant_id", resolvedRestaurantId)

      if (error) throw error

      toast({
        title: "Item removido",
        description: "O item foi removido do controle ativo de estoque.",
      })

      if (editingId === itemId) resetForm()

      await loadStockData()
    } catch (error) {
      console.error("Erro ao remover item:", error)

      toast({
        title: "Erro ao remover item",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível remover esse item.",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AdminLayout title="Controle de estoque">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Controle de estoque
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre insumos, custos, categorias e quantidades para calcular perdas com precisão.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadStockData()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </button>
        </div>

        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando estoque...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Valor em estoque"
                value={formatCurrency(totalStockValue)}
                subtitle="Soma estimada dos itens ativos"
                tone="green"
                icon={<Wallet className="h-5 w-5" />}
              />

              <MetricCard
                title="Itens cadastrados"
                value={String(items.length)}
                subtitle="Insumos ativos no controle"
                tone="blue"
                icon={<Package className="h-5 w-5" />}
              />

              <MetricCard
                title="Estoque baixo"
                value={String(lowStockItems.length)}
                subtitle="Itens abaixo ou no mínimo"
                tone={lowStockItems.length > 0 ? "red" : "green"}
                icon={<AlertTriangle className="h-5 w-5" />}
              />

              <MetricCard
                title="Categorias"
                value={String(categories.length)}
                subtitle={
                  mostValuableItem
                    ? `Maior valor: ${mostValuableItem.name}`
                    : "Organize por tipo de insumo"
                }
                tone="slate"
                icon={<Boxes className="h-5 w-5" />}
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.9fr_1.3fr]">
              <div className="space-y-5">
                <Panel
                  title="Categorias de insumos"
                  subtitle="Organize carnes, grãos, embalagens, bebidas e outros grupos"
                  icon={<Tags className="h-5 w-5" />}
                >
                  <div className="flex gap-2">
                    <input
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      placeholder="Ex: Carnes, Grãos, Embalagens..."
                      className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    />

                    <button
                      type="button"
                      onClick={() => void handleCreateCategory()}
                      disabled={isCreatingCategory}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCreatingCategory ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FolderPlus className="h-4 w-4" />
                      )}
                      Criar
                    </button>
                  </div>

                  <div className="mt-4 space-y-2">
                    {categories.length === 0 ? (
                      <EmptyState message="Nenhuma categoria criada ainda." />
                    ) : (
                      categories.map((category) => {
                        const summary = categorySummary.find(
                          (item) => item.id === category.id
                        )

                        return (
                          <div
                            key={category.id}
                            className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-slate-900">
                                {category.name}
                              </p>
                              <p className="text-xs font-semibold text-slate-500">
                                {summary?.itemsCount || 0} item(ns) •{" "}
                                {formatCurrency(summary?.totalValue || 0)}
                              </p>
                            </div>

                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                              Ativa
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </Panel>

                <Panel
                  title={editingId ? "Editar item" : "Cadastrar item"}
                  subtitle="Esses dados serão usados no cálculo automático de perdas"
                  icon={editingId ? <Edit3 className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
                >
                  <div className="grid gap-4">
                    <div>
                      <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Nome do insumo
                      </label>

                      <input
                        value={form.name}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Ex: Arroz, carne, queijo, óleo..."
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Categoria
                      </label>

                      <select
                        value={form.category_id}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            category_id: event.target.value,
                          }))
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400"
                      >
                        <option value="">Sem categoria</option>

                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                          Unidade base
                        </label>

                        <select
                          value={form.base_unit_type}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              base_unit_type: event.target.value as BaseUnitType,
                            }))
                          }
                          className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400"
                        >
                          {unitOptions.map((unit) => (
                            <option key={unit.value} value={unit.value}>
                              {unit.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                          Custo por unidade base
                        </label>

                        <input
                          value={form.cost_per_base_unit}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              cost_per_base_unit: event.target.value,
                            }))
                          }
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0,00"
                          className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                          Quantidade atual
                        </label>

                        <input
                          value={form.current_quantity}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              current_quantity: event.target.value,
                            }))
                          }
                          type="number"
                          min="0"
                          step="0.001"
                          placeholder="0"
                          className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                          Estoque mínimo
                        </label>

                        <input
                          value={form.minimum_quantity}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              minimum_quantity: event.target.value,
                            }))
                          }
                          type="number"
                          min="0"
                          step="0.001"
                          placeholder="0"
                          className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Exemplo de cálculo
                      </p>

                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                        Se esse item custa{" "}
                        <strong>{formatCurrency(parseNumber(form.cost_per_base_unit))}</strong>{" "}
                        por {getUnitLabel(form.base_unit_type).toLowerCase()}, a aba de perdas
                        conseguirá calcular automaticamente quanto custou cada desperdício.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={isSaving}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}

                        {editingId ? "Salvar alterações" : "Cadastrar item"}
                      </button>

                      {editingId && (
                        <button
                          type="button"
                          onClick={resetForm}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                        >
                          <X className="h-4 w-4" />
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </Panel>
              </div>

              <Panel
                title="Itens do estoque"
                subtitle="Insumos ativos cadastrados no restaurante"
                icon={<Package className="h-5 w-5" />}
              >
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                  <Search className="h-4 w-4 text-slate-400" />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nome ou categoria..."
                    className="h-11 w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-3">
                  {filteredItems.length === 0 ? (
                    <EmptyState message="Nenhum item encontrado no estoque." />
                  ) : (
                    filteredItems.map((item) => {
                      const quantity = Number(item.current_quantity || 0)
                      const minimum = Number(item.minimum_quantity || 0)
                      const unitCost = Number(item.cost_per_base_unit || 0)
                      const totalValue = quantity * unitCost
                      const isLowStock = minimum > 0 && quantity <= minimum
                      const categoryName = getItemCategoryName(item)

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "rounded-2xl border px-4 py-4 transition",
                            isLowStock
                              ? "border-red-200 bg-red-50"
                              : "border-slate-200 bg-slate-50 hover:bg-white"
                          )}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-base font-black text-slate-950">
                                  {item.name}
                                </p>

                                {categoryName && (
                                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                                    {categoryName}
                                  </span>
                                )}

                                {isLowStock && (
                                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-black text-red-700 ring-1 ring-red-200">
                                    Estoque baixo
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 text-sm font-medium text-slate-500">
                                {formatNumber(quantity)}{" "}
                                {getUnitLabel(item.base_unit_type).toLowerCase()} em estoque • mínimo{" "}
                                {formatNumber(minimum)}
                              </p>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px]">
                              <div className="rounded-xl bg-white px-3 py-2">
                                <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                                  Custo base
                                </p>
                                <p className="mt-1 text-sm font-black text-slate-950">
                                  {formatCurrency(unitCost)}
                                </p>
                              </div>

                              <div className="rounded-xl bg-white px-3 py-2">
                                <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                                  Valor total
                                </p>
                                <p className="mt-1 text-sm font-black text-slate-950">
                                  {formatCurrency(totalValue)}
                                </p>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(item)}
                                  className="inline-flex h-full min-h-[52px] flex-1 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200 transition hover:text-blue-700 hover:ring-blue-200"
                                  aria-label="Editar item"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void handleDelete(item.id)}
                                  disabled={deletingId === item.id}
                                  className="inline-flex h-full min-h-[52px] flex-1 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200 transition hover:text-red-700 hover:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label="Remover item"
                                >
                                  {deletingId === item.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </Panel>
            </section>

            {categorySummary.length > 0 && (
              <Panel
                title="Valor por categoria"
                subtitle="Veja onde está concentrado o dinheiro parado em estoque"
                icon={<Tags className="h-5 w-5" />}
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {categorySummary.map((category) => (
                    <div
                      key={category.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="truncate text-sm font-black text-slate-950">
                        {category.name}
                      </p>

                      <p className="mt-2 text-xl font-black text-slate-950">
                        {formatCurrency(category.totalValue)}
                      </p>

                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {category.itemsCount} item(ns) cadastrado(s)
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {lowStockItems.length > 0 && (
              <Panel
                title="Alertas de estoque baixo"
                subtitle="Itens que precisam de atenção antes de faltar"
                icon={<AlertTriangle className="h-5 w-5" />}
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-red-100 bg-red-50 p-4"
                    >
                      <p className="font-black text-red-700">{item.name}</p>

                      <p className="mt-2 text-sm font-semibold leading-5 text-red-700">
                        Estoque atual: {formatNumber(Number(item.current_quantity || 0))}{" "}
                        {getUnitLabel(item.base_unit_type).toLowerCase()}
                      </p>

                      <p className="mt-1 text-sm font-semibold leading-5 text-red-700">
                        Mínimo configurado: {formatNumber(Number(item.minimum_quantity || 0))}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}