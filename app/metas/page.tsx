"use client"

import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  AlertTriangle,
  CircleDollarSign,
  Gauge,
  Loader2,
  PackageX,
  Percent,
  Plus,
  ReceiptText,
  ShoppingCart,
  Target,
  Trash2,
  Trophy,
  Wallet,
  X,
} from "lucide-react"
import { toast } from "sonner"

import AdminLayout from "@/components/admin-layout"
import { useAuth } from "@/components/auth/auth-provider"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

type MetricKey =
  | "revenue"
  | "expenses"
  | "waste"
  | "breakage"
  | "average_ticket"
  | "orders"
  | "cmv"

type GoalKind = "growth" | "control"

type GoalRow = {
  id: string
  restaurant_id: string
  name: string
  metric_key: MetricKey
  category: string
  goal_kind: GoalKind
  target_value: number
  period_start: string
  period_end: string
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type RestaurantContext = {
  id?: string | null
}

type GoalForm = {
  name: string
  metric_key: MetricKey
  category: string
  goal_kind: GoalKind
  target_value: string
  period_start: string
  period_end: string
  notes: string
}

type ActualsMap = Record<MetricKey, number>

type MetricConfig = {
  label: string
  description: string
  category: string
  kind: GoalKind
  defaultTarget: string
  format: "currency" | "number" | "percent"
  icon: React.ReactNode
}

const metricConfigs: Record<MetricKey, MetricConfig> = {
  revenue: {
    label: "Faturamento",
    description: "Meta de vendas pagas no período.",
    category: "Financeiro",
    kind: "growth",
    defaultTarget: "120000",
    format: "currency",
    icon: <CircleDollarSign className="h-4 w-4" />,
  },
  expenses: {
    label: "Despesas",
    description: "Limite de gastos do período.",
    category: "Financeiro",
    kind: "control",
    defaultTarget: "35000",
    format: "currency",
    icon: <ReceiptText className="h-4 w-4" />,
  },
  waste: {
    label: "Desperdícios",
    description: "Limite de perdas e desperdícios.",
    category: "Controle",
    kind: "control",
    defaultTarget: "2000",
    format: "currency",
    icon: <PackageX className="h-4 w-4" />,
  },
  breakage: {
    label: "Quebras",
    description: "Limite de quebras, avarias e perdas por erro.",
    category: "Controle",
    kind: "control",
    defaultTarget: "800",
    format: "currency",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  average_ticket: {
    label: "Ticket médio",
    description: "Meta de valor médio por pedido.",
    category: "Vendas",
    kind: "growth",
    defaultTarget: "45",
    format: "currency",
    icon: <Wallet className="h-4 w-4" />,
  },
  orders: {
    label: "Pedidos",
    description: "Meta de quantidade de pedidos pagos.",
    category: "Vendas",
    kind: "growth",
    defaultTarget: "1200",
    format: "number",
    icon: <ShoppingCart className="h-4 w-4" />,
  },
  cmv: {
    label: "CMV",
    description: "Limite percentual de custo da mercadoria vendida.",
    category: "Margem",
    kind: "control",
    defaultTarget: "32",
    format: "percent",
    icon: <Percent className="h-4 w-4" />,
  },
}

const metricOrder: MetricKey[] = [
  "revenue",
  "expenses",
  "waste",
  "breakage",
  "average_ticket",
  "orders",
  "cmv",
]

function createEmptyActuals(): ActualsMap {
  return {
    revenue: 0,
    expenses: 0,
    waste: 0,
    breakage: 0,
    average_ticket: 0,
    orders: 0,
    cmv: 0,
  }
}

function getCurrentMonthValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")

  return `${year}-${month}`
}

function getMonthRange(monthValue: string) {
  const [yearText, monthText] = monthValue.split("-")
  const year = Number(yearText)
  const month = Number(monthText)

  const start = `${year}-${String(month).padStart(2, "0")}-01`
  const endDate = new Date(year, month, 0)
  const end = `${year}-${String(month).padStart(2, "0")}-${String(
    endDate.getDate(),
  ).padStart(2, "0")}`

  return {
    start,
    end,
  }
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0

  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".")
    const parsed = Number(normalized)

    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function getFirstNumber(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = toNumber(row[key])

    if (value > 0) return value
  }

  return 0
}

function getFirstText(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]

    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return ""
}

function getFirstDate(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]

    if (typeof value === "string" && value.trim()) {
      const date = new Date(value)

      if (!Number.isNaN(date.getTime())) {
        return date
      }
    }
  }

  return null
}

function isInsidePeriod(
  row: Record<string, unknown>,
  keys: string[],
  start: string,
  end: string,
) {
  const rowDate = getFirstDate(row, keys)

  if (!rowDate) return false

  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T23:59:59`)

  return rowDate >= startDate && rowDate <= endDate
}

function isGoalInsidePeriod(goal: GoalRow, start: string, end: string) {
  return goal.period_start <= end && goal.period_end >= start
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  })
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  })
}

function formatMetricValue(metricKey: MetricKey, value: number) {
  const config = metricConfigs[metricKey]

  if (config.format === "currency") {
    return formatCurrency(value)
  }

  if (config.format === "percent") {
    return `${value.toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })}%`
  }

  return formatNumber(value)
}

function getElapsedDays(periodStart: string) {
  const startDate = new Date(`${periodStart}T00:00:00`)
  const today = new Date()
  const diff = today.getTime() - startDate.getTime()
  const elapsed = Math.floor(diff / 86_400_000) + 1

  return Math.max(1, elapsed)
}

function getGoalView(goal: GoalRow, actualValue: number) {
  const targetValue = Number(goal.target_value) || 0
  const rawPercent = targetValue > 0 ? (actualValue / targetValue) * 100 : 0
  const progressWidth = Math.max(0, Math.min(rawPercent, 100))
  const elapsedDays = getElapsedDays(goal.period_start)
  const isNeutralPeriod = elapsedDays <= 20

  if (isNeutralPeriod) {
    return {
      rawPercent,
      progressWidth,
      label: "Acompanhando",
      helper: "Primeiros 20 dias em modo neutro.",
      barClass: "from-violet-600 via-blue-600 to-cyan-400",
      badgeClass: "border-blue-100 bg-blue-50 text-blue-700",
      textClass: "text-blue-700",
      borderClass: "border-blue-100",
    }
  }

  if (goal.goal_kind === "growth") {
    if (rawPercent >= 100) {
      return {
        rawPercent,
        progressWidth,
        label: "Meta batida",
        helper: "Excelente. Essa meta já foi alcançada.",
        barClass: "from-emerald-500 via-green-500 to-lime-400",
        badgeClass: "border-emerald-100 bg-emerald-50 text-emerald-700",
        textClass: "text-emerald-700",
        borderClass: "border-emerald-100",
      }
    }

    if (rawPercent >= 80) {
      return {
        rawPercent,
        progressWidth,
        label: "No caminho",
        helper: "Boa evolução. Falta pouco para bater.",
        barClass: "from-emerald-500 via-blue-500 to-cyan-400",
        badgeClass: "border-emerald-100 bg-emerald-50 text-emerald-700",
        textClass: "text-emerald-700",
        borderClass: "border-emerald-100",
      }
    }

    if (rawPercent >= 60) {
      return {
        rawPercent,
        progressWidth,
        label: "Atenção",
        helper: "Precisa acelerar para bater essa meta.",
        barClass: "from-amber-400 via-orange-400 to-yellow-300",
        badgeClass: "border-amber-100 bg-amber-50 text-amber-700",
        textClass: "text-amber-700",
        borderClass: "border-amber-100",
      }
    }

    return {
      rawPercent,
      progressWidth,
      label: "Abaixo",
      helper: "Meta abaixo do ritmo ideal para o período.",
      barClass: "from-red-600 via-rose-500 to-orange-400",
      badgeClass: "border-red-100 bg-red-50 text-red-700",
      textClass: "text-red-700",
      borderClass: "border-red-100",
    }
  }

  if (rawPercent > 100) {
    return {
      rawPercent,
      progressWidth: 100,
      label: "Estourou",
      helper: "O limite dessa meta já foi ultrapassado.",
      barClass: "from-red-600 via-rose-500 to-orange-400",
      badgeClass: "border-red-100 bg-red-50 text-red-700",
      textClass: "text-red-700",
      borderClass: "border-red-100",
    }
  }

  if (rawPercent >= 85) {
    return {
      rawPercent,
      progressWidth,
      label: "Atenção",
      helper: "Está perto de bater o limite definido.",
      barClass: "from-amber-400 via-orange-400 to-yellow-300",
      badgeClass: "border-amber-100 bg-amber-50 text-amber-700",
      textClass: "text-amber-700",
      borderClass: "border-amber-100",
    }
  }

  return {
    rawPercent,
    progressWidth,
    label: "Controlado",
    helper: "Dentro do limite planejado.",
    barClass: "from-emerald-500 via-green-500 to-lime-400",
    badgeClass: "border-emerald-100 bg-emerald-50 text-emerald-700",
    textClass: "text-emerald-700",
    borderClass: "border-emerald-100",
  }
}

function getGoalBalanceText(goal: GoalRow, actualValue: number) {
  const targetValue = Number(goal.target_value) || 0
  const diff = targetValue - actualValue

  if (goal.goal_kind === "growth") {
    if (diff <= 0) {
      return `Passou ${formatMetricValue(goal.metric_key, Math.abs(diff))} da meta.`
    }

    return `Faltam ${formatMetricValue(goal.metric_key, diff)} para bater.`
  }

  if (diff < 0) {
    return `Estourou ${formatMetricValue(goal.metric_key, Math.abs(diff))} do limite.`
  }

  return `Ainda restam ${formatMetricValue(goal.metric_key, diff)} de margem.`
}

export default function MetasPage() {
  const supabase = useMemo(() => createClient(), [])
  const { user, restaurant } = useAuth()
  const restaurantFromAuth = restaurant as RestaurantContext | null

  const [restaurantId, setRestaurantId] = useState<string | null>(
    restaurantFromAuth?.id ?? null,
  )
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue())
  const [goals, setGoals] = useState<GoalRow[]>([])
  const [actuals, setActuals] = useState<ActualsMap>(createEmptyActuals())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const period = useMemo(() => getMonthRange(selectedMonth), [selectedMonth])

  const [form, setForm] = useState<GoalForm>(() => {
    const initialPeriod = getMonthRange(getCurrentMonthValue())
    const config = metricConfigs.revenue

    return {
      name: config.label,
      metric_key: "revenue",
      category: config.category,
      goal_kind: config.kind,
      target_value: config.defaultTarget,
      period_start: initialPeriod.start,
      period_end: initialPeriod.end,
      notes: "",
    }
  })

  useEffect(() => {
    setForm((current) => ({
      ...current,
      period_start: period.start,
      period_end: period.end,
    }))
  }, [period.end, period.start])

  useEffect(() => {
    if (restaurantFromAuth?.id) {
      setRestaurantId(restaurantFromAuth.id)
      return
    }

    const userId = user?.id

    if (!userId) {
      setRestaurantId(null)
      return
    }

    let cancelled = false

    async function loadRestaurantId() {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", userId)
        .limit(1)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error("Erro ao buscar restaurante:", error.message)
        setRestaurantId(null)
        return
      }

      setRestaurantId(data?.id ?? null)
    }

    void loadRestaurantId()

    return () => {
      cancelled = true
    }
  }, [restaurantFromAuth?.id, supabase, user?.id])

  const fetchRows = useCallback(
    async (tableName: string) => {
      if (!restaurantId) return []

      const client = supabase as any

      const { data, error } = await client
        .from(tableName)
        .select("*")
        .eq("restaurant_id", restaurantId)

      if (error) {
        console.warn(`Não foi possível buscar ${tableName}:`, error.message)
        return []
      }

      return (data ?? []) as Record<string, unknown>[]
    },
    [restaurantId, supabase],
  )

  const loadData = useCallback(async () => {
    if (!restaurantId) {
      setGoals([])
      setActuals(createEmptyActuals())
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)

      const client = supabase as any

      const goalsResponse = await client
        .from("restaurant_goals")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })

      if (goalsResponse.error) {
        console.error("Erro ao buscar metas:", goalsResponse.error.message)
        toast.error("Não foi possível carregar as metas", {
          description: "Confere se o SQL da tabela restaurant_goals já foi rodado.",
        })
      }

      const [ordersRows, payableRows, lossRows, deliveryRows] =
        await Promise.all([
          fetchRows("orders"),
          fetchRows("accounts_payable"),
          fetchRows("product_losses"),
          fetchRows("delivery_settlements"),
        ])

      const nextActuals = createEmptyActuals()

      const paidOrders = ordersRows.filter((order) => {
        if (
          !isInsidePeriod(
            order,
            ["created_at", "paid_at", "updated_at"],
            period.start,
            period.end,
          )
        ) {
          return false
        }

        const status = getFirstText(order, ["status"]).toLowerCase()
        const paymentStatus = getFirstText(order, [
          "payment_status",
        ]).toLowerCase()

        const isCanceled =
          status.includes("cancel") ||
          status.includes("cancelado") ||
          paymentStatus.includes("cancel")

        const isPaid =
          paymentStatus === "paid" ||
          paymentStatus === "pago" ||
          paymentStatus === "confirmed" ||
          paymentStatus === "confirmado" ||
          paymentStatus.includes("paid")

        const isFinished =
          status.includes("entregue") ||
          status.includes("finalizado") ||
          status.includes("completed") ||
          status.includes("concluido")

        return !isCanceled && (isPaid || isFinished)
      })

      const revenue = paidOrders.reduce((total, order) => {
        return (
          total +
          getFirstNumber(order, [
            "total",
            "total_amount",
            "grand_total",
            "amount",
            "subtotal",
          ])
        )
      }, 0)

      nextActuals.revenue = revenue
      nextActuals.orders = paidOrders.length
      nextActuals.average_ticket =
        paidOrders.length > 0 ? revenue / paidOrders.length : 0

      const orderCost = paidOrders.reduce((total, order) => {
        return (
          total +
          getFirstNumber(order, [
            "cmv_total",
            "cost_total",
            "products_cost",
            "products_cost_total",
            "total_cost",
          ])
        )
      }, 0)

      nextActuals.cmv = revenue > 0 && orderCost > 0 ? (orderCost / revenue) * 100 : 0

      const periodPayables = payableRows.filter((row) =>
        isInsidePeriod(
          row,
          ["paid_at", "due_date", "created_at", "updated_at"],
          period.start,
          period.end,
        ),
      )

      const payableTotal = periodPayables.reduce((total, row) => {
        return (
          total +
          getFirstNumber(row, [
            "amount",
            "total",
            "total_amount",
            "value",
            "price",
          ])
        )
      }, 0)

      const periodDeliverySettlements = deliveryRows.filter((row) =>
        isInsidePeriod(
          row,
          ["paid_at", "settlement_date", "created_at", "updated_at"],
          period.start,
          period.end,
        ),
      )

      const deliveryTotal = periodDeliverySettlements.reduce((total, row) => {
        return (
          total +
          getFirstNumber(row, [
            "amount",
            "total",
            "total_amount",
            "total_fee",
            "delivery_fee",
            "value",
          ])
        )
      }, 0)

      nextActuals.expenses = payableTotal + deliveryTotal

      const periodLosses = lossRows.filter((row) =>
        isInsidePeriod(
          row,
          ["loss_date", "date", "created_at", "updated_at"],
          period.start,
          period.end,
        ),
      )

      const totalLosses = periodLosses.reduce((total, row) => {
        const directValue = getFirstNumber(row, [
          "cost_lost",
          "total_cost",
          "loss_cost",
          "total_loss_cost",
          "estimated_cost",
          "value",
          "amount",
        ])

        if (directValue > 0) {
          return total + directValue
        }

        const unitCost = getFirstNumber(row, [
          "unit_cost",
          "cost_price",
          "average_cost",
        ])
        const quantity = getFirstNumber(row, ["quantity", "qty", "amount_lost"])

        return total + unitCost * quantity
      }, 0)

      nextActuals.waste = totalLosses

      const breakageRows = periodLosses.filter((row) => {
        const text = [
          getFirstText(row, ["reason"]),
          getFirstText(row, ["origin"]),
          getFirstText(row, ["source"]),
          getFirstText(row, ["loss_type"]),
          getFirstText(row, ["category"]),
        ]
          .join(" ")
          .toLowerCase()

        return (
          text.includes("quebra") ||
          text.includes("quebrado") ||
          text.includes("avaria") ||
          text.includes("erro") ||
          text.includes("danificado")
        )
      })

      nextActuals.breakage = breakageRows.reduce((total, row) => {
        const directValue = getFirstNumber(row, [
          "cost_lost",
          "total_cost",
          "loss_cost",
          "total_loss_cost",
          "estimated_cost",
          "value",
          "amount",
        ])

        if (directValue > 0) {
          return total + directValue
        }

        const unitCost = getFirstNumber(row, [
          "unit_cost",
          "cost_price",
          "average_cost",
        ])
        const quantity = getFirstNumber(row, ["quantity", "qty", "amount_lost"])

        return total + unitCost * quantity
      }, 0)

      setGoals((goalsResponse.data ?? []) as GoalRow[])
      setActuals(nextActuals)
    } catch (error) {
      console.error("Erro ao carregar metas:", error)
      toast.error("Erro ao carregar metas")
    } finally {
      setIsLoading(false)
    }
  }, [fetchRows, period.end, period.start, restaurantId, supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const visibleGoals = useMemo(() => {
    return goals
      .filter((goal) => isGoalInsidePeriod(goal, period.start, period.end))
      .sort((a, b) => {
        return metricOrder.indexOf(a.metric_key) - metricOrder.indexOf(b.metric_key)
      })
  }, [goals, period.end, period.start])

  const summary = useMemo(() => {
    const result = {
      total: visibleGoals.length,
      neutral: 0,
      good: 0,
      attention: 0,
      bad: 0,
    }

    for (const goal of visibleGoals) {
      const view = getGoalView(goal, actuals[goal.metric_key])

      if (view.label === "Acompanhando") {
        result.neutral += 1
      } else if (
        view.label === "Meta batida" ||
        view.label === "No caminho" ||
        view.label === "Controlado"
      ) {
        result.good += 1
      } else if (view.label === "Atenção") {
        result.attention += 1
      } else {
        result.bad += 1
      }
    }

    return result
  }, [actuals, visibleGoals])

  function resetForm() {
    const config = metricConfigs.revenue

    setForm({
      name: config.label,
      metric_key: "revenue",
      category: config.category,
      goal_kind: config.kind,
      target_value: config.defaultTarget,
      period_start: period.start,
      period_end: period.end,
      notes: "",
    })
  }

  function handleCancelForm() {
    resetForm()
    setShowForm(false)
  }

  function handleMetricChange(metricKey: MetricKey) {
    const config = metricConfigs[metricKey]

    setForm((current) => ({
      ...current,
      metric_key: metricKey,
      name: config.label,
      category: config.category,
      goal_kind: config.kind,
      target_value: config.defaultTarget,
    }))
  }

  async function handleCreateGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!restaurantId) {
      toast.error("Restaurante não encontrado")
      return
    }

    const targetValue = toNumber(form.target_value)

    if (!form.name.trim()) {
      toast.error("Informe o nome da meta")
      return
    }

    if (targetValue <= 0) {
      toast.error("Informe um valor de meta maior que zero")
      return
    }

    try {
      setIsSaving(true)

      const client = supabase as any

      const { error } = await client.from("restaurant_goals").insert({
        restaurant_id: restaurantId,
        name: form.name.trim(),
        metric_key: form.metric_key,
        category: form.category,
        goal_kind: form.goal_kind,
        target_value: targetValue,
        period_start: form.period_start,
        period_end: form.period_end,
        notes: form.notes.trim() || null,
      })

      if (error) {
        throw error
      }

      toast.success("Meta criada com sucesso")
      resetForm()
      setShowForm(false)

      await loadData()
    } catch (error) {
      console.error("Erro ao criar meta:", error)
      toast.error("Não foi possível criar a meta")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteGoal(goalId: string) {
    const confirmed = window.confirm("Deseja remover essa meta?")

    if (!confirmed) return

    try {
      const client = supabase as any

      const { error } = await client
        .from("restaurant_goals")
        .update({
          is_active: false,
        })
        .eq("id", goalId)

      if (error) {
        throw error
      }

      toast.success("Meta removida")
      await loadData()
    } catch (error) {
      console.error("Erro ao remover meta:", error)
      toast.error("Não foi possível remover a meta")
    }
  }

  return (
    <AdminLayout title="Metas">
      <div className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Target className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-lg font-black text-slate-950 md:text-xl">
                  Metas do restaurante
                </h1>

                <p className="line-clamp-2 text-xs font-medium text-slate-500 md:text-sm">
                  Acompanhe faturamento, despesas, desperdícios, quebras, pedidos,
                  ticket médio e CMV.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-row">
              <input
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />

              <button
                type="button"
                onClick={() => setShowForm((current) => !current)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Nova meta
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                  Metas ativas
                </p>
                <p className="mt-1 text-xl font-black text-slate-950">
                  {summary.total}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Gauge className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-blue-100 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-blue-500">
                  Neutras
                </p>
                <p className="mt-1 text-xl font-black text-blue-700">
                  {summary.neutral}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Target className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-emerald-500">
                  Boas
                </p>
                <p className="mt-1 text-xl font-black text-emerald-700">
                  {summary.good}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Trophy className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-red-100 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-red-500">
                  Atenção / ruins
                </p>
                <p className="mt-1 text-xl font-black text-red-700">
                  {summary.attention + summary.bad}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
          </div>
        </section>

        {showForm && (
          <section className="rounded-3xl border border-blue-100 bg-white p-3 shadow-sm md:p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-950">
                  Criar nova meta
                </h2>

                <p className="text-xs font-medium text-slate-500 md:text-sm">
                  Escolha o tipo de meta, informe o valor alvo e a ClickFood acompanha
                  o realizado automaticamente.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCancelForm}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                aria-label="Cancelar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="grid gap-3 lg:grid-cols-12">
              <label className="space-y-1.5 lg:col-span-3">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Tipo
                </span>

                <select
                  value={form.metric_key}
                  onChange={(event) =>
                    handleMetricChange(event.target.value as MetricKey)
                  }
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  {metricOrder.map((metricKey) => (
                    <option key={metricKey} value={metricKey}>
                      {metricConfigs[metricKey].label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 lg:col-span-3">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Nome
                </span>

                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  placeholder="Ex: Faturamento de junho"
                />
              </label>

              <label className="space-y-1.5 lg:col-span-2">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Valor da meta
                </span>

                <input
                  value={form.target_value}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      target_value: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  placeholder="120000"
                />
              </label>

              <label className="space-y-1.5 lg:col-span-2">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Início
                </span>

                <input
                  type="date"
                  value={form.period_start}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      period_start: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="space-y-1.5 lg:col-span-2">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Fim
                </span>

                <input
                  type="date"
                  value={form.period_end}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      period_end: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="space-y-1.5 lg:col-span-8">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Observação
                </span>

                <input
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  placeholder="Ex: Meta agressiva para campanha do mês"
                />
              </label>

              <div className="grid grid-cols-2 gap-2 lg:col-span-4 lg:flex lg:items-end">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  disabled={isSaving}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Salvar
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-950">
                Painel de metas
              </h2>

              <p className="text-xs font-medium text-slate-500 md:text-sm">
                Cada card mostra meta, realizado, progresso e status.
              </p>
            </div>

            <div className="w-fit rounded-2xl border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700">
              Até o 20º dia: roxo/azul neutro
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                Carregando metas...
              </div>
            </div>
          ) : visibleGoals.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
                <Target className="h-6 w-6" />
              </div>

              <h3 className="mt-4 text-base font-black text-slate-950">
                Nenhuma meta cadastrada para esse mês
              </h3>

              <p className="mx-auto mt-2 max-w-xl text-sm font-medium text-slate-500">
                Crie metas de faturamento, despesas, desperdícios, quebras, ticket
                médio, pedidos e CMV.
              </p>

              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Criar primeira meta
              </button>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {visibleGoals.map((goal) => {
                const config = metricConfigs[goal.metric_key]
                const actualValue = actuals[goal.metric_key]
                const targetValue = Number(goal.target_value) || 0
                const view = getGoalView(goal, actualValue)

                return (
                  <article
                    key={goal.id}
                    className={cn(
                      "overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                      view.borderClass,
                    )}
                  >
                    <div className="p-3 md:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                            {config.icon}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-black text-slate-950 md:text-base">
                                {goal.name}
                              </h3>

                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[10px] font-black",
                                  view.badgeClass,
                                )}
                              >
                                {view.label}
                              </span>
                            </div>

                            <p className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-500 md:text-sm">
                              {config.description}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleDeleteGoal(goal.id)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          aria-label="Remover meta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-4">
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                            Progresso
                          </span>

                          <span className={cn("text-xs font-black", view.textClass)}>
                            {view.rawPercent.toLocaleString("pt-BR", {
                              maximumFractionDigits: 1,
                            })}
                            %
                          </span>
                        </div>

                        <div className="relative h-5 overflow-hidden rounded-full border border-slate-200 bg-slate-100 p-1 shadow-inner">
                          <div
                            className={cn(
                              "relative h-full overflow-hidden rounded-full bg-gradient-to-r shadow-sm transition-all duration-700",
                              view.barClass,
                            )}
                            style={{
                              width: `${view.progressWidth}%`,
                            }}
                          >
                            <div className="h-full w-full bg-[linear-gradient(135deg,rgba(255,255,255,.38)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.38)_50%,rgba(255,255,255,.38)_75%,transparent_75%,transparent)] bg-[length:16px_16px] opacity-70" />
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                            Meta
                          </p>

                          <p className="mt-1 truncate text-sm font-black text-slate-950 md:text-base">
                            {formatMetricValue(goal.metric_key, targetValue)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                            Atingido
                          </p>

                          <p className="mt-1 truncate text-sm font-black text-slate-950 md:text-base">
                            {formatMetricValue(goal.metric_key, actualValue)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-3">
                        <p className="text-xs font-bold text-slate-700 md:text-sm">
                          {getGoalBalanceText(goal, actualValue)}
                        </p>

                        <p className="mt-1 text-[11px] font-semibold text-slate-500">
                          {view.helper}
                        </p>
                      </div>

                      {goal.notes && (
                        <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                          {goal.notes}
                        </p>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  )
}