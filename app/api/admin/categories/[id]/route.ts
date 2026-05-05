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

    const { count, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .eq("category_id", id)

    if (productsError) {
      return NextResponse.json(
        { error: productsError.message },
        { status: 400 }
      )
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "Esta categoria possui produtos vinculados." },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from("categories")
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
            : "Erro ao excluir categoria.",
      },
      { status: 500 }
    )
  }
}