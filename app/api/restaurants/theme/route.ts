import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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
    throw new Error("Usuário não autenticado.")
  }

  return { user, supabase }
}

export async function POST(req: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUserFromRequest(req)
    const body = await req.json()

    const payload = {
      logo_url: body.logo_url || null,
      cover_image_url: body.cover_image_url || null,
      theme_color: body.theme_color || null,
      theme_mode: body.theme_mode || "dark",
      floating_cart_bg_color: body.floating_cart_bg_color || "#7c3aed",
      floating_cart_text_color: body.floating_cart_text_color || "#ffffff",
      floating_cart_number_color: body.floating_cart_number_color || "#ffffff",
    }

    const { data: existingRestaurant, error: existingRestaurantError } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    if (existingRestaurantError || !existingRestaurant) {
      return NextResponse.json(
        { error: "Restaurante não encontrado para este usuário." },
        { status: 404 }
      )
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
      console.error("Erro ao salvar tema do restaurante:", updateError)
      return NextResponse.json(
        { error: updateError.message || "Erro ao salvar personalização." },
        { status: 400 }
      )
    }

    return NextResponse.json({ restaurant }, { status: 200 })
  } catch (error) {
    console.error("Erro na rota /api/restaurants/theme:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro interno ao salvar personalização.",
      },
      { status: 500 }
    )
  }
}