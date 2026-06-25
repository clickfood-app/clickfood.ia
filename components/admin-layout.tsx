"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Settings,
  User,
  Volume2,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import AdminSidebar from "@/components/admin-sidebar"
import { useAuth } from "@/components/auth/auth-provider"

interface AdminLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
}

type RestaurantContext = {
  id?: string | null
  name?: string | null
  restaurant_name?: string | null
  logo_url?: string | null
  logoUrl?: string | null
}

const breadcrumbMap: Record<string, string> = {
  "/": "Pedidos",
  "/gestao": "Painel",

  // Operação
  "/novo-pedido": "Novo pedido",
  "/pedidos": "Pedidos",
  "/entregas": "Entregas",
  "/kds": "KDS",

  // Cardápio e vendas
  "/divulgar-cardapio": "Cardápio",
  "/produtos": "Produtos",
  "/clientes": "Clientes",
  "/cupons": "Cupons",
  "/checkout": "Checkout",

  // Campanhas
  "/campanhas": "Campanhas",
  "/campanhas/upsell": "Upsell",
  "/campanhas/fidelidade": "Fidelidade",
  "/campanhas/cashback": "Cashback",

  // Gestão interna
  "/fornecedores": "Fornecedores",
  "/financeiro/controle-estoque": "Estoque",
  "/controle-estoque": "Controle de estoque",
  "/ficha-tecnica": "Ficha técnica",
  "/perdas-desperdicio": "Perdas e desperdício",
  "/metas": "Metas",

  // Financeiro
  "/financeiro": "Finanças",
  "/financeiro/contas-a-pagar": "Contas a pagar",
  "/financeiro/despesas": "Despesas",
  "/financeiro/relatorios": "Relatórios",

  // Configurações
  "/entregadores": "Entregadores",
  "/configuracoes": "Configurações",
}

function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return "AD"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return `${words[0][0]}${words[1][0]}`.toUpperCase()
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const { user, restaurant } = useAuth()

  const restaurantFromAuth = restaurant as RestaurantContext | null

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const [restaurantId, setRestaurantId] = useState<string | null>(
    restaurantFromAuth?.id ?? null,
  )
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(false)

  const profileRef = useRef<HTMLDivElement | null>(null)
  const soundAlertsEnabledRef = useRef(false)

  const userName =
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    "Administrador"

  const userEmail = user?.email || "admin@empresa.com"
  const userInitials = getInitials(userName)

  const currentPage =
    title ||
    breadcrumbMap[pathname] ||
    pathname.replace("/", "").charAt(0).toUpperCase() + pathname.slice(2)

  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev)
  }

  const toggleMobileSidebar = () => {
    setIsMobileOpen((prev) => !prev)
  }

  const closeMobileSidebar = () => {
    setIsMobileOpen(false)
  }

  const playOrderBellSound = useCallback(async () => {
    if (typeof window === "undefined") return

    try {
      const audio = new Audio("/sounds/order-bell.mp3")
      audio.volume = 0.8
      await audio.play()
    } catch (error) {
      console.error("Erro ao tocar som de pedido:", error)
    }
  }, [])

  const handleEnableAlerts = useCallback(async () => {
    await playOrderBellSound()

    setSoundAlertsEnabled(true)
    soundAlertsEnabledRef.current = true

    if (typeof window !== "undefined") {
      window.localStorage.setItem("clickfood_admin_sound_alerts_enabled", "true")
    }

    toast.success("Som de pedidos ativado", {
      description: "O sistema vai tocar um alerta quando chegar pedido novo.",
    })
  }, [playOrderBellSound])

  const handleLogout = async () => {
    if (isLoggingOut) return

    try {
      setIsLoggingOut(true)
      setProfileOpen(false)
      setIsMobileOpen(false)

      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error("Erro ao sair:", error.message)
        setIsLoggingOut(false)
        return
      }

      router.replace("/auth")
      router.refresh()

      window.setTimeout(() => {
        window.location.replace("/auth")
      }, 150)
    } catch (error) {
      console.error("Erro inesperado ao sair:", error)
      setIsLoggingOut(false)
    }
  }

  useEffect(() => {
    soundAlertsEnabledRef.current = soundAlertsEnabled
  }, [soundAlertsEnabled])

  useEffect(() => {
    if (typeof window === "undefined") return

    const savedPreference = window.localStorage.getItem(
      "clickfood_admin_sound_alerts_enabled",
    )

    if (savedPreference === "true") {
      setSoundAlertsEnabled(true)
      soundAlertsEnabledRef.current = true
    }
  }, [])

  useEffect(() => {
    if (restaurantFromAuth?.id) {
      setRestaurantId(restaurantFromAuth.id)
      return
    }

    const userId = user?.id

    if (!userId) {
      setRestaurantId(null)
      return
    }

    let cancelled = false

    async function fetchRestaurantId() {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", userId)
        .limit(1)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error(
          "Erro ao buscar restaurante para alertas de pedidos:",
          error.message,
        )
        setRestaurantId(null)
        return
      }

      setRestaurantId(data?.id ?? null)
    }

    void fetchRestaurantId()

    return () => {
      cancelled = true
    }
  }, [restaurantFromAuth?.id, supabase, user?.id])

  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel(`orders-bell-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          if (soundAlertsEnabledRef.current) {
            void playOrderBellSound()
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [playOrderBellSound, restaurantId, supabase])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  return (
    <div className="restaurant-admin-theme min-h-screen bg-black text-white">
      <div className="hidden md:block">
        <AdminSidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      </div>

      <div className="md:hidden">
        {isMobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={closeMobileSidebar}
            />

            <div className="fixed left-0 top-0 z-50">
              <AdminSidebar
                isCollapsed={false}
                onToggleCollapse={closeMobileSidebar}
              />
            </div>
          </>
        )}
      </div>

      <div
        className={cn(
          "min-h-screen transition-all duration-300 md:ml-64 md:w-[calc(100%-16rem)]",
          isCollapsed && "md:ml-[72px] md:w-[calc(100%-72px)]",
        )}
      >
        <header className="sticky top-0 z-30 border-b border-white/10 bg-black/95 shadow-sm shadow-black/30 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={toggleMobileSidebar}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#050505] text-white transition hover:border-yellow-400 hover:bg-yellow-400 hover:text-black md:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="hidden min-w-0 items-center gap-2 sm:flex">
                <Link
                  href="/pedidos"
                  className="text-sm font-bold text-zinc-500 transition hover:text-yellow-300"
                >
                  Painel
                </Link>

                <ChevronRight className="h-4 w-4 text-zinc-500" />

                <span className="truncate text-sm font-black text-white">
                  {currentPage}
                </span>
              </div>

              <div className="min-w-0 sm:hidden">
                <p className="truncate text-base font-black text-white">
                  {currentPage}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {!soundAlertsEnabled && (
                <button
                  type="button"
                  onClick={handleEnableAlerts}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-yellow-400/50 bg-yellow-400 px-3 text-sm font-black text-black shadow-sm transition hover:bg-yellow-300"
                >
                  <Volume2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Ativar alertas</span>
                </button>
              )}

              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((prev) => !prev)
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#050505] px-2 transition hover:border-yellow-400 hover:bg-[#080808]"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-xs font-black text-black">
                    {userInitials}
                  </div>

                  <div className="hidden text-left md:block">
                    <p className="max-w-[140px] truncate text-sm font-black leading-none text-white">
                      {userName}
                    </p>

                    <p className="mt-1 max-w-[140px] truncate text-xs leading-none text-zinc-500">
                      {userEmail}
                    </p>
                  </div>

                  <ChevronDown className="hidden h-4 w-4 text-zinc-500 md:block" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-2xl border border-white/10 bg-[#050505] p-2 shadow-xl shadow-black/30">
                    <div className="border-b border-white/10 px-3 py-3">
                      <p className="truncate text-sm font-black text-white">
                        {userName}
                      </p>

                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {userEmail}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false)
                        router.push("/configuracoes")
                      }}
                      className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-500 transition hover:bg-yellow-400 hover:text-black"
                    >
                      <User className="h-4 w-4" />
                      Perfil
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false)
                        router.push("/configuracoes")
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-500 transition hover:bg-yellow-400 hover:text-black"
                    >
                      <Settings className="h-4 w-4" />
                      Configurações
                    </button>

                    <div className="my-2 h-px bg-[#111111]" />

                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-red-400 transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <LogOut className="h-4 w-4" />
                      {isLoggingOut ? "Saindo..." : "Sair"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="bg-black p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </main>
      </div>
    </div>
  )
}