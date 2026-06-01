import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

type WaiterPayload = {
  id?: string
  name?: string
  pin?: string
  role?: "waiter" | "manager"
  is_active?: boolean
  staff_member_id?: string | null
}

async function getCurrentRestaurant() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      error: NextResponse.json(
        { success: false, error: "Usuário não autenticado." },
        { status: 401 },
      ),
      restaurant: null,
    }
  }

  const { data: restaurant, error: restaurantError } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, owner_id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle()

  if (restaurantError) {
    console.error("Erro ao buscar restaurante:", restaurantError)

    return {
      error: NextResponse.json(
        { success: false, error: "Erro ao buscar restaurante." },
        { status: 500 },
      ),
      restaurant: null,
    }
  }

  if (!restaurant) {
    return {
      error: NextResponse.json(
        { success: false, error: "Restaurante não encontrado." },
        { status: 404 },
      ),
      restaurant: null,
    }
  }

  return {
    error: null,
    restaurant,
  }
}

function validatePin(pin: string) {
  const onlyNumbers = pin.replace(/\D/g, "")

  if (onlyNumbers.length < 4 || onlyNumbers.length > 8) {
    return null
  }

  return onlyNumbers
}

export async function GET() {
  try {
    const { error, restaurant } = await getCurrentRestaurant()

    if (error) return error
    if (!restaurant) {
      return NextResponse.json(
        { success: false, error: "Restaurante não encontrado." },
        { status: 404 },
      )
    }

    const { data, error: waitersError } = await supabaseAdmin
      .from("waiter_users")
      .select(
        "id, restaurant_id, staff_member_id, name, role, is_active, created_at, updated_at",
      )
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })

    if (waitersError) {
      console.error("Erro ao listar garçons:", waitersError)

      return NextResponse.json(
        { success: false, error: "Erro ao listar garçons." },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      waiters: data || [],
    })
  } catch (err) {
    console.error("Erro inesperado ao listar garçons:", err)

    return NextResponse.json(
      { success: false, error: "Erro inesperado ao listar garçons." },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WaiterPayload

    const { error, restaurant } = await getCurrentRestaurant()

    if (error) return error
    if (!restaurant) {
      return NextResponse.json(
        { success: false, error: "Restaurante não encontrado." },
        { status: 404 },
      )
    }

    const name = String(body.name || "").trim()
    const role = body.role || "waiter"
    const pin = validatePin(String(body.pin || ""))

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Informe o nome do garçom." },
        { status: 400 },
      )
    }

    if (!pin) {
      return NextResponse.json(
        {
          success: false,
          error: "O PIN precisa ter entre 4 e 8 números.",
        },
        { status: 400 },
      )
    }

    if (!["waiter", "manager"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "Função inválida." },
        { status: 400 },
      )
    }

    const { data: pinHash, error: hashError } = await supabaseAdmin.rpc(
      "create_waiter_pin_hash",
      {
        p_pin: pin,
      },
    )

    if (hashError || !pinHash) {
      console.error("Erro ao gerar hash do PIN:", hashError)

      return NextResponse.json(
        { success: false, error: "Erro ao proteger PIN do garçom." },
        { status: 500 },
      )
    }

    const { data: waiter, error: insertError } = await supabaseAdmin
      .from("waiter_users")
      .insert({
        restaurant_id: restaurant.id,
        staff_member_id: body.staff_member_id || null,
        name,
        pin_hash: pinHash,
        role,
        is_active: body.is_active ?? true,
      })
      .select(
        "id, restaurant_id, staff_member_id, name, role, is_active, created_at, updated_at",
      )
      .single()

    if (insertError) {
      console.error("Erro ao criar garçom:", insertError)

      return NextResponse.json(
        { success: false, error: "Erro ao criar garçom." },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      waiter,
    })
  } catch (err) {
    console.error("Erro inesperado ao criar garçom:", err)

    return NextResponse.json(
      { success: false, error: "Erro inesperado ao criar garçom." },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as WaiterPayload

    const { error, restaurant } = await getCurrentRestaurant()

    if (error) return error
    if (!restaurant) {
      return NextResponse.json(
        { success: false, error: "Restaurante não encontrado." },
        { status: 404 },
      )
    }

    const waiterId = String(body.id || "").trim()

    if (!waiterId) {
      return NextResponse.json(
        { success: false, error: "ID do garçom não informado." },
        { status: 400 },
      )
    }

    const updatePayload: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const name = String(body.name || "").trim()

      if (!name) {
        return NextResponse.json(
          { success: false, error: "Informe o nome do garçom." },
          { status: 400 },
        )
      }

      updatePayload.name = name
    }

    if (body.role !== undefined) {
      if (!["waiter", "manager"].includes(body.role)) {
        return NextResponse.json(
          { success: false, error: "Função inválida." },
          { status: 400 },
        )
      }

      updatePayload.role = body.role
    }

    if (body.is_active !== undefined) {
      updatePayload.is_active = Boolean(body.is_active)
    }

    if (body.staff_member_id !== undefined) {
      updatePayload.staff_member_id = body.staff_member_id || null
    }

    if (body.pin !== undefined && String(body.pin).trim()) {
      const pin = validatePin(String(body.pin || ""))

      if (!pin) {
        return NextResponse.json(
          {
            success: false,
            error: "O PIN precisa ter entre 4 e 8 números.",
          },
          { status: 400 },
        )
      }

      const { data: pinHash, error: hashError } = await supabaseAdmin.rpc(
        "create_waiter_pin_hash",
        {
          p_pin: pin,
        },
      )

      if (hashError || !pinHash) {
        console.error("Erro ao atualizar hash do PIN:", hashError)

        return NextResponse.json(
          { success: false, error: "Erro ao proteger novo PIN." },
          { status: 500 },
        )
      }

      updatePayload.pin_hash = pinHash
    }

    const { data: waiter, error: updateError } = await supabaseAdmin
      .from("waiter_users")
      .update(updatePayload)
      .eq("id", waiterId)
      .eq("restaurant_id", restaurant.id)
      .select(
        "id, restaurant_id, staff_member_id, name, role, is_active, created_at, updated_at",
      )
      .single()

    if (updateError) {
      console.error("Erro ao atualizar garçom:", updateError)

      return NextResponse.json(
        { success: false, error: "Erro ao atualizar garçom." },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      waiter,
    })
  } catch (err) {
    console.error("Erro inesperado ao atualizar garçom:", err)

    return NextResponse.json(
      { success: false, error: "Erro inesperado ao atualizar garçom." },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const waiterId = searchParams.get("id")

    const { error, restaurant } = await getCurrentRestaurant()

    if (error) return error
    if (!restaurant) {
      return NextResponse.json(
        { success: false, error: "Restaurante não encontrado." },
        { status: 404 },
      )
    }

    if (!waiterId) {
      return NextResponse.json(
        { success: false, error: "ID do garçom não informado." },
        { status: 400 },
      )
    }

    const { error: deleteError } = await supabaseAdmin
      .from("waiter_users")
      .delete()
      .eq("id", waiterId)
      .eq("restaurant_id", restaurant.id)

    if (deleteError) {
      console.error("Erro ao excluir garçom:", deleteError)

      return NextResponse.json(
        { success: false, error: "Erro ao excluir garçom." },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (err) {
    console.error("Erro inesperado ao excluir garçom:", err)

    return NextResponse.json(
      { success: false, error: "Erro inesperado ao excluir garçom." },
      { status: 500 },
    )
  }
}