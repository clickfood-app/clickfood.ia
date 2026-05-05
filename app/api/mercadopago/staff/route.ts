import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { createClient } from "@/lib/supabase/server"

const ALLOWED_STAFF_TYPES = ["funcionario", "entregador"] as const
const ALLOWED_PAYMENT_MODELS = ["mensal", "diaria", "comissao", "entrega"] as const

function normalizeBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true
    if (value.toLowerCase() === "false") return false
  }
  return fallback
}

function normalizeType(value: unknown) {
  const normalized = String(value ?? "funcionario").trim().toLowerCase()
  return ALLOWED_STAFF_TYPES.includes(normalized as (typeof ALLOWED_STAFF_TYPES)[number])
    ? normalized
    : "funcionario"
}

function normalizePaymentModel(value: unknown) {
  const normalized = String(value ?? "mensal").trim().toLowerCase()
  return ALLOWED_PAYMENT_MODELS.includes(
    normalized as (typeof ALLOWED_PAYMENT_MODELS)[number]
  )
    ? normalized
    : "mensal"
}

function normalizePerPage(value: string | null) {
  const parsed = Number(value ?? "8")
  if (!Number.isFinite(parsed) || parsed <= 0) return 8
  return Math.min(parsed, 50)
}

function normalizePage(value: string | null) {
  const parsed = Number(value ?? "1")
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return Math.floor(parsed)
}

async function getRestaurantIdFromRequest() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error("Usuário não autenticado")
  }

  const { data: restaurant, error: restaurantError } = await supabaseAdmin
    .from("restaurants")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (restaurantError || !restaurant) {
    throw new Error("Restaurante não encontrado para este usuário")
  }

  return String(restaurant.id)
}

export async function GET(request: NextRequest) {
  try {
    const restaurantId = await getRestaurantIdFromRequest()

    const { searchParams } = new URL(request.url)

    const type = normalizeType(searchParams.get("type") ?? "")
    const hasTypeFilter = Boolean(searchParams.get("type")?.trim())
    const search = (searchParams.get("search") ?? "").trim()
    const page = normalizePage(searchParams.get("page"))
    const perPage = normalizePerPage(searchParams.get("perPage"))

    const from = (page - 1) * perPage
    const to = from + perPage - 1

    let query = supabaseAdmin
      .from("staff")
      .select("*", { count: "exact" })
      .eq("restaurant_id", restaurantId)
      .eq("active", true)
      .order("created_at", { ascending: false })

    if (hasTypeFilter) {
      query = query.eq("type", type)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,role.ilike.%${search}%`)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    const formatted =
      data?.map((item) => ({
        id: String(item.id),
        restaurantId: String(item.restaurant_id),
        name: item.name ?? "",
        role: item.role ?? "",
        type: item.type ?? "funcionario",
        paymentModel: item.payment_model ?? "mensal",
        baseValue: Number(item.base_value ?? 0),
        pixKey: item.pix_key ?? undefined,
        phone: item.phone ?? "",
        active: Boolean(item.active),
        createdAt: String(item.created_at ?? "").slice(0, 10),
        todayEarnings: Number(item.today_earnings ?? 0),
        monthEarnings: Number(item.month_earnings ?? 0),
        avgDaily: Number(item.avg_daily ?? 0),
        status: item.status ?? "pendente",
        deliveriesToday: item.deliveries_today ?? undefined,
        deliveriesMonth: item.deliveries_month ?? undefined,
      })) ?? []

    return NextResponse.json({
      data: formatted,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
      totalItems: count ?? 0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro ao listar funcionarios",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const restaurantId = await getRestaurantIdFromRequest()
    const body = await request.json()

    const name = String(body.name ?? "").trim()
    const role = String(body.role ?? "").trim()
    const type = normalizeType(body.type)
    const paymentModel = normalizePaymentModel(body.paymentModel)
    const baseValue = Number(body.baseValue ?? 0)
    const pixKey = String(body.pixKey ?? "").trim() || null
    const phone = String(body.phone ?? "").trim()
    const active = normalizeBoolean(body.active, true)

    if (!name) {
      return NextResponse.json(
        { message: "Nome do funcionário é obrigatório" },
        { status: 400 }
      )
    }

    if (!role) {
      return NextResponse.json(
        { message: "Função do funcionário é obrigatória" },
        { status: 400 }
      )
    }

    if (!Number.isFinite(baseValue) || baseValue < 0) {
      return NextResponse.json(
        { message: "Valor base inválido" },
        { status: 400 }
      )
    }

    const payload = {
      restaurant_id: restaurantId,
      name,
      role,
      type,
      payment_model: paymentModel,
      base_value: baseValue,
      pix_key: pixKey,
      phone,
      active,
      created_at: new Date().toISOString(),
      today_earnings: 0,
      month_earnings: 0,
      avg_daily: 0,
      status: "pendente",
      deliveries_today: type === "entregador" ? 0 : null,
      deliveries_month: type === "entregador" ? 0 : null,
    }

    const { data, error } = await supabaseAdmin
      .from("staff")
      .insert(payload)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json({
      id: String(data.id),
      restaurantId: String(data.restaurant_id),
      name: data.name ?? "",
      role: data.role ?? "",
      type: data.type ?? "funcionario",
      paymentModel: data.payment_model ?? "mensal",
      baseValue: Number(data.base_value ?? 0),
      pixKey: data.pix_key ?? undefined,
      phone: data.phone ?? "",
      active: Boolean(data.active),
      createdAt: String(data.created_at ?? "").slice(0, 10),
      todayEarnings: Number(data.today_earnings ?? 0),
      monthEarnings: Number(data.month_earnings ?? 0),
      avgDaily: Number(data.avg_daily ?? 0),
      status: data.status ?? "pendente",
      deliveriesToday: data.deliveries_today ?? undefined,
      deliveriesMonth: data.deliveries_month ?? undefined,
    })
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro ao criar funcionario",
      },
      { status: 500 }
    )
  }
}