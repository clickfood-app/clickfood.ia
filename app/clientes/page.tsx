"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Users,
  UserCheck,
  RefreshCw,
  DollarSign,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import ClientList from "@/components/client-list"
import ClientDetails from "@/components/client-details"
import { createClient } from "@/lib/supabase/client"
import type { Client, ClientOrder } from "@/lib/clients-data"
import {
  isRecurrentClient,
  formatCurrency,
} from "@/lib/clients-data"

type OrderRow = {
  id: string
  public_order_number: string | number | null
  customer_name: string | null
  customer_phone: string | null
  status: string | null
  total: number | null
  created_at: string
}

function mapOrderStatus(status: string | null | undefined): ClientOrder["status"] {
  const normalized = (status || "").toLowerCase()

  if (
    normalized === "finished" ||
    normalized === "delivered" ||
    normalized === "completed"
  ) {
    return "Entregue"
  }

  if (
    normalized === "out_for_delivery" ||
    normalized === "on_the_way" ||
    normalized === "delivering" ||
    normalized === "in_transit"
  ) {
    return "Em trânsito"
  }

  if (
    normalized === "cancelled" ||
    normalized === "canceled"
  ) {
    return "Cancelado"
  }

  return "Pendente"
}

function buildClientsFromOrders(orders: OrderRow[]): Client[] {
  const grouped = new Map<string, Client>()

  for (const order of orders) {
    const name = order.customer_name?.trim() || "Cliente sem nome"
    const phone = order.customer_phone?.trim() || "Sem telefone"

    const groupKey =
      order.customer_phone?.trim() ||
      order.customer_name?.trim().toLowerCase() ||
      order.id

    const orderStatus = mapOrderStatus(order.status)
    const orderTotal = orderStatus === "Cancelado" ? 0 : Number(order.total ?? 0)

    const clientOrder: ClientOrder = {
      id: order.id,
      date: order.created_at,
      items: [
        order.public_order_number
          ? `Pedido #${order.public_order_number}`
          : `Pedido #${order.id.slice(0, 8)}`,
      ],
      total: orderTotal,
      status: orderStatus,
    }

    const existing = grouped.get(groupKey)

    if (!existing) {
      grouped.set(groupKey, {
        id: groupKey,
        name,
        phone,
        email: null,
        address: null,
        registeredAt: order.created_at,
        orders: [clientOrder],
        totalSpent: orderTotal,
        lastPurchase: order.created_at,
        status: "ativo",
        isFavorite: false,
        isBlocked: false,
        notes: "",
        topProduct: null,
      })

      continue
    }

    existing.orders.push(clientOrder)
    existing.totalSpent += orderTotal

    if (new Date(order.created_at) < new Date(existing.registeredAt)) {
      existing.registeredAt = order.created_at
    }

    if (
      !existing.lastPurchase ||
      new Date(order.created_at) > new Date(existing.lastPurchase)
    ) {
      existing.lastPurchase = order.created_at
    }
  }

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  return Array.from(grouped.values())
    .map((client): Client => {
      const sortedOrders = [...client.orders].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )

      const lastPurchase = sortedOrders[0]?.date ?? client.lastPurchase

      const status: Client["status"] =
        lastPurchase && new Date(lastPurchase) >= threeMonthsAgo
          ? "ativo"
          : "inativo"

      return {
        ...client,
        orders: sortedOrders,
        lastPurchase,
        status,
      }
    })
    .sort((a, b) => {
      const aTime = a.lastPurchase ? new Date(a.lastPurchase).getTime() : 0
      const bTime = b.lastPurchase ? new Date(b.lastPurchase).getTime() : 0
      return bTime - aTime
    })
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadClients() {
      try {
        setLoading(true)
        setError(null)

        const supabase = createClient()

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          throw new Error(userError.message)
        }

        if (!user) {
          if (isMounted) {
            setClients([])
          }
          return
        }

        const { data: restaurant, error: restaurantError } = await supabase
          .from("restaurants")
          .select("id")
          .eq("owner_id", user.id)
          .single()

        if (restaurantError) {
          throw new Error("Não foi possível identificar o restaurante do usuário.")
        }

        const { data: orders, error: ordersError } = await supabase
          .from("orders")
          .select(
            "id, public_order_number, customer_name, customer_phone, status, total, created_at"
          )
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false })

        if (ordersError) {
          throw new Error("Não foi possível carregar os clientes.")
        }

        const builtClients = buildClientsFromOrders((orders || []) as OrderRow[])

        if (isMounted) {
          setClients(builtClients)
        }
      } catch (err) {
        if (isMounted) {
          setClients([])
          setError(
            err instanceof Error ? err.message : "Erro ao carregar clientes."
          )
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadClients()

    return () => {
      isMounted = false
    }
  }, [])

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client)
    setDetailsOpen(true)
  }

  const handleUpdateClient = (updated: Client) => {
    setClients((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    )
    setSelectedClient(updated)
  }

  const kpis = useMemo(() => {
    const total = clients.length

    const now = new Date()
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(now.getMonth() - 3)

    const active = clients.filter((c) => {
      if (!c.lastPurchase) return false
      return new Date(c.lastPurchase) >= threeMonthsAgo
    }).length

    const recurrent = clients.filter(isRecurrentClient).length

    const totalSpent = clients.reduce((sum, c) => sum + c.totalSpent, 0)
    const totalOrders = clients.reduce((sum, c) => sum + c.orders.length, 0)
    const avgTicket = totalOrders > 0 ? totalSpent / totalOrders : 0

    return { total, active, recurrent, avgTicket }
  }, [clients])

  const kpiCards = [
    {
      label: "Total de Clientes",
      value: kpis.total.toString(),
      icon: <Users className="h-5 w-5" />,
    },
    {
      label: "Clientes Ativos",
      value: kpis.active.toString(),
      icon: <UserCheck className="h-5 w-5" />,
    },
    {
      label: "Clientes Recorrentes",
      value: kpis.recurrent.toString(),
      icon: <RefreshCw className="h-5 w-5" />,
    },
    {
      label: "Ticket Medio",
      value: formatCurrency(kpis.avgTicket),
      icon: <DollarSign className="h-5 w-5" />,
    },
  ]

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie seus clientes, acompanhe o relacionamento e tome decisoes baseadas em dados.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {kpi.label}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                  {kpi.icon}
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-foreground">
                {loading ? "..." : kpi.value}
              </p>
            </div>
          ))}
        </div>

        <ClientList
          clients={clients}
          onSelectClient={handleSelectClient}
        />

        <ClientDetails
          client={selectedClient}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          onUpdate={handleUpdateClient}
        />
      </div>
    </AdminLayout>
  )
}