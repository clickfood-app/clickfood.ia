import { NextRequest, NextResponse } from "next/server"

const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN

type AsaasWebhookBody = {
  event?: string
  payment?: {
    id?: string
    status?: string
    value?: number
    netValue?: number
    billingType?: string
    externalReference?: string | null
    description?: string | null
  }
}

const PAID_EVENTS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"])

export async function POST(req: NextRequest) {
  try {
    const receivedToken = req.headers.get("asaas-access-token")

    if (!ASAAS_WEBHOOK_TOKEN) {
      return NextResponse.json(
        { success: false, error: "ASAAS_WEBHOOK_TOKEN não configurado." },
        { status: 500 }
      )
    }

    if (!receivedToken || receivedToken !== ASAAS_WEBHOOK_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Token do webhook inválido." },
        { status: 401 }
      )
    }

    const body = (await req.json()) as AsaasWebhookBody

    const event = body.event || null
    const paymentId = body.payment?.id || null
    const paymentStatus = body.payment?.status || null
    const externalReference = body.payment?.externalReference || null
    const value = body.payment?.value || null
    const netValue = body.payment?.netValue || null
    const billingType = body.payment?.billingType || null
    const description = body.payment?.description || null

    const shouldMarkAsPaid = !!event && PAID_EVENTS.has(event)

    console.log("ASAAS WEBHOOK NORMALIZADO:", {
      event,
      paymentId,
      paymentStatus,
      externalReference,
      value,
      netValue,
      billingType,
      description,
      shouldMarkAsPaid,
    })

    if (!shouldMarkAsPaid) {
      return NextResponse.json({
        success: true,
        received: true,
        ignored: true,
        event,
        paymentId,
        paymentStatus,
        externalReference,
      })
    }

    return NextResponse.json({
      success: true,
      received: true,
      processed: true,
      shouldMarkAsPaid: true,
      event,
      paymentId,
      paymentStatus,
      externalReference,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao processar webhook do Asaas.",
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Webhook Asaas online.",
  })
}