import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"

type EfiEnvironment = "sandbox" | "production"

type EfiIntegrationRow = {
  id: string
  restaurant_id: string
  provider: string
  enabled: boolean
  environment: EfiEnvironment
  client_id: string | null
  client_secret: string | null
  pix_key: string | null
  certificate_storage_path: string | null
  certificate_file_name: string | null
  last_connection_test_at: string | null
  last_connection_error: string | null
  created_at: string | null
  updated_at: string | null
}

type SaveEfiAccountBody = {
  enabled?: boolean
  environment?: string
  clientId?: string
  client_id?: string
  clientSecret?: string
  client_secret?: string
  pixKey?: string
  pix_key?: string
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Variavel de ambiente ausente: ${name}`)
  }

  return value
}

function createAdminClient() {
  return createSupabaseAdminClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}

function normalizeText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function normalizeEnvironment(value: unknown): EfiEnvironment {
  const normalized = normalizeText(value, 30).toLowerCase()

  return normalized === "sandbox" ? "sandbox" : "production"
}

function last4(value: string | null | undefined) {
  if (!value) return null

  return value.slice(-4)
}

function serializeIntegration(row: EfiIntegrationRow | null) {
  if (!row) {
    return {
      connected: false,
      account: null,
    }
  }

  const hasClientId = Boolean(row.client_id)
  const hasClientSecret = Boolean(row.client_secret)
  const hasPixKey = Boolean(row.pix_key)
  const hasCertificate = Boolean(row.certificate_storage_path)

  return {
    connected: hasClientId && hasClientSecret && hasPixKey && hasCertificate,
    account: {
      id: row.id,
      restaurantId: row.restaurant_id,
      provider: "efi",
      enabled: Boolean(row.enabled),
      environment: row.environment,
      clientIdLast4: last4(row.client_id),
      clientSecretLast4: last4(row.client_secret),
      pixKey: row.pix_key,
      pixKeyLast4: last4(row.pix_key),
      hasClientId,
      hasClientSecret,
      hasPixKey,
      hasCertificate,
      certificateFileName: row.certificate_file_name,
      lastConnectionTestAt: row.last_connection_test_at,
      lastConnectionError: row.last_connection_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      readyToEnable: hasClientId && hasClientSecret && hasPixKey && hasCertificate,
    },
  }
}

async function getAuthenticatedRestaurant() {
  const supabase = await createServerClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      error: jsonError("Nao autorizado.", 401),
      restaurant: null,
    }
  }

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, owner_id, name")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (restaurantError) {
    console.error("Erro ao buscar restaurante em /api/efi/account:", {
      message: restaurantError.message,
      code: restaurantError.code,
    })

    return {
      error: jsonError("Erro ao buscar restaurante.", 500),
      restaurant: null,
    }
  }

  if (!restaurant) {
    return {
      error: jsonError("Restaurante nao encontrado para este usuario.", 404),
      restaurant: null,
    }
  }

  return {
    error: null,
    restaurant,
  }
}

async function getExistingIntegration(restaurantId: string) {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("restaurant_payment_integrations")
    .select(
      "id, restaurant_id, provider, enabled, environment, client_id, client_secret, pix_key, certificate_storage_path, certificate_file_name, last_connection_test_at, last_connection_error, created_at, updated_at"
    )
    .eq("restaurant_id", restaurantId)
    .eq("provider", "efi")
    .maybeSingle()

  if (error) {
    throw new Error(`Erro ao buscar integracao Efi: ${error.message}`)
  }

  return data as EfiIntegrationRow | null
}

export async function GET() {
  try {
    const { error, restaurant } = await getAuthenticatedRestaurant()

    if (error || !restaurant) {
      return error
    }

    const integration = await getExistingIntegration(restaurant.id)

    return NextResponse.json({
      success: true,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
      },
      ...serializeIntegration(integration),
    })
  } catch (error) {
    console.error("Erro em GET /api/efi/account:", error)

    return jsonError(
      error instanceof Error
        ? error.message
        : "Erro ao carregar conta Efi.",
      500
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { error, restaurant } = await getAuthenticatedRestaurant()

    if (error || !restaurant) {
      return error
    }

    const body = (await request.json()) as SaveEfiAccountBody

    const existing = await getExistingIntegration(restaurant.id)

    const hasClientIdInput =
      Object.prototype.hasOwnProperty.call(body, "clientId") ||
      Object.prototype.hasOwnProperty.call(body, "client_id")

    const hasClientSecretInput =
      Object.prototype.hasOwnProperty.call(body, "clientSecret") ||
      Object.prototype.hasOwnProperty.call(body, "client_secret")

    const hasPixKeyInput =
      Object.prototype.hasOwnProperty.call(body, "pixKey") ||
      Object.prototype.hasOwnProperty.call(body, "pix_key")

    const environment = normalizeEnvironment(body.environment)
    const enabled = Boolean(body.enabled)

    const clientIdInput = normalizeText(body.clientId ?? body.client_id, 300)
    const clientSecretInput = normalizeText(
      body.clientSecret ?? body.client_secret,
      500
    )
    const pixKeyInput = normalizeText(body.pixKey ?? body.pix_key, 500)

    const nextClientId = hasClientIdInput
      ? clientIdInput || null
      : existing?.client_id ?? null

    const nextClientSecret = hasClientSecretInput
      ? clientSecretInput || null
      : existing?.client_secret ?? null

    const nextPixKey = hasPixKeyInput
      ? pixKeyInput || null
      : existing?.pix_key ?? null

    if (enabled) {
      if (!nextClientId) {
        return jsonError("Informe o Client ID da Efi para ativar.")
      }

      if (!nextClientSecret) {
        return jsonError("Informe o Client Secret da Efi para ativar.")
      }

      if (!nextPixKey) {
        return jsonError("Informe a chave Pix da Efi para ativar.")
      }

      if (!existing?.certificate_storage_path) {
        return jsonError(
          "Envie o certificado .p12 da Efi antes de ativar o Pix automatico."
        )
      }
    }

    const admin = createAdminClient()

    const payload = {
      restaurant_id: restaurant.id,
      provider: "efi",
      enabled,
      environment,
      client_id: nextClientId,
      client_secret: nextClientSecret,
      pix_key: nextPixKey,
      updated_at: new Date().toISOString(),
    }

    let saved: EfiIntegrationRow | null = null

    if (existing?.id) {
      const { data, error: updateError } = await admin
        .from("restaurant_payment_integrations")
        .update(payload)
        .eq("id", existing.id)
        .select(
          "id, restaurant_id, provider, enabled, environment, client_id, client_secret, pix_key, certificate_storage_path, certificate_file_name, last_connection_test_at, last_connection_error, created_at, updated_at"
        )
        .single()

      if (updateError) {
        throw new Error(`Erro ao atualizar conta Efi: ${updateError.message}`)
      }

      saved = data as EfiIntegrationRow
    } else {
      const { data, error: insertError } = await admin
        .from("restaurant_payment_integrations")
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select(
          "id, restaurant_id, provider, enabled, environment, client_id, client_secret, pix_key, certificate_storage_path, certificate_file_name, last_connection_test_at, last_connection_error, created_at, updated_at"
        )
        .single()

      if (insertError) {
        throw new Error(`Erro ao criar conta Efi: ${insertError.message}`)
      }

      saved = data as EfiIntegrationRow
    }

    return NextResponse.json({
      success: true,
      message: "Configuracao Efi salva com sucesso.",
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
      },
      ...serializeIntegration(saved),
    })
  } catch (error) {
    console.error("Erro em PUT /api/efi/account:", error)

    return jsonError(
      error instanceof Error ? error.message : "Erro ao salvar conta Efi.",
      500
    )
  }
}
