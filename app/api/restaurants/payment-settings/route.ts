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

export async function GET(req: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUserFromRequest(req)

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    if (restaurantError || !restaurant) {
      return NextResponse.json(
        { error: "Restaurante não encontrado para este usuário." },
        { status: 404 }
      )
    }

    const { data, error } = await supabase
      .from("restaurant_payment_settings")
      .select(
        "restaurant_id, provider, asaas_environment, asaas_api_key, asaas_webhook_token, asaas_connected, split_enabled, service_fee_amount, clickfood_split_amount, created_at, updated_at"
      )
      .eq("restaurant_id", restaurant.id)
      .single()

    if (error) {
      console.error("Erro ao buscar payment settings:", error)
      return NextResponse.json(
        { error: error.message || "Erro ao buscar configurações de pagamento." },
        { status: 400 }
      )
    }

    return NextResponse.json({ paymentSettings: data }, { status: 200 })
  } catch (error) {
    console.error("Erro na rota /api/restaurants/payment-settings [GET]:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao buscar configurações de pagamento.",
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUserFromRequest(req)
    const body = await req.json()

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    if (restaurantError || !restaurant) {
      return NextResponse.json(
        { error: "Restaurante não encontrado para este usuário." },
        { status: 404 }
      )
    }

    const serviceFeeAmount = Number(body.service_fee_amount)
    const clickfoodSplitAmount = Number(body.clickfood_split_amount)

    if (!["sandbox", "production"].includes(body.asaas_environment)) {
      return NextResponse.json(
        { error: "asaas_environment deve ser 'sandbox' ou 'production'." },
        { status: 400 }
      )
    }

    if (!Number.isFinite(serviceFeeAmount) || serviceFeeAmount < 0) {
      return NextResponse.json(
        { error: "service_fee_amount inválido." },
        { status: 400 }
      )
    }

    if (!Number.isFinite(clickfoodSplitAmount) || clickfoodSplitAmount < 0) {
      return NextResponse.json(
        { error: "clickfood_split_amount inválido." },
        { status: 400 }
      )
    }

    const payload = {
      restaurant_id: restaurant.id,
      provider: "asaas",
      asaas_environment: body.asaas_environment,
      asaas_api_key: body.asaas_api_key?.trim() || null,
      asaas_webhook_token: body.asaas_webhook_token?.trim() || null,
      asaas_connected: Boolean(body.asaas_connected),
      split_enabled: Boolean(body.split_enabled),
      service_fee_amount: serviceFeeAmount,
      clickfood_split_amount: clickfoodSplitAmount,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("restaurant_payment_settings")
      .upsert(payload, {
        onConflict: "restaurant_id",
      })
      .select(
        "restaurant_id, provider, asaas_environment, asaas_api_key, asaas_webhook_token, asaas_connected, split_enabled, service_fee_amount, clickfood_split_amount, created_at, updated_at"
      )
      .single()

    if (error) {
      console.error("Erro ao salvar payment settings:", error)
      return NextResponse.json(
        { error: error.message || "Erro ao salvar configurações de pagamento." },
        { status: 400 }
      )
    }

    return NextResponse.json({ paymentSettings: data }, { status: 200 })
  } catch (error) {
    console.error("Erro na rota /api/restaurants/payment-settings [POST]:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao salvar configurações de pagamento.",
      },
      { status: 500 }
    )
  }
}