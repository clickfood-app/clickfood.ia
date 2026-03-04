"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Star,
  Ban,
  RefreshCw,
  AlertTriangle,
} from "lucide-react"
import type { Client } from "@/lib/clients-data"
import {
  isRecurrentClient,
  isInactiveForLong,
  formatCurrency,
  formatDate,
  getInitials,
} from "@/lib/clients-data"

interface ClientRowProps {
  client: Client
  onClick: () => void
}

export default function ClientRow({ client, onClick }: ClientRowProps) {
  const recurrent = isRecurrentClient(client)
  const inactiveLong = isInactiveForLong(client)

  return (
    <tr
      onClick={onClick}
      className="group cursor-pointer border-b border-border transition-colors hover:bg-secondary/50"
    >
      {/* Name + Avatar */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-[hsl(var(--primary))] text-xs font-bold text-[hsl(var(--primary-foreground))]">
              {getInitials(client.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium text-foreground">
                {client.name}
              </p>
              {client.isFavorite && (
                <Star className="h-3.5 w-3.5 flex-shrink-0 fill-amber-400 text-amber-400" />
              )}
              {client.isBlocked && (
                <Ban className="h-3.5 w-3.5 flex-shrink-0 text-destructive" />
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {recurrent && (
                <Badge variant="secondary" className="h-5 gap-0.5 px-1.5 text-[10px] bg-blue-100 text-blue-700">
                  <RefreshCw className="h-2.5 w-2.5" />
                  Fiel
                </Badge>
              )}
              {inactiveLong && (
                <Badge variant="secondary" className="h-5 gap-0.5 px-1.5 text-[10px] bg-muted text-muted-foreground">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Inativo
                </Badge>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Phone */}
      <td className="hidden px-4 py-3 md:table-cell">
        <span className="text-sm text-foreground">{client.phone}</span>
      </td>

      {/* Orders */}
      <td className="px-4 py-3 text-center">
        <span className="text-sm font-semibold text-foreground">
          {client.orders.length}
        </span>
      </td>

      {/* Total spent */}
      <td className="hidden px-4 py-3 lg:table-cell">
        <span className="text-sm font-semibold text-foreground">
          {formatCurrency(client.totalSpent)}
        </span>
      </td>

      {/* Last purchase */}
      <td className="hidden px-4 py-3 xl:table-cell">
        <span className="text-sm text-muted-foreground">
          {client.lastPurchase ? formatDate(client.lastPurchase) : "---"}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge
          variant="secondary"
          className={
            client.status === "ativo"
              ? "bg-blue-100 text-blue-700"
              : "bg-muted text-muted-foreground"
          }
        >
          {client.status === "ativo" ? "Ativo" : "Inativo"}
        </Badge>
      </td>
    </tr>
  )
}
