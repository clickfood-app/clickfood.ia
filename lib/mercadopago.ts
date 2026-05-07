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

export function getMercadoPagoAuthUrl(_restaurantId: string): string {
  return ""
}

export async function exchangeCodeForTokens(
  _code: string
): Promise<MercadoPagoTokens | null> {
  return null
}

export async function refreshAccessToken(
  _refreshToken: string
): Promise<MercadoPagoTokens | null> {
  return null
}

export function saveMercadoPagoConnection(
  _restaurantId: string,
  _tokens: MercadoPagoTokens
): void {}

export function getMercadoPagoConnections(): Record<string, MercadoPagoConnection> {
  return {}
}

export function getMercadoPagoConnection(
  _restaurantId: string
): MercadoPagoConnection | null {
  return null
}

export function disconnectMercadoPago(_restaurantId: string): void {}

export function isMercadoPagoConnected(_restaurantId: string): boolean {
  return false
}