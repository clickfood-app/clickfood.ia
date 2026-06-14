import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import crypto from "node:crypto"
import { createRequire } from "node:module"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PaymentIntegration = {
  restaurant_id: string
  provider: string
  enabled: boolean
  environment: string
  client_id: string | null
  client_secret: string | null
  pix_key: string | null
  certificate_storage_path: string | null
  certificate_file_name: string | null
}

type EfiOptions = {
  sandbox: boolean
  client_id: string
  client_secret: string
  certificate: string
  cert_base64: boolean
  validateMtls?: boolean
}

type EfiClient = {
  pixConfigWebhook: (
    params: { chave: string },
    body: { webhookUrl: string }
  ) => Promise<unknown>
}

type EfiConstructor = new (options: EfiOptions) => EfiClient

type ConfigureWebhookPayload = {
  restaurant_id: string
  webhook_url?: string
}

const require = createRequire(import.meta.url)
const EfiPay = require("sdk-node-apis-efi") as EfiConstructor

const EFI_CERTIFICATES_BUCKET = "efi-certificates"
const DEFAULT_EFI_WEBHOOK_BASE_URL = "https://efi-webhook.clickfoodbr.com"

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`)
  }

  return value
}

function getSupabaseAdmin() {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY")

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
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

function validateConfigSecret(request: NextRequest) {
  const expectedSecret = getRequiredEnv("EFI_WEBHOOK_CONFIG_SECRET")
  const receivedSecret = request.headers.get("x-clickfood-config-secret")?.trim()

  if (!receivedSecret || receivedSecret !== expectedSecret) {
    throw new Error("Configuração não autorizada.")
  }
}

async function getEfiIntegration(restaurantId: string) {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from("restaurant_payment_integrations")
    .select(
      `
      restaurant_id,
      provider,
      enabled,
      environment,
      client_id,
      client_secret,
      pix_key,
      certificate_storage_path,
      certificate_file_name
    `
    )
    .eq("restaurant_id", restaurantId)
    .eq("provider", "efi")
    .maybeSingle()

  if (error) {
    throw new Error(`Erro ao buscar integração Efí: ${error.message}`)
  }

  if (!data) {
    throw new Error("Integração Efí não encontrada para este restaurante.")
  }

  return data as PaymentIntegration
}

async function downloadCertificateToTempFile(certificateStoragePath: string) {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase.storage
    .from(EFI_CERTIFICATES_BUCKET)
    .download(certificateStoragePath)

  if (error) {
    throw new Error(`Erro ao baixar certificado Efí: ${error.message}`)
  }

  if (!data) {
    throw new Error("Certificado Efí não encontrado no Storage.")
  }

  const certificateBuffer = Buffer.from(await data.arrayBuffer())
  const tempFilePath = path.join(os.tmpdir(), `efi-${crypto.randomUUID()}.p12`)

  fs.writeFileSync(tempFilePath, certificateBuffer)

  return tempFilePath
}

function createEfiClient(integration: PaymentIntegration, certificatePath: string) {
  if (!integration.enabled) {
    throw new Error("Integração Efí está desativada para este restaurante.")
  }

  if (!integration.client_id) {
    throw new Error("Client ID da Efí não cadastrado.")
  }

  if (!integration.client_secret) {
    throw new Error("Client Secret da Efí não cadastrado.")
  }

  if (!integration.pix_key) {
    throw new Error("Chave Pix da Efí não cadastrada.")
  }

  if (!integration.certificate_storage_path) {
    throw new Error("Caminho do certificado Efí não cadastrado.")
  }

  const isSandbox = integration.environment !== "production"

  return {
    efipay: new EfiPay({
      sandbox: isSandbox,
      client_id: integration.client_id,
      client_secret: integration.client_secret,
      certificate: certificatePath,
      cert_base64: false,
      validateMtls: false,
    }),
    isSandbox,
  }
}

async function updateWebhookResult({
  restaurantId,
  webhookUrl,
  errorMessage,
}: {
  restaurantId: string
  webhookUrl: string
  errorMessage: string | null
}) {
  const supabase = getSupabaseAdmin()

  await supabase
    .from("restaurant_payment_integrations")
    .update({
      webhook_token: webhookUrl,
      last_connection_test_at: new Date().toISOString(),
      last_connection_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("restaurant_id", restaurantId)
    .eq("provider", "efi")
}

export async function POST(request: NextRequest) {
  let tempCertificatePath: string | null = null
  let restaurantId: string | null = null
  let webhookUrl = DEFAULT_EFI_WEBHOOK_BASE_URL

  try {
    validateConfigSecret(request)

    const payload = (await request.json()) as ConfigureWebhookPayload

    restaurantId = payload.restaurant_id?.trim() || null
    webhookUrl = payload.webhook_url?.trim() || DEFAULT_EFI_WEBHOOK_BASE_URL

    if (!restaurantId) {
      throw new Error("restaurant_id é obrigatório.")
    }

    if (!webhookUrl.startsWith("https://")) {
      throw new Error("webhook_url precisa começar com https://")
    }

    const integration = await getEfiIntegration(restaurantId)

    if (!integration.certificate_storage_path) {
      throw new Error("Caminho do certificado Efí não cadastrado.")
    }

    tempCertificatePath = await downloadCertificateToTempFile(
      integration.certificate_storage_path
    )

    const { efipay, isSandbox } = createEfiClient(integration, tempCertificatePath)

    const response = await efipay.pixConfigWebhook(
      {
        chave: integration.pix_key as string,
      },
      {
        webhookUrl,
      }
    )

    await updateWebhookResult({
      restaurantId,
      webhookUrl,
      errorMessage: null,
    })

    return NextResponse.json({
      success: true,
      message: "Webhook Pix Efí configurado com sucesso.",
      restaurant_id: restaurantId,
      environment: isSandbox ? "sandbox" : "production",
      webhook_url_configured: webhookUrl,
      callback_expected_at: `${webhookUrl}/pix`,
      efi_response: response,
    })
  } catch (error) {
    const normalizedError = normalizeError(error)
    const errorMessage =
      typeof normalizedError === "object" &&
      normalizedError !== null &&
      "message" in normalizedError
        ? String(normalizedError.message)
        : "Erro desconhecido."

    if (restaurantId) {
      await updateWebhookResult({
        restaurantId,
        webhookUrl,
        errorMessage,
      }).catch(() => null)
    }

    return NextResponse.json(
      {
        success: false,
        message: "Erro ao configurar webhook Pix Efí.",
        error: normalizedError,
      },
      { status: 500 }
    )
  } finally {
    if (tempCertificatePath && fs.existsSync(tempCertificatePath)) {
      fs.unlinkSync(tempCertificatePath)
    }
  }
}