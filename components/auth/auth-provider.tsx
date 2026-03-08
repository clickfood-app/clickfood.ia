"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

// Tipos de usuário e restaurante
export interface User {
  id: string
  name: string
  email: string
}

export interface Restaurant {
  id: string
  name: string
  logo_url?: string
}

// Tipagem do contexto
interface AuthContextType {
  user: User | null
  restaurant: Restaurant | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Buscar sessão ao iniciar
  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession()

      const sessionUser = data.session?.user

      if (sessionUser) {
        setUser({
          id: sessionUser.id,
          name: sessionUser.user_metadata?.name || "Administrador",
          email: sessionUser.email!,
        })

        const { data: restData, error } = await supabase
          .from("restaurants")
          .select("*")
          .eq("owner_id", sessionUser.id)
          .single()

        if (!error && restData) {
          setRestaurant(restData as Restaurant)
        }
      }

      setIsLoading(false)
    }

    fetchSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null)
        setRestaurant(null)
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  // LOGIN
  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    const sessionUser = data.user

    if (sessionUser) {
      setUser({
        id: sessionUser.id,
        name: sessionUser.user_metadata?.name || "Administrador",
        email: sessionUser.email!,
      })

      const { data: restData } = await supabase
        .from("restaurants")
        .select("*")
        .eq("owner_id", sessionUser.id)
        .single()

      if (restData) {
        setRestaurant(restData as Restaurant)
      }
    }
  }

  // LOGOUT
  const logout = async () => {
    await supabase.auth.signOut({ scope: "global" })

    setUser(null)
    setRestaurant(null)

    window.location.href = "/login"
  }

  return (
    <AuthContext.Provider value={{ user, restaurant, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider")
  }

  return context
}