"use client"

import { useMemo, useState } from "react"
import { Plus, Trash2, User, Phone, Mail, FileText, Package } from "lucide-react"
import type { Expense, Supplier } from "@/lib/finance-data"

type SupplierManagerProps = {
  suppliers: Supplier[]
  expenses: Expense[]
  onUpdateSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>
  onCreateSupplier: (payload: {
    name: string
    contact_name?: string
    phone?: string
    email?: string
    notes?: string
  }) => Promise<void>
  onDeleteSupplier: (id: string) => Promise<void>
}

export default function SupplierManager({
  suppliers,
  expenses,
  onCreateSupplier,
  onDeleteSupplier,
}: SupplierManagerProps) {
  const [name, setName] = useState("")
  const [contactName, setContactName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  const supplierStats = useMemo(() => {
    return suppliers.map((supplier) => {
      const relatedExpenses = expenses.filter((e) => e.supplier_id === supplier.id || e.supplier === supplier.name)
      const total = relatedExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0)

      return {
        ...supplier,
        expensesCount: relatedExpenses.length,
        totalAmount: total,
      }
    })
  }, [suppliers, expenses])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      alert("Informe o nome do fornecedor.")
      return
    }

    try {
      setLoading(true)

      await onCreateSupplier({
        name: name.trim(),
        contact_name: contactName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      })

      setName("")
      setContactName("")
      setPhone("")
      setEmail("")
      setNotes("")
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, supplierName: string) {
    const confirmed = window.confirm(`Deseja remover o fornecedor "${supplierName}"?`)
    if (!confirmed) return

    try {
      await onDeleteSupplier(id)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">Fornecedores</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre seus fornecedores para vincular as despesas corretamente.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Nome do fornecedor
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Atacadão Bebidas"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Nome do contato
            </label>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Ex: Carlos"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Telefone
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              E-mail
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@fornecedor.com"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Observações
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Prazo, entrega, condições..."
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {loading ? "Salvando..." : "Adicionar fornecedor"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">Lista de fornecedores</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {suppliers.length} fornecedor{suppliers.length !== 1 ? "es" : ""} cadastrado
            {suppliers.length !== 1 ? "s" : ""}
          </p>
        </div>

        {supplierStats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum fornecedor cadastrado ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {supplierStats.map((supplier) => (
              <div
                key={supplier.id}
                className="rounded-xl border border-border bg-background/40 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-medium text-foreground">{supplier.name}</h4>
                    </div>

                    {supplier.contact_name && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{supplier.contact_name}</span>
                      </div>
                    )}

                    {supplier.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{supplier.phone}</span>
                      </div>
                    )}

                    {supplier.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>{supplier.email}</span>
                      </div>
                    )}

                    {supplier.notes && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>{supplier.notes}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <div className="text-sm text-muted-foreground">
                      <div>
                        Despesas vinculadas:{" "}
                        <span className="font-medium text-foreground">{supplier.expensesCount}</span>
                      </div>
                      <div>
                        Total gasto:{" "}
                        <span className="font-medium text-foreground">
                          {supplier.totalAmount.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(supplier.id, supplier.name)}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-500/30 px-3 text-sm text-red-500 transition-colors hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}