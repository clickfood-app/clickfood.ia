"use client"

// ══════════════════════════════════════════════════════════════════════════════
// AUTH UTILITIES - Simulated authentication (ready for Supabase integration)
// ══════════════════════════════════════════════════════════════════════════════

export interface User {
  id: string
  email: string
  name: string
  created_at: string
}

export interface Restaurant {
  id: string
  user_id: string
  name: string
  slug: string
  whatsapp: string
  logo_url: string | null
  cover_url: string | null
  address: string | null
  delivery_fee: number
  min_order: number
  is_open: boolean
  created_at: string
  configured: boolean // true after completing setup
}

export interface Subscription {
  id: string
  user_id: string
  plan: "free_trial" | "monthly" | "yearly"
  status: "active" | "canceled" | "past_due" | "trialing"
  current_period_start: string
  current_period_end: string
  trial_ends_at: string | null
}

export interface AuthSession {
  user: User
  restaurant: Restaurant | null
  subscription: Subscription | null
}

// Storage keys
const STORAGE_KEY = "cardapio_auth_session"
const USERS_KEY = "cardapio_users"

// ── Helper functions ──

function getStoredUsers(): Record<string, { user: User; password: string; restaurant: Restaurant | null; subscription: Subscription | null }> {
  if (typeof window === "undefined") return {}
  const data = localStorage.getItem(USERS_KEY)
  return data ? JSON.parse(data) : {}
}

function saveUsers(users: Record<string, { user: User; password: string; restaurant: Restaurant | null; subscription: Subscription | null }>) {
  if (typeof window === "undefined") return
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

// ── Auth functions ──

export async function signUp(email: string, password: string, name: string, restaurantName: string): Promise<{ success: boolean; error?: string }> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 800))

  const users = getStoredUsers()

  // Check if email already exists
  if (users[email]) {
    return { success: false, error: "Este email ja esta cadastrado" }
  }

  // Create user
  const user: User = {
    id: generateId(),
    email,
    name,
    created_at: new Date().toISOString(),
  }

  // Create restaurant
  const restaurant: Restaurant = {
    id: generateId(),
    user_id: user.id,
    name: restaurantName,
    slug: generateSlug(restaurantName),
    whatsapp: "",
    logo_url: null,
    cover_url: null,
    address: null,
    delivery_fee: 5,
    min_order: 20,
    is_open: true,
    created_at: new Date().toISOString(),
    configured: false, // Needs to complete setup
  }

  // Create trial subscription (7 days)
  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 7)

  const subscription: Subscription = {
    id: generateId(),
    user_id: user.id,
    plan: "free_trial",
    status: "trialing",
    current_period_start: new Date().toISOString(),
    current_period_end: trialEnd.toISOString(),
    trial_ends_at: trialEnd.toISOString(),
  }

  // Save user data
  users[email] = { user, password, restaurant, subscription }
  saveUsers(users)

  // Create session
  const session: AuthSession = { user, restaurant, subscription }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))

  return { success: true }
}

export async function signIn(email: string, password: string): Promise<{ success: boolean; error?: string; needsSubscription?: boolean }> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 600))

  const users = getStoredUsers()
  const userData = users[email]

  if (!userData) {
    return { success: false, error: "Email ou senha incorretos" }
  }

  if (userData.password !== password) {
    return { success: false, error: "Email ou senha incorretos" }
  }

  // Check subscription status
  const subscription = userData.subscription
  let needsSubscription = false

  if (subscription) {
    const now = new Date()
    const periodEnd = new Date(subscription.current_period_end)

    if (subscription.status === "trialing" && subscription.trial_ends_at) {
      const trialEnd = new Date(subscription.trial_ends_at)
      if (now > trialEnd) {
        // Trial expired
        subscription.status = "canceled"
        needsSubscription = true
      }
    } else if (subscription.status === "canceled" || now > periodEnd) {
      needsSubscription = true
    }

    // Update stored data
    users[email].subscription = subscription
    saveUsers(users)
  } else {
    needsSubscription = true
  }

  // Create session
  const session: AuthSession = {
    user: userData.user,
    restaurant: userData.restaurant,
    subscription: userData.subscription,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))

  return { success: true, needsSubscription }
}

export async function signOut(): Promise<void> {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return null

  try {
    return JSON.parse(data) as AuthSession
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return getSession() !== null
}

export function hasActiveSubscription(): boolean {
  const session = getSession()
  if (!session?.subscription) return false

  const { subscription } = session
  const now = new Date()

  if (subscription.status === "trialing" && subscription.trial_ends_at) {
    return now < new Date(subscription.trial_ends_at)
  }

  if (subscription.status === "active") {
    return now < new Date(subscription.current_period_end)
  }

  return false
}

export function getTrialDaysRemaining(): number | null {
  const session = getSession()
  if (!session?.subscription) return null

  const { subscription } = session
  if (subscription.status !== "trialing" || !subscription.trial_ends_at) return null

  const now = new Date()
  const trialEnd = new Date(subscription.trial_ends_at)
  const diff = trialEnd.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  return Math.max(0, days)
}

// ── Configuration check ──

export function isRestaurantConfigured(): boolean {
  const session = getSession()
  return session?.restaurant?.configured === true
}

export function markRestaurantConfigured(): void {
  const session = getSession()
  if (!session?.user || !session.restaurant) return

  const users = getStoredUsers()
  const userData = users[session.user.email]
  if (!userData || !userData.restaurant) return

  userData.restaurant.configured = true
  saveUsers(users)

  // Update session
  session.restaurant.configured = true
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

// ── Update functions ──

export function updateRestaurant(updates: Partial<Restaurant>): void {
  const session = getSession()
  if (!session?.user || !session.restaurant) return

  const users = getStoredUsers()
  const userData = users[session.user.email]
  if (!userData) return

  userData.restaurant = { ...userData.restaurant!, ...updates }
  saveUsers(users)

  // Update session
  session.restaurant = userData.restaurant
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function activateSubscription(plan: "monthly" | "yearly"): void {
  const session = getSession()
  if (!session?.user) return

  const users = getStoredUsers()
  const userData = users[session.user.email]
  if (!userData) return

  const now = new Date()
  const periodEnd = new Date()
  periodEnd.setMonth(periodEnd.getMonth() + (plan === "yearly" ? 12 : 1))

  const subscription: Subscription = {
    id: userData.subscription?.id || generateId(),
    user_id: session.user.id,
    plan,
    status: "active",
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    trial_ends_at: null,
  }

  userData.subscription = subscription
  saveUsers(users)

  // Update session
  session.subscription = subscription
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}
