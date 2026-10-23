import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import {
  generateDeviceToken,
  getOwnedDevice,
  getOwnedRestaurant,
  hashDeviceToken,
  jsonError,
  PRINT_DEVICE_COLUMNS,
} from "@/lib/print-devices"

type RouteContext = {
  params: Promise<{ id: string }>
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  if (!UUID_PATTERN.test(id)) {
    return jsonError("Dispositivo inválido.", 400)
  }

  const { error, restaurant } = await getOwnedRestaurant()

  if (error) {
    return error
  }

  const { error: deviceError, device } = await getOwnedDevice(id, restaurant.id)

  if (deviceError) {
    return deviceError
  }

  const body = await request.json().catch(() => null)
  const action = body?.action

  if (action === "rotate") {
    if (!device.is_active) {
      return jsonError(
        "Dispositivo desativado. Cadastre um novo dispositivo para voltar a imprimir.",
        409,
      )
    }

    // Trocar o hash invalida imediatamente o token anterior.
    const token = generateDeviceToken()

    const { data, error: updateError } = await supabaseAdmin
      .from("restaurant_print_devices")
      .update({
        token_hash: hashDeviceToken(token),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("restaurant_id", restaurant.id)
      .select(PRINT_DEVICE_COLUMNS)
      .single()

    if (updateError) {
      console.error("Erro ao substituir token de impressão:", {
        message: updateError.message,
        code: updateError.code,
      })

      return jsonError("Erro ao substituir o token.", 500)
    }

    // O token original é retornado apenas nesta resposta; não é armazenado nem logado.
    return NextResponse.json({ success: true, device: data, token })
  }

  if (action === "deactivate") {
    // Só desativa o acesso; o histórico de impressões é preservado.
    const { data, error: updateError } = await supabaseAdmin
      .from("restaurant_print_devices")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("restaurant_id", restaurant.id)
      .select(PRINT_DEVICE_COLUMNS)
      .single()

    if (updateError) {
      console.error("Erro ao desativar dispositivo de impressão:", {
        message: updateError.message,
        code: updateError.code,
      })

      return jsonError("Erro ao desativar dispositivo.", 500)
    }

    return NextResponse.json({ success: true, device: data })
  }

  return jsonError("Ação inválida.", 400)
}
