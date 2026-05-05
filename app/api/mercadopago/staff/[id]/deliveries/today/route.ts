import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/supabase-admin"

async function getAuthenticatedUser() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

async function getRestaurantIdByUserId(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("restaurants")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return String(data.id)
}

async function staffBelongsToRestaurant(staffId: string, restaurantId: string) {
  const { data, error } = await supabaseAdmin
    .from("staff")
    .select("id")
    .eq("id", staffId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle()

  if (error || !data) {
    return false
  }

  return true
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return NextResponse.json(
        { message: "Usuário não autenticado" },
        { status: 401 }
      )
    }

    const restaurantId = await getRestaurantIdByUserId(user.id)

    if (!restaurantId) {
      return NextResponse.json(
        { message: "Restaurante não encontrado para este usuário" },
        { status: 404 }
      )
    }

    const { id } = await context.params

    const hasAccess = await staffBelongsToRestaurant(id, restaurantId)

    if (!hasAccess) {
      return NextResponse.json(
        { message: "Funcionário não encontrado para este restaurante" },
        { status: 404 }
      )
    }

    return NextResponse.json([
      {
        id: "del-1",
        orderId: "1024",
        customerName: "Cliente teste",
        value: 12,
        time: "14:30",
        staffId: id,
      },
    ])
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro ao listar entregas do funcionário",
      },
      { status: 500 }
    )
  }
}