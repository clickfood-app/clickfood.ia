"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Filter,
  Loader2,
  ReceiptText,
  RefreshCcw,
  Search,
  Smartphone,
  WalletCards,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Order = {
  id: string
  public_order_number: string
  customer_name: string
  customer_phone: string
  status: string
  subtotal: number
  discount: number
  delivery_fee: number
  total: number
  payment_method: string | null
  payment_status: string
  order_type: string | null
  created_at: string
  asaas_payment_id: string | null
  asaas_payment_status: string | null
  asaas_invoice_url: string | null
}

type PaymentStatusFilter = "all" | "paid" | "pending"
type PaymentMethodFilter = "all" | "pix" | "cash" | "card" | "other"

function todayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  end.setDate(end.getDate() + 1)

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sem data"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizePaymentMethod(method: string | null) {
  const value = (method || "").toLowerCase()

  if (
    value.includes("pix") ||
    value.includes("asaas") ||
    value.includes("mercado_pago")
  ) {
    return "pix"
  }

  if (
    value.includes("dinheiro") ||
    value.includes("cash") ||
    value.includes("money")
  ) {
    return "cash"
  }

  if (
    value.includes("cart") ||
    value.includes("card") ||
    value.includes("credito") ||
    value.includes("crédito") ||
    value.includes("debito") ||
    value.includes("débito")
  ) {
    return "card"
  }

  return "other"
}

function getPaymentMethodLabel(method: string | null) {
  const normalized = normalizePaymentMethod(method)

  if (normalized === "pix") return "Pix"
  if (normalized === "cash") return "Dinheiro"
  if (normalized === "card") return "Cartão"

  return method || "Outro"
}

function getPaymentStatusLabel(status: string) {
  if (status === "paid") return "Pago"
  if (status === "pending") return "Pendente"
  if (status === "failed") return "Falhou"
  if (status === "cancelled") return "Cancelado"

  return status
}

export default function RecebimentosPage() {
  const supabase = createClient()

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [startDate, setStartDate] = useState(todayDate())
  const [endDate, setEndDate] = useState(todayDate())
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>("all")
  const [methodFilter, setMethodFilter] = useState<PaymentMethodFilter>("all")
  const [search, setSearch] = useState("")

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase()

    return orders.filter((order) => {
      const method = normalizePaymentMethod(order.payment_method)

      const matchesStatus =
        statusFilter === "all" || order.payment_status === statusFilter

      const matchesMethod = methodFilter === "all" || method === methodFilter

      const matchesSearch =
        !term ||
        order.public_order_number.toLowerCase().includes(term) ||
        order.customer_name.toLowerCase().includes(term) ||
        order.customer_phone.toLowerCase().includes(term)

      return matchesStatus && matchesMethod && matchesSearch
    })
  }, [methodFilter, orders, search, statusFilter])

  const totals = useMemo(() => {
    return filteredOrders.reduce(
      (acc, order) => {
        const total = toNumber(order.total)
        const method = normalizePaymentMethod(order.payment_method)

        if (order.payment_status === "paid") {
          acc.received += total
          acc.paidCount += 1

          if (method === "pix") acc.pix += total
          if (method === "cash") acc.cash += total
          if (method === "card") acc.card += total
          if (method === "other") acc.other += total
        } else {
          acc.pending += total
          acc.pendingCount += 1
        }

        return acc
      },
      {
        received: 0,
        pending: 0,
        pix: 0,
        cash: 0,
        card: 0,
        other: 0,
        paidCount: 0,
        pendingCount: 0,
      },
    )
  }, [filteredOrders])

  const averageTicket =
    totals.paidCount > 0 ? totals.received / totals.paidCount : 0

  async function loadData() {
    try {
      setLoading(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error("Usuário não autenticado.")
      }

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .single()

      if (restaurantError || !restaurant) {
        throw new Error("Restaurante não encontrado.")
      }

      setRestaurantId(restaurant.id)

      const { startIso, endIso } = getDateRange(startDate, endDate)

      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          id,
          public_order_number,
          customer_name,
          customer_phone,
          status,
          subtotal,
          discount,
          delivery_fee,
          total,
          payment_method,
          payment_status,
          order_type,
          created_at,
          asaas_payment_id,
          asaas_payment_status,
          asaas_invoice_url
        `,
        )
        .eq("restaurant_id", restaurant.id)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: false })

      if (error) throw error

      setOrders(
        (data || []).map((order) => ({
          ...order,
          subtotal: toNumber(order.subtotal),
          discount: toNumber(order.discount),
          delivery_fee: toNumber(order.delivery_fee),
          total: toNumber(order.total),
        })),
      )
    } catch (error: any) {
      console.error("Erro ao carregar recebimentos:", error)
      alert(error?.message || "Não foi possível carregar os recebimentos.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  async function markAsPaid(order: Order) {
    if (!restaurantId) {
      alert("Restaurante não encontrado.")
      return
    }

    const confirmed = window.confirm(
      `Confirmar recebimento do pedido #${order.public_order_number}?`,
    )

    if (!confirmed) return

    try {
      setUpdatingId(order.id)

      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
        })
        .eq("id", order.id)
        .eq("restaurant_id", restaurantId)

      if (error) throw error

      await loadData()
    } catch (error: any) {
      console.error("Erro ao marcar recebimento:", error)
      alert(error?.message || "Não foi possível marcar como recebido.")
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">
              <WalletCards className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-xl font-semibold text-white">
                Recebimentos
              </h1>
              <p className="text-sm text-zinc-500">
                Controle pedidos pagos, pendentes e formas de pagamento.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <p className="text-sm text-zinc-500">Recebido</p>
            <strong className="mt-1 block text-2xl font-semibold text-emerald-400">
              {formatCurrency(totals.received)}
            </strong>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <p className="text-sm text-zinc-500">A receber</p>
            <strong className="mt-1 block text-2xl font-semibold text-yellow-400">
              {formatCurrency(totals.pending)}
            </strong>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <p className="text-sm text-zinc-500">Pedidos pagos</p>
            <strong className="mt-1 block text-2xl font-semibold text-white">
              {totals.paidCount}
            </strong>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <p className="text-sm text-zinc-500">Pendentes</p>
            <strong className="mt-1 block text-2xl font-semibold text-white">
              {totals.pendingCount}
            </strong>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <p className="text-sm text-zinc-500">Ticket médio pago</p>
            <strong className="mt-1 block text-2xl font-semibold text-yellow-400">
              {formatCurrency(averageTicket)}
            </strong>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Filter className="h-4 w-4 text-yellow-400" />
                <h2 className="font-semibold text-white">Filtros</h2>
              </div>

              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                  <div className="space-y-1.5">
                    <Label>Data inicial</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Data final</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as PaymentStatusFilter)
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">Todos</option>
                    <option value="paid">Pagos</option>
                    <option value="pending">Pendentes</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Forma de pagamento</Label>
                  <select
                    value={methodFilter}
                    onChange={(event) =>
                      setMethodFilter(event.target.value as PaymentMethodFilter)
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">Todas</option>
                    <option value="pix">Pix</option>
                    <option value="cash">Dinheiro</option>
                    <option value="card">Cartão</option>
                    <option value="other">Outros</option>
                  </select>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar pedido ou cliente..."
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
              <h2 className="mb-4 font-semibold text-white">
                Recebido por forma
              </h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-[#111111] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-zinc-500">Pix</span>
                  </div>
                  <strong>{formatCurrency(totals.pix)}</strong>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#111111] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">
                      <Banknote className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-zinc-500">
                      Dinheiro
                    </span>
                  </div>
                  <strong>{formatCurrency(totals.cash)}</strong>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#111111] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-zinc-500">Cartão</span>
                  </div>
                  <strong>{formatCurrency(totals.card)}</strong>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#111111] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111111] text-zinc-500">
                      <ReceiptText className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-zinc-500">Outros</span>
                  </div>
                  <strong>{formatCurrency(totals.other)}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold text-white">
                  Lista de recebimentos
                </h2>
                <p className="text-sm text-zinc-500">
                  Pedidos do período selecionado.
                </p>
              </div>

              <span className="rounded-full bg-[#111111] px-3 py-1 text-sm font-medium text-zinc-500">
                {filteredOrders.length} pedidos
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando recebimentos...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
                <ReceiptText className="mx-auto h-9 w-9 text-zinc-500" />
                <p className="mt-2 font-medium text-white">
                  Nenhum recebimento encontrado
                </p>
                <p className="text-sm text-zinc-500">
                  Ajuste os filtros ou aguarde novos pedidos.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-white/10">
                <div className="max-h-[640px] overflow-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="sticky top-0 bg-[#111111] text-left text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Pedido</th>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Forma</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Asaas</th>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-right">Ação</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-white/10 bg-[#0A0A0A]">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-[#111111]">
                          <td className="px-4 py-3">
                            <p className="font-medium text-white">
                              #{order.public_order_number}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {order.order_type || "Pedido"}
                            </p>
                          </td>

                          <td className="px-4 py-3">
                            <p className="font-medium text-white">
                              {order.customer_name}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {order.customer_phone}
                            </p>
                          </td>

                          <td className="px-4 py-3 text-zinc-500">
                            {getPaymentMethodLabel(order.payment_method)}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "rounded-full px-2 py-1 text-xs font-medium",
                                order.payment_status === "paid"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-yellow-400/10 text-yellow-400",
                              )}
                            >
                              {getPaymentStatusLabel(order.payment_status)}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-zinc-500">
                            {order.asaas_payment_status || "-"}
                          </td>

                          <td className="px-4 py-3 text-zinc-500">
                            {formatDateTime(order.created_at)}
                          </td>

                          <td className="px-4 py-3 text-right font-semibold text-white">
                            {formatCurrency(order.total)}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              {order.asaas_invoice_url && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    window.open(order.asaas_invoice_url!, "_blank")
                                  }
                                  className="gap-2"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Link
                                </Button>
                              )}

                              {order.payment_status !== "paid" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => markAsPaid(order)}
                                  disabled={updatingId === order.id}
                                  className="gap-2"
                                >
                                  {updatingId === order.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                  )}
                                  Recebido
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}