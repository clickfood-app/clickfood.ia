"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Store,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import {
  adminNavFooterItems,
  adminNavGroups,
  adminNavItems,
  type AdminNavItem,
} from "@/lib/admin-navigation"

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
  onLogout?: () => void
  isLoggingOut?: boolean
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

function isSubHrefActive(pathname: string, href: string) {
  if (href === "/financeiro") {
    return pathname === "/financeiro"
  }

  if (href === "/campanhas") {
    return pathname === "/campanhas"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function isHrefActive(pathname: string, item: AdminNavItem) {
  if (item.children?.length) {
    return item.children.some((child) => isSubHrefActive(pathname, child.href))
  }

  if (item.href === "/gestao") {
    return pathname === "/" || pathname === "/gestao"
  }

  return isSubHrefActive(pathname, item.href)
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

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#FACC15]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0B0D]"

const itemBase =
  "group relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-colors duration-200 motion-reduce:transition-none"

const collapsedItem = "mx-auto h-11 w-11 justify-center px-0"

const collapsedActive =
  "bg-[#FACC15]/[0.12] text-white ring-1 ring-inset ring-[#FACC15]/25"

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function NavLink({
  item,
  active,
  isCollapsed,
}: {
  item: AdminNavItem
  active: boolean
  isCollapsed: boolean
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={isCollapsed ? item.label : undefined}
      title={isCollapsed ? item.label : undefined}
      className={cn(
        itemBase,
        focusRing,
        !active && "text-zinc-400 hover:bg-white/[0.04] hover:text-white",
        active &&
          !isCollapsed &&
          "bg-gradient-to-r from-[#FACC15]/[0.14] via-[#FACC15]/[0.05] to-transparent text-white",
        isCollapsed && collapsedItem,
        isCollapsed && active && collapsedActive,
      )}
    >
      {active && !isCollapsed && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#FACC15] shadow-[0_0_12px_rgba(250,204,21,0.6)]"
        />
      )}

      <item.icon
        aria-hidden="true"
        strokeWidth={1.75}
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          active ? "text-[#FACC15]" : "text-zinc-500 group-hover:text-zinc-200",
        )}
      />

      {!isCollapsed && (
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      )}
    </Link>
  )
}

export default function AdminSidebar({
  isCollapsed = false,
  onToggleCollapse,
  onLogout,
  isLoggingOut = false,
}: AdminSidebarProps) {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])

  const [brand, setBrand] = useState<RestaurantBrand>(() =>
    getDefaultRestaurantBrand(),
  )
  const [isBrandLoaded, setIsBrandLoaded] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [logoFailed, setLogoFailed] = useState(false)

  const defaultOpenItems = useMemo(() => {
    return adminNavItems
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

  useEffect(() => {
    setLogoFailed(false)
  }, [brand.logoUrl])

  const operationStatus = useMemo(
    () => getRestaurantStatus(brand, now),
    [brand, now],
  )

  const showStatus = isBrandLoaded
  const showLogo = Boolean(brand.logoUrl) && !logoFailed

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/[0.06] bg-[#0B0B0D] text-white shadow-2xl shadow-black/50 transition-[width] duration-300 ease-out motion-reduce:transition-none",
        isCollapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(120%_80%_at_0%_0%,rgba(250,204,21,0.10),transparent_60%)]"
      />

      <div
        className={cn(
          "relative shrink-0 px-3 pb-3 pt-4",
          isCollapsed && "flex flex-col items-center px-0",
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
              "group flex min-w-0 items-center rounded-xl",
              focusRing,
              isCollapsed ? "justify-center" : "gap-3 px-1",
            )}
            title={
              isCollapsed
                ? `${brand.name}${showStatus ? ` · ${operationStatus.label}` : ""}`
                : undefined
            }
            aria-label={isCollapsed ? brand.name : undefined}
          >
            <span className="relative shrink-0">
              {showLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brand.logoUrl ?? undefined}
                  alt=""
                  className="h-10 w-10 rounded-xl object-cover ring-1 ring-white/10"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FACC15] text-[#0B0B0D] shadow-[0_6px_20px_-6px_rgba(250,204,21,0.55)]">
                  <Store className="h-5 w-5" strokeWidth={2} />
                </span>
              )}

              {isCollapsed && showStatus && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -right-1 -top-1 h-3 w-3 rounded-full ring-2 ring-[#0B0B0D]",
                    operationStatus.isOpen ? "bg-[#FACC15]" : "bg-zinc-600",
                  )}
                />
              )}
            </span>

            {!isCollapsed && (
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  Painel administrativo
                </span>
                <span className="mt-0.5 block truncate text-[15px] font-bold leading-tight tracking-tight text-white">
                  {brand.name}
                </span>
              </span>
            )}
          </Link>

          {!isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 transition-colors hover:bg-white/10 hover:text-white md:hidden",
                focusRing,
              )}
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {!isCollapsed &&
          (showStatus ? (
            <div
              role="status"
              className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
            >
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {operationStatus.isOpen && (
                  <span
                    aria-hidden="true"
                    className="absolute inline-flex h-full w-full rounded-full bg-[#FACC15] opacity-60 motion-safe:animate-ping"
                  />
                )}
                <span
                  className={cn(
                    "relative inline-flex h-2.5 w-2.5 rounded-full",
                    operationStatus.isOpen
                      ? "bg-[#FACC15] shadow-[0_0_10px_rgba(250,204,21,0.7)]"
                      : "bg-zinc-600",
                  )}
                />
              </span>

              <span className="min-w-0">
                <span
                  className={cn(
                    "block truncate text-xs font-semibold",
                    operationStatus.isOpen ? "text-[#FACC15]" : "text-zinc-300",
                  )}
                >
                  {operationStatus.label}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-zinc-400">
                  {operationStatus.description}
                </span>
              </span>
            </div>
          ) : (
            <div
              className="mt-4 h-[54px] rounded-xl border border-white/[0.04] bg-white/[0.02] motion-safe:animate-pulse"
              aria-hidden="true"
            />
          ))}
      </div>

      <div
        aria-hidden="true"
        className="mx-4 h-px shrink-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />

      <nav
        aria-label="Menu administrativo"
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin]"
      >
        <div className="flex flex-col gap-5">
          {adminNavGroups.map((group, groupIndex) => (
            <div key={group.title}>
              {isCollapsed ? (
                groupIndex > 0 && (
                  <div
                    aria-hidden="true"
                    className="mx-auto mb-3 h-px w-6 bg-white/10"
                  />
                )
              ) : (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  {group.title}
                </p>
              )}

              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isHrefActive(pathname, item)
                  const hasChildren = Boolean(item.children?.length)
                  const isOpen = openItems.includes(item.label)
                  const submenuId = `admin-submenu-${slugify(item.label)}`

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
                            itemBase,
                            focusRing,
                            "text-left",
                            active
                              ? "text-white"
                              : "text-zinc-400 hover:bg-white/[0.04] hover:text-white",
                            isCollapsed && collapsedItem,
                            isCollapsed && active && collapsedActive,
                          )}
                          title={isCollapsed ? item.label : undefined}
                          aria-label={isCollapsed ? item.label : undefined}
                          aria-expanded={isCollapsed ? undefined : isOpen}
                          aria-controls={isCollapsed ? undefined : submenuId}
                        >
                          <item.icon
                            aria-hidden="true"
                            strokeWidth={1.75}
                            className={cn(
                              "h-[18px] w-[18px] shrink-0 transition-colors",
                              active
                                ? "text-[#FACC15]"
                                : "text-zinc-500 group-hover:text-zinc-200",
                            )}
                          />

                          {!isCollapsed && (
                            <>
                              <span className="min-w-0 flex-1 truncate">
                                {item.label}
                              </span>

                              <ChevronDown
                                aria-hidden="true"
                                className={cn(
                                  "h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-300 motion-reduce:transition-none",
                                  isOpen && "rotate-180 text-zinc-300",
                                )}
                              />
                            </>
                          )}
                        </button>

                        {!isCollapsed && (
                          <div
                            id={submenuId}
                            inert={!isOpen}
                            className={cn(
                              "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
                              isOpen
                                ? "grid-rows-[1fr] opacity-100"
                                : "grid-rows-[0fr] opacity-0",
                            )}
                          >
                            <div className="overflow-hidden">
                              <div className="ml-[21px] mt-1 flex flex-col gap-0.5 border-l border-white/[0.08] py-0.5 pl-3">
                                {item.children?.map((child) => {
                                  const childActive = isSubHrefActive(
                                    pathname,
                                    child.href,
                                  )

                                  return (
                                    <Link
                                      key={child.href}
                                      href={child.href}
                                      aria-current={
                                        childActive ? "page" : undefined
                                      }
                                      className={cn(
                                        "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors",
                                        focusRing,
                                        childActive
                                          ? "bg-white/[0.05] text-white"
                                          : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-100",
                                      )}
                                    >
                                      {childActive && (
                                        <span
                                          aria-hidden="true"
                                          className="absolute -left-[13.5px] top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-[#FACC15] shadow-[0_0_8px_rgba(250,204,21,0.7)]"
                                        />
                                      )}

                                      <child.icon
                                        aria-hidden="true"
                                        strokeWidth={1.75}
                                        className={cn(
                                          "h-4 w-4 shrink-0 transition-colors",
                                          childActive
                                            ? "text-[#FACC15]"
                                            : "text-zinc-500 group-hover:text-zinc-300",
                                        )}
                                      />

                                      <span className="truncate">
                                        {child.label}
                                      </span>
                                    </Link>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <NavLink
                      key={item.href}
                      item={item}
                      active={active}
                      isCollapsed={isCollapsed}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="relative shrink-0 border-t border-white/[0.06] bg-[#0B0B0D] p-3">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-[#0B0B0D] to-transparent"
        />

        <div className="flex flex-col gap-0.5">
          {adminNavFooterItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isHrefActive(pathname, item)}
              isCollapsed={isCollapsed}
            />
          ))}

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              disabled={isLoggingOut}
              className={cn(
                itemBase,
                focusRing,
                "w-full text-left text-zinc-400 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-50",
                isCollapsed && collapsedItem,
              )}
              title={isCollapsed ? "Sair" : undefined}
              aria-label={isCollapsed ? "Sair" : undefined}
            >
              <LogOut
                aria-hidden="true"
                strokeWidth={1.75}
                className="h-[18px] w-[18px] shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-200"
              />

              {!isCollapsed && (
                <span className="min-w-0 flex-1 truncate">
                  {isLoggingOut ? "Saindo..." : "Sair"}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleCollapse}
        className={cn(
          "absolute -right-3 top-7 z-50 hidden h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-[#242428] text-zinc-300 shadow-lg shadow-black/40 transition-colors hover:border-[#FACC15] hover:bg-[#FACC15] hover:text-[#0B0B0D] md:flex",
          focusRing,
        )}
        aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>
    </aside>
  )
}
