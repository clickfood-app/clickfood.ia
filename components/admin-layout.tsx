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
}

const CLICKFOOD_LOGO_URL = "/logo.png"

const breadcrumbMap: Record<string, string> = {
  "/": "Gestão",
  "/gestao": "Gestão",

  "/pedidos": "Pedidos",
  "/mesas": "Mesas",
  "/entregas": "Entregas",

  "/clientes": "Clientes",
  "/cupons": "Cupons",
  "/checkout": "Checkout",

  "/campanhas": "Campanhas",
  "/campanhas/upsell": "Upsell",
  "/campanhas/fidelidade": "Fidelidade",
  "/campanhas/cashback": "Cashback",

  "/fornecedores": "Fornecedores",
  "/controle-estoque": "Controle de estoque",
  "/ficha-tecnica": "Ficha técnica",
  "/perdas-desperdicio": "Perdas e desperdício",
  "/metas": "Metas",

  "/financeiro": "Finanças",
  "/financeiro/caixa": "Caixa do dia",
  "/financeiro/recebimentos": "Recebimentos",
  "/financeiro/contas-a-pagar": "Contas a pagar",
  "/financeiro/despesas": "Despesas",
  "/financeiro/cmv": "CMV e margem",

  "/crescimento": "Crescimento",
  "/crescimento/ranking-produtos": "Ranking de produtos",
  "/crescimento/clientes-sumidos": "Clientes sumidos",
  "/crescimento/radar-bairros": "Radar de bairros",
  "/crescimento/alertas": "Alertas inteligentes",

  "/configuracoes": "Configurações",
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
  const [brandLogoFailed, setBrandLogoFailed] = useState(false)

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

  const userInitials =
    userName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word: string) => word[0])
      .join("")
      .toUpperCase() || "AD"

  const currentPage =
    title ||
    breadcrumbMap[pathname] ||
    pathname.replace("/", "").charAt(0).toUpperCase() + pathname.slice(2)

  const isGestaoDashboard = pathname === "/gestao"

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
      description:
        "Agora a ClickFood vai tocar um sino quando chegar pedido novo.",
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
    setBrandLogoFailed(false)
  }, [])

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
    <div className="min-h-screen bg-[#07111f] text-slate-100">
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
              className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm"
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
        <header
          className={cn(
            "sticky top-0 z-30 border-b backdrop-blur-xl",
            "border-slate-800 bg-slate-950/95",
          )}
        >
          <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={toggleMobileSidebar}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-xl border transition md:hidden",
                  "border-slate-700 bg-slate-900 text-slate-200 hover:border-blue-500/40 hover:bg-slate-800",
                )}
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div
                className={cn(
                  "hidden items-center gap-4 sm:flex",
                  isGestaoDashboard && "sm:hidden",
                )}
              >
                <div
                  className={cn(
                    "flex h-11 items-center overflow-hidden rounded-xl border px-3 shadow-sm",
                    "border-slate-800 bg-slate-900",
                  )}
                >
                  {!brandLogoFailed ? (
                    <img
                      src={CLICKFOOD_LOGO_URL}
                      alt="ClickFood"
                      className="h-8 w-auto object-contain"
                      onError={() => setBrandLogoFailed(true)}
                    />
                  ) : (
                    <span className="text-sm font-bold text-white">
                      ClickFood
                    </span>
                  )}
                </div>

                <div
                  className={cn(
                    "hidden h-7 w-px lg:block",
                    "bg-slate-800",
                  )}
                />

                <div className="hidden min-w-0 items-center gap-2 lg:flex">
                  <Link
                    href="/gestao"
                    className={cn(
                      "text-sm font-medium transition",
                      "text-slate-400 hover:text-blue-300",
                    )}
                  >
                    Gestão
                  </Link>

                  <ChevronRight
                    className={cn(
                      "h-4 w-4",
                      "text-slate-700",
                    )}
                  />

                  <span
                    className={cn(
                      "truncate text-sm font-bold",
                      "text-white",
                    )}
                  >
                    {currentPage}
                  </span>
                </div>
              </div>

              <div className="min-w-0 sm:hidden">
                <p
                  className={cn(
                    "truncate text-base font-bold",
                    "text-white",
                  )}
                >
                  {currentPage}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {!soundAlertsEnabled && (
                <button
                  type="button"
                  onClick={handleEnableAlerts}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition",
                    "border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/15",
                  )}
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
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-xl border px-2 transition",
                    "border-slate-800 bg-slate-900 hover:border-blue-500/40 hover:bg-slate-800",
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {userInitials}
                  </div>

                  <div className="hidden text-left md:block">
                    <p
                      className={cn(
                        "max-w-[140px] truncate text-sm font-bold leading-none",
                        "text-white",
                      )}
                    >
                      {userName}
                    </p>

                    <p className="mt-1 max-w-[140px] truncate text-xs leading-none text-slate-500">
                      {userEmail}
                    </p>
                  </div>

                  <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-2xl border border-slate-800 bg-slate-900 p-2 shadow-xl shadow-slate-950/40">
                    <div className="border-b border-slate-800 px-3 py-3">
                      <p className="truncate text-sm font-bold text-white">
                        {userName}
                      </p>

                      <p className="mt-1 truncate text-xs text-slate-500">
                        {userEmail}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false)
                        router.push("/configuracoes")
                      }}
                      className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-blue-500/10 hover:text-blue-300"
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
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-blue-500/10 hover:text-blue-300"
                    >
                      <Settings className="h-4 w-4" />
                      Configurações
                    </button>

                    <div className="my-2 h-px bg-slate-800" />

                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
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

        <main className="min-h-[calc(100vh-4rem)] bg-[#07111f] p-4 md:p-6">
          <div
            className={cn(
              "mx-auto w-full",
              isGestaoDashboard ? "max-w-[1500px]" : "max-w-7xl",
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}