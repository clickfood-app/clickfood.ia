"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  ClipboardCheck,
  Coins,
  FileBarChart,
  Gift,
  Globe,
  Megaphone,
  MonitorCheck,
  PackageOpen,
  PlusCircle,
  ReceiptText,
  Settings,
  ShoppingCart,
  Store,
  Target,
  TicketPercent,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

type NavChild = {
  label: string
  icon: React.ReactNode
  href: string
}

type NavItem = {
  label: string
  icon: React.ReactNode
  href: string
  children?: NavChild[]
}

type RestaurantBrand = {
  name: string
  logoUrl: string | null
  openTime: string | null
  closeTime: string | null
  closedToday: boolean
  activeDays: string[] | null
}

type AdminSidebarProps = {
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

const RESTAURANT_BRAND_CACHE_KEY = "clickfood_admin_sidebar_brand"

let cachedRestaurantBrand: RestaurantBrand | null = null

function getDefaultRestaurantBrand(): RestaurantBrand {
  return {
    name: "Sistema",
    logoUrl: null,
    openTime: null,
    closeTime: null,
    closedToday: false,
    activeDays: null,
  }
}

function readCachedRestaurantBrand() {
  if (cachedRestaurantBrand) return cachedRestaurantBrand
  if (typeof window === "undefined") return null

  try {
    const rawBrand = window.localStorage.getItem(RESTAURANT_BRAND_CACHE_KEY)

    if (!rawBrand) return null

    const parsedBrand = JSON.parse(rawBrand) as Partial<RestaurantBrand>

    const nextBrand: RestaurantBrand = {
      name:
        typeof parsedBrand.name === "string" && parsedBrand.name.trim()
          ? parsedBrand.name
          : "Sistema",
      logoUrl:
        typeof parsedBrand.logoUrl === "string" && parsedBrand.logoUrl.trim()
          ? parsedBrand.logoUrl
          : null,
      openTime:
        typeof parsedBrand.openTime === "string" && parsedBrand.openTime.trim()
          ? parsedBrand.openTime
          : null,
      closeTime:
        typeof parsedBrand.closeTime === "string" && parsedBrand.closeTime.trim()
          ? parsedBrand.closeTime
          : null,
      closedToday: Boolean(parsedBrand.closedToday),
      activeDays: Array.isArray(parsedBrand.activeDays)
        ? parsedBrand.activeDays.filter(
            (day): day is string => typeof day === "string" && Boolean(day),
          )
        : null,
    }

    cachedRestaurantBrand = nextBrand

    return nextBrand
  } catch (error) {
    console.error("Erro ao ler cache do menu lateral:", error)
    return null
  }
}

function saveCachedRestaurantBrand(brand: RestaurantBrand) {
  cachedRestaurantBrand = brand

  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(
      RESTAURANT_BRAND_CACHE_KEY,
      JSON.stringify(brand),
    )
  } catch (error) {
    console.error("Erro ao salvar cache do menu lateral:", error)
  }
}

const navItems: NavItem[] = [
  {
    label: "Novo Pedido",
    icon: <PlusCircle className="h-5 w-5" />,
    href: "/novo-pedido",
  },
  {
    label: "Pedidos",
    icon: <ShoppingCart className="h-5 w-5" />,
    href: "/pedidos",
  },
  {
    label: "KDS",
    icon: <MonitorCheck className="h-5 w-5" />,
    href: "/kds",
  },
  {
    label: "Cardápio",
    icon: <Globe className="h-5 w-5" />,
    href: "/divulgar-cardapio",
  },
  {
    label: "Produtos",
    icon: <PackageOpen className="h-5 w-5" />,
    href: "/produtos",
  },
  {
    label: "Gestão interna",
    icon: <Store className="h-5 w-5" />,
    href: "/fornecedores",
    children: [
      {
        label: "Fornecedores",
        icon: <Store className="h-4 w-4" />,
        href: "/fornecedores",
      },
      {
        label: "Estoque",
        icon: <PackageOpen className="h-4 w-4" />,
        href: "/financeiro/controle-estoque",
      },
      {
        label: "Ficha técnica",
        icon: <BookOpen className="h-4 w-4" />,
        href: "/ficha-tecnica",
      },
      {
        label: "Perdas e desperdício",
        icon: <CircleAlert className="h-4 w-4" />,
        href: "/perdas-desperdicio",
      },
      {
        label: "Metas",
        icon: <Target className="h-4 w-4" />,
        href: "/metas",
      },
    ],
  },
  {
    label: "Financeiro",
    icon: <Wallet className="h-5 w-5" />,
    href: "/financeiro",
    children: [
      {
        label: "Resumo",
        icon: <CircleDollarSign className="h-4 w-4" />,
        href: "/financeiro",
      },
      {
        label: "Contas a pagar",
        icon: <ReceiptText className="h-4 w-4" />,
        href: "/financeiro/contas-a-pagar",
      },
      {
        label: "Despesas",
        icon: <CircleAlert className="h-4 w-4" />,
        href: "/financeiro/despesas",
      },
      {
        label: "Relatórios",
        icon: <FileBarChart className="h-4 w-4" />,
        href: "/financeiro/relatorios",
      },
    ],
  },
  {
    label: "Entregadores",
    icon: <Truck className="h-5 w-5" />,
    href: "/entregadores",
  },
  {
    label: "Clientes",
    icon: <Users className="h-5 w-5" />,
    href: "/clientes",
  },
  {
    label: "Cupons",
    icon: <TicketPercent className="h-5 w-5" />,
    href: "/cupons",
  },
  {
    label: "Campanhas",
    icon: <Megaphone className="h-5 w-5" />,
    href: "/campanhas",
    children: [
      {
        label: "Visão Geral",
        icon: <ClipboardCheck className="h-4 w-4" />,
        href: "/campanhas",
      },
      {
        label: "Upsell",
        icon: <TrendingUp className="h-4 w-4" />,
        href: "/campanhas/upsell",
      },
      {
        label: "Fidelidade",
        icon: <Gift className="h-4 w-4" />,
        href: "/campanhas/fidelidade",
      },
      {
        label: "Cashback",
        icon: <Coins className="h-4 w-4" />,
        href: "/campanhas/cashback",
      },
    ],
  },
  {
    label: "Configurações",
    icon: <Settings className="h-5 w-5" />,
    href: "/configuracoes",
  },
]

const navGroups = [
  {
    title: "Operação",
    items: navItems.filter((item) =>
      ["Novo Pedido", "Pedidos", "KDS"].includes(item.label),
    ),
  },
  {
    title: "Cardápio",
    items: navItems.filter((item) =>
      ["Cardápio", "Produtos"].includes(item.label),
    ),
  },
  {
    title: "Administração",
    items: navItems.filter((item) =>
      [
        "Gestão interna",
        "Financeiro",
        "Entregadores",
        "Clientes",
        "Cupons",
        "Campanhas",
        "Configurações",
      ].includes(item.label),
    ),
  },
]

function isSubHrefActive(pathname: string, href: string) {
  if (href === "/financeiro") {
    return pathname === "/financeiro"
  }

  if (href === "/campanhas") {
    return pathname === "/campanhas"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function isHrefActive(pathname: string, item: NavItem) {
  if (item.children?.length) {
    return item.children.some((child) => isSubHrefActive(pathname, child.href))
  }

  if (item.href === "/gestao") {
    return pathname === "/" || pathname === "/gestao"
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function formatTime(value: string | null) {
  if (!value) return null

  const match = value.match(/^(\d{1,2}):(\d{2})/)

  if (!match) return value

  const hour = match[1].padStart(2, "0")
  const minute = match[2]

  return `${hour}:${minute}`
}

function parseTimeToMinutes(value: string | null) {
  if (!value) return null

  const match = value.match(/^(\d{1,2}):(\d{2})/)

  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2])

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null

  return hour * 60 + minute
}

function normalizeDayName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(".", "")
    .trim()
}

function isActiveToday(activeDays: string[] | null, now: Date) {
  if (!activeDays || activeDays.length === 0) return true

  const weekdayVariants = [
    ["domingo", "dom", "sunday", "0", "7"],
    ["segunda", "segunda-feira", "seg", "monday", "1"],
    ["terca", "terca-feira", "ter", "terça", "terça-feira", "tuesday", "2"],
    ["quarta", "quarta-feira", "qua", "wednesday", "3"],
    ["quinta", "quinta-feira", "qui", "thursday", "4"],
    ["sexta", "sexta-feira", "sex", "friday", "5"],
    ["sabado", "sabado-feira", "sábado", "sab", "saturday", "6"],
  ]

  const todayVariants = weekdayVariants[now.getDay()].map(normalizeDayName)

  return activeDays.some((day) => {
    const normalizedDay = normalizeDayName(day)

    return todayVariants.includes(normalizedDay)
  })
}

function getRestaurantStatus(brand: RestaurantBrand, now: Date) {
  const openLabel = formatTime(brand.openTime)
  const closeLabel = formatTime(brand.closeTime)

  if (brand.closedToday) {
    return {
      isOpen: false,
      label: "Fechado",
      description: "Fechado manualmente hoje",
    }
  }

  if (!isActiveToday(brand.activeDays, now)) {
    return {
      isOpen: false,
      label: "Fechado hoje",
      description: "Dia sem atendimento",
    }
  }

  const openMinutes = parseTimeToMinutes(brand.openTime)
  const closeMinutes = parseTimeToMinutes(brand.closeTime)

  if (openMinutes === null || closeMinutes === null) {
    return {
      isOpen: true,
      label: "Operação ativa",
      description: "Horário não configurado",
    }
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const isOpen =
    openMinutes <= closeMinutes
      ? currentMinutes >= openMinutes && currentMinutes < closeMinutes
      : currentMinutes >= openMinutes || currentMinutes < closeMinutes

  if (isOpen) {
    return {
      isOpen: true,
      label: "Aberto agora",
      description: closeLabel ? `Fecha às ${closeLabel}` : "Operação ativa",
    }
  }

  return {
    isOpen: false,
    label: "Fechado",
    description: openLabel ? `Abre às ${openLabel}` : "Fora do horário",
  }
}

export default function AdminSidebar({
  isCollapsed = false,
  onToggleCollapse,
}: AdminSidebarProps) {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])

  const [brand, setBrand] = useState<RestaurantBrand>(() =>
    getDefaultRestaurantBrand(),
  )
  const [isBrandLoaded, setIsBrandLoaded] = useState(false)
  const [now, setNow] = useState(() => new Date())

  const defaultOpenItems = useMemo(() => {
    return navItems
      .filter((item) =>
        item.children?.some((child) => isSubHrefActive(pathname, child.href)),
      )
      .map((item) => item.label)
  }, [pathname])

  const [openItems, setOpenItems] = useState<string[]>(defaultOpenItems)

  useEffect(() => {
    let isMounted = true

    async function loadRestaurantBrand() {
      const cachedBrand = readCachedRestaurantBrand()

      if (cachedBrand && isMounted) {
        setBrand(cachedBrand)
        setIsBrandLoaded(true)
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (isMounted) {
          setIsBrandLoaded(true)
        }

        return
      }

      const { data, error } = await supabase
        .from("restaurants")
        .select(
          "name, logo_url, open_time, close_time, closed_today, active_days",
        )
        .eq("owner_id", user.id)
        .maybeSingle()

      if (!isMounted) return

      if (error) {
        console.error("Erro ao carregar dados do menu lateral:", error.message)
        setIsBrandLoaded(true)
        return
      }

      if (!data) {
        setIsBrandLoaded(true)
        return
      }

      const nextBrand = {
        name: data.name || "Sistema",
        logoUrl: data.logo_url || null,
        openTime: data.open_time || null,
        closeTime: data.close_time || null,
        closedToday: Boolean(data.closed_today),
        activeDays: Array.isArray(data.active_days) ? data.active_days : null,
      }

      setBrand(nextBrand)
      saveCachedRestaurantBrand(nextBrand)
      setIsBrandLoaded(true)
    }

    void loadRestaurantBrand()

    return () => {
      isMounted = false
    }
  }, [supabase])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date())
    }, 60000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    setOpenItems((prev) => {
      const next = new Set(prev)

      for (const label of defaultOpenItems) {
        next.add(label)
      }

      return Array.from(next)
    })
  }, [defaultOpenItems])

  function toggleItem(label: string) {
    setOpenItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label],
    )
  }

  const operationStatus = useMemo(
    () => getRestaurantStatus(brand, now),
    [brand, now],
  )

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-blue-700 bg-[#2563eb] text-white shadow-xl shadow-blue-950/10 transition-all duration-300",
        isCollapsed ? "w-[72px]" : "w-64",
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className={cn(
          "absolute -right-3 top-5 z-50 hidden h-7 w-7 items-center justify-center rounded-lg border border-blue-100 bg-white text-[#2563eb] shadow-md transition hover:border-[#f97316] hover:bg-[#f97316] hover:text-white md:flex",
          isCollapsed && "right-[-14px]",
        )}
        aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>

      <div
        className={cn(
          "border-b border-white/15 bg-[#2563eb] p-3",
          isCollapsed && "flex h-16 items-center justify-center px-0 py-0",
        )}
      >
        <div
          className={cn(
            "flex items-center",
            isCollapsed ? "justify-center" : "justify-between gap-2",
          )}
        >
          <Link
            href="/pedidos"
            className={cn(
              "group flex min-w-0 items-center overflow-hidden",
              isCollapsed ? "justify-center" : "gap-3",
            )}
          >
            {isCollapsed ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#2563eb] shadow-sm">
                <Store className="h-5 w-5" />
              </div>
            ) : (
              <>
                <div className="h-9 w-1 shrink-0 rounded-full bg-[#f97316]" />

                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100">
                    Painel administrativo
                  </p>

                  <p className="mt-0.5 truncate text-sm font-black leading-tight text-white">
                    {brand.name}
                  </p>
                </div>
              </>
            )}
          </Link>

          {!isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:border-[#f97316] hover:bg-[#f97316] md:hidden"
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {!isCollapsed && (
          <>
            {isBrandLoaded ? (
              <div
                className={cn(
                  "mt-3 rounded-xl border px-3 py-2.5",
                  operationStatus.isOpen
                    ? "border-emerald-300/30 bg-emerald-950/15"
                    : "border-red-300/30 bg-red-950/15",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full ring-4",
                      operationStatus.isOpen
                        ? "bg-emerald-300 ring-emerald-300/15"
                        : "bg-red-300 ring-red-300/15",
                    )}
                  />

                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate text-xs font-bold uppercase tracking-[0.08em]",
                        operationStatus.isOpen
                          ? "text-emerald-100"
                          : "text-red-100",
                      )}
                    >
                      {operationStatus.label}
                    </p>

                    <p className="mt-0.5 truncate text-xs font-medium text-white/75">
                      {operationStatus.description}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="mt-3 h-[62px] rounded-xl border border-transparent px-3 py-2.5"
                aria-hidden="true"
              />
            )}
          </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 [scrollbar-color:rgba(255,255,255,0.35)_transparent] [scrollbar-width:thin]">
        <div className="flex flex-col gap-4">
          {navGroups.map((group) => (
            <div key={group.title}>
              {!isCollapsed && (
                <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-200">
                  {group.title}
                </p>
              )}

              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const active = isHrefActive(pathname, item)
                  const hasChildren = Boolean(item.children?.length)
                  const isOpen = openItems.includes(item.label)

                  if (hasChildren) {
                    return (
                      <div key={item.label}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isCollapsed) return
                            toggleItem(item.label)
                          }}
                          className={cn(
                            "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition",
                            active
                              ? "border-white/20 bg-white/10 text-white"
                              : "border-transparent text-blue-100 hover:bg-white/10 hover:text-white",
                            isCollapsed && "justify-center px-0",
                          )}
                          title={isCollapsed ? item.label : undefined}
                        >
                          <span
                            className={cn(
                              "flex shrink-0 items-center justify-center transition",
                              active
                                ? "text-[#fb923c]"
                                : "text-blue-100 group-hover:text-white",
                              isCollapsed && "h-10 w-10 rounded-xl",
                            )}
                          >
                            {item.icon}
                          </span>

                          {!isCollapsed && (
                            <>
                              <span className="min-w-0 flex-1 truncate">
                                {item.label}
                              </span>

                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 shrink-0 transition-transform",
                                  active ? "text-[#fb923c]" : "text-blue-200",
                                  isOpen && "rotate-180",
                                  isOpen && !active && "text-white",
                                )}
                              />
                            </>
                          )}
                        </button>

                        {!isCollapsed && isOpen && (
                          <div className="ml-4 mt-1 border-l border-white/20 pl-2">
                            <div className="flex flex-col gap-1">
                              {item.children?.map((child) => {
                                const childActive = isSubHrefActive(
                                  pathname,
                                  child.href,
                                )

                                return (
                                  <Link
                                    key={child.href}
                                    href={child.href}
                                    className={cn(
                                      "group flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                                      childActive
                                        ? "border-white bg-white text-[#1d4ed8] shadow-sm"
                                        : "border-transparent text-blue-100 hover:bg-white/10 hover:text-white",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "shrink-0 transition",
                                        childActive
                                          ? "text-[#f97316]"
                                          : "text-blue-200 group-hover:text-white",
                                      )}
                                    >
                                      {child.icon}
                                    </span>

                                    <span className="truncate">
                                      {child.label}
                                    </span>
                                  </Link>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                        active
                          ? "border-white border-l-4 border-l-[#f97316] bg-white text-[#1d4ed8] shadow-sm"
                          : "border-transparent text-blue-100 hover:bg-white/10 hover:text-white",
                        isCollapsed && "justify-center px-0",
                      )}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <span
                        className={cn(
                          "flex shrink-0 items-center justify-center transition",
                          active
                            ? "text-[#f97316]"
                            : "text-blue-100 group-hover:text-white",
                          isCollapsed && "h-10 w-10 rounded-xl",
                        )}
                      >
                        {item.icon}
                      </span>

                      {!isCollapsed && (
                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {!isCollapsed && (
        <div className="border-t border-white/15 bg-[#2563eb] p-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5">
            <span className="h-2 w-2 rounded-full bg-emerald-300 ring-4 ring-emerald-300/15" />

            <div className="min-w-0">
              <p className="truncate text-xs font-bold uppercase tracking-[0.12em] text-white">
                Sistema
              </p>

              <p className="truncate text-xs font-medium text-blue-100">
                Sistema online
              </p>
            </div>
          </div>
        </div>
      )}

      {isCollapsed && (
        <div className="border-t border-white/15 p-3">
          <div className="mx-auto h-1.5 w-8 rounded-full bg-[#f97316]" />
        </div>
      )}
    </aside>
  )
}