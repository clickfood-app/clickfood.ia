import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { supabaseAdmin } from "@/lib/supabase-admin"

async function getAuthenticatedUser(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("supabase_config_missing")
  }

  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim()

  if (!token) {
    throw new Error("unauthorized")
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) {
    throw new Error("unauthorized")
  }

  return user
}

function cleanText(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
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

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await context.params
    const safeCampaignId = cleanText(campaignId, 80)

    if (!safeCampaignId) {
      return jsonError("ID da campanha não enviado.", 400)
    }

    const user = await getAuthenticatedUser(req)

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao buscar restaurante para excluir campanha:", {
        userId: user.id,
        campaignId: safeCampaignId,
        message: restaurantError.message,
        code: restaurantError.code,
      })

      return jsonError("Erro ao buscar restaurante.", 500)
    }

    if (!restaurant) {
      return jsonError("Restaurante não encontrado.", 404)
    }

    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("loyalty_campaigns")
      .select("id, restaurant_id")
      .eq("id", safeCampaignId)
      .eq("restaurant_id", restaurant.id)
      .maybeSingle()

    if (campaignError) {
      console.error("Erro ao buscar campanha para exclusão:", {
        restaurantId: restaurant.id,
        campaignId: safeCampaignId,
        message: campaignError.message,
        code: campaignError.code,
      })

      return jsonError("Erro ao buscar campanha.", 500)
    }

    if (!campaign) {
      return jsonError("Campanha não encontrada.", 404)
    }

    const { error: deleteCampaignError } = await supabaseAdmin
      .from("loyalty_campaigns")
      .delete()
      .eq("restaurant_id", restaurant.id)
      .eq("id", safeCampaignId)

    if (deleteCampaignError) {
      console.error("Erro ao excluir campanha de fidelidade:", {
        restaurantId: restaurant.id,
        campaignId: safeCampaignId,
        message: deleteCampaignError.message,
        code: deleteCampaignError.code,
      })

      return jsonError("Erro ao excluir campanha de fidelidade.", 500)
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error("DELETE /api/campanhas/fidelidade/[campaignId] error:", error)

    if (error instanceof Error && error.message === "unauthorized") {
      return jsonError("Não autorizado.", 401)
    }

    return jsonError("Erro inesperado ao excluir campanha.", 500)
  }
}