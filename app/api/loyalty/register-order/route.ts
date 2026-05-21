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
    throw new Error("Variáveis públicas do Supabase não configuradas.")
  }

  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "").trim()

  if (!token) {
    throw new Error("Token de autenticação não enviado.")
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

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUserFromRequest(req)
    const body = await req.json()

    const orderId = String(body?.order_id || body?.orderId || "").trim()

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error: "ID do pedido não enviado.",
        },
        { status: 400 }
      )
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, restaurant_id, customer_name, customer_phone, total, status, payment_status"
      )
      .eq("id", orderId)
      .maybeSingle()

    if (orderError) {
      throw new Error(`Erro ao buscar pedido: ${orderError.message}`)
    }

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: "Pedido não encontrado.",
        },
        { status: 404 }
      )
    }

    const currentOrder = order as Order

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id, owner_id")
      .eq("id", currentOrder.restaurant_id)
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError) {
      throw new Error(`Erro ao validar restaurante: ${restaurantError.message}`)
    }

    if (!restaurant) {
      return NextResponse.json(
        {
          success: false,
          error: "Você não tem permissão para registrar fidelidade neste pedido.",
        },
        { status: 403 }
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
      throw new Error(`Erro ao buscar campanhas: ${campaignsError.message}`)
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
      throw new Error(
        `Erro ao buscar progresso do cliente: ${existingProgressError.message}`
      )
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
      throw new Error(
        `Erro ao verificar selo do pedido: ${existingStampError.message}`
      )
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

      throw new Error(`Erro ao registrar selo: ${insertStampError.message}`)
    }

    const { count: totalStamps, error: countStampsError } = await supabaseAdmin
      .from("loyalty_order_stamps")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", currentOrder.restaurant_id)
      .eq("campaign_id", validCampaign.id)
      .eq("customer_phone", customerPhone)

    if (countStampsError) {
      throw new Error(`Erro ao contar selos: ${countStampsError.message}`)
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
        throw new Error(
          `Erro ao atualizar progresso: ${updateProgressError.message}`
        )
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
        throw new Error(
          `Erro ao criar progresso: ${createProgressError.message}`
        )
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
    console.error("Erro ao registrar fidelidade:", error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao registrar fidelidade.",
      },
      { status: 500 }
    )
  }
}