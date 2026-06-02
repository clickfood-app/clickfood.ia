import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

function onlyDigits(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "")
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
    { status }
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const restaurantId = searchParams.get("restaurantId")?.trim()
    const customerPhone = onlyDigits(searchParams.get("customerPhone"))

    if (!restaurantId) {
      return jsonError("restaurantId é obrigatório.", 400)
    }

    if (!customerPhone) {
      return jsonError("customerPhone é obrigatório.", 400)
    }

    const { data: campaigns, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select(
        "id, name, description, status, campaign_type, reward_config, target_config, minimum_order_amount, starts_at, ends_at"
      )
      .eq("restaurant_id", restaurantId)
      .eq("campaign_type", "cashback")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5)

    if (campaignError) {
      console.error("Erro ao buscar campanha cashback pública:", {
        restaurantId,
        message: campaignError.message,
        code: campaignError.code,
      })

      return jsonError("Erro ao buscar cashback.", 500)
    }

    const activeCampaign = (campaigns || []).find(campaignIsInsidePeriod) ?? null

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("cashback_wallets")
      .select(
        "id, restaurant_id, customer_name, customer_phone, balance, total_earned, total_redeemed, created_at, updated_at"
      )
      .eq("restaurant_id", restaurantId)
      .eq("customer_phone", customerPhone)
      .maybeSingle()

    if (walletError) {
      console.error("Erro ao buscar carteira cashback pública:", {
        restaurantId,
        customerPhone,
        message: walletError.message,
        code: walletError.code,
      })

      return jsonError("Erro ao buscar saldo de cashback.", 500)
    }

    const rewardConfig = (activeCampaign?.reward_config || {}) as Record<string, unknown>
    const targetConfig = (activeCampaign?.target_config || {}) as Record<string, unknown>

    const balance = normalizeNumber(wallet?.balance, 0)
    const redeemAmount = normalizeNumber(
      rewardConfig.redeem_amount ?? rewardConfig.cashback_amount,
      0
    )
    const redeemMinimumOrderAmount = normalizeNumber(
      targetConfig.redeem_minimum_order_amount,
      0
    )

    return NextResponse.json({
      success: true,
      hasCampaign: Boolean(activeCampaign),
      campaign: activeCampaign
        ? {
            id: activeCampaign.id,
            name: activeCampaign.name,
            description: activeCampaign.description,
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
      canRedeem: Boolean(activeCampaign && wallet && balance > 0),
    })
  } catch (error) {
    console.error("GET /api/public/cashback/status error:", error)

    return jsonError("Erro inesperado ao buscar cashback.", 500)
  }
}