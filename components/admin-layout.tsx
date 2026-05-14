"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  PlusCircle,
  Settings,
  Store,
  User,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import AdminSidebar from "@/components/admin-sidebar"
import { useAuth } from "@/components/auth/auth-provider"

interface AdminLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
}

type NotificationItem = {
  id: number
  title: string
  description: string
  time: string
  type: "order" | "alert" | "info"
  unread: boolean
}

type RestaurantWithLogo = {
  name?: string | null
  logo_url?: string | null
}

const breadcrumbMap: Record<string, string> = {
  "/": "Gestão",
  "/gestao": "Gestão",
  "/pedidos": "Pedidos",
  "/novo-pedido": "Novo Pedido",
  "/mesas": "Mesas",
  "/entregadores": "Entregadores",
  "/produtos": "Produtos",
  "/clientes": "Clientes",
  "/cardapio": "Cardápio",
  "/cupons": "Cupons",
  "/financeiro": "Financeiro",
  "/configuracoes": "Configurações",
}

export default function AdminLayout({
  children,
  title,
}: AdminLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const { restaurant, user } = useAuth()

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 1,
      title: "Novo pedido recebido",
      description: "Mesa 04 acabou de fazer um pedido.",
      time: "agora",
      type: "order",
      unread: true,
    },
    {
      id: 2,
      title: "Estoque baixo",
      description: "O item 'Pão brioche' está quase acabando.",
      time: "há 12 min",
      type: "alert",
      unread: true,
    },
    {
      id: 3,
      title: "Cupom em destaque",
      description: "O cupom CLICK10 foi usado 5 vezes hoje.",
      time: "há 1 hora",
      type: "info",
      unread: false,
    },
  ])

  const profileRef = useRef<HTMLDivElement | null>(null)
  const notificationsRef = useRef<HTMLDivElement | null>(null)

  const restaurantWithLogo = restaurant as RestaurantWithLogo | null

  const restaurantName = restaurant?.name || "Meu Restaurante"
  const restaurantLogoUrl = restaurantWithLogo?.logo_url || null

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

  const unreadCount = notifications.filter((item) => item.unread).length

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

  const handleLogout = async () => {
    if (isLoggingOut) return

    try {
      setIsLoggingOut(true)
      setProfileOpen(false)
      setNotificationsOpen(false)
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

  const handleMarkAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        unread: false,
      }))
    )
  }

  const handleOpenNotification = (id: number) => {
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, unread: false } : item
      )
    )
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false)
      }

      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
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
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
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
          "min-h-screen transition-all duration-300",
          "md:ml-64",
          isCollapsed && "md:ml-[72px]"
        )}
      >
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={toggleMobileSidebar}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 md:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="hidden items-center gap-3 sm:flex">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-white shadow-sm">
                  {restaurantLogoUrl ? (
                    <img
                      src={restaurantLogoUrl}
                      alt={restaurantName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Store className="h-5 w-5" />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {restaurantName}
                  </p>

                  <p className="truncate text-xs font-medium text-slate-500">
                    Operação do restaurante
                  </p>
                </div>
              </div>

              <div className="hidden h-7 w-px bg-slate-200 lg:block" />

              <div className="hidden min-w-0 items-center gap-2 lg:flex">
                <Link
                  href="/gestao"
                  className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
                >
                  Gestão
                </Link>

                <ChevronRight className="h-4 w-4 text-slate-300" />

                <span className="truncate text-sm font-bold text-slate-900">
                  {currentPage}
                </span>
              </div>

              <div className="min-w-0 sm:hidden">
                <p className="truncate text-base font-bold text-slate-900">
                  {currentPage}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 xl:flex">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="font-semibold">Restaurante aberto</span>
              </div>

              <div className="relative" ref={notificationsRef}>
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen((prev) => !prev)
                    setProfileOpen(false)
                  }}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Notificações"
                >
                  <Bell className="h-5 w-5" />

                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Notificações
                        </h3>

                        <p className="text-xs text-slate-500">
                          {unreadCount} não lida{unreadCount !== 1 ? "s" : ""}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                        className="text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                      >
                        Marcar todas
                      </button>
                    </div>

                    <div className="max-h-[360px] overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => handleOpenNotification(notification.id)}
                            className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50"
                          >
                            <div className="mt-0.5">
                              {notification.type === "alert" ? (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                                  <AlertCircle className="h-4 w-4" />
                                </div>
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                  <CheckCircle2 className="h-4 w-4" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-800">
                                  {notification.title}
                                </p>

                                {notification.unread && (
                                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
                                )}
                              </div>

                              <p className="mt-1 text-sm text-slate-500">
                                {notification.description}
                              </p>

                              <p className="mt-2 text-xs text-slate-400">
                                {notification.time}
                              </p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-10 text-center">
                          <Bell className="mx-auto h-8 w-8 text-slate-300" />
                          <p className="mt-3 text-sm font-semibold text-slate-600">
                            Nenhuma notificação
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Quando houver novidades, elas aparecerão aqui.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-100 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        className="w-full rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {pathname !== "/novo-pedido" && (
                <Link
                  href="/novo-pedido"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 md:px-4"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Novo Pedido</span>
                </Link>
              )}

              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((prev) => !prev)
                    setNotificationsOpen(false)
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 transition hover:bg-slate-50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {userInitials}
                  </div>

                  <div className="hidden text-left md:block">
                    <p className="max-w-[140px] truncate text-sm font-bold leading-none text-slate-800">
                      {userName}
                    </p>

                    <p className="mt-1 max-w-[140px] truncate text-xs leading-none text-slate-500">
                      {userEmail}
                    </p>
                  </div>

                  <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="border-b border-slate-100 px-3 py-3">
                      <p className="truncate text-sm font-bold text-slate-900">
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
                      className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
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
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      <Settings className="h-4 w-4" />
                      Configurações
                    </button>

                    <div className="my-2 h-px bg-slate-200" />

                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
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

        <main className="p-4 md:p-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}