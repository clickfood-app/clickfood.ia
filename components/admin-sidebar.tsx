"use client"

import React, { useState } from "react"
import { usePathname } from "next/navigation"
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
}: {
  item: NavItem
  isCollapsed: boolean
  pathname: string
  openSubmenu: string | null
  toggleSubmenu: (label: string) => void
}) {
  const hasChildren = !!item.children
  const isSubmenuOpen = openSubmenu === item.label
  const isActive = item.href ? pathname === item.href : false
  const isChildActive = item.children?.some((c) => pathname === c.href)

  if (hasChildren) {
    const triggerButton = (
      <button
        onClick={() => toggleSubmenu(item.label)}
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          "hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]",
          isChildActive
            ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]"
            : "text-[hsl(var(--sidebar-foreground))]"
        )}
      >
        {isChildActive && (
          <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[hsl(var(--sidebar-primary))]" />
        )}
        <span className="flex-shrink-0">{item.icon}</span>
        {!isCollapsed && (
          <>
            <span className="flex-1 text-left truncate">{item.label}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 flex-shrink-0 transition-transform duration-200",
                isSubmenuOpen && "rotate-180"
              )}
            />
          </>
        )}
      </button>
    )

    return (
      <div>
        {isCollapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="font-medium">
              {item.label}
            </TooltipContent>
          </Tooltip>
        ) : (
          triggerButton
        )}

        {/* Submenu expanded */}
        {!isCollapsed && (
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              isSubmenuOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-[hsl(var(--sidebar-border))] pl-3">
              {item.children?.map((child) => {
                const isChildItemActive = pathname === child.href
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "relative flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-all duration-200",
                      "hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]",
                      isChildItemActive
                        ? "bg-[hsl(var(--sidebar-primary))/0.12] text-[hsl(var(--sidebar-primary))] font-medium"
                        : "text-[hsl(var(--sidebar-foreground))]"
                    )}
                  >
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{child.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Regular nav item with Link
  const linkElement = (
    <Link
      href={item.href || "/"}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        "hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]",
        isActive
          ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]"
          : "text-[hsl(var(--sidebar-foreground))]"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[hsl(var(--sidebar-primary))]" />
      )}
      <span className="flex-shrink-0">{item.icon}</span>
      {!isCollapsed && (
        <span className="flex-1 text-left truncate">{item.label}</span>
      )}
    </Link>
  )

  return (
    <div>
      {isCollapsed ? (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={12} className="font-medium">
            {item.label}
          </TooltipContent>
        </Tooltip>
      ) : (
        linkElement
      )}
    </div>
  )
}

interface AdminSidebarProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export default function AdminSidebar({ isCollapsed, onToggleCollapse }: AdminSidebarProps) {
  const pathname = usePathname()
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)

  const toggleSubmenu = (label: string) => {
    setOpenSubmenu((prev) => (prev === label ? null : label))
  }

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] transition-all duration-300 ease-in-out",
          isCollapsed ? "w-[68px]" : "w-64"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--sidebar-border))] px-4 py-4">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--sidebar-primary))]">
                <ClipboardList className="h-4.5 w-4.5 text-[hsl(var(--sidebar-primary-foreground))]" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-[hsl(var(--sidebar-accent-foreground))] tracking-tight">
                  AdminPro
                </h1>
                <p className="text-[10px] text-[hsl(var(--sidebar-foreground))] uppercase tracking-widest">
                  Painel
                </p>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--sidebar-primary))] mx-auto">
              <ClipboardList className="h-4.5 w-4.5 text-[hsl(var(--sidebar-primary-foreground))]" />
            </div>
          )}
        </div>

        {/* Toggle Button */}
        <div className="flex justify-end px-3 py-2">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[hsl(var(--sidebar-foreground))] transition-colors hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]"
                aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12}>
              {isCollapsed ? "Expandir" : "Recolher"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Navigation with Premium ScrollArea */}
        <ScrollArea className="flex-1 [&_[data-radix-scroll-area-viewport]]:!block">
          <nav className="relative px-3 pb-4">
            {/* Top fade gradient */}
            <div className="pointer-events-none sticky top-0 z-10 -mt-px h-4 bg-gradient-to-b from-[hsl(var(--sidebar-background))] to-transparent" />
            
            {!isCollapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--sidebar-foreground))]">
                Menu principal
              </p>
            )}
            <div className="flex flex-col gap-0.5">
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
            </div>
            
            {/* Bottom fade gradient */}
            <div className="pointer-events-none sticky bottom-0 z-10 -mb-px h-6 bg-gradient-to-t from-[hsl(var(--sidebar-background))] to-transparent" />
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-[hsl(var(--sidebar-border))] px-3 py-3">
          {isCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--sidebar-primary))] text-xs font-bold text-[hsl(var(--sidebar-primary-foreground))]">
                    A
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12}>
                <p className="font-medium">Administrador</p>
                <p className="text-xs text-muted-foreground">admin@empresa.com</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--sidebar-primary))] text-xs font-bold text-[hsl(var(--sidebar-primary-foreground))]">
                A
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[hsl(var(--sidebar-accent-foreground))]">
                  Administrador
                </p>
                <p className="truncate text-xs text-[hsl(var(--sidebar-foreground))]">
                  admin@empresa.com
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
