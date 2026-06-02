import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

type ConfirmReceivedBody = {
  restaurantId?: string
  orderId?: string
  rating?: number
  review?: string
}

type UpdatedOrder = {
  id: string
  restaurant_id: string
  public_order_number: string | null
  status: string | null
  payment_status: string | null
  subtotal: number | string | null
  total: number | string | null
  payment_method: string | null
  order_type: string | null
  delivery_fee: number | string | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_received_at: string | null
  customer_rating: number | null
  customer_review: string | null
  created_at: string | null
}

type CashbackCampaignRow = {
  id: string
  restaurant_id: string
  name: string | null
  status: string | null
  campaign_type: string | null
  reward_config: Record<string, unknown> | null
  target_config: Record<string, unknown> | null
  minimum_order_amount: number | string | null
  starts_at: string | null
  ends_at: string | null
}

type CashbackWalletRow = {
  id: string
  restaurant_id: string
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  balance: number | string | null
  total_earned: number | string | null
  total_redeemed: number | string | null
}

const MAX_REVIEW_LENGTH = 500

function cleanText(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function normalizeStatus(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function onlyDigits(value?: string | null) {
  return String(value || "").replace(/\D/g, "")
}

function toMoneyNumber(value: unknown, fallback = 0) {
  const number = Number(value)

  return Number.isFinite(number) ? number : fallback
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)

  return nextDate
}

function getOrderDisplayNumber(order: UpdatedOrder) {
  if (order.public_order_number) {
    return `#${order.public_order_number}`
  }

  return `#${order.id.slice(0, 8)}`
}

function buildRatingText(rating: number) {
  return `${rating} estrela${rating > 1 ? "s" : ""}`
}

function isCampaignInsidePeriod(campaign: CashbackCampaignRow) {
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

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  )
}

async function upsertRestaurantCustomer(order: UpdatedOrder) {
  const customerPhone = onlyDigits(order.customer_phone)

  if (!customerPhone) return null

  const { data, error } = await supabaseAdmin
    .from("restaurant_customers")
    .upsert(
      {
        restaurant_id: order.restaurant_id,
        name: order.customer_name?.trim() || "Cliente",
        phone: customerPhone,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "restaurant_id,phone",
      }
    )
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("Erro ao criar/atualizar cliente do restaurante:", {
      restaurantId: order.restaurant_id,
      customerPhone,
      message: error.message,
      code: error.code,
    })

    return null
  }

  return data
}

async function creditCashbackForOrder(order: UpdatedOrder) {
  const customerPhone = onlyDigits(order.customer_phone)

  if (!customerPhone) {
    return {
      credited: false,
      reason: "customer_phone_missing",
    }
  }

  const eligibleOrderAmount = toMoneyNumber(order.subtotal ?? order.total)

  if (eligibleOrderAmount <= 0) {
    return {
      credited: false,
      reason: "invalid_order_amount",
    }
  }

  await upsertRestaurantCustomer(order)

  const { data: campaigns, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .select(
      "id, restaurant_id, name, status, campaign_type, reward_config, target_config, minimum_order_amount, starts_at, ends_at"
    )
    .eq("restaurant_id", order.restaurant_id)
    .eq("campaign_type", "cashback")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(5)

  if (campaignError) {
    console.error("Erro ao buscar campanha de cashback:", {
      orderId: order.id,
      restaurantId: order.restaurant_id,
      message: campaignError.message,
      code: campaignError.code,
    })

    return {
      credited: false,
      reason: "campaign_query_failed",
    }
  }

  const activeCampaign = ((campaigns || []) as CashbackCampaignRow[]).find(
    isCampaignInsidePeriod
  )

  if (!activeCampaign) {
    return {
      credited: false,
      reason: "no_active_campaign",
    }
  }

  const rewardConfig = activeCampaign.reward_config || {}
  const targetConfig = activeCampaign.target_config || {}

  const cashbackAmount = toMoneyNumber(
    rewardConfig.cashback_amount ?? rewardConfig.redeem_amount
  )

  const earnMinimumOrderAmount = toMoneyNumber(
    targetConfig.earn_minimum_order_amount ?? activeCampaign.minimum_order_amount
  )

  const validityDays = toMoneyNumber(rewardConfig.validity_days)

  if (cashbackAmount <= 0) {
    return {
      credited: false,
      reason: "invalid_cashback_amount",
    }
  }

  if (eligibleOrderAmount < earnMinimumOrderAmount) {
    return {
      credited: false,
      reason: "order_below_minimum",
      eligibleOrderAmount,
      earnMinimumOrderAmount,
    }
  }

  const { data: currentWallet, error: walletSearchError } = await supabaseAdmin
    .from("cashback_wallets")
    .select(
      "id, restaurant_id, customer_id, customer_name, customer_phone, balance, total_earned, total_redeemed"
    )
    .eq("restaurant_id", order.restaurant_id)
    .eq("customer_phone", customerPhone)
    .maybeSingle()

  if (walletSearchError) {
    console.error("Erro ao buscar carteira de cashback:", {
      orderId: order.id,
      restaurantId: order.restaurant_id,
      customerPhone,
      message: walletSearchError.message,
      code: walletSearchError.code,
    })

    return {
      credited: false,
      reason: "wallet_query_failed",
    }
  }

  let wallet = currentWallet as CashbackWalletRow | null

  if (!wallet) {
    const { data: insertedWallet, error: insertWalletError } = await supabaseAdmin
      .from("cashback_wallets")
      .insert({
        restaurant_id: order.restaurant_id,
        customer_name: order.customer_name || "Cliente",
        customer_phone: customerPhone,
        balance: 0,
        total_earned: 0,
        total_redeemed: 0,
      })
      .select(
        "id, restaurant_id, customer_id, customer_name, customer_phone, balance, total_earned, total_redeemed"
      )
      .single()

    if (insertWalletError || !insertedWallet) {
      console.error("Erro ao criar carteira de cashback:", {
        orderId: order.id,
        restaurantId: order.restaurant_id,
        customerPhone,
        message: insertWalletError?.message,
        code: insertWalletError?.code,
      })

      return {
        credited: false,
        reason: "wallet_insert_failed",
      }
    }

    wallet = insertedWallet as CashbackWalletRow
  }

  const { data: existingCampaignTransaction, error: existingCampaignTransactionError } =
    await supabaseAdmin
      .from("cashback_transactions")
      .select("id")
      .eq("restaurant_id", order.restaurant_id)
      .eq("wallet_id", wallet.id)
      .eq("campaign_id", activeCampaign.id)
      .eq("type", "earned")
      .maybeSingle()

  if (existingCampaignTransactionError) {
    console.error("Erro ao verificar cashback já ganho nessa campanha:", {
      orderId: order.id,
      restaurantId: order.restaurant_id,
      walletId: wallet.id,
      campaignId: activeCampaign.id,
      message: existingCampaignTransactionError.message,
      code: existingCampaignTransactionError.code,
    })

    return {
      credited: false,
      reason: "campaign_transaction_check_failed",
    }
  }

  if (existingCampaignTransaction) {
    return {
      credited: false,
      reason: "campaign_already_credited_for_customer",
      walletId: wallet.id,
      campaignId: activeCampaign.id,
    }
  }

  const expiresAt =
    validityDays > 0 ? addDays(new Date(), validityDays).toISOString() : null

  const { data: insertedTransaction, error: transactionError } = await supabaseAdmin
    .from("cashback_transactions")
    .insert({
      restaurant_id: order.restaurant_id,
      wallet_id: wallet.id,
      customer_id: wallet.customer_id ?? null,
      order_id: order.id,
      campaign_id: activeCampaign.id,
      type: "earned",
      amount: cashbackAmount,
      description: `Cashback gerado pelo pedido ${getOrderDisplayNumber(order)}.`,
      expires_at: expiresAt,
    })
    .select("id")
    .single()

  if (transactionError || !insertedTransaction) {
    if (transactionError?.code === "23505") {
      return {
        credited: false,
        reason: "campaign_already_credited_for_customer",
        walletId: wallet.id,
        campaignId: activeCampaign.id,
      }
    }

    console.error("Erro ao criar transação de cashback:", {
      orderId: order.id,
      restaurantId: order.restaurant_id,
      walletId: wallet.id,
      campaignId: activeCampaign.id,
      message: transactionError?.message,
      code: transactionError?.code,
    })

    return {
      credited: false,
      reason: "transaction_insert_failed",
    }
  }

  const currentBalance = toMoneyNumber(wallet.balance)
  const currentTotalEarned = toMoneyNumber(wallet.total_earned)

  const { data: updatedWallet, error: updateWalletError } = await supabaseAdmin
    .from("cashback_wallets")
    .update({
      customer_name: order.customer_name || wallet.customer_name || "Cliente",
      balance: currentBalance + cashbackAmount,
      total_earned: currentTotalEarned + cashbackAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id)
    .eq("restaurant_id", order.restaurant_id)
    .select(
      "id, restaurant_id, customer_id, customer_name, customer_phone, balance, total_earned, total_redeemed"
    )
    .single()

  if (updateWalletError || !updatedWallet) {
    console.error("Erro ao atualizar carteira de cashback:", {
      orderId: order.id,
      restaurantId: order.restaurant_id,
      walletId: wallet.id,
      transactionId: insertedTransaction.id,
      message: updateWalletError?.message,
      code: updateWalletError?.code,
    })

    await supabaseAdmin
      .from("cashback_transactions")
      .delete()
      .eq("id", insertedTransaction.id)

    return {
      credited: false,
      reason: "wallet_update_failed",
    }
  }

  return {
    credited: true,
    amount: cashbackAmount,
    walletId: wallet.id,
    campaignId: activeCampaign.id,
  }
}

export async function POST(request: Request) {
  try {
    let body: ConfirmReceivedBody

    try {
      body = (await request.json()) as ConfirmReceivedBody
    } catch {
      return jsonError("Corpo da requisição inválido.", 400)
    }

    const restaurantId = cleanText(body.restaurantId, 80)
    const orderId = cleanText(body.orderId, 80)
    const rating = Number(body.rating)
    const review = cleanText(body.review, MAX_REVIEW_LENGTH) || null

    if (!restaurantId) {
      return jsonError("restaurantId é obrigatório.", 400)
    }

    if (!orderId) {
      return jsonError("orderId é obrigatório.", 400)
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return jsonError("A avaliação precisa ser uma nota de 1 a 5.", 400)
    }

    const { data: currentOrder, error: currentOrderError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, restaurant_id, public_order_number, status, payment_status, subtotal, total, payment_method, order_type, delivery_fee, customer_name, customer_phone, customer_received_at, customer_rating, customer_review, created_at"
      )
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle<UpdatedOrder>()

    if (currentOrderError) {
      console.error("Erro ao buscar pedido para avaliação pública:", {
        restaurantId,
        orderId,
        message: currentOrderError.message,
        code: currentOrderError.code,
      })

      return jsonError("Erro ao buscar pedido.", 500)
    }

    if (!currentOrder) {
      return jsonError("Pedido não encontrado.", 404)
    }

    const normalizedStatus = normalizeStatus(currentOrder.status)

    if (["cancelled", "canceled", "cancelado"].includes(normalizedStatus)) {
      return jsonError("Não é possível avaliar um pedido cancelado.", 400)
    }

    const receivedAt =
      currentOrder.customer_received_at || new Date().toISOString()

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .update({
        customer_received_at: receivedAt,
        customer_rating: rating,
        customer_review: review,
      })
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId)
      .select(
        "id, restaurant_id, public_order_number, status, payment_status, subtotal, total, payment_method, order_type, delivery_fee, customer_name, customer_phone, customer_received_at, customer_rating, customer_review, created_at"
      )
      .single<UpdatedOrder>()

    if (error || !order) {
      console.error("Erro ao salvar avaliação pública:", {
        restaurantId,
        orderId,
        message: error?.message,
        code: error?.code,
      })

      return jsonError("Erro ao salvar avaliação.", 500)
    }

    const cashbackResult = await creditCashbackForOrder(order)

    const orderNumber = getOrderDisplayNumber(order)
    const customerName = order.customer_name?.trim() || "Cliente"
    const ratingText = buildRatingText(rating)

    const notificationMessage = review
      ? `${customerName} avaliou o pedido ${orderNumber} com ${ratingText}: "${review}"`
      : `${customerName} avaliou o pedido ${orderNumber} com ${ratingText}.`

    const { error: notificationError } = await supabaseAdmin
      .from("restaurant_notifications")
      .insert({
        restaurant_id: restaurantId,
        type: "order_review",
        title: "Nova avaliação recebida",
        message: notificationMessage,
        is_read: false,
        metadata: {
          order_id: order.id,
          public_order_number: order.public_order_number,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          rating,
          review,
          cashback: cashbackResult,
        },
      })

    if (notificationError) {
      console.error("Erro ao criar notificação de avaliação:", {
        restaurantId,
        orderId,
        message: notificationError.message,
        code: notificationError.code,
      })
    }

    return NextResponse.json({
      success: true,
      order,
      notificationCreated: !notificationError,
      cashback: cashbackResult,
    })
  } catch (error) {
    console.error("POST /api/public/orders/confirm-received error:", error)

    return jsonError("Erro interno ao confirmar recebimento.", 500)
  }
}