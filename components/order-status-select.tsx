"use client"

import { useState } from "react"

type OrderStatusSelectProps = {
  orderId: string
  currentStatus: string
  onUpdated?: () => void
}

export default function OrderStatusSelect({
  orderId,
  currentStatus,
  onUpdated,
}: OrderStatusSelectProps) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleChangeStatus = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const previousStatus = status
    const nextStatus = e.target.value

    try {
      setLoading(true)
      setMessage("")
      setStatus(nextStatus)

      const response = await fetch(`/api/pedidos/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.error || "Erro ao atualizar pedido.")
      }

      if (result.saleRegistered) {
        setMessage("Pedido atualizado e venda registrada no histórico.")
      } else {
        setMessage("Pedido atualizado com sucesso.")
      }

      onUpdated?.()
    } catch (error) {
      console.error(error)
      setStatus(previousStatus)
      setMessage("Não foi possível atualizar o status.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        value={status}
        onChange={handleChangeStatus}
        disabled={loading}
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <option value="pending">Pendente</option>
        <option value="em_preparo">Em preparo</option>
        <option value="saiu_para_entrega">Saiu para entrega</option>
        <option value="concluido">Concluído</option>
        <option value="pago">Pago</option>
        <option value="cancelado">Cancelado</option>
      </select>

      {message && <p className="text-xs text-slate-500">{message}</p>}
    </div>
  )
}