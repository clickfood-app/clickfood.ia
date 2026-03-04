"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  type AuthSession,
  type User,
  type Restaurant,
  type Subscription,
  getSession,
  signOut as authSignOut,
  hasActiveSubscription,
  getTrialDaysRemaining,
  isRestaurantConfigured,
} from "@/lib/auth"

interface AuthContextType {
  session: AuthSession | null
  user: User | null
  restaurant: Restaurant | null
  subscription: Subscription | null
  isLoading: boolean
  isAuthenticated: boolean
  hasSubscription: boolean
  isConfigured: boolean
  trialDaysRemaining: number | null
  signOut: () => Promise<void>
  refreshSession: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/", "/auth", "/cardapio", "/oferta", "/bem-vindo", "/configurar"]

// Routes that require active subscription
const SUBSCRIPTION_ROUTES = ["/dashboard", "/pedidos", "/produtos", "/clientes", "/financeiro", "/relatorios", "/configuracoes", "/novo-pedido"]

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const refreshSession = useCallback(() => {
    const currentSession = getSession()
    setSession(currentSession)
  }, [])

  useEffect(() => {
    // Initial session load
    refreshSession()
    setIsLoading(false)
  }, [refreshSession])

  // Route protection
  useEffect(() => {
    if (isLoading) return

    const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith("/cardapio/"))
    const isSubscriptionRoute = SUBSCRIPTION_ROUTES.some((route) => pathname.startsWith(route))

    if (!session && !isPublicRoute) {
      // Not authenticated, redirect to auth
      router.push("/auth")
      return
    }

    if (session && isSubscriptionRoute && !hasActiveSubscription()) {
      // Has session but subscription expired, redirect to offer
      router.push("/oferta")
      return
    }

    // Check if user needs to complete restaurant setup
    if (session && isSubscriptionRoute && !isRestaurantConfigured()) {
      // Has session but restaurant not configured, redirect to setup
      router.push("/configurar")
      return
    }
  }, [session, pathname, isLoading, router])

  const handleSignOut = useCallback(async () => {
    await authSignOut()
    setSession(null)
    router.push("/auth")
  }, [router])

  const value: AuthContextType = {
    session,
    user: session?.user || null,
    restaurant: session?.restaurant || null,
    subscription: session?.subscription || null,
    isLoading,
    isAuthenticated: !!session,
    hasSubscription: hasActiveSubscription(),
    isConfigured: isRestaurantConfigured(),
    trialDaysRemaining: getTrialDaysRemaining(),
    signOut: handleSignOut,
    refreshSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
