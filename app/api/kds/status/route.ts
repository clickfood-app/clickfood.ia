import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "").trim()

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Usuário não autenticado." },
        { status: 401 },
      )
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Sessão inválida." },
        { status: 401 },
      )
    }

    const body = await request.json()

    const orderId = String(body.order_id || "").trim()
    const status = String(body.status || "").trim()

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Pedido não informado." },
        { status: 400 },
      )
    }

    if (!["preparing", "ready"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Status inválido para o KDS." },
        { status: 400 },
      )
    }

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao buscar restaurante no KDS:", restaurantError)

      return NextResponse.json(
        { success: false, error: "Erro ao buscar restaurante." },
        { status: 500 },
      )
    }

    if (!restaurant) {
      return NextResponse.json(
        { success: false, error: "Restaurante não encontrado." },
        { status: 404 },
      )
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
      console.error("Erro ao atualizar pedido no KDS:", updateError)

      return NextResponse.json(
        {
          success: false,
          error: updateError.message || "Erro ao atualizar pedido.",
        },
        { status: 500 },
      )
    }

    if (!updatedOrder) {
      return NextResponse.json(
        {
          success: false,
          error: "Pedido não encontrado para este restaurante.",
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    })
  } catch (err) {
    console.error("Erro inesperado ao atualizar pedido no KDS:", err)

    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Erro inesperado ao atualizar pedido no KDS.",
      },
      { status: 500 },
    )
  }
}