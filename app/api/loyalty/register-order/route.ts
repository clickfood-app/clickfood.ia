import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { supabaseAdmin } from "@/lib/supabase-admin"

type LoyaltyCampaign = {
  id: string
  restaurant_id: string
  title: string
  required_orders: number
  minimum_order_amount: number | null
  reward_description: string
  reward_type: string
  reward_value: number | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at: string
}

type Order = {
  id: string
  restaurant_id: string
  customer_name: string | null
  customer_phone: string | null
  total: number | null
  status: string | null
  payment_status: string | null
}

const FINAL_ORDER_STATUSES = [
  "delivered",
  "completed",
  "finished",
  "finalized",
  "done",
  "entregue",
  "finalizado",
]

function normalizePhone(phone: string | null | undefined) {
  return String(phone || "").replace(/\D/g, "")
}

function isCampaignInsideDateRange(campaign: LoyaltyCampaign) {
  const now = new Date()

  if (campaign.starts_at) {
    const startsAt = new Date(campaign.starts_at)
    startsAt.setHours(0, 0, 0, 0)

    if (startsAt > now) {
      return false
    }
  }

  if (campaign.ends_at) {
    const endsAt = new Date(campaign.ends_at)
    endsAt.setHours(23, 59, 59, 999)

    if (endsAt < now) {
      return false
    }
  }

  return true
}

async function getAuthenticatedUserFromRequest(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("supabase_config_missing")
  }

  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim()

  if (!token) {
    throw new Error("unauthorized")
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) {
    throw new Error("unauthorized")
  }

  return user
}

function cleanText(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
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

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUserFromRequest(req)

    let body: Record<string, unknown>

    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return jsonError("Corpo da requisição inválido.", 400)
    }

    const orderId = cleanText(body.order_id || body.orderId, 80)

    if (!orderId) {
      return jsonError("ID do pedido não enviado.", 400)
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, restaurant_id, customer_name, customer_phone, total, status, payment_status"
      )
      .eq("id", orderId)
      .maybeSingle()

    if (orderError) {
      console.error("Erro ao buscar pedido para registrar fidelidade:", {
        orderId,
        message: orderError.message,
        code: orderError.code,
      })

      return jsonError("Erro ao buscar pedido.", 500)
    }

    if (!order) {
      return jsonError("Pedido não encontrado.", 404)
    }

    const currentOrder = order as Order

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id, owner_id")
      .eq("id", currentOrder.restaurant_id)
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao validar restaurante para fidelidade:", {
        orderId,
        restaurantId: currentOrder.restaurant_id,
        userId: user.id,
        message: restaurantError.message,
        code: restaurantError.code,
      })

      return jsonError("Erro ao validar restaurante.", 500)
    }

    if (!restaurant) {
      return jsonError(
        "Você não tem permissão para registrar fidelidade neste pedido.",
        403
      )
    }

    const orderStatus = String(currentOrder.status || "").toLowerCase()

    if (!FINAL_ORDER_STATUSES.includes(orderStatus)) {
      return NextResponse.json(
        {
          success: false,
          registered: false,
          reason: "O pedido ainda não está finalizado/entregue.",
          order_status: currentOrder.status,
        },
        { status: 400 }
      )
    }

    const customerPhone = normalizePhone(currentOrder.customer_phone)

    if (!customerPhone) {
      return NextResponse.json({
        success: true,
        registered: false,
        reason: "Pedido sem telefone do cliente. Fidelidade não registrada.",
      })
    }

    const orderTotal = Number(currentOrder.total || 0)

    const { data: campaigns, error: campaignsError } = await supabaseAdmin
      .from("loyalty_campaigns")
      .select(
        "id, restaurant_id, title, required_orders, minimum_order_amount, reward_description, reward_type, reward_value, is_active, starts_at, ends_at, created_at"
      )
      .eq("restaurant_id", currentOrder.restaurant_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (campaignsError) {
      console.error("Erro ao buscar campanhas de fidelidade:", {
        restaurantId: currentOrder.restaurant_id,
        orderId,
        message: campaignsError.message,
        code: campaignsError.code,
      })

      return jsonError("Erro ao buscar campanhas de fidelidade.", 500)
    }

    const validCampaign = ((campaigns || []) as LoyaltyCampaign[]).find(
      (campaign) => {
        const minimumOrderAmount = Number(campaign.minimum_order_amount || 0)

        return (
          isCampaignInsideDateRange(campaign) &&
          orderTotal >= minimumOrderAmount
        )
      }
    )

    if (!validCampaign) {
      return NextResponse.json({
        success: true,
        registered: false,
        reason:
          "Nenhuma campanha ativa encontrada ou pedido abaixo do valor mínimo.",
      })
    }

    const requiredOrders = Number(validCampaign.required_orders || 10)

    const { data: existingProgress, error: existingProgressError } =
      await supabaseAdmin
        .from("loyalty_customer_progress")
        .select("*")
        .eq("restaurant_id", currentOrder.restaurant_id)
        .eq("campaign_id", validCampaign.id)
        .eq("customer_phone", customerPhone)
        .maybeSingle()

    if (existingProgressError) {
      console.error("Erro ao buscar progresso de fidelidade:", {
        restaurantId: currentOrder.restaurant_id,
        campaignId: validCampaign.id,
        customerPhone,
        message: existingProgressError.message,
        code: existingProgressError.code,
      })

      return jsonError("Erro ao buscar progresso do cliente.", 500)
    }

    if (
      existingProgress?.reward_available === true &&
      existingProgress?.reward_redeemed === false
    ) {
      return NextResponse.json({
        success: true,
        registered: false,
        already_completed: true,
        reason: "Cliente já completou o card e possui recompensa disponível.",
        campaign: validCampaign,
        progress: existingProgress,
      })
    }

    const { data: existingStamp, error: existingStampError } = await supabaseAdmin
      .from("loyalty_order_stamps")
      .select("id")
      .eq("campaign_id", validCampaign.id)
      .eq("order_id", currentOrder.id)
      .maybeSingle()

    if (existingStampError) {
      console.error("Erro ao verificar selo existente:", {
        restaurantId: currentOrder.restaurant_id,
        campaignId: validCampaign.id,
        orderId: currentOrder.id,
        message: existingStampError.message,
        code: existingStampError.code,
      })

      return jsonError("Erro ao verificar selo do pedido.", 500)
    }

    if (existingStamp) {
      return NextResponse.json({
        success: true,
        registered: false,
        already_registered: true,
        reason: "Este pedido já foi contabilizado no card fidelidade.",
        campaign: validCampaign,
        progress: existingProgress || null,
      })
    }

    const { data: insertedStamp, error: insertStampError } = await supabaseAdmin
      .from("loyalty_order_stamps")
      .insert({
        restaurant_id: currentOrder.restaurant_id,
        campaign_id: validCampaign.id,
        order_id: currentOrder.id,
        customer_phone: customerPhone,
        stamp_number: 1,
      })
      .select("id")
      .single()

    if (insertStampError) {
      if (insertStampError.code === "23505") {
        return NextResponse.json({
          success: true,
          registered: false,
          already_registered: true,
          reason: "Este pedido já foi contabilizado no card fidelidade.",
          campaign: validCampaign,
          progress: existingProgress || null,
        })
      }

      console.error("Erro ao registrar selo:", {
        restaurantId: currentOrder.restaurant_id,
        campaignId: validCampaign.id,
        orderId: currentOrder.id,
        message: insertStampError.message,
        code: insertStampError.code,
      })

      return jsonError("Erro ao registrar selo.", 500)
    }

    const { count: totalStamps, error: countStampsError } = await supabaseAdmin
      .from("loyalty_order_stamps")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", currentOrder.restaurant_id)
      .eq("campaign_id", validCampaign.id)
      .eq("customer_phone", customerPhone)

    if (countStampsError) {
      console.error("Erro ao contar selos:", {
        restaurantId: currentOrder.restaurant_id,
        campaignId: validCampaign.id,
        customerPhone,
        message: countStampsError.message,
        code: countStampsError.code,
      })

      return jsonError("Erro ao contar selos.", 500)
    }

    const currentOrders = Math.min(Number(totalStamps || 1), requiredOrders)
    const rewardAvailable = currentOrders >= requiredOrders

    await supabaseAdmin
      .from("loyalty_order_stamps")
      .update({
        stamp_number: currentOrders,
      })
      .eq("id", insertedStamp.id)

    let progress = null

    if (existingProgress) {
      const { data: updatedProgress, error: updateProgressError } =
        await supabaseAdmin
          .from("loyalty_customer_progress")
          .update({
            customer_name: currentOrder.customer_name,
            current_orders: currentOrders,
            required_orders: requiredOrders,
            reward_available: rewardAvailable,
            last_order_id: currentOrder.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingProgress.id)
          .select("*")
          .single()

      if (updateProgressError) {
        console.error("Erro ao atualizar progresso:", {
          restaurantId: currentOrder.restaurant_id,
          campaignId: validCampaign.id,
          customerPhone,
          message: updateProgressError.message,
          code: updateProgressError.code,
        })

        return jsonError("Erro ao atualizar progresso.", 500)
      }

      progress = updatedProgress
    } else {
      const { data: createdProgress, error: createProgressError } =
        await supabaseAdmin
          .from("loyalty_customer_progress")
          .insert({
            restaurant_id: currentOrder.restaurant_id,
            campaign_id: validCampaign.id,
            customer_phone: customerPhone,
            customer_name: currentOrder.customer_name,
            current_orders: currentOrders,
            required_orders: requiredOrders,
            reward_available: rewardAvailable,
            reward_redeemed: false,
            last_order_id: currentOrder.id,
          })
          .select("*")
          .single()

      if (createProgressError) {
        console.error("Erro ao criar progresso:", {
          restaurantId: currentOrder.restaurant_id,
          campaignId: validCampaign.id,
          customerPhone,
          message: createProgressError.message,
          code: createProgressError.code,
        })

        return jsonError("Erro ao criar progresso.", 500)
      }

      progress = createdProgress
    }

    return NextResponse.json({
      success: true,
      registered: true,
      reward_available: rewardAvailable,
      campaign: validCampaign,
      progress,
    })
  } catch (error) {
    console.error("POST /api/loyalty/register-order error:", error)

    if (error instanceof Error && error.message === "unauthorized") {
      return jsonError("Não autorizado.", 401)
    }

    return jsonError("Erro inesperado ao registrar fidelidade.", 500)
  }
}