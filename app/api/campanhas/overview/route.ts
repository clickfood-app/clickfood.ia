import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { supabaseAdmin } from "@/lib/supabase-admin"

type AnyRow = Record<string, any>

const LOYALTY_CAMPAIGN_TABLES = [
  "loyalty_campaigns",
  "loyalty_card_campaigns",
  "fidelity_campaigns",
  "campaign_loyalty",
]

const LOYALTY_CUSTOMER_TABLES = [
  "customer_loyalties",
  "customer_loyalty_cards",
  "loyalty_cards",
  "loyalty_customers",
]

function getValue(row: AnyRow | null | undefined, keys: string[]) {
  if (!row) return null

  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key]
    }
  }

  return null
}

function getString(row: AnyRow | null | undefined, keys: string[], fallback = "") {
  const value = getValue(row, keys)
  return value === null ? fallback : String(value)
}

function getNumber(row: AnyRow | null | undefined, keys: string[], fallback = 0) {
  const value = getValue(row, keys)
  const number = Number(value)

  return Number.isFinite(number) ? number : fallback
}

function getBoolean(row: AnyRow | null | undefined, keys: string[], fallback = false) {
  const value = getValue(row, keys)

  if (typeof value === "boolean") return value

  if (typeof value === "string") {
    return ["true", "active", "ativo", "paid", "completed", "concluido"].includes(
      value.toLowerCase(),
    )
  }

  return fallback
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
}

function isActive(row: AnyRow) {
  const directActive = getValue(row, ["is_active", "active", "enabled"])

  if (typeof directActive === "boolean") {
    return directActive
  }

  const status = normalizeText(getValue(row, ["status", "state"]))

  if (!status) return true

  return ["active", "ativo", "enabled", "habilitado", "published"].includes(status)
}

function parseDate(value: unknown) {
  if (!value) return null

  const date = new Date(String(value))

  return Number.isNaN(date.getTime()) ? null : date
}

function isSameMonth(dateValue: unknown, monthStart: Date, nextMonthStart: Date) {
  const date = parseDate(dateValue)

  if (!date) return false

  return date >= monthStart && date < nextMonthStart
}

function formatDateBR(value: unknown) {
  const date = parseDate(value)

  if (!date) return "Sem data"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const map = new Map<string, T>()

  for (const item of items) {
    const key = getKey(item)

    if (key) {
      map.set(key, item)
    }
  }

  return Array.from(map.values())
}

async function getAuthenticatedUserFromRequest(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Variáveis públicas do Supabase não configuradas.")
  }

  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "")

  if (!token) {
    throw new Error("Token não enviado.")
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey)

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) {
    throw new Error("Usuário não autenticado.")
  }

  return user
}

async function getRowsFromFirstExistingTable(
  tableNames: string[],
  restaurantId: string,
) {
  for (const tableName of tableNames) {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select("*")
      .eq("restaurant_id", restaurantId)

    if (!error) {
      return {
        tableName,
        rows: data ?? [],
      }
    }
  }

  return {
    tableName: null,
    rows: [],
  }
}

function getLoyaltyRequiredOrders(campaign: AnyRow | null | undefined) {
  return getNumber(
    campaign,
    ["required_orders", "orders_required", "goal_orders", "target_orders"],
    10,
  )
}

function getLoyaltyRewardTitle(campaign: AnyRow | null | undefined) {
  return getString(
    campaign,
    [
      "reward_title",
      "reward_name",
      "reward_description",
      "reward",
      "prize",
      "title",
      "name",
    ],
    "Prêmio configurado",
  )
}

function isRewardRedeemed(row: AnyRow) {
  return getBoolean(row, ["reward_redeemed", "redeemed", "is_redeemed"], false)
}

function isRewardAvailable(row: AnyRow) {
  return getBoolean(row, ["reward_available", "available", "is_available"], false)
}

function getCurrentOrders(row: AnyRow) {
  return getNumber(row, ["current_orders", "orders_count", "total_orders"], 0)
}

function getCustomerKey(row: AnyRow) {
  return getString(row, ["customer_phone", "phone", "customer_id", "customer_name"])
}

function getOrderTotal(order: AnyRow) {
  return getNumber(order, ["total", "amount", "order_total"], 0)
}

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUserFromRequest(req)

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError) {
      throw new Error(`Erro ao buscar restaurante: ${restaurantError.message}`)
    }

    if (!restaurant) {
      return NextResponse.json(
        {
          success: false,
          message: "Restaurante não encontrado para este usuário.",
        },
        { status: 404 },
      )
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const inactiveLimit = new Date()
    inactiveLimit.setDate(inactiveLimit.getDate() - 15)

    const [loyaltyCampaignResult, loyaltyCustomersResult, ordersResult] =
      await Promise.all([
        getRowsFromFirstExistingTable(LOYALTY_CAMPAIGN_TABLES, restaurant.id),
        getRowsFromFirstExistingTable(LOYALTY_CUSTOMER_TABLES, restaurant.id),
        supabaseAdmin
          .from("orders")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false })
          .limit(2000),
      ])

    if (ordersResult.error) {
      throw new Error(`Erro ao buscar pedidos: ${ordersResult.error.message}`)
    }

    const loyaltyCampaigns = loyaltyCampaignResult.rows
    const loyaltyCustomers = loyaltyCustomersResult.rows
    const orders = ordersResult.data ?? []

    const activeLoyaltyCampaigns = loyaltyCampaigns.filter(isActive)
    const mainLoyaltyCampaign = activeLoyaltyCampaigns[0] ?? loyaltyCampaigns[0] ?? null

    const mainCampaignId = getString(mainLoyaltyCampaign, ["id"])
    const requiredOrders = getLoyaltyRequiredOrders(mainLoyaltyCampaign)

    const loyaltyParticipants = mainCampaignId
      ? loyaltyCustomers.filter(
          (item) =>
            getString(item, ["campaign_id", "loyalty_campaign_id"]) ===
            mainCampaignId,
        )
      : loyaltyCustomers

    const uniqueLoyaltyCustomers = uniqueBy(loyaltyCustomers, getCustomerKey)

    const pendingRewards = loyaltyParticipants.filter(
      (item) => isRewardAvailable(item) && !isRewardRedeemed(item),
    )

    const redeemedRewards = loyaltyParticipants.filter(isRewardRedeemed)

    const monthlyRedeemedRewards = loyaltyParticipants.filter((item) => {
      const redeemed = isRewardRedeemed(item)

      const date =
        getValue(item, ["redeemed_at", "updated_at", "created_at"]) ??
        getValue(item, ["last_order_at"])

      return redeemed && isSameMonth(date, monthStart, nextMonthStart)
    })

    const completedGoals = loyaltyParticipants.filter((item) => {
      return (
        getCurrentOrders(item) >= requiredOrders ||
        isRewardAvailable(item) ||
        isRewardRedeemed(item)
      )
    })

    const loyaltyProgress =
      loyaltyParticipants.length > 0
        ? Math.round((completedGoals.length / loyaltyParticipants.length) * 100)
        : 0

    const customersCloseToComplete = loyaltyParticipants.filter((item) => {
      const currentOrders = getCurrentOrders(item)

      return (
        currentOrders >= Math.max(requiredOrders - 2, 1) &&
        currentOrders < requiredOrders
      )
    })

    const paidOrDeliveredOrders = orders.filter((order) => {
      const status = normalizeText(order.status)
      const paymentStatus = normalizeText(order.payment_status)

      return (
        ["paid", "pago"].includes(paymentStatus) ||
        ["delivered", "completed", "concluido", "entregue"].includes(status)
      )
    })

    const monthOrders = orders.filter((order) =>
      isSameMonth(order.created_at, monthStart, nextMonthStart),
    )

    const customersByPhone = new Map<string, AnyRow[]>()

    for (const order of orders) {
      const phone = getString(order, ["customer_phone", "phone"])

      if (!phone) continue

      const current = customersByPhone.get(phone) ?? []
      current.push(order)
      customersByPhone.set(phone, current)
    }

    const inactiveCustomers = Array.from(customersByPhone.values()).filter(
      (customerOrders) => {
        const lastOrder = customerOrders
          .map((order) => parseDate(order.created_at))
          .filter(Boolean)
          .sort((a, b) => Number(b) - Number(a))[0]

        return lastOrder ? lastOrder < inactiveLimit : false
      },
    )

    const recentCampaigns = loyaltyCampaigns.slice(0, 5).map((campaign) => ({
      id: getString(campaign, ["id"]),
      name: getString(campaign, ["name", "title"], "Card Fidelidade"),
      description: getLoyaltyRewardTitle(campaign),
      type: "Card Fidelidade",
      impact: `${loyaltyParticipants.length} participantes`,
      secondaryImpact: `${loyaltyProgress}% das metas`,
      status: isActive(campaign) ? "Ativa" : "Concluída",
      period: `${formatDateBR(
        getValue(campaign, ["starts_at", "start_date", "created_at"]),
      )} - ${formatDateBR(
        getValue(campaign, ["ends_at", "end_date", "valid_until"]),
      )}`,
      createdAt: getString(campaign, ["created_at"]),
    }))

    return NextResponse.json({
      success: true,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
      },
      debug: {
        loyaltyCampaignTable: loyaltyCampaignResult.tableName,
        loyaltyCustomerTable: loyaltyCustomersResult.tableName,
      },
      summary: {
        activeCampaigns: activeLoyaltyCampaigns.length,
        fidelizedCustomers: uniqueLoyaltyCustomers.length,
        monthlyRedemptions: monthlyRedeemedRewards.length,
      },
      cardFidelidade: {
        hasCampaign: Boolean(mainLoyaltyCampaign),
        campaignId: mainCampaignId,
        title: getString(mainLoyaltyCampaign, ["name", "title"], "Card Fidelidade"),
        rewardTitle: getLoyaltyRewardTitle(mainLoyaltyCampaign),
        requiredOrders,
        isActive: mainLoyaltyCampaign ? isActive(mainLoyaltyCampaign) : false,
        participants: loyaltyParticipants.length,
        pendingRewards: pendingRewards.length,
        redeemedRewards: redeemedRewards.length,
        completedGoals: completedGoals.length,
        progress: loyaltyProgress,
        customersCloseToComplete: customersCloseToComplete.length,
      },
      insights: {
        customersCloseToComplete: customersCloseToComplete.length,
        inactiveCustomers: inactiveCustomers.length,
      },
      recentCampaigns,
      totals: {
        orders: orders.length,
        monthOrders: monthOrders.length,
        paidOrDeliveredOrders: paidOrDeliveredOrders.length,
        revenue: paidOrDeliveredOrders.reduce(
          (total, order) => total + getOrderTotal(order),
          0,
        ),
      },
    })
  } catch (error) {
    console.error("Erro na visão geral de campanhas:", error)

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao carregar visão geral de campanhas.",
      },
      { status: 500 },
    )
  }
}