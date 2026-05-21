"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ArrowLeftRight,
  BadgeDollarSign,
  BarChart3,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gift,
  Globe,
  LogOut,
  Megaphone,
  Package,
  PlusCircle,
  Settings,
  ShoppingCart,
  TicketPercent,
  TrendingDown,
  Truck,
  Users,
  Wallet,
} from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface NavSubItem {
  label: string
  href: string
  icon: React.ReactNode
}

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  children?: NavSubItem[]
}

interface AdminSidebarProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
}

type RestaurantData = {
  name?: string | null
  logo_url?: string | null
}

const navItems: NavItem[] = [
  { label: "Gestão", icon: <BarChart3 className="h-5 w-5" />, href: "/gestao" },
  { label: "Novo Pedido", icon: <PlusCircle className="h-5 w-5" />, href: "/novo-pedido" },
  { label: "Mesas", icon: <Users className="h-5 w-5" />, href: "/mesas" },
  { label: "Pedidos", icon: <ShoppingCart className="h-5 w-5" />, href: "/pedidos" },
  { label: "Entregadores", icon: <Truck className="h-5 w-5" />, href: "/entregadores" },
  {
    label: "Financeiro",
    icon: <Wallet className="h-5 w-5" />,
    href: "/financeiro",
    children: [
      { label: "Finanças", icon: <Wallet className="h-4 w-4" />, href: "/financeiro" },
      { label: "Perdas", icon: <TrendingDown className="h-4 w-4" />, href: "/financeiro/perdas" },
      { label: "Entrada e saída", icon: <ArrowLeftRight className="h-4 w-4" />, href: "/financeiro/entrada-saida" },
      { label: "Controle de estoque", icon: <Package className="h-4 w-4" />, href: "/financeiro/controle-estoque" },
    ],
  },
  { label: "Produtos", icon: <Package className="h-5 w-5" />, href: "/produtos" },
  { label: "Clientes", icon: <Users className="h-5 w-5" />, href: "/clientes" },
  { label: "Cupons", icon: <TicketPercent className="h-5 w-5" />, href: "/cupons" },
  {
    label: "Campanhas",
    icon: <Megaphone className="h-5 w-5" />,
    href: "/campanhas",
    children: [
      { label: "Card Fidelidade", icon: <Gift className="h-4 w-4" />, href: "/campanhas/fidelidade" },
      { label: "Saldo Promocional", icon: <BadgeDollarSign className="h-4 w-4" />, href: "/campanhas/saldo-promocional" },
      { label: "Meu Lanche", icon: <ChefHat className="h-4 w-4" />, href: "/campanhas/meu-lanche" },
    ],
  },
  { label: "Cardápio", icon: <Globe className="h-5 w-5" />, href: "/divulgar-cardapio" },
  { label: "Configurações", icon: <Settings className="h-5 w-5" />, href: "/configuracoes" },
]

function isHrefActive(pathname: string, href: string) {
  if (href === "/gestao") {
    return pathname === "/gestao" || pathname === "/"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function isSubHrefActive(pathname: string, href: string) {
  if (href === "/financeiro") {
    return pathname === "/financeiro"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarItem({
  item,
  isCollapsed,
  pathname,
  isOpen,
  onToggle,
}: {
  item: NavItem
  isCollapsed: boolean
  pathname: string
  isOpen: boolean
  onToggle: () => void
}) {
  const hasChildren = Boolean(item.children?.length)
  const isActive = isHrefActive(pathname, item.href)

  if (hasChildren && !isCollapsed) {
    return (
      <div>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-200",
            isActive
              ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
              : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
          )}
        >
          {isActive && (
            <span className="absolute -left-3 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-blue-400" />
          )}

          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center transition",
              isActive ? "text-white" : "text-slate-400 group-hover:text-white"
            )}
          >
            {item.icon}
          </span>

          <span className="flex-1 truncate text-left">{item.label}</span>

          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div className="ml-5 mt-1 space-y-1 border-l border-slate-800 pl-3">
            {item.children?.map((child) => {
              const isChildActive = isSubHrefActive(pathname, child.href)

              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200",
                    isChildActive
                      ? "bg-blue-500/10 text-blue-200"
                      : "text-slate-500 hover:bg-slate-800/70 hover:text-white"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center transition",
                      isChildActive
                        ? "text-blue-300"
                        : "text-slate-500 group-hover:text-white"
                    )}
                  >
                    {child.icon}
                  </span>

                  <span className="truncate">{child.label}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const link = (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-200",
        isCollapsed && "justify-center px-0",
        isActive
          ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
          : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
      )}
    >
      {isActive && (
        <span className="absolute -left-3 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-blue-400" />
      )}

      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center transition",
          isActive ? "text-white" : "text-slate-400 group-hover:text-white"
        )}
      >
        {item.icon}
      </span>

      {!isCollapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )

  if (!isCollapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}

export default function AdminSidebar({
  isCollapsed,
  onToggleCollapse,
}: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null)
  const [openMenuHref, setOpenMenuHref] = useState<string | null>(null)

  useEffect(() => {
    const activeMenuWithChildren = navItems.find((item) => {
      return Boolean(item.children?.length) && isHrefActive(pathname, item.href)
    })

    setOpenMenuHref(activeMenuWithChildren?.href ?? null)
  }, [pathname])

  useEffect(() => {
    const loadRestaurant = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data } = await supabase
        .from("restaurants")
        .select("name, logo_url")
        .eq("owner_id", user.id)
        .single()

      if (data) setRestaurant(data)
    }

    void loadRestaurant()
  }, [supabase])

  const handleLogout = async () => {
    if (isLoggingOut) return

    try {
      setIsLoggingOut(true)
      await supabase.auth.signOut()
      router.replace("/auth")
      router.refresh()
    } catch (error) {
      console.error("Erro ao sair:", error)
      setIsLoggingOut(false)
    }
  }

  const restaurantInitial = restaurant?.name?.charAt(0)?.toUpperCase() || "R"

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-800 bg-[#070A12] text-white transition-all duration-300",
          isCollapsed ? "w-[72px]" : "w-64"
        )}
      >
        <div
          className={cn(
            "flex h-[76px] items-center border-b border-slate-800 px-4",
            isCollapsed ? "justify-center" : "justify-between"
          )}
        >
          {!isCollapsed ? (
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-white text-slate-950 shadow-sm">
                {restaurant?.logo_url ? (
                  <img
                    src={restaurant.logo_url}
                    alt={restaurant?.name || "Restaurante"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-black">{restaurantInitial}</span>
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">
                  {restaurant?.name || "Restaurante"}
                </p>
                <p className="truncate text-xs font-medium text-slate-400">
                  Gestão
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white text-slate-950 shadow-sm">
              {restaurant?.logo_url ? (
                <img
                  src={restaurant.logo_url}
                  alt={restaurant?.name || "Restaurante"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-black">{restaurantInitial}</span>
              )}
            </div>
          )}

          {!isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
              aria-label="Recolher menu"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {isCollapsed && (
          <div className="flex justify-center border-b border-slate-800 py-3">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
              aria-label="Expandir menu"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <ScrollArea className="flex-1">
          <nav className={cn("space-y-1 px-3 py-4", isCollapsed && "px-3")}>
            {navItems.map((item) => (
              <SidebarItem
                key={item.href}
                item={item}
                isCollapsed={isCollapsed}
                pathname={pathname}
                isOpen={openMenuHref === item.href}
                onToggle={() => {
                  setOpenMenuHref((current) =>
                    current === item.href ? null : item.href
                  )
                }}
              />
            ))}
          </nav>
        </ScrollArea>

        <div className="border-t border-slate-800 p-3">
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex h-11 w-full items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Sair"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sair</TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-400 transition hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut className="h-5 w-5" />
              {isLoggingOut ? "Saindo..." : "Sair"}
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}