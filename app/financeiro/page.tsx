"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  CreditCard,
  DollarSign,
  Flame,
  Loader2,
  Package,
  Plus,
  ReceiptText,
  RefreshCcw,
  Scale,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react"

type PeriodKey = "today" | "7d" | "30d" | "month"

type OrderRow = {
  id: string
  total: number | string | null
  created_at: string
  status: string | null
  payment_method: string | null
  payment_status: string | null
}

type RawOrderItem = Record<string, unknown>

type ProductRow = {
  id: string
  name: string
  price: number | string | null
  cost_price: number | string | null
  category_id: string | null
}

type CategoryRow = {
  id: string
  name: string
}

type FinancialTransaction = {
  id: string
  type: "income" | "expense"
  origin: string
  title: string
  description: string | null
  amount: number | string
  category: string | null
  payment_method: string | null
  occurred_at: string
}

type ProductLoss = {
  id: string
  product_id: string | null
  product_name: string
  quantity: number | string
  unit_cost: number | string
  total_cost: number | string
  reason: string
  notes: string | null
  occurred_at: string
}

type ProductFinance = {
  productId: string | null
  name: string
  category: string
  quantity: number
  revenue: number
  cost: number
  profit: number
  margin: number
}

type CategoryFinance = {
  category: string
  revenue: number
  cost: number
  profit: number
  cmv: number
}

type PaymentBreakdown = {
  label: string
  total: number
  count: number
}

type DashboardData = {
  grossRevenue: number
  ordersCount: number
  averageTicket: number
  manualIncome: number
  expenses: number
  losses: number
  productCost: number
  estimatedProfit: number
  cmv: number
  pixTotal: number
  cashTotal: number
  cardTotal: number
  productFinance: ProductFinance[]
  categoryFinance: CategoryFinance[]
  paymentBreakdown: PaymentBreakdown[]
  transactions: FinancialTransaction[]
  productLosses: ProductLoss[]
}

const emptyDashboard: DashboardData = {
  grossRevenue: 0,
  ordersCount: 0,
  averageTicket: 0,
  manualIncome: 0,
  expenses: 0,
  losses: 0,
  productCost: 0,
  estimatedProfit: 0,
  cmv: 0,
  pixTotal: 0,
  cashTotal: 0,
  cardTotal: 0,
  productFinance: [],
  categoryFinance: [],
  paymentBreakdown: [],
  transactions: [],
  productLosses: [],
}

const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month", label: "Mês atual" },
]

const lossReasons = [
  { value: "waste", label: "Desperdício" },
  { value: "expired", label: "Vencido" },
  { value: "wrong_order", label: "Pedido errado" },
  { value: "kitchen_error", label: "Erro na cozinha" },
  { value: "damaged", label: "Danificado" },
  { value: "other", label: "Outro" },
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

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
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

function isValidOrderForFinance(order: OrderRow) {
  const status = String(order.status || "").toLowerCase()
  const paymentMethod = String(order.payment_method || "").toLowerCase()
  const paymentStatus = String(order.payment_status || "").toLowerCase()

  const cancelledStatuses = [
    "cancelled",
    "canceled",
    "cancelado",
    "recusado",
    "refused",
  ]

  if (cancelledStatuses.includes(status)) return false

  if (paymentMethod === "pix") {
    return ["paid", "received", "confirmed"].includes(paymentStatus)
  }

  return true
}

function getPaymentLabel(paymentMethod: string | null) {
  const method = String(paymentMethod || "").toLowerCase()

  if (method === "pix") return "Pix"
  if (method === "cash" || method === "dinheiro") return "Dinheiro"
  if (method === "credit_card" || method === "credito") return "Crédito"
  if (method === "debit_card" || method === "debito") return "Débito"
  if (method === "card" || method === "cartao") return "Cartão"

  return paymentMethod || "Não informado"
}

function getPaymentBucket(paymentMethod: string | null) {
  const method = String(paymentMethod || "").toLowerCase()

  if (method === "pix") return "pix"
  if (method === "cash" || method === "dinheiro") return "cash"

  return "card"
}

function normalizeOrderItem(raw: RawOrderItem) {
  const productId =
    typeof raw.product_id === "string"
      ? raw.product_id
      : typeof raw.menu_item_id === "string"
        ? raw.menu_item_id
        : null

  const quantity = Number(raw.quantity || raw.qty || 1)

  const name =
    String(
      raw.product_name ||
        raw.menu_item_name ||
        raw.item_name ||
        raw.name ||
        "Produto sem nome"
    ) || "Produto sem nome"

  const unitPrice = Number(raw.unit_price || raw.price || 0)

  const total = Number(
    raw.total_price ||
      raw.subtotal ||
      raw.total ||
      raw.line_total ||
      unitPrice * quantity ||
      0
  )

  const orderId = String(raw.order_id || "")

  return {
    orderId,
    productId,
    name,
    quantity,
    total,
  }
}

function calculateMargin(revenue: number, profit: number) {
  if (revenue <= 0) return 0
  return (profit / revenue) * 100
}

function calculateCmv(revenue: number, cost: number) {
  if (revenue <= 0) return 0
  return (cost / revenue) * 100
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone = "default",
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  tone?: "default" | "green" | "red" | "blue" | "amber"
}) {
  const toneClass = {
    default: "bg-slate-950 text-white",
    green: "bg-emerald-600 text-white",
    red: "bg-red-600 text-white",
    blue: "bg-blue-600 text-white",
    amber: "bg-amber-500 text-white",
  }[tone]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
          <p className="mt-2 text-sm leading-5 text-slate-500">{subtitle}</p>
        </div>

        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        {icon}
      </div>

      <div>
        <h2 className="text-base font-black text-slate-950">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  )
}

function ProgressBar({
  value,
  max,
  color = "blue",
}: {
  value: number
  max: number
  color?: "blue" | "green" | "red" | "amber" | "slate"
}) {
  const width = max <= 0 ? 0 : Math.min(100, (value / max) * 100)

  const colorClass = {
    blue: "bg-blue-600",
    green: "bg-emerald-600",
    red: "bg-red-600",
    amber: "bg-amber-500",
    slate: "bg-slate-950",
  }[color]

  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${width}%` }} />
    </div>
  )
}

export default function FinanceiroPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const [period, setPeriod] = useState<PeriodKey>("today")
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [data, setData] = useState<DashboardData>(emptyDashboard)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingTransaction, setIsSavingTransaction] = useState(false)
  const [isSavingLoss, setIsSavingLoss] = useState(false)
  const [isClosingCash, setIsClosingCash] = useState(false)

  const [transactionType, setTransactionType] = useState<"income" | "expense">("expense")
  const [transactionTitle, setTransactionTitle] = useState("")
  const [transactionAmount, setTransactionAmount] = useState("")
  const [transactionCategory, setTransactionCategory] = useState("")
  const [transactionPaymentMethod, setTransactionPaymentMethod] = useState("pix")

  const [lossProductId, setLossProductId] = useState("")
  const [lossQuantity, setLossQuantity] = useState("1")
  const [lossUnitCost, setLossUnitCost] = useState("")
  const [lossReason, setLossReason] = useState("waste")
  const [lossNotes, setLossNotes] = useState("")

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

  const loadFinanceiro = useCallback(async () => {
    try {
      setIsLoading(true)

      const resolvedRestaurantId = await resolveRestaurant()
      const startDate = getPeriodStart(period)

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, total, created_at, status, payment_method, payment_status")
        .eq("restaurant_id", resolvedRestaurantId)
        .gte("created_at", startDate)
        .order("created_at", { ascending: true })

      if (ordersError) throw ordersError

      const validOrders = ((ordersData ?? []) as OrderRow[]).filter(isValidOrderForFinance)
      const orderIds = validOrders.map((order) => order.id)

      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, price, cost_price, category_id")
        .eq("restaurant_id", resolvedRestaurantId)

      if (productsError) throw productsError

      const productRows = (productsData ?? []) as ProductRow[]
      setProducts(productRows)

      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("id, name")
        .eq("restaurant_id", resolvedRestaurantId)

      if (categoriesError) throw categoriesError

      const categoryRows = (categoriesData ?? []) as CategoryRow[]

      let orderItems: RawOrderItem[] = []

      if (orderIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", orderIds)

        if (itemsError) throw itemsError

        orderItems = (itemsData ?? []) as RawOrderItem[]
      }

      const { data: transactionsData, error: transactionsError } = await supabase
        .from("financial_transactions")
        .select("id, type, origin, title, description, amount, category, payment_method, occurred_at")
        .eq("restaurant_id", resolvedRestaurantId)
        .gte("occurred_at", startDate)
        .order("occurred_at", { ascending: false })

      if (transactionsError) throw transactionsError

      const { data: lossesData, error: lossesError } = await supabase
        .from("product_losses")
        .select("id, product_id, product_name, quantity, unit_cost, total_cost, reason, notes, occurred_at")
        .eq("restaurant_id", resolvedRestaurantId)
        .gte("occurred_at", startDate)
        .order("occurred_at", { ascending: false })

      if (lossesError) throw lossesError

      const transactions = (transactionsData ?? []) as FinancialTransaction[]
      const productLosses = (lossesData ?? []) as ProductLoss[]

      const productsById = new Map(productRows.map((product) => [product.id, product]))
      const categoriesById = new Map(categoryRows.map((category) => [category.id, category.name]))

      const grossRevenue = validOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      )

      const ordersCount = validOrders.length
      const averageTicket = ordersCount > 0 ? grossRevenue / ordersCount : 0

      const manualIncome = transactions
        .filter((transaction) => transaction.type === "income")
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)

      const expenses = transactions
        .filter((transaction) => transaction.type === "expense")
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)

      const losses = productLosses.reduce(
        (sum, loss) => sum + Number(loss.total_cost || 0),
        0
      )

      const productFinanceMap = new Map<string, ProductFinance>()

      for (const rawItem of orderItems) {
        const item = normalizeOrderItem(rawItem)
        const product = item.productId ? productsById.get(item.productId) : null

        const productName = product?.name || item.name
        const productCost = Number(product?.cost_price || 0) * item.quantity
        const productRevenue =
          item.total > 0 ? item.total : Number(product?.price || 0) * item.quantity

        const categoryName =
          product?.category_id && categoriesById.get(product.category_id)
            ? String(categoriesById.get(product.category_id))
            : "Sem categoria"

        const key = item.productId || productName

        const current =
          productFinanceMap.get(key) ??
          ({
            productId: item.productId,
            name: productName,
            category: categoryName,
            quantity: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
            margin: 0,
          } satisfies ProductFinance)

        current.quantity += item.quantity
        current.revenue += productRevenue
        current.cost += productCost
        current.profit = current.revenue - current.cost
        current.margin = calculateMargin(current.revenue, current.profit)

        productFinanceMap.set(key, current)
      }

      const productFinance = Array.from(productFinanceMap.values()).sort(
        (a, b) => b.profit - a.profit
      )

      const productCost = productFinance.reduce((sum, item) => sum + item.cost, 0)

      const categoryFinanceMap = new Map<string, CategoryFinance>()

      for (const product of productFinance) {
        const current =
          categoryFinanceMap.get(product.category) ??
          ({
            category: product.category,
            revenue: 0,
            cost: 0,
            profit: 0,
            cmv: 0,
          } satisfies CategoryFinance)

        current.revenue += product.revenue
        current.cost += product.cost
        current.profit = current.revenue - current.cost
        current.cmv = calculateCmv(current.revenue, current.cost)

        categoryFinanceMap.set(product.category, current)
      }

      const categoryFinance = Array.from(categoryFinanceMap.values()).sort(
        (a, b) => b.cost - a.cost
      )

      const paymentMap = new Map<string, PaymentBreakdown>()

      let pixTotal = 0
      let cashTotal = 0
      let cardTotal = 0

      for (const order of validOrders) {
        const total = Number(order.total || 0)
        const label = getPaymentLabel(order.payment_method)
        const bucket = getPaymentBucket(order.payment_method)

        if (bucket === "pix") pixTotal += total
        if (bucket === "cash") cashTotal += total
        if (bucket === "card") cardTotal += total

        const current =
          paymentMap.get(label) ??
          ({
            label,
            total: 0,
            count: 0,
          } satisfies PaymentBreakdown)

        current.total += total
        current.count += 1

        paymentMap.set(label, current)
      }

      const estimatedProfit =
        grossRevenue + manualIncome - expenses - losses - productCost

      const cmv = calculateCmv(grossRevenue, productCost)

      setData({
        grossRevenue,
        ordersCount,
        averageTicket,
        manualIncome,
        expenses,
        losses,
        productCost,
        estimatedProfit,
        cmv,
        pixTotal,
        cashTotal,
        cardTotal,
        productFinance,
        categoryFinance,
        paymentBreakdown: Array.from(paymentMap.values()).sort(
          (a, b) => b.total - a.total
        ),
        transactions,
        productLosses,
      })
    } catch (error) {
      console.error("Erro ao carregar financeiro:", error)

      toast({
        title: "Erro ao carregar financeiro",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os dados financeiros.",
        variant: "destructive",
      })

      setData(emptyDashboard)
    } finally {
      setIsLoading(false)
    }
  }, [period, resolveRestaurant, supabase, toast])

  useEffect(() => {
    void loadFinanceiro()
  }, [loadFinanceiro])

  const saveTransaction = async () => {
    try {
      const resolvedRestaurantId = await resolveRestaurant()
      const amount = Number(transactionAmount.replace(",", "."))

      if (!transactionTitle.trim() || !Number.isFinite(amount) || amount <= 0) {
        toast({
          title: "Preencha os dados",
          description: "Informe título e valor válido.",
          variant: "destructive",
        })
        return
      }

      setIsSavingTransaction(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from("financial_transactions").insert({
        restaurant_id: resolvedRestaurantId,
        type: transactionType,
        origin: "manual",
        title: transactionTitle.trim(),
        amount,
        category: transactionCategory.trim() || null,
        payment_method: transactionPaymentMethod || null,
        created_by: user?.id ?? null,
      })

      if (error) throw error

      setTransactionTitle("")
      setTransactionAmount("")
      setTransactionCategory("")
      setTransactionPaymentMethod("pix")

      toast({
        title: transactionType === "income" ? "Entrada registrada" : "Saída registrada",
        description: "O lançamento foi salvo no financeiro.",
      })

      await loadFinanceiro()
    } catch (error) {
      console.error("Erro ao salvar lançamento:", error)

      toast({
        title: "Erro ao salvar lançamento",
        description:
          error instanceof Error ? error.message : "Não foi possível salvar.",
        variant: "destructive",
      })
    } finally {
      setIsSavingTransaction(false)
    }
  }

  const saveLoss = async () => {
    try {
      const resolvedRestaurantId = await resolveRestaurant()
      const selectedProduct = products.find((product) => product.id === lossProductId)

      if (!selectedProduct) {
        toast({
          title: "Selecione um produto",
          description: "Escolha o produto da perda.",
          variant: "destructive",
        })
        return
      }

      const quantity = Number(lossQuantity.replace(",", "."))
      const unitCost = Number(lossUnitCost.replace(",", "."))

      if (!Number.isFinite(quantity) || quantity <= 0) {
        toast({
          title: "Quantidade inválida",
          description: "Informe uma quantidade maior que zero.",
          variant: "destructive",
        })
        return
      }

      if (!Number.isFinite(unitCost) || unitCost < 0) {
        toast({
          title: "Custo inválido",
          description: "Informe um custo válido.",
          variant: "destructive",
        })
        return
      }

      setIsSavingLoss(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from("product_losses").insert({
        restaurant_id: resolvedRestaurantId,
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity,
        unit_cost: unitCost,
        reason: lossReason,
        notes: lossNotes.trim() || null,
        created_by: user?.id ?? null,
      })

      if (error) throw error

      setLossProductId("")
      setLossQuantity("1")
      setLossUnitCost("")
      setLossReason("waste")
      setLossNotes("")

      toast({
        title: "Perda registrada",
        description: "A perda entrou no cálculo financeiro.",
      })

      await loadFinanceiro()
    } catch (error) {
      console.error("Erro ao salvar perda:", error)

      toast({
        title: "Erro ao salvar perda",
        description:
          error instanceof Error ? error.message : "Não foi possível salvar.",
        variant: "destructive",
      })
    } finally {
      setIsSavingLoss(false)
    }
  }

  const closeCashToday = async () => {
    try {
      if (period !== "today") return

      const resolvedRestaurantId = await resolveRestaurant()
      setIsClosingCash(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from("cash_closings").upsert(
        {
          restaurant_id: resolvedRestaurantId,
          closing_date: getLocalDateString(),
          gross_revenue: data.grossRevenue,
          manual_income: data.manualIncome,
          expenses: data.expenses,
          losses: data.losses,
          product_cost: data.productCost,
          estimated_profit: data.estimatedProfit,
          pix_total: data.pixTotal,
          cash_total: data.cashTotal,
          card_total: data.cardTotal,
          orders_count: data.ordersCount,
          average_ticket: data.averageTicket,
          closed_by: user?.id ?? null,
          closed_at: new Date().toISOString(),
        },
        {
          onConflict: "restaurant_id,closing_date",
        }
      )

      if (error) throw error

      toast({
        title: "Caixa fechado",
        description: "O fechamento de hoje foi salvo com sucesso.",
      })
    } catch (error) {
      console.error("Erro ao fechar caixa:", error)

      toast({
        title: "Erro ao fechar caixa",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível fechar o caixa.",
        variant: "destructive",
      })
    } finally {
      setIsClosingCash(false)
    }
  }

  const selectedLossProduct = products.find((product) => product.id === lossProductId)

  useEffect(() => {
    if (!selectedLossProduct) return

    setLossUnitCost(String(Number(selectedLossProduct.cost_price || 0)).replace(".", ","))
  }, [selectedLossProduct?.id])

  const maxProductProfit = useMemo(() => {
    return Math.max(...data.productFinance.map((item) => item.profit), 1)
  }, [data.productFinance])

  const maxCategoryCost = useMemo(() => {
    return Math.max(...data.categoryFinance.map((item) => item.cost), 1)
  }, [data.categoryFinance])

  return (
    <AdminLayout title="Financeiro">
      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-950">
                Financeiro
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Controle faturamento, entradas, saídas, perdas, CMV e lucro por produto.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {periodOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setPeriod(option.key)}
                  className={[
                    "h-10 rounded-lg px-4 text-sm font-bold transition",
                    period === option.key
                      ? "bg-blue-600 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => void loadFinanceiro()}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </button>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-slate-200 bg-white">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando financeiro...
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <StatCard
                title="Faturamento"
                value={formatCurrency(data.grossRevenue)}
                subtitle="Pedidos pagos/válidos"
                tone="blue"
                icon={<DollarSign className="h-5 w-5" />}
              />

              <StatCard
                title="Entradas"
                value={formatCurrency(data.manualIncome)}
                subtitle="Lançamentos manuais"
                tone="green"
                icon={<ArrowUpRight className="h-5 w-5" />}
              />

              <StatCard
                title="Saídas"
                value={formatCurrency(data.expenses)}
                subtitle="Despesas lançadas"
                tone="red"
                icon={<ArrowDownLeft className="h-5 w-5" />}
              />

              <StatCard
                title="Perdas"
                value={formatCurrency(data.losses)}
                subtitle="Desperdício registrado"
                tone="amber"
                icon={<Trash2 className="h-5 w-5" />}
              />

              <StatCard
                title="CMV"
                value={`${data.cmv.toFixed(1)}%`}
                subtitle="Custo dos produtos vendidos"
                tone={data.cmv > 40 ? "red" : data.cmv > 32 ? "amber" : "green"}
                icon={<Scale className="h-5 w-5" />}
              />

              <StatCard
                title="Resultado"
                value={formatCurrency(data.estimatedProfit)}
                subtitle="Estimado após custos"
                tone={data.estimatedProfit >= 0 ? "green" : "red"}
                icon={<Wallet className="h-5 w-5" />}
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <SectionTitle
                  icon={<TrophyIcon />}
                  title="Lucro por produto"
                  subtitle="Receita, custo, lucro e margem por item vendido"
                />

                <div className="mt-5 space-y-3">
                  {data.productFinance.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                      Nenhum produto vendido no período.
                    </div>
                  ) : (
                    data.productFinance.slice(0, 10).map((product) => (
                      <div key={`${product.productId}-${product.name}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-sm font-black text-slate-950">{product.name}</p>
                            <p className="text-xs text-slate-500">
                              {product.category} • {product.quantity} un. vendida(s)
                            </p>
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-right">
                            <div>
                              <p className="text-xs font-bold uppercase text-slate-400">Faturou</p>
                              <p className="text-sm font-black text-slate-950">{formatCurrency(product.revenue)}</p>
                            </div>

                            <div>
                              <p className="text-xs font-bold uppercase text-slate-400">Custo</p>
                              <p className="text-sm font-black text-slate-950">{formatCurrency(product.cost)}</p>
                            </div>

                            <div>
                              <p className="text-xs font-bold uppercase text-slate-400">Lucro</p>
                              <p className={product.profit >= 0 ? "text-sm font-black text-emerald-600" : "text-sm font-black text-red-600"}>
                                {formatCurrency(product.profit)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <ProgressBar
                            value={Math.max(product.profit, 0)}
                            max={maxProductProfit}
                            color={product.profit >= 0 ? "blue" : "red"}
                          />
                        </div>

                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          Margem: {product.margin.toFixed(1)}%
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <SectionTitle
                    icon={<CreditCard className="h-5 w-5" />}
                    title="Métodos de pagamento"
                    subtitle="Quanto entrou por forma de pagamento"
                  />

                  <div className="mt-5 space-y-4">
                    {data.paymentBreakdown.length === 0 ? (
                      <p className="text-sm text-slate-500">Nenhum pagamento no período.</p>
                    ) : (
                      data.paymentBreakdown.map((payment) => (
                        <div key={payment.label}>
                          <div className="mb-1.5 flex items-center justify-between gap-3">
                            <span className="text-sm font-bold text-slate-700">{payment.label}</span>
                            <span className="text-sm font-black text-slate-950">
                              {formatCurrency(payment.total)}
                            </span>
                          </div>

                          <ProgressBar value={payment.total} max={data.grossRevenue} color="blue" />

                          <p className="mt-1 text-xs text-slate-500">
                            {payment.count} pedido(s)
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <SectionTitle
                    icon={<CalendarCheck className="h-5 w-5" />}
                    title="Fechamento diário"
                    subtitle="Salva o resumo financeiro do dia"
                  />

                  <div className="mt-5 rounded-lg bg-slate-50 p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-slate-500">Pix</p>
                        <p className="font-black text-slate-950">{formatCurrency(data.pixTotal)}</p>
                      </div>

                      <div>
                        <p className="text-slate-500">Dinheiro</p>
                        <p className="font-black text-slate-950">{formatCurrency(data.cashTotal)}</p>
                      </div>

                      <div>
                        <p className="text-slate-500">Cartão</p>
                        <p className="font-black text-slate-950">{formatCurrency(data.cardTotal)}</p>
                      </div>

                      <div>
                        <p className="text-slate-500">Pedidos</p>
                        <p className="font-black text-slate-950">{data.ordersCount}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void closeCashToday()}
                    disabled={period !== "today" || isClosingCash}
                    className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isClosingCash ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CalendarCheck className="h-4 w-4" />
                    )}
                    {period === "today" ? "Fechar caixa de hoje" : "Use o filtro Hoje para fechar"}
                  </button>
                </div>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <SectionTitle
                  icon={<Package className="h-5 w-5" />}
                  title="Custo por categoria"
                  subtitle="Veja onde o custo do cardápio está concentrado"
                />

                <div className="mt-5 space-y-4">
                  {data.categoryFinance.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                      Nenhum custo por categoria no período.
                    </div>
                  ) : (
                    data.categoryFinance.map((category) => (
                      <div key={category.category}>
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-950">{category.category}</p>
                            <p className="text-xs text-slate-500">
                              CMV: {category.cmv.toFixed(1)}% • Lucro: {formatCurrency(category.profit)}
                            </p>
                          </div>

                          <p className="text-sm font-black text-slate-950">
                            {formatCurrency(category.cost)}
                          </p>
                        </div>

                        <ProgressBar value={category.cost} max={maxCategoryCost} color="slate" />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <SectionTitle
                  icon={<ReceiptText className="h-5 w-5" />}
                  title="Relatório do período"
                  subtitle="Resumo financeiro consolidado"
                />

                <div className="mt-5 grid gap-3">
                  <ReportLine label="Faturamento bruto" value={formatCurrency(data.grossRevenue)} />
                  <ReportLine label="Entradas manuais" value={formatCurrency(data.manualIncome)} />
                  <ReportLine label="Custo dos produtos vendidos" value={`-${formatCurrency(data.productCost)}`} />
                  <ReportLine label="Saídas/despesas" value={`-${formatCurrency(data.expenses)}`} />
                  <ReportLine label="Perdas" value={`-${formatCurrency(data.losses)}`} />
                  <ReportLine label="Ticket médio" value={formatCurrency(data.averageTicket)} />
                  <ReportLine label="CMV" value={`${data.cmv.toFixed(1)}%`} />
                  <div className="mt-2 rounded-lg bg-blue-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-blue-900">Resultado estimado</p>
                      <p className="text-lg font-black text-blue-700">{formatCurrency(data.estimatedProfit)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <SectionTitle
                  icon={<Plus className="h-5 w-5" />}
                  title="Entradas e saídas"
                  subtitle="Lance despesas, compras e entradas manuais"
                />

                <div className="mt-5 grid gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTransactionType("income")}
                      className={[
                        "h-10 rounded-lg border text-sm font-bold transition",
                        transactionType === "income"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      Entrada
                    </button>

                    <button
                      type="button"
                      onClick={() => setTransactionType("expense")}
                      className={[
                        "h-10 rounded-lg border text-sm font-bold transition",
                        transactionType === "expense"
                          ? "border-red-300 bg-red-50 text-red-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      Saída
                    </button>
                  </div>

                  <input
                    value={transactionTitle}
                    onChange={(event) => setTransactionTitle(event.target.value)}
                    placeholder="Ex: Compra de carne, gás, venda balcão..."
                    className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />

                  <div className="grid gap-3 sm:grid-cols-3">
                    <input
                      value={transactionAmount}
                      onChange={(event) =>
                        setTransactionAmount(event.target.value.replace(/[^0-9,.]/g, ""))
                      }
                      placeholder="Valor"
                      className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    />

                    <input
                      value={transactionCategory}
                      onChange={(event) => setTransactionCategory(event.target.value)}
                      placeholder="Categoria"
                      className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    />

                    <select
                      value={transactionPaymentMethod}
                      onChange={(event) => setTransactionPaymentMethod(event.target.value)}
                      className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    >
                      <option value="pix">Pix</option>
                      <option value="cash">Dinheiro</option>
                      <option value="card">Cartão</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => void saveTransaction()}
                    disabled={isSavingTransaction}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingTransaction && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar lançamento
                  </button>
                </div>

                <div className="mt-5 space-y-2">
                  {data.transactions.slice(0, 6).map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{transaction.title}</p>
                        <p className="text-xs text-slate-500">
                          {transaction.category || "Sem categoria"} • {formatDateTime(transaction.occurred_at)}
                        </p>
                      </div>

                      <p className={transaction.type === "income" ? "text-sm font-black text-emerald-600" : "text-sm font-black text-red-600"}>
                        {transaction.type === "income" ? "+" : "-"}
                        {formatCurrency(Number(transaction.amount || 0))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <SectionTitle
                  icon={<Flame className="h-5 w-5" />}
                  title="Registrar perda"
                  subtitle="Controle desperdício, erro de preparo e vencimento"
                />

                <div className="mt-5 grid gap-3">
                  <select
                    value={lossProductId}
                    onChange={(event) => setLossProductId(event.target.value)}
                    className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  >
                    <option value="">Selecione o produto</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <input
                      value={lossQuantity}
                      onChange={(event) =>
                        setLossQuantity(event.target.value.replace(/[^0-9,.]/g, ""))
                      }
                      placeholder="Qtd"
                      className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    />

                    <input
                      value={lossUnitCost}
                      onChange={(event) =>
                        setLossUnitCost(event.target.value.replace(/[^0-9,.]/g, ""))
                      }
                      placeholder="Custo unit."
                      className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    />

                    <select
                      value={lossReason}
                      onChange={(event) => setLossReason(event.target.value)}
                      className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    >
                      {lossReasons.map((reason) => (
                        <option key={reason.value} value={reason.value}>
                          {reason.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    value={lossNotes}
                    onChange={(event) => setLossNotes(event.target.value)}
                    placeholder="Observação opcional..."
                    rows={3}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />

                  <button
                    type="button"
                    onClick={() => void saveLoss()}
                    disabled={isSavingLoss}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingLoss && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar perda
                  </button>
                </div>

                <div className="mt-5 space-y-2">
                  {data.productLosses.slice(0, 6).map((loss) => (
                    <div key={loss.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{loss.product_name}</p>
                        <p className="text-xs text-slate-500">
                          {Number(loss.quantity)} un. • {formatDateTime(loss.occurred_at)}
                        </p>
                      </div>

                      <p className="text-sm font-black text-red-600">
                        -{formatCurrency(Number(loss.total_cost || 0))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  )
}

function ReportLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="text-sm font-black text-slate-950">{value}</p>
    </div>
  )
}

function TrophyIcon() {
  return <TrendingUp className="h-5 w-5" />
}