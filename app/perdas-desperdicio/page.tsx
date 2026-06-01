"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Product = Record<string, any>
type StockItem = Record<string, any>

type ProductLoss = {
  id: string
  restaurant_id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_cost: number
  total_cost: number | null
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
  product_id: string
  stock_item_id: string
  product_name: string
  quantity: string
  unit_cost: string
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
  product_id: "",
  stock_item_id: "",
  product_name: "",
  quantity: "1",
  unit_cost: "0",
  reason: "Outro",
  notes: "",
  occurred_at: defaultDateTime,
  loss_unit_type: "unidade",
  base_unit_type: "unidade",
  sector: "estoque",
  loss_origin: "estoque",
  responsible_name: "",
  is_preventable: true,
  update_stock: true,
}

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

export default function PerdasDesperdicioPage() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [losses, setLosses] = useState<ProductLoss[]>([])

  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<LossForm>(emptyForm)

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

  const filteredLosses = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return losses

    return losses.filter((loss) => {
      return [
        loss.product_name,
        loss.reason,
        loss.notes,
        loss.sector,
        loss.loss_origin,
        loss.responsible_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [losses, search])

  const totals = useMemo(() => {
    const totalLoss = losses.reduce(
      (sum, loss) => sum + Number(loss.total_cost || 0),
      0,
    )

    const preventableLoss = losses
      .filter((loss) => loss.is_preventable)
      .reduce((sum, loss) => sum + Number(loss.total_cost || 0), 0)

    const stockLoss = losses
      .filter((loss) => loss.loss_origin === "estoque")
      .reduce((sum, loss) => sum + Number(loss.total_cost || 0), 0)

    const productionLoss = losses
      .filter((loss) => loss.loss_origin === "producao")
      .reduce((sum, loss) => sum + Number(loss.total_cost || 0), 0)

    return {
      totalLoss,
      preventableLoss,
      stockLoss,
      productionLoss,
      count: losses.length,
    }
  }, [losses])

  const totalCost = parseNumber(form.quantity) * parseNumber(form.unit_cost)

  function openModal() {
    setForm(emptyForm)
    setIsModalOpen(true)
    setError(null)
  }

  function closeModal() {
    if (saving) return

    setIsModalOpen(false)
    setForm(emptyForm)
  }

  async function handleCreateLoss(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!restaurantId) {
      setError("Restaurante não encontrado.")
      return
    }

    const quantity = parseNumber(form.quantity)
    const unitCost = parseNumber(form.unit_cost)
    const totalCostValue = quantity * unitCost

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
    <div className="min-h-[calc(100vh-96px)] bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/20">
              <TrendingDown className="h-6 w-6" />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
                Gestão
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                Perdas e Desperdício
              </h1>
              <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">
                Registre vencimentos, sobras, erros de produção, itens jogados fora e perdas que reduzem a margem.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Nova perda
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-500">Registros</p>
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <p className="mt-3 text-3xl font-black text-slate-950">
              {totals.count}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              perdas cadastradas
            </p>
          </div>

          <div className="rounded-3xl border border-red-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-500">Total perdido</p>
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <p className="mt-3 text-2xl font-black text-red-600">
              {formatCurrency(totals.totalLoss)}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              impacto estimado
            </p>
          </div>

          <div className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-500">Evitável</p>
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
            <p className="mt-3 text-2xl font-black text-slate-950">
              {formatCurrency(totals.preventableLoss)}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              pode ser reduzido
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-500">Estoque/produção</p>
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="mt-3 text-xl font-black text-slate-950">
              {formatCurrency(totals.stockLoss + totals.productionLoss)}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              origem operacional
            </p>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-950">
                Histórico de perdas
              </h2>
              <p className="text-sm font-medium text-slate-500">
                Acompanhe motivo, setor, responsável e impacto financeiro.
              </p>
            </div>

            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar perda..."
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </div>

          {error && (
            <div className="mx-4 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando perdas...
              </div>
            </div>
          ) : filteredLosses.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <TrendingDown className="h-7 w-7" />
              </div>

              <h3 className="mt-4 text-lg font-black text-slate-950">
                Nenhuma perda registrada
              </h3>

              <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
                Registre desperdícios para entender onde o restaurante está perdendo dinheiro.
              </p>

              <button
                type="button"
                onClick={openModal}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Registrar perda
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-black uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-4">Item</th>
                    <th className="px-5 py-4">Motivo</th>
                    <th className="px-5 py-4">Origem</th>
                    <th className="px-5 py-4">Qtd.</th>
                    <th className="px-5 py-4">Custo</th>
                    <th className="px-5 py-4">Data</th>
                    <th className="px-5 py-4">Responsável</th>
                    <th className="px-5 py-4 text-right">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredLosses.map((loss) => (
                    <tr key={loss.id} className="transition hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-black text-slate-950">
                          {loss.product_name}
                        </p>

                        {loss.notes && (
                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            {loss.notes}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                          {loss.reason}
                        </span>

                        {loss.is_preventable && (
                          <p className="mt-1 text-xs font-semibold text-orange-600">
                            Evitável
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-bold text-slate-700">
                          {loss.loss_origin}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          Setor: {loss.sector}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm font-bold text-slate-700">
                        {Number(loss.quantity || 0)} {loss.loss_unit_type}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-black text-red-600">
                          {formatCurrency(Number(loss.total_cost || 0))}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          Unit: {formatCurrency(Number(loss.unit_cost || 0))}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-slate-500">
                        {formatDateTime(loss.occurred_at)}
                      </td>

                      <td className="px-5 py-4 text-sm font-bold text-slate-700">
                        {loss.responsible_name || "Não informado"}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleDeleteLoss(loss)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-red-50 hover:text-red-600"
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
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
                  Perdas
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  Registrar perda ou desperdício
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLoss} className="overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="text-sm font-black text-slate-700">
                    Produto do cardápio
                  </span>

                  <select
                    value={form.product_id}
                    onChange={(event) => {
                      const product = productById.get(event.target.value)

                      setForm((current) => ({
                        ...current,
                        product_id: event.target.value,
                        product_name: product ? getProductName(product) : current.product_name,
                        unit_cost:
                          current.unit_cost === "0" && product
                            ? String(getProductPrice(product))
                            : current.unit_cost,
                      }))
                    }}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="">Item manual</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {getProductName(product)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="text-sm font-black text-slate-700">
                    Item do estoque
                  </span>

                  <select
                    value={form.stock_item_id}
                    onChange={(event) => {
                      const stockItem = stockById.get(event.target.value)

                      setForm((current) => ({
                        ...current,
                        stock_item_id: event.target.value,
                        product_name: stockItem ? getStockName(stockItem) : current.product_name,
                        unit_cost:
                          current.unit_cost === "0" && stockItem
                            ? String(getStockCost(stockItem))
                            : current.unit_cost,
                        loss_unit_type: stockItem ? getStockUnit(stockItem) : current.loss_unit_type,
                        base_unit_type: stockItem ? getStockUnit(stockItem) : current.base_unit_type,
                      }))
                    }}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="">Sem vínculo com estoque</option>
                    {stockItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {getStockName(item)} · estoque {getStockQuantity(item)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="md:col-span-2">
                  <span className="text-sm font-black text-slate-700">
                    Nome do item perdido *
                  </span>

                  <input
                    value={form.product_name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        product_name: event.target.value,
                      }))
                    }
                    placeholder="Ex: Carne moída, marmita frango, alface..."
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>

                <label>
                  <span className="text-sm font-black text-slate-700">
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
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>

                <label>
                  <span className="text-sm font-black text-slate-700">
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
                    placeholder="unidade, kg, g, ml..."
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>

                <label>
                  <span className="text-sm font-black text-slate-700">
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
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>

                <label>
                  <span className="text-sm font-black text-slate-700">
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
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>

                <label>
                  <span className="text-sm font-black text-slate-700">
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
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="Vencimento">Vencimento</option>
                    <option value="Erro de produção">Erro de produção</option>
                    <option value="Quebra">Quebra</option>
                    <option value="Sobra">Sobra</option>
                    <option value="Pedido cancelado">Pedido cancelado</option>
                    <option value="Produto queimado">Produto queimado</option>
                    <option value="Armazenamento incorreto">Armazenamento incorreto</option>
                    <option value="Outro">Outro</option>
                  </select>
                </label>

                <label>
                  <span className="text-sm font-black text-slate-700">
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
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="estoque">Estoque</option>
                    <option value="producao">Produção</option>
                    <option value="cozinha">Cozinha</option>
                    <option value="atendimento">Atendimento</option>
                    <option value="delivery">Delivery</option>
                    <option value="desperdicio">Desperdício</option>
                  </select>
                </label>

                <label>
                  <span className="text-sm font-black text-slate-700">
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
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>

                <label>
                  <span className="text-sm font-black text-slate-700">
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
                    placeholder="Nome da pessoa/setor"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <input
                    type="checkbox"
                    checked={form.is_preventable}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        is_preventable: event.target.checked,
                      }))
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />

                  <div>
                    <p className="text-sm font-black text-slate-700">
                      Perda evitável
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Marque quando poderia ser reduzida com processo melhor.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                    className="mt-1 h-4 w-4 rounded border-slate-300 disabled:opacity-40"
                  />

                  <div>
                    <p className="text-sm font-black text-slate-700">
                      Baixar do estoque
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Só funciona quando um item do estoque está selecionado.
                    </p>
                  </div>
                </label>

                <label className="md:col-span-2">
                  <span className="text-sm font-black text-slate-700">
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
                    placeholder="Explique o que aconteceu..."
                    rows={4}
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>
              </div>

              <div className="mt-6 rounded-3xl border border-red-100 bg-red-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-red-800">
                      Perda estimada
                    </p>

                    <p className="mt-1 text-xs font-semibold text-red-700/80">
                      Quantidade x custo unitário.
                    </p>
                  </div>

                  <p className="text-2xl font-black text-red-700">
                    {formatCurrency(totalCost)}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Registrar perda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}