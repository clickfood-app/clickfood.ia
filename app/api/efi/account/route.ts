import { NextResponse } from "next/server"
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import crypto from "node:crypto"
import { createRequire } from "node:module"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const require = createRequire(import.meta.url)
const EfiPay = require("sdk-node-apis-efi")

const EFI_CERTIFICATES_BUCKET = "efi-certificates"

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

type EfiClient = {
  pixListCharges?: (params: {
    inicio: string
    fim: string
  }) => Promise<unknown>
}

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      details,
    },
    { status }
  )
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

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    }
  }

  if (typeof error === "object" && error !== null) {
    return error
  }

  return {
    message: String(error),
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
    console.error("Erro ao buscar restaurante em /api/efi/account/test:", {
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

async function downloadCertificateToTempFile(certificateStoragePath: string) {
  const admin = createAdminClient()

  const { data, error } = await admin.storage
    .from(EFI_CERTIFICATES_BUCKET)
    .download(certificateStoragePath)

  if (error) {
    throw new Error(`Erro ao baixar certificado Efi: ${error.message}`)
  }

  if (!data) {
    throw new Error("Certificado Efi nao encontrado no Storage.")
  }

  const certificateBuffer = Buffer.from(await data.arrayBuffer())
  const tempFilePath = path.join(os.tmpdir(), `efi-test-${crypto.randomUUID()}.p12`)

  fs.writeFileSync(tempFilePath, certificateBuffer)

  return tempFilePath
}

function createEfiClient(integration: EfiIntegrationRow, certificatePath: string) {
  if (!integration.client_id) {
    throw new Error("Client ID da Efi nao cadastrado.")
  }

  if (!integration.client_secret) {
    throw new Error("Client Secret da Efi nao cadastrado.")
  }

  if (!integration.pix_key) {
    throw new Error("Chave Pix da Efi nao cadastrada.")
  }

  const isSandbox = integration.environment !== "production"

  return new EfiPay({
    sandbox: isSandbox,
    client_id: integration.client_id,
    client_secret: integration.client_secret,
    certificate: certificatePath,
    cert_base64: false,
  }) as EfiClient
}

async function saveConnectionTestResult({
  integrationId,
  success,
  message,
}: {
  integrationId: string
  success: boolean
  message: string | null
}) {
  const admin = createAdminClient()

  await admin
    .from("restaurant_payment_integrations")
    .update({
      last_connection_test_at: new Date().toISOString(),
      last_connection_error: success ? null : message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integrationId)
}

export async function POST() {
  let tempCertificatePath: string | null = null

  try {
    const { error, restaurant } = await getAuthenticatedRestaurant()

    if (error || !restaurant) {
      return error
    }

    const integration = await getExistingIntegration(restaurant.id)

    if (!integration) {
      return jsonError("Configure a conta Efi antes de testar a conexao.", 400)
    }

    if (!integration.certificate_storage_path) {
      return jsonError("Envie o certificado .p12 da Efi antes de testar.", 400)
    }

    tempCertificatePath = await downloadCertificateToTempFile(
      integration.certificate_storage_path
    )

    const efipay = createEfiClient(integration, tempCertificatePath)

    if (typeof efipay.pixListCharges !== "function") {
      throw new Error("Metodo pixListCharges nao encontrado no SDK da Efi.")
    }

    const now = new Date()
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    await efipay.pixListCharges({
      inicio: start.toISOString(),
      fim: now.toISOString(),
    })

    await saveConnectionTestResult({
      integrationId: integration.id,
      success: true,
      message: null,
    })

    return NextResponse.json({
      success: true,
      message: "Conexao Efi validada com sucesso.",
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
      },
      account: {
        provider: "efi",
        environment: integration.environment,
        enabled: Boolean(integration.enabled),
        hasClientId: Boolean(integration.client_id),
        hasClientSecret: Boolean(integration.client_secret),
        hasPixKey: Boolean(integration.pix_key),
        hasCertificate: Boolean(integration.certificate_storage_path),
        certificateFileName: integration.certificate_file_name,
        lastConnectionTestAt: new Date().toISOString(),
        lastConnectionError: null,
      },
    })
  } catch (error) {
    const normalizedError = normalizeError(error)
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel validar a conexao Efi."

    try {
      const { restaurant } = await getAuthenticatedRestaurant()

      if (restaurant) {
        const integration = await getExistingIntegration(restaurant.id)

        if (integration?.id) {
          await saveConnectionTestResult({
            integrationId: integration.id,
            success: false,
            message,
          })
        }
      }
    } catch {
      // Ignora erro secundario ao salvar resultado do teste.
    }

    console.error("Erro em POST /api/efi/account/test:", normalizedError)

    return jsonError(message, 400, normalizedError)
  } finally {
    if (tempCertificatePath && fs.existsSync(tempCertificatePath)) {
      fs.unlinkSync(tempCertificatePath)
    }
  }
}
