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
  created_at: string | null
}

function cleanPublicOrderNumber(value: string | null) {
  return (value || "").replace("#", "").trim()
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const restaurantId = searchParams.get("restaurantId")?.trim()
    const orderId = searchParams.get("orderId")?.trim()
    const publicOrderNumber = cleanPublicOrderNumber(
      searchParams.get("publicOrderNumber")
    )

    if (!restaurantId) {
      return NextResponse.json(
        { success: false, error: "restaurantId é obrigatório." },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      )
    }

    if (!orderId && !publicOrderNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "orderId ou publicOrderNumber é obrigatório.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      )
    }

    let query = supabaseAdmin
      .from("orders")
      .select(
        "id, restaurant_id, public_order_number, status, payment_status, total, payment_method, order_type, delivery_fee, created_at"
      )
      .eq("restaurant_id", restaurantId)

    if (orderId) {
      query = query.eq("id", orderId)
    } else {
      query = query.eq("public_order_number", publicOrderNumber)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Erro ao buscar status do pedido.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      )
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Pedido não encontrado." },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      )
    }

    const order = data as PublicOrderStatusRow

    return NextResponse.json(
      {
        success: true,
        order,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao consultar status do pedido.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  }
}
