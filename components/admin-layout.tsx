"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  Star,
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

type NotificationKind = "order" | "review" | "alert" | "info"

type NotificationMetadata = Record<string, unknown> | null

type NotificationRow = {
  id: string
  restaurant_id: string
  type: string
  title: string
  message: string | null
  is_read: boolean | null
  metadata: NotificationMetadata
  created_at: string
  read_at?: string | null
}

type NotificationItem = {
  id: string
  restaurantId: string
  title: string
  description: string
  time: string
  type: NotificationKind
  unread: boolean
  createdAt: string
  metadata: NotificationMetadata
}

type RestaurantContext = {
  id?: string | null
}

const CLICKFOOD_LOGO_URL = "/logo.png"

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

  "/financeiro": "Finanças",
  "/financeiro/perdas": "Perdas",
  "/financeiro/entrada-saida": "Entrada e saída",
  "/financeiro/controle-estoque": "Controle de estoque",

  "/configuracoes": "Configurações",
}

function formatNotificationTime(createdAt?: string | null) {
  if (!createdAt) return "agora"

  const createdDate = new Date(createdAt)
  const diffMs = Date.now() - createdDate.getTime()

  if (!Number.isFinite(diffMs) || diffMs < 0) return "agora"

  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return "agora"
  if (diffMinutes < 60) return `${diffMinutes} min atrás`

  const diffHours = Math.floor(diffMinutes / 60)

  if (diffHours < 24) return `${diffHours}h atrás`

  const diffDays = Math.floor(diffHours / 24)

  if (diffDays === 1) return "ontem"
  if (diffDays < 7) return `${diffDays} dias atrás`

  return createdDate.toLocaleDateString("pt-BR")
}

function getNotificationKind(type?: string | null): NotificationKind {
  const normalizedType = (type || "").toLowerCase().trim()

  if (normalizedType === "new_order") return "order"
  if (normalizedType === "order_review") return "review"
  if (normalizedType.includes("alert") || normalizedType.includes("warning")) return "alert"

  return "info"
}

function mapNotificationRow(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    title: row.title || "Nova notificação",
    description: row.message || "Você recebeu uma nova atualização.",
    time: formatNotificationTime(row.created_at),
    type: getNotificationKind(row.type),
    unread: !row.is_read,
    createdAt: row.created_at,
    metadata: row.metadata ?? null,
  }
}

export default function AdminLayout({
  children,
  title,
}: AdminLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const { user, restaurant } = useAuth()

  const restaurantFromAuth = restaurant as RestaurantContext | null

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [brandLogoFailed, setBrandLogoFailed] = useState(false)

  const [restaurantId, setRestaurantId] = useState<string | null>(
    restaurantFromAuth?.id ?? null
  )
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(false)

  const profileRef = useRef<HTMLDivElement | null>(null)
  const notificationsRef = useRef<HTMLDivElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
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

  const playNotificationSound = useCallback(async () => {
    if (typeof window === "undefined") return

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext

      if (!AudioContextClass) return

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass()
      }

      const audioContext = audioContextRef.current

      if (audioContext.state === "suspended") {
        await audioContext.resume()
      }

      const now = audioContext.currentTime

      const playTone = (frequency: number, startAt: number, duration: number) => {
        const oscillator = audioContext.createOscillator()
        const gain = audioContext.createGain()

        oscillator.type = "sine"
        oscillator.frequency.setValueAtTime(frequency, startAt)

        gain.gain.setValueAtTime(0.0001, startAt)
        gain.gain.exponentialRampToValueAtTime(0.28, startAt + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

        oscillator.connect(gain)
        gain.connect(audioContext.destination)

        oscillator.start(startAt)
        oscillator.stop(startAt + duration + 0.03)
      }

      playTone(880, now, 0.14)
      playTone(660, now + 0.18, 0.18)
    } catch (error) {
      console.error("Erro ao tocar som de notificação:", error)
    }
  }, [])

  const handleEnableAlerts = useCallback(async () => {
    await playNotificationSound()

    setSoundAlertsEnabled(true)
    soundAlertsEnabledRef.current = true

    if (typeof window !== "undefined") {
      window.localStorage.setItem("clickfood_admin_sound_alerts_enabled", "true")
    }

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      await Notification.requestPermission()
    }

    toast.success("Alertas ativados", {
      description: "Agora a ClickFood pode tocar som quando chegar pedido ou avaliação.",
    })
  }, [playNotificationSound])

  const showBrowserNotification = useCallback(
    (notification: NotificationItem) => {
      if (typeof window === "undefined" || !("Notification" in window)) return
      if (Notification.permission !== "granted") return

      const browserNotification = new Notification(notification.title, {
        body: notification.description,
        icon: "/favicon.ico",
      })

      browserNotification.onclick = () => {
        window.focus()

        if (notification.type === "order" || notification.type === "review") {
          router.push("/pedidos")
        }
      }
    },
    [router]
  )

  const handleNewNotification = useCallback(
    (notification: NotificationItem) => {
      toast(notification.title, {
        description: notification.description,
        action:
          notification.type === "order" || notification.type === "review"
            ? {
                label: "Ver pedidos",
                onClick: () => router.push("/pedidos"),
              }
            : undefined,
      })

      showBrowserNotification(notification)

      if (soundAlertsEnabledRef.current) {
        void playNotificationSound()
      }
    },
    [playNotificationSound, router, showBrowserNotification]
  )

  const fetchNotifications = useCallback(async () => {
    if (!restaurantId) {
      setNotifications([])
      return
    }

    const { data, error } = await supabase
      .from("restaurant_notifications")
      .select(
        "id, restaurant_id, type, title, message, is_read, metadata, created_at, read_at"
      )
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(30)

    if (error) {
      console.error("Erro ao buscar notificações:", error.message)
      setNotifications([])
      return
    }

    setNotifications(((data ?? []) as NotificationRow[]).map(mapNotificationRow))
  }, [restaurantId, supabase])

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

  const handleMarkAllAsRead = async () => {
    if (!restaurantId) return

    const readAt = new Date().toISOString()

    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        unread: false,
      }))
    )

    const { error } = await supabase
      .from("restaurant_notifications")
      .update({
        is_read: true,
        read_at: readAt,
      })
      .eq("restaurant_id", restaurantId)
      .eq("is_read", false)

    if (error) {
      console.error("Erro ao marcar notificações como lidas:", error.message)
      void fetchNotifications()
    }
  }

  const handleOpenNotification = async (notification: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notification.id ? { ...item, unread: false } : item
      )
    )

    if (restaurantId) {
      const { error } = await supabase
        .from("restaurant_notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notification.id)
        .eq("restaurant_id", restaurantId)

      if (error) {
        console.error("Erro ao marcar notificação como lida:", error.message)
      }
    }

    if (notification.type === "order" || notification.type === "review") {
      setNotificationsOpen(false)
      router.push("/pedidos")
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
      "clickfood_admin_sound_alerts_enabled"
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
        console.error("Erro ao buscar restaurante para notificações:", error.message)
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
    void fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel(`restaurant-notifications-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "restaurant_notifications",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const notification = mapNotificationRow(payload.new as NotificationRow)

          setNotifications((prev) => [
            notification,
            ...prev.filter((item) => item.id !== notification.id),
          ].slice(0, 30))

          handleNewNotification(notification)
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "restaurant_notifications",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const notification = mapNotificationRow(payload.new as NotificationRow)

          setNotifications((prev) =>
            prev.map((item) =>
              item.id === notification.id ? notification : item
            )
          )
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Erro no canal realtime de notificações.")
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [handleNewNotification, restaurantId, supabase])

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

              <div className="hidden items-center gap-4 sm:flex">
                <div className="flex h-11 items-center overflow-hidden rounded-xl border border-slate-200 bg-white px-3 shadow-sm">
                  {!brandLogoFailed ? (
                    <img
                      src={CLICKFOOD_LOGO_URL}
                      alt="ClickFood"
                      className="h-8 w-auto object-contain"
                      onError={() => setBrandLogoFailed(true)}
                    />
                  ) : (
                    <span className="text-sm font-bold text-slate-900">
                      ClickFood
                    </span>
                  )}
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
              </div>

              <div className="min-w-0 sm:hidden">
                <p className="truncate text-base font-bold text-slate-900">
                  {currentPage}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {!soundAlertsEnabled && (
                <button
                  type="button"
                  onClick={handleEnableAlerts}
                  className="hidden h-10 items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 text-sm font-bold text-orange-700 transition hover:bg-orange-100 md:inline-flex"
                >
                  <Volume2 className="h-4 w-4" />
                  Ativar alertas
                </button>
              )}

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
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Notificações
                        </h3>

                        <p className="text-xs text-slate-500">
                          {unreadCount > 0
                            ? `${unreadCount} não lida${unreadCount !== 1 ? "s" : ""}`
                            : "Nenhuma notificação"}
                        </p>
                      </div>

                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllAsRead}
                          className="text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                        >
                          Marcar todas
                        </button>
                      )}
                    </div>

                    {!soundAlertsEnabled && (
                      <div className="border-b border-orange-100 bg-orange-50 px-4 py-3">
                        <button
                          type="button"
                          onClick={handleEnableAlerts}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-orange-600"
                        >
                          <Volume2 className="h-4 w-4" />
                          Ativar som de novos pedidos
                        </button>

                        <p className="mt-2 text-center text-xs font-medium text-orange-700">
                          O navegador exige um clique para liberar o som.
                        </p>
                      </div>
                    )}

                    <div className="max-h-[360px] overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => handleOpenNotification(notification)}
                            className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50"
                          >
                            <div className="mt-0.5">
                              {notification.type === "alert" ? (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                                  <AlertCircle className="h-4 w-4" />
                                </div>
                              ) : notification.type === "review" ? (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                                  <Star className="h-4 w-4" />
                                </div>
                              ) : notification.type === "order" ? (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                  <CheckCircle2 className="h-4 w-4" />
                                </div>
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                                  <Bell className="h-4 w-4" />
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
                            Novos pedidos e avaliações aparecerão aqui em tempo real.
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
