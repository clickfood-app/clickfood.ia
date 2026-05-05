import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

type MercadoPagoTokenResponse = {
  access_token: string
  token_type?: string
  expires_in?: number
  scope?: string
  user_id?: number | string
  refresh_token?: string
  public_key?: string
  live_mode?: boolean
}

function getBaseAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  )
}

function getRedirectUri() {
  return (
    process.env.NEXT_PUBLIC_MERCADOPAGO_REDIRECT_URI ||
    `${getBaseAppUrl()}/api/mercadopago/callback`
  )
}

function buildSettingsRedirect(status: "success" | "error", message?: string) {
  const url = new URL("/configuracoes?tab=payments", getBaseAppUrl())
  url.searchParams.set("mp", status)

  if (message) {
    url.searchParams.set("message", message)
  }

  return url
}

function normalizeRestaurantId(value: string | null) {
  return (value || "").trim()
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const restaurantId = normalizeRestaurantId(url.searchParams.get("state"))
    const errorParam = url.searchParams.get("error")
    const errorDescription = url.searchParams.get("error_description")

    if (errorParam) {
      return NextResponse.redirect(
        buildSettingsRedirect("error", errorDescription || errorParam)
      )
    }

    if (!code) {
      return NextResponse.redirect(
        buildSettingsRedirect("error", "Codigo de autorizacao nao recebido.")
      )
    }

    if (!restaurantId) {
      return NextResponse.redirect(
        buildSettingsRedirect("error", "Restaurant ID nao recebido no state.")
      )
    }

    const clientId = process.env.NEXT_PUBLIC_MERCADOPAGO_CLIENT_ID
    const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET
    const redirectUri = getRedirectUri()

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        buildSettingsRedirect("error", "Credenciais do Mercado Pago nao configuradas.")
      )
    }

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("id", restaurantId)
      .maybeSingle()

    if (restaurantError || !restaurant) {
      return NextResponse.redirect(
        buildSettingsRedirect("error", "Restaurante nao encontrado para vincular Mercado Pago.")
      )
    }

    const tokenResponse = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        test_token: false,
      }),
    })

    const tokenData = (await tokenResponse.json()) as MercadoPagoTokenResponse & {
      message?: string
      error?: string
    }

    if (!tokenResponse.ok || !tokenData.access_token) {
      const message =
        tokenData?.message ||
        tokenData?.error ||
        "Nao foi possivel concluir a conexao com o Mercado Pago."

      return NextResponse.redirect(buildSettingsRedirect("error", message))
    }

    const expiresInSeconds = Number(tokenData.expires_in || 0)
    const expiresAt =
      expiresInSeconds > 0
        ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
        : null

    const payload = {
      restaurant_id: restaurantId,
      mp_user_id:
        tokenData.user_id !== undefined && tokenData.user_id !== null
          ? String(tokenData.user_id)
          : null,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_at: expiresAt,
      connected_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabaseAdmin
      .from("mercadopago_connections")
      .upsert(payload, {
        onConflict: "restaurant_id",
      })

    if (upsertError) {
      return NextResponse.redirect(
        buildSettingsRedirect(
          "error",
          upsertError.message || "Erro ao salvar conexao do Mercado Pago."
        )
      )
    }

    return NextResponse.redirect(
      buildSettingsRedirect("success", "Conta Mercado Pago conectada com sucesso.")
    )
  } catch (error) {
    console.error("Mercado Pago callback error:", error)

    return NextResponse.redirect(
      buildSettingsRedirect(
        "error",
        error instanceof Error
          ? error.message
          : "Erro interno ao conectar Mercado Pago."
      )
    )
  }
}