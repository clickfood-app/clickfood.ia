import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { supabaseAdmin } from "@/lib/supabase-admin"

async function getAuthenticatedUser(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Variáveis públicas do Supabase não configuradas.")
  }

  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "")

  if (!token) {
    throw new Error("Token não enviado.")
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey)

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) {
    throw new Error("Usuário não autenticado.")
  }

  return user
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await context.params

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: "ID da campanha não enviado." },
        { status: 400 }
      )
    }

    const user = await getAuthenticatedUser(req)

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    if (restaurantError || !restaurant) {
      return NextResponse.json(
        { success: false, error: "Restaurante não encontrado." },
        { status: 404 }
      )
    }

    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("loyalty_campaigns")
      .select("id, restaurant_id")
      .eq("id", campaignId)
      .eq("restaurant_id", restaurant.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada." },
        { status: 404 }
      )
    }

    const { error: deleteCampaignError } = await supabaseAdmin
      .from("loyalty_campaigns")
      .delete()
      .eq("restaurant_id", restaurant.id)
      .eq("id", campaignId)

    if (deleteCampaignError) {
      return NextResponse.json(
        {
          success: false,
          error: "Erro ao excluir campanha de fidelidade.",
          details: deleteCampaignError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error("Erro ao excluir campanha de fidelidade:", error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao excluir campanha.",
      },
      { status: 500 }
    )
  }
}