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

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

function cleanText(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(req)
    const { id } = await context.params
    const categoryId = cleanText(id, 80)

    if (!categoryId) {
      return jsonError("Categoria não informada.", 400)
    }

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao buscar restaurante para excluir categoria:", {
        userId: user.id,
        categoryId,
        message: restaurantError.message,
        code: restaurantError.code,
      })

      return jsonError("Erro ao buscar restaurante.", 500)
    }

    if (!restaurant) {
      return jsonError("Restaurante não encontrado.", 404)
    }

    const { count, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .eq("category_id", categoryId)

    if (productsError) {
      console.error("Erro ao verificar produtos da categoria:", {
        restaurantId: restaurant.id,
        categoryId,
        message: productsError.message,
        code: productsError.code,
      })

      return jsonError("Erro ao verificar produtos vinculados.", 500)
    }

    if ((count ?? 0) > 0) {
      return jsonError("Esta categoria possui produtos vinculados.", 400)
    }

    const { data: deletedCategory, error } = await supabaseAdmin
      .from("categories")
      .delete()
      .eq("id", categoryId)
      .eq("restaurant_id", restaurant.id)
      .select("id")
      .maybeSingle()

    if (error) {
      console.error("Erro ao excluir categoria:", {
        restaurantId: restaurant.id,
        categoryId,
        message: error.message,
        code: error.code,
      })

      return jsonError("Erro ao excluir categoria.", 500)
    }

    if (!deletedCategory) {
      return jsonError("Categoria não encontrada.", 404)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/admin/categories/[id] error:", error)

    if (error instanceof Error && error.message === "unauthorized") {
      return jsonError("Não autorizado.", 401)
    }

    return jsonError("Erro ao excluir categoria.", 500)
  }
}