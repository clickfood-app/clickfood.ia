"use client"

import { useState, useMemo } from "react"
import { Search, SlidersHorizontal, ArrowUpDown, Users } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Client } from "@/lib/clients-data"
import { isRecurrentClient, isNewClient } from "@/lib/clients-data"
import ClientRow from "@/components/client-row"

type FilterType = "all" | "recorrentes" | "novos" | "inativos"
type SortType = "pedidos" | "valor" | "ultima"

interface ClientListProps {
  clients: Client[]
  onSelectClient: (client: Client) => void
}

export default function ClientList({ clients, onSelectClient }: ClientListProps) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [sort, setSort] = useState<SortType>("pedidos")

  const filtered = useMemo(() => {
    let result = [...clients]

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
      )
    }

    // Filter
    switch (filter) {
      case "recorrentes":
        result = result.filter(isRecurrentClient)
        break
      case "novos":
        result = result.filter(isNewClient)
        break
      case "inativos":
        result = result.filter((c) => c.status === "inativo")
        break
    }

    // Sort
    switch (sort) {
      case "pedidos":
        result.sort((a, b) => b.orders.length - a.orders.length)
        break
      case "valor":
        result.sort((a, b) => b.totalSpent - a.totalSpent)
        break
      case "ultima":
        result.sort((a, b) => {
          const da = a.lastPurchase ? new Date(a.lastPurchase).getTime() : 0
          const db = b.lastPurchase ? new Date(b.lastPurchase).getTime() : 0
          return db - da
        })
        break
    }

    return result
  }, [clients, search, filter, sort])

  const filterLabels: Record<FilterType, string> = {
    all: "Todos",
    recorrentes: "Recorrentes",
    novos: "Novos",
    inativos: "Inativos",
  }

  const sortLabels: Record<SortType, string> = {
    pedidos: "Mais pedidos",
    valor: "Maior valor",
    ultima: "Ultima compra",
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-secondary">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">{filterLabels[filter]}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Filtrar por</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(filterLabels) as FilterType[]).map((key) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setFilter(key)}
                className={`cursor-pointer ${filter === key ? "font-semibold text-[hsl(var(--primary))]" : ""}`}
              >
                {filterLabels[key]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-9 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-secondary">
              <ArrowUpDown className="h-4 w-4" />
              <span className="hidden sm:inline">{sortLabels[sort]}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(sortLabels) as SortType[]).map((key) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setSort(key)}
                className={`cursor-pointer ${sort === key ? "font-semibold text-[hsl(var(--primary))]" : ""}`}
              >
                {sortLabels[key]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="mb-3 h-10 w-10" />
          <p className="text-sm font-medium">Nenhum cliente encontrado</p>
          <p className="mt-1 text-xs">Tente ajustar seus filtros de busca.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cliente
                </th>
                <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                  Telefone
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pedidos
                </th>
                <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                  Total Gasto
                </th>
                <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:table-cell">
                  Ultima Compra
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <ClientRow
                  key={client.id}
                  client={client}
                  onClick={() => onSelectClient(client)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          {filtered.length} de {clients.length} clientes
        </span>
      </div>
    </div>
  )
}
