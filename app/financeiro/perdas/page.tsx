"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  ClipboardList,
  Flame,
  Loader2,
  Package,
  PlusCircle,
  RefreshCcw,
  Trash2,
  TrendingDown,
  Wallet,
} from "lucide-react"

type PeriodKey = "today" | "7d" | "30d" | "month"

type UnitType =
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
  name: string
  category: string | null
  base_unit_type: UnitType
  cost_per_base_unit: number | string
  current_quantity: number | string
  minimum_quantity: number | string
}

type ProductLoss = {
  id: string
  stock_item_id: string | null
  product_name: string
  quantity: number | string
  loss_unit_type: UnitType
  base_unit_type: UnitType
  unit_cost: number | string
  total_cost: number | string
  reason: string
  sector: string
  loss_origin: string
  responsible_name: string | null
  is_preventable: boolean
  notes: string | null
  occurred_at: string
}

type LossForm = {
  stock_item_id: string
  product_name: string
  quantity: string
  loss_unit_type: UnitType
  manual_unit_cost: string
  reason: string
  sector: string
  loss_origin: string
  responsible_name: string
  is_preventable: boolean
  notes: string
  occurred_at: string
}

type SummaryItem = {
  label: string
  total: number
  quantity: number
}

const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month", label: "Mês atual" },
]

const unitOptions: { value: UnitType; label: string }[] = [
  { value: "unidade", label: "Unidade" },
  { value: "kg", label: "Kg" },
  { value: "g", label: "Gramas" },
  { value: "litro", label: "Litro" },
  { value: "ml", label: "ML" },
  { value: "pacote", label: "Pacote" },
  { value: "caixa", label: "Caixa" },
  { value: "porcao", label: "Porção" },
]

const reasonOptions = [
  "Vencimento",
  "Erro de preparo",
  "Produto estragado",
  "Quebra",
  "Refeito para cliente",
  "Uso interno",
  "Cortesia",
  "Outro",
]

const sectorOptions = ["Estoque", "Cozinha", "Atendimento", "Entrega", "Caixa"]

const originOptions = [
  "Estoque",
  "Preparo",
  "Pedido",
  "Entrega",
  "Armazenamento",
  "Cortesia",
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
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

function getUnitLabel(unit: UnitType) {
  return unitOptions.find((item) => item.value === unit)?.label || unit
}

function getLocalDateTimeValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

function getPeriodStart(period: PeriodKey) {
  const date = new Date()

  if (period === "today") {
    date.setHours(0, 0, 0, 0)
    return date.toISOString()
  }

  if (period === "7d") {
    date.setDate(date.getDate() - 6)
    date.setHours(0, 0, 0, 0)
    return date.toISOString()
  }

  if (period === "30d") {
    date.setDate(date.getDate() - 29)
    date.setHours(0, 0, 0, 0)
    return date.toISOString()
  }

  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

function getPeriodLabel(period: PeriodKey) {
  return periodOptions.find((option) => option.key === period)?.label || "Hoje"
}

function getCompatibleUnits(baseUnit: UnitType): UnitType[] {
  if (baseUnit === "kg") return ["kg", "g"]
  if (baseUnit === "g") return ["g", "kg"]
  if (baseUnit === "litro") return ["litro", "ml"]
  if (baseUnit === "ml") return ["ml", "litro"]

  return [baseUnit]
}

function convertToBaseQuantity(
  quantity: number,
  lossUnit: UnitType,
  baseUnit: UnitType
) {
  if (lossUnit === baseUnit) return quantity

  if (baseUnit === "kg" && lossUnit === "g") return quantity / 1000
  if (baseUnit === "g" && lossUnit === "kg") return quantity * 1000

  if (baseUnit === "litro" && lossUnit === "ml") return quantity / 1000
  if (baseUnit === "ml" && lossUnit === "litro") return quantity * 1000

  return quantity
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone = "red",
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  tone?: "red" | "amber" | "blue" | "slate" | "green"
}) {
  const toneClass = {
    red: "bg-red-50 text-red-700 ring-red-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
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

function ProgressBar({
  value,
  max,
  tone = "red",
}: {
  value: number
  max: number
  tone?: "red" | "amber" | "blue" | "slate"
}) {
  const width = max <= 0 ? 0 : Math.min(100, (value / max) * 100)

  const toneClass = {
    red: "bg-red-500",
    amber: "bg-amber-500",
    blue: "bg-blue-600",
    slate: "bg-slate-900",
  }[tone]

  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-700 ease-out",
          toneClass
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

function buildSummaryByKey(
  losses: ProductLoss[],
  getKey: (loss: ProductLoss) => string
) {
  const map = new Map<string, SummaryItem>()

  for (const loss of losses) {
    const label = getKey(loss) || "Não informado"
    const current =
      map.get(label) ??
      ({
        label,
        total: 0,
        quantity: 0,
      } satisfies SummaryItem)

    current.total += Number(loss.total_cost || 0)
    current.quantity += Number(loss.quantity || 0)

    map.set(label, current)
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function buildQuantityByUnit(losses: ProductLoss[]) {
  const map = new Map<UnitType, number>()

  for (const loss of losses) {
    const unit = loss.loss_unit_type || "unidade"
    map.set(unit, Number(map.get(unit) || 0) + Number(loss.quantity || 0))
  }

  return Array.from(map.entries())
    .map(([unit, quantity]) => ({
      unit,
      quantity,
    }))
    .sort((a, b) => b.quantity - a.quantity)
}

export default function PerdasPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const [period, setPeriod] = useState<PeriodKey>("today")
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [losses, setLosses] = useState<ProductLoss[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [form, setForm] = useState<LossForm>({
    stock_item_id: "",
    product_name: "",
    quantity: "1",
    loss_unit_type: "unidade",
    manual_unit_cost: "",
    reason: "Vencimento",
    sector: "Estoque",
    loss_origin: "Estoque",
    responsible_name: "",
    is_preventable: true,
    notes: "",
    occurred_at: getLocalDateTimeValue(),
  })

  const selectedStockItem = useMemo(() => {
    return stockItems.find((item) => item.id === form.stock_item_id) || null
  }, [form.stock_item_id, stockItems])

  const compatibleUnits = useMemo(() => {
    if (!selectedStockItem) return unitOptions.map((item) => item.value)
    return getCompatibleUnits(selectedStockItem.base_unit_type)
  }, [selectedStockItem])

  const baseQuantity = useMemo(() => {
    const quantity = parseNumber(form.quantity)

    if (!selectedStockItem) return quantity

    return convertToBaseQuantity(
      quantity,
      form.loss_unit_type,
      selectedStockItem.base_unit_type
    )
  }, [form.quantity, form.loss_unit_type, selectedStockItem])

  const unitCost = selectedStockItem
    ? Number(selectedStockItem.cost_per_base_unit || 0)
    : parseNumber(form.manual_unit_cost)

  const previewTotal = baseQuantity * unitCost

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

  const loadPerdas = useCallback(async () => {
    try {
      setIsLoading(true)

      const resolvedRestaurantId = await resolveRestaurant()
      const startDate = getPeriodStart(period)

      const { data: stockData, error: stockError } = await supabase
        .from("stock_items")
        .select(
          "id, name, category, base_unit_type, cost_per_base_unit, current_quantity, minimum_quantity"
        )
        .eq("restaurant_id", resolvedRestaurantId)
        .eq("is_active", true)
        .order("name", { ascending: true })

      if (stockError) throw stockError

      const { data: lossesData, error: lossesError } = await supabase
        .from("product_losses")
        .select(
          "id, stock_item_id, product_name, quantity, loss_unit_type, base_unit_type, unit_cost, total_cost, reason, sector, loss_origin, responsible_name, is_preventable, notes, occurred_at"
        )
        .eq("restaurant_id", resolvedRestaurantId)
        .gte("occurred_at", startDate)
        .order("occurred_at", { ascending: false })

      if (lossesError) throw lossesError

      setStockItems((stockData ?? []) as StockItem[])
      setLosses((lossesData ?? []) as ProductLoss[])
    } catch (error) {
      console.error("Erro ao carregar perdas:", error)

      toast({
        title: "Erro ao carregar perdas",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os dados de perdas.",
        variant: "destructive",
      })

      setStockItems([])
      setLosses([])
    } finally {
      setIsLoading(false)
    }
  }, [period, resolveRestaurant, supabase, toast])

  useEffect(() => {
    void loadPerdas()
  }, [loadPerdas])

  const totalLost = useMemo(
    () => losses.reduce((sum, loss) => sum + Number(loss.total_cost || 0), 0),
    [losses]
  )

  const quantityByUnit = useMemo(() => buildQuantityByUnit(losses), [losses])

  const quantityText = quantityByUnit.length
    ? quantityByUnit
        .slice(0, 2)
        .map((item) => `${formatNumber(item.quantity)} ${getUnitLabel(item.unit)}`)
        .join(" + ")
    : "-"

  const summaryByReason = useMemo(
    () => buildSummaryByKey(losses, (loss) => loss.reason),
    [losses]
  )

  const summaryByProduct = useMemo(
    () => buildSummaryByKey(losses, (loss) => loss.product_name),
    [losses]
  )

  const summaryBySector = useMemo(
    () => buildSummaryByKey(losses, (loss) => loss.sector),
    [losses]
  )

  const preventableTotal = useMemo(() => {
    return losses
      .filter((loss) => loss.is_preventable)
      .reduce((sum, loss) => sum + Number(loss.total_cost || 0), 0)
  }, [losses])

  const biggestReason = summaryByReason[0]
  const biggestProduct = summaryByProduct[0]
  const criticalSector = summaryBySector[0]

  const handleStockItemChange = (stockItemId: string) => {
    const item = stockItems.find((stockItem) => stockItem.id === stockItemId)

    if (!item) {
      setForm((current) => ({
        ...current,
        stock_item_id: "",
        product_name: "",
        loss_unit_type: "unidade",
        manual_unit_cost: "",
      }))
      return
    }

    const compatible = getCompatibleUnits(item.base_unit_type)

    setForm((current) => ({
      ...current,
      stock_item_id: item.id,
      product_name: item.name,
      loss_unit_type: compatible.includes(current.loss_unit_type)
        ? current.loss_unit_type
        : compatible[compatible.length - 1],
      manual_unit_cost: "",
    }))
  }

  const handleRegisterLoss = async () => {
    try {
      const resolvedRestaurantId = await resolveRestaurant()

      const quantity = parseNumber(form.quantity)
      const productName = form.product_name.trim()

      if (!productName) {
        toast({
          title: "Informe o item perdido",
          description: "Selecione um item do estoque ou digite o nome manualmente.",
          variant: "destructive",
        })
        return
      }

      if (!quantity || quantity <= 0) {
        toast({
          title: "Quantidade inválida",
          description: "Informe uma quantidade maior que zero.",
          variant: "destructive",
        })
        return
      }

      if (unitCost < 0 || Number.isNaN(unitCost)) {
        toast({
          title: "Custo inválido",
          description: "Informe um custo válido para calcular a perda.",
          variant: "destructive",
        })
        return
      }

      if (selectedStockItem && baseQuantity > Number(selectedStockItem.current_quantity || 0)) {
        toast({
          title: "Quantidade acima do estoque",
          description: `Você tem ${formatNumber(Number(selectedStockItem.current_quantity || 0))} ${getUnitLabel(selectedStockItem.base_unit_type).toLowerCase()} em estoque.`,
          variant: "destructive",
        })
        return
      }

      setIsSaving(true)

const baseUnitType = selectedStockItem?.base_unit_type || form.loss_unit_type
const costPerLossUnit = quantity > 0 ? previewTotal / quantity : 0

const { error } = await supabase.from("product_losses").insert({
  restaurant_id: resolvedRestaurantId,
  stock_item_id: selectedStockItem?.id || null,
  product_id: null,
  product_name: productName,
  quantity,
  loss_unit_type: form.loss_unit_type,
  base_unit_type: baseUnitType,
  unit_cost: costPerLossUnit,
  reason: form.reason,
  sector: form.sector,
  loss_origin: form.loss_origin,
  responsible_name: form.responsible_name.trim() || null,
  is_preventable: form.is_preventable,
  notes: form.notes.trim() || null,
  occurred_at: form.occurred_at
    ? new Date(form.occurred_at).toISOString()
    : new Date().toISOString(),
})

if (error) {
  throw new Error(
    [
      "Erro ao inserir em product_losses",
      `message: ${error.message}`,
      `details: ${error.details}`,
      `hint: ${error.hint}`,
      `code: ${error.code}`,
    ].join(" | ")
  )
}
      if (selectedStockItem) {
        const newQuantity = Math.max(
          0,
          Number(selectedStockItem.current_quantity || 0) - baseQuantity
        )

        const { error: stockError } = await supabase
          .from("stock_items")
          .update({ current_quantity: newQuantity })
          .eq("id", selectedStockItem.id)
          .eq("restaurant_id", resolvedRestaurantId)

if (stockError) {
  throw new Error(
    [
      "Erro ao atualizar stock_items",
      `message: ${stockError.message}`,
      `details: ${stockError.details}`,
      `hint: ${stockError.hint}`,
      `code: ${stockError.code}`,
    ].join(" | ")
  )
}  }

      toast({
        title: "Perda registrada",
        description: "A perda foi calculada e salva com sucesso.",
      })

      setForm({
        stock_item_id: "",
        product_name: "",
        quantity: "1",
        loss_unit_type: "unidade",
        manual_unit_cost: "",
        reason: "Vencimento",
        sector: "Estoque",
        loss_origin: "Estoque",
        responsible_name: "",
        is_preventable: true,
        notes: "",
        occurred_at: getLocalDateTimeValue(),
      })

      await loadPerdas()
   } catch (error) {
  const message =
    error instanceof Error
      ? error.message
      : JSON.stringify(error, null, 2)

  console.error("Erro ao registrar perda:", message)

  toast({
    title: "Erro ao registrar perda",
    description: message || "Não foi possível salvar a perda.",
    variant: "destructive",
  })
} finally {
      setIsSaving(false)
    }
  }

  const handleDeleteLoss = async (lossId: string) => {
    try {
      const resolvedRestaurantId = await resolveRestaurant()
      const loss = losses.find((item) => item.id === lossId)

      setDeletingId(lossId)

      if (loss?.stock_item_id) {
        const stockItem = stockItems.find((item) => item.id === loss.stock_item_id)

        if (stockItem) {
          const restoredQuantity = convertToBaseQuantity(
            Number(loss.quantity || 0),
            loss.loss_unit_type,
            loss.base_unit_type
          )

          const newQuantity =
            Number(stockItem.current_quantity || 0) + restoredQuantity

          const { error: stockError } = await supabase
            .from("stock_items")
            .update({ current_quantity: newQuantity })
            .eq("id", stockItem.id)
            .eq("restaurant_id", resolvedRestaurantId)

          if (stockError) throw stockError
        }
      }

      const { error } = await supabase
        .from("product_losses")
        .delete()
        .eq("id", lossId)
        .eq("restaurant_id", resolvedRestaurantId)

      if (error) throw error

      toast({
        title: "Perda removida",
        description: "O registro foi removido e o estoque foi ajustado.",
      })

      await loadPerdas()
    } catch (error) {
      console.error("Erro ao remover perda:", error)

      toast({
        title: "Erro ao remover perda",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível remover essa perda.",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AdminLayout title="Perdas">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Perdas
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Descubra onde o dinheiro está vazando na operação.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {periodOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setPeriod(option.key)}
                className={cn(
                  "h-10 rounded-xl px-4 text-sm font-bold transition",
                  period === option.key
                    ? "bg-slate-950 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                {option.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => void loadPerdas()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando perdas...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Total perdido"
                value={formatCurrency(totalLost)}
                subtitle={`Perdas em ${getPeriodLabel(period).toLowerCase()}`}
                tone="red"
                icon={<Wallet className="h-5 w-5" />}
              />

              <MetricCard
                title="Quantidade perdida"
                value={quantityText}
                subtitle="Separado por tipo de medida"
                tone="amber"
                icon={<Package className="h-5 w-5" />}
              />

              <MetricCard
                title="Maior vazamento"
                value={biggestProduct?.label || "-"}
                subtitle={
                  biggestProduct
                    ? `${formatCurrency(biggestProduct.total)} de prejuízo`
                    : "Sem perdas no período"
                }
                tone="blue"
                icon={<Flame className="h-5 w-5" />}
              />

              <MetricCard
                title="Setor crítico"
                value={criticalSector?.label || "-"}
                subtitle={
                  criticalSector
                    ? `${formatCurrency(criticalSector.total)} perdido`
                    : "Nenhum setor registrado"
                }
                tone="slate"
                icon={<AlertTriangle className="h-5 w-5" />}
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <Panel
                title="Registrar nova perda"
                subtitle="Selecione um item do estoque para calcular automático"
                icon={<PlusCircle className="h-5 w-5" />}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Item do estoque
                    </label>

                    <select
                      value={form.stock_item_id}
                      onChange={(event) => handleStockItemChange(event.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400"
                    >
                      <option value="">Selecionar item ou lançar manualmente</option>

                      {stockItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} • {formatCurrency(Number(item.cost_per_base_unit || 0))}/
                          {getUnitLabel(item.base_unit_type).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Nome da perda
                    </label>

                    <input
                      value={form.product_name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          product_name: event.target.value,
                        }))
                      }
                      placeholder="Ex: arroz, carne, queijo..."
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Motivo
                    </label>

                    <select
                      value={form.reason}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          reason: event.target.value,
                        }))
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400"
                    >
                      {reasonOptions.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Quantidade perdida
                    </label>

                    <input
                      value={form.quantity}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          quantity: event.target.value,
                        }))
                      }
                      type="number"
                      min="0"
                      step="0.001"
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Medida da perda
                    </label>

                    <select
                      value={form.loss_unit_type}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          loss_unit_type: event.target.value as UnitType,
                        }))
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400"
                    >
                      {unitOptions
                        .filter((unit) => compatibleUnits.includes(unit.value))
                        .map((unit) => (
                          <option key={unit.value} value={unit.value}>
                            {unit.label}
                          </option>
                        ))}
                    </select>
                  </div>

                  {!selectedStockItem && (
                    <div>
                      <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Custo manual por medida
                      </label>

                      <input
                        value={form.manual_unit_cost}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            manual_unit_cost: event.target.value,
                          }))
                        }
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Setor
                    </label>

                    <select
                      value={form.sector}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          sector: event.target.value,
                        }))
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400"
                    >
                      {sectorOptions.map((sector) => (
                        <option key={sector} value={sector}>
                          {sector}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Origem da perda
                    </label>

                    <select
                      value={form.loss_origin}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          loss_origin: event.target.value,
                        }))
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400"
                    >
                      {originOptions.map((origin) => (
                        <option key={origin} value={origin}>
                          {origin}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Responsável
                    </label>

                    <input
                      value={form.responsible_name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          responsible_name: event.target.value,
                        }))
                      }
                      placeholder="Opcional"
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Data
                    </label>

                    <input
                      value={form.occurred_at}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          occurred_at: event.target.value,
                        }))
                      }
                      type="datetime-local"
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.is_preventable}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            is_preventable: event.target.checked,
                          }))
                        }
                        className="h-4 w-4"
                      />
                      Essa perda era evitável
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Observação
                    </label>

                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Ex: arroz queimou, carne passou do ponto, embalagem rasgou..."
                      rows={3}
                      className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Quantidade base
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-950">
                        {formatNumber(baseQuantity)}{" "}
                        {selectedStockItem
                          ? getUnitLabel(selectedStockItem.base_unit_type)
                          : getUnitLabel(form.loss_unit_type)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Custo usado
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-950">
                        {formatCurrency(unitCost)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Total perdido
                      </p>
                      <p className="mt-1 text-lg font-black text-red-600">
                        {formatCurrency(previewTotal)}
                      </p>
                    </div>
                  </div>

                  {selectedStockItem && (
                    <p className="mt-3 text-xs font-semibold text-slate-500">
                      Estoque atual:{" "}
                      {formatNumber(Number(selectedStockItem.current_quantity || 0))}{" "}
                      {getUnitLabel(selectedStockItem.base_unit_type).toLowerCase()}.
                      Após registrar:{" "}
                      {formatNumber(
                        Math.max(
                          0,
                          Number(selectedStockItem.current_quantity || 0) - baseQuantity
                        )
                      )}{" "}
                      {getUnitLabel(selectedStockItem.base_unit_type).toLowerCase()}.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleRegisterLoss()}
                    disabled={isSaving}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlusCircle className="h-4 w-4" />
                    )}
                    Registrar perda
                  </button>
                </div>
              </Panel>

              <Panel
                title="Onde está vazando"
                subtitle="Resumo por motivo e setor"
                icon={<TrendingDown className="h-5 w-5" />}
              >
                <div className="space-y-5">
                  <div>
                    <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Por motivo
                    </p>

                    <div className="space-y-4">
                      {summaryByReason.length === 0 ? (
                        <EmptyState message="Nenhuma perda registrada nesse período." />
                      ) : (
                        summaryByReason.slice(0, 5).map((item) => (
                          <div key={item.label}>
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-sm font-black text-slate-800">
                                {item.label}
                              </p>

                              <p className="text-sm font-black text-red-600">
                                {formatCurrency(item.total)}
                              </p>
                            </div>

                            <ProgressBar value={item.total} max={totalLost} />
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-5">
                    <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Por setor
                    </p>

                    <div className="space-y-4">
                      {summaryBySector.length === 0 ? (
                        <EmptyState message="Nenhum setor registrado nesse período." />
                      ) : (
                        summaryBySector.slice(0, 5).map((item) => (
                          <div key={item.label}>
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-sm font-black text-slate-800">
                                {item.label}
                              </p>

                              <p className="text-sm font-black text-red-600">
                                {formatCurrency(item.total)}
                              </p>
                            </div>

                            <ProgressBar value={item.total} max={totalLost} tone="amber" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-red-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-red-700">
                      Perdas evitáveis
                    </p>
                    <p className="mt-2 text-2xl font-black text-red-700">
                      {formatCurrency(preventableTotal)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-red-700">
                      Valor que provavelmente poderia ser reduzido com processo,
                      treinamento ou controle.
                    </p>
                  </div>
                </div>
              </Panel>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
              <Panel
                title="Histórico de perdas"
                subtitle="Registros mais recentes primeiro"
                icon={<ClipboardList className="h-5 w-5" />}
              >
                <div className="space-y-3">
                  {losses.length === 0 ? (
                    <EmptyState message="Nenhuma perda encontrada nesse período." />
                  ) : (
                    losses.map((loss) => (
                      <div
                        key={loss.id}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black text-slate-950">
                              {loss.product_name}
                            </p>

                            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700 ring-1 ring-red-100">
                              {loss.reason}
                            </span>

                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                              {loss.sector}
                            </span>
                          </div>

                          <p className="mt-1 text-sm font-medium text-slate-500">
                            {formatNumber(Number(loss.quantity || 0))}{" "}
                            {getUnitLabel(loss.loss_unit_type).toLowerCase()} •{" "}
                            {formatCurrency(Number(loss.unit_cost || 0))}/
                            {getUnitLabel(loss.loss_unit_type).toLowerCase()} •{" "}
                            {formatDateTime(loss.occurred_at)}
                          </p>

                          {loss.notes && (
                            <p className="mt-1 text-sm text-slate-500">
                              {loss.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <p className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-red-600">
                            {formatCurrency(Number(loss.total_cost || 0))}
                          </p>

                          <button
                            type="button"
                            onClick={() => void handleDeleteLoss(loss.id)}
                            disabled={deletingId === loss.id}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Remover perda"
                          >
                            {deletingId === loss.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Panel>

              <Panel
                title="Produtos com mais prejuízo"
                subtitle="Ranking por valor perdido"
                icon={<Flame className="h-5 w-5" />}
              >
                <div className="space-y-3">
                  {summaryByProduct.length === 0 ? (
                    <EmptyState message="Nenhum produto no ranking ainda." />
                  ) : (
                    summaryByProduct.slice(0, 8).map((item, index) => (
                      <div
                        key={item.label}
                        className="rounded-xl bg-slate-50 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black",
                                index === 0
                                  ? "bg-red-100 text-red-700"
                                  : "bg-white text-slate-700"
                              )}
                            >
                              {index + 1}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-slate-800">
                                {item.label}
                              </p>
                              <p className="text-xs font-medium text-slate-500">
                                {formatNumber(item.quantity)} medida(s) registrada(s)
                              </p>
                            </div>
                          </div>

                          <p className="shrink-0 text-sm font-black text-red-600">
                            {formatCurrency(item.total)}
                          </p>
                        </div>

                        <div className="mt-3">
                          <ProgressBar value={item.total} max={totalLost} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  )
}