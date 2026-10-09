import {
  BookOpen,
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
  title: string
  items: AdminNavItem[]
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    title: "Operação",
    items: [
      {
        label: "Novo Pedido",
        icon: PlusCircle,
        href: "/novo-pedido",
        breadcrumbLabel: "Novo pedido",
      },
      {
        label: "Pedidos",
        icon: ShoppingCart,
        href: "/pedidos",
      },
      {
        label: "KDS",
        icon: MonitorCheck,
        href: "/kds",
      },
    ],
  },
  {
    title: "Cardápio",
    items: [
      {
        label: "Cardápio",
        icon: Globe,
        href: "/divulgar-cardapio",
      },
      {
        label: "Produtos",
        icon: PackageOpen,
        href: "/produtos",
      },
    ],
  },
  {
    title: "Administração",
    items: [
      {
        label: "Gestão interna",
        icon: Store,
        href: "/fornecedores",
        children: [
          {
            label: "Fornecedores",
            icon: Store,
            href: "/fornecedores",
          },
          {
            label: "Estoque",
            icon: PackageOpen,
            href: "/financeiro/controle-estoque",
          },
          {
            label: "Ficha técnica",
            icon: BookOpen,
            href: "/ficha-tecnica",
          },
          {
            label: "Perdas e desperdício",
            icon: CircleAlert,
            href: "/perdas-desperdicio",
          },
          {
            label: "Metas",
            icon: Target,
            href: "/metas",
          },
        ],
      },
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
            label: "Contas a pagar",
            icon: ReceiptText,
            href: "/financeiro/contas-a-pagar",
          },
          {
            label: "Despesas",
            icon: CircleAlert,
            href: "/financeiro/despesas",
          },
          {
            label: "Relatórios",
            icon: FileBarChart,
            href: "/financeiro/relatorios",
          },
        ],
      },
      {
        label: "Entregadores",
        icon: Truck,
        href: "/entregadores",
      },
      {
        label: "Clientes",
        icon: Users,
        href: "/clientes",
      },
      {
        label: "Cupons",
        icon: TicketPercent,
        href: "/cupons",
      },
      {
        label: "Campanhas",
        icon: Megaphone,
        href: "/campanhas",
        children: [
          {
            label: "Visão Geral",
            icon: ClipboardCheck,
            href: "/campanhas",
            breadcrumbLabel: "Campanhas",
          },
          {
            label: "Upsell",
            icon: TrendingUp,
            href: "/campanhas/upsell",
          },
          {
            label: "Fidelidade",
            icon: Gift,
            href: "/campanhas/fidelidade",
          },
          {
            label: "Cashback",
            icon: Coins,
            href: "/campanhas/cashback",
          },
        ],
      },
      {
        label: "Configurações",
        icon: Settings,
        href: "/configuracoes",
      },
    ],
  },
]

export const adminNavItems: AdminNavItem[] = adminNavGroups.flatMap(
  (group) => group.items,
)

/** Rotas administrativas que têm breadcrumb, mas não aparecem no menu lateral. */
const extraBreadcrumbLabels: Record<string, string> = {
  "/": "Pedidos",
  "/gestao": "Painel",
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
