import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { supabaseAdmin } from "@/lib/supabase-admin"

async function getAuthenticatedUserFromRequest(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Variáveis públicas do Supabase não configuradas.")
  }

  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "")

  if (!token) {
    throw new Error("Token não enviado.")
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey)

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) {
    throw new Error("Usuário não autenticado.")
  }

  return user
}

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(req)
    const { id } = await context.params

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    if (restaurantError || !restaurant) {
      return NextResponse.json(
        { error: "Restaurante não encontrado." },
        { status: 404 }
      )
    }

    const { error } = await supabaseAdmin
      .from("products")
      .delete()
      .eq("id", id)
      .eq("restaurant_id", restaurant.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao excluir produto.",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(req)
    const { id } = await context.params
    const body = await req.json()

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    if (restaurantError || !restaurant) {
      return NextResponse.json(
        { error: "Restaurante não encontrado." },
        { status: 404 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from("products")
      .update({
        is_available: Boolean(body.is_available),
      })
      .eq("id", id)
      .eq("restaurant_id", restaurant.id)
      .select("id, is_available")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ product: data })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao atualizar status do produto.",
      },
      { status: 500 }
    )
  }
}