"use client"

import React, { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  BarChart3,
  Briefcase,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DollarSign,
  FileText,
  Globe,
  Home,
  LogOut,
  Package,
  PlusCircle,
  Settings,
  ShoppingCart,
  Ticket,
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
  icon: React.ReactNode
  href?: string
  children?: { label: string; href: string }[]
}

const navItems: NavItem[] = [
  {
    label: "Painel",
    icon: <Home className="h-5 w-5" />,
    href: "/",
  },
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
    label: "Produtos",
    icon: <Package className="h-5 w-5" />,
    href: "/produtos",
  },
  {
    label: "Clientes",
    icon: <Users className="h-5 w-5" />,
    href: "/clientes",
  },
  {
    label: "Cardapio",
    icon: <Globe className="h-5 w-5" />,
    href: "/cardapio",
  },
  {
    label: "Cupons",
    icon: <Ticket className="h-5 w-5" />,
    href: "/cupons",
  },
  {
    label: "Funcionarios",
    icon: <Briefcase className="h-5 w-5" />,
    href: "/funcionarios",
  },
  {
    label: "Financeiro",
    icon: <DollarSign className="h-5 w-5" />,
    href: "/financeiro",
  },
  {
    label: "Relatórios",
    icon: <BarChart3 className="h-5 w-5" />,
    children: [
      { label: "Visao Geral", href: "/relatorios/resumo" },
      { label: "Vendas", href: "/relatorios/vendas" },
      { label: "Histórico de Pedidos", href: "/relatorios/historico" },
    ],
  },
  {
    label: "Configurações",
    icon: <Settings className="h-5 w-5" />,
    href: "/configuracoes",
  },
]

function SidebarItem({
  item,
  isCollapsed,
  pathname,
  openSubmenu,
  toggleSubmenu,
}: any) {
  const hasChildren = !!item.children
  const isSubmenuOpen = openSubmenu === item.label
  const isActive = item.href ? pathname === item.href : false
  const isChildActive = item.children?.some((c: any) => pathname === c.href)

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => toggleSubmenu(item.label)}
          className={cn(
            "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
            "hover:bg-[hsl(var(--sidebar-accent))]",
            isChildActive && "bg-[hsl(var(--sidebar-accent))]"
          )}
        >
          <span className="flex-shrink-0">{item.icon}</span>

          {!isCollapsed && (
            <>
              <span className="flex-1 text-left truncate">{item.label}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  isSubmenuOpen && "rotate-180"
                )}
              />
            </>
          )}
        </button>

        {!isCollapsed && isSubmenuOpen && (
          <div className="ml-4 mt-1 flex flex-col gap-1 border-l pl-3">
            {item.children.map((child: any) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted",
                  pathname === child.href && "bg-muted font-medium"
                )}
              >
                <FileText className="h-4 w-4" />
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={item.href || "/"}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
        "hover:bg-[hsl(var(--sidebar-accent))]",
        isActive && "bg-[hsl(var(--sidebar-accent))]"
      )}
    >
      {item.icon}

      {!isCollapsed && <span>{item.label}</span>}
    </Link>
  )
}

interface AdminSidebarProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export default function AdminSidebar({
  isCollapsed,
  onToggleCollapse,
}: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const supabase = createClient()

  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)

  const toggleSubmenu = (label: string) => {
    setOpenSubmenu((prev) => (prev === label ? null : label))
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error("Erro ao sair:", error.message)
      return
    }

    router.push("/login")
  }

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-background transition-all",
          isCollapsed ? "w-[68px]" : "w-64"
        )}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between border-b px-4 py-4">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              <span className="font-bold">AdminPro</span>
            </div>
          )}

          <button onClick={onToggleCollapse}>
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* MENU */}
        <ScrollArea className="flex-1">
          <nav className="px-3 py-4 flex flex-col gap-1">
            {navItems.map((item) => (
              <SidebarItem
                key={item.label}
                item={item}
                isCollapsed={isCollapsed}
                pathname={pathname}
                openSubmenu={openSubmenu}
                toggleSubmenu={toggleSubmenu}
              />
            ))}
          </nav>
        </ScrollArea>

        {/* FOOTER */}
        <div className="border-t px-3 py-3 space-y-3">

          {/* ADMIN INFO */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              A
            </div>

            {!isCollapsed && (
              <div>
                <p className="text-sm font-medium">Administrador</p>
                <p className="text-xs text-muted-foreground">
                  admin@empresa.com
                </p>
              </div>
            )}
          </div>

          {/* LOGOUT */}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 transition hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" />

            {!isCollapsed && "Sair"}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  )
}