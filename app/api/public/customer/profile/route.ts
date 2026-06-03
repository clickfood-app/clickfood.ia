import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
}

const ACTIVE_ORDER_STATUSES = [
  "awaiting_payment",
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
]

function onlyDigits(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "")
}

function cleanText(value: string | null | undefined, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength)
}

function normalizeNumber(value: unknown, fallback = 0) {
  const number = Number(value)

  return Number.isFinite(number) ? number : fallback
}

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    }
  )
}

function campaignIsInsidePeriod(campaign: {
  starts_at?: string | null
  ends_at?: string | null
}) {
  const now = new Date()

  if (campaign.starts_at) {
    const startsAt = new Date(campaign.starts_at)

    if (!Number.isNaN(startsAt.getTime()) && startsAt > now) {
      return false
    }
  }

  if (campaign.ends_at) {
    const endsAt = new Date(campaign.ends_at)

    if (!Number.isNaN(endsAt.getTime()) && endsAt < now) {
      return false
    }
  }

  return true
}

function normalizeOrderItem(item: {
  id?: string | null
  product_id?: string | null
  product_name?: string | null
  quantity?: number | null
  unit_price?: number | string | null
  total_price?: number | string | null
  notes?: string | null
  modifiers?: unknown
}) {
  return {
    id: item.id ?? null,
    product_id: item.product_id ?? null,
    name: item.product_name ?? null,
    product_name: item.product_name ?? null,
    quantity: Number(item.quantity ?? 0),
    price: item.unit_price ?? 0,
    unit_price: item.unit_price ?? 0,
    total_price: item.total_price ?? 0,
    notes: item.notes ?? null,
    modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
  }
}

function normalizeOrder(order: {
  id: string
  restaurant_id?: string | null
  public_order_number?: string | null
  status?: string | null
  payment_status?: string | null
  total?: number | string | null
  payment_method?: string | null
  order_type?: string | null
  delivery_fee?: number | string | null
  service_fee?: number | string | null
  customer_received_at?: string | null
  customer_rating?: number | null
  customer_review?: string | null
  created_at?: string | null
  order_items?: Array<{
    id?: string | null
    product_id?: string | null
    product_name?: string | null
    quantity?: number | null
    unit_price?: number | string | null
    total_price?: number | string | null
    notes?: string | null
    modifiers?: unknown
  }> | null
}) {
  return {
    id: order.id,
    restaurant_id: order.restaurant_id ?? null,
    public_order_number: order.public_order_number ?? null,
    status: order.status ?? null,
    payment_status: order.payment_status ?? null,
    total: order.total ?? 0,
    payment_method: order.payment_method ?? null,
    order_type: order.order_type ?? null,
    delivery_fee: order.delivery_fee ?? 0,
    service_fee: order.service_fee ?? 0,
    customer_received_at: order.customer_received_at ?? null,
    customer_rating: order.customer_rating ?? null,
    customer_review: order.customer_review ?? null,
    created_at: order.created_at ?? null,
    items: (order.order_items || []).map(normalizeOrderItem),
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const restaurantId = cleanText(searchParams.get("restaurantId"), 80)
    const customerPhone = onlyDigits(searchParams.get("customerPhone"))

    if (!restaurantId) {
      return jsonError("restaurantId é obrigatório.", 400)
    }

    if (!customerPhone) {
      return jsonError("customerPhone é obrigatório.", 400)
    }

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id, is_active")
      .eq("id", restaurantId)
      .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao validar restaurante no perfil público:", {
        restaurantId,
        message: restaurantError.message,
        code: restaurantError.code,
      })

      return jsonError("Erro ao validar restaurante.", 500)
    }

    if (!restaurant || restaurant.is_active === false) {
      return jsonError("Restaurante não encontrado ou inativo.", 404)
    }

    const { data: customer, error: customerError } = await supabaseAdmin
      .from("restaurant_customers")
      .select("id, restaurant_id, name, phone, document, last_address, last_neighborhood")
      .eq("restaurant_id", restaurantId)
      .eq("phone", customerPhone)
      .maybeSingle()

    if (customerError) {
      console.error("Erro ao buscar cliente no perfil público:", {
        restaurantId,
        customerPhone,
        message: customerError.message,
        code: customerError.code,
      })

      return jsonError("Erro ao buscar cliente.", 500)
    }

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(
        `
          id,
          restaurant_id,
          public_order_number,
          status,
          payment_status,
          total,
          payment_method,
          order_type,
          delivery_fee,
          service_fee,
          customer_received_at,
          customer_rating,
          customer_review,
          created_at,
          order_items (
            id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total_price,
            notes,
            modifiers
          )
        `
      )
      .eq("restaurant_id", restaurantId)
      .eq("customer_phone", customerPhone)
      .order("created_at", { ascending: false })
      .limit(20)

    if (ordersError) {
      console.error("Erro ao buscar histórico público do cliente:", {
        restaurantId,
        customerPhone,
        message: ordersError.message,
        code: ordersError.code,
      })

      return jsonError("Erro ao buscar histórico de pedidos.", 500)
    }

    const normalizedOrders = (orders || []).map(normalizeOrder)

    const activeOrder =
      normalizedOrders.find(
        (order) =>
          !order.customer_received_at &&
          ACTIVE_ORDER_STATUSES.includes(String(order.status || ""))
      ) ?? null

    const { data: cashbackCampaigns, error: cashbackCampaignError } =
      await supabaseAdmin
        .from("campaigns")
        .select(
          "id, name, description, status, campaign_type, reward_config, target_config, minimum_order_amount, starts_at, ends_at"
        )
        .eq("restaurant_id", restaurantId)
        .eq("campaign_type", "cashback")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(5)

    if (cashbackCampaignError) {
      console.error("Erro ao buscar campanha de cashback no perfil público:", {
        restaurantId,
        message: cashbackCampaignError.message,
        code: cashbackCampaignError.code,
      })

      return jsonError("Erro ao buscar cashback.", 500)
    }

    const activeCashbackCampaign =
      (cashbackCampaigns || []).find(campaignIsInsidePeriod) ?? null

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("cashback_wallets")
      .select(
        "id, restaurant_id, customer_name, customer_phone, balance, total_earned, total_redeemed, created_at, updated_at"
      )
      .eq("restaurant_id", restaurantId)
      .eq("customer_phone", customerPhone)
      .maybeSingle()

    if (walletError) {
      console.error("Erro ao buscar carteira de cashback no perfil público:", {
        restaurantId,
        customerPhone,
        message: walletError.message,
        code: walletError.code,
      })

      return jsonError("Erro ao buscar saldo de cashback.", 500)
    }

    const rewardConfig = (activeCashbackCampaign?.reward_config || {}) as Record<
      string,
      unknown
    >
    const targetConfig = (activeCashbackCampaign?.target_config || {}) as Record<
      string,
      unknown
    >

    const balance = normalizeNumber(wallet?.balance, 0)
    const redeemAmount = normalizeNumber(
      rewardConfig.redeem_amount ?? rewardConfig.cashback_amount,
      0
    )
    const redeemMinimumOrderAmount = normalizeNumber(
      targetConfig.redeem_minimum_order_amount,
      0
    )

    const cashback = {
      hasCampaign: Boolean(activeCashbackCampaign),
      campaign: activeCashbackCampaign
        ? {
            id: activeCashbackCampaign.id,
            name: activeCashbackCampaign.name,
            description: activeCashbackCampaign.description,
            redeemAmount,
            redeemMinimumOrderAmount,
          }
        : null,
      wallet: wallet
        ? {
            id: wallet.id,
            balance,
            totalEarned: normalizeNumber(wallet.total_earned, 0),
            totalRedeemed: normalizeNumber(wallet.total_redeemed, 0),
            customerName: wallet.customer_name,
            customerPhone: wallet.customer_phone,
          }
        : null,
      canRedeem: Boolean(activeCashbackCampaign && wallet && balance > 0),
    }

    return NextResponse.json(
      {
        success: true,
        customer: customer
          ? {
              id: customer.id,
              restaurantId: customer.restaurant_id,
              name: customer.name,
              phone: customer.phone,
              document: customer.document,
              lastAddress: customer.last_address,
              lastNeighborhood: customer.last_neighborhood,
            }
          : null,
        cashback,
        activeOrder,
        orders: normalizedOrders,
      },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      }
    )
  } catch (error) {
    console.error("GET /api/public/customer/profile error:", error)

    return jsonError("Erro inesperado ao buscar perfil do cliente.", 500)
  }
}