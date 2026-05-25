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

function getOrderDisplayNumber(order: UpdatedOrder) {
  if (order.public_order_number) {
    return `#${order.public_order_number}`
  }

  return `#${order.id.slice(0, 8)}`
}

function buildRatingText(rating: number) {
  return `${rating} estrela${rating > 1 ? "s" : ""}`
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
        "id, restaurant_id, public_order_number, status, payment_status, total, payment_method, order_type, delivery_fee, customer_name, customer_phone, customer_received_at, customer_rating, customer_review, created_at"
      )
      .single<UpdatedOrder>()

    if (error || !order) {
      return NextResponse.json(
        {
          success: false,
          error: error?.message || "Erro ao salvar avaliação.",
        },
        { status: 500 }
      )
    }

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
        },
      })

    if (notificationError) {
      console.error("Erro ao criar notificação de avaliação:", notificationError)
    }

    return NextResponse.json({
      success: true,
      order,
      notificationCreated: !notificationError,
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