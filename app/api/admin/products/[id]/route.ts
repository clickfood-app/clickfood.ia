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

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()

    if (["true", "1", "sim", "yes", "ativo", "active"].includes(normalized)) {
      return true
    }

    if (["false", "0", "nao", "não", "no", "inativo", "inactive"].includes(normalized)) {
      return false
    }
  }

  return Boolean(value)
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function getRestaurantIdByOwner(ownerId: string) {
  const { data: restaurant, error } = await supabaseAdmin
    .from("restaurants")
    .select("id")
    .eq("owner_id", ownerId)
    .maybeSingle()

  if (error) {
    console.error("Erro ao buscar restaurante em produto admin:", {
      ownerId,
      message: error.message,
      code: error.code,
    })

    throw new Error("restaurant_lookup_failed")
  }

  if (!restaurant) {
    throw new Error("restaurant_not_found")
  }

  return restaurant.id
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(req)
    const { id } = await context.params
    const productId = cleanText(id, 80)

    if (!productId) {
      return jsonError("Produto não informado.", 400)
    }

    const restaurantId = await getRestaurantIdByOwner(user.id)

    const { data: deletedProduct, error } = await supabaseAdmin
      .from("products")
      .delete()
      .eq("id", productId)
      .eq("restaurant_id", restaurantId)
      .select("id")
      .maybeSingle()

    if (error) {
      console.error("Erro ao excluir produto:", {
        restaurantId,
        productId,
        message: error.message,
        code: error.code,
      })

      return jsonError("Erro ao excluir produto.", 500)
    }

    if (!deletedProduct) {
      return jsonError("Produto não encontrado.", 404)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/admin/products/[id] error:", error)

    if (error instanceof Error && error.message === "unauthorized") {
      return jsonError("Não autorizado.", 401)
    }

    if (error instanceof Error && error.message === "restaurant_not_found") {
      return jsonError("Restaurante não encontrado.", 404)
    }

    return jsonError("Erro ao excluir produto.", 500)
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(req)
    const { id } = await context.params
    const productId = cleanText(id, 80)

    if (!productId) {
      return jsonError("Produto não informado.", 400)
    }

    let body: { is_available?: unknown }

    try {
      body = (await req.json()) as { is_available?: unknown }
    } catch {
      return jsonError("Corpo da requisição inválido.", 400)
    }

    const restaurantId = await getRestaurantIdByOwner(user.id)

    const { data, error } = await supabaseAdmin
      .from("products")
      .update({
        is_available: toBoolean(body.is_available),
      })
      .eq("id", productId)
      .eq("restaurant_id", restaurantId)
      .select("id, is_available")
      .maybeSingle()

    if (error) {
      console.error("Erro ao atualizar produto:", {
        restaurantId,
        productId,
        message: error.message,
        code: error.code,
      })

      return jsonError("Erro ao atualizar status do produto.", 500)
    }

    if (!data) {
      return jsonError("Produto não encontrado.", 404)
    }

    return NextResponse.json({ product: data })
  } catch (error) {
    console.error("PATCH /api/admin/products/[id] error:", error)

    if (error instanceof Error && error.message === "unauthorized") {
      return jsonError("Não autorizado.", 401)
    }

    if (error instanceof Error && error.message === "restaurant_not_found") {
      return jsonError("Restaurante não encontrado.", 404)
    }

    return jsonError("Erro ao atualizar status do produto.", 500)
  }
}