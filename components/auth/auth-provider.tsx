"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session, SupabaseClient, User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

type Restaurant = {
  id: string
  name?: string | null
  slug?: string | null
  owner_id?: string | null
}

type AuthContextType = {
  user: User | null
  session: Session | null
  restaurant: Restaurant | null
  isLoading: boolean
  refreshRestaurant: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function fetchRestaurantByUserId(
  supabase: SupabaseClient,
  userId: string
): Promise<Restaurant | null> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, name, slug, owner_id")
    .eq("owner_id", userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])

  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadRestaurant = useCallback(
    async (currentUser: User | null) => {
      if (!currentUser) {
        setRestaurant(null)
        return
      }

      try {
        const restaurantData = await fetchRestaurantByUserId(
          supabase,
          currentUser.id
        )
        setRestaurant(restaurantData ?? null)
      } catch (error) {
        console.error("Erro ao buscar restaurante do usuário:", error)
        setRestaurant(null)
      }
    },
    [supabase]
  )

  useEffect(() => {
    let isMounted = true

    async function bootstrap() {
      try {
        setIsLoading(true)

        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          throw error
        }

        if (!isMounted) return

        const currentUser = currentSession?.user ?? null

        setSession(currentSession ?? null)
        setUser(currentUser)

        if (currentUser) {
          const restaurantData = await fetchRestaurantByUserId(
            supabase,
            currentUser.id
          ).catch((err) => {
            console.error("Erro ao buscar restaurante do usuário:", err)
            return null
          })

          if (!isMounted) return
          setRestaurant(restaurantData ?? null)
        } else {
          setRestaurant(null)
        }
      } catch (error) {
        console.error("Erro ao inicializar autenticação:", error)

        if (!isMounted) return
        setSession(null)
        setUser(null)
        setRestaurant(null)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return

      const nextUser = nextSession?.user ?? null

      setSession(nextSession ?? null)
      setUser(nextUser)

      if (!nextUser) {
        setRestaurant(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)

      window.setTimeout(() => {
        if (!isMounted) return

        void loadRestaurant(nextUser).finally(() => {
          if (isMounted) {
            setIsLoading(false)
          }
        })
      }, 0)
    })

    void bootstrap()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [loadRestaurant, supabase])

  const refreshRestaurant = useCallback(async () => {
    await loadRestaurant(user)
  }, [loadRestaurant, user])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setRestaurant(null)
  }, [supabase])

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      restaurant,
      isLoading,
      refreshRestaurant,
      signOut,
    }),
    [user, session, restaurant, isLoading, refreshRestaurant, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}

export default AuthProvider