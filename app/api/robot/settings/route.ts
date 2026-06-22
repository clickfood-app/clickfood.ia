import { NextRequest, NextResponse } from "next/server"
import { createClient, type User } from "@supabase/supabase-js"

const ROBOT_PROVIDER = "zapi"
const AI_CHANNELS_TABLE = "restaurant_ai_channels"

const DEFAULT_ZAPI_INSTANCE_ID =
  process.env.AI_ZAPI_INSTANCE_ID?.trim() ||
  process.env.DEFAULT_ZAPI_INSTANCE_ID?.trim() ||
  process.env.ZAPI_INSTANCE_ID?.trim() ||
  ""

const DEFAULT_AI_RESTAURANT_ID =
  process.env.AI_DEFAULT_RESTAURANT_ID?.trim() ||
  process.env.DEFAULT_RESTAURANT_ID?.trim() ||
  ""

type RestaurantRow = {
  id: string
  name?: string | null
  slug?: string | null
  owner_id?: string | null
}

type RobotChannelRow = {
  id?: string | null
  restaurant_id?: string | null
  provider?: string | null
  instance_id?: string | null
  session_name?: string | null
  phone_number?: string | null
  is_enabled?: boolean | null
  auto_reply_enabled?: boolean | null
  updated_at?: string | null
}

type PatchRobotSettingsBody = {
  is_enabled?: unknown
  auto_reply_enabled?: unknown
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} nao configurada.`)
  }

  return value
}

function createAdminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

const appSupabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL")
const appSupabaseServiceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY")

const authSupabaseAdmin = createAdminClient(
  appSupabaseUrl,
  appSupabaseServiceRoleKey
)

const configuredAiSupabaseUrl = process.env.AI_SUPABASE_URL?.trim()
const configuredAiSupabaseServiceRoleKey =
  process.env.AI_SUPABASE_SERVICE_ROLE_KEY?.trim()

const shouldUseAiSupabase =
  Boolean(configuredAiSupabaseUrl) &&
  Boolean(configuredAiSupabaseServiceRoleKey)

const aiSupabaseUrl = shouldUseAiSupabase
  ? configuredAiSupabaseUrl!
  : appSupabaseUrl

const aiSupabaseServiceRoleKey = shouldUseAiSupabase
  ? configuredAiSupabaseServiceRoleKey!
  : appSupabaseServiceRoleKey

const aiSupabaseAdmin = createAdminClient(
  aiSupabaseUrl,
  aiSupabaseServiceRoleKey
)

function jsonError(message: string, status = 400, debug?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      debug: process.env.NODE_ENV === "development" ? debug : undefined,
    },
    { status }
  )
}

function resolveAiRestaurantId(appRestaurantId: string) {
  return DEFAULT_AI_RESTAURANT_ID || appRestaurantId
}

function serializeChannel(
  channel: RobotChannelRow | null,
  restaurantId: string
) {
  return {
    id: channel?.id ?? null,
    restaurant_id: channel?.restaurant_id ?? restaurantId,
    provider: channel?.provider ?? ROBOT_PROVIDER,
    instance_id: channel?.instance_id ?? (DEFAULT_ZAPI_INSTANCE_ID || null),
    session_name: channel?.session_name ?? null,
    phone_number: channel?.phone_number ?? null,
    is_enabled: channel?.is_enabled === true,
    auto_reply_enabled: channel?.auto_reply_enabled === true,
  }
}

async function getAuthenticatedUser(request: NextRequest): Promise<User> {
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim()

  if (!token) {
    throw new Error("unauthorized")
  }

  const {
    data: { user },
    error,
  } = await authSupabaseAdmin.auth.getUser(token)

  if (error || !user) {
    throw new Error("unauthorized")
  }

  return user
}

async function getUserRestaurant(userId: string): Promise<RestaurantRow> {
  const { data: restaurant, error } = await authSupabaseAdmin
    .from("restaurants")
    .select("id, name, slug, owner_id")
    .eq("owner_id", userId)
    .maybeSingle<RestaurantRow>()

  if (error) {
    console.error("Erro ao buscar restaurante do usuario:", {
      userId,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })

    throw new Error("restaurant_lookup_failed")
  }

  if (!restaurant) {
    throw new Error("restaurant_not_found")
  }

  return restaurant
}

async function getZapiChannel(restaurantId: string) {
  const { data: byRestaurant, error: byRestaurantError } =
    await aiSupabaseAdmin
      .from(AI_CHANNELS_TABLE)
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("provider", ROBOT_PROVIDER)
      .limit(1)
      .maybeSingle()

  if (byRestaurantError) {
    console.error("Erro ao buscar canal Z-API por restaurante:", {
      restaurantId,
      message: byRestaurantError.message,
      code: byRestaurantError.code,
      details: byRestaurantError.details,
      hint: byRestaurantError.hint,
    })

    throw new Error("robot_channel_lookup_failed")
  }

  if (byRestaurant) {
    return byRestaurant as RobotChannelRow
  }

  if (DEFAULT_ZAPI_INSTANCE_ID) {
    const { data: byInstance, error: byInstanceError } =
      await aiSupabaseAdmin
        .from(AI_CHANNELS_TABLE)
        .select("*")
        .eq("provider", ROBOT_PROVIDER)
        .eq("instance_id", DEFAULT_ZAPI_INSTANCE_ID)
        .limit(1)
        .maybeSingle()

    if (byInstanceError) {
      console.error("Erro ao buscar canal Z-API por instancia:", {
        instanceId: DEFAULT_ZAPI_INSTANCE_ID,
        message: byInstanceError.message,
        code: byInstanceError.code,
        details: byInstanceError.details,
        hint: byInstanceError.hint,
      })

      throw new Error("robot_channel_lookup_failed")
    }

    if (byInstance) {
      return byInstance as RobotChannelRow
    }
  }

  return null
}

async function saveZapiChannel(
  restaurantId: string,
  isEnabled: boolean,
  autoReplyEnabled: boolean
) {
  const existingChannel = await getZapiChannel(restaurantId)

  const instanceId = existingChannel?.instance_id || DEFAULT_ZAPI_INSTANCE_ID

  if (!existingChannel && !instanceId) {
    throw new Error("zapi_instance_not_configured")
  }

  const payload = {
    restaurant_id: existingChannel?.restaurant_id || restaurantId,
    provider: ROBOT_PROVIDER,
    instance_id: instanceId,
    is_enabled: isEnabled,
    auto_reply_enabled: autoReplyEnabled,
    updated_at: new Date().toISOString(),
  }

  const query = existingChannel?.id
    ? aiSupabaseAdmin
        .from(AI_CHANNELS_TABLE)
        .update(payload)
        .eq("id", existingChannel.id)
        .select("*")
        .single()
    : aiSupabaseAdmin
        .from(AI_CHANNELS_TABLE)
        .insert(payload)
        .select("*")
        .single()

  const { data, error } = await query

  if (error) {
    console.error("Erro ao salvar canal Z-API do robo:", {
      restaurantId,
      existingChannelId: existingChannel?.id,
      payload,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })

    throw new Error("robot_channel_save_failed")
  }

  return data as RobotChannelRow
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const restaurant = await getUserRestaurant(user.id)
    const aiRestaurantId = resolveAiRestaurantId(restaurant.id)
    const channel = await getZapiChannel(aiRestaurantId)

    return NextResponse.json({
      success: true,
      restaurant,
      settings: serializeChannel(channel, aiRestaurantId),
    })
  } catch (error) {
    console.error("Erro ao buscar configuracoes do robo:", error)

    if (error instanceof Error && error.message === "unauthorized") {
      return jsonError("Nao autorizado.", 401)
    }

    if (error instanceof Error && error.message === "restaurant_not_found") {
      return jsonError("Restaurante nao encontrado para este usuario.", 404)
    }

    return jsonError("Erro interno ao buscar configuracoes do robo.", 500, {
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    let body: PatchRobotSettingsBody

    try {
      body = (await request.json()) as PatchRobotSettingsBody
    } catch {
      return jsonError("Corpo da requisicao invalido.", 400)
    }

    if (typeof body.is_enabled !== "boolean") {
      return jsonError("is_enabled deve ser boolean.", 400)
    }

    const isEnabled = body.is_enabled
    const autoReplyEnabled =
      typeof body.auto_reply_enabled === "boolean"
        ? body.auto_reply_enabled
        : isEnabled

    const restaurant = await getUserRestaurant(user.id)
    const aiRestaurantId = resolveAiRestaurantId(restaurant.id)

    const channel = await saveZapiChannel(
      aiRestaurantId,
      isEnabled,
      autoReplyEnabled
    )

    return NextResponse.json({
      success: true,
      restaurant,
      settings: serializeChannel(channel, aiRestaurantId),
    })
  } catch (error) {
    console.error("Erro ao salvar configuracoes do robo:", error)

    if (error instanceof Error && error.message === "unauthorized") {
      return jsonError("Nao autorizado.", 401)
    }

    if (error instanceof Error && error.message === "restaurant_not_found") {
      return jsonError("Restaurante nao encontrado para este usuario.", 404)
    }

    if (
      error instanceof Error &&
      error.message === "zapi_instance_not_configured"
    ) {
      return jsonError(
        "Instancia Z-API nao configurada. Configure AI_ZAPI_INSTANCE_ID no .env.local.",
        400
      )
    }

    return jsonError("Erro interno ao salvar configuracoes do robo.", 500, {
      message: error instanceof Error ? error.message : String(error),
    })
  }
}