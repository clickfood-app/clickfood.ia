import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

type ConfirmReceivedBody = {
  restaurantId?: string
  orderId?: string
  rating?: number
  review?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConfirmReceivedBody

    const restaurantId = body.restaurantId?.trim()
    const orderId = body.orderId?.trim()
    const rating = Number(body.rating)
    const review = body.review?.trim() || null

    if (!restaurantId) {
      return NextResponse.json(
        { success: false, error: "restaurantId é obrigatório." },
        { status: 400 }
      )
    }

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId é obrigatório." },
        { status: 400 }
      )
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: "Avaliação inválida." },
        { status: 400 }
      )
    }

    const receivedAt = new Date().toISOString()

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
        "id, restaurant_id, public_order_number, status, payment_status, total, payment_method, order_type, delivery_fee, customer_received_at, customer_rating, customer_review, created_at"
      )
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message || "Erro ao salvar avaliação." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      order,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao confirmar recebimento.",
      },
      { status: 500 }
    )
  }
}