import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { supabaseAdmin } from "@/lib/supabase-admin"

type LoginPayload = {
  slug?: string
  pin?: string
  device_name?: string
}

function normalizePin(pin: string) {
  return String(pin || "").replace(/\D/g, "")
}

function createSessionToken() {
  return randomBytes(32).toString("hex")
}

function getCookieName(slug: string) {
  return `waiter_session_${slug}`
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginPayload

    const slug = String(body.slug || "").trim()
    const pin = normalizePin(String(body.pin || ""))
    const deviceName = String(body.device_name || "Tablet do garçom").trim()

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Slug do restaurante não informado." },
        { status: 400 },
      )
    }

    if (pin.length < 4 || pin.length > 8) {
      return NextResponse.json(
        { success: false, error: "PIN inválido." },
        { status: 400 },
      )
    }

    const { data: waiterData, error: verifyError } = await supabaseAdmin.rpc(
      "verify_waiter_pin",
      {
        p_restaurant_slug: slug,
        p_pin: pin,
      },
    )

    if (verifyError) {
      console.error("Erro ao validar PIN do garçom:", verifyError)

      return NextResponse.json(
        { success: false, error: "Erro ao validar acesso." },
        { status: 500 },
      )
    }

    const waiter = Array.isArray(waiterData) ? waiterData[0] : null

    if (!waiter) {
      return NextResponse.json(
        { success: false, error: "PIN inválido ou garçom inativo." },
        { status: 401 },
      )
    }

    const token = createSessionToken()

    const { data: sessionData, error: sessionError } = await supabaseAdmin.rpc(
      "create_waiter_session",
      {
        p_waiter_user_id: waiter.waiter_id,
        p_token: token,
        p_device_name: deviceName,
      },
    )

    if (sessionError) {
      console.error("Erro ao criar sessão do garçom:", sessionError)

      return NextResponse.json(
        { success: false, error: "Erro ao criar sessão do garçom." },
        { status: 500 },
      )
    }

    const session = Array.isArray(sessionData) ? sessionData[0] : null

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Sessão não criada." },
        { status: 500 },
      )
    }

    const response = NextResponse.json({
      success: true,
      waiter: {
        id: waiter.waiter_id,
        restaurant_id: waiter.restaurant_id,
        name: waiter.waiter_name,
        role: waiter.waiter_role,
      },
      session: {
        expires_at: session.expires_at,
      },
    })

    response.cookies.set(getCookieName(slug), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(session.expires_at),
    })

    return response
  } catch (err) {
    console.error("Erro inesperado no login do garçom:", err)

    return NextResponse.json(
      { success: false, error: "Erro inesperado no login do garçom." },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = String(searchParams.get("slug") || "").trim()

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Slug do restaurante não informado." },
        { status: 400 },
      )
    }

    const token = request.cookies.get(getCookieName(slug))?.value

    if (!token) {
      return NextResponse.json(
        { success: false, authenticated: false, error: "Sessão não encontrada." },
        { status: 401 },
      )
    }

    const { data: sessionData, error: sessionError } = await supabaseAdmin.rpc(
      "validate_waiter_session",
      {
        p_token: token,
      },
    )

    if (sessionError) {
      console.error("Erro ao validar sessão do garçom:", sessionError)

      return NextResponse.json(
        { success: false, authenticated: false, error: "Erro ao validar sessão." },
        { status: 500 },
      )
    }

    const session = Array.isArray(sessionData) ? sessionData[0] : null

    if (!session) {
      return NextResponse.json(
        { success: false, authenticated: false, error: "Sessão inválida." },
        { status: 401 },
      )
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      waiter: {
        id: session.waiter_id,
        restaurant_id: session.restaurant_id,
        name: session.waiter_name,
        role: session.waiter_role,
      },
    })
  } catch (err) {
    console.error("Erro inesperado ao validar sessão do garçom:", err)

    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        error: "Erro inesperado ao validar sessão do garçom.",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = String(searchParams.get("slug") || "").trim()

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Slug do restaurante não informado." },
        { status: 400 },
      )
    }

    const response = NextResponse.json({
      success: true,
    })

    response.cookies.set(getCookieName(slug), "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    })

    return response
  } catch (err) {
    console.error("Erro inesperado ao sair da sessão do garçom:", err)

    return NextResponse.json(
      { success: false, error: "Erro inesperado ao sair." },
      { status: 500 },
    )
  }
}