import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

function onlyDigits(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "")
}

function cleanText(value: string | null | undefined, maxLength = 120) {
  return (value || "").trim().slice(0, maxLength)
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const restaurantId = cleanText(searchParams.get("restaurantId"), 80)
    const orderId = cleanText(searchParams.get("orderId"), 80)
    const customerPhoneFromUrl = onlyDigits(searchParams.get("customerPhone"))

    if (!restaurantId) {
      return jsonError("ID do restaurante não enviado.", 400)
    }

    if (!orderId && !customerPhoneFromUrl) {
      return jsonError("ID do pedido ou telefone do cliente não enviado.", 400)
    }

    let customerPhone = customerPhoneFromUrl
    let orderStatus: string | null = null

    if (orderId) {
      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .select("id, status, customer_phone")
        .eq("id", orderId)
        .eq("restaurant_id", restaurantId)
        .maybeSingle()

      if (orderError) {
        console.error("Erro ao buscar pedido para fidelidade pública:", {
          restaurantId,
          orderId,
          message: orderError.message,
          code: orderError.code,
        })

        return jsonError("Erro ao buscar fidelidade.", 500)
      }

      if (!order) {
        return NextResponse.json({
          success: true,
          has_loyalty: false,
          order_status: null,
          loyalty: null,
        })
      }

      orderStatus = order.status ?? null

      if (!customerPhone) {
        customerPhone = onlyDigits(order.customer_phone)
      }
    }

    if (!customerPhone) {
      return jsonError("Telefone do cliente não encontrado.", 400)
    }

    const { data: loyalty, error: loyaltyError } = await supabaseAdmin
      .from("customer_loyalties")
      .select(
        "id, restaurant_id, campaign_id, customer_phone, customer_name, current_orders, required_orders, reward_available, reward_redeemed, last_order_id, created_at, updated_at"
      )
      .eq("restaurant_id", restaurantId)
      .eq("customer_phone", customerPhone)
      .maybeSingle()

    if (loyaltyError) {
      console.error("Erro ao buscar fidelidade pública:", {
        restaurantId,
        customerPhone,
        message: loyaltyError.message,
        code: loyaltyError.code,
      })

      return jsonError("Erro ao buscar fidelidade.", 500)
    }

    if (!loyalty) {
      return NextResponse.json({
        success: true,
        has_loyalty: false,
        order_status: orderStatus,
        loyalty: null,
      })
    }

    let campaign = null

    if (loyalty.campaign_id) {
      const { data: campaignData, error: campaignError } = await supabaseAdmin
        .from("loyalty_campaigns")
        .select("id, title, reward_description, required_orders, is_active")
        .eq("id", loyalty.campaign_id)
        .eq("restaurant_id", restaurantId)
        .maybeSingle()

      if (campaignError) {
        console.error("Erro ao buscar campanha de fidelidade pública:", {
          restaurantId,
          campaignId: loyalty.campaign_id,
          message: campaignError.message,
          code: campaignError.code,
        })

        return jsonError("Erro ao buscar campanha de fidelidade.", 500)
      }

      campaign = campaignData
    }

    return NextResponse.json({
      success: true,
      has_loyalty: true,
      order_status: orderStatus,
      loyalty: {
        ...loyalty,
        loyalty_campaigns: campaign,
      },
    })
  } catch (error) {
    console.error("GET /api/public/loyalty/status error:", error)

    return jsonError("Erro inesperado ao buscar fidelidade.", 500)
  }
}