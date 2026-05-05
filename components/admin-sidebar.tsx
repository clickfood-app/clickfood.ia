"use client"

import React, { useMemo, useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  BarChart3,
  ChevronLeft,
  Globe,
  Home,
  Package,
  PlusCircle,
  Settings,
  ShoppingCart,
  TicketPercent,
  Truck,
  Users,
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

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { label: "Painel", icon: <Home className="h-5 w-5" />, href: "/" },
  { label: "Novo Pedido", icon: <PlusCircle className="h-5 w-5" />, href: "/novo-pedido" },
  { label: "Mesas", icon: <Users className="h-5 w-5" />, href: "/mesas" },
  { label: "Pedidos", icon: <ShoppingCart className="h-5 w-5" />, href: "/pedidos" },
  { label: "Entregadores", icon: <Truck className="h-5 w-5" />, href: "/entregadores" },
  { label: "Produtos", icon: <Package className="h-5 w-5" />, href: "/produtos" },
  { label: "Clientes", icon: <Users className="h-5 w-5" />, href: "/clientes" },
  { label: "Cupons", icon: <TicketPercent className="h-5 w-5" />, href: "/cupons" },
  { label: "Cardápio", icon: <Globe className="h-5 w-5" />, href: "/cardapio" },
  { label: "Configurações", icon: <Settings className="h-5 w-5" />, href: "/configuracoes" },
  { label: "Gestão", icon: <BarChart3 className="h-5 w-5" />, href: "/gestao" },
]

function SidebarItem({ item, isCollapsed, pathname }: any) {
  const isActive = pathname === item.href

  const link = (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
        isActive
          ? "bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white shadow-md"
          : "text-[#A1A1AA] hover:bg-white/10 hover:text-white"
      )}
    >
      <span className="flex h-5 w-5 items-center justify-center">
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

export default function AdminSidebar({ isCollapsed, onToggleCollapse }: any) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [restaurant, setRestaurant] = useState<any>(null)

  useEffect(() => {
    const loadRestaurant = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data } = await supabase
        .from("restaurants")
        .select("*")
        .eq("owner_id", user.id)
        .single()

      if (data) setRestaurant(data)
    }

    loadRestaurant()
  }, [supabase])

  const handleLogout = async () => {
    if (isLoggingOut) return

    setIsLoggingOut(true)
    await supabase.auth.signOut()
    router.replace("/auth")
  }

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "fixed left-0 top-0 flex h-screen flex-col border-r border-[#272A3A] bg-[#0B0B12] text-white",
          isCollapsed ? "w-[72px]" : "w-64"
        )}
      >
        <div className="flex items-center justify-between border-b border-[#272A3A] px-4 py-4">
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-900 overflow-hidden">
                {restaurant?.logo_url ? (
                  <img src={restaurant.logo_url} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-bold">
                    {restaurant?.name?.charAt(0) || "R"}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {restaurant?.name || "Restaurante"}
                </p>
                <p className="text-xs text-slate-400">Painel</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-900">
              <span className="text-sm font-bold">
                {restaurant?.name?.charAt(0) || "R"}
              </span>
            </div>
          )}

          {!isCollapsed && (
            <button onClick={onToggleCollapse}>
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          {navItems.map((item) => (
            <SidebarItem
              key={item.href}
              item={item}
              isCollapsed={isCollapsed}
              pathname={pathname}
            />
          ))}
        </ScrollArea>

        <div className="p-3">
          <button onClick={handleLogout}>
            {!isCollapsed && "Sair"}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  )
}