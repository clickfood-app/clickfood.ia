import { createClient } from "@/lib/supabase/client"

export type AuthSession = any
export type User = any
export type Restaurant = any
export type Subscription = any

function getSupabase() {
  return createClient()
}

export async function signIn(email: string, password: string) {
  const supabase = getSupabase()
  const normalizedEmail = email.trim().toLowerCase()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  return {
    success: true,
    user: data.user,
    session: data.session,
  }
}

export async function signUp() {
  return {
    success: false,
    error:
      "Cadastro publico desativado. Entre em contato com a equipe ClickFood para solicitar acesso.",
  }
}

export async function signOut() {
  const supabase = getSupabase()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  return {
    success: true,
    error: null,
  }
}

export async function getCurrentUser() {
  const supabase = getSupabase()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    return null
  }

  return user
}

export async function getCurrentSession() {
  const supabase = getSupabase()

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    return null
  }

  return session
}

export async function getRestaurantByOwner(ownerId: string) {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle()

  if (error) {
    return {
      success: false,
      error: error.message,
      restaurant: null,
    }
  }

  return {
    success: true,
    error: null,
    restaurant: data,
  }
}

export async function activateSubscription(plan: string = "trial") {
  const supabase = getSupabase()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      success: false,
      error: userError?.message || "Usuario nao autenticado.",
    }
  }

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (restaurantError || !restaurant) {
    return {
      success: false,
      error: restaurantError?.message || "Restaurante nao encontrado.",
    }
  }

  const { error: updateError } = await supabase
    .from("restaurants")
    .update({
      subscription_status: "active",
      subscription_plan: plan,
      trial_ends_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", restaurant.id)

  if (updateError) {
    return {
      success: false,
      error: updateError.message,
    }
  }

  return {
    success: true,
    error: null,
  }
}

export async function markRestaurantConfigured() {
  const supabase = getSupabase()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      success: false,
      error: userError?.message || "Usuario nao autenticado.",
    }
  }

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (restaurantError || !restaurant) {
    return {
      success: false,
      error: restaurantError?.message || "Restaurante nao encontrado.",
    }
  }

  const { error: updateError } = await supabase
    .from("restaurants")
    .update({
      configured: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", restaurant.id)

  if (updateError) {
    return {
      success: false,
      error: updateError.message,
    }
  }

  return {
    success: true,
    error: null,
  }
}