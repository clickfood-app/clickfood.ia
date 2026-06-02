import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

type CustomerAuthBody = {
  restaurantId?: string
  name?: string
  phone?: string
  document?: string | null
  address?: string | null
  neighborhood?: string | null
  neighborhoodKey?: string | null
}

const MAX_NAME_LENGTH = 120
const MAX_PHONE_LENGTH = 20
const MAX_DOCUMENT_LENGTH = 20
const MAX_ADDRESS_LENGTH = 250
const MAX_NEIGHBORHOOD_LENGTH = 120

function cleanText(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function onlyDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "")
}

function normalizeNameForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function isValidBrazilianMobilePhone(value: string) {
  return /^([1-9]{2})9\d{8}$/.test(value)
}

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  )
}

export async function POST(request: Request) {
  try {
    let body: CustomerAuthBody

    try {
      body = (await request.json()) as CustomerAuthBody
    } catch {
      return jsonError("Corpo da requisição inválido.", 400)
    }

    const restaurantId = cleanText(body.restaurantId, 80)
    const name = cleanText(body.name, MAX_NAME_LENGTH)
    const phone = onlyDigits(body.phone).slice(0, MAX_PHONE_LENGTH)
    const document = onlyDigits(body.document).slice(0, MAX_DOCUMENT_LENGTH) || null
    const lastAddress = cleanText(body.address, MAX_ADDRESS_LENGTH) || null
    const lastNeighborhood =
      cleanText(body.neighborhood, MAX_NEIGHBORHOOD_LENGTH) ||
      cleanText(body.neighborhoodKey, MAX_NEIGHBORHOOD_LENGTH) ||
      null

    if (!restaurantId) {
      return jsonError("restaurantId é obrigatório.", 400)
    }

    if (!name) {
      return jsonError("Informe seu nome.", 400)
    }

    if (!isValidBrazilianMobilePhone(phone)) {
      return jsonError("Informe um celular/WhatsApp válido com DDD.", 400)
    }

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id, is_active")
      .eq("id", restaurantId)
      .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao validar restaurante no login público:", {
        restaurantId,
        message: restaurantError.message,
        code: restaurantError.code,
      })

      return jsonError("Erro ao validar restaurante.", 500)
    }

    if (!restaurant || restaurant.is_active === false) {
      return jsonError("Restaurante não encontrado ou inativo.", 404)
    }

    const { data: existingCustomer, error: existingCustomerError } = await supabaseAdmin
      .from("restaurant_customers")
      .select("id, restaurant_id, name, phone, document, last_address, last_neighborhood")
      .eq("restaurant_id", restaurantId)
      .eq("phone", phone)
      .maybeSingle()

    if (existingCustomerError) {
      console.error("Erro ao buscar cliente público:", {
        restaurantId,
        phone,
        message: existingCustomerError.message,
        code: existingCustomerError.code,
      })

      return jsonError("Erro ao verificar cliente.", 500)
    }

    if (existingCustomer) {
      const existingName = normalizeNameForMatch(existingCustomer.name || "")
      const incomingName = normalizeNameForMatch(name)

      if (existingName && incomingName && existingName !== incomingName) {
        return jsonError(
          "Este WhatsApp já está cadastrado com outro nome neste restaurante. Confira o nome usado anteriormente ou fale com o restaurante.",
          409
        )
      }

      const { data: updatedCustomer, error: updateError } = await supabaseAdmin
        .from("restaurant_customers")
        .update({
          name: existingCustomer.name || name,
          document: document || existingCustomer.document || null,
          last_address: lastAddress || existingCustomer.last_address || null,
          last_neighborhood: lastNeighborhood || existingCustomer.last_neighborhood || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingCustomer.id)
        .eq("restaurant_id", restaurantId)
        .select("id, restaurant_id, name, phone, document, last_address, last_neighborhood")
        .single()

      if (updateError || !updatedCustomer) {
        console.error("Erro ao atualizar cliente público:", {
          restaurantId,
          phone,
          message: updateError?.message,
          code: updateError?.code,
        })

        return jsonError("Erro ao entrar na conta do cliente.", 500)
      }

      return NextResponse.json({
        success: true,
        mode: "login",
        customer: {
          id: updatedCustomer.id,
          restaurantId: updatedCustomer.restaurant_id,
          name: updatedCustomer.name,
          phone: updatedCustomer.phone,
          document: updatedCustomer.document,
          lastAddress: updatedCustomer.last_address,
          lastNeighborhood: updatedCustomer.last_neighborhood,
        },
      })
    }

    const { data: insertedCustomer, error: insertError } = await supabaseAdmin
      .from("restaurant_customers")
      .insert({
        restaurant_id: restaurantId,
        name,
        phone,
        document,
        last_address: lastAddress,
        last_neighborhood: lastNeighborhood,
      })
      .select("id, restaurant_id, name, phone, document, last_address, last_neighborhood")
      .single()

    if (insertError || !insertedCustomer) {
      console.error("Erro ao cadastrar cliente público:", {
        restaurantId,
        phone,
        message: insertError?.message,
        code: insertError?.code,
      })

      return jsonError("Erro ao cadastrar cliente.", 500)
    }

    return NextResponse.json({
      success: true,
      mode: "created",
      customer: {
        id: insertedCustomer.id,
        restaurantId: insertedCustomer.restaurant_id,
        name: insertedCustomer.name,
        phone: insertedCustomer.phone,
        document: insertedCustomer.document,
        lastAddress: insertedCustomer.last_address,
        lastNeighborhood: insertedCustomer.last_neighborhood,
      },
    })
  } catch (error) {
    console.error("POST /api/public/customer/auth error:", error)

    return jsonError("Erro inesperado ao entrar/cadastrar cliente.", 500)
  }
}
