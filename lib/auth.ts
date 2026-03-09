import { supabase } from "./supabase"

export type AuthSession = any
export type User = any
export type Restaurant = any
export type Subscription = any

// =============================
// LOGIN
// =============================
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
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

// =============================
// CRIAR CONTA
// =============================
export async function signUp(
  email: string,
  password: string,
  name: string,
  restaurantName: string
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  const user = data.user

  if (!user) {
    return {
      success: false,
      error: "Erro ao criar usuário",
    }
  }

  // criar perfil
  const { error: profileError } = await supabase.from("profiles").insert({
    id: user.id,
    name,
    email,
    trial_started_at: new Date().toISOString(),
    subscription_status: "trial",
  })

  if (profileError) {
    return {
      success: false,
      error: profileError.message,
    }
  }

  // criar restaurante
  const { error: restaurantError } = await supabase.from("restaurants").insert({
    name: restaurantName,
    owner_id: user.id,
  })

  if (restaurantError) {
    return {
      success: false,
      error: restaurantError.message,
    }
  }

  return {
    success: true,
    user,
  }
}

// =============================
// PEGAR SESSÃO
// =============================
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// =============================
// LOGOUT
// =============================
export async function signOut() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error("Erro ao sair:", error.message)
  }

  // redireciona para login
  if (typeof window !== "undefined") {
    window.location.href = "/auth.ts"
  }
}
  

// =============================
// PEGAR PERFIL
// =============================
export async function getProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (error) return null

  return data
}

// =============================
// ASSINATURA ATIVA
// =============================
export function hasActiveSubscription(profile: any) {
  return profile?.subscription_status === "active"
}

// =============================
// DIAS RESTANTES DO TRIAL
// =============================
export function getTrialDaysRemaining(profile: any) {
  if (!profile?.trial_started_at) return 0

  const start = new Date(profile.trial_started_at)
  const now = new Date()

  const diff = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  )

  return Math.max(30 - diff, 0)
}

// =============================
// RESTAURANTE CONFIGURADO
// =============================
export async function isRestaurantConfigured() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", user.id)
    .single()

  return !!data
}

export function markRestaurantConfigured() {
  if (typeof window === "undefined") return
  localStorage.setItem("restaurant_configured", "true")
}

// =============================
// ATIVAR ASSINATURA
// =============================
export async function activateSubscription(plan: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Usuário não autenticado")

  const now = new Date()

  const { error } = await supabase
    .from("profiles")
    .update({
      subscription_plan: plan,
      subscription_status: "active",
      subscription_started_at: now.toISOString(),
    })
    .eq("id", user.id)

  if (error) throw error
}