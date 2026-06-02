"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Banknote,
  BarChart3,
  BookOpen,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  ClipboardCheck,
  Coins,
  CreditCard,
  FileBarChart,
  Gift,
  Globe,
  MapPinned,
  Megaphone,
  MonitorCheck,
  PackageCheck,
  PackageOpen,
  PlusCircle,
  ReceiptText,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  TicketPercent,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  X,
  Target,
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
    href: "/funcionarios",
    children: [
      {
        label: "Funcionários",
        icon: <Users className="h-4 w-4" />,
        href: "/funcionarios",
      },
      {
        label: "Fornecedores",
        icon: <Store className="h-4 w-4" />,
        href: "/fornecedores",
      },
      {
        label: "Compras",
        icon: <ShoppingBag className="h-4 w-4" />,
        href: "/compras-fornecedores",
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
        label: "Caixa do dia",
        icon: <Banknote className="h-4 w-4" />,
        href: "/financeiro/caixa",
      },
      {
        label: "Recebimentos",
        icon: <CreditCard className="h-4 w-4" />,
        href: "/financeiro/recebimentos",
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
        label: "CMV e margem",
        icon: <Calculator className="h-4 w-4" />,
        href: "/financeiro/cmv",
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
    label: "Crescimento",
    icon: <TrendingUp className="h-5 w-5" />,
    href: "/crescimento",
    children: [
      {
        label: "Ranking de produtos",
        icon: <PackageCheck className="h-4 w-4" />,
        href: "/crescimento/ranking-produtos",
      },
      {
        label: "Clientes sumidos",
        icon: <Users className="h-4 w-4" />,
        href: "/crescimento/clientes-sumidos",
      },
      {
        label: "Radar de bairros",
        icon: <MapPinned className="h-4 w-4" />,
        href: "/crescimento/radar-bairros",
      },
      {
        label: "Alertas inteligentes",
        icon: <CircleAlert className="h-4 w-4" />,
        href: "/crescimento/alertas",
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

function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return "CF"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return `${words[0][0]}${words[1][0]}`.toUpperCase()
}

export default function AdminSidebar({
  isCollapsed = false,
  onToggleCollapse,
}: AdminSidebarProps) {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])

  const [brand, setBrand] = useState<RestaurantBrand>({
    name: "ClickFood",
    logoUrl: null,
  })
  const [logoFailed, setLogoFailed] = useState(false)

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
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data } = await supabase
        .from("restaurants")
        .select("name, logo_url")
        .eq("owner_id", user.id)
        .maybeSingle()

      if (!isMounted || !data) return

      setBrand({
        name: data.name || "ClickFood",
        logoUrl: data.logo_url || null,
      })
    }

    void loadRestaurantBrand()

    return () => {
      isMounted = false
    }
  }, [supabase])

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

  const initials = getInitials(brand.name)

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-blue-100 bg-white text-slate-900 shadow-xl shadow-blue-950/5 transition-all duration-300",
        isCollapsed ? "w-[72px]" : "w-64",
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className={cn(
          "absolute -right-3 top-5 z-50 hidden h-7 w-7 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 md:flex",
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
          "flex h-16 items-center border-b border-blue-100 bg-white px-3",
          isCollapsed ? "justify-center px-0" : "justify-between",
        )}
      >
        <Link
          href="/gestao"
          className={cn(
            "group flex min-w-0 items-center gap-3 overflow-hidden",
            isCollapsed && "justify-center",
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-100 bg-blue-50 text-sm font-black text-blue-700 shadow-sm">
            {brand.logoUrl && !logoFailed ? (
              <img
                src={brand.logoUrl}
                alt={brand.name}
                className="h-full w-full object-cover"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          {!isCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-tight text-slate-950">
                {brand.name}
              </p>

              <p className="mt-0.5 truncate text-[11px] font-semibold text-blue-600">
                Painel administrativo
              </p>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700 transition hover:border-blue-200 hover:bg-blue-50 md:hidden"
          aria-label="Fechar menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 [scrollbar-width:thin] [scrollbar-color:#93c5fd_transparent]">
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
                      "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition",
                      active
                        ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                        : "text-slate-600 hover:bg-blue-50 hover:text-blue-700",
                      isCollapsed && "justify-center px-0",
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <span
                      className={cn(
                        "flex shrink-0 items-center justify-center transition",
                        active
                          ? "text-blue-700"
                          : "text-slate-500 group-hover:text-blue-700",
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
                            "h-4 w-4 shrink-0 text-slate-400 transition",
                            isOpen && "rotate-180 text-blue-700",
                          )}
                        />
                      </>
                    )}
                  </button>

                  {!isCollapsed && isOpen && (
                    <div className="ml-4 mt-1 border-l border-blue-100 pl-2">
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
                                "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition",
                                childActive
                                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                                  : "text-slate-500 hover:bg-blue-50 hover:text-blue-700",
                              )}
                            >
                              <span
                                className={cn(
                                  "shrink-0 transition",
                                  childActive
                                    ? "text-white"
                                    : "text-slate-400 group-hover:text-blue-700",
                                )}
                              >
                                {child.icon}
                              </span>

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
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition",
                  active
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                    : "text-slate-600 hover:bg-blue-50 hover:text-blue-700",
                  isCollapsed && "justify-center px-0",
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center transition",
                    active
                      ? "text-white"
                      : "text-slate-500 group-hover:text-blue-700",
                    isCollapsed && "h-10 w-10 rounded-xl",
                  )}
                >
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {!isCollapsed && (
        <div className="border-t border-blue-100 bg-white p-3">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-blue-100 bg-white">
                {brand.logoUrl && !logoFailed ? (
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    className="h-full w-full object-cover"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <span className="text-xs font-black text-blue-700">
                    {initials}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">
                  {brand.name}
                </p>

                <p className="text-xs font-semibold text-blue-700">
                  Operação ativa
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCollapsed && (
        <div className="border-t border-blue-100 p-3">
          <div className="mx-auto h-1.5 w-8 rounded-full bg-blue-200" />
        </div>
      )}
    </aside>
  )
}