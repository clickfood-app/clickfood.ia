import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

function onlyDigits(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "")
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return "Erro inesperado ao buscar fidelidade."
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const restaurantId = searchParams.get("restaurantId")
    const orderId = searchParams.get("orderId")
    const customerPhoneFromUrl = onlyDigits(searchParams.get("customerPhone"))

    if (!restaurantId) {
      return NextResponse.json(
        {
          success: false,
          error: "ID do restaurante não enviado.",
        },
        { status: 400 }
      )
    }

    if (!orderId && !customerPhoneFromUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "ID do pedido ou telefone do cliente não enviado.",
        },
        { status: 400 }
      )
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
        throw orderError
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
      return NextResponse.json(
        {
          success: false,
          error: "Telefone do cliente não encontrado.",
        },
        { status: 400 }
      )
    }

    const { data: loyalty, error: loyaltyError } = await supabaseAdmin
      .from("customer_loyalties")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("customer_phone", customerPhone)
      .maybeSingle()

    if (loyaltyError) {
      throw loyaltyError
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
        throw campaignError
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
    console.error("Erro ao buscar status de fidelidade:", error)

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    )
  }
}