import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

type KdsStatusBody = {
  order_id?: string
  status?: string
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

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim()

    if (!token) {
      return jsonError("Usuário não autenticado.", 401)
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return jsonError("Sessão inválida.", 401)
    }

    let body: KdsStatusBody

    try {
      body = (await request.json()) as KdsStatusBody
    } catch {
      return jsonError("Corpo da requisição inválido.", 400)
    }

    const orderId = cleanText(body.order_id, 80)
    const status = cleanText(body.status, 40)

    if (!orderId) {
      return jsonError("Pedido não informado.", 400)
    }

    if (!["preparing", "ready"].includes(status)) {
      return jsonError("Status inválido para o KDS.", 400)
    }

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao buscar restaurante no KDS:", {
        userId: user.id,
        message: restaurantError.message,
        code: restaurantError.code,
      })

      return jsonError("Erro ao buscar restaurante.", 500)
    }

    if (!restaurant) {
      return jsonError("Restaurante não encontrado.", 404)
    }

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status,
      })
      .eq("id", orderId)
      .eq("restaurant_id", restaurant.id)
      .select("id, status")
      .maybeSingle()

    if (updateError) {
      console.error("Erro ao atualizar pedido no KDS:", {
        restaurantId: restaurant.id,
        orderId,
        status,
        message: updateError.message,
        code: updateError.code,
      })

      return jsonError("Erro ao atualizar pedido.", 500)
    }

    if (!updatedOrder) {
      return jsonError("Pedido não encontrado para este restaurante.", 404)
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    })
  } catch (error) {
    console.error("Erro inesperado ao atualizar pedido no KDS:", error)

    return jsonError("Erro inesperado ao atualizar pedido no KDS.", 500)
  }
}