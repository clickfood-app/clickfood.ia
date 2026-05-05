import { NextRequest, NextResponse } from "next/server"
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params

    const hasAccess = await staffBelongsToRestaurant(id, restaurantId)

    if (!hasAccess) {
      return NextResponse.json(
        { message: "Funcionário não encontrado para este restaurante" },
        { status: 404 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from("staff_manual_payments")
      .select("*")
      .eq("staff_id", id)
      .eq("restaurant_id", restaurantId)
      .order("date", { ascending: false })

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json(
      (data ?? []).map((item) => ({
        id: String(item.id),
        staffId: String(item.staff_id),
        restaurantId: String(item.restaurant_id),
        type: item.type,
        amount: Number(item.amount ?? 0),
        description: item.description ?? "",
        date: item.date,
        paymentMethod: item.payment_method,
        status: item.status,
      }))
    )
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro ao listar lancamentos manuais",
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params
    const hasAccess = await staffBelongsToRestaurant(id, restaurantId)

    if (!hasAccess) {
      return NextResponse.json(
        { message: "Funcionário não encontrado para este restaurante" },
        { status: 404 }
      )
    }

    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from("staff_manual_payments")
      .insert({
        staff_id: id,
        restaurant_id: restaurantId,
        type: body.type,
        amount: Number(body.amount ?? 0),
        description: body.description,
        date: body.date,
        payment_method: body.paymentMethod,
        status: body.status,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json({
      id: String(data.id),
      staffId: String(data.staff_id),
      restaurantId: String(data.restaurant_id),
      type: data.type,
      amount: Number(data.amount ?? 0),
      description: data.description ?? "",
      date: data.date,
      paymentMethod: data.payment_method,
      status: data.status,
    })
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro ao criar lancamento manual",
      },
      { status: 500 }
    )
  }
}