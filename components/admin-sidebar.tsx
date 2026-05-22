"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeftRight,
  BadgeDollarSign,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gift,
  Globe,
  Megaphone,
  Menu,
  Package,
  PlusCircle,
  Settings,
  ShoppingCart,
  TicketPercent,
  TrendingDown,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"

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

type AdminSidebarProps = {
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

const navItems: NavItem[] = [
  {
    label: "Gestão",
    icon: <BarChart3 className="h-5 w-5" />,
    href: "/gestao",
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
    label: "Mesas",
    icon: <Users className="h-5 w-5" />,
    href: "/mesas",
  },
  {
    label: "Cardápio",
    icon: <Globe className="h-5 w-5" />,
    href: "/divulgar-cardapio",
  },
  {
    label: "Financeiro",
    icon: <Wallet className="h-5 w-5" />,
    href: "/financeiro",
    children: [
      {
        label: "Finanças",
        icon: <Wallet className="h-4 w-4" />,
        href: "/financeiro",
      },
      {
        label: "Perdas",
        icon: <TrendingDown className="h-4 w-4" />,
        href: "/financeiro/perdas",
      },
      {
        label: "Entrada e saída",
        icon: <ArrowLeftRight className="h-4 w-4" />,
        href: "/financeiro/entrada-saida",
      },
      {
        label: "Controle de estoque",
        icon: <Package className="h-4 w-4" />,
        href: "/financeiro/controle-estoque",
      },
    ],
  },
  {
    label: "Entregadores",
    icon: <Truck className="h-5 w-5" />,
    href: "/entregadores",
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
        icon: <Megaphone className="h-4 w-4" />,
        href: "/campanhas",
      },
      {
        label: "Card Fidelidade",
        icon: <Gift className="h-4 w-4" />,
        href: "/campanhas/fidelidade",
      },
      {
        label: "ClickPromo",
        icon: <BadgeDollarSign className="h-4 w-4" />,
        href: "/campanhas/saldo-promocional",
      },
    ],
  },
  {
    label: "Configurações",
    icon: <Settings className="h-5 w-5" />,
    href: "/configuracoes",
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

export default function AdminSidebar({
  isCollapsed = false,
  onToggleCollapse,
}: AdminSidebarProps) {
  const pathname = usePathname()

  const defaultOpenItems = useMemo(() => {
    return navItems
      .filter((item) => item.children?.some((child) => isSubHrefActive(pathname, child.href)))
      .map((item) => item.label)
  }, [pathname])

  const [openItems, setOpenItems] = useState<string[]>(defaultOpenItems)

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

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/10 bg-slate-950 text-white shadow-2xl transition-all duration-300",
        isCollapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        <Link
          href="/gestao"
          className={cn(
            "flex items-center gap-2 overflow-hidden",
            isCollapsed && "justify-center",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-sm font-black text-white">
            CF
          </div>

          {!isCollapsed && (
            <span className="text-xl font-black tracking-tight">
              Click<span className="text-orange-400">Food</span>
            </span>
          )}
        </Link>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white md:flex"
          aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white md:hidden"
          aria-label="Fechar menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-1">
          {navItems.map((item) => {
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
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold transition",
                      active
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                        : "text-slate-300 hover:bg-white/10 hover:text-white",
                      isCollapsed && "justify-center px-0",
                    )}
                  >
                    <span className="shrink-0">{item.icon}</span>

                    {!isCollapsed && (
                      <>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>

                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 transition",
                            isOpen && "rotate-180",
                          )}
                        />
                      </>
                    )}
                  </button>

                  {!isCollapsed && isOpen && (
                    <div className="ml-5 mt-1 border-l border-white/10 pl-3">
                      <div className="flex flex-col gap-1">
                        {item.children?.map((child) => {
                          const childActive = isSubHrefActive(pathname, child.href)

                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(
                                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                                childActive
                                  ? "bg-blue-500/20 text-blue-200"
                                  : "text-slate-400 hover:bg-white/10 hover:text-white",
                              )}
                            >
                              <span className="shrink-0">{child.icon}</span>
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

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition",
                  active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                    : "text-slate-300 hover:bg-white/10 hover:text-white",
                  isCollapsed && "justify-center px-0",
                )}
              >
                <span className="shrink-0">{item.icon}</span>

                {!isCollapsed && (
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {!isCollapsed && (
        <div className="border-t border-white/10 p-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                <Menu className="h-5 w-5 text-blue-200" />
              </div>

              <div>
                <p className="text-sm font-black text-white">ClickFood</p>
                <p className="text-xs font-medium text-slate-400">
                  Gestão inteligente
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}