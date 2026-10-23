import { createHash, randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const PRINT_DEVICE_COLUMNS =
  "id, device_name, printer_name, is_active, last_seen_at, created_at, updated_at"

export type PrintDeviceRow = {
  id: string
  device_name: string
  printer_name: string | null
  is_active: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export function generateDeviceToken() {
  return randomBytes(32).toString("hex")
}

export function hashDeviceToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

/**
 * Resolve o restaurante do usuário logado a partir da sessão (cookies).
 * Nunca recebe restaurant_id do navegador.
 */
export async function getOwnedRestaurant() {
  const supabase = await createServerClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: jsonError("Não autorizado.", 401), restaurant: null }
  }

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (restaurantError) {
    console.error("Erro ao buscar restaurante em print-devices:", {
      message: restaurantError.message,
      code: restaurantError.code,
    })

    return { error: jsonError("Erro ao buscar restaurante.", 500), restaurant: null }
  }

  if (!restaurant) {
    return {
      error: jsonError("Restaurante não encontrado para este usuário.", 404),
      restaurant: null,
    }
  }

  return { error: null, restaurant }
}

/** Busca um dispositivo e confirma que ele pertence ao restaurante informado. */
export async function getOwnedDevice(deviceId: string, restaurantId: string) {
  const { data, error } = await supabaseAdmin
    .from("restaurant_print_devices")
    .select(PRINT_DEVICE_COLUMNS)
    .eq("id", deviceId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle()

  if (error) {
    console.error("Erro ao buscar dispositivo de impressão:", {
      message: error.message,
      code: error.code,
    })

    return { error: jsonError("Erro ao buscar dispositivo.", 500), device: null }
  }

  if (!data) {
    return { error: jsonError("Dispositivo não encontrado.", 404), device: null }
  }

  return { error: null, device: data as PrintDeviceRow }
}
