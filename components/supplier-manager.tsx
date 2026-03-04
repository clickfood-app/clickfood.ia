"use client"

import { useState } from "react"
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Supplier, Expense } from "@/lib/finance-data"
import { computeFinalAmount, formatBRL } from "@/lib/finance-data"
import { cn } from "@/lib/utils"

interface SupplierManagerProps {
  suppliers: Supplier[]
  expenses: Expense[]
  onUpdateSuppliers: (suppliers: Supplier[]) => void
}

function generateId() {
  return `sup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function SupplierCard({
  supplier,
  totalSpent,
  onEdit,
  onDelete,
}: {
  supplier: Supplier
  totalSpent: number
  onEdit: (supplier: Supplier) => void
  onDelete: (id: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(supplier.name)
  const [editContact, setEditContact] = useState(supplier.contact)
  const [editNote, setEditNote] = useState(supplier.note)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function saveEdit() {
    if (!editName.trim()) return
    onEdit({ ...supplier, name: editName.trim(), contact: editContact.trim(), note: editNote.trim() })
    setIsEditing(false)
  }

  function cancelEdit() {
    setEditName(supplier.name)
    setEditContact(supplier.contact)
    setEditNote(supplier.note)
    setIsEditing(false)
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4 transition-shadow hover:shadow-sm">
      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Nome
            </label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-1 h-8 w-full rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Contato
            </label>
            <input
              value={editContact}
              onChange={(e) => setEditContact(e.target.value)}
              placeholder="Telefone ou e-mail"
              className="mt-1 h-8 w-full rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Observacao
            </label>
            <input
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Nota opcional"
              className="mt-1 h-8 w-full rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={saveEdit}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 text-xs font-medium text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90"
            >
              <Check className="h-3.5 w-3.5" />
              Salvar
            </button>
            <button
              onClick={cancelEdit}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary))/0.1] text-[hsl(var(--primary))]">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <h4 className="text-sm font-semibold text-foreground">{supplier.name}</h4>
                {supplier.contact && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {supplier.contact}
                  </p>
                )}
              </div>
            </div>
            {confirmDelete ? (
              <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
                <span className="text-xs text-red-600 font-medium">Remover?</span>
                <button
                  onClick={() => onDelete(supplier.id)}
                  className="flex h-7 items-center rounded-md bg-red-500 px-2.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
                >
                  Sim
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex h-7 items-center rounded-md border border-border px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Nao
                </button>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none"
                    aria-label="Acoes do fornecedor"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onClick={() => setIsEditing(true)}
                    className="cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setConfirmDelete(true)}
                    className="cursor-pointer text-muted-foreground focus:text-red-600 focus:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remover
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {supplier.note && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <StickyNote className="h-3 w-3 flex-shrink-0" />
              {supplier.note}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total gasto
            </span>
            <span className={cn(
              "text-sm font-bold tabular-nums",
              totalSpent > 0 ? "text-foreground" : "text-muted-foreground"
            )}>
              {formatBRL(totalSpent)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

export default function SupplierManager({
  suppliers,
  expenses,
  onUpdateSuppliers,
}: SupplierManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [newContact, setNewContact] = useState("")
  const [newNote, setNewNote] = useState("")
  const [isExpanded, setIsExpanded] = useState(true)

  // Calculate total spent per supplier from expenses
  function getSupplierTotal(supplierName: string) {
    return expenses
      .filter((e) => e.supplier === supplierName)
      .reduce((sum, e) => sum + computeFinalAmount(e.amount, e.discountPercent), 0)
  }

  function addSupplier() {
    if (!newName.trim()) return
    const newSupplier: Supplier = {
      id: generateId(),
      name: newName.trim(),
      contact: newContact.trim(),
      note: newNote.trim(),
    }
    onUpdateSuppliers([...suppliers, newSupplier])
    setNewName("")
    setNewContact("")
    setNewNote("")
    setIsAdding(false)
  }

  function editSupplier(updated: Supplier) {
    onUpdateSuppliers(suppliers.map((s) => (s.id === updated.id ? updated : s)))
  }

  function deleteSupplier(id: string) {
    onUpdateSuppliers(suppliers.filter((s) => s.id !== id))
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2"
        >
          <div>
            <h2 className="text-base font-semibold text-foreground text-left">
              Gestao de Fornecedores
            </h2>
            <p className="text-sm text-muted-foreground text-left">
              {suppliers.length} fornecedor{suppliers.length !== 1 ? "es" : ""} cadastrado{suppliers.length !== 1 ? "s" : ""}
            </p>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <button
          onClick={() => { setIsAdding(true); setIsExpanded(true) }}
          disabled={isAdding}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Novo Fornecedor
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-6">
          {/* Add form */}
          {isAdding && (
            <div className="mb-5 rounded-lg border border-dashed border-[hsl(var(--primary))] bg-[hsl(var(--primary))/0.04] p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--primary))]">
                Novo Fornecedor
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Nome *
                  </label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome do fornecedor"
                    className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Contato
                  </label>
                  <input
                    value={newContact}
                    onChange={(e) => setNewContact(e.target.value)}
                    placeholder="Telefone ou e-mail"
                    className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Observacao
                  </label>
                  <input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Nota opcional"
                    className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={addSupplier}
                  disabled={!newName.trim()}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <Check className="h-4 w-4" />
                  Cadastrar
                </button>
                <button
                  onClick={() => {
                    setIsAdding(false)
                    setNewName("")
                    setNewContact("")
                    setNewNote("")
                  }}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Supplier grid */}
          {suppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Building2 className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm font-medium">Nenhum fornecedor cadastrado</p>
              <p className="mt-1 text-xs">
                Adicione fornecedores para acompanhar os gastos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {suppliers.map((supplier) => (
                <SupplierCard
                  key={supplier.id}
                  supplier={supplier}
                  totalSpent={getSupplierTotal(supplier.name)}
                  onEdit={editSupplier}
                  onDelete={deleteSupplier}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
