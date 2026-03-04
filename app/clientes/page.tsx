"use client"

import { useState, useMemo } from "react"
import {
  Users,
  UserCheck,
  RefreshCw,
  DollarSign,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import ClientList from "@/components/client-list"
import ClientDetails from "@/components/client-details"
import type { Client } from "@/lib/clients-data"
import {
  MOCK_CLIENTS,
  isRecurrentClient,
  formatCurrency,
} from "@/lib/clients-data"

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

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

  // KPIs
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
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie seus clientes, acompanhe o relacionamento e tome decisoes baseadas em dados.
          </p>
        </div>

        {/* KPI cards */}
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
                {kpi.value}
              </p>
            </div>
          ))}
        </div>

        {/* Client list */}
        <ClientList
          clients={clients}
          onSelectClient={handleSelectClient}
        />

        {/* Client details sheet */}
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
