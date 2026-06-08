import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function getDesktopToken(request: NextRequest) {
  const headerToken = request.headers.get("x-clickfood-desktop-token")

  if (headerToken && headerToken.trim()) {
    return headerToken.trim()
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const token = getDesktopToken(request)

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Token do ClickFood Desktop não informado.",
        },
        { status: 401 },
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Configuração do servidor incompleta.",
        },
        { status: 500 },
      )
    }

    const body = await request.json().catch(() => null)

    const jobId = body?.jobId
    const errorMessage =
      typeof body?.errorMessage === "string" && body.errorMessage.trim()
        ? body.errorMessage.trim()
        : "Falha ao imprimir pelo ClickFood Desktop."

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "ID do job de impressão não informado.",
        },
        { status: 400 },
      )
    }

    const tokenHash = hashToken(token)

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { data, error } = await supabase.rpc("fail_order_print_job", {
      p_token_hash: tokenHash,
      p_job_id: jobId,
      p_error_message: errorMessage,
    })

    if (error) {
      const isUnauthorized = error.message?.includes("DEVICE_NOT_AUTHORIZED")

      return NextResponse.json(
        {
          success: false,
          error: isUnauthorized
            ? "Dispositivo não autorizado para registrar falha de impressão."
            : "Erro ao registrar falha de impressão.",
        },
        { status: isUnauthorized ? 403 : 500 },
      )
    }

    return NextResponse.json(data ?? { success: true })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao registrar falha de impressão.",
      },
      { status: 500 },
    )
  }
}