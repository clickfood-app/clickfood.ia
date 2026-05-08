import { NextResponse } from "next/server"
import { asaasFetch } from "@/lib/asaas"

export async function GET() {
  try {
    const data = await asaasFetch("/finance/balance")

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro interno ao conectar com o Asaas.",
      },
      { status: 500 }
    )
  }
}