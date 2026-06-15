import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const EFI_CERTIFICATES_BUCKET = "efi-certificates"
const MAX_CERTIFICATE_SIZE_BYTES = 1024 * 1024

type EfiIntegrationRow = {
  id: string
  restaurant_id: string
  provider: string
  enabled: boolean
  environment: string
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

function normalizeFileName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120)
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
    console.error("Erro ao buscar restaurante em /api/efi/account/certificate:", {
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

export async function POST(request: NextRequest) {
  try {
    const { error, restaurant } = await getAuthenticatedRestaurant()

    if (error || !restaurant) {
      return error
    }

    const formData = await request.formData()
    const certificate = formData.get("certificate")

    if (!(certificate instanceof File)) {
      return jsonError("Envie um arquivo de certificado .p12.")
    }

    if (!certificate.name.toLowerCase().endsWith(".p12")) {
      return jsonError("O certificado precisa ser um arquivo .p12.")
    }

    if (certificate.size <= 0) {
      return jsonError("O certificado enviado esta vazio.")
    }

    if (certificate.size > MAX_CERTIFICATE_SIZE_BYTES) {
      return jsonError("O certificado deve ter no maximo 1MB.")
    }

    const admin = createAdminClient()
    const existing = await getExistingIntegration(restaurant.id)

    const originalFileName = normalizeFileName(certificate.name)
    const timestamp = Date.now()
    const storagePath = `${restaurant.id}/efi-${timestamp}-${originalFileName}`

    const arrayBuffer = await certificate.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await admin.storage
      .from(EFI_CERTIFICATES_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: "application/x-pkcs12",
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Erro ao enviar certificado Efi: ${uploadError.message}`)
    }

    if (existing?.certificate_storage_path) {
      await admin.storage
        .from(EFI_CERTIFICATES_BUCKET)
        .remove([existing.certificate_storage_path])
    }

    const payload = {
      restaurant_id: restaurant.id,
      provider: "efi",
      certificate_storage_path: storagePath,
      certificate_file_name: certificate.name,
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
        throw new Error(`Erro ao atualizar certificado Efi: ${updateError.message}`)
      }

      saved = data as EfiIntegrationRow
    } else {
      const { data, error: insertError } = await admin
        .from("restaurant_payment_integrations")
        .insert({
          ...payload,
          enabled: false,
          environment: "production",
          created_at: new Date().toISOString(),
        })
        .select(
          "id, restaurant_id, provider, enabled, environment, client_id, client_secret, pix_key, certificate_storage_path, certificate_file_name, last_connection_test_at, last_connection_error, created_at, updated_at"
        )
        .single()

      if (insertError) {
        throw new Error(`Erro ao salvar certificado Efi: ${insertError.message}`)
      }

      saved = data as EfiIntegrationRow
    }

    return NextResponse.json({
      success: true,
      message: "Certificado Efi enviado com sucesso.",
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
      },
      ...serializeIntegration(saved),
    })
  } catch (error) {
    console.error("Erro em POST /api/efi/account/certificate:", error)

    return jsonError(
      error instanceof Error
        ? error.message
        : "Erro ao enviar certificado Efi.",
      500
    )
  }
}
