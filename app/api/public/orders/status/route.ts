import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

type PublicOrderStatusRow = {
  id: string
  restaurant_id: string
  public_order_number: string | null
  status: string | null
  payment_status: string | null
  total: number | string | null
  payment_method: string | null
  order_type: string | null
  delivery_fee: number | string | null
  customer_received_at: string | null
  customer_rating: number | null
  customer_review: string | null
  created_at: string | null
}

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
}

function cleanText(value: string | null, maxLength = 100) {
  return (value || "").trim().slice(0, maxLength)
}

function cleanPublicOrderNumber(value: string | null) {
  return cleanText(value, 40).replace("#", "").trim()
}

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    }
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const restaurantId = cleanText(searchParams.get("restaurantId"), 80)
    const orderId = cleanText(searchParams.get("orderId"), 80)
    const publicOrderNumber = cleanPublicOrderNumber(
      searchParams.get("publicOrderNumber")
    )

    if (!restaurantId) {
      return jsonError("restaurantId é obrigatório.", 400)
    }

    if (!orderId && !publicOrderNumber) {
      return jsonError("orderId ou publicOrderNumber é obrigatório.", 400)
    }

    let query = supabaseAdmin
      .from("orders")
      .select(
        "id, restaurant_id, public_order_number, status, payment_status, total, payment_method, order_type, delivery_fee, customer_received_at, customer_rating, customer_review, created_at"
      )
      .eq("restaurant_id", restaurantId)

    if (orderId) {
      query = query.eq("id", orderId)
    } else {
      query = query.eq("public_order_number", publicOrderNumber)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      console.error("Erro ao buscar status público do pedido:", {
        restaurantId,
        orderId,
        publicOrderNumber,
        message: error.message,
        code: error.code,
      })

      return jsonError("Erro ao consultar status do pedido.", 500)
    }

    if (!data) {
      return jsonError("Pedido não encontrado.", 404)
    }

    const order = data as PublicOrderStatusRow

    return NextResponse.json(
      {
        success: true,
        order,
      },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      }
    )
  } catch (error) {
    console.error("GET /api/public/orders/status error:", error)

    return jsonError("Erro ao consultar status do pedido.", 500)
  }
}