// Mercado Pago OAuth Integration
// Environment variables needed:
// - NEXT_PUBLIC_MERCADOPAGO_CLIENT_ID
// - NEXT_PUBLIC_MERCADOPAGO_REDIRECT_URI
//
// IMPORTANT:
// - Access token / refresh token must never be stored in localStorage/sessionStorage
// - Token exchange and refresh must happen server-side only

const STORAGE_KEY = "clickfood_mercadopago_status"

export interface MercadoPagoTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  connected_at: string
  user_id: number
}

export interface MercadoPagoConnection {
  restaurant_id: string
  connected: boolean
  connected_at: string
  user_id: number | null
}

// Get OAuth URL for authorization
export function getMercadoPagoAuthUrl(restaurantId: string): string {
  const clientId =
    process.env.NEXT_PUBLIC_MERCADOPAGO_CLIENT_ID || "YOUR_CLIENT_ID"
  const redirectUri =
    process.env.NEXT_PUBLIC_MERCADOPAGO_REDIRECT_URI ||
    `${typeof window !== "undefined" ? window.location.origin : ""}/api/mercadopago/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    platform_id: "mp",
    redirect_uri: redirectUri,
    state: restaurantId,
  })

  return `https://auth.mercadopago.com.br/authorization?${params.toString()}`
}

// Token exchange must be server-side only
export async function exchangeCodeForTokens(
  _code: string
): Promise<MercadoPagoTokens | null> {
  console.error("exchangeCodeForTokens must run server-side only")
  return null
}

// Token refresh must be server-side only
export async function refreshAccessToken(
  _refreshToken: string
): Promise<MercadoPagoTokens | null> {
  console.error("refreshAccessToken must run server-side only")
  return null
}

// ── Client-side status helpers (no sensitive data) ──

export function saveMercadoPagoConnection(
  restaurantId: string,
  tokens: MercadoPagoTokens
): void {
  if (typeof window === "undefined") return

  const connections = getMercadoPagoConnections()

  connections[restaurantId] = {
    restaurant_id: restaurantId,
    connected: true,
    connected_at: tokens.connected_at || new Date().toISOString(),
    user_id: typeof tokens.user_id === "number" ? tokens.user_id : null,
  }

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

export function getMercadoPagoConnection(
  restaurantId: string
): MercadoPagoConnection | null {
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
  return !!connection?.connected
}