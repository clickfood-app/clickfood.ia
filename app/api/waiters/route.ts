import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "Módulo de garçons removido do sistema.",
    },
    { status: 410 }
  )
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Módulo de garçons removido do sistema.",
    },
    { status: 410 }
  )
}

export async function PATCH() {
  return NextResponse.json(
    {
      success: false,
      error: "Módulo de garçons removido do sistema.",
    },
    { status: 410 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: "Módulo de garçons removido do sistema.",
    },
    { status: 410 }
  )
}