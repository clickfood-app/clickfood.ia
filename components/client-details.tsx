"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Star,
  Ban,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  ShoppingBag,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
  Heart,
} from "lucide-react"
import type { Client } from "@/lib/clients-data"
import {
  isRecurrentClient,
  isInactiveForLong,
  getAverageTimeBetweenOrders,
  formatCurrency,
  formatDate,
  getInitials,
} from "@/lib/clients-data"

interface ClientDetailsProps {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (client: Client) => void
}

function getOrderStatusStyle(status: string) {
  switch (status) {
    case "Entregue":
      return "bg-green-100 text-green-700"
    case "Em trânsito":
      return "bg-blue-100 text-blue-700"
    case "Pendente":
      return "bg-amber-100 text-amber-700"
    case "Cancelado":
      return "bg-red-100 text-red-700"
    default:
      return "bg-muted text-muted-foreground"
  }
}

export default function ClientDetails({
  client,
  open,
  onOpenChange,
  onUpdate,
}: ClientDetailsProps) {
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState("")

  if (!client) return null

  const recurrent = isRecurrentClient(client)
  const inactiveLong = isInactiveForLong(client)
  const avgTime = getAverageTimeBetweenOrders(client)

  const handleToggleFavorite = () => {
    onUpdate({ ...client, isFavorite: !client.isFavorite })
  }

  const handleToggleBlocked = () => {
    onUpdate({ ...client, isBlocked: !client.isBlocked })
  }

  const handleSaveNotes = () => {
    onUpdate({ ...client, notes: notesValue })
    setEditingNotes(false)
  }

  const handleStartEditNotes = () => {
    setNotesValue(client.notes)
    setEditingNotes(true)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pb-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-[hsl(var(--primary))] text-lg font-bold text-[hsl(var(--primary-foreground))]">
                {getInitials(client.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-xl text-foreground">
                {client.name}
              </SheetTitle>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {client.isFavorite && (
                  <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
                    <Star className="h-3 w-3 fill-current" />
                    Favorito
                  </Badge>
                )}
                {recurrent && (
                  <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-700">
                    <RefreshCw className="h-3 w-3" />
                    Recorrente
                  </Badge>
                )}
                {inactiveLong && (
                  <Badge variant="secondary" className="gap-1 bg-muted text-muted-foreground">
                    <AlertTriangle className="h-3 w-3" />
                    Inativo
                  </Badge>
                )}
                {client.isBlocked && (
                  <Badge variant="destructive" className="gap-1">
                    <Ban className="h-3 w-3" />
                    Bloqueado
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <Separator />

        {/* Actions */}
        <div className="flex gap-2 py-4">
          <button
            onClick={handleToggleFavorite}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              client.isFavorite
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            <Heart className={`h-4 w-4 ${client.isFavorite ? "fill-current" : ""}`} />
            {client.isFavorite ? "Favoritado" : "Favoritar"}
          </button>
          <button
            onClick={handleToggleBlocked}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              client.isBlocked
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            <Ban className="h-4 w-4" />
            {client.isBlocked ? "Desbloquear" : "Bloquear"}
          </button>
        </div>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">Informacoes</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">Historico</TabsTrigger>
            <TabsTrigger value="insights" className="flex-1">Insights</TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="space-y-4 pt-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{client.phone}</span>
              </div>
              {client.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{client.email}</span>
                </div>
              )}
              {client.address && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{client.address}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">
                  Cadastro em {formatDate(client.registeredAt)}
                </span>
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div>
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MessageSquare className="h-4 w-4" />
                  Observacoes
                </h4>
                {!editingNotes && (
                  <button
                    onClick={handleStartEditNotes}
                    className="text-xs font-medium text-[hsl(var(--primary))] hover:underline"
                  >
                    Editar
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    rows={3}
                    placeholder="Adicione observacoes sobre o cliente..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveNotes}
                      className="rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => setEditingNotes(false)}
                      className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {client.notes || "Nenhuma observacao adicionada."}
                </p>
              )}
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="pt-4">
            <div className="space-y-3">
              {client.orders.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum pedido encontrado.
                </p>
              ) : (
                client.orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">
                        #{order.id}
                      </span>
                      <Badge
                        variant="secondary"
                        className={getOrderStatusStyle(order.status)}
                      >
                        {order.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(order.date)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {order.items.map((item, i) => (
                        <span
                          key={`${order.id}-${i}`}
                          className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {formatCurrency(order.total)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="pt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ShoppingBag className="h-4 w-4" />
                    <span className="text-xs">Total Pedidos</span>
                  </div>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {client.orders.length}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs">Total Gasto</span>
                  </div>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {formatCurrency(client.totalSpent)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs">Tempo Medio</span>
                  </div>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {avgTime}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="h-4 w-4" />
                    <span className="text-xs">Recorrente</span>
                  </div>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {recurrent ? "Sim" : "Nao"}
                  </p>
                </div>
              </div>

              {client.topProduct && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Produto Mais Consumido
                  </h4>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    {client.topProduct}
                  </p>
                </div>
              )}

              {client.lastPurchase && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Ultima Compra
                  </h4>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    {formatDate(client.lastPurchase)}
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-border bg-card p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ticket Medio
                </h4>
                <p className="mt-1 text-lg font-bold text-foreground">
                  {client.orders.length > 0
                    ? formatCurrency(client.totalSpent / client.orders.length)
                    : "N/A"}
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
