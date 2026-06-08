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

    const body = await request.json().catch(() => ({}))

    const limit =
      typeof body?.limit === "number" && Number.isFinite(body.limit)
        ? Math.min(Math.max(Math.floor(body.limit), 1), 10)
        : 5

    const tokenHash = hashToken(token)

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { data, error } = await supabase.rpc("claim_order_print_jobs", {
      p_token_hash: tokenHash,
      p_limit: limit,
    })

    if (error) {
      const isUnauthorized = error.message?.includes("DEVICE_NOT_AUTHORIZED")

      return NextResponse.json(
        {
          success: false,
          error: isUnauthorized
            ? "Dispositivo não autorizado para impressão."
            : "Erro ao buscar fila de impressão.",
        },
        { status: isUnauthorized ? 403 : 500 },
      )
    }

    return NextResponse.json({
      success: true,
      jobs: data ?? [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao buscar fila de impressão.",
      },
      { status: 500 },
    )
  }
}