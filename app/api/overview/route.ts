import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type PeriodKey = "30" | "90" | "120"

type OrderLike = {
  id?: string
  status?: string | null
  total?: number | string | null
  total_amount?: number | string | null
  final_amount?: number | string | null
  amount?: number | string | null
  subtotal?: number | string | null
  price?: number | string | null
  total_price?: number | string | null
  order_total?: number | string | null
  grand_total?: number | string | null
  created_at?: string | null
  customer_id?: string | null
  client_id?: string | null
  user_id?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  items?: any
  order_items?: any
}

type ProductAgg = {
  name: string
  quantity: number
  revenue: number
}

function getDateRange(period: PeriodKey) {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - Number(period))

  const previousStart = new Date(start)
  previousStart.setDate(start.getDate() - Number(period))

  return {
    now,
    start,
    previousStart,
  }
}

function percentVariation(current: number, previous: number) {
  if (!previous && !current) return 0
  if (!previous) return 100
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

function normalizeStatus(status: string | null | undefined) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function getOrderTotal(order: OrderLike) {
  return Number(
    order.total ??
      order.total_amount ??
      order.final_amount ??
      order.amount ??
      order.subtotal ??
      order.price ??
      order.total_price ??
      order.order_total ??
      order.grand_total ??
      0
  )
}

function getCustomerKey(order: OrderLike) {
  return (
    order.customer_id ||
    order.client_id ||
    order.user_id ||
    order.customer_phone ||
    order.customer_email ||
    order.customer_name ||
    null
  )
}

function safeArrayParse(value: any): any[] {
  if (Array.isArray(value)) return value

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return []
}

function extractOrderItems(order: OrderLike): any[] {
  const items = safeArrayParse(order.items)
  if (items.length > 0) return items

  const orderItems = safeArrayParse(order.order_items)
  if (orderItems.length > 0) return orderItems

  return []
}

function extractItemName(item: any) {
  return (
    item.name ||
    item.product_name ||
    item.title ||
    item.item_name ||
    item.nome ||
    "Produto"
  )
}

function extractItemQuantity(item: any) {
  return Number(item.quantity ?? item.qty ?? item.amount ?? 1)
}

function extractItemPrice(item: any) {
  return Number(
    item.price ??
      item.unit_price ??
      item.total_price ??
      item.total ??
      item.valor ??
      0
  )
}

function getDayLabel(dateString?: string | null) {
  if (!dateString) return "Sem data"

  const day = new Date(dateString).getDay()

  const labels = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ]

  return labels[day] || "Sem data"
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const rawPeriod = searchParams.get("period") || "30"

    const period: PeriodKey =
      rawPeriod === "90" || rawPeriod === "120" ? rawPeriod : "30"

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: "Usuário não autenticado" },
        { status: 401 }
      )
    }

    const { data: restaurants, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, name, owner_id")
      .eq("owner_id", user.id)
      .limit(1)

    if (restaurantError) {
      console.error("Erro ao buscar restaurante:", restaurantError)
      return NextResponse.json(
        { error: restaurantError.message },
        { status: 500 }
      )
    }

    if (!restaurants || restaurants.length === 0) {
      return NextResponse.json(
        {
          error: "Restaurante não encontrado",
          userId: user.id,
        },
        { status: 404 }
      )
    }

    const restaurant = restaurants[0]
    const { start, now, previousStart } = getDateRange(period)

    const startIso = start.toISOString()
    const nowIso = now.toISOString()
    const previousStartIso = previousStart.toISOString()

    const { data: currentOrders, error: currentOrdersError } = await supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .gte("created_at", startIso)
      .lte("created_at", nowIso)

    if (currentOrdersError) {
      console.error("Erro ao buscar pedidos atuais:", currentOrdersError)
      return NextResponse.json(
        { error: currentOrdersError.message },
        { status: 500 }
      )
    }

    const { data: previousOrders, error: previousOrdersError } = await supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .gte("created_at", previousStartIso)
      .lt("created_at", startIso)

    if (previousOrdersError) {
      console.error("Erro ao buscar pedidos anteriores:", previousOrdersError)
      return NextResponse.json(
        { error: previousOrdersError.message },
        { status: 500 }
      )
    }

    const current = (currentOrders || []) as OrderLike[]
    const previous = (previousOrders || []) as OrderLike[]

    const completedStatuses = [
      "concluido",
      "concluida",
      "completed",
      "entregue",
      "delivered",
      "finalizado",
      "finalizada",
      "finished",
      "done",
      "pago",
      "paid",
    ]

    const canceledStatuses = [
      "cancelado",
      "cancelada",
      "cancelled",
      "canceled",
    ]

    const inProgressStatuses = [
      "pendente",
      "pending",
      "em_preparo",
      "em preparo",
      "preparing",
      "saiu_para_entrega",
      "out_for_delivery",
      "em andamento",
      "processing",
      "aceito",
      "accepted",
      "recebido",
      "received",
      "novo",
      "new",
    ]

    const currentCompleted = current.filter((o) =>
      completedStatuses.includes(normalizeStatus(o.status))
    )

    const currentCanceled = current.filter((o) =>
      canceledStatuses.includes(normalizeStatus(o.status))
    )

    const currentInProgress = current.filter((o) =>
      inProgressStatuses.includes(normalizeStatus(o.status))
    )

    const previousCompleted = previous.filter((o) =>
      completedStatuses.includes(normalizeStatus(o.status))
    )

    const currentValidRevenueOrders = current.filter((o) => {
      const status = normalizeStatus(o.status)
      return !canceledStatuses.includes(status)
    })

    const previousValidRevenueOrders = previous.filter((o) => {
      const status = normalizeStatus(o.status)
      return !canceledStatuses.includes(status)
    })

    const faturamentoTotal = currentValidRevenueOrders.reduce(
      (sum, o) => sum + getOrderTotal(o),
      0
    )

    const faturamentoAnterior = previousValidRevenueOrders.reduce(
      (sum, o) => sum + getOrderTotal(o),
      0
    )

    const totalPedidos = current.length
    const pedidosAnteriores = previous.length

    const pedidosValidosAtuais = currentValidRevenueOrders.length
    const pedidosValidosAnteriores = previousValidRevenueOrders.length

    const ticketMedio =
      pedidosValidosAtuais > 0 ? faturamentoTotal / pedidosValidosAtuais : 0

    const ticketAnterior =
      pedidosValidosAnteriores > 0
        ? faturamentoAnterior / pedidosValidosAnteriores
        : 0

    const lucroEstimado = faturamentoTotal * 0.33
    const lucroAnterior = faturamentoAnterior * 0.33

    const currentCustomerSet = new Set(
      current.map(getCustomerKey).filter(Boolean) as string[]
    )

    const previousCustomerSet = new Set(
      previous.map(getCustomerKey).filter(Boolean) as string[]
    )

    const novosClientes = [...currentCustomerSet].filter(
      (customer) => !previousCustomerSet.has(customer)
    ).length

    const ativos = currentCustomerSet.size

    const inativos = [...previousCustomerSet].filter(
      (customer) => !currentCustomerSet.has(customer)
    ).length

    const clientesRecorrentes = [...currentCustomerSet].filter((customer) =>
      previousCustomerSet.has(customer)
    ).length

    const retencao =
      previousCustomerSet.size > 0
        ? Number(
            ((clientesRecorrentes / previousCustomerSet.size) * 100).toFixed(1)
          )
        : 0

    const previousPreviousCustomerSet = new Set<string>()
    const retencaoPrev = 0

    const orderCountByCustomer = new Map<string, number>()

    current.forEach((order) => {
      const customerKey = getCustomerKey(order)
      if (!customerKey) return

      orderCountByCustomer.set(
        customerKey,
        (orderCountByCustomer.get(customerKey) || 0) + 1
      )
    })

    const frequenciaMedia =
      orderCountByCustomer.size > 0
        ? Number(
            (
              [...orderCountByCustomer.values()].reduce((sum, count) => sum + count, 0) /
              orderCountByCustomer.size
            ).toFixed(1)
          )
        : 0

    const couponOrders = current.filter((o: any) => {
      return Boolean(
        o.coupon_code ||
          o.coupon ||
          o.discount_coupon ||
          o.cupom ||
          o.discount_amount
      )
    })

    const receitaCupons = couponOrders.reduce(
      (sum, order) => sum + getOrderTotal(order),
      0
    )

    const pctPedidosComCupom =
      totalPedidos > 0
        ? Number(((couponOrders.length / totalPedidos) * 100).toFixed(1))
        : 0

    const ticketComCupom =
      couponOrders.length > 0 ? receitaCupons / couponOrders.length : 0

    const nonCouponOrders = current.filter((o: any) => {
      return !(
        o.coupon_code ||
        o.coupon ||
        o.discount_coupon ||
        o.cupom ||
        o.discount_amount
      )
    })

    const receitaSemCupom = nonCouponOrders.reduce(
      (sum, order) => sum + getOrderTotal(order),
      0
    )

    const ticketSemCupom =
      nonCouponOrders.length > 0 ? receitaSemCupom / nonCouponOrders.length : 0

    const couponUsage = new Map<string, number>()

    couponOrders.forEach((order: any) => {
      const code =
        order.coupon_code ||
        order.coupon ||
        order.discount_coupon ||
        order.cupom

      if (!code) return

      couponUsage.set(String(code), (couponUsage.get(String(code)) || 0) + 1)
    })

    let cupomMaisUsado = "Sem dados"
    let maxCouponCount = 0

    couponUsage.forEach((count, coupon) => {
      if (count > maxCouponCount) {
        maxCouponCount = count
        cupomMaisUsado = coupon
      }
    })

    const productMap = new Map<string, ProductAgg>()

    currentValidRevenueOrders.forEach((order) => {
      const items = extractOrderItems(order)

      items.forEach((item) => {
        const name = extractItemName(item)
        const quantity = extractItemQuantity(item)
        const itemPrice = extractItemPrice(item)

        if (!productMap.has(name)) {
          productMap.set(name, {
            name,
            quantity: 0,
            revenue: 0,
          })
        }

        const product = productMap.get(name)!
        product.quantity += quantity
        product.revenue += itemPrice > 0 ? itemPrice : getOrderTotal(order)
      })
    })

    const topProducts = [...productMap.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
      .map((product) => ({
        name: product.name,
        sales: product.quantity,
        revenue: product.revenue,
      }))

    const dayMap = new Map<
      string,
      { day: string; pedidos: number; faturamento: number }
    >()

    const orderedDays = [
      "Domingo",
      "Segunda",
      "Terça",
      "Quarta",
      "Quinta",
      "Sexta",
      "Sábado",
    ]

    orderedDays.forEach((day) => {
      dayMap.set(day, {
        day,
        pedidos: 0,
        faturamento: 0,
      })
    })

    currentValidRevenueOrders.forEach((order) => {
      const day = getDayLabel(order.created_at)
      const bucket = dayMap.get(day)

      if (!bucket) return

      bucket.pedidos += 1
      bucket.faturamento += getOrderTotal(order)
    })

    const dayOfWeek = orderedDays.map((day) => ({
      day,
      pedidos: dayMap.get(day)?.pedidos || 0,
      faturamento: dayMap.get(day)?.faturamento || 0,
    }))

    const alerts: Array<{
      type: "success" | "warning" | "info"
      title: string
      description: string
    }> = []

    if (currentCanceled.length > 0 && totalPedidos > 0) {
      const cancelPct = (currentCanceled.length / totalPedidos) * 100
      if (cancelPct >= 15) {
        alerts.push({
          type: "warning",
          title: "Taxa de cancelamento alta",
          description: `Seu restaurante teve ${cancelPct.toFixed(1)}% de pedidos cancelados no período.`,
        })
      }
    }

    if (faturamentoTotal > faturamentoAnterior) {
      alerts.push({
        type: "success",
        title: "Faturamento em crescimento",
        description: "Seu faturamento está acima do período anterior.",
      })
    }

    if (novosClientes > 0) {
      alerts.push({
        type: "info",
        title: "Novos clientes entrando",
        description: `${novosClientes} novo(s) cliente(s) compraram no período.`,
      })
    }

    const weeklyGrowth = percentVariation(faturamentoTotal, faturamentoAnterior)

    const response = {
      kpis: {
        faturamentoTotal,
        faturamentoVar: percentVariation(faturamentoTotal, faturamentoAnterior),
        totalPedidos,
        pedidosVar: percentVariation(totalPedidos, pedidosAnteriores),
        ticketMedio,
        ticketVar: percentVariation(ticketMedio, ticketAnterior),
        lucroEstimado,
        lucroVar: percentVariation(lucroEstimado, lucroAnterior),
        novosClientes,
        novosClientesVar: 0,
      },
      orderStatus: {
        concluidos: currentCompleted.length,
        cancelados: currentCanceled.length,
        emAndamento: currentInProgress.length,
        prepTimeAvg: 25,
        prepTimePrev: 28,
      },
      clientAnalysis: {
        ativos,
        inativos,
        retencao,
        retencaoPrev,
        frequenciaMedia,
      },
      couponImpact: {
        receitaCupons,
        pctPedidosComCupom,
        ticketComCupom,
        ticketSemCupom,
        cupomMaisUsado,
      },
      topProducts,
      dayOfWeek,
      alerts,
      summary: `Visão geral em tempo real dos últimos ${period} dias.`,
      comparative: [
        {
          metric: "Faturamento",
          current: faturamentoTotal.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
          previous: faturamentoAnterior.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
          variation: percentVariation(faturamentoTotal, faturamentoAnterior),
        },
        {
          metric: "Pedidos",
          current: String(totalPedidos),
          previous: String(pedidosAnteriores),
          variation: percentVariation(totalPedidos, pedidosAnteriores),
        },
        {
          metric: "Ticket Médio",
          current: ticketMedio.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
          previous: ticketAnterior.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
          variation: percentVariation(ticketMedio, ticketAnterior),
        },
        {
          metric: "Lucro Estimado",
          current: lucroEstimado.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
          previous: lucroAnterior.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
          variation: percentVariation(lucroEstimado, lucroAnterior),
        },
      ],
      projection: {
        weeklyGrowth,
        faturamento30d: faturamentoTotal,
        pedidos30d: totalPedidos,
        ticketTrend:
          ticketMedio > ticketAnterior
            ? ("alta" as const)
            : ticketMedio < ticketAnterior
              ? ("baixa" as const)
              : ("estavel" as const),
      },
      heatmap: [],
      impactFactors: [],
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Erro em /api/overview:", error)
    return NextResponse.json(
      { error: "Erro interno ao carregar visão geral" },
      { status: 500 }
    )
  }
}