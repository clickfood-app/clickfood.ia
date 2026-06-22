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
  closedToday: boolean
  openTime: string | null
  closeTime: string | null
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
    href: "/fornecedores",
    children: [
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

function formatTime(time: string | null) {
  if (!time) return null

  return time.slice(0, 5)
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
    closedToday: false,
    openTime: null,
    closeTime: null,
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
        .select("name, logo_url, closed_today, open_time, close_time")
        .eq("owner_id", user.id)
        .maybeSingle()

      if (!isMounted || !data) return

      setBrand({
        name: data.name || "ClickFood",
        logoUrl: data.logo_url || null,
        closedToday: data.closed_today ?? false,
        openTime: data.open_time || null,
        closeTime: data.close_time || null,
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

  function getSectionLabel(label: string) {
    if (label === "Gestão") return "Operação"
    if (label === "Cardápio") return "Cardápio"
    if (label === "Gestão interna") return "Administração"
    if (label === "Cupons") return "Vendas"
    if (label === "Configurações") return "Sistema"

    return null
  }

  const initials = getInitials(brand.name)
  const storeIsOpen = !brand.closedToday
  const openTime = formatTime(brand.openTime)
  const closeTime = formatTime(brand.closeTime)

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-800 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100 shadow-xl shadow-slate-950/40 transition-all duration-300",
        isCollapsed ? "w-[72px]" : "w-64",
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className={cn(
          "absolute -right-3 top-5 z-50 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 shadow-sm transition hover:border-blue-500/40 hover:bg-slate-800 hover:text-blue-300 md:flex",
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
          "border-b border-slate-800 bg-slate-950/85 px-3 py-3 backdrop-blur-xl",
          isCollapsed && "flex justify-center px-0 py-3",
        )}
      >
        <div
          className={cn(
            "flex items-center",
            isCollapsed ? "justify-center" : "justify-between gap-2",
          )}
        >
          <Link
            href="/gestao"
            className={cn(
              "group flex min-w-0 items-center gap-3 overflow-hidden",
              isCollapsed && "justify-center",
            )}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-sm font-black text-blue-300 shadow-sm">
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
                <p className="truncate text-[15px] font-black leading-tight tracking-[-0.02em] text-white">
                  {brand.name}
                </p>

                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      storeIsOpen ? "bg-emerald-500" : "bg-red-500",
                    )}
                  />

                  <p
                    className={cn(
                      "truncate text-[11px] font-bold",
                      storeIsOpen ? "text-emerald-300" : "text-red-300",
                    )}
                  >
                    {storeIsOpen ? "Aberto agora" : "Fechado agora"}
                  </p>
                </div>
              </div>
            )}
          </Link>

          {!isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 shadow-sm transition hover:border-blue-500/40 hover:bg-slate-800 hover:text-blue-300 md:hidden"
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {!isCollapsed && (
          <div
            className={cn(
              "mt-3 overflow-hidden rounded-2xl border p-3 shadow-sm",
              storeIsOpen
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/25 bg-red-500/10 text-red-200",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full shadow-sm",
                      storeIsOpen
                        ? "bg-emerald-500 shadow-emerald-500/40"
                        : "bg-red-500 shadow-red-500/40",
                    )}
                  />

                  <p className="text-sm font-black leading-none">
                    {storeIsOpen ? "Loja aberta" : "Loja fechada"}
                  </p>
                </div>

                <p
                  className={cn(
                    "mt-1.5 text-xs font-semibold leading-snug",
                    storeIsOpen ? "text-emerald-300" : "text-red-300",
                  )}
                >
                  {storeIsOpen
                    ? closeTime
                      ? `Recebendo pedidos até ${closeTime}`
                      : "Recebendo pedidos normalmente"
                    : openTime
                      ? `Pedidos pausados. Abre às ${openTime}`
                      : "Pedidos pausados no momento"}
                </p>
              </div>

              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-slate-950/50",
                  storeIsOpen
                    ? "border-emerald-500/30 text-emerald-300"
                    : "border-red-500/30 text-red-300",
                )}
              >
                <Store className="h-4 w-4" />
              </div>
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3 [scrollbar-width:thin] [scrollbar-color:#94a3b8_transparent]">
        <div className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isHrefActive(pathname, item)
            const hasChildren = Boolean(item.children?.length)
            const isOpen = openItems.includes(item.label)
            const sectionLabel = !isCollapsed
              ? getSectionLabel(item.label)
              : null

            if (hasChildren) {
              return (
                <div key={item.label}>
                  {sectionLabel && (
                    <div className="mb-1 mt-3 px-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        {sectionLabel}
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (isCollapsed) return
                      toggleItem(item.label)
                    }}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition",
                      active
                        ? "bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20"
                        : "text-slate-400 hover:bg-slate-800/80 hover:text-blue-300 hover:shadow-sm",
                      isCollapsed && "justify-center px-0",
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    {active && !isCollapsed && (
                      <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-orange-500" />
                    )}

                    <span
                      className={cn(
                        "flex shrink-0 items-center justify-center transition",
                        active
                          ? "text-blue-300"
                          : "text-slate-500 group-hover:text-blue-300",
                        isCollapsed && "h-10 w-10 rounded-2xl",
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
                            isOpen && "rotate-180 text-blue-300",
                          )}
                        />
                      </>
                    )}
                  </button>

                  {!isCollapsed && isOpen && (
                    <div className="ml-5 mt-1 border-l border-slate-800 pl-2">
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
                                "group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition",
                                childActive
                                  ? "bg-blue-600 text-white shadow-sm shadow-blue-950/20"
                                  : "text-slate-500 hover:bg-slate-800/80 hover:text-blue-300 hover:shadow-sm",
                              )}
                            >
                              <span
                                className={cn(
                                  "shrink-0 transition",
                                  childActive
                                    ? "text-white"
                                    : "text-slate-400 group-hover:text-blue-300",
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
              <div key={item.href}>
                {sectionLabel && (
                  <div className="mb-1 mt-3 px-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      {sectionLabel}
                    </p>
                  </div>
                )}

                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition",
                    active
                      ? "bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20"
                      : "text-slate-400 hover:bg-slate-800/80 hover:text-blue-300 hover:shadow-sm",
                    isCollapsed && "justify-center px-0",
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  {active && !isCollapsed && (
                    <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-blue-600" />
                  )}

                  <span
                    className={cn(
                      "flex shrink-0 items-center justify-center transition",
                      active
                        ? "text-blue-300"
                        : "text-slate-500 group-hover:text-blue-300",
                      isCollapsed && "h-10 w-10 rounded-2xl",
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
              </div>
            )
          })}
        </div>
      </nav>

      {!isCollapsed && (
        <div className="border-t border-slate-800 bg-slate-950/75 p-3 backdrop-blur-xl">
          <Link
            href="/divulgar-cardapio"
            className="group block rounded-2xl border border-slate-800 bg-slate-900 p-3 shadow-sm transition hover:border-blue-500/40 hover:bg-slate-800"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                {brand.logoUrl && !logoFailed ? (
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    className="h-full w-full object-cover"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <span className="text-xs font-black text-blue-300">
                    {initials}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">
                  Cardápio online
                </p>

                <p className="truncate text-xs font-semibold text-slate-500 group-hover:text-blue-300">
                  Ver página pública
                </p>
              </div>

              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-blue-300" />
            </div>
          </Link>
        </div>
      )}

      {isCollapsed && (
        <div className="border-t border-slate-800 p-3">
          <div
            className={cn(
              "mx-auto h-1.5 w-8 rounded-full",
              storeIsOpen ? "bg-emerald-300" : "bg-red-300",
            )}
          />
        </div>
      )}
    </aside>
  )
}