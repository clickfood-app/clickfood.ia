import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw new Error("unauthorized")
  }

  return { user, supabase }
}

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUserFromRequest(req)

    let body: Record<string, unknown>

    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return jsonError("Corpo da requisição inválido.", 400)
    }

    const payload = {
      logo_url: cleanText(body.logo_url, 700) || null,
      cover_image_url: cleanText(body.cover_image_url, 700) || null,
      theme_color: cleanText(body.theme_color, 40) || null,
      theme_mode: cleanText(body.theme_mode, 40) || "dark",
      floating_cart_bg_color:
        cleanText(body.floating_cart_bg_color, 40) || "#7c3aed",
      floating_cart_text_color:
        cleanText(body.floating_cart_text_color, 40) || "#ffffff",
      floating_cart_number_color:
        cleanText(body.floating_cart_number_color, 40) || "#ffffff",
    }

    const { data: existingRestaurant, error: existingRestaurantError } =
      await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle()

    if (existingRestaurantError) {
      console.error("Erro ao buscar restaurante para salvar tema:", {
        userId: user.id,
        message: existingRestaurantError.message,
        code: existingRestaurantError.code,
      })

      return jsonError("Erro ao buscar restaurante.", 500)
    }

    if (!existingRestaurant) {
      return jsonError("Restaurante não encontrado para este usuário.", 404)
    }

    const { data: restaurant, error: updateError } = await supabase
      .from("restaurants")
      .update(payload)
      .eq("id", existingRestaurant.id)
      .eq("owner_id", user.id)
      .select(
        "id, slug, logo_url, cover_image_url, theme_color, theme_mode, floating_cart_bg_color, floating_cart_text_color, floating_cart_number_color"
      )
      .single()

    if (updateError) {
      console.error("Erro ao salvar tema do restaurante:", {
        restaurantId: existingRestaurant.id,
        message: updateError.message,
        code: updateError.code,
      })

      return jsonError("Erro ao salvar personalização.", 500)
    }

    return NextResponse.json({ restaurant }, { status: 200 })
  } catch (error) {
    console.error("POST /api/restaurants/theme error:", error)

    if (error instanceof Error && error.message === "unauthorized") {
      return jsonError("Não autorizado.", 401)
    }

    return jsonError("Erro interno ao salvar personalização.", 500)
  }
}