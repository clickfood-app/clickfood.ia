import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { createClient } from "@/lib/supabase/server"

async function getRestaurantIdFromRequest() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error("Usuário não autenticado")
  }

  const { data: restaurant, error: restaurantError } = await supabaseAdmin
    .from("restaurants")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (restaurantError || !restaurant) {
    throw new Error("Restaurante não encontrado para este usuário")
  }

  return restaurant.id as string
}

export async function GET(_request: NextRequest) {
  try {
    const restaurantId = await getRestaurantIdFromRequest()

    const { data, error } = await supabaseAdmin
      .from("staff")
      .select("type, today_earnings, active")
      .eq("restaurant_id", restaurantId)
      .eq("active", true)

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    const rows = data ?? []

    const totalToday = rows.reduce(
      (sum, item) => sum + Number(item.today_earnings ?? 0),
      0
    )

    const entregadores = rows.filter((item) => item.type === "entregador")
    const funcionarios = rows.filter((item) => item.type === "funcionario")

    const entregadoresToday = entregadores.reduce(
      (sum, item) => sum + Number(item.today_earnings ?? 0),
      0
    )

    const funcionariosToday = funcionarios.reduce(
      (sum, item) => sum + Number(item.today_earnings ?? 0),
      0
    )

    return NextResponse.json({
      totalToday,
      totalTodayVariation: 0,
      entregadoresToday,
      totalEntregadores: entregadores.length,
      entregadoresVariation: 0,
      funcionariosToday,
      totalFuncionarios: funcionarios.length,
      funcionariosVariation: 0,
      percentOfRevenue: 0,
      percentVariation: 0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro ao buscar resumo de funcionarios",
      },
      { status: 500 }
    )
  }
}