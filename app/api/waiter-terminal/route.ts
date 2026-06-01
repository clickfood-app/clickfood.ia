import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "Módulo de terminal do garçom removido do sistema.",
    },
    { status: 410 }
  )
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Módulo de terminal do garçom removido do sistema.",
    },
    { status: 410 }
  )
}