import { NextRequest, NextResponse } from "next/server"

// This route handles the OAuth callback from Mercado Pago
// In production with Supabase, tokens would be saved to the database here

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state") // restaurant_id
  const error = searchParams.get("error")
  
  // Handle OAuth errors
  if (error) {
    const errorDescription = searchParams.get("error_description") || "Erro desconhecido"
    return NextResponse.redirect(
      new URL(`/configuracoes?mp_error=${encodeURIComponent(errorDescription)}`, request.url)
    )
  }
  
  // Validate required params
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/configuracoes?mp_error=Parametros%20invalidos", request.url)
    )
  }
  
  // Exchange code for tokens
  const clientId = process.env.NEXT_PUBLIC_MERCADOPAGO_CLIENT_ID
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET
  const redirectUri = process.env.NEXT_PUBLIC_MERCADOPAGO_REDIRECT_URI || `${request.nextUrl.origin}/api/mercadopago/callback`
  
  if (!clientId || !clientSecret) {
    // For demo mode, redirect with success and let client-side handle mock connection
    return NextResponse.redirect(
      new URL(`/configuracoes?mp_demo=true&mp_restaurant=${state}`, request.url)
    )
  }
  
  try {
    const tokenResponse = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }),
    })
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error("Token exchange failed:", errorData)
      return NextResponse.redirect(
        new URL("/configuracoes?mp_error=Falha%20ao%20obter%20tokens", request.url)
      )
    }
    
    const tokens = await tokenResponse.json()
    
    // In production with Supabase, save tokens to database:
    // await supabase.from('mercadopago_connections').upsert({
    //   restaurant_id: state,
    //   access_token: tokens.access_token,
    //   refresh_token: tokens.refresh_token,
    //   expires_in: tokens.expires_in,
    //   user_id: tokens.user_id,
    //   connected_at: new Date().toISOString(),
    // })
    
    // For now, pass tokens to client via URL params (encoded)
    const tokenData = encodeURIComponent(JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      user_id: tokens.user_id,
      connected_at: new Date().toISOString(),
    }))
    
    return NextResponse.redirect(
      new URL(`/configuracoes?mp_success=true&mp_restaurant=${state}&mp_tokens=${tokenData}`, request.url)
    )
  } catch (err) {
    console.error("Error in Mercado Pago callback:", err)
    return NextResponse.redirect(
      new URL("/configuracoes?mp_error=Erro%20interno", request.url)
    )
  }
}
