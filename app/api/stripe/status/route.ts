import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { stripe } from "@/lib/stripe"

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

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const { searchParams } = new URL(request.url)
    const restaurantId = String(searchParams.get("restaurantId") || "").trim()

    if (!restaurantId) {
      return NextResponse.json(
        { error: "restaurantId e obrigatorio." },
        { status: 400 }
      )
    }

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select(`
        id,
        owner_id,
        stripe_account_id,
        stripe_onboarding_completed,
        stripe_charges_enabled,
        stripe_payouts_enabled,
        stripe_details_submitted
      `)
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

    if (!restaurant.stripe_account_id) {
      return NextResponse.json({
        connected: false,
        stripeAccountId: null,
        onboardingCompleted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        requirements: null,
        capabilities: null,
      })
    }

    const account = await stripe.accounts.retrieve(restaurant.stripe_account_id)

    console.log(
  "STRIPE_ACCOUNT_DEBUG",
  JSON.stringify(
    {
      id: account.id,
      type: account.type,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      requirements: account.requirements,
      future_requirements: (account as any).future_requirements ?? null,
      capabilities: account.capabilities ?? null,
    },
    null,
    2
  )
)

    const onboardingCompleted =
      !!account.details_submitted &&
      !!account.charges_enabled &&
      !!account.payouts_enabled

    const requirements = account.requirements
      ? {
          currentlyDue: normalizeStringArray(account.requirements.currently_due),
          eventuallyDue: normalizeStringArray(account.requirements.eventually_due),
          pastDue: normalizeStringArray(account.requirements.past_due),
          pendingVerification: normalizeStringArray(
            account.requirements.pending_verification
          ),
          disabledReason: account.requirements.disabled_reason || null,
        }
      : null

    const capabilities = {
      card_payments: account.capabilities?.card_payments ?? null,
      transfers: account.capabilities?.transfers ?? null,
    }

    const { error: syncError } = await supabaseAdmin
      .from("restaurants")
      .update({
        stripe_onboarding_completed: onboardingCompleted,
        stripe_charges_enabled: !!account.charges_enabled,
        stripe_payouts_enabled: !!account.payouts_enabled,
        stripe_details_submitted: !!account.details_submitted,
      })
      .eq("id", restaurant.id)

    if (syncError) {
      return NextResponse.json(
        { error: syncError.message || "Erro ao sincronizar conta Stripe." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      connected: true,
      stripeAccountId: restaurant.stripe_account_id,
      onboardingCompleted,
      chargesEnabled: !!account.charges_enabled,
      payoutsEnabled: !!account.payouts_enabled,
      detailsSubmitted: !!account.details_submitted,
      requirements,
      capabilities,
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