import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import crypto from "node:crypto"
import { createRequire } from "node:module"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CheckoutItem = {
  product_id?: string | null
  product_name: string
  quantity: number
  unit_price: number
  total_price?: number
  modifiers?: unknown[]
  notes?: string | null
}

type CheckoutPayload = {
  restaurant_id: string
  customer_name: string
  customer_phone: string
  order_type?: string | null
  customer_address?: string | null
  customer_neighborhood?: string | null
  delivery_address?: string | null
  delivery_neighborhood?: string | null
  notes?: string | null
  subtotal: number
  discount?: number
  delivery_fee?: number
  total: number
  items: CheckoutItem[]
}

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
}

type PixCreateImmediateChargeBody = {
  calendario: {
    expiracao: number
  }
  valor: {
    original: string
  }
  chave: string
  solicitacaoPagador?: string
  infoAdicionais?: Array<{
    nome: string
    valor: string
  }>
}

type PixChargeResponse = {
  txid?: string
  status?: string
  loc?: {
    id?: number
    location?: string
    tipoCob?: string
    criacao?: string
  }
  pixCopiaECola?: string
  [key: string]: unknown
}

type PixQrCodeResponse = {
  qrcode?: string
  imagemQrcode?: string
  linkVisualizacao?: string
  [key: string]: unknown
}

type EfiClient = {
  pixCreateImmediateCharge: (
    params: Record<string, never>,
    body: PixCreateImmediateChargeBody
  ) => Promise<PixChargeResponse>
  pixGenerateQRCode: (params: { id: number }) => Promise<PixQrCodeResponse>
}

type EfiConstructor = new (options: EfiOptions) => EfiClient

const require = createRequire(import.meta.url)
const EfiPay = require("sdk-node-apis-efi") as EfiConstructor

const EFI_CERTIFICATES_BUCKET = "efi-certificates"
const PIX_EXPIRATION_SECONDS = 30 * 60

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

function moneyToCents(value: number) {
  return Math.round(Number(value || 0) * 100)
}

function formatMoneyToEfi(value: number) {
  return (Math.round(Number(value || 0) * 100) / 100).toFixed(2)
}

function generatePublicOrderNumber() {
  const now = new Date()
  const datePart = [
    now.getFullYear().toString().slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("")

  const randomPart = Math.floor(1000 + Math.random() * 9000)

  return `${datePart}${randomPart}`
}

function validatePayload(payload: CheckoutPayload) {
  if (!payload.restaurant_id) {
    throw new Error("restaurant_id é obrigatório.")
  }

  if (!payload.customer_name?.trim()) {
    throw new Error("Nome do cliente é obrigatório.")
  }

  if (!payload.customer_phone?.trim()) {
    throw new Error("Telefone do cliente é obrigatório.")
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("O pedido precisa ter pelo menos um item.")
  }

  if (!Number.isFinite(Number(payload.total)) || Number(payload.total) <= 0) {
    throw new Error("Total do pedido inválido.")
  }

  for (const item of payload.items) {
    if (!item.product_name?.trim()) {
      throw new Error("Todos os itens precisam ter nome.")
    }

    if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
      throw new Error(`Quantidade inválida para o item ${item.product_name}.`)
    }

    if (!Number.isFinite(Number(item.unit_price)) || Number(item.unit_price) < 0) {
      throw new Error(`Preço inválido para o item ${item.product_name}.`)
    }
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

  const isSandbox = integration.environment !== "production"

  return {
    efipay: new EfiPay({
      sandbox: isSandbox,
      client_id: integration.client_id,
      client_secret: integration.client_secret,
      certificate: certificatePath,
      cert_base64: false,
    }),
    isSandbox,
  }
}

export async function POST(request: NextRequest) {
  let tempCertificatePath: string | null = null
  let createdOrderId: string | null = null

  try {
    const payload = (await request.json()) as CheckoutPayload
    validatePayload(payload)

    const supabase = getSupabaseAdmin()

    const integration = await getEfiIntegration(payload.restaurant_id)

    if (!integration.certificate_storage_path) {
      throw new Error("Caminho do certificado Efí não cadastrado.")
    }

    tempCertificatePath = await downloadCertificateToTempFile(
      integration.certificate_storage_path
    )

    const { efipay } = createEfiClient(integration, tempCertificatePath)

    const publicOrderNumber = generatePublicOrderNumber()
    const subtotal = Number(payload.subtotal || 0)
    const discount = Number(payload.discount || 0)
    const deliveryFee = Number(payload.delivery_fee || 0)
    const total = Number(payload.total || 0)

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        restaurant_id: payload.restaurant_id,
        public_order_number: publicOrderNumber,
        customer_name: payload.customer_name.trim(),
        customer_phone: payload.customer_phone.trim(),
        status: "awaiting_payment",
        subtotal,
        discount,
        delivery_fee: deliveryFee,
        total,
        payment_method: "efi_pix",
        payment_status: "pending",
        notes: payload.notes || null,
        customer_address: payload.customer_address || payload.delivery_address || null,
        customer_neighborhood:
          payload.customer_neighborhood || payload.delivery_neighborhood || null,
        delivery_address: payload.delivery_address || payload.customer_address || null,
        delivery_neighborhood:
          payload.delivery_neighborhood || payload.customer_neighborhood || null,
        order_type: payload.order_type || "delivery",
        order_source: "public_menu",
        accept_by: null,
      })
      .select("id, public_order_number, total")
      .single()

    if (orderError || !order) {
      throw new Error(`Erro ao criar pedido: ${orderError?.message}`)
    }

    createdOrderId = order.id

    const orderItems = payload.items.map((item) => {
      const quantity = Number(item.quantity)
      const unitPrice = Number(item.unit_price)
      const totalPrice =
        item.total_price !== undefined
          ? Number(item.total_price)
          : quantity * unitPrice

      return {
        order_id: order.id,
        product_id: item.product_id || null,
        product_name: item.product_name.trim(),
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
        notes: item.notes || null,
      }
    })

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems)

    if (itemsError) {
      throw new Error(`Erro ao criar itens do pedido: ${itemsError.message}`)
    }

    const body: PixCreateImmediateChargeBody = {
      calendario: {
        expiracao: PIX_EXPIRATION_SECONDS,
      },
      valor: {
        original: formatMoneyToEfi(total),
      },
      chave: integration.pix_key as string,
      solicitacaoPagador: `Pedido ${publicOrderNumber} - ClickFood`,
      infoAdicionais: [
        {
          nome: "Pedido",
          valor: publicOrderNumber,
        },
        {
          nome: "Restaurante",
          valor: payload.restaurant_id,
        },
      ],
    }

    const charge = await efipay.pixCreateImmediateCharge({}, body)
    const locationId = charge.loc?.id

    if (!locationId) {
      throw new Error("Cobrança Efí criada, mas sem loc.id para gerar QR Code.")
    }

    const qrCode = await efipay.pixGenerateQRCode({
      id: locationId,
    })

    const expiresAt = new Date(Date.now() + PIX_EXPIRATION_SECONDS * 1000)

    const { data: transaction, error: transactionError } = await supabase
      .from("payment_transactions")
      .insert({
        restaurant_id: payload.restaurant_id,
        order_id: order.id,
        provider: "efi",
        provider_charge_id: charge.txid || String(locationId),
        provider_transaction_id: String(locationId),
        amount_cents: moneyToCents(total),
        status: "pending",
        qr_code: qrCode.imagemQrcode || null,
        qr_code_base64: qrCode.imagemQrcode || null,
        copy_paste: qrCode.qrcode || charge.pixCopiaECola || null,
        raw_response: {
          charge,
          qrCode,
        },
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single()

    if (transactionError || !transaction) {
      throw new Error(
        `Erro ao salvar transação Pix Efí: ${transactionError?.message}`
      )
    }

    return NextResponse.json({
      success: true,
      message: "Pedido criado e Pix Efí gerado com sucesso.",
      order: {
        id: order.id,
        public_order_number: order.public_order_number,
        total: order.total,
        payment_method: "efi_pix",
        payment_status: "pending",
      },
      payment: {
        transaction_id: transaction.id,
        provider: "efi",
        status: "pending",
        txid: charge.txid,
        expires_at: expiresAt.toISOString(),
        copy_paste: qrCode.qrcode || charge.pixCopiaECola || null,
        qr_code_base64: qrCode.imagemQrcode || null,
        link_visualizacao: qrCode.linkVisualizacao || null,
      },
    })
  } catch (error) {
    if (createdOrderId) {
      try {
        const supabase = getSupabaseAdmin()

        await supabase
          .from("orders")
          .update({
            status: "cancelled",
            payment_status: "failed",
            cancelled_at: new Date().toISOString(),
            notes: "Pedido cancelado automaticamente por falha ao gerar Pix Efí.",
          })
          .eq("id", createdOrderId)
      } catch {
        // Ignora falha ao cancelar pedido criado parcialmente.
      }
    }

    return NextResponse.json(
      {
        success: false,
        message: "Erro ao criar pedido com Pix Efí.",
        error: normalizeError(error),
      },
      { status: 500 }
    )
  } finally {
    if (tempCertificatePath && fs.existsSync(tempCertificatePath)) {
      fs.unlinkSync(tempCertificatePath)
    }
  }
}