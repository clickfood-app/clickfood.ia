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
  isActive?: boolean
}

type AsaasAccountRow = {
  environment: "sandbox" | "production"
  wallet_id: string | null
  user_agent: string | null
  api_key_last4: string | null
  webhook_token_last4: string | null
  is_active: boolean
  connected_at: string | null
  last_tested_at: string | null
  last_error: string | null
  created_at: string | null
  updated_at: string | null
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

function formatAccount(data: AsaasAccountRow | null) {
  return data
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
    : null
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
      .maybeSingle<AsaasAccountRow>()

    if (error) {
      return NextResponse.json(
        { error: error.message || "Erro ao carregar conta Asaas." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      connected: !!data,
      account: formatAccount(data),
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
    const isActive = body.isActive ?? true

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
      is_active: isActive,
      connected_at: now,
      updated_at: now,
      last_error: null,
    }

    const { data, error: upsertError } = await supabaseAdmin
      .from("restaurant_asaas_accounts")
      .upsert(payload, { onConflict: "restaurant_id" })
      .select(
        "environment, wallet_id, user_agent, api_key_last4, webhook_token_last4, is_active, connected_at, last_tested_at, last_error, created_at, updated_at"
      )
      .single<AsaasAccountRow>()

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message || "Erro ao salvar conta Asaas." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      connected: true,
      message: "Conta Asaas salva com sucesso.",
      account: formatAccount(data),
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

export async function PUT(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    const restaurantId = await getRestaurantIdByOwner(user.id)
    const body = (await req.json()) as SaveAsaasAccountBody

    const { data: existingAccount, error: existingError } = await supabaseAdmin
      .from("restaurant_asaas_accounts")
      .select("restaurant_id, api_key_last4, webhook_token_last4")
      .eq("restaurant_id", restaurantId)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        {
          error:
            existingError.message || "Erro ao buscar conexão Asaas existente.",
        },
        { status: 500 }
      )
    }

    const environment =
      body.environment === "production" ? "production" : "sandbox"
    const apiKey = body.apiKey?.trim()
    const webhookToken = body.webhookToken?.trim()
    const walletId = body.walletId?.trim() || null
    const userAgent = body.userAgent?.trim() || "clickfood"
    const isActive = body.isActive ?? true

    if (!existingAccount && !apiKey) {
      return NextResponse.json(
        { error: "API Key do Asaas é obrigatória." },
        { status: 400 }
      )
    }

    if (!existingAccount && !webhookToken) {
      return NextResponse.json(
        { error: "Token do webhook do Asaas é obrigatório." },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    if (!existingAccount) {
      const payload = {
        restaurant_id: restaurantId,
        environment,
        api_key_encrypted: encryptText(apiKey as string),
        webhook_token_encrypted: encryptText(webhookToken as string),
        wallet_id: walletId,
        user_agent: userAgent,
        api_key_last4: getLast4(apiKey as string),
        webhook_token_last4: getLast4(webhookToken as string),
        is_active: isActive,
        connected_at: now,
        updated_at: now,
        last_error: null,
      }

      const { data, error: insertError } = await supabaseAdmin
        .from("restaurant_asaas_accounts")
        .insert(payload)
        .select(
          "environment, wallet_id, user_agent, api_key_last4, webhook_token_last4, is_active, connected_at, last_tested_at, last_error, created_at, updated_at"
        )
        .single<AsaasAccountRow>()

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message || "Erro ao criar conexão Asaas." },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        connected: true,
        message: "Conexão Asaas criada com sucesso.",
        account: formatAccount(data),
      })
    }

    const updatePayload: Record<string, string | boolean | null> = {
      environment,
      wallet_id: walletId,
      user_agent: userAgent,
      is_active: isActive,
      updated_at: now,
      last_error: null,
    }

    if (apiKey) {
      updatePayload.api_key_encrypted = encryptText(apiKey)
      updatePayload.api_key_last4 = getLast4(apiKey)
    }

    if (webhookToken) {
      updatePayload.webhook_token_encrypted = encryptText(webhookToken)
      updatePayload.webhook_token_last4 = getLast4(webhookToken)
    }

    const { data, error: updateError } = await supabaseAdmin
      .from("restaurant_asaas_accounts")
      .update(updatePayload)
      .eq("restaurant_id", restaurantId)
      .select(
        "environment, wallet_id, user_agent, api_key_last4, webhook_token_last4, is_active, connected_at, last_tested_at, last_error, created_at, updated_at"
      )
      .single<AsaasAccountRow>()

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Erro ao atualizar conexão Asaas." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      connected: true,
      message: "Conexão Asaas atualizada com sucesso.",
      account: formatAccount(data),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao atualizar conexão Asaas.",
      },
      { status: 401 }
    )
  }
}