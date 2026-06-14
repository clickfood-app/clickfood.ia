import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type EfiPixWebhookItem = {
  endToEndId?: string
  txid?: string
  chave?: string
  valor?: string
  horario?: string
  infoPagador?: string
  [key: string]: unknown
}

type PaymentTransaction = {
  id: string
  order_id: string
  status: string
}

type OrderRecord = {
  id: string
  status: string
  payment_status: string
}

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

function validateWebhookSecret(request: NextRequest) {
  const expectedSecret = getRequiredEnv("EFI_WEBHOOK_PROXY_SECRET")
  const receivedSecret = request.headers.get("x-clickfood-webhook-secret")?.trim()

  if (!receivedSecret || receivedSecret !== expectedSecret) {
    throw new Error("Webhook não autorizado.")
  }
}

function extractPixItems(payload: unknown): EfiPixWebhookItem[] {
  if (!payload || typeof payload !== "object") {
    return []
  }

  const payloadObject = payload as Record<string, unknown>
  const pix = payloadObject.pix

  if (Array.isArray(pix)) {
    return pix.filter(
      (item): item is EfiPixWebhookItem =>
        Boolean(item) && typeof item === "object"
    )
  }

  if (typeof payloadObject.txid === "string") {
    return [payloadObject as EfiPixWebhookItem]
  }

  return []
}

async function saveWebhookEvent({
  providerChargeId,
  providerTransactionId,
  eventType,
  payload,
  processed,
}: {
  providerChargeId: string | null
  providerTransactionId: string | null
  eventType: string
  payload: unknown
  processed: boolean
}) {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from("payment_webhook_events")
    .insert({
      provider: "efi",
      provider_charge_id: providerChargeId,
      provider_transaction_id: providerTransactionId,
      event_type: eventType,
      payload,
      processed,
    })
    .select("id")
    .single()

  if (error || !data) {
    throw new Error(`Erro ao salvar evento webhook Efí: ${error?.message}`)
  }

  return data.id as string
}

async function markWebhookEventAsProcessed(eventId: string) {
  const supabase = getSupabaseAdmin()

  const { error } = await supabase
    .from("payment_webhook_events")
    .update({
      processed: true,
    })
    .eq("id", eventId)

  if (error) {
    throw new Error(`Erro ao marcar webhook como processado: ${error.message}`)
  }
}

async function findTransactionByTxid(txid: string) {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from("payment_transactions")
    .select("id, order_id, status")
    .eq("provider", "efi")
    .eq("provider_charge_id", txid)
    .maybeSingle()

  if (error) {
    throw new Error(`Erro ao buscar transação Efí: ${error.message}`)
  }

  return data as PaymentTransaction | null
}

async function findOrder(orderId: string) {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from("orders")
    .select("id, status, payment_status")
    .eq("id", orderId)
    .maybeSingle()

  if (error) {
    throw new Error(`Erro ao buscar pedido: ${error.message}`)
  }

  return data as OrderRecord | null
}

async function markTransactionAsPaid({
  transaction,
  endToEndId,
  paidAt,
}: {
  transaction: PaymentTransaction
  endToEndId: string | null
  paidAt: string
}) {
  const supabase = getSupabaseAdmin()

  const { error } = await supabase
    .from("payment_transactions")
    .update({
      status: "paid",
      provider_transaction_id: endToEndId,
      paid_at: paidAt,
      updated_at: paidAt,
    })
    .eq("id", transaction.id)

  if (error) {
    throw new Error(`Erro ao marcar transação como paga: ${error.message}`)
  }
}

async function markOrderAsPaid(orderId: string, paidAt: string) {
  const supabase = getSupabaseAdmin()
  const order = await findOrder(orderId)

  if (!order) {
    throw new Error("Pedido vinculado à transação não foi encontrado.")
  }

  const nextStatus = order.status === "awaiting_payment" ? "pending" : order.status

  const { error } = await supabase
    .from("orders")
    .update({
      status: nextStatus,
      payment_status: "paid",
      pix_confirmed_at: paidAt,
    })
    .eq("id", orderId)

  if (error) {
    throw new Error(`Erro ao marcar pedido como pago: ${error.message}`)
  }
}

async function processPixItem(item: EfiPixWebhookItem, fullPayload: unknown) {
  const txid = item.txid?.trim() || null
  const endToEndId = item.endToEndId?.trim() || null
  const paidAt = item.horario || new Date().toISOString()

  const eventId = await saveWebhookEvent({
    providerChargeId: txid,
    providerTransactionId: endToEndId,
    eventType: "pix.received",
    payload: {
      item,
      fullPayload,
    },
    processed: false,
  })

  if (!txid) {
    return {
      eventId,
      processed: false,
      reason: "Webhook Efí sem txid.",
    }
  }

  const transaction = await findTransactionByTxid(txid)

  if (!transaction) {
    return {
      eventId,
      txid,
      processed: false,
      reason: "Transação não encontrada para este txid.",
    }
  }

  await markTransactionAsPaid({
    transaction,
    endToEndId,
    paidAt,
  })

  await markOrderAsPaid(transaction.order_id, paidAt)
  await markWebhookEventAsProcessed(eventId)

  return {
    eventId,
    txid,
    transactionId: transaction.id,
    orderId: transaction.order_id,
    processed: true,
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Efí webhook receive route online.",
  })
}

export async function POST(request: NextRequest) {
  try {
    validateWebhookSecret(request)

    const payload = await request.json()
    const pixItems = extractPixItems(payload)

    if (pixItems.length === 0) {
      const eventId = await saveWebhookEvent({
        providerChargeId: null,
        providerTransactionId: null,
        eventType: "unknown",
        payload,
        processed: false,
      })

      return NextResponse.json({
        success: true,
        message: "Webhook Efí recebido, mas nenhum Pix foi encontrado no payload.",
        eventId,
        processed: false,
      })
    }

    const results = []

    for (const item of pixItems) {
      const result = await processPixItem(item, payload)
      results.push(result)
    }

    return NextResponse.json({
      success: true,
      message: "Webhook Efí recebido.",
      results,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Erro ao processar webhook Efí.",
        error: normalizeError(error),
      },
      { status: 500 }
    )
  }
}