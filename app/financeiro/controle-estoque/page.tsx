"use client"

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  Layers3,
  Loader2,
  MinusCircle,
  Package,
  Plus,
  PlusCircle,
  RefreshCcw,
  Save,
  Search,
  Trash2,
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
}

type StockItem = {
  id: string
  restaurant_id: string
  name: string
  category_id: string | null
  base_unit_type: BaseUnitType
  cost_per_base_unit: number | string | null
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

type StockMovementType = "purchase" | "sale" | "adjustment"
type StockStatus = "ok" | "low" | "zero"
type StockFilter = "all" | StockStatus

type ActiveAction = {
  itemId: string
  type: "entry" | "exit" | "count"
  quantity: string
  notes: string
}

const unitOptions: { value: BaseUnitType; label: string; compact: string }[] = [
  { value: "unidade", label: "Unidade", compact: "un" },
  { value: "kg", label: "Quilo", compact: "kg" },
  { value: "g", label: "Gramas", compact: "g" },
  { value: "litro", label: "Litro", compact: "L" },
  { value: "ml", label: "Mililitro", compact: "ml" },
  { value: "pacote", label: "Pacote", compact: "pct" },
  { value: "caixa", label: "Caixa", compact: "cx" },
  { value: "porcao", label: "Porção", compact: "porção" },
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

function getUnitCompact(unit: BaseUnitType) {
  return unitOptions.find((item) => item.value === unit)?.compact || unit
}

function getStockStatus(item: StockItem): StockStatus {
  const quantity = Number(item.current_quantity || 0)
  const minimum = Number(item.minimum_quantity || 0)

  if (quantity <= 0) return "zero"
  if (minimum > 0 && quantity <= minimum) return "low"

  return "ok"
}

function getStatusLabel(status: StockStatus) {
  if (status === "zero") return "Zerado"
  if (status === "low") return "Baixo"

  return "OK"
}

function getActionLabel(type: ActiveAction["type"]) {
  if (type === "entry") return "Entrada"
  if (type === "exit") return "Saída"

  return "Conferência"
}

function getMovementType(type: ActiveAction["type"]): StockMovementType {
  if (type === "entry") return "purchase"
  if (type === "exit") return "sale"

  return "adjustment"
}

function getCategoryName(item: StockItem, categories: StockCategory[]) {
  const category = categories.find((current) => current.id === item.category_id)

  return category?.name || "Sem categoria"
}

function MiniStat({
  title,
  value,
  icon,
  tone = "slate",
}: {
  title: string
  value: string
  icon: ReactNode
  tone?: "slate" | "green" | "amber" | "red" | "blue"
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-wide text-slate-500">
            {title}
          </p>
          <p className="mt-0.5 truncate text-lg font-black text-slate-950">
            {value}
          </p>
        </div>

        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            tone === "slate" && "bg-slate-100 text-slate-700",
            tone === "green" && "bg-emerald-50 text-emerald-700",
            tone === "amber" && "bg-amber-50 text-amber-700",
            tone === "red" && "bg-red-50 text-red-700",
            tone === "blue" && "bg-blue-50 text-blue-700"
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [showItemModal, setShowItemModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<StockFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null)
  const [isMovingStock, setIsMovingStock] = useState(false)

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

      const [itemsResponse, categoriesResponse] = await Promise.all([
        supabase
          .from("stock_items")
          .select(
            "id, restaurant_id, name, category_id, base_unit_type, cost_per_base_unit, current_quantity, minimum_quantity, is_active, created_at, updated_at"
          )
          .eq("restaurant_id", resolvedRestaurantId)
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("stock_categories")
          .select("id, restaurant_id, name")
          .eq("restaurant_id", resolvedRestaurantId)
          .order("name", { ascending: true }),
      ])

      if (itemsResponse.error) throw itemsResponse.error
      if (categoriesResponse.error) throw categoriesResponse.error

      setItems((itemsResponse.data ?? []) as StockItem[])
      setCategories((categoriesResponse.data ?? []) as StockCategory[])
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

      setItems([])
      setCategories([])
    } finally {
      setIsLoading(false)
    }
  }, [resolveRestaurant, supabase, toast])

  useEffect(() => {
    void loadStockData()
  }, [loadStockData])

  const lowStockItems = useMemo(() => {
    return items.filter((item) => getStockStatus(item) === "low")
  }, [items])

  const zeroStockItems = useMemo(() => {
    return items.filter((item) => getStockStatus(item) === "zero")
  }, [items])

  const okStockItems = useMemo(() => {
    return items.filter((item) => getStockStatus(item) === "ok")
  }, [items])

  const totalStockValue = useMemo(() => {
    return items.reduce((total, item) => {
      const quantity = Number(item.current_quantity || 0)
      const cost = Number(item.cost_per_base_unit || 0)

      return total + quantity * cost
    }, 0)
  }, [items])

  const activeActionItem = useMemo(() => {
    return activeAction
      ? items.find((item) => item.id === activeAction.itemId) ?? null
      : null
  }, [activeAction, items])

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return items
      .filter((item) => {
        const status = getStockStatus(item)
        const categoryName = getCategoryName(item, categories).toLowerCase()
        const matchesFilter = filter === "all" || status === filter
        const matchesCategory =
          categoryFilter === "all" ||
          (categoryFilter === "none" && !item.category_id) ||
          item.category_id === categoryFilter
        const matchesSearch =
          !normalizedSearch ||
          item.name.toLowerCase().includes(normalizedSearch) ||
          categoryName.includes(normalizedSearch)

        return matchesFilter && matchesCategory && matchesSearch
      })
      .sort((a, b) => {
        const statusOrder: Record<StockStatus, number> = {
          zero: 0,
          low: 1,
          ok: 2,
        }

        const statusDiff =
          statusOrder[getStockStatus(a)] - statusOrder[getStockStatus(b)]

        if (statusDiff !== 0) return statusDiff

        return a.name.localeCompare(b.name)
      })
  }, [items, categories, search, filter, categoryFilter])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowItemModal(false)
  }

  const openNewItemModal = () => {
    setEditingId(null)
    setForm(emptyForm)
    setActiveAction(null)
    setShowItemModal(true)
  }

  const handleEdit = (item: StockItem) => {
    setEditingId(item.id)
    setSelectedItemId(item.id)
    setActiveAction(null)
    setShowItemModal(true)

    setForm({
      name: item.name,
      category_id: item.category_id || "",
      base_unit_type: item.base_unit_type,
      cost_per_base_unit: String(item.cost_per_base_unit ?? ""),
      current_quantity: String(item.current_quantity ?? ""),
      minimum_quantity: String(item.minimum_quantity ?? ""),
    })
  }

  const handleSaveItem = async () => {
    try {
      const resolvedRestaurantId = await resolveRestaurant()
      const name = form.name.trim()
      const currentQuantity = parseNumber(form.current_quantity)
      const minimumQuantity = parseNumber(form.minimum_quantity)
      const costPerBaseUnit = parseNumber(form.cost_per_base_unit)

      if (!name) {
        toast({
          title: "Informe o nome do item",
          description: "Exemplo: arroz, carne, óleo, embalagem, refrigerante.",
          variant: "destructive",
        })
        return
      }

      if (Number.isNaN(currentQuantity) || currentQuantity < 0) {
        toast({
          title: "Quantidade atual inválida",
          description: "Informe uma quantidade atual maior ou igual a zero.",
          variant: "destructive",
        })
        return
      }

      if (Number.isNaN(minimumQuantity) || minimumQuantity < 0) {
        toast({
          title: "Estoque mínimo inválido",
          description: "Informe uma quantidade mínima maior ou igual a zero.",
          variant: "destructive",
        })
        return
      }

      if (Number.isNaN(costPerBaseUnit) || costPerBaseUnit < 0) {
        toast({
          title: "Custo inválido",
          description: "Informe um custo maior ou igual a zero.",
          variant: "destructive",
        })
        return
      }

      setIsSaving(true)

      const payload = {
        name,
        category_id: form.category_id || null,
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
          description: "O cadastro do item foi atualizado.",
        })
      } else {
        const { error } = await supabase.from("stock_items").insert({
          restaurant_id: resolvedRestaurantId,
          ...payload,
        })

        if (error) throw error

        toast({
          title: "Item cadastrado",
          description: "O item foi adicionado ao estoque.",
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

  const handleCreateCategory = async () => {
    try {
      const resolvedRestaurantId = await resolveRestaurant()
      const name = newCategoryName.trim()

      if (!name) {
        toast({
          title: "Informe o nome da categoria",
          description: "Exemplo: Carnes, Bebidas, Embalagens, Hortifruti.",
          variant: "destructive",
        })
        return
      }

      const alreadyExists = categories.some(
        (category) => category.name.trim().toLowerCase() === name.toLowerCase()
      )

      if (alreadyExists) {
        toast({
          title: "Categoria já existe",
          description: "Use outro nome para criar uma nova categoria.",
          variant: "destructive",
        })
        return
      }

      setIsSavingCategory(true)

      const { data, error } = await supabase
        .from("stock_categories")
        .insert({
          restaurant_id: resolvedRestaurantId,
          name,
        })
        .select("id, restaurant_id, name")
        .single()

      if (error) throw error

      setCategories((current) => [...current, data as StockCategory])
      setNewCategoryName("")

      toast({
        title: "Categoria criada",
        description: `${name} já pode ser usada no cadastro de itens.`,
      })
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
      setIsSavingCategory(false)
    }
  }

  const openStockAction = (item: StockItem, type: ActiveAction["type"]) => {
    setEditingId(null)
    setShowItemModal(false)
    setSelectedItemId(item.id)

    setActiveAction({
      itemId: item.id,
      type,
      quantity: type === "count" ? String(item.current_quantity ?? 0) : "",
      notes: "",
    })
  }

  const handleStockAction = async () => {
    try {
      if (!activeAction) return

      const resolvedRestaurantId = await resolveRestaurant()
      const currentItem = items.find((item) => item.id === activeAction.itemId)
      const quantity = parseNumber(activeAction.quantity)

      if (!currentItem) {
        toast({
          title: "Item não encontrado",
          description: "Atualize a página e tente novamente.",
          variant: "destructive",
        })
        return
      }

      if (Number.isNaN(quantity)) {
        toast({
          title: "Quantidade inválida",
          description: "Informe uma quantidade válida.",
          variant: "destructive",
        })
        return
      }

      if (activeAction.type !== "count" && quantity <= 0) {
        toast({
          title: "Quantidade inválida",
          description: "Entrada e saída precisam ser maiores que zero.",
          variant: "destructive",
        })
        return
      }

      if (activeAction.type === "count" && quantity < 0) {
        toast({
          title: "Contagem inválida",
          description: "A contagem final não pode ser negativa.",
          variant: "destructive",
        })
        return
      }

      const currentQuantity = Number(currentItem.current_quantity || 0)
      const unitCost = Number(currentItem.cost_per_base_unit || 0)
      let signedQuantity = 0
      let nextQuantity = currentQuantity

      if (activeAction.type === "entry") {
        signedQuantity = quantity
        nextQuantity = currentQuantity + quantity
      }

      if (activeAction.type === "exit") {
        signedQuantity = quantity * -1
        nextQuantity = currentQuantity - quantity
      }

      if (activeAction.type === "count") {
        signedQuantity = quantity - currentQuantity
        nextQuantity = quantity
      }

      if (nextQuantity < 0) {
        toast({
          title: "Estoque insuficiente",
          description: "Essa saída deixaria o estoque negativo.",
          variant: "destructive",
        })
        return
      }

      if (activeAction.type === "count" && signedQuantity === 0) {
        toast({
          title: "Contagem já conferida",
          description: "A quantidade informada é igual ao saldo atual.",
        })
        setActiveAction(null)
        return
      }

      setIsMovingStock(true)

      const { error: updateError } = await supabase
        .from("stock_items")
        .update({
          current_quantity: nextQuantity,
        })
        .eq("id", currentItem.id)
        .eq("restaurant_id", resolvedRestaurantId)

      if (updateError) throw updateError

      const notePrefix =
        activeAction.type === "count"
          ? `Conferência manual. Saldo anterior: ${formatNumber(
              currentQuantity
            )}. Saldo contado: ${formatNumber(nextQuantity)}.`
          : `${getActionLabel(activeAction.type)} manual.`

      const notes = [notePrefix, activeAction.notes.trim()]
        .filter(Boolean)
        .join(" ")

      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          restaurant_id: resolvedRestaurantId,
          stock_item_id: currentItem.id,
          movement_type: getMovementType(activeAction.type),
          quantity: signedQuantity,
          unit_cost: unitCost,
          total_cost: signedQuantity * unitCost,
          reference_type: "manual",
          reference_id: null,
          notes,
        })

      if (movementError) throw movementError

      toast({
        title: "Estoque atualizado",
        description: `${currentItem.name} agora tem ${formatNumber(
          nextQuantity
        )} ${getUnitCompact(currentItem.base_unit_type)}.`,
      })

      setActiveAction(null)
      await loadStockData()
    } catch (error) {
      console.error("Erro ao atualizar estoque:", error)

      toast({
        title: "Erro ao atualizar estoque",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar a contagem.",
        variant: "destructive",
      })
    } finally {
      setIsMovingStock(false)
    }
  }

  const handleDelete = async (itemId: string) => {
    const shouldDelete = window.confirm(
      "Remover este item do controle de estoque? Ele não será apagado do banco, apenas ficará inativo."
    )

    if (!shouldDelete) return

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
        description: "O item saiu da lista ativa do estoque.",
      })

      if (editingId === itemId) resetForm()
      if (selectedItemId === itemId) setSelectedItemId(null)
      if (activeAction?.itemId === itemId) setActiveAction(null)

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
      <div className="space-y-3 pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-950">
              Estoque
            </h1>
            <p className="mt-0.5 text-sm font-medium text-slate-500">
              Controle rápido de itens, categorias, custo, entrada, saída e conferência.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={openNewItemModal}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-black text-white hover:bg-blue-700"
            >
              <PlusCircle className="h-4 w-4" />
              Novo item
            </button>

            <button
              type="button"
              onClick={() => setShowCategoryModal(true)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              <Layers3 className="h-4 w-4" />
              Categorias
            </button>

            <button
              type="button"
              onClick={() => void loadStockData()}
              className="col-span-2 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 hover:bg-slate-50 sm:col-span-1"
            >
              <RefreshCcw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-white">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando estoque...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <MiniStat
                title="Valor"
                value={formatCurrency(totalStockValue)}
                tone="blue"
                icon={<Boxes className="h-4 w-4" />}
              />
              <MiniStat
                title="Itens"
                value={String(items.length)}
                icon={<Package className="h-4 w-4" />}
              />
              <MiniStat
                title="OK"
                value={String(okStockItems.length)}
                tone="green"
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
              <MiniStat
                title="Baixo"
                value={String(lowStockItems.length)}
                tone="amber"
                icon={<AlertTriangle className="h-4 w-4" />}
              />
              <MiniStat
                title="Zerados"
                value={String(zeroStockItems.length)}
                tone="red"
                icon={<X className="h-4 w-4" />}
              />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <Package className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-black text-slate-950">
                        Lista de estoque
                      </h2>
                      <p className="truncate text-xs font-semibold text-slate-500">
                        {filteredItems.length} item(ns) encontrado(s)
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[1fr_180px_160px] lg:w-[720px]">
                    <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
                      <Search className="h-4 w-4 text-slate-400" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar item ou categoria..."
                        className="h-full w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                      />
                    </div>

                    <select
                      value={categoryFilter}
                      onChange={(event) => setCategoryFilter(event.target.value)}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-slate-500"
                    >
                      <option value="all">Todas categorias</option>
                      <option value="none">Sem categoria</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={filter}
                      onChange={(event) => setFilter(event.target.value as StockFilter)}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-slate-500"
                    >
                      <option value="all">Todos status</option>
                      <option value="zero">Zerados</option>
                      <option value="low">Baixo estoque</option>
                      <option value="ok">OK</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-3">
                {filteredItems.length === 0 ? (
                  <EmptyState message="Nenhum item encontrado. Clique em Novo item para cadastrar." />
                ) : (
                  <>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[980px] border-separate border-spacing-y-2">
                        <thead>
                          <tr className="text-left text-[11px] font-black uppercase tracking-wide text-slate-500">
                            <th className="px-3 py-1">Item</th>
                            <th className="px-3 py-1">Categoria</th>
                            <th className="px-3 py-1">Saldo</th>
                            <th className="px-3 py-1">Mínimo</th>
                            <th className="px-3 py-1">Custo</th>
                            <th className="px-3 py-1">Valor</th>
                            <th className="px-3 py-1">Status</th>
                            <th className="px-3 py-1 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredItems.map((item) => {
                            const quantity = Number(item.current_quantity || 0)
                            const minimum = Number(item.minimum_quantity || 0)
                            const unitCost = Number(item.cost_per_base_unit || 0)
                            const status = getStockStatus(item)
                            const categoryName = getCategoryName(item, categories)
                            const isSelected = selectedItemId === item.id

                            return (
                              <Fragment key={item.id}>
                                <tr
                                  className={cn(
                                    "cursor-pointer bg-white text-sm shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50",
                                    isSelected && "bg-blue-50 ring-blue-200"
                                  )}
                                  onClick={() =>
                                    setSelectedItemId((current) =>
                                      current === item.id ? null : item.id
                                    )
                                  }
                                >
                                  <td className="rounded-l-xl px-3 py-3">
                                    <p className="font-black text-slate-950">{item.name}</p>
                                    <p className="text-xs font-semibold text-slate-500">
                                      Unidade: {getUnitLabel(item.base_unit_type)}
                                    </p>
                                  </td>

                                  <td className="px-3 py-3 font-bold text-slate-700">
                                    {categoryName}
                                  </td>

                                  <td className="px-3 py-3">
                                    <p className="font-black text-slate-950">
                                      {formatNumber(quantity)} {getUnitCompact(item.base_unit_type)}
                                    </p>
                                  </td>

                                  <td className="px-3 py-3 font-bold text-slate-700">
                                    {formatNumber(minimum)} {getUnitCompact(item.base_unit_type)}
                                  </td>

                                  <td className="px-3 py-3 font-bold text-slate-700">
                                    {formatCurrency(unitCost)} / {getUnitCompact(item.base_unit_type)}
                                  </td>

                                  <td className="px-3 py-3 font-black text-slate-950">
                                    {formatCurrency(quantity * unitCost)}
                                  </td>

                                  <td className="px-3 py-3">
                                    <span
                                      className={cn(
                                        "inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1",
                                        status === "ok" &&
                                          "bg-emerald-50 text-emerald-700 ring-emerald-200",
                                        status === "low" &&
                                          "bg-amber-50 text-amber-700 ring-amber-200",
                                        status === "zero" &&
                                          "bg-red-50 text-red-700 ring-red-200"
                                      )}
                                    >
                                      {getStatusLabel(status)}
                                    </span>
                                  </td>

                                  <td className="rounded-r-xl px-3 py-3">
                                    <div className="flex justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          openStockAction(item, "entry")
                                        }}
                                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        Entrada
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          openStockAction(item, "exit")
                                        }}
                                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 text-xs font-black text-red-700 hover:bg-red-100"
                                      >
                                        <MinusCircle className="h-3.5 w-3.5" />
                                        Saída
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          openStockAction(item, "count")
                                        }}
                                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                                      >
                                        <ClipboardCheck className="h-3.5 w-3.5" />
                                        Conferir
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          handleEdit(item)
                                        }}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                        aria-label="Editar item"
                                      >
                                        <Edit3 className="h-3.5 w-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          void handleDelete(item.id)
                                        }}
                                        disabled={deletingId === item.id}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                        aria-label="Remover item"
                                      >
                                        {deletingId === item.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {isSelected && (
                                  <tr>
                                    <td colSpan={8} className="px-1 pb-2">
                                      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                                        <div className="grid gap-2 md:grid-cols-4">
                                          <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
                                            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                                              Item
                                            </p>
                                            <p className="mt-0.5 text-sm font-black text-slate-900">
                                              {item.name}
                                            </p>
                                          </div>
                                          <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
                                            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                                              Categoria
                                            </p>
                                            <p className="mt-0.5 text-sm font-black text-slate-900">
                                              {categoryName}
                                            </p>
                                          </div>
                                          <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
                                            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                                              Custo base
                                            </p>
                                            <p className="mt-0.5 text-sm font-black text-slate-900">
                                              {formatCurrency(unitCost)} / {getUnitCompact(item.base_unit_type)}
                                            </p>
                                          </div>
                                          <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
                                            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                                              Valor parado
                                            </p>
                                            <p className="mt-0.5 text-sm font-black text-slate-900">
                                              {formatCurrency(quantity * unitCost)}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-2 md:hidden">
                      {filteredItems.map((item) => {
                        const quantity = Number(item.current_quantity || 0)
                        const minimum = Number(item.minimum_quantity || 0)
                        const unitCost = Number(item.cost_per_base_unit || 0)
                        const status = getStockStatus(item)
                        const categoryName = getCategoryName(item, categories)
                        const isSelected = selectedItemId === item.id

                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "rounded-xl border border-slate-200 bg-white p-3 shadow-sm",
                              isSelected && "border-blue-200 bg-blue-50/50"
                            )}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedItemId((current) =>
                                  current === item.id ? null : item.id
                                )
                              }
                              className="w-full text-left"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-slate-950">
                                    {item.name}
                                  </p>
                                  <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
                                    {categoryName} • {getUnitLabel(item.base_unit_type)}
                                  </p>
                                </div>

                                <span
                                  className={cn(
                                    "shrink-0 rounded-full px-2 py-1 text-[11px] font-black ring-1",
                                    status === "ok" &&
                                      "bg-emerald-50 text-emerald-700 ring-emerald-200",
                                    status === "low" &&
                                      "bg-amber-50 text-amber-700 ring-amber-200",
                                    status === "zero" &&
                                      "bg-red-50 text-red-700 ring-red-200"
                                  )}
                                >
                                  {getStatusLabel(status)}
                                </span>
                              </div>

                              <div className="mt-3 grid grid-cols-3 gap-2">
                                <div className="rounded-lg bg-slate-50 p-2">
                                  <p className="text-[10px] font-black uppercase text-slate-500">
                                    Atual
                                  </p>
                                  <p className="text-sm font-black text-slate-950">
                                    {formatNumber(quantity)} {getUnitCompact(item.base_unit_type)}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-slate-50 p-2">
                                  <p className="text-[10px] font-black uppercase text-slate-500">
                                    Mínimo
                                  </p>
                                  <p className="text-sm font-black text-slate-950">
                                    {formatNumber(minimum)}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-slate-50 p-2">
                                  <p className="text-[10px] font-black uppercase text-slate-500">
                                    Valor
                                  </p>
                                  <p className="text-sm font-black text-slate-950">
                                    {formatCurrency(quantity * unitCost)}
                                  </p>
                                </div>
                              </div>
                            </button>

                            {isSelected && (
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => openStockAction(item, "entry")}
                                  className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-xs font-black text-emerald-700"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Entrada
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openStockAction(item, "exit")}
                                  className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 text-xs font-black text-red-700"
                                >
                                  <MinusCircle className="h-3.5 w-3.5" />
                                  Saída
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openStockAction(item, "count")}
                                  className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 text-xs font-black text-blue-700"
                                >
                                  <ClipboardCheck className="h-3.5 w-3.5" />
                                  Conferir
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(item)}
                                  className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-black text-slate-700"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDelete(item.id)}
                                  disabled={deletingId === item.id}
                                  className="col-span-2 inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-black text-slate-700 disabled:opacity-60"
                                >
                                  {deletingId === item.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                  Remover
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </section>
          </>
        )}

        {showItemModal && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-0 sm:items-center sm:justify-center sm:p-4">
            <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-3xl sm:rounded-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-4">
                <div>
                  <h2 className="text-base font-black text-slate-950">
                    {editingId ? "Editar item" : "Novo item"}
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    Cadastro profissional com categoria, unidade, custo e quantidade mínima.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  aria-label="Fechar cadastro"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Nome do item
                  </label>
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Ex: Picanha, arroz, Coca-Cola lata, embalagem G..."
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Categoria
                  </label>
                  <div className="mt-1 grid grid-cols-[1fr_auto] gap-2">
                    <select
                      value={form.category_id}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          category_id: event.target.value,
                        }))
                      }
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500"
                    >
                      <option value="">Sem categoria</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowCategoryModal(true)}
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Unidade de controle
                  </label>
                  <select
                    value={form.base_unit_type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        base_unit_type: event.target.value as BaseUnitType,
                      }))
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500"
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
                    Custo por {getUnitCompact(form.base_unit_type)}
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
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500"
                  />
                </div>

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
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500"
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
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 p-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => void handleSaveItem()}
                  disabled={isSaving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {editingId ? "Salvar alterações" : "Cadastrar item"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showCategoryModal && (
          <div className="fixed inset-0 z-[60] flex items-end bg-slate-950/40 p-0 sm:items-center sm:justify-center sm:p-4">
            <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-4">
                <div>
                  <h2 className="text-base font-black text-slate-950">
                    Categorias de estoque
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    Crie grupos como Carnes, Bebidas, Embalagens e Hortifruti.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  aria-label="Fechar categorias"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 p-4">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        void handleCreateCategory()
                      }
                    }}
                    placeholder="Nome da categoria"
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500"
                  />

                  <button
                    type="button"
                    onClick={() => void handleCreateCategory()}
                    disabled={isSavingCategory}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingCategory ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Criar
                  </button>
                </div>

                {categories.length === 0 ? (
                  <EmptyState message="Nenhuma categoria cadastrada ainda." />
                ) : (
                  <div className="space-y-2">
                    {categories.map((category) => {
                      const categoryItemsCount = items.filter(
                        (item) => item.category_id === category.id
                      ).length

                      return (
                        <div
                          key={category.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-black text-slate-950">
                              {category.name}
                            </p>
                            <p className="text-xs font-semibold text-slate-500">
                              {categoryItemsCount} item(ns)
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setCategoryFilter(category.id)
                              setShowCategoryModal(false)
                            }}
                            className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                          >
                            Filtrar
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeAction && activeActionItem && (
          <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/40 p-0 sm:items-center sm:justify-center sm:p-4">
            <div className="w-full rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
                <div>
                  <h2 className="text-base font-black text-slate-950">
                    {getActionLabel(activeAction.type)} de estoque
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    {activeActionItem.name} • saldo atual:{" "}
                    {formatNumber(Number(activeActionItem.current_quantity || 0))}{" "}
                    {getUnitCompact(activeActionItem.base_unit_type)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  aria-label="Fechar movimentação"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 p-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                    {activeAction.type === "count"
                      ? "Quantidade contada"
                      : `Quantidade em ${getUnitCompact(activeActionItem.base_unit_type)}`}
                  </label>
                  <input
                    value={activeAction.quantity}
                    onChange={(event) =>
                      setActiveAction((current) =>
                        current
                          ? {
                              ...current,
                              quantity: event.target.value,
                            }
                          : current
                      )
                    }
                    type="number"
                    min={activeAction.type === "count" ? "0" : "0.001"}
                    step="0.001"
                    placeholder="0"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Observação opcional
                  </label>
                  <input
                    value={activeAction.notes}
                    onChange={(event) =>
                      setActiveAction((current) =>
                        current
                          ? {
                              ...current,
                              notes: event.target.value,
                            }
                          : current
                      )
                    }
                    placeholder="Ex: compra, perda, consumo interno, ajuste..."
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 p-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => void handleStockAction()}
                  disabled={isMovingStock}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isMovingStock ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}