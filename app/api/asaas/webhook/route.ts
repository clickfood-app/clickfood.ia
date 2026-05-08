import { NextRequest, NextResponse } from "next/server"

const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN

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

    const body = await req.json()

    console.log("ASAAS WEBHOOK RECEBIDO:", JSON.stringify(body, null, 2))

    return NextResponse.json({
      success: true,
      received: true,
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