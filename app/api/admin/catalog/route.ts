import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { supabaseAdmin } from "@/lib/supabase-admin"

async function getAuthenticatedUserFromRequest(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("supabase_config_missing")
  }

  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim()

  if (!token) {
    throw new Error("unauthorized")
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) {
    throw new Error("unauthorized")
  }

  return user
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUserFromRequest(req)

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao buscar restaurante no catálogo admin:", {
        userId: user.id,
        message: restaurantError.message,
        code: restaurantError.code,
      })

      return jsonError("Erro ao buscar restaurante.", 500)
    }

    if (!restaurant) {
      return jsonError("Restaurante não encontrado.", 404)
    }

    const [categoriesResult, productsResult] = await Promise.all([
      supabaseAdmin
        .from("categories")
        .select("id, name, sort_order, is_active")
        .eq("restaurant_id", restaurant.id)
        .order("sort_order", { ascending: true }),

      supabaseAdmin
        .from("products")
        .select(
          "id, name, description, price, cost_price, image_url, is_available, sort_order, category_id, promotion_active, promotion_type, promotion_value"
        )
        .eq("restaurant_id", restaurant.id)
        .order("sort_order", { ascending: true }),
    ])

    if (categoriesResult.error) {
      console.error("Erro ao buscar categorias no catálogo admin:", {
        restaurantId: restaurant.id,
        message: categoriesResult.error.message,
        code: categoriesResult.error.code,
      })

      return jsonError("Erro ao carregar categorias.", 500)
    }

    if (productsResult.error) {
      console.error("Erro ao buscar produtos no catálogo admin:", {
        restaurantId: restaurant.id,
        message: productsResult.error.message,
        code: productsResult.error.code,
      })

      return jsonError("Erro ao carregar produtos.", 500)
    }

    return NextResponse.json({
      restaurantId: restaurant.id,
      categories: categoriesResult.data ?? [],
      products: productsResult.data ?? [],
    })
  } catch (error) {
    console.error("GET /api/admin/catalog error:", error)

    if (error instanceof Error && error.message === "unauthorized") {
      return jsonError("Não autorizado.", 401)
    }

    return jsonError("Erro ao carregar catálogo do admin.", 500)
  }
}