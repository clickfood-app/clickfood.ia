"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  X,
} from "lucide-react"

import AdminLayout from "@/components/admin-layout"
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

    const potentialSaleAmount = losses.reduce(
      (sum, loss) => sum + Number(loss.potential_sale_amount || 0),
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
      potentialSaleAmount,
      preventableLoss,
      stockLoss,
      productionLoss,
      count: losses.length,
    }
  }, [losses])

  const totalCost = parseNumber(form.quantity) * parseNumber(form.unit_cost)
  const potentialSaleAmount =
    parseNumber(form.quantity) * parseNumber(form.sale_unit_price)

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
      <div className="w-full space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
              Gestão interna
            </p>

            <h1 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
              Perdas e Consumos
            </h1>

            <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500">
              Controle desperdícios, consumo interno, doações, quebras, sobras e vendas que deixaram de acontecer.
            </p>
          </div>

          <button
            type="button"
            onClick={openModal}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Novo registro
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Registros
              </p>
              <Package className="h-4 w-4 text-blue-600" />
            </div>

            <p className="mt-2 text-2xl font-black text-slate-950">
              {totals.count}
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-400">
              lançamentos feitos
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Custo perdido
              </p>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>

            <p className="mt-2 text-2xl font-black text-red-600">
              {formatCurrency(totals.totalLoss)}
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-400">
              prejuízo real
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Venda perdida
              </p>
              <TrendingDown className="h-4 w-4 text-blue-600" />
            </div>

            <p className="mt-2 text-2xl font-black text-blue-600">
              {formatCurrency(totals.potentialSaleAmount)}
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-400">
              potencial não vendido
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Evitável
              </p>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </div>

            <p className="mt-2 text-2xl font-black text-slate-950">
              {formatCurrency(totals.preventableLoss)}
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-400">
              pode ser reduzido
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Operacional
              </p>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>

            <p className="mt-2 text-2xl font-black text-slate-950">
              {formatCurrency(totals.stockLoss + totals.productionLoss)}
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-400">
              estoque/produção
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-950">
                Histórico
              </h2>

              <p className="text-sm font-medium text-slate-500">
                Veja o que foi perdido, consumido, doado ou desperdiçado.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por item, motivo ou responsável..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {error && (
            <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando registros...
              </div>
            </div>
          ) : filteredLosses.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center p-6 text-center">
              <div className="rounded-xl bg-slate-100 p-3 text-slate-500">
                <TrendingDown className="h-6 w-6" />
              </div>

              <h3 className="mt-3 text-base font-black text-slate-950">
                Nenhum registro encontrado
              </h3>

              <p className="mt-1 max-w-md text-sm font-medium text-slate-500">
                Registre perdas, consumos internos, doações e quebras para enxergar onde o restaurante está perdendo margem.
              </p>

              <button
                type="button"
                onClick={openModal}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Criar primeiro registro
              </button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1050px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Motivo</th>
                      <th className="px-4 py-3">Origem</th>
                      <th className="px-4 py-3">Qtd.</th>
                      <th className="px-4 py-3">Impacto</th>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Responsável</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredLosses.map((loss) => (
                      <tr key={loss.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-black text-slate-950">
                            {loss.product_name}
                          </p>

                          {loss.notes && (
                            <p className="mt-1 max-w-xs truncate text-xs font-semibold text-slate-400">
                              {loss.notes}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
                            {loss.reason}
                          </span>

                          {loss.is_preventable && (
                            <p className="mt-1 text-xs font-bold text-orange-600">
                              Evitável
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <p className="text-sm font-bold text-slate-700">
                            {loss.loss_origin}
                          </p>

                          <p className="text-xs font-semibold text-slate-400">
                            {loss.sector}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-sm font-bold text-slate-700">
                          {Number(loss.quantity || 0)} {loss.loss_unit_type}
                        </td>

                        <td className="px-4 py-3">
                          <p className="text-sm font-black text-red-600">
                            {formatCurrency(Number(loss.total_cost || 0))}
                          </p>

                          <p className="text-xs font-bold text-blue-600">
                            Venda: {formatCurrency(Number(loss.potential_sale_amount || 0))}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-sm font-semibold text-slate-500">
                          {formatDateTime(loss.occurred_at)}
                        </td>

                        <td className="px-4 py-3 text-sm font-bold text-slate-700">
                          {loss.responsible_name || "Não informado"}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleDeleteLoss(loss)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
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

              <div className="divide-y divide-slate-100 lg:hidden">
                {filteredLosses.map((loss) => (
                  <div key={loss.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">
                          {loss.product_name}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {formatDateTime(loss.occurred_at)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteLoss(loss)}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
                        {loss.reason}
                      </span>

                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
                        {loss.loss_origin}
                      </span>

                      {loss.is_preventable && (
                        <span className="rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-700">
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

                      <div className="rounded-xl bg-blue-50 p-3">
                        <p className="text-xs font-bold text-blue-700">
                          Venda perdida
                        </p>

                        <p className="mt-1 text-base font-black text-blue-700">
                          {formatCurrency(Number(loss.potential_sale_amount || 0))}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 text-xs font-semibold text-slate-500">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-5">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    Novo registro
                  </h2>

                  <p className="text-sm font-medium text-slate-500">
                    Lance perda, consumo interno, doação, quebra ou sobra.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={handleCreateLoss}
                className="max-h-[calc(92vh-76px)] overflow-y-auto p-5"
              >
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
                          product_name: product
                            ? getProductName(product)
                            : current.product_name,
                          unit_cost:
                            current.unit_cost === "0" &&
                            product &&
                            getProductCost(product) > 0
                              ? String(getProductCost(product))
                              : current.unit_cost,
                          sale_unit_price: product
                            ? String(getProductPrice(product))
                            : current.sale_unit_price,
                        }))
                      }}
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500"
                    >
                      <option value="">Item manual</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {getProductName(product)} · {formatCurrency(getProductPrice(product))}
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
                          product_name: stockItem
                            ? getStockName(stockItem)
                            : current.product_name,
                          unit_cost:
                            current.unit_cost === "0" && stockItem
                              ? String(getStockCost(stockItem))
                              : current.unit_cost,
                          loss_unit_type: stockItem
                            ? getStockUnit(stockItem)
                            : current.loss_unit_type,
                          base_unit_type: stockItem
                            ? getStockUnit(stockItem)
                            : current.base_unit_type,
                        }))
                      }}
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500"
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
                      placeholder="Ex: Márcia: marmita G de picanha com fritas"
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500"
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
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500"
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
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500"
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
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500"
                    />
                  </label>

                  <label>
                    <span className="text-sm font-black text-slate-700">
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
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500"
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
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500"
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
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500"
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
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500"
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
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500"
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
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500"
                    />
                  </label>

                  <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
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
                        Marque quando poderia ser reduzida.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
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
                        Apenas se houver item de estoque.
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
                      placeholder="Explique rapidamente o que aconteceu..."
                      rows={3}
                      className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none transition focus:border-blue-500"
                    />
                  </label>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                    <p className="text-sm font-black text-red-700">
                      Custo perdido
                    </p>

                    <p className="mt-1 text-2xl font-black text-red-700">
                      {formatCurrency(totalCost)}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-red-700/70">
                      Quantidade x custo unitário.
                    </p>
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-sm font-black text-blue-700">
                      Venda possível perdida
                    </p>

                    <p className="mt-1 text-2xl font-black text-blue-700">
                      {formatCurrency(potentialSaleAmount)}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-blue-700/70">
                      Quantidade x preço de venda.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar registro
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}