import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
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