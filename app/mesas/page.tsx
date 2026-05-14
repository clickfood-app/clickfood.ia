"use client"

import React, { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import AdminLayout from "@/components/admin-layout"
import { QRCodeSVG } from "qrcode.react"
import {
  Clock,
  QrCode,
  Receipt,
  Wallet,
  X,
} from "lucide-react"
import { formatPrice } from "@/lib/menu-data"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const TOTAL_MESAS = 20

type Restaurant = {
  id: string
  name: string
  slug: string | null
}

type OrderItem = {
  id: string
  order_id: string
  product_id: string | null
  product_name: string | null
  quantity: number
  unit_price: number | string | null
  total_price: number | string | null
}

type TableOrder = {
  id: string
  restaurant_id: string
  table_id: string | null
  public_order_number: string | null
  customer_name: string | null
  customer_phone: string | null
  status: string | null
  payment_status: string | null
  payment_method: string | null
  total: number | string | null
  created_at: string
  items?: OrderItem[]
}

const OPEN_TABLE_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "delivering",
  "out_for_delivery",
]

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message

  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }

    return (
      [maybeError.message, maybeError.details, maybeError.hint, maybeError.code]
        .filter(Boolean)
        .join(" • ") || fallback
    )
  }

  return fallback
}

function normalizePaymentStatus(status: "paid" | "pending") {
  return status
}

export default function MesasPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [activeOrders, setActiveOrders] = useState<TableOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [qrCodeModal, setQrCodeModal] = useState<{
    isOpen: boolean
    mesa: number | null
  }>({
    isOpen: false,
    mesa: null,
  })

  const [comandaModal, setComandaModal] = useState<{
    isOpen: boolean
    order: TableOrder | null
    mesa: number | null
  }>({
    isOpen: false,
    order: null,
    mesa: null,
  })

  const [isClosing, setIsClosing] = useState(false)

  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""

  const fetchData = async () => {
    try {
      setIsLoading(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError

      if (!user) {
        setRestaurant(null)
        setActiveOrders([])
        return
      }

      const { data: restData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name, slug")
        .eq("owner_id", user.id)
        .single()

      if (restaurantError) throw restaurantError

      if (!restData) {
        setRestaurant(null)
        setActiveOrders([])
        return
      }

      setRestaurant(restData as Restaurant)

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(
          `
          id,
          restaurant_id,
          table_id,
          public_order_number,
          customer_name,
          customer_phone,
          status,
          payment_status,
          payment_method,
          total,
          created_at,
          items:order_items (
            id,
            order_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total_price
          )
        `
        )
        .eq("restaurant_id", restData.id)
        .not("table_id", "is", null)
        .in("status", OPEN_TABLE_STATUSES)
        .order("created_at", { ascending: false })

      if (ordersError) {
        console.error("Erro ao buscar comandas:", {
          message: ordersError.message,
          details: ordersError.details,
          hint: ordersError.hint,
          code: ordersError.code,
        })

        throw ordersError
      }

      setActiveOrders((ordersData || []) as TableOrder[])
    } catch (error) {
      console.error("Erro ao carregar mesas:", error)

      toast({
        title: "Erro ao carregar mesas",
        description: getErrorMessage(error, "Não foi possível carregar as comandas."),
        variant: "destructive",
      })

      setActiveOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()

    const interval = window.setInterval(() => {
      void fetchData()
    }, 10000)

    return () => {
      window.clearInterval(interval)
    }
  }, [supabase])

  const handleEncerrarComanda = async (paymentStatus: "paid" | "pending") => {
    if (!comandaModal.order) return

    try {
      setIsClosing(true)

      const { error } = await supabase
        .from("orders")
        .update({
          status: "delivered",
          payment_status: normalizePaymentStatus(paymentStatus),
          delivered_at: new Date().toISOString(),
        })
        .eq("id", comandaModal.order.id)

      if (error) throw error

      toast({
        title: "Mesa encerrada",
        description: `A comanda da Mesa ${comandaModal.mesa} foi finalizada com sucesso.`,
      })

      setComandaModal({ isOpen: false, order: null, mesa: null })
      await fetchData()
    } catch (error) {
      console.error("Erro ao encerrar comanda:", error)

      toast({
        title: "Erro ao encerrar",
        description: getErrorMessage(error, "Não foi possível encerrar a comanda."),
        variant: "destructive",
      })
    } finally {
      setIsClosing(false)
    }
  }

  const mesas = Array.from({ length: TOTAL_MESAS }, (_, index) => index + 1)

  return (
    <AdminLayout title="Gestão de Mesas">
      <div className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-black text-slate-950">Mesas</h1>
              <p className="mt-1 text-sm text-slate-500">
                Gere QR Codes e acompanhe comandas abertas no salão.
              </p>
            </div>

            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm" />
                Livre
              </div>

              <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <span className="h-3 w-3 rounded-full bg-rose-500 shadow-sm" />
                Ocupada
              </div>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500">
            Carregando mesas...
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
            {mesas.map((numeroMesa) => {
              const orderForTable = activeOrders.find(
                (order) => String(order.table_id) === String(numeroMesa)
              )

              const isOcupada = Boolean(orderForTable)

              return (
                <div
                  key={numeroMesa}
                  onClick={() => {
                    if (isOcupada && orderForTable) {
                      setComandaModal({
                        isOpen: true,
                        order: orderForTable,
                        mesa: numeroMesa,
                      })
                      return
                    }

                    toast({
                      title: `Mesa ${numeroMesa} livre`,
                      description: "Nenhuma comanda aberta nesta mesa.",
                    })
                  }}
                  className={cn(
                    "relative flex h-40 cursor-pointer flex-col items-center justify-center rounded-xl border p-5 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md",
                    isOcupada
                      ? "border-rose-200 bg-rose-50"
                      : "border-slate-200 bg-white hover:border-emerald-300"
                  )}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setQrCodeModal({ isOpen: true, mesa: numeroMesa })
                    }}
                    className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                    title="Ver QR Code"
                  >
                    <QrCode className="h-4 w-4" />
                  </button>

                  <h3
                    className={cn(
                      "mb-1 text-3xl font-black",
                      isOcupada ? "text-rose-900" : "text-slate-800"
                    )}
                  >
                    {numeroMesa}
                  </h3>

                  {isOcupada && orderForTable ? (
                    <>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-rose-600">
                        Ocupada
                      </p>

                      <p className="mb-2 text-sm font-black text-rose-700">
                        {formatPrice(Number(orderForTable.total || 0))}
                      </p>

                      <div className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white">
                        <Receipt className="h-3.5 w-3.5" />
                        Ver Comanda
                      </div>
                    </>
                  ) : (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                      Livre
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {qrCodeModal.isOpen && restaurant && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
            <button
              type="button"
              onClick={() => setQrCodeModal({ isOpen: false, mesa: null })}
              className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="mb-2 text-2xl font-black text-slate-900">
              Mesa {qrCodeModal.mesa}
            </h2>

            <p className="mb-6 text-sm text-slate-500">
              Imprima este QR Code para o cliente acessar o cardápio desta mesa.
            </p>

            <div className="mb-6 inline-block rounded-2xl border-2 border-slate-100 bg-white p-4 shadow-sm">
              <QRCodeSVG
                value={`${baseUrl}/cardapio/${restaurant.slug}?mesa=${qrCodeModal.mesa}`}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white transition hover:bg-blue-700"
            >
              Imprimir QR Code
            </button>
          </div>
        </div>
      )}

      {comandaModal.isOpen && comandaModal.order && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Comanda - Mesa {comandaModal.mesa}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Cliente:{" "}
                  <span className="font-semibold text-slate-700">
                    {comandaModal.order.customer_name || "Não informado"}
                  </span>
                </p>

                {comandaModal.order.public_order_number && (
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Pedido #{comandaModal.order.public_order_number}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setComandaModal({ isOpen: false, order: null, mesa: null })
                }
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">
                Itens consumidos
              </h3>

              <div className="space-y-3">
                {comandaModal.order.items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        <span className="mr-2 text-blue-600">{item.quantity}x</span>
                        {item.product_name || "Item do cardápio"}
                      </p>
                    </div>

                    <span className="font-bold text-slate-700">
                      {formatPrice(Number(item.total_price || 0))}
                    </span>
                  </div>
                ))}

                {(!comandaModal.order.items ||
                  comandaModal.order.items.length === 0) && (
                  <p className="py-4 text-center text-sm text-slate-500">
                    Nenhum item detalhado encontrado nesta comanda.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-b-3xl border-t border-slate-100 bg-white p-6 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
              <div className="mb-6 flex items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-wider text-slate-500">
                  Total a cobrar
                </span>

                <span className="text-3xl font-black text-rose-600">
                  {formatPrice(Number(comandaModal.order.total || 0))}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleEncerrarComanda("paid")}
                  disabled={isClosing}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 font-bold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  <Wallet className="h-4 w-4" />
                  Pagar e Encerrar
                </button>

                <button
                  type="button"
                  onClick={() => handleEncerrarComanda("pending")}
                  disabled={isClosing}
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-3.5 font-bold text-white transition hover:bg-slate-900 disabled:opacity-50"
                >
                  <Clock className="h-4 w-4" />
                  Encerrar Pendente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}