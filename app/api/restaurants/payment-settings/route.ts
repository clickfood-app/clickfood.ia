import { NextResponse } from "next/server"

function deprecatedPaymentSettingsResponse() {
  return NextResponse.json(
    {
      error:
        "Esta rota foi desativada. Use /api/asaas/account para configurar pagamentos com segurança.",
    },
    { status: 410 }
  )
}

export async function GET() {
  return deprecatedPaymentSettingsResponse()
}

export async function POST() {
  return deprecatedPaymentSettingsResponse()
}