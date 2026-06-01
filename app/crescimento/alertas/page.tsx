"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BadgeDollarSign,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChefHat,
  Clock,
  EyeOff,
  Loader2,
  Package,
  PackageX,
  Percent,
  RefreshCcw,
  Search,
  ShoppingBag,
  Target,
  TrendingDown,
  UserX,
  Wallet,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Restaurant = {
  id: string
  name: string | null
}

type OrderRecord = {
  id: string
  created_at?: string | null
  status?: string | null
  payment_status?: string | null
  payment_method?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  subtotal?: number | string | null
  total?: number | string | null
  delivery_fee?: number | string | null
}

type AccountPayableRecord = {
  id: string
  description?: string | null
  title?: string | null
  name?: string | null
  category?: string | null
  status?: string | null
  due_date?: string | null
  paid_at?: string | null
  amount?: number | string | null
  value?: number | string | null
  total?: number | string | null
  total_amount?: number | string | null
}

type StockItemRecord = {
  id: string
  name?: string | null
  title?: string | null
  unit?: string | null
  current_quantity?: number | string | null
  quantity?: number | string | null
  minimum_quantity?: number | string | null
  min_quantity?: number | string | null
  minimum_stock?: number | string | null
  alert_quantity?: number | string | null
  unit_cost?: number | string | null
  cost_per_unit?: number | string | null
  average_cost?: number | string | null
  current_cost?: number | string | null
  last_cost?: number | string | null
  cost?: number | string | null
  price?: number | string | null
  purchase_price?: number | string | null
  last_purchase_price?: number | string | null
}

type ProductRecord = {
  id: string
  name?: string | null
  title?: string | null
  price?: number | string | null
  sale_price?: number | string | null
  selling_price?: number | string | null
  final_price?: number | string | null
  base_price?: number | string | null
  is_available?: boolean | null
  is_active?: boolean | null
}

type RecipeItemRecord = {
  id: string
  product_id: string | null
  stock_item_id: string | null
  quantity?: number | string | null
  amount?: number | string | null
  used_quantity?: number | string | null
  quantity_used?: number | string | null
  required_quantity?: number | string | null
}

type SmartAlert = {
  id: string
  category:
    | "financeiro"
    | "estoque"
    | "cardapio"
    | "vendas"
    | "clientes"
    | "operacao"
  priority: "critical" | "high" | "medium" | "low"
  title: string
  description: string
  metric: string
  actionLabel: string
  actionHref: string
  createdAt: Date
}

type CategoryFilter =
  | "all"
  | "financeiro"
  | "estoque"
  | "cardapio"
  | "vendas"
  | "clientes"
  | "operacao"

type PriorityFilter = "all" | "critical" | "high" | "medium" | "low"

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

function formatMoney(value: number) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".")
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function firstPositiveNumber(...values: unknown[]) {
  for (const value of values) {
    const number = toNumber(value)
    if (number > 0) return number
  }

  return 0
}

function normalizeText(value?: string | null) {
  return String(value || "").trim()
}

function normalizePhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "")
}

function getOrderTotal(order: OrderRecord) {
  const total = toNumber(order.total)

  if (total > 0) return total

  return toNumber(order.subtotal) + toNumber(order.delivery_fee)
}

function getPayableAmount(payable: AccountPayableRecord) {
  return firstPositiveNumber(
    payable.amount,
    payable.value,
    payable.total,
    payable.total_amount,
  )
}

function getPayableName(payable: AccountPayableRecord) {
  return (
    payable.description ||
    payable.title ||
    payable.name ||
    payable.category ||
    "Conta a pagar"
  )
}

function getProductName(product: ProductRecord) {
  return product.name || product.title || "Produto sem nome"
}

function getStockName(stockItem: StockItemRecord) {
  return stockItem.name || stockItem.title || "Insumo sem nome"
}

function getProductPrice(product: ProductRecord) {
  return firstPositiveNumber(
    product.price,
    product.sale_price,
    product.selling_price,
    product.final_price,
    product.base_price,
  )
}

function getRecipeQuantity(item: RecipeItemRecord) {
  return firstPositiveNumber(
    item.quantity,
    item.amount,
    item.used_quantity,
    item.quantity_used,
    item.required_quantity,
  )
}

function getStockQuantity(stockItem: StockItemRecord) {
  return toNumber(stockItem.current_quantity) || toNumber(stockItem.quantity)
}

function getStockMinimumQuantity(stockItem: StockItemRecord) {
  return firstPositiveNumber(
    stockItem.minimum_quantity,
    stockItem.min_quantity,
    stockItem.minimum_stock,
    stockItem.alert_quantity,
  )
}

function getStockUnitCost(stockItem?: StockItemRecord) {
  if (!stockItem) return 0

  return firstPositiveNumber(
    stockItem.unit_cost,
    stockItem.cost_per_unit,
    stockItem.average_cost,
    stockItem.current_cost,
    stockItem.last_cost,
    stockItem.cost,
    stockItem.purchase_price,
    stockItem.last_purchase_price,
    stockItem.price,
  )
}

function isCanceledStatus(status?: string | null) {
  const normalized = String(status || "").toLowerCase()

  return (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "cancelado"
  )
}

function isPaidStatus(status?: string | null) {
  return String(status || "").toLowerCase() === "paid"
}

function isOpenPayable(payable: AccountPayableRecord) {
  const status = String(payable.status || "").toLowerCase()

  if (status === "paid" || status === "pago" || status === "cancelled") {
    return false
  }

  if (payable.paid_at) return false

  return true
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function diffInDays(date: Date) {
  const today = startOfToday()
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)

  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function minutesSince(date: Date) {
  const diff = Date.now() - date.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60)))
}

function getPriorityWeight(priority: SmartAlert["priority"]) {
  if (priority === "critical") return 4
  if (priority === "high") return 3
  if (priority === "medium") return 2
  return 1
}

function getCategoryLabel(category: SmartAlert["category"]) {
  const labels: Record<SmartAlert["category"], string> = {
    financeiro: "Financeiro",
    estoque: "Estoque",
    cardapio: "Cardápio",
    vendas: "Vendas",
    clientes: "Clientes",
    operacao: "Operação",
  }

  return labels[category]
}

function getPriorityLabel(priority: SmartAlert["priority"]) {
  const labels: Record<SmartAlert["priority"], string> = {
    critical: "Crítico",
    high: "Alta",
    medium: "Média",
    low: "Baixa",
  }

  return labels[priority]
}

function getAlertIcon(category: SmartAlert["category"]) {
  if (category === "financeiro") return Wallet
  if (category === "estoque") return PackageX
  if (category === "cardapio") return ChefHat
  if (category === "vendas") return TrendingDown
  if (category === "clientes") return UserX
  return BellRing
}

export default function AlertasInteligentesPage() {
  const supabase = createClient()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [accountsPayable, setAccountsPayable] = useState<
    AccountPayableRecord[]
  >([])
  const [stockItems, setStockItems] = useState<StockItemRecord[]>([])
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [recipeItems, setRecipeItems] = useState<RecipeItemRecord[]>([])
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all")
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all")
  const [searchTerm, setSearchTerm] = useState("")

  async function loadData(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError

      if (!user) {
        setError("Usuário não autenticado.")
        return
      }

      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle()

      if (restaurantError) throw restaurantError

      if (!restaurantData) {
        setError("Nenhum restaurante encontrado para este usuário.")
        return
      }

      setRestaurant(restaurantData)

      const [
        ordersResponse,
        accountsPayableResponse,
        stockItemsResponse,
        productsResponse,
        recipeItemsResponse,
      ] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .eq("restaurant_id", restaurantData.id)
          .order("created_at", { ascending: false })
          .limit(3000),
        supabase
          .from("accounts_payable")
          .select("*")
          .eq("restaurant_id", restaurantData.id),
        supabase
          .from("stock_items")
          .select("*")
          .eq("restaurant_id", restaurantData.id),
        supabase
          .from("products")
          .select("*")
          .eq("restaurant_id", restaurantData.id),
        supabase
          .from("product_recipe_items")
          .select("*")
          .eq("restaurant_id", restaurantData.id),
      ])

      if (ordersResponse.error) throw ordersResponse.error
      if (accountsPayableResponse.error) throw accountsPayableResponse.error
      if (stockItemsResponse.error) throw stockItemsResponse.error
      if (productsResponse.error) throw productsResponse.error
      if (recipeItemsResponse.error) throw recipeItemsResponse.error

      setOrders((ordersResponse.data || []) as OrderRecord[])
      setAccountsPayable(
        (accountsPayableResponse.data || []) as AccountPayableRecord[],
      )
      setStockItems((stockItemsResponse.data || []) as StockItemRecord[])
      setProducts((productsResponse.data || []) as ProductRecord[])
      setRecipeItems((recipeItemsResponse.data || []) as RecipeItemRecord[])
    } catch (err) {
      console.error("Erro ao carregar alertas inteligentes:", err)
      setError("Não foi possível carregar os alertas inteligentes.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const smartAlerts = useMemo<SmartAlert[]>(() => {
    const alerts: SmartAlert[] = []
    const now = new Date()
    const today = startOfToday()
    const tomorrow = addDays(today, 1)
    const nextSevenDays = addDays(today, 7)
    const lastSevenDays = addDays(today, -7)
    const previousSevenDays = addDays(today, -14)

    const validOrders = orders.filter((order) => {
      return !isCanceledStatus(order.status)
    })

    const paidOrders = validOrders.filter((order) =>
      isPaidStatus(order.payment_status),
    )

    const todayPaidOrders = paidOrders.filter((order) => {
      if (!order.created_at) return false

      const createdAt = new Date(order.created_at)
      return createdAt >= today
    })

    const lastSevenPaidOrders = paidOrders.filter((order) => {
      if (!order.created_at) return false

      const createdAt = new Date(order.created_at)
      return createdAt >= lastSevenDays && createdAt < today
    })

    const previousSevenPaidOrders = paidOrders.filter((order) => {
      if (!order.created_at) return false

      const createdAt = new Date(order.created_at)
      return createdAt >= previousSevenDays && createdAt < lastSevenDays
    })

    const todayRevenue = todayPaidOrders.reduce(
      (sum, order) => sum + getOrderTotal(order),
      0,
    )

    const lastSevenRevenue = lastSevenPaidOrders.reduce(
      (sum, order) => sum + getOrderTotal(order),
      0,
    )

    const previousSevenRevenue = previousSevenPaidOrders.reduce(
      (sum, order) => sum + getOrderTotal(order),
      0,
    )

    const averageDailyRevenue = lastSevenRevenue / 7

    const overduePayables = accountsPayable.filter((payable) => {
      if (!isOpenPayable(payable) || !payable.due_date) return false

      const dueDate = new Date(payable.due_date)
      return dueDate < today
    })

    const dueSoonPayables = accountsPayable.filter((payable) => {
      if (!isOpenPayable(payable) || !payable.due_date) return false

      const dueDate = new Date(payable.due_date)
      return dueDate >= today && dueDate <= nextSevenDays
    })

    const overdueAmount = overduePayables.reduce(
      (sum, payable) => sum + getPayableAmount(payable),
      0,
    )

    const dueSoonAmount = dueSoonPayables.reduce(
      (sum, payable) => sum + getPayableAmount(payable),
      0,
    )

    if (overduePayables.length > 0) {
      const firstOverdue = overduePayables[0]
      const dueDate = firstOverdue.due_date
        ? new Date(firstOverdue.due_date)
        : null

      alerts.push({
        id: "financeiro-contas-vencidas",
        category: "financeiro",
        priority: "critical",
        title: "Contas vencidas precisam de atenção",
        description: `${overduePayables.length} conta(s) vencida(s), incluindo "${getPayableName(
          firstOverdue,
        )}"${
          dueDate ? ` vencida há ${Math.abs(diffInDays(dueDate))} dia(s)` : ""
        }.`,
        metric: formatMoney(overdueAmount),
        actionLabel: "Ver contas",
        actionHref: "/financeiro/contas-a-pagar",
        createdAt: now,
      })
    }

    if (dueSoonPayables.length > 0) {
      alerts.push({
        id: "financeiro-contas-vencendo",
        category: "financeiro",
        priority: dueSoonAmount > todayRevenue && todayRevenue > 0 ? "high" : "medium",
        title: "Contas vencendo nos próximos dias",
        description: `${dueSoonPayables.length} conta(s) vencem em até 7 dias. Organize o caixa para não virar atraso.`,
        metric: formatMoney(dueSoonAmount),
        actionLabel: "Ver contas",
        actionHref: "/financeiro/contas-a-pagar",
        createdAt: now,
      })
    }

    const pendingPixOrders = validOrders.filter((order) => {
      const paymentStatus = String(order.payment_status || "").toLowerCase()
      const paymentMethod = String(order.payment_method || "").toLowerCase()

      if (paymentStatus === "paid") return false

      return paymentMethod.includes("pix")
    })

    const oldPendingPixOrders = pendingPixOrders.filter((order) => {
      if (!order.created_at) return false

      const createdAt = new Date(order.created_at)
      return minutesSince(createdAt) >= 30
    })

    if (oldPendingPixOrders.length > 0) {
      alerts.push({
        id: "operacao-pix-pendente",
        category: "operacao",
        priority: "high",
        title: "Pix pendente há mais de 30 minutos",
        description: `${oldPendingPixOrders.length} pedido(s) Pix estão aguardando confirmação. Confira comprovante ou pagamento antes de produzir.`,
        metric: `${oldPendingPixOrders.length} pedido(s)`,
        actionLabel: "Ver pedidos",
        actionHref: "/pedidos",
        createdAt: now,
      })
    }

    const lowStockItems = stockItems.filter((stockItem) => {
      const currentQuantity = getStockQuantity(stockItem)
      const minimumQuantity = getStockMinimumQuantity(stockItem)

      if (minimumQuantity > 0) {
        return currentQuantity <= minimumQuantity
      }

      return currentQuantity <= 0
    })

    const outOfStockItems = lowStockItems.filter((stockItem) => {
      return getStockQuantity(stockItem) <= 0
    })

    if (outOfStockItems.length > 0) {
      alerts.push({
        id: "estoque-zerado",
        category: "estoque",
        priority: "critical",
        title: "Insumos zerados no estoque",
        description: `${outOfStockItems.length} insumo(s) estão zerados. Isso pode travar produção e venda de produtos.`,
        metric: `${outOfStockItems.length} zerado(s)`,
        actionLabel: "Ver estoque",
        actionHref: "/financeiro/controle-estoque",
        createdAt: now,
      })
    } else if (lowStockItems.length > 0) {
      alerts.push({
        id: "estoque-baixo",
        category: "estoque",
        priority: "high",
        title: "Estoque abaixo do mínimo",
        description: `${lowStockItems.length} insumo(s) estão abaixo do estoque mínimo. O primeiro é "${getStockName(
          lowStockItems[0],
        )}".`,
        metric: `${lowStockItems.length} item(ns)`,
        actionLabel: "Ver estoque",
        actionHref: "/financeiro/controle-estoque",
        createdAt: now,
      })
    }

    const recipeProductIds = new Set(
      recipeItems
        .map((item) => item.product_id)
        .filter(Boolean)
        .map(String),
    )

    const activeProducts = products.filter((product) => {
      if (product.is_active === false) return false
      if (product.is_available === false) return false

      return true
    })

    const productsWithoutRecipe = activeProducts.filter((product) => {
      return !recipeProductIds.has(product.id)
    })

    if (productsWithoutRecipe.length > 0) {
      alerts.push({
        id: "cardapio-produtos-sem-ficha",
        category: "cardapio",
        priority: "medium",
        title: "Produtos sem ficha técnica",
        description: `${productsWithoutRecipe.length} produto(s) ativos estão sem ficha técnica. Sem isso, CMV e margem ficam incompletos.`,
        metric: `${productsWithoutRecipe.length} produto(s)`,
        actionLabel: "Ver ficha técnica",
        actionHref: "/ficha-tecnica",
        createdAt: now,
      })
    }

    const productsWithoutPrice = activeProducts.filter((product) => {
      return getProductPrice(product) <= 0
    })

    if (productsWithoutPrice.length > 0) {
      alerts.push({
        id: "cardapio-produtos-sem-preco",
        category: "cardapio",
        priority: "high",
        title: "Produtos ativos sem preço",
        description: `${productsWithoutPrice.length} produto(s) ativos não possuem preço válido. Isso pode quebrar cálculo de pedido e margem.`,
        metric: `${productsWithoutPrice.length} produto(s)`,
        actionLabel: "Ver cardápio",
        actionHref: "/produtos",
        createdAt: now,
      })
    }

    const stockById = new Map(stockItems.map((item) => [item.id, item]))

    const recipeItemsWithoutCost = recipeItems.filter((item) => {
      if (!item.stock_item_id) return false

      const stockItem = stockById.get(item.stock_item_id)
      const quantity = getRecipeQuantity(item)
      const unitCost = getStockUnitCost(stockItem)

      return quantity > 0 && unitCost <= 0
    })

    if (recipeItemsWithoutCost.length > 0) {
      alerts.push({
        id: "cardapio-insumos-sem-custo",
        category: "cardapio",
        priority: "high",
        title: "Ficha técnica com insumo sem custo",
        description: `${recipeItemsWithoutCost.length} item(ns) de ficha técnica usam insumos sem custo cadastrado. A margem pode estar falsa.`,
        metric: `${recipeItemsWithoutCost.length} item(ns)`,
        actionLabel: "Ver CMV",
        actionHref: "/financeiro/cmv-margem",
        createdAt: now,
      })
    }

    if (averageDailyRevenue > 0 && todayRevenue < averageDailyRevenue * 0.5) {
      alerts.push({
        id: "vendas-queda-hoje",
        category: "vendas",
        priority: "medium",
        title: "Vendas de hoje abaixo da média",
        description: `Hoje faturou ${formatMoney(
          todayRevenue,
        )}, abaixo da média diária dos últimos 7 dias (${formatMoney(
          averageDailyRevenue,
        )}).`,
        metric: formatMoney(todayRevenue),
        actionLabel: "Ver recebimentos",
        actionHref: "/financeiro/recebimentos",
        createdAt: now,
      })
    }

    if (previousSevenRevenue > 0 && lastSevenRevenue < previousSevenRevenue * 0.75) {
      alerts.push({
        id: "vendas-queda-semana",
        category: "vendas",
        priority: "high",
        title: "Queda de faturamento nos últimos 7 dias",
        description: `Os últimos 7 dias faturaram ${formatMoney(
          lastSevenRevenue,
        )}, abaixo da semana anterior (${formatMoney(previousSevenRevenue)}).`,
        metric: formatMoney(lastSevenRevenue - previousSevenRevenue),
        actionLabel: "Ver relatórios",
        actionHref: "/financeiro/relatorios",
        createdAt: now,
      })
    }

    const customers = new Map<
      string,
      {
        name: string
        phone: string
        ordersCount: number
        totalSpent: number
        lastOrderDate: Date
      }
    >()

    for (const order of paidOrders) {
      if (!order.created_at) continue

      const createdAt = new Date(order.created_at)
      if (Number.isNaN(createdAt.getTime())) continue

      const phone = normalizePhone(order.customer_phone)
      const name = normalizeText(order.customer_name)

      const key = phone || name.toLowerCase() || order.id

      const current =
        customers.get(key) ||
        {
          name: name || "Cliente sem nome",
          phone,
          ordersCount: 0,
          totalSpent: 0,
          lastOrderDate: createdAt,
        }

      current.ordersCount += 1
      current.totalSpent += getOrderTotal(order)

      if (createdAt > current.lastOrderDate) {
        current.lastOrderDate = createdAt
        current.name = name || current.name
        current.phone = phone || current.phone
      }

      customers.set(key, current)
    }

    const lostGoodCustomers = Array.from(customers.values()).filter((customer) => {
      const daysWithoutBuying = Math.abs(diffInDays(customer.lastOrderDate))

      return (
        daysWithoutBuying >= 30 &&
        customer.ordersCount >= 2 &&
        customer.totalSpent >= 100
      )
    })

    if (lostGoodCustomers.length > 0) {
      alerts.push({
        id: "clientes-bons-sumidos",
        category: "clientes",
        priority: "medium",
        title: "Clientes bons estão sumidos",
        description: `${lostGoodCustomers.length} cliente(s) que já compraram bem estão há mais de 30 dias sem voltar.`,
        metric: `${lostGoodCustomers.length} cliente(s)`,
        actionLabel: "Ver clientes",
        actionHref: "/financeiro/clientes-sumidos",
        createdAt: now,
      })
    }

    if (validOrders.length === 0) {
      alerts.push({
        id: "operacao-sem-pedidos",
        category: "operacao",
        priority: "low",
        title: "Ainda não há pedidos suficientes para análise",
        description:
          "Conforme os pedidos entrarem, esta aba vai gerar alertas mais inteligentes sobre vendas, clientes, estoque e financeiro.",
        metric: "Sem dados",
        actionLabel: "Ver pedidos",
        actionHref: "/pedidos",
        createdAt: now,
      })
    }

    return alerts.sort((a, b) => {
      return getPriorityWeight(b.priority) - getPriorityWeight(a.priority)
    })
  }, [orders, accountsPayable, stockItems, products, recipeItems])

  const visibleAlerts = useMemo(() => {
    return smartAlerts.filter((alert) => {
      if (dismissedAlerts.includes(alert.id)) return false

      const matchesCategory =
        categoryFilter === "all" || alert.category === categoryFilter

      const matchesPriority =
        priorityFilter === "all" || alert.priority === priorityFilter

      const search = searchTerm.toLowerCase()

      const matchesSearch =
        alert.title.toLowerCase().includes(search) ||
        alert.description.toLowerCase().includes(search) ||
        getCategoryLabel(alert.category).toLowerCase().includes(search)

      return matchesCategory && matchesPriority && matchesSearch
    })
  }, [smartAlerts, dismissedAlerts, categoryFilter, priorityFilter, searchTerm])

  const summary = useMemo(() => {
    const critical = smartAlerts.filter(
      (alert) => alert.priority === "critical",
    ).length

    const high = smartAlerts.filter((alert) => alert.priority === "high").length
    const medium = smartAlerts.filter(
      (alert) => alert.priority === "medium",
    ).length

    const active = smartAlerts.length - dismissedAlerts.length

    return {
      total: smartAlerts.length,
      active: Math.max(0, active),
      critical,
      high,
      medium,
      hidden: dismissedAlerts.length,
    }
  }, [smartAlerts, dismissedAlerts])

  function handleDismissAlert(alertId: string) {
    setDismissedAlerts((current) => {
      if (current.includes(alertId)) return current

      return [...current, alertId]
    })
  }

  const categoryOptions = [
    { value: "all", label: "Todas" },
    { value: "financeiro", label: "Financeiro" },
    { value: "estoque", label: "Estoque" },
    { value: "cardapio", label: "Cardápio" },
    { value: "vendas", label: "Vendas" },
    { value: "clientes", label: "Clientes" },
    { value: "operacao", label: "Operação" },
  ] as const

  const priorityOptions = [
    { value: "all", label: "Todas" },
    { value: "critical", label: "Críticas" },
    { value: "high", label: "Altas" },
    { value: "medium", label: "Médias" },
    { value: "low", label: "Baixas" },
  ] as const

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 text-purple-600">
                    <BellRing className="h-5 w-5" />
                  </div>

                  <div>
                    <h1 className="text-xl font-bold text-slate-950">
                      Alertas Inteligentes
                    </h1>
                    <p className="text-sm text-slate-500">
                      Sinais automáticos para agir antes do problema virar
                      prejuízo.
                    </p>
                  </div>
                </div>

                {restaurant?.name ? (
                  <p className="text-xs font-medium text-slate-400">
                    Restaurante: {restaurant.name}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {dismissedAlerts.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setDismissedAlerts([])}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Restaurar ocultos
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                  Atualizar
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <Loader2 className="h-7 w-7 animate-spin" />
                <p className="text-sm font-medium">
                  Carregando alertas inteligentes...
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 text-purple-600">
                      <BellRing className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-black text-purple-700">
                      Ativos
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    Alertas ativos
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {summary.active}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    Críticos
                  </p>
                  <p className="mt-1 text-2xl font-black text-red-600">
                    {summary.critical}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                    <Target className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    Alta prioridade
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {summary.high}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    Ocultados na sessão
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {summary.hidden}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-950">
                        Central de alertas
                      </h2>
                      <p className="text-sm text-slate-500">
                        Priorize os alertas críticos e depois resolva os de
                        maior impacto.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={searchTerm}
                          onChange={(event) =>
                            setSearchTerm(event.target.value)
                          }
                          placeholder="Buscar alerta..."
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 sm:w-64"
                        />
                      </div>

                      <select
                        value={categoryFilter}
                        onChange={(event) =>
                          setCategoryFilter(event.target.value as CategoryFilter)
                        }
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                      >
                        {categoryOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={priorityFilter}
                        onChange={(event) =>
                          setPriorityFilter(event.target.value as PriorityFilter)
                        }
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                      >
                        {priorityOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-5 lg:grid-cols-2">
                  {visibleAlerts.length > 0 ? (
                    visibleAlerts.map((alert) => {
                      const Icon = getAlertIcon(alert.category)

                      return (
                        <div
                          key={alert.id}
                          className={cn(
                            "rounded-3xl border bg-white p-4 shadow-sm transition hover:shadow-md",
                            alert.priority === "critical" &&
                              "border-red-200 bg-red-50/30",
                            alert.priority === "high" &&
                              "border-orange-200 bg-orange-50/30",
                            alert.priority === "medium" &&
                              "border-amber-200 bg-amber-50/20",
                            alert.priority === "low" &&
                              "border-slate-200 bg-white",
                          )}
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex min-w-0 gap-3">
                              <div
                                className={cn(
                                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                                  alert.priority === "critical" &&
                                    "bg-red-100 text-red-600",
                                  alert.priority === "high" &&
                                    "bg-orange-100 text-orange-600",
                                  alert.priority === "medium" &&
                                    "bg-amber-100 text-amber-600",
                                  alert.priority === "low" &&
                                    "bg-slate-100 text-slate-600",
                                )}
                              >
                                <Icon className="h-5 w-5" />
                              </div>

                              <div className="min-w-0">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  <span
                                    className={cn(
                                      "rounded-full px-2.5 py-1 text-xs font-black",
                                      alert.priority === "critical" &&
                                        "bg-red-100 text-red-700",
                                      alert.priority === "high" &&
                                        "bg-orange-100 text-orange-700",
                                      alert.priority === "medium" &&
                                        "bg-amber-100 text-amber-700",
                                      alert.priority === "low" &&
                                        "bg-slate-100 text-slate-600",
                                    )}
                                  >
                                    {getPriorityLabel(alert.priority)}
                                  </span>

                                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                                    {getCategoryLabel(alert.category)}
                                  </span>
                                </div>

                                <h3 className="text-base font-black text-slate-950">
                                  {alert.title}
                                </h3>

                                <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">
                                  {alert.description}
                                </p>
                              </div>
                            </div>

                            <div className="shrink-0 rounded-2xl bg-white px-3 py-2 text-right ring-1 ring-slate-200">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                Impacto
                              </p>
                              <p className="text-sm font-black text-slate-950">
                                {alert.metric}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-col gap-2 border-t border-slate-200/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <a
                              href={alert.actionHref}
                              className={cn(
                                "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white transition",
                                alert.priority === "critical" &&
                                  "bg-red-600 hover:bg-red-700",
                                alert.priority === "high" &&
                                  "bg-orange-600 hover:bg-orange-700",
                                alert.priority === "medium" &&
                                  "bg-amber-600 hover:bg-amber-700",
                                alert.priority === "low" &&
                                  "bg-slate-700 hover:bg-slate-800",
                              )}
                            >
                              {alert.actionLabel}
                            </a>

                            <button
                              type="button"
                              onClick={() => handleDismissAlert(alert.id)}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                              <EyeOff className="h-4 w-4" />
                              Ocultar
                            </button>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                      <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
                      <p className="mt-3 text-sm font-bold text-slate-700">
                        Nenhum alerta encontrado
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Ajuste os filtros ou restaure os alertas ocultados.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <p className="font-black text-slate-950">
                    Pedidos monitorados
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    A aba lê pedidos, pagamentos pendentes e variação de vendas.
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                    <Package className="h-5 w-5" />
                  </div>
                  <p className="font-black text-slate-950">
                    Estoque e ficha técnica
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Mostra insumo zerado, estoque baixo, produto sem ficha e
                    custo ausente.
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <p className="font-black text-slate-950">
                    Financeiro preventivo
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Contas vencidas e vencendo aparecem antes de bagunçar o
                    caixa.
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-800">
                <div className="flex gap-3">
                  <Percent className="mt-0.5 h-5 w-5 flex-none" />
                  <div>
                    <p className="font-black">Como usar essa aba</p>
                    <p className="mt-1 font-medium">
                      Trate essa tela como o “painel de problemas” do
                      restaurante. Primeiro resolva os alertas críticos, depois
                      os de alta prioridade. Ela não substitui análise humana,
                      mas ajuda o dono a enxergar o que normalmente passa
                      despercebido.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <div className="flex gap-3">
                  <Clock className="mt-0.5 h-5 w-5 flex-none" />
                  <div>
                    <p className="font-black">Observação</p>
                    <p className="mt-1 font-medium">
                      Os alertas ocultados somem apenas nesta sessão da tela.
                      Quando atualizar ou reabrir o sistema, os alertas podem
                      aparecer novamente se o problema continuar existindo.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}