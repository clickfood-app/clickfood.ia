import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

type ClickPromoCampaignRow = {
  id: string
  name: string | null
  description: string | null
  total_balance: number | string | null
  used_balance: number | string | null
  discount_type: string | null
  discount_value: number | string | null
  minimum_order: number | string | null
  customer_usage_limit: number | string | null
  valid_until: string | null
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value
  if (!value) return 0

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function onlyDigits(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "")
}

function calculateDiscount(campaign: ClickPromoCampaignRow, subtotal: number) {
  const discountType = campaign.discount_type === "percentage" ? "percentage" : "fixed"
  const discountValue = toNumber(campaign.discount_value)
  const totalBalance = toNumber(campaign.total_balance)
  const usedBalance = toNumber(campaign.used_balance)
  const availableBalance = Math.max(totalBalance - usedBalance, 0)

  if (availableBalance <= 0 || discountValue <= 0 || subtotal <= 0) {
    return 0
  }

  const rawDiscount =
    discountType === "percentage"
      ? subtotal * (discountValue / 100)
      : discountValue

  return Math.max(0, Math.min(rawDiscount, subtotal, availableBalance))
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const restaurantId = String(body.restaurantId || "").trim()
    const subtotal = toNumber(body.subtotal)
    const customerPhone = onlyDigits(body.customerPhone)

    if (!restaurantId) {
      return NextResponse.json(
        { success: false, error: "Restaurante não informado." },
        { status: 400 },
      )
    }

    if (subtotal <= 0) {
      return NextResponse.json({
        success: true,
        eligible: false,
        offer: null,
      })
    }

    const today = new Date().toISOString().slice(0, 10)

    const { data: campaignsData, error: campaignsError } = await supabaseAdmin
      .from("promotional_balance_campaigns")
      .select(
        `
          id,
          name,
          description,
          total_balance,
          used_balance,
          discount_type,
          discount_value,
          minimum_order,
          customer_usage_limit,
          valid_until
        `,
      )
      .eq("restaurant_id", restaurantId)
      .eq("status", "active")
      .eq("source_type", "clickfood")
      .or(`valid_until.is.null,valid_until.gte.${today}`)
      .order("created_at", { ascending: false })

    if (campaignsError) {
      throw campaignsError
    }

    const campaigns = (campaignsData ?? []) as ClickPromoCampaignRow[]

    for (const campaign of campaigns) {
      const minimumOrder = toNumber(campaign.minimum_order)

      if (minimumOrder > 0 && subtotal < minimumOrder) {
        continue
      }

      const customerUsageLimit = toNumber(campaign.customer_usage_limit)

      if (customerPhone && customerUsageLimit > 0) {
        const { count, error: usageError } = await supabaseAdmin
          .from("promotional_balance_usages")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
          .eq("customer_phone", customerPhone)

        if (usageError) {
          throw usageError
        }

        if ((count ?? 0) >= customerUsageLimit) {
          continue
        }
      }

      const discountAmount = calculateDiscount(campaign, subtotal)

      if (discountAmount <= 0) {
        continue
      }

      const totalBalance = toNumber(campaign.total_balance)
      const usedBalance = toNumber(campaign.used_balance)
      const availableBalance = Math.max(totalBalance - usedBalance, 0)

      return NextResponse.json({
        success: true,
        eligible: true,
        offer: {
          campaignId: campaign.id,
          name: campaign.name || "ClickPromo",
          description:
            campaign.description ||
            "Benefício automático liberado pela ClickFood.",
          discountAmount,
          minimumOrder,
          availableBalance,
        },
      })
    }

    return NextResponse.json({
      success: true,
      eligible: false,
      offer: null,
    })
  } catch (error) {
    console.error("Erro ao consultar ClickPromo:", error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao consultar ClickPromo.",
      },
      { status: 500 },
    )
  }
}