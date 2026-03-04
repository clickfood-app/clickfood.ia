"use client"

import { useState } from "react"
import { Plus, X, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Table } from "@/lib/order-types"

interface TableSelectorProps {
  tables: Table[]
  value: string
  onChange: (tableId: string) => void
  onCreateTable: (table: Omit<Table, "id">) => void
}

export default function TableSelector({ tables, value, onChange, onCreateTable }: TableSelectorProps) {
  const [showModal, setShowModal] = useState(false)
  const [newTableNumber, setNewTableNumber] = useState("")
  const [newTableCapacity, setNewTableCapacity] = useState("4")

  const handleCreateTable = () => {
    if (!newTableNumber) return

    onCreateTable({
      number: parseInt(newTableNumber),
      capacity: parseInt(newTableCapacity),
      status: "available",
    })

    setNewTableNumber("")
    setNewTableCapacity("4")
    setShowModal(false)
  }

  const availableTables = tables.filter((t) => t.status === "available" || t.id === value)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">Mesa</label>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--primary))] hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova Mesa
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {availableTables.map((table) => (
          <button
            key={table.id}
            onClick={() => onChange(table.id)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-3 transition-all",
              value === table.id
                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10"
                : "border-border bg-card hover:border-[hsl(var(--primary))]/40"
            )}
          >
            <span className={cn(
              "text-lg font-bold",
              value === table.id ? "text-[hsl(var(--primary))]" : "text-foreground"
            )}>
              {table.number}
            </span>
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Users className="h-3 w-3" />
              {table.capacity}
            </span>
          </button>
        ))}
      </div>

      {availableTables.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma mesa disponivel. Crie uma nova mesa.
        </p>
      )}

      {/* Create Table Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-card border border-border shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="font-semibold text-foreground">Nova Mesa</h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Numero da Mesa
                </label>
                <input
                  type="number"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  placeholder="Ex: 7"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Capacidade (pessoas)
                </label>
                <select
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="2">2 pessoas</option>
                  <option value="4">4 pessoas</option>
                  <option value="6">6 pessoas</option>
                  <option value="8">8 pessoas</option>
                  <option value="10">10 pessoas</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTable}
                disabled={!newTableNumber}
                className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
              >
                Criar Mesa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
