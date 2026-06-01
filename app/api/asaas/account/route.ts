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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function getAuthenticatedUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error("unauthorized")
  }

  return user
}

async function getRestaurantIdByOwner(ownerId: string) {
  const { data: restaurant, error } = await supabaseAdmin
    .from("restaurants")
    .select("id")
    .eq("owner_id", ownerId)
    .maybeSingle()

  if (error) {
    console.error("Erro ao buscar restaurante para conta Asaas:", {
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

function normalizeEnvironment(value: unknown): "sandbox" | "production" {
  return value === "production" ? "production" : "sandbox"
}

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function isAuthError(error: unknown) {
  return error instanceof Error && error.message === "unauthorized"
}

function isRestaurantNotFound(error: unknown) {
  return error instanceof Error && error.message === "restaurant_not_found"
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
      console.error("Erro ao carregar conta Asaas:", {
        restaurantId,
        message: error.message,
        code: error.code,
      })

      return jsonError("Erro ao carregar conta Asaas.", 500)
    }

    return NextResponse.json({
      connected: !!data,
      account: formatAccount(data),
    })
  } catch (error) {
    console.error("GET /api/asaas/account error:", error)

    if (isAuthError(error)) {
      return jsonError("Não autorizado.", 401)
    }

    if (isRestaurantNotFound(error)) {
      return jsonError("Restaurante não encontrado.", 404)
    }

    return jsonError("Erro ao buscar conta Asaas.", 500)
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    const restaurantId = await getRestaurantIdByOwner(user.id)

    let body: SaveAsaasAccountBody

    try {
      body = (await req.json()) as SaveAsaasAccountBody
    } catch {
      return jsonError("Corpo da requisição inválido.", 400)
    }

    const environment = normalizeEnvironment(body.environment)
    const apiKey = cleanText(body.apiKey, 700)
    const webhookToken = cleanText(body.webhookToken, 700)
    const walletId = cleanText(body.walletId, 120) || null
    const userAgent = cleanText(body.userAgent, 120) || "clickfood"
    const isActive = body.isActive ?? true

    if (!apiKey) {
      return jsonError("API Key do Asaas é obrigatória.", 400)
    }

    if (!webhookToken) {
      return jsonError("Token do webhook do Asaas é obrigatório.", 400)
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
      console.error("Erro ao salvar conta Asaas:", {
        restaurantId,
        message: upsertError.message,
        code: upsertError.code,
      })

      return jsonError("Erro ao salvar conta Asaas.", 500)
    }

    return NextResponse.json({
      success: true,
      connected: true,
      message: "Conta Asaas salva com sucesso.",
      account: formatAccount(data),
    })
  } catch (error) {
    console.error("POST /api/asaas/account error:", error)

    if (isAuthError(error)) {
      return jsonError("Não autorizado.", 401)
    }

    if (isRestaurantNotFound(error)) {
      return jsonError("Restaurante não encontrado.", 404)
    }

    return jsonError("Erro ao salvar conta Asaas.", 500)
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    const restaurantId = await getRestaurantIdByOwner(user.id)

    let body: SaveAsaasAccountBody

    try {
      body = (await req.json()) as SaveAsaasAccountBody
    } catch {
      return jsonError("Corpo da requisição inválido.", 400)
    }

    const { data: existingAccount, error: existingError } = await supabaseAdmin
      .from("restaurant_asaas_accounts")
      .select("restaurant_id, api_key_last4, webhook_token_last4")
      .eq("restaurant_id", restaurantId)
      .maybeSingle()

    if (existingError) {
      console.error("Erro ao buscar conexão Asaas existente:", {
        restaurantId,
        message: existingError.message,
        code: existingError.code,
      })

      return jsonError("Erro ao buscar conexão Asaas existente.", 500)
    }

    const environment = normalizeEnvironment(body.environment)
    const apiKey = cleanText(body.apiKey, 700)
    const webhookToken = cleanText(body.webhookToken, 700)
    const walletId = cleanText(body.walletId, 120) || null
    const userAgent = cleanText(body.userAgent, 120) || "clickfood"
    const isActive = body.isActive ?? true

    if (!existingAccount && !apiKey) {
      return jsonError("API Key do Asaas é obrigatória.", 400)
    }

    if (!existingAccount && !webhookToken) {
      return jsonError("Token do webhook do Asaas é obrigatório.", 400)
    }

    const now = new Date().toISOString()

    if (!existingAccount) {
      const payload = {
        restaurant_id: restaurantId,
        environment,
        api_key_encrypted: encryptText(apiKey),
        webhook_token_encrypted: encryptText(webhookToken),
        wallet_id: walletId,
        user_agent: userAgent,
        api_key_last4: getLast4(apiKey),
        webhook_token_last4: getLast4(webhookToken),
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
        console.error("Erro ao criar conexão Asaas:", {
          restaurantId,
          message: insertError.message,
          code: insertError.code,
        })

        return jsonError("Erro ao criar conexão Asaas.", 500)
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
      console.error("Erro ao atualizar conexão Asaas:", {
        restaurantId,
        message: updateError.message,
        code: updateError.code,
      })

      return jsonError("Erro ao atualizar conexão Asaas.", 500)
    }

    return NextResponse.json({
      success: true,
      connected: true,
      message: "Conexão Asaas atualizada com sucesso.",
      account: formatAccount(data),
    })
  } catch (error) {
    console.error("PUT /api/asaas/account error:", error)

    if (isAuthError(error)) {
      return jsonError("Não autorizado.", 401)
    }

    if (isRestaurantNotFound(error)) {
      return jsonError("Restaurante não encontrado.", 404)
    }

    return jsonError("Erro ao atualizar conexão Asaas.", 500)
  }
}