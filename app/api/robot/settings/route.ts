import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurada.")
}

if (!supabaseServiceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.")
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "")

  if (!token) {
    return {
      user: null,
      error: "Token de autenticação não enviado.",
    }
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data.user) {
    return {
      user: null,
      error: "Usuário não autenticado.",
    }
  }

  return {
    user: data.user,
    error: null,
  }
}

async function getUserRestaurant(userId: string) {
  const { data: restaurant, error } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, slug, owner_id")
    .eq("owner_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return restaurant
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request)

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: authError,
        },
        { status: 401 }
      )
    }

    const restaurant = await getUserRestaurant(user.id)

    if (!restaurant) {
      return NextResponse.json(
        {
          success: false,
          error: "Restaurante não encontrado para este usuário.",
        },
        { status: 404 }
      )
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("restaurant_robot_settings")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle()

    if (settingsError) {
      return NextResponse.json(
        {
          success: false,
          error: settingsError.message,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      restaurant,
      settings: settings ?? {
        restaurant_id: restaurant.id,
        provider: "waha",
        session_name: "default",
        is_enabled: false,
        auto_reply_enabled: false,
        sales_mode_enabled: false,
        campaign_enabled: false,
      },
    })
  } catch (error) {
    console.error("Erro ao buscar configurações do robô:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Erro interno ao buscar configurações do robô.",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request)

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: authError,
        },
        { status: 401 }
      )
    }

    const body = await request.json()

    const isEnabled = Boolean(body.is_enabled)
    const autoReplyEnabled =
      typeof body.auto_reply_enabled === "boolean"
        ? body.auto_reply_enabled
        : isEnabled

    const restaurant = await getUserRestaurant(user.id)

    if (!restaurant) {
      return NextResponse.json(
        {
          success: false,
          error: "Restaurante não encontrado para este usuário.",
        },
        { status: 404 }
      )
    }

    const { data: existingSettings } = await supabaseAdmin
      .from("restaurant_robot_settings")
      .select("id")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle()

    const payload = {
      restaurant_id: restaurant.id,
      provider: "waha",
      session_name: "default",
      is_enabled: isEnabled,
      auto_reply_enabled: autoReplyEnabled,
      updated_at: new Date().toISOString(),
    }

    const query = existingSettings?.id
      ? supabaseAdmin
          .from("restaurant_robot_settings")
          .update(payload)
          .eq("id", existingSettings.id)
          .select("*")
          .single()
      : supabaseAdmin
          .from("restaurant_robot_settings")
          .insert(payload)
          .select("*")
          .single()

    const { data: settings, error: saveError } = await query

    if (saveError) {
      return NextResponse.json(
        {
          success: false,
          error: saveError.message,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      restaurant,
      settings,
    })
  } catch (error) {
    console.error("Erro ao salvar configurações do robô:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Erro interno ao salvar configurações do robô.",
      },
      { status: 500 }
    )
  }
}