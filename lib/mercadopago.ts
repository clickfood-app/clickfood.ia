// Mercado Pago OAuth Integration
// Environment variables needed:
// - NEXT_PUBLIC_MERCADOPAGO_CLIENT_ID
// - MERCADOPAGO_CLIENT_SECRET
// - NEXT_PUBLIC_MERCADOPAGO_REDIRECT_URI

const STORAGE_KEY = "clickfood_mercadopago"

export interface MercadoPagoTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  connected_at: string
  user_id: number
}

export interface MercadoPagoConnection {
  restaurant_id: string
  tokens: MercadoPagoTokens
}

// Get OAuth URL for authorization
export function getMercadoPagoAuthUrl(restaurantId: string): string {
  const clientId = process.env.NEXT_PUBLIC_MERCADOPAGO_CLIENT_ID || "YOUR_CLIENT_ID"
  const redirectUri = process.env.NEXT_PUBLIC_MERCADOPAGO_REDIRECT_URI || `${typeof window !== "undefined" ? window.location.origin : ""}/api/mercadopago/callback`
  
  // Store restaurant ID for callback
  if (typeof window !== "undefined") {
    sessionStorage.setItem("mp_restaurant_id", restaurantId)
  }
  
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    platform_id: "mp",
    redirect_uri: redirectUri,
    state: restaurantId, // Pass restaurant ID as state for security
  })
  
  return `https://auth.mercadopago.com.br/authorization?${params.toString()}`
}

// Exchange authorization code for tokens (called from API route)
export async function exchangeCodeForTokens(code: string): Promise<MercadoPagoTokens | null> {
  const clientId = process.env.NEXT_PUBLIC_MERCADOPAGO_CLIENT_ID
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET
  const redirectUri = process.env.NEXT_PUBLIC_MERCADOPAGO_REDIRECT_URI
  
  if (!clientId || !clientSecret) {
    console.error("Missing Mercado Pago credentials")
    return null
  }
  
  try {
    const response = await fetch("https://api.mercadopago.com/oauth/token", {
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
        redirect_uri: redirectUri || "",
      }),
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error("Mercado Pago token exchange failed:", error)
      return null
    }
    
    const data = await response.json()
    
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      connected_at: new Date().toISOString(),
      user_id: data.user_id,
    }
  } catch (error) {
    console.error("Error exchanging code for tokens:", error)
    return null
  }
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<MercadoPagoTokens | null> {
  const clientId = process.env.NEXT_PUBLIC_MERCADOPAGO_CLIENT_ID
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    return null
  }
  
  try {
    const response = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      connected_at: new Date().toISOString(),
      user_id: data.user_id,
    }
  } catch {
    return null
  }
}

// ── Local storage helpers (for demo without Supabase) ──

export function saveMercadoPagoConnection(restaurantId: string, tokens: MercadoPagoTokens): void {
  if (typeof window === "undefined") return
  
  const connections = getMercadoPagoConnections()
  connections[restaurantId] = { restaurant_id: restaurantId, tokens }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections))
}

export function getMercadoPagoConnections(): Record<string, MercadoPagoConnection> {
  if (typeof window === "undefined") return {}
  
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return {}
  
  try {
    return JSON.parse(stored)
  } catch {
    return {}
  }
}

export function getMercadoPagoConnection(restaurantId: string): MercadoPagoConnection | null {
  const connections = getMercadoPagoConnections()
  return connections[restaurantId] || null
}

export function disconnectMercadoPago(restaurantId: string): void {
  if (typeof window === "undefined") return
  
  const connections = getMercadoPagoConnections()
  delete connections[restaurantId]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections))
}

export function isMercadoPagoConnected(restaurantId: string): boolean {
  const connection = getMercadoPagoConnection(restaurantId)
  return !!connection?.tokens?.access_token
}
