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

async function paymentBelongsToRestaurant(
  paymentId: string,
  restaurantId: string
) {
  const { data, error } = await supabaseAdmin
    .from("staff_manual_payments")
    .select("id")
    .eq("id", paymentId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle()

  if (error || !data) {
    return false
  }

  return true
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ paymentid: string }> }
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

    const { paymentid } = await context.params

    const hasAccess = await paymentBelongsToRestaurant(paymentid, restaurantId)

    if (!hasAccess) {
      return NextResponse.json(
        { message: "Lançamento manual não encontrado para este restaurante" },
        { status: 404 }
      )
    }

    const { error } = await supabaseAdmin
      .from("staff_manual_payments")
      .delete()
      .eq("id", paymentid)
      .eq("restaurant_id", restaurantId)

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      deletedId: paymentid,
    })
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro ao excluir lançamento manual",
      },
      { status: 500 }
    )
  }
}