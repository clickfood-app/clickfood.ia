import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    { error: "Use /api/mercadopago/checkout para criar preferencias." },
    { status: 410 }
  )
}
