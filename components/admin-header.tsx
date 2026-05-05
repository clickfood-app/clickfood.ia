"use client"

import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  Bell,
  ChevronRight,
  LogOut,
  Menu,
  Settings,
  Store,
  User,
} from "lucide-react"
import { useMemo, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth/auth-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface AdminHeaderProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
}

const notifications = [
  {
    id: 1,
    title: "Novo pedido recebido",
    description: "Pedido #4822 de Lucas Ferreira",
    time: "2 min atrás",
    unread: true,
  },
  {
    id: 2,
    title: "Produto com estoque baixo",
    description: "Camiseta Premium - apenas 3 unidades",
    time: "15 min atrás",
    unread: true,
  },
  {
    id: 3,
    title: "Pagamento confirmado",
    description: "Pedido #4819 - R$ 475,00",
    time: "1h atrás",
    unread: true,
  },
]

const breadcrumbMap: Record<string, string> = {
  "/": "Visão Geral",
  "/pedidos": "Pedidos",
  "/produtos": "Produtos",
  "/clientes": "Clientes",
  "/cardapio": "Cardapio Digital",
  "/cupons": "Cupons",
  "/funcionarios": "Gestao de Funcionarios",
  "/financeiro": "Financeiro",
  "/relatorios/resumo": "Relatorios / Visao Geral",
  "/relatorios/vendas": "Relatorios / Vendas",
  "/relatorios/historico": "Relatorios / Historico",
  "/configuracoes": "Configurações",
}

export default function AdminHeader({
  isCollapsed,
  onToggleCollapse,
}: AdminHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { restaurant, user } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const unreadCount = notifications.filter((n) => n.unread).length
  const currentPage =
    breadcrumbMap[pathname] ||
    pathname.replace("/", "").charAt(0).toUpperCase() + pathname.slice(2)

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "AD"

  const handleLogout = async () => {
    if (isLoggingOut) return

    try {
      setIsLoggingOut(true)

      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error("Erro ao sair:", error.message)
        setIsLoggingOut(false)
        return
      }

      router.replace("/auth")
      router.refresh()

      window.setTimeout(() => {
        window.location.replace("/auth")
      }, 150)
    } catch (error) {
      console.error("Erro inesperado ao sair:", error)
      setIsLoggingOut(false)
    }
  }

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 flex h-14 items-center border-b border-border bg-card shadow-sm transition-all duration-300 ease-in-out",
        isCollapsed ? "left-[68px]" : "left-64"
      )}
    >
      <div className="flex flex-1 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleCollapse}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden h-6 w-px bg-border sm:block" />

          <div className="hidden items-center gap-2.5 sm:flex">
            {restaurant?.logo_url ? (
              <div className="relative h-8 w-8 overflow-hidden rounded-lg ring-1 ring-border">
                <Image
                  src={restaurant.logo_url}
                  alt={restaurant.name || "Logo do restaurante"}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 ring-1 ring-border">
                <Store className="h-4 w-4 text-[hsl(var(--primary))]" />
              </div>
            )}
            <span className="text-sm font-semibold text-foreground">
              {restaurant?.name || "Meu Restaurante"}
            </span>
          </div>

          <div className="hidden h-6 w-px bg-border lg:block" />

          <Breadcrumb className="hidden sm:block">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="#"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Painel
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-3.5 w-3.5" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">
                  {currentPage}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Notificações"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notificações</span>
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                  {unreadCount} novas
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex cursor-pointer flex-col items-start gap-1 p-3"
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {notification.title}
                    </p>
                    {notification.unread && (
                      <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[hsl(var(--primary))]" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {notification.description}
                  </p>
                  <p className="text-[11px] text-muted-foreground/70">
                    {notification.time}
                  </p>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer justify-center text-sm font-medium text-[hsl(var(--primary))]">
                Ver todas as notificações
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-[hsl(var(--primary))] text-xs font-bold text-[hsl(var(--primary-foreground))]">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-medium leading-none text-foreground">
                    {user?.name || "Administrador"}
                  </p>
                  <p className="mt-0.5 text-xs leading-none text-muted-foreground">
                    {user?.email || "admin@empresa.com"}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium leading-none text-foreground">
                    {user?.name || "Administrador"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email || "admin@empresa.com"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem className="cursor-pointer gap-2">
                  <User className="h-4 w-4" />
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer gap-2">
                  <Settings className="h-4 w-4" />
                  Configurações
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isLoggingOut}
                className="cursor-pointer gap-2 text-destructive focus:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? "Saindo..." : "Sair"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}