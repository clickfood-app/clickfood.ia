import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { stripe } from "@/lib/stripe"

function getBaseAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  )
}

async function getAuthenticatedUserFromRequest(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Variaveis publicas do Supabase nao configuradas.")
  }

  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "")

  if (!token) {
    throw new Error("Token nao enviado.")
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    throw new Error("Usuario nao autenticado.")
  }

  return data.user
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const body = await request.json()
    const restaurantId = String(body?.restaurantId || "").trim()

    if (!restaurantId) {
      return NextResponse.json(
        { error: "restaurantId e obrigatorio." },
        { status: 400 }
      )
    }

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id, owner_id, name, stripe_account_id")
      .eq("id", restaurantId)
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError) {
      return NextResponse.json(
        { error: restaurantError.message || "Erro ao buscar restaurante." },
        { status: 500 }
      )
    }

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurante nao encontrado." },
        { status: 404 }
      )
    }

    let stripeAccountId = restaurant.stripe_account_id as string | null

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "BR",
        metadata: {
          restaurant_id: restaurant.id,
          owner_id: user.id,
          restaurant_name: restaurant.name || "",
        },
      })

      stripeAccountId = account.id

      const { error: updateError } = await supabaseAdmin
        .from("restaurants")
        .update({
          stripe_account_id: stripeAccountId,
          stripe_onboarding_completed: false,
          stripe_charges_enabled: !!account.charges_enabled,
          stripe_payouts_enabled: !!account.payouts_enabled,
          stripe_details_submitted: !!account.details_submitted,
        })
        .eq("id", restaurant.id)

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message || "Erro ao salvar conta Stripe." },
          { status: 500 }
        )
      }
    } else {
      const account = await stripe.accounts.retrieve(stripeAccountId)

      const { error: syncError } = await supabaseAdmin
        .from("restaurants")
        .update({
          stripe_charges_enabled: !!account.charges_enabled,
          stripe_payouts_enabled: !!account.payouts_enabled,
          stripe_details_submitted: !!account.details_submitted,
          stripe_onboarding_completed:
            !!account.details_submitted &&
            !!account.charges_enabled &&
            !!account.payouts_enabled,
        })
        .eq("id", restaurant.id)

      if (syncError) {
        return NextResponse.json(
          { error: syncError.message || "Erro ao sincronizar conta Stripe." },
          { status: 500 }
        )
      }
    }

    const baseAppUrl = getBaseAppUrl()

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${baseAppUrl}/configuracoes?tab=payments&stripe=refresh`,
      return_url: `${baseAppUrl}/configuracoes?tab=payments&stripe=return`,
      type: "account_onboarding",
    })

    return NextResponse.json({
      success: true,
      accountId: stripeAccountId,
      onboardingUrl: accountLink.url,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro interno do servidor.",
      },
      { status: 500 }
    )
  }
}