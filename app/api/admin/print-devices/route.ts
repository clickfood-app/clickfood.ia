import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import {
  generateDeviceToken,
  getOwnedRestaurant,
  hashDeviceToken,
  jsonError,
  normalizeText,
  PRINT_DEVICE_COLUMNS,
} from "@/lib/print-devices"

export async function GET() {
  const { error, restaurant } = await getOwnedRestaurant()

  if (error) {
    return error
  }

  const { data, error: listError } = await supabaseAdmin
    .from("restaurant_print_devices")
    .select(PRINT_DEVICE_COLUMNS)
    .eq("restaurant_id", restaurant.id)
    .order("created_at", { ascending: true })

  if (listError) {
    console.error("Erro ao listar dispositivos de impressão:", {
      message: listError.message,
      code: listError.code,
    })

    return jsonError("Erro ao listar dispositivos.", 500)
  }

  return NextResponse.json({ success: true, devices: data ?? [] })
}

export async function POST(request: NextRequest) {
  const { error, restaurant } = await getOwnedRestaurant()

  if (error) {
    return error
  }

  const body = await request.json().catch(() => null)

  const deviceName = normalizeText(body?.deviceName, 80)
  const printerName = normalizeText(body?.printerName, 120)

  if (deviceName.length < 2) {
    return jsonError("Informe um nome para o dispositivo (mínimo 2 caracteres).")
  }

  const token = generateDeviceToken()

  const { data, error: insertError } = await supabaseAdmin
    .from("restaurant_print_devices")
    .insert({
      restaurant_id: restaurant.id,
      device_name: deviceName,
      printer_name: printerName || null,
      token_hash: hashDeviceToken(token),
      is_active: true,
    })
    .select(PRINT_DEVICE_COLUMNS)
    .single()

  if (insertError) {
    console.error("Erro ao criar dispositivo de impressão:", {
      message: insertError.message,
      code: insertError.code,
    })

    return jsonError("Erro ao criar dispositivo.", 500)
  }

  // O token original é retornado apenas nesta resposta; não é armazenado nem logado.
  return NextResponse.json(
    { success: true, device: data, token },
    { status: 201 },
  )
}
