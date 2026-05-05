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

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUserFromRequest(req)

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

    const [categoriesResult, productsResult] = await Promise.all([
      supabaseAdmin
        .from("categories")
        .select("id, name, sort_order, is_active")
        .eq("restaurant_id", restaurant.id)
        .order("sort_order", { ascending: true }),

      supabaseAdmin
        .from("products")
        .select("id, name, description, price, image_url, is_available, sort_order, category_id")
        .eq("restaurant_id", restaurant.id)
        .order("sort_order", { ascending: true }),
    ])

    if (categoriesResult.error) {
      return NextResponse.json(
        { error: categoriesResult.error.message },
        { status: 500 }
      )
    }

    if (productsResult.error) {
      return NextResponse.json(
        { error: productsResult.error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      restaurantId: restaurant.id,
      categories: categoriesResult.data ?? [],
      products: productsResult.data ?? [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar catálogo do admin.",
      },
      { status: 500 }
    )
  }
}