import {
  ArrowLeftRight,
  Armchair,
  BellRing,
  BookOpen,
  CircleAlert,
  CircleDollarSign,
  Coins,
  FileBarChart,
  Gift,
  Globe,
  HandCoins,
  Landmark,
  LayoutDashboard,
  MapPin,
  Megaphone,
  MonitorCheck,
  PackageOpen,
  Percent,
  PlusCircle,
  ReceiptText,
  Settings,
  ShoppingCart,
  Store,
  Target,
  TicketPercent,
  TrendingUp,
  Trophy,
  Truck,
  UserCog,
  UserX,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

export type AdminNavChild = {
  label: string
  icon: LucideIcon
  href: string
  /** Texto exibido no breadcrumb quando difere do rótulo do menu. */
  breadcrumbLabel?: string
}

export type AdminNavItem = {
  label: string
  icon: LucideIcon
  href: string
  /** Texto exibido no breadcrumb quando difere do rótulo do menu. */
  breadcrumbLabel?: string
  children?: AdminNavChild[]
}

export type AdminNavGroup = {
  /** Sem título, o grupo é exibido sem cabeçalho. */
  title?: string
  items: AdminNavItem[]
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    title: "Principal",
    items: [
      { label: "Visão Geral", icon: LayoutDashboard, href: "/gestao" },
      { label: "Pedidos", icon: ShoppingCart, href: "/pedidos" },
      { label: "PDV", icon: PlusCircle, href: "/novo-pedido" },
      { label: "KDS", icon: MonitorCheck, href: "/kds" },
    ],
  },
  {
    title: "Cardápio",
    items: [
      { label: "Cardápio Digital", icon: Globe, href: "/divulgar-cardapio" },
      { label: "Produtos", icon: PackageOpen, href: "/produtos" },
      { label: "Ficha Técnica", icon: BookOpen, href: "/ficha-tecnica" },
    ],
  },
  {
    title: "Clientes & Marketing",
    items: [
      { label: "Clientes", icon: Users, href: "/clientes" },
      { label: "Campanhas", icon: Megaphone, href: "/campanhas" },
      { label: "Cupons", icon: TicketPercent, href: "/cupons" },
      { label: "Upsell", icon: TrendingUp, href: "/campanhas/upsell" },
      { label: "Fidelidade", icon: Gift, href: "/campanhas/fidelidade" },
      { label: "Cashback", icon: Coins, href: "/campanhas/cashback" },
    ],
  },
  {
    title: "Operação",
    items: [
      { label: "Entregadores", icon: Truck, href: "/entregadores" },
      {
        label: "Estoque",
        icon: PackageOpen,
        href: "/financeiro/controle-estoque",
      },
      {
        label: "Perdas e Desperdício",
        icon: CircleAlert,
        href: "/perdas-desperdicio",
      },
      { label: "Fornecedores", icon: Store, href: "/fornecedores" },
      { label: "Mesas", icon: Armchair, href: "/mesas" },
      { label: "Equipe", icon: UserCog, href: "/equipe" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { label: "Meu Desempenho", icon: Target, href: "/metas" },
      {
        label: "Financeiro",
        icon: Wallet,
        href: "/financeiro",
        children: [
          {
            label: "Resumo",
            icon: CircleDollarSign,
            href: "/financeiro",
            breadcrumbLabel: "Finanças",
          },
          {
            label: "Contas a Pagar",
            icon: ReceiptText,
            href: "/financeiro/contas-a-pagar",
          },
          {
            label: "Despesas",
            icon: CircleAlert,
            href: "/financeiro/despesas",
          },
          { label: "Caixa", icon: Landmark, href: "/financeiro/caixa" },
          {
            label: "Recebimentos",
            icon: HandCoins,
            href: "/financeiro/recebimentos",
          },
          {
            label: "Entrada/Saída",
            icon: ArrowLeftRight,
            href: "/financeiro/entrada-saida",
          },
          { label: "CMV e Margem", icon: Percent, href: "/financeiro/cmv" },
        ],
      },
      {
        label: "Relatórios",
        icon: FileBarChart,
        href: "/financeiro/relatorios",
        children: [
          {
            label: "Relatórios Financeiros",
            icon: FileBarChart,
            href: "/financeiro/relatorios",
          },
          {
            label: "Ranking de Produtos",
            icon: Trophy,
            href: "/crescimento/ranking-produtos",
          },
          {
            label: "Alertas",
            icon: BellRing,
            href: "/crescimento/alertas",
          },
          {
            label: "Radar de Bairros",
            icon: MapPin,
            href: "/crescimento/radar-bairros",
          },
          {
            label: "Clientes Sumidos",
            icon: UserX,
            href: "/crescimento/clientes-sumidos",
          },
        ],
      },
    ],
  },
  // Configurações permanece no fim da lista até a reorganização do rodapé.
  {
    items: [{ label: "Configurações", icon: Settings, href: "/configuracoes" }],
  },
]

export const adminNavItems: AdminNavItem[] = adminNavGroups.flatMap(
  (group) => group.items,
)

/** Rotas administrativas que têm breadcrumb, mas não aparecem no menu lateral. */
const extraBreadcrumbLabels: Record<string, string> = {
  "/": "Pedidos",
  "/entregas": "Entregas",
  "/checkout": "Checkout",
  "/controle-estoque": "Controle de estoque",
}

function buildAdminBreadcrumbMap() {
  const map: Record<string, string> = { ...extraBreadcrumbLabels }

  for (const item of adminNavItems) {
    const entries: (AdminNavItem | AdminNavChild)[] = item.children?.length
      ? item.children
      : [item]

    for (const entry of entries) {
      map[entry.href] = entry.breadcrumbLabel ?? entry.label
    }
  }

  return map
}

export const adminBreadcrumbMap: Record<string, string> =
  buildAdminBreadcrumbMap()
