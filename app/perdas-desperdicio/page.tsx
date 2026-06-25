"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  Utensils,
  Warehouse,
  X,
} from "lucide-react"

import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"

type Product = Record<string, any>
type StockItem = Record<string, any>
type ItemSource = "manual" | "product" | "stock"
type LossPresetId =
  | "perda"
  | "vencimento"
  | "quebra"
  | "sobra"
  | "consumo_funcionario"
  | "consumo_proprio"
  | "doacao"
  | "pedido_cancelado"

type LossFilter =
  | "todos"
  | "perdas"
  | "vencimento"
  | "quebra"
  | "sobra"
  | "consumos"
  | "doacoes"

type ProductLoss = {
  id: string
  restaurant_id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_cost: number
  total_cost: number | null
  sale_unit_price: number
  potential_sale_amount: number | null
  reason: string
  notes: string | null
  occurred_at: string
  created_by: string | null
  created_at: string
  stock_item_id: string | null
  loss_unit_type: string
  base_unit_type: string
  sector: string
  loss_origin: string
  responsible_name: string | null
  is_preventable: boolean
}

type LossForm = {
  preset_id: LossPresetId
  item_source: ItemSource
  product_id: string
  stock_item_id: string
  product_name: string
  quantity: string
  unit_cost: string
  sale_unit_price: string
  reason: string
  notes: string
  occurred_at: string
  loss_unit_type: string
  base_unit_type: string
  sector: string
  loss_origin: string
  responsible_name: string
  is_preventable: boolean
  update_stock: boolean
}

const nowLocal = new Date()
const defaultDateTime = new Date(
  nowLocal.getTime() - nowLocal.getTimezoneOffset() * 60000,
)
  .toISOString()
  .slice(0, 16)

const emptyForm: LossForm = {
  preset_id: "perda",
  item_source: "manual",
  product_id: "",
  stock_item_id: "",
  product_name: "",
  quantity: "1",
  unit_cost: "0",
  sale_unit_price: "0",
  reason: "Outro",
  notes: "",
  occurred_at: defaultDateTime,
  loss_unit_type: "unidade",
  base_unit_type: "unidade",
  sector: "estoque",
  loss_origin: "estoque",
  responsible_name: "",
  is_preventable: true,
  update_stock: false,
}

const lossPresets: Array<{
  id: LossPresetId
  label: string
  description: string
  reason: string
  origin: string
  sector: string
  preventable: boolean
}> = [
  {
    id: "perda",
    label: "Perda",
    description: "erro, descarte ou produção perdida",
    reason: "Outro",
    origin: "desperdicio",
    sector: "cozinha",
    preventable: true,
  },
  {
    id: "vencimento",
    label: "Vencimento",
    description: "produto venceu ou ficou impróprio",
    reason: "Vencimento",
    origin: "estoque",
    sector: "estoque",
    preventable: true,
  },
  {
    id: "quebra",
    label: "Quebra",
    description: "item quebrado, rasgado ou derramado",
    reason: "Quebra",
    origin: "estoque",
    sector: "estoque",
    preventable: true,
  },
  {
    id: "sobra",
    label: "Sobra",
    description: "sobra do dia ou preparo excedente",
    reason: "Sobra",
    origin: "producao",
    sector: "cozinha",
    preventable: true,
  },
  {
    id: "consumo_funcionario",
    label: "Consumo funcionário",
    description: "refeição, bebida ou consumo interno",
    reason: "Consumo de funcionário",
    origin: "funcionarios",
    sector: "equipe",
    preventable: false,
  },
  {
    id: "consumo_proprio",
    label: "Consumo próprio",
    description: "retirada do dono ou uso interno",
    reason: "Consumo próprio",
    origin: "consumo_proprio",
    sector: "administrativo",
    preventable: false,
  },
  {
    id: "doacao",
    label: "Doação / cortesia",
    description: "cortesia, brinde ou doação",
    reason: "Doação",
    origin: "doacao",
    sector: "atendimento",
    preventable: false,
  },
  {
    id: "pedido_cancelado",
    label: "Pedido cancelado",
    description: "produção perdida por cancelamento",
    reason: "Pedido cancelado",
    origin: "delivery",
    sector: "atendimento",
    preventable: true,
  },
]

const lossFilters: Array<{ id: LossFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "perdas", label: "Perdas" },
  { id: "vencimento", label: "Vencimento" },
  { id: "quebra", label: "Quebras" },
  { id: "sobra", label: "Sobras" },
  { id: "consumos", label: "Consumos" },
  { id: "doacoes", label: "Doações" },
]

function parseNumber(value: string | number | null | undefined) {
  const normalized = String(value ?? "").replace(",", ".")
  const number = Number(normalized)

  return Number.isFinite(number) ? number : 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
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
      0,
  )
}

function getProductCost(product?: Product) {
  if (!product) return 0

  return Number(
    product.unit_cost ||
      product.cost_price ||
      product.cost ||
      product.average_cost ||
      product.production_cost ||
      product.cmv ||
      0,
  )
}

function getStockName(item?: StockItem) {
  if (!item) return "Insumo não encontrado"

  return item.name || item.title || item.item_name || "Insumo sem nome"
}

function getStockUnit(item?: StockItem) {
  if (!item) return "unidade"

  return item.unit || item.measure_unit || item.unit_measure || "unidade"
}

function getStockCost(item?: StockItem) {
  if (!item) return 0

  return Number(
    item.unit_cost ||
      item.cost_per_unit ||
      item.average_cost ||
      item.price_per_unit ||
      item.cost ||
      0,
  )
}

function getStockQuantity(item?: StockItem) {
  if (!item) return 0

  return Number(item.current_quantity ?? item.quantity ?? 0)
}

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function getLossGroup(loss: ProductLoss): LossFilter {
  const reason = normalizeText(loss.reason)
  const origin = normalizeText(loss.loss_origin)

  if (reason.includes("vencimento")) return "vencimento"
  if (reason.includes("quebra")) return "quebra"
  if (reason.includes("sobra")) return "sobra"

  if (
    reason.includes("consumo") ||
    origin.includes("funcionario") ||
    origin.includes("consumo")
  ) {
    return "consumos"
  }

  if (
    reason.includes("doacao") ||
    reason.includes("cortesia") ||
    origin.includes("doacao")
  ) {
    return "doacoes"
  }

  return "perdas"
}

export default function PerdasDesperdicioPage() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [losses, setLosses] = useState<ProductLoss[]>([])

  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<LossFilter>("todos")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<LossForm>(emptyForm)
  const [itemSearch, setItemSearch] = useState("")

  async function loadPageData() {
    setLoading(true)
    setError(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError("Não foi possível identificar o usuário logado.")
      setLoading(false)
      return
    }

    setUserId(user.id)

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError || !restaurant) {
      setError("Não foi possível encontrar o restaurante vinculado a este usuário.")
      setLoading(false)
      return
    }

    setRestaurantId(restaurant.id)

    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })

    if (productsError) {
      setError("Erro ao carregar produtos.")
      setLoading(false)
      return
    }

    const { data: stockData, error: stockError } = await supabase
      .from("stock_items")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("name", { ascending: true })

    if (stockError) {
      setError("Erro ao carregar estoque.")
      setLoading(false)
      return
    }

    const { data: lossesData, error: lossesError } = await supabase
      .from("product_losses")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false })

    if (lossesError) {
      setError("Erro ao carregar perdas e desperdícios.")
      setLoading(false)
      return
    }

    setProducts((productsData || []) as Product[])
    setStockItems((stockData || []) as StockItem[])
    setLosses((lossesData || []) as ProductLoss[])

    setLoading(false)
  }

  useEffect(() => {
    void loadPageData()
  }, [])

  const productById = useMemo(() => {
    const map = new Map<string, Product>()

    for (const product of products) {
      map.set(product.id, product)
    }

    return map
  }, [products])

  const stockById = useMemo(() => {
    const map = new Map<string, StockItem>()

    for (const item of stockItems) {
      map.set(item.id, item)
    }

    return map
  }, [stockItems])

  const selectedStockItem = useMemo(() => {
    if (!form.stock_item_id) return null

    return stockById.get(form.stock_item_id) || null
  }, [form.stock_item_id, stockById])

  const filteredLosses = useMemo(() => {
    const term = search.trim().toLowerCase()

    return losses.filter((loss) => {
      const matchesFilter =
        activeFilter === "todos" || getLossGroup(loss) === activeFilter

      const matchesSearch = !term
        ? true
        : [
            loss.product_name,
            loss.reason,
            loss.notes,
            loss.sector,
            loss.loss_origin,
            loss.responsible_name,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term))

      return matchesFilter && matchesSearch
    })
  }, [losses, search, activeFilter])

  const filterCounts = useMemo(() => {
    return losses.reduce(
      (acc, loss) => {
        const group = getLossGroup(loss)
        acc.todos += 1
        acc[group] += 1
        return acc
      },
      {
        todos: 0,
        perdas: 0,
        vencimento: 0,
        quebra: 0,
        sobra: 0,
        consumos: 0,
        doacoes: 0,
      } as Record<LossFilter, number>,
    )
  }, [losses])

  const productOptions = useMemo(() => {
    const term = normalizeText(itemSearch)

    return products
      .filter((product) => {
        if (!term) return true
        return normalizeText(getProductName(product)).includes(term)
      })
      .slice(0, 8)
  }, [products, itemSearch])

  const stockOptions = useMemo(() => {
    const term = normalizeText(itemSearch)

    return stockItems
      .filter((item) => {
        if (!term) return true
        return normalizeText(getStockName(item)).includes(term)
      })
      .slice(0, 8)
  }, [stockItems, itemSearch])

  const totals = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const totalLoss = losses.reduce(
      (sum, loss) => sum + Number(loss.total_cost || 0),
      0,
    )

    const potentialSaleAmount = losses.reduce(
      (sum, loss) => sum + Number(loss.potential_sale_amount || 0),
      0,
    )

    const todayLoss = losses
      .filter((loss) => new Date(loss.occurred_at) >= startOfToday)
      .reduce((sum, loss) => sum + Number(loss.total_cost || 0), 0)

    const monthLoss = losses
      .filter((loss) => new Date(loss.occurred_at) >= startOfMonth)
      .reduce((sum, loss) => sum + Number(loss.total_cost || 0), 0)

    const preventableLoss = losses
      .filter((loss) => loss.is_preventable)
      .reduce((sum, loss) => sum + Number(loss.total_cost || 0), 0)

    const internalConsumption = losses
      .filter((loss) => getLossGroup(loss) === "consumos")
      .reduce((sum, loss) => sum + Number(loss.potential_sale_amount || 0), 0)

    return {
      totalLoss,
      potentialSaleAmount,
      todayLoss,
      monthLoss,
      preventableLoss,
      internalConsumption,
      count: losses.length,
    }
  }, [losses])

  const totalCost = parseNumber(form.quantity) * parseNumber(form.unit_cost)
  const potentialSaleAmount =
    parseNumber(form.quantity) * parseNumber(form.sale_unit_price)
  const stockCurrentQuantity = getStockQuantity(selectedStockItem || undefined)
  const stockAfterQuantity = Math.max(
    stockCurrentQuantity - parseNumber(form.quantity),
    0,
  )

  function openModal() {
    setForm({ ...emptyForm, occurred_at: defaultDateTime })
    setItemSearch("")
    setIsModalOpen(true)
    setError(null)
  }

  function closeModal() {
    if (saving) return

    setIsModalOpen(false)
    setForm({ ...emptyForm, occurred_at: defaultDateTime })
    setItemSearch("")
  }

  function handlePresetSelect(presetId: LossPresetId) {
    const preset = lossPresets.find((item) => item.id === presetId)
    if (!preset) return

    setForm((current) => ({
      ...current,
      preset_id: preset.id,
      reason: preset.reason,
      loss_origin: preset.origin,
      sector: preset.sector,
      is_preventable: preset.preventable,
    }))
  }

  function handleItemSourceChange(source: ItemSource) {
    setItemSearch("")
    setForm((current) => ({
      ...current,
      item_source: source,
      product_id: "",
      stock_item_id: "",
      product_name: source === "manual" ? current.product_name : "",
      update_stock: source === "stock",
    }))
  }

  function handleProductSelect(product: Product) {
    const productName = getProductName(product)
    const productCost = getProductCost(product)
    const productPrice = getProductPrice(product)

    setItemSearch(productName)
    setForm((current) => ({
      ...current,
      item_source: "product",
      product_id: product.id,
      stock_item_id: "",
      product_name: productName,
      unit_cost:
        current.unit_cost === "0" && productCost > 0
          ? String(productCost)
          : current.unit_cost,
      sale_unit_price: productPrice > 0 ? String(productPrice) : current.sale_unit_price,
      update_stock: false,
    }))
  }

  function handleStockSelect(item: StockItem) {
    const itemName = getStockName(item)
    const itemCost = getStockCost(item)
    const itemUnit = getStockUnit(item)

    setItemSearch(itemName)
    setForm((current) => ({
      ...current,
      item_source: "stock",
      product_id: "",
      stock_item_id: item.id,
      product_name: itemName,
      unit_cost: itemCost > 0 ? String(itemCost) : current.unit_cost,
      loss_unit_type: itemUnit,
      base_unit_type: itemUnit,
      update_stock: true,
    }))
  }

  async function handleCreateLoss(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!restaurantId) {
      setError("Restaurante não encontrado.")
      return
    }

    const quantity = parseNumber(form.quantity)
    const unitCost = parseNumber(form.unit_cost)
    const saleUnitPrice = parseNumber(form.sale_unit_price)
    const totalCostValue = quantity * unitCost
    const potentialSaleAmountValue = quantity * saleUnitPrice

    if (!form.product_name.trim()) {
      setError("Informe o nome do item perdido/desperdiçado.")
      return
    }

    if (quantity <= 0) {
      setError("A quantidade precisa ser maior que zero.")
      return
    }

    setSaving(true)
    setError(null)

    const occurredAt = form.occurred_at
      ? new Date(form.occurred_at).toISOString()
      : new Date().toISOString()

    const { data, error: insertError } = await supabase
      .from("product_losses")
      .insert({
        restaurant_id: restaurantId,
        product_id: form.product_id || null,
        stock_item_id: form.stock_item_id || null,
        product_name: form.product_name.trim(),
        quantity,
        unit_cost: unitCost,
        total_cost: totalCostValue,
        sale_unit_price: saleUnitPrice,
        potential_sale_amount: potentialSaleAmountValue,
        reason: form.reason,
        notes: onlyFilled(form.notes),
        occurred_at: occurredAt,
        created_by: userId,
        loss_unit_type: form.loss_unit_type,
        base_unit_type: form.base_unit_type,
        sector: form.sector,
        loss_origin: form.loss_origin,
        responsible_name: onlyFilled(form.responsible_name),
        is_preventable: form.is_preventable,
      })
      .select("*")
      .single()

    if (insertError || !data) {
      setError("Erro ao registrar perda/desperdício.")
      setSaving(false)
      return
    }

    if (form.stock_item_id && form.update_stock) {
      const stockItem = stockById.get(form.stock_item_id)
      const currentQuantity = getStockQuantity(stockItem)
      const nextQuantity = Math.max(currentQuantity - quantity, 0)

      const { error: stockError } = await supabase
        .from("stock_items")
        .update({
          current_quantity: nextQuantity,
        })
        .eq("id", form.stock_item_id)
        .eq("restaurant_id", restaurantId)

      if (stockError) {
        setError("Perda registrada, mas houve erro ao atualizar o estoque.")
        setSaving(false)
        return
      }

      await supabase.from("stock_movements").insert({
        restaurant_id: restaurantId,
        stock_item_id: form.stock_item_id,
        movement_type: form.loss_origin === "desperdicio" ? "waste" : "loss",
        quantity,
        unit_cost: unitCost,
        total_cost: totalCostValue,
        reference_type: "product_loss",
        reference_id: data.id,
        product_id: form.product_id || null,
        notes:
          onlyFilled(form.notes) ||
          `Perda registrada em ${form.sector}: ${form.reason}`,
      })

      setStockItems((current) =>
        current.map((item) =>
          item.id === form.stock_item_id
            ? {
                ...item,
                current_quantity: nextQuantity,
              }
            : item,
        ),
      )
    }

    setLosses((current) => [data as ProductLoss, ...current])
    setSaving(false)
    closeModal()
  }

  async function handleDeleteLoss(loss: ProductLoss) {
    if (!restaurantId) return

    const shouldDelete = window.confirm(
      "Deseja remover este lançamento de perdas e consumos?",
    )

    if (!shouldDelete) return

    const { error: deleteError } = await supabase
      .from("product_losses")
      .delete()
      .eq("id", loss.id)
      .eq("restaurant_id", restaurantId)

    if (deleteError) {
      setError("Erro ao remover perda/desperdício.")
      return
    }

    setLosses((current) => current.filter((item) => item.id !== loss.id))
  }

  return (
    <AdminLayout title="Perdas e Consumos">
      <div className="w-full space-y-3 pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
              Controle de margem perdida
            </p>

            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
              Perdas e Consumos
            </h1>

            <p className="mt-1 text-sm font-medium text-zinc-500">
              Registre desperdícios, quebras, vencimentos, consumo interno e cortesias.
            </p>
          </div>

          <button
            type="button"
            onClick={openModal}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 text-sm font-black text-black shadow-sm transition hover:bg-yellow-300"
          >
            <Plus className="h-4 w-4" />
            Novo lançamento
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                Perda hoje
              </p>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>

            <p className="mt-1 text-xl font-black text-red-600">
              {formatCurrency(totals.todayLoss)}
            </p>

            <p className="mt-0.5 text-xs font-semibold text-zinc-500">
              impacto do dia
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                Perda no mês
              </p>
              <Package className="h-4 w-4 text-zinc-500" />
            </div>

            <p className="mt-1 text-xl font-black text-white">
              {formatCurrency(totals.monthLoss)}
            </p>

            <p className="mt-0.5 text-xs font-semibold text-zinc-500">
              {totals.count} lançamentos
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                Venda perdida
              </p>
              <ClipboardList className="h-4 w-4 text-yellow-400" />
            </div>

            <p className="mt-1 text-xl font-black text-yellow-400">
              {formatCurrency(totals.potentialSaleAmount)}
            </p>

            <p className="mt-0.5 text-xs font-semibold text-zinc-500">
              potencial não vendido
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                Evitável
              </p>
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
            </div>

            <p className="mt-1 text-xl font-black text-yellow-400">
              {formatCurrency(totals.preventableLoss)}
            </p>

            <p className="mt-0.5 text-xs font-semibold text-zinc-500">
              pode ser reduzido
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                Consumo interno
              </p>
              <Utensils className="h-4 w-4 text-emerald-400" />
            </div>

            <p className="mt-1 text-xl font-black text-emerald-400">
              {formatCurrency(totals.internalConsumption)}
            </p>

            <p className="mt-0.5 text-xs font-semibold text-zinc-500">
              funcionários/dono
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-sm">
          <div className="space-y-3 border-b border-white/10 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-black text-white">
                  Histórico operacional
                </h2>

                <p className="text-sm font-medium text-zinc-500">
                  Lista de tudo que tirou margem do restaurante.
                </p>
              </div>

              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar item, motivo ou responsável..."
                  className="h-10 w-full rounded-xl border border-white/10 bg-[#111111] pl-10 pr-4 text-sm font-semibold outline-none transition placeholder:text-zinc-500 focus:border-yellow-400/30 focus:bg-[#0A0A0A]"
                />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {lossFilters.map((filter) => {
                const isActive = activeFilter === filter.id

                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveFilter(filter.id)}
                    className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-black transition ${
                      isActive
                        ? "border-yellow-400/30 bg-yellow-400 text-black"
                        : "border-white/10 bg-[#0A0A0A] text-zinc-500 hover:bg-[#111111]"
                    }`}
                  >
                    {filter.label}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        isActive ? "bg-[#0A0A0A] text-white" : "bg-[#111111] text-zinc-500"
                      }`}
                    >
                      {filterCounts[filter.id]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="m-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <div className="flex items-center gap-2 text-sm font-bold text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando registros...
              </div>
            </div>
          ) : filteredLosses.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center p-6 text-center">
              <div className="rounded-xl bg-[#111111] p-3 text-zinc-500">
                <TrendingDown className="h-6 w-6" />
              </div>

              <h3 className="mt-3 text-base font-black text-white">
                Nenhum lançamento encontrado
              </h3>

              <p className="mt-1 max-w-md text-sm font-medium text-zinc-500">
                Registre perdas, consumos, doações e quebras para enxergar onde o restaurante está perdendo dinheiro.
              </p>

              <button
                type="button"
                onClick={openModal}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-yellow-400 px-4 text-sm font-black text-black transition hover:bg-yellow-300"
              >
                <Plus className="h-4 w-4" />
                Criar primeiro lançamento
              </button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1050px] text-left">
                  <thead>
                    <tr className="border-b border-white/10 bg-[#111111] text-xs font-black uppercase tracking-wide text-zinc-500">
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Origem</th>
                      <th className="px-4 py-3">Qtd.</th>
                      <th className="px-4 py-3">Custo</th>
                      <th className="px-4 py-3">Venda perdida</th>
                      <th className="px-4 py-3">Responsável</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/10">
                    {filteredLosses.map((loss) => (
                      <tr key={loss.id} className="hover:bg-[#111111]">
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-zinc-500">
                          {formatDateTime(loss.occurred_at)}
                        </td>

                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-lg bg-[#111111] px-2.5 py-1 text-xs font-black text-zinc-500">
                            {loss.reason}
                          </span>

                          {loss.is_preventable && (
                            <p className="mt-1 text-xs font-bold text-yellow-400">
                              Evitável
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-black text-white">
                            {loss.product_name}
                          </p>

                          {loss.notes && (
                            <p className="mt-1 max-w-xs truncate text-xs font-semibold text-zinc-500">
                              {loss.notes}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <p className="text-sm font-bold capitalize text-zinc-500">
                            {loss.loss_origin.replaceAll("_", " ")}
                          </p>

                          <p className="text-xs font-semibold capitalize text-zinc-500">
                            {loss.sector}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-sm font-bold text-zinc-500">
                          {Number(loss.quantity || 0)} {loss.loss_unit_type}
                        </td>

                        <td className="px-4 py-3 text-sm font-black text-red-600">
                          {formatCurrency(Number(loss.total_cost || 0))}
                        </td>

                        <td className="px-4 py-3 text-sm font-black text-yellow-400">
                          {formatCurrency(Number(loss.potential_sale_amount || 0))}
                        </td>

                        <td className="px-4 py-3 text-sm font-bold text-zinc-500">
                          {loss.responsible_name || "Não informado"}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleDeleteLoss(loss)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#0A0A0A] text-zinc-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-white/10 lg:hidden">
                {filteredLosses.map((loss) => (
                  <div key={loss.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black text-white">
                          {loss.product_name}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-zinc-500">
                          {formatDateTime(loss.occurred_at)} · {loss.sector}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteLoss(loss)}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#0A0A0A] text-zinc-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-lg bg-[#111111] px-2.5 py-1 text-xs font-black text-zinc-500">
                        {loss.reason}
                      </span>

                      <span className="rounded-lg bg-[#111111] px-2.5 py-1 text-xs font-black capitalize text-zinc-500">
                        {loss.loss_origin.replaceAll("_", " ")}
                      </span>

                      {loss.is_preventable && (
                        <span className="rounded-lg bg-yellow-400/10 px-2.5 py-1 text-xs font-black text-yellow-400">
                          Evitável
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-red-50 p-3">
                        <p className="text-xs font-bold text-red-700">
                          Custo perdido
                        </p>

                        <p className="mt-1 text-base font-black text-red-700">
                          {formatCurrency(Number(loss.total_cost || 0))}
                        </p>
                      </div>

                      <div className="rounded-xl bg-yellow-400/10 p-3">
                        <p className="text-xs font-bold text-yellow-400">
                          Venda perdida
                        </p>

                        <p className="mt-1 text-base font-black text-yellow-400">
                          {formatCurrency(Number(loss.potential_sale_amount || 0))}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 text-xs font-semibold text-zinc-500">
                      <p>
                        Qtd: {Number(loss.quantity || 0)} {loss.loss_unit_type}
                      </p>

                      <p>
                        Responsável: {loss.responsible_name || "Não informado"}
                      </p>

                      {loss.notes && <p className="mt-1">{loss.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-[#050505]">
            <form
              onSubmit={handleCreateLoss}
              className="flex h-full w-full flex-col bg-[#0A0A0A] shadow-2xl sm:max-w-2xl sm:rounded-l-3xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-yellow-400">
                    Novo lançamento
                  </p>

                  <h2 className="mt-1 text-xl font-black text-white">
                    Perda ou consumo
                  </h2>

                  <p className="mt-1 text-sm font-medium text-zinc-500">
                    Informe o tipo, item, quantidade e impacto financeiro.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#111111] text-zinc-500 transition hover:bg-[#111111] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
                <section className="rounded-2xl border border-white/10 bg-[#111111] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-white">
                        1. Tipo do lançamento
                      </h3>

                      <p className="text-xs font-semibold text-zinc-500">
                        Escolha o cenário para preencher o cadastro mais rápido.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {lossPresets.map((preset) => {
                      const isActive = form.preset_id === preset.id

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handlePresetSelect(preset.id)}
                          className={`rounded-xl border p-3 text-left transition ${
                            isActive
                              ? "border-yellow-400/30 bg-[#0A0A0A] shadow-sm ring-2 ring-yellow-400/20"
                              : "border-white/10 bg-[#0A0A0A] hover:border-yellow-400/30"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-black text-white">
                              {preset.label}
                            </p>

                            {isActive && (
                              <CheckCircle2 className="h-4 w-4 text-yellow-400" />
                            )}
                          </div>

                          <p className="mt-1 text-xs font-semibold text-zinc-500">
                            {preset.description}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-3">
                  <h3 className="text-sm font-black text-white">
                    2. Item perdido ou consumido
                  </h3>

                  <p className="text-xs font-semibold text-zinc-500">
                    Busque no cardápio, estoque ou lance manualmente.
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleItemSourceChange("manual")}
                      className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-xs font-black transition ${
                        form.item_source === "manual"
                          ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
                          : "border-white/10 bg-[#0A0A0A] text-zinc-500 hover:bg-[#111111]"
                      }`}
                    >
                      <ClipboardList className="h-4 w-4" />
                      Manual
                    </button>

                    <button
                      type="button"
                      onClick={() => handleItemSourceChange("product")}
                      className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-xs font-black transition ${
                        form.item_source === "product"
                          ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
                          : "border-white/10 bg-[#0A0A0A] text-zinc-500 hover:bg-[#111111]"
                      }`}
                    >
                      <Utensils className="h-4 w-4" />
                      Cardápio
                    </button>

                    <button
                      type="button"
                      onClick={() => handleItemSourceChange("stock")}
                      className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-xs font-black transition ${
                        form.item_source === "stock"
                          ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
                          : "border-white/10 bg-[#0A0A0A] text-zinc-500 hover:bg-[#111111]"
                      }`}
                    >
                      <Warehouse className="h-4 w-4" />
                      Estoque
                    </button>
                  </div>

                  {form.item_source === "manual" ? (
                    <label className="mt-3 block">
                      <span className="text-sm font-black text-zinc-500">
                        Nome do item *
                      </span>

                      <input
                        value={form.product_name}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            product_name: event.target.value,
                          }))
                        }
                        placeholder="Ex: marmita G de picanha com fritas"
                        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30"
                      />
                    </label>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <label className="block">
                        <span className="text-sm font-black text-zinc-500">
                          Buscar item
                        </span>

                        <div className="relative mt-2">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

                          <input
                            value={itemSearch}
                            onChange={(event) => setItemSearch(event.target.value)}
                            placeholder={
                              form.item_source === "product"
                                ? "Digite o nome do produto do cardápio..."
                                : "Digite o nome do item do estoque..."
                            }
                            className="h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30"
                          />
                        </div>
                      </label>

                      <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-[#111111] p-2">
                        {form.item_source === "product" &&
                          productOptions.map((product) => {
                            const isActive = form.product_id === product.id

                            return (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => handleProductSelect(product)}
                                className={`w-full rounded-xl border p-3 text-left transition ${
                                  isActive
                                    ? "border-yellow-400/30 bg-[#0A0A0A] ring-2 ring-yellow-400/20"
                                    : "border-white/10 bg-[#0A0A0A] hover:border-yellow-400/30"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-black text-white">
                                    {getProductName(product)}
                                  </p>

                                  <p className="shrink-0 text-sm font-black text-yellow-400">
                                    {formatCurrency(getProductPrice(product))}
                                  </p>
                                </div>

                                <p className="mt-1 text-xs font-semibold text-zinc-500">
                                  Cardápio · custo estimado {formatCurrency(getProductCost(product))}
                                </p>
                              </button>
                            )
                          })}

                        {form.item_source === "stock" &&
                          stockOptions.map((item) => {
                            const isActive = form.stock_item_id === item.id

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleStockSelect(item)}
                                className={`w-full rounded-xl border p-3 text-left transition ${
                                  isActive
                                    ? "border-yellow-400/30 bg-[#0A0A0A] ring-2 ring-yellow-400/20"
                                    : "border-white/10 bg-[#0A0A0A] hover:border-yellow-400/30"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-black text-white">
                                    {getStockName(item)}
                                  </p>

                                  <p className="shrink-0 text-xs font-black text-zinc-500">
                                    {getStockQuantity(item)} {getStockUnit(item)}
                                  </p>
                                </div>

                                <p className="mt-1 text-xs font-semibold text-zinc-500">
                                  Estoque · custo {formatCurrency(getStockCost(item))} por {getStockUnit(item)}
                                </p>
                              </button>
                            )
                          })}

                        {form.item_source === "product" && productOptions.length === 0 && (
                          <p className="p-3 text-sm font-bold text-zinc-500">
                            Nenhum produto encontrado.
                          </p>
                        )}

                        {form.item_source === "stock" && stockOptions.length === 0 && (
                          <p className="p-3 text-sm font-bold text-zinc-500">
                            Nenhum item de estoque encontrado.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-3">
                  <h3 className="text-sm font-black text-white">
                    3. Quantidade e valores
                  </h3>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label>
                      <span className="text-sm font-black text-zinc-500">
                        Quantidade *
                      </span>

                      <input
                        value={form.quantity}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            quantity: event.target.value,
                          }))
                        }
                        placeholder="1"
                        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30"
                      />
                    </label>

                    <label>
                      <span className="text-sm font-black text-zinc-500">
                        Unidade
                      </span>

                      <input
                        value={form.loss_unit_type}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            loss_unit_type: event.target.value,
                            base_unit_type: event.target.value,
                          }))
                        }
                        placeholder="unidade, kg, g..."
                        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30"
                      />
                    </label>

                    <label>
                      <span className="text-sm font-black text-zinc-500">
                        Data/hora
                      </span>

                      <input
                        type="datetime-local"
                        value={form.occurred_at}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            occurred_at: event.target.value,
                          }))
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30"
                      />
                    </label>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="text-sm font-black text-zinc-500">
                        Custo unitário
                      </span>

                      <input
                        value={form.unit_cost}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            unit_cost: event.target.value,
                          }))
                        }
                        placeholder="0"
                        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30"
                      />
                    </label>

                    <label>
                      <span className="text-sm font-black text-zinc-500">
                        Preço de venda unitário
                      </span>

                      <input
                        value={form.sale_unit_price}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            sale_unit_price: event.target.value,
                          }))
                        }
                        placeholder="0"
                        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30"
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-3">
                  <h3 className="text-sm font-black text-white">
                    4. Operação
                  </h3>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="text-sm font-black text-zinc-500">
                        Motivo
                      </span>

                      <select
                        value={form.reason}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            reason: event.target.value,
                          }))
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30"
                      >
                        <option value="Vencimento">Vencimento</option>
                        <option value="Erro de produção">Erro de produção</option>
                        <option value="Quebra">Quebra</option>
                        <option value="Sobra">Sobra</option>
                        <option value="Pedido cancelado">Pedido cancelado</option>
                        <option value="Consumo de funcionário">Consumo de funcionário</option>
                        <option value="Consumo próprio">Consumo próprio</option>
                        <option value="Doação">Doação</option>
                        <option value="Cortesia">Cortesia</option>
                        <option value="Produto queimado">Produto queimado</option>
                        <option value="Armazenamento incorreto">Armazenamento incorreto</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </label>

                    <label>
                      <span className="text-sm font-black text-zinc-500">
                        Origem
                      </span>

                      <select
                        value={form.loss_origin}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            loss_origin: event.target.value,
                          }))
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30"
                      >
                        <option value="estoque">Estoque</option>
                        <option value="producao">Produção</option>
                        <option value="cozinha">Cozinha</option>
                        <option value="atendimento">Atendimento</option>
                        <option value="delivery">Delivery</option>
                        <option value="funcionarios">Funcionários</option>
                        <option value="doacao">Doação/cortesia</option>
                        <option value="consumo_proprio">Consumo próprio</option>
                        <option value="desperdicio">Desperdício</option>
                      </select>
                    </label>

                    <label>
                      <span className="text-sm font-black text-zinc-500">
                        Setor
                      </span>

                      <input
                        value={form.sector}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            sector: event.target.value,
                          }))
                        }
                        placeholder="estoque, cozinha, salão..."
                        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30"
                      />
                    </label>

                    <label>
                      <span className="text-sm font-black text-zinc-500">
                        Responsável
                      </span>

                      <input
                        value={form.responsible_name}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            responsible_name: event.target.value,
                          }))
                        }
                        placeholder="Nome da pessoa ou setor"
                        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30"
                      />
                    </label>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#111111] p-3">
                      <input
                        type="checkbox"
                        checked={form.is_preventable}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            is_preventable: event.target.checked,
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-white/10"
                      />

                      <div>
                        <p className="text-sm font-black text-zinc-500">
                          Perda evitável
                        </p>

                        <p className="mt-1 text-xs font-semibold text-zinc-500">
                          Marque quando poderia ser reduzida com processo.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#111111] p-3">
                      <input
                        type="checkbox"
                        checked={form.update_stock}
                        disabled={!form.stock_item_id}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            update_stock: event.target.checked,
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-white/10 disabled:opacity-40"
                      />

                      <div>
                        <p className="text-sm font-black text-zinc-500">
                          Baixar do estoque
                        </p>

                        <p className="mt-1 text-xs font-semibold text-zinc-500">
                          Disponível apenas para item vinculado ao estoque.
                        </p>
                      </div>
                    </label>
                  </div>

                  {selectedStockItem && (
                    <div className="mt-3 rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-yellow-400">
                        Movimento de estoque
                      </p>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm font-bold text-yellow-400">
                        <p>Atual: {stockCurrentQuantity} {getStockUnit(selectedStockItem)}</p>
                        <p>Após baixa: {stockAfterQuantity} {getStockUnit(selectedStockItem)}</p>
                      </div>
                    </div>
                  )}

                  <label className="mt-3 block">
                    <span className="text-sm font-black text-zinc-500">
                      Observações
                    </span>

                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Explique rapidamente o que aconteceu..."
                      rows={3}
                      className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#0A0A0A] px-3 py-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30"
                    />
                  </label>
                </section>

                <section className="rounded-2xl border border-white/10 bg-[#050505] p-4 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-white">
                        Resumo do impacto
                      </h3>

                      <p className="text-xs font-semibold text-zinc-500">
                        Conferência antes de salvar o lançamento.
                      </p>
                    </div>

                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-[#0A0A0A] p-3">
                      <p className="text-xs font-bold text-zinc-500">
                        Custo perdido
                      </p>

                      <p className="mt-1 text-2xl font-black text-white">
                        {formatCurrency(totalCost)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#0A0A0A] p-3">
                      <p className="text-xs font-bold text-zinc-500">
                        Venda possível perdida
                      </p>

                      <p className="mt-1 text-2xl font-black text-white">
                        {formatCurrency(potentialSaleAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-[#0A0A0A] p-3 text-xs font-semibold text-zinc-500">
                    <p>Tipo: {form.reason}</p>
                    <p>Item: {form.product_name || "não informado"}</p>
                    <p>
                      Estoque: {form.stock_item_id && form.update_stock ? "será baixado" : "não será baixado"}
                    </p>
                  </div>
                </section>
              </div>

              <div className="border-t border-white/10 bg-[#0A0A0A] px-4 py-3 sm:px-5">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-[#0A0A0A] px-4 text-sm font-black text-zinc-500 transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 text-sm font-black text-black shadow-sm transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar lançamento
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
