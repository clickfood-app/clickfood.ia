import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { registerSaleFromOrder } from "@/lib/register-sale-from-order"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
    }

    const { id } = await context.params
    const body = await req.json()
    const nextStatus = String(body?.status || "").trim()

    if (!id) {
      return NextResponse.json(
        { error: "ID do pedido não informado." },
        { status: 400 }
      )
    }

    if (!nextStatus) {
      return NextResponse.json(
        { error: "Status do pedido é obrigatório." },
        { status: 400 }
      )
    }

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, owner_id")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao buscar restaurante:", restaurantError)
      return NextResponse.json(
        { error: "Erro ao buscar restaurante." },
        { status: 500 }
      )
    }

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurante não encontrado para este usuário." },
        { status: 404 }
      )
    }

    const { data: existingOrder, error: existingOrderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("restaurant_id", restaurant.id)
      .maybeSingle()

    if (existingOrderError) {
      console.error("Erro ao buscar pedido:", existingOrderError)
      return NextResponse.json(
        { error: "Erro ao buscar pedido." },
        { status: 500 }
      )
    }

    if (!existingOrder) {
      return NextResponse.json(
        { error: "Pedido não encontrado." },
        { status: 404 }
      )
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: nextStatus,
      })
      .eq("id", id)
      .eq("restaurant_id", restaurant.id)
      .select("*")
      .single()

    if (updateError) {
      console.error("Erro ao atualizar pedido:", updateError)
      return NextResponse.json(
        { error: "Erro ao atualizar status do pedido." },
        { status: 500 }
      )
    }

    const saleResult = await registerSaleFromOrder(
      supabase,
      {
        id: updatedOrder.id,
        restaurant_id: updatedOrder.restaurant_id,
        customer_name: updatedOrder.customer_name ?? null,
        status: updatedOrder.status ?? null,
        total: updatedOrder.total ?? 0,
        payment_method: updatedOrder.payment_method ?? null,
        notes: updatedOrder.notes ?? null,
      },
      user.id
    )

    if (!saleResult.success && !saleResult.skipped) {
      console.error(
        "Erro ao registrar venda automaticamente:",
        saleResult.reason
      )

      return NextResponse.json(
        {
          error: "Pedido atualizado, mas houve erro ao registrar a venda.",
          order: updatedOrder,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      order: updatedOrder,
      saleRegistered: !saleResult.skipped,
      saleMessage: saleResult.reason ?? null,
    })
  } catch (error) {
    console.error("PATCH /api/pedidos/[id]/status error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    )
  }
}