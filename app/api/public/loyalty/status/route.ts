import { NextResponse } from "next/server"

import { supabaseAdmin } from "@/lib/supabase-admin"

function normalizePhone(phone: string | null | undefined) {
  return String(phone || "").replace(/\D/g, "")
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const orderId = String(searchParams.get("order_id") || "").trim()

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
      .select("id, restaurant_id, customer_phone, customer_name, status")
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

    const customerPhone = normalizePhone(order.customer_phone)

    if (!customerPhone) {
      return NextResponse.json({
        success: true,
        has_loyalty: false,
        reason: "Pedido sem telefone do cliente.",
      })
    }

    const { data: progress, error: progressError } = await supabaseAdmin
      .from("loyalty_customer_progress")
      .select(
        `
        id,
        restaurant_id,
        campaign_id,
        customer_phone,
        customer_name,
        current_orders,
        required_orders,
        reward_available,
        reward_redeemed,
        last_order_id,
        created_at,
        updated_at,
        loyalty_campaigns (
          id,
          title,
          reward_description,
          required_orders,
          is_active
        )
      `
      )
      .eq("restaurant_id", order.restaurant_id)
      .eq("customer_phone", customerPhone)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (progressError) {
      throw new Error(`Erro ao buscar fidelidade: ${progressError.message}`)
    }

    if (!progress) {
      return NextResponse.json({
        success: true,
        has_loyalty: false,
        order_status: order.status,
      })
    }

    return NextResponse.json({
      success: true,
      has_loyalty: true,
      order_status: order.status,
      loyalty: progress,
    })
  } catch (error) {
    console.error("Erro ao buscar status da fidelidade:", error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao buscar fidelidade.",
      },
      { status: 500 }
    )
  }
}