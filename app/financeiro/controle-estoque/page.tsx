"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  Loader2,
  MinusCircle,
  Package,
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

type StockItem = {
  id: string
  restaurant_id: string
  name: string
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
  base_unit_type: BaseUnitType
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
  base_unit_type: "unidade",
  current_quantity: "",
  minimum_quantity: "",
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

function StatBox({
  title,
  value,
  icon,
}: {
  title: string
  value: string
  icon: ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {title}
          </p>
          <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
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
  const [form, setForm] = useState<StockForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<StockFilter>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
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

      const { data, error } = await supabase
        .from("stock_items")
        .select(
          "id, restaurant_id, name, base_unit_type, cost_per_base_unit, current_quantity, minimum_quantity, is_active, created_at, updated_at"
        )
        .eq("restaurant_id", resolvedRestaurantId)
        .eq("is_active", true)
        .order("name", { ascending: true })

      if (error) throw error

      setItems((data ?? []) as StockItem[])
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

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return items
      .filter((item) => {
        const status = getStockStatus(item)
        const matchesFilter = filter === "all" || status === filter
        const matchesSearch =
          !normalizedSearch || item.name.toLowerCase().includes(normalizedSearch)

        return matchesFilter && matchesSearch
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
  }, [items, search, filter])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleEdit = (item: StockItem) => {
    setEditingId(item.id)
    setActiveAction(null)

    setForm({
      name: item.name,
      base_unit_type: item.base_unit_type,
      current_quantity: String(item.current_quantity ?? ""),
      minimum_quantity: String(item.minimum_quantity ?? ""),
    })

    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleSaveItem = async () => {
    try {
      const resolvedRestaurantId = await resolveRestaurant()
      const name = form.name.trim()
      const currentQuantity = parseNumber(form.current_quantity)
      const minimumQuantity = parseNumber(form.minimum_quantity)

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

      setIsSaving(true)

      if (editingId) {
        const { error } = await supabase
          .from("stock_items")
          .update({
            name,
            base_unit_type: form.base_unit_type,
            current_quantity: currentQuantity,
            minimum_quantity: minimumQuantity,
            is_active: true,
          })
          .eq("id", editingId)
          .eq("restaurant_id", resolvedRestaurantId)

        if (error) throw error

        toast({
          title: "Item atualizado",
          description: "A contagem do item foi atualizada.",
        })
      } else {
        const { error } = await supabase.from("stock_items").insert({
          restaurant_id: resolvedRestaurantId,
          name,
          category: null,
          category_id: null,
          base_unit_type: form.base_unit_type,
          cost_per_base_unit: 0,
          current_quantity: currentQuantity,
          minimum_quantity: minimumQuantity,
          is_active: true,
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

  const openStockAction = (item: StockItem, type: ActiveAction["type"]) => {
    setEditingId(null)
    setForm(emptyForm)

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
      const selectedItem = items.find((item) => item.id === activeAction.itemId)
      const quantity = parseNumber(activeAction.quantity)

      if (!selectedItem) {
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

      const currentQuantity = Number(selectedItem.current_quantity || 0)
      const unitCost = Number(selectedItem.cost_per_base_unit || 0)

      let movementType: StockMovementType = "adjustment"
      let signedQuantity = 0
      let nextQuantity = currentQuantity

      if (activeAction.type === "entry") {
        movementType = "purchase"
        signedQuantity = quantity
        nextQuantity = currentQuantity + quantity
      }

      if (activeAction.type === "exit") {
        movementType = "sale"
        signedQuantity = quantity * -1
        nextQuantity = currentQuantity - quantity
      }

      if (activeAction.type === "count") {
        movementType = "adjustment"
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
        .eq("id", selectedItem.id)
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
          stock_item_id: selectedItem.id,
          movement_type: movementType,
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
        description: `${selectedItem.name} agora tem ${formatNumber(
          nextQuantity
        )} ${getUnitLabel(selectedItem.base_unit_type).toLowerCase()}.`,
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
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-950">
              Controle de estoque
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Contagem simples: cadastre o item, informe o mínimo e registre entrada, saída ou conferência.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadStockData()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </button>
        </div>

        {isLoading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-slate-200 bg-white">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando estoque...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-4">
              <StatBox
                title="Itens"
                value={String(items.length)}
                icon={<Package className="h-4 w-4" />}
              />
              <StatBox
                title="OK"
                value={String(okStockItems.length)}
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
              <StatBox
                title="Baixo"
                value={String(lowStockItems.length)}
                icon={<AlertTriangle className="h-4 w-4" />}
              />
              <StatBox
                title="Zerado"
                value={String(zeroStockItems.length)}
                icon={<X className="h-4 w-4" />}
              />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-slate-950">
                    {editingId ? "Editar item" : "Cadastrar item"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Só o necessário para controlar quantidade.
                  </p>
                </div>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_auto] md:items-end">
                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Item
                  </label>
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Ex: Arroz, carne, óleo, embalagem..."
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Unidade
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
                    Atual
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
                    Mínimo
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

                <button
                  type="button"
                  onClick={() => void handleSaveItem()}
                  disabled={isSaving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {editingId ? "Salvar" : "Cadastrar"}
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-base font-black text-slate-950">
                      Lista de estoque
                    </h2>
                    <p className="text-sm text-slate-500">
                      Use os botões da linha para lançar entrada, saída ou conferir a quantidade real.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 sm:w-[280px]">
                      <Search className="h-4 w-4 text-slate-400" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar item..."
                        className="h-full w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                      />
                    </div>

                    <select
                      value={filter}
                      onChange={(event) => setFilter(event.target.value as StockFilter)}
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-slate-500"
                    >
                      <option value="all">Todos</option>
                      <option value="zero">Zerados</option>
                      <option value="low">Baixo estoque</option>
                      <option value="ok">OK</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                {filteredItems.length === 0 ? (
                  <div className="p-4">
                    <EmptyState message="Nenhum item encontrado." />
                  </div>
                ) : (
                  <table className="w-full min-w-[900px] border-collapse text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Qtd atual</th>
                        <th className="px-4 py-3">Mínimo</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      {filteredItems.map((item) => {
                        const quantity = Number(item.current_quantity || 0)
                        const minimum = Number(item.minimum_quantity || 0)
                        const status = getStockStatus(item)
                        const isActionOpen = activeAction?.itemId === item.id

                        return (
                          <tr
                            key={item.id}
                            className={cn(
                              "align-top",
                              status === "zero" && "bg-red-50/60",
                              status === "low" && "bg-amber-50/60"
                            )}
                          >
                            <td className="px-4 py-3">
                              <p className="font-black text-slate-950">{item.name}</p>
                              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                                Unidade: {getUnitLabel(item.base_unit_type)}
                              </p>

                              {isActionOpen && (
                                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                                  <div className="grid gap-3 md:grid-cols-[0.8fr_1fr]">
                                    <div>
                                      <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                                        {activeAction.type === "count"
                                          ? "Quantidade contada"
                                          : "Quantidade"}
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
                                        placeholder="Ex: contagem do fechamento, perda, reposição..."
                                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-slate-500"
                                      />
                                    </div>
                                  </div>

                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void handleStockAction()}
                                      disabled={isMovingStock}
                                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isMovingStock ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Save className="h-4 w-4" />
                                      )}
                                      Confirmar {getActionLabel(activeAction.type)}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setActiveAction(null)}
                                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                                    >
                                      <X className="h-4 w-4" />
                                      Fechar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              <p className="text-lg font-black text-slate-950">
                                {formatNumber(quantity)}
                              </p>
                              <p className="text-xs font-semibold text-slate-500">
                                {getUnitLabel(item.base_unit_type).toLowerCase()}
                              </p>
                            </td>

                            <td className="px-4 py-3">
                              <p className="font-black text-slate-800">
                                {formatNumber(minimum)}
                              </p>
                            </td>

                            <td className="px-4 py-3">
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

                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openStockAction(item, "entry")}
                                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                                >
                                  <PlusCircle className="h-4 w-4" />
                                  Entrada
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openStockAction(item, "exit")}
                                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 hover:bg-red-100"
                                >
                                  <MinusCircle className="h-4 w-4" />
                                  Saída
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openStockAction(item, "count")}
                                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100"
                                >
                                  <ClipboardCheck className="h-4 w-4" />
                                  Conferir
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleEdit(item)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                  aria-label="Editar item"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void handleDelete(item.id)}
                                  disabled={deletingId === item.id}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label="Remover item"
                                >
                                  {deletingId === item.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  )
}