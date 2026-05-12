import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { encryptText, getLast4 } from "@/lib/crypto"

type SaveAsaasAccountBody = {
  environment?: "sandbox" | "production"
  apiKey?: string
  webhookToken?: string
  walletId?: string | null
  userAgent?: string | null
}

async function getAuthenticatedUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error("Usuário não autenticado.")
  }

  return user
}

async function getRestaurantIdByOwner(ownerId: string) {
  const { data: restaurant, error } = await supabaseAdmin
    .from("restaurants")
    .select("id")
    .eq("owner_id", ownerId)
    .maybeSingle()

  if (error || !restaurant) {
    throw new Error("Restaurante não encontrado.")
  }

  return restaurant.id
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    const restaurantId = await getRestaurantIdByOwner(user.id)

    const { data, error } = await supabaseAdmin
      .from("restaurant_asaas_accounts")
      .select(
        "environment, wallet_id, user_agent, api_key_last4, webhook_token_last4, is_active, connected_at, last_tested_at, last_error, created_at, updated_at"
      )
      .eq("restaurant_id", restaurantId)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: error.message || "Erro ao carregar conta Asaas." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      connected: !!data,
      account: data
        ? {
            environment: data.environment,
            walletId: data.wallet_id,
            userAgent: data.user_agent,
            apiKeyLast4: data.api_key_last4,
            webhookTokenLast4: data.webhook_token_last4,
            isActive: data.is_active,
            connectedAt: data.connected_at,
            lastTestedAt: data.last_tested_at,
            lastError: data.last_error,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          }
        : null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao buscar conta Asaas.",
      },
      { status: 401 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    const restaurantId = await getRestaurantIdByOwner(user.id)
    const body = (await req.json()) as SaveAsaasAccountBody

    const environment =
      body.environment === "production" ? "production" : "sandbox"
    const apiKey = body.apiKey?.trim()
    const webhookToken = body.webhookToken?.trim()
    const walletId = body.walletId?.trim() || null
    const userAgent = body.userAgent?.trim() || "clickfood"

    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key do Asaas é obrigatória." },
        { status: 400 }
      )
    }

    if (!webhookToken) {
      return NextResponse.json(
        { error: "Token do webhook do Asaas é obrigatório." },
        { status: 400 }
      )
    }

    const encryptedApiKey = encryptText(apiKey)
    const encryptedWebhookToken = encryptText(webhookToken)

    const now = new Date().toISOString()

    const payload = {
      restaurant_id: restaurantId,
      environment,
      api_key_encrypted: encryptedApiKey,
      webhook_token_encrypted: encryptedWebhookToken,
      wallet_id: walletId,
      user_agent: userAgent,
      api_key_last4: getLast4(apiKey),
      webhook_token_last4: getLast4(webhookToken),
      is_active: true,
      connected_at: now,
      updated_at: now,
      last_error: null,
    }

    const { error: upsertError } = await supabaseAdmin
      .from("restaurant_asaas_accounts")
      .upsert(payload, { onConflict: "restaurant_id" })

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message || "Erro ao salvar conta Asaas." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Conta Asaas salva com sucesso.",
      account: {
        environment,
        walletId,
        userAgent,
        apiKeyLast4: getLast4(apiKey),
        webhookTokenLast4: getLast4(webhookToken),
        isActive: true,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao salvar conta Asaas.",
      },
      { status: 401 }
    )
  }
}