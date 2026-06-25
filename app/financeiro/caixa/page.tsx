"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  ArrowDownCircle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  DollarSign,
  History,
  Loader2,
  ReceiptText,
  RefreshCcw,
  ShoppingBag,
  Smartphone,
  Wallet,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Order = {
  id: string
  public_order_number: string
  customer_name: string
  total: number
  payment_method: string | null
  payment_status: string
  status: string
  created_at: string
}

type AccountPayable = {
  id: string
  description: string
  category: string | null
  amount: number
  due_date: string
  paid_at: string | null
  payment_method: string | null
  status: string
  notes: string | null
  created_at: string
}

type CashClosing = {
  id: string
  restaurant_id: string
  closing_date: string
  gross_revenue: number
  manual_income: number
  expenses: number
  losses: number
  product_cost: number
  estimated_profit: number
  pix_total: number
  cash_total: number
  card_total: number
  orders_count: number
  average_ticket: number
  notes: string | null
  closed_by: string | null
  closed_at: string
  created_at: string
}

function todayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getDayRange(date: string) {
  const start = new Date(`${date}T00:00:00`)
  const end = new Date(start)
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

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`))
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

export default function CaixaDoDiaPage() {
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(todayDate())

  const [orders, setOrders] = useState<Order[]>([])
  const [paidExpenses, setPaidExpenses] = useState<AccountPayable[]>([])
  const [pendingDueToday, setPendingDueToday] = useState<AccountPayable[]>([])
  const [closings, setClosings] = useState<CashClosing[]>([])

  const [manualIncome, setManualIncome] = useState("")
  const [closingNotes, setClosingNotes] = useState("")

  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)

  const selectedClosing = useMemo(() => {
    return closings.find((item) => item.closing_date === selectedDate) || null
  }, [closings, selectedDate])

  const totals = useMemo(() => {
    const grossRevenue = orders.reduce((acc, order) => {
      return acc + toNumber(order.total)
    }, 0)

    const pixTotal = orders.reduce((acc, order) => {
      return normalizePaymentMethod(order.payment_method) === "pix"
        ? acc + toNumber(order.total)
        : acc
    }, 0)

    const cashTotal = orders.reduce((acc, order) => {
      return normalizePaymentMethod(order.payment_method) === "cash"
        ? acc + toNumber(order.total)
        : acc
    }, 0)

    const cardTotal = orders.reduce((acc, order) => {
      return normalizePaymentMethod(order.payment_method) === "card"
        ? acc + toNumber(order.total)
        : acc
    }, 0)

    const otherTotal = orders.reduce((acc, order) => {
      return normalizePaymentMethod(order.payment_method) === "other"
        ? acc + toNumber(order.total)
        : acc
    }, 0)

    const expenses = paidExpenses.reduce((acc, expense) => {
      return acc + toNumber(expense.amount)
    }, 0)

    const dueToday = pendingDueToday.reduce((acc, expense) => {
      return acc + toNumber(expense.amount)
    }, 0)

    const manual = toNumber(manualIncome)
    const averageTicket = orders.length > 0 ? grossRevenue / orders.length : 0
    const estimatedBalance = grossRevenue + manual - expenses

    return {
      grossRevenue,
      pixTotal,
      cashTotal,
      cardTotal,
      otherTotal,
      expenses,
      dueToday,
      manualIncome: manual,
      averageTicket,
      estimatedBalance,
      ordersCount: orders.length,
    }
  }, [manualIncome, orders, paidExpenses, pendingDueToday])

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

      setUserId(user.id)

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .single()

      if (restaurantError || !restaurant) {
        throw new Error("Restaurante não encontrado.")
      }

      setRestaurantId(restaurant.id)

      const { startIso, endIso } = getDayRange(selectedDate)

      const [
        ordersResponse,
        paidExpensesResponse,
        pendingDueTodayResponse,
        closingsResponse,
      ] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id, public_order_number, customer_name, total, payment_method, payment_status, status, created_at",
          )
          .eq("restaurant_id", restaurant.id)
          .eq("payment_status", "paid")
          .gte("created_at", startIso)
          .lt("created_at", endIso)
          .order("created_at", { ascending: false }),

        supabase
          .from("accounts_payable")
          .select(
            "id, description, category, amount, due_date, paid_at, payment_method, status, notes, created_at",
          )
          .eq("restaurant_id", restaurant.id)
          .eq("status", "paid")
          .gte("paid_at", startIso)
          .lt("paid_at", endIso)
          .order("paid_at", { ascending: false }),

        supabase
          .from("accounts_payable")
          .select(
            "id, description, category, amount, due_date, paid_at, payment_method, status, notes, created_at",
          )
          .eq("restaurant_id", restaurant.id)
          .eq("status", "pending")
          .eq("due_date", selectedDate)
          .order("created_at", { ascending: false }),

        supabase
          .from("cash_closings")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("closing_date", { ascending: false })
          .limit(20),
      ])

      if (ordersResponse.error) throw ordersResponse.error
      if (paidExpensesResponse.error) throw paidExpensesResponse.error
      if (pendingDueTodayResponse.error) throw pendingDueTodayResponse.error
      if (closingsResponse.error) throw closingsResponse.error

      const mappedOrders = (ordersResponse.data || []).map((order) => ({
        ...order,
        total: toNumber(order.total),
      }))

      const mappedPaidExpenses = (paidExpensesResponse.data || []).map((expense) => ({
        ...expense,
        amount: toNumber(expense.amount),
      }))

      const mappedPendingDueToday = (pendingDueTodayResponse.data || []).map(
        (expense) => ({
          ...expense,
          amount: toNumber(expense.amount),
        }),
      )

      const mappedClosings = (closingsResponse.data || []).map((closing) => ({
        ...closing,
        gross_revenue: toNumber(closing.gross_revenue),
        manual_income: toNumber(closing.manual_income),
        expenses: toNumber(closing.expenses),
        losses: toNumber(closing.losses),
        product_cost: toNumber(closing.product_cost),
        estimated_profit: toNumber(closing.estimated_profit),
        pix_total: toNumber(closing.pix_total),
        cash_total: toNumber(closing.cash_total),
        card_total: toNumber(closing.card_total),
        average_ticket: toNumber(closing.average_ticket),
      }))

      setOrders(mappedOrders)
      setPaidExpenses(mappedPaidExpenses)
      setPendingDueToday(mappedPendingDueToday)
      setClosings(mappedClosings)

      const existingClosing = mappedClosings.find(
        (closing) => closing.closing_date === selectedDate,
      )

      if (existingClosing) {
        setManualIncome(String(existingClosing.manual_income || ""))
        setClosingNotes(existingClosing.notes || "")
      } else {
        setManualIncome("")
        setClosingNotes("")
      }
    } catch (error: any) {
      console.error("Erro ao carregar caixa:", error)
      alert(error?.message || "Não foi possível carregar o caixa do dia.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  async function handleCloseCash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!restaurantId) {
      alert("Restaurante não encontrado.")
      return
    }

    try {
      setClosing(true)

      const payload = {
        restaurant_id: restaurantId,
        closing_date: selectedDate,
        gross_revenue: totals.grossRevenue,
        manual_income: totals.manualIncome,
        expenses: totals.expenses,
        losses: 0,
        product_cost: 0,
        estimated_profit: totals.estimatedBalance,
        pix_total: totals.pixTotal,
        cash_total: totals.cashTotal,
        card_total: totals.cardTotal,
        orders_count: totals.ordersCount,
        average_ticket: totals.averageTicket,
        notes: closingNotes.trim() || null,
        closed_by: userId,
        closed_at: new Date().toISOString(),
      }

      if (selectedClosing) {
        const { error } = await supabase
          .from("cash_closings")
          .update(payload)
          .eq("id", selectedClosing.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from("cash_closings").insert(payload)

        if (error) throw error
      }

      await loadData()
      alert("Caixa fechado com sucesso.")
    } catch (error: any) {
      console.error("Erro ao fechar caixa:", error)
      alert(error?.message || "Não foi possível fechar o caixa.")
    } finally {
      setClosing(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">
              <Wallet className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-xl font-semibold text-white">
                Caixa do dia
              </h1>
              <p className="text-sm text-zinc-500">
                Acompanhe pedidos pagos, despesas do dia e fechamento de caixa.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="w-full sm:w-[170px]"
            />

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
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <p className="text-sm text-zinc-500">Faturamento pago</p>
            <strong className="mt-1 block text-2xl font-semibold text-emerald-400">
              {formatCurrency(totals.grossRevenue)}
            </strong>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <p className="text-sm text-zinc-500">Pedidos pagos</p>
            <strong className="mt-1 block text-2xl font-semibold text-white">
              {totals.ordersCount}
            </strong>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <p className="text-sm text-zinc-500">Ticket médio</p>
            <strong className="mt-1 block text-2xl font-semibold text-white">
              {formatCurrency(totals.averageTicket)}
            </strong>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <p className="text-sm text-zinc-500">Despesas pagas</p>
            <strong className="mt-1 block text-2xl font-semibold text-yellow-400">
              {formatCurrency(totals.expenses)}
            </strong>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <p className="text-sm text-zinc-500">Saldo estimado</p>
            <strong
              className={cn(
                "mt-1 block text-2xl font-semibold",
                totals.estimatedBalance >= 0 ? "text-yellow-400" : "text-red-600",
              )}
            >
              {formatCurrency(totals.estimatedBalance)}
            </strong>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
              <div className="mb-4">
                <h2 className="font-semibold text-white">
                  Recebimentos por forma
                </h2>
                <p className="text-sm text-zinc-500">
                  Separação dos pedidos pagos no dia.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-[#111111] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-zinc-500">Pix</span>
                  </div>

                  <strong className="text-white">
                    {formatCurrency(totals.pixTotal)}
                  </strong>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#111111] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">
                      <Banknote className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-zinc-500">Dinheiro</span>
                  </div>

                  <strong className="text-white">
                    {formatCurrency(totals.cashTotal)}
                  </strong>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#111111] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-zinc-500">Cartão</span>
                  </div>

                  <strong className="text-white">
                    {formatCurrency(totals.cardTotal)}
                  </strong>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#111111] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111111] text-zinc-500">
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-zinc-500">Outros</span>
                  </div>

                  <strong className="text-white">
                    {formatCurrency(totals.otherTotal)}
                  </strong>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleCloseCash}
              className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm"
            >
              <div className="mb-4">
                <h2 className="font-semibold text-white">
                  Fechamento do caixa
                </h2>
                <p className="text-sm text-zinc-500">
                  Salve o resumo financeiro do dia selecionado.
                </p>
              </div>

              {selectedClosing ? (
                <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
                  Caixa já fechado em {formatDateTime(selectedClosing.closed_at)}.
                  Se salvar novamente, o fechamento será atualizado.
                </div>
              ) : (
                <div className="mb-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-400">
                  Caixa ainda não fechado para esta data.
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Entrada manual extra</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualIncome}
                    onChange={(event) => setManualIncome(event.target.value)}
                    placeholder="Ex: 50.00"
                  />
                  <p className="text-xs text-zinc-500">
                    Use para ajustes manuais, troco inicial ou entrada não vinculada a pedido.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Observações do fechamento</Label>
                  <Textarea
                    value={closingNotes}
                    onChange={(event) => setClosingNotes(event.target.value)}
                    placeholder="Ex: caixa conferido, diferença de troco, observações do dia..."
                    rows={4}
                  />
                </div>

                <div className="rounded-xl bg-[#111111] p-3 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-500">Faturamento pago</span>
                    <strong>{formatCurrency(totals.grossRevenue)}</strong>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-zinc-500">Entrada manual</span>
                    <strong>{formatCurrency(totals.manualIncome)}</strong>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-zinc-500">Despesas pagas</span>
                    <strong className="text-yellow-400">
                      -{formatCurrency(totals.expenses)}
                    </strong>
                  </div>

                  <div className="mt-2 flex justify-between border-t border-white/10 pt-2">
                    <span className="font-medium text-zinc-500">Saldo estimado</span>
                    <strong className="text-yellow-400">
                      {formatCurrency(totals.estimatedBalance)}
                    </strong>
                  </div>
                </div>

                <Button type="submit" disabled={closing} className="w-full gap-2">
                  {closing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {selectedClosing ? "Atualizar fechamento" : "Fechar caixa"}
                </Button>
              </div>
            </form>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-yellow-400" />
                <h2 className="font-semibold text-white">
                  Pedidos pagos do dia
                </h2>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-10 text-sm text-zinc-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando caixa...
                </div>
              ) : orders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
                  <ReceiptText className="mx-auto h-8 w-8 text-zinc-500" />
                  <p className="mt-2 font-medium text-white">
                    Nenhum pedido pago nesta data
                  </p>
                  <p className="text-sm text-zinc-500">
                    Quando pedidos forem pagos, eles aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <div className="max-h-[360px] overflow-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="sticky top-0 bg-[#111111] text-left text-xs uppercase tracking-wide text-zinc-500">
                        <tr>
                          <th className="px-4 py-3">Pedido</th>
                          <th className="px-4 py-3">Cliente</th>
                          <th className="px-4 py-3">Pagamento</th>
                          <th className="px-4 py-3">Data</th>
                          <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-white/10 bg-[#0A0A0A]">
                        {orders.map((order) => (
                          <tr key={order.id} className="hover:bg-[#111111]">
                            <td className="px-4 py-3 font-medium text-white">
                              #{order.public_order_number}
                            </td>

                            <td className="px-4 py-3 text-zinc-500">
                              {order.customer_name}
                            </td>

                            <td className="px-4 py-3 text-zinc-500">
                              {order.payment_method || "Não informado"}
                            </td>

                            <td className="px-4 py-3 text-zinc-500">
                              {formatDateTime(order.created_at)}
                            </td>

                            <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                              {formatCurrency(order.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <ArrowDownCircle className="h-4 w-4 text-yellow-400" />
                  <h2 className="font-semibold text-white">
                    Despesas pagas no dia
                  </h2>
                </div>

                {paidExpenses.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
                    Nenhuma despesa paga nesta data.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paidExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-[#111111] p-3"
                      >
                        <div>
                          <p className="font-medium text-white">
                            {expense.description}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {expense.category || "Sem categoria"} •{" "}
                            {expense.payment_method || "Sem método"}
                          </p>
                        </div>

                        <strong className="text-yellow-400">
                          {formatCurrency(expense.amount)}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-yellow-400" />
                  <h2 className="font-semibold text-white">
                    Contas vencendo hoje
                  </h2>
                </div>

                {pendingDueToday.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
                    Nenhuma conta pendente vencendo nesta data.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingDueToday.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-[#111111] p-3"
                      >
                        <div>
                          <p className="font-medium text-white">
                            {expense.description}
                          </p>
                          <p className="text-xs text-zinc-500">
                            Vence em {formatDate(expense.due_date)}
                          </p>
                        </div>

                        <strong className="text-white">
                          {formatCurrency(expense.amount)}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 rounded-xl bg-yellow-400/10 p-3 text-sm text-yellow-400">
                  Total pendente hoje:{" "}
                  <strong>{formatCurrency(totals.dueToday)}</strong>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <History className="h-4 w-4 text-yellow-400" />
                <h2 className="font-semibold text-white">
                  Histórico de fechamentos
                </h2>
              </div>

              {closings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
                  Nenhum fechamento registrado ainda.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <table className="w-full min-w-[780px] text-sm">
                    <thead className="bg-[#111111] text-left text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Pedidos</th>
                        <th className="px-4 py-3">Faturamento</th>
                        <th className="px-4 py-3">Despesas</th>
                        <th className="px-4 py-3">Saldo estimado</th>
                        <th className="px-4 py-3">Fechado em</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-white/10 bg-[#0A0A0A]">
                      {closings.map((closingItem) => (
                        <tr key={closingItem.id} className="hover:bg-[#111111]">
                          <td className="px-4 py-3 font-medium text-white">
                            {formatDate(closingItem.closing_date)}
                          </td>

                          <td className="px-4 py-3 text-zinc-500">
                            {closingItem.orders_count}
                          </td>

                          <td className="px-4 py-3 text-emerald-400">
                            {formatCurrency(closingItem.gross_revenue)}
                          </td>

                          <td className="px-4 py-3 text-yellow-400">
                            {formatCurrency(closingItem.expenses)}
                          </td>

                          <td className="px-4 py-3 font-semibold text-yellow-400">
                            {formatCurrency(closingItem.estimated_profit)}
                          </td>

                          <td className="px-4 py-3 text-zinc-500">
                            {formatDateTime(closingItem.closed_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}