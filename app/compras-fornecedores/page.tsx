"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  CircleAlert,
  Loader2,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  X,
} from "lucide-react"

import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"

type Supplier = {
  id: string
  name: string
  category: string | null
  status: "active" | "inactive"
}

type PurchaseStatus = "open" | "closed" | "canceled"
type PaymentStatus = "pending" | "partial" | "paid" | "canceled"

type SupplierPurchase = {
  id: string
  restaurant_id: string
  supplier_id: string | null
  purchase_date: string
  description: string | null
  invoice_number: string | null
  subtotal: number
  discount: number
  total_amount: number
  payment_status: PaymentStatus
  status: PurchaseStatus
  notes: string | null
  created_at: string
  updated_at: string
  suppliers?: {
    name: string | null
    category: string | null
  } | null
}

type SupplierStat = {
  id: string
  name: string
  category: string | null
  total: number
  paid: number
  pending: number
  count: number
  lastPurchaseDate: string | null
}

type ExpenseForm = {
  supplier_id: string
  purchase_date: string
  item_name: string
  amount: string
  payment_status: PaymentStatus
  due_date: string
  notes: string
}

const today = new Date().toISOString().slice(0, 10)

const emptyExpenseForm: ExpenseForm = {
  supplier_id: "",
  purchase_date: today,
  item_name: "",
  amount: "",
  payment_status: "paid",
  due_date: today,
  notes: "",
}

function parseMoney(value: string) {
  const normalized = value.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()
  const number = Number(normalized)

  return Number.isFinite(number) ? number : 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0)
}

function formatDate(value: string | null) {
  if (!value) return "-"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`))
}

function onlyFilled(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getPaymentLabel(status: PaymentStatus) {
  if (status === "paid") return "Pago"
  if (status === "partial") return "Parcial"
  if (status === "canceled") return "Cancelado"
  return "Pendente"
}

function getPaymentBadgeClass(status: PaymentStatus) {
  if (status === "paid") {
    return "rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-400"
  }

  if (status === "partial") {
    return "rounded-full bg-yellow-400/10 px-2.5 py-1 text-xs font-black text-yellow-400"
  }

  if (status === "canceled") {
    return "rounded-full bg-[#111111] px-2.5 py-1 text-xs font-black text-zinc-500"
  }

  return "rounded-full bg-yellow-400/10 px-2.5 py-1 text-xs font-black text-yellow-400"
}

function getPurchaseStatusLabel(status: PurchaseStatus) {
  if (status === "closed") return "Fechada"
  if (status === "canceled") return "Cancelada"
  return "Aberta"
}

function getPurchaseStatusBadgeClass(status: PurchaseStatus) {
  if (status === "closed") {
    return "rounded-full bg-yellow-400/10 px-2.5 py-1 text-xs font-black text-yellow-400"
  }

  if (status === "canceled") {
    return "rounded-full bg-[#111111] px-2.5 py-1 text-xs font-black text-zinc-500"
  }

  return "rounded-full bg-[#111111] px-2.5 py-1 text-xs font-black text-zinc-500"
}

export default function ComprasFornecedoresPage() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchases, setPurchases] = useState<SupplierPurchase[]>([])

  const [search, setSearch] = useState("")
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [supplierSaving, setSupplierSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)

  const [supplierName, setSupplierName] = useState("")
  const [supplierCategory, setSupplierCategory] = useState("")
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(emptyExpenseForm)

  async function loadPageData() {
    setLoading(true)
    setError(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError("Não foi possível identificar o usuário logado.")
      setLoading(false)
      return
    }

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError || !restaurant) {
      setError("Não foi possível encontrar o restaurante vinculado a este usuário.")
      setLoading(false)
      return
    }

    setRestaurantId(restaurant.id)

    const { data: suppliersData, error: suppliersError } = await supabase
      .from("suppliers")
      .select("id, name, category, status")
      .eq("restaurant_id", restaurant.id)
      .order("name", { ascending: true })

    if (suppliersError) {
      setError("Erro ao carregar fornecedores.")
      setLoading(false)
      return
    }

    setSuppliers((suppliersData || []) as Supplier[])

    const { data: purchasesData, error: purchasesError } = await supabase
      .from("supplier_purchases")
      .select(`
        *,
        suppliers (
          name,
          category
        )
      `)
      .eq("restaurant_id", restaurant.id)
      .order("purchase_date", { ascending: false })
      .order("created_at", { ascending: false })

    if (purchasesError) {
      setError("Erro ao carregar compras de fornecedores.")
      setLoading(false)
      return
    }

    setPurchases((purchasesData || []) as SupplierPurchase[])
    setLoading(false)
  }

  useEffect(() => {
    void loadPageData()
  }, [supabase])

  const activeSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => supplier.status === "active")
  }, [suppliers])

  const validPurchases = useMemo(() => {
    return purchases.filter(
      (purchase) =>
        purchase.status !== "canceled" && purchase.payment_status !== "canceled",
    )
  }, [purchases])

  const supplierStats = useMemo<SupplierStat[]>(() => {
    const stats = new Map<string, SupplierStat>()

    activeSuppliers.forEach((supplier) => {
      stats.set(supplier.id, {
        id: supplier.id,
        name: supplier.name,
        category: supplier.category,
        total: 0,
        paid: 0,
        pending: 0,
        count: 0,
        lastPurchaseDate: null,
      })
    })

    validPurchases.forEach((purchase) => {
      if (!purchase.supplier_id) return

      const current =
        stats.get(purchase.supplier_id) ||
        {
          id: purchase.supplier_id,
          name: purchase.suppliers?.name || "Fornecedor sem nome",
          category: purchase.suppliers?.category || null,
          total: 0,
          paid: 0,
          pending: 0,
          count: 0,
          lastPurchaseDate: null,
        }

      const amount = Number(purchase.total_amount || 0)

      current.total += amount
      current.count += 1

      if (purchase.payment_status === "paid") {
        current.paid += amount
      } else {
        current.pending += amount
      }

      if (!current.lastPurchaseDate || purchase.purchase_date > current.lastPurchaseDate) {
        current.lastPurchaseDate = purchase.purchase_date
      }

      stats.set(purchase.supplier_id, current)
    })

    return Array.from(stats.values()).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return a.name.localeCompare(b.name)
    })
  }, [activeSuppliers, validPurchases])

  const filteredSupplierStats = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return supplierStats

    return supplierStats.filter((supplier) => {
      return [supplier.name, supplier.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [supplierStats, search])

  const selectedSupplier = useMemo(() => {
    if (!selectedSupplierId) return null
    return supplierStats.find((supplier) => supplier.id === selectedSupplierId) || null
  }, [selectedSupplierId, supplierStats])

  const filteredPurchases = useMemo(() => {
    const term = search.trim().toLowerCase()

    return validPurchases.filter((purchase) => {
      const matchesSupplier = selectedSupplierId
        ? purchase.supplier_id === selectedSupplierId
        : true

      const matchesSearch = term
        ? [
            purchase.description,
            purchase.notes,
            purchase.suppliers?.name,
            purchase.suppliers?.category,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term))
        : true

      return matchesSupplier && matchesSearch
    })
  }, [validPurchases, selectedSupplierId, search])

  const totals = useMemo(() => {
    const totalSpent = supplierStats.reduce((sum, supplier) => sum + supplier.total, 0)
    const totalPaid = supplierStats.reduce((sum, supplier) => sum + supplier.paid, 0)
    const totalPending = supplierStats.reduce((sum, supplier) => sum + supplier.pending, 0)

    return {
      suppliersCount: supplierStats.length,
      purchasesCount: validPurchases.length,
      totalSpent,
      totalPaid,
      totalPending,
    }
  }, [supplierStats, validPurchases])

  function openSupplierModal() {
    setSupplierName("")
    setSupplierCategory("")
    setError(null)
    setSuccessMessage(null)
    setIsSupplierModalOpen(true)
  }

  function closeSupplierModal() {
    if (supplierSaving) return

    setSupplierName("")
    setSupplierCategory("")
    setIsSupplierModalOpen(false)
  }

  function openExpenseModal(supplierId?: string) {
    setExpenseForm({
      ...emptyExpenseForm,
      supplier_id: supplierId || selectedSupplierId || "",
    })
    setError(null)
    setSuccessMessage(null)
    setIsExpenseModalOpen(true)
  }

  function closeExpenseModal() {
    if (saving) return

    setExpenseForm(emptyExpenseForm)
    setIsExpenseModalOpen(false)
    setError(null)
  }

  async function handleCreateSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!restaurantId) {
      setError("Restaurante não encontrado.")
      return
    }

    const name = supplierName.trim()

    if (!name) {
      setError("Informe o nome do fornecedor.")
      return
    }

    setSupplierSaving(true)
    setError(null)
    setSuccessMessage(null)

    const { data, error: supplierError } = await supabase
      .from("suppliers")
      .insert({
        restaurant_id: restaurantId,
        name,
        category: onlyFilled(supplierCategory),
        status: "active",
      })
      .select("id, name, category, status")
      .single()

    if (supplierError || !data) {
      setError("Erro ao cadastrar fornecedor.")
      setSupplierSaving(false)
      return
    }

    setSuppliers((current) =>
      [...current, data as Supplier].sort((a, b) => a.name.localeCompare(b.name)),
    )
    setSelectedSupplierId(data.id)
    setSuccessMessage("Fornecedor cadastrado com sucesso.")
    setSupplierSaving(false)
    closeSupplierModal()
  }

  async function handleCreateExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!restaurantId) {
      setError("Restaurante não encontrado.")
      return
    }

    if (!expenseForm.supplier_id) {
      setError("Selecione um fornecedor.")
      return
    }

    const itemName = expenseForm.item_name.trim()
    const amount = parseMoney(expenseForm.amount)

    if (!itemName) {
      setError("Informe o que foi comprado.")
      return
    }

    if (amount <= 0) {
      setError("Informe um valor maior que zero.")
      return
    }

    if (expenseForm.payment_status !== "paid" && !expenseForm.due_date) {
      setError("Informe a data de vencimento.")
      return
    }

    setSaving(true)
    setError(null)

    const selectedSupplierForExpense = suppliers.find(
      (supplier) => supplier.id === expenseForm.supplier_id,
    )

    const { data: purchase, error: purchaseError } = await supabase
      .from("supplier_purchases")
      .insert({
        restaurant_id: restaurantId,
        supplier_id: expenseForm.supplier_id,
        purchase_date: expenseForm.purchase_date,
        description: itemName,
        invoice_number: null,
        subtotal: amount,
        discount: 0,
        total_amount: amount,
        payment_status: expenseForm.payment_status,
        status: expenseForm.payment_status === "paid" ? "closed" : "open",
        notes: onlyFilled(expenseForm.notes),
      })
      .select(`
        *,
        suppliers (
          name,
          category
        )
      `)
      .single()

    if (purchaseError || !purchase) {
      setError("Erro ao cadastrar gasto.")
      setSaving(false)
      return
    }

    const { error: itemError } = await supabase.from("supplier_purchase_items").insert({
      restaurant_id: restaurantId,
      purchase_id: purchase.id,
      item_name: itemName,
      quantity: 1,
      unit: "un",
      unit_cost: amount,
      total_cost: amount,
    })

    if (itemError) {
      setError("Gasto criado, mas houve erro ao salvar o item.")
      setSaving(false)
      return
    }

    if (expenseForm.payment_status !== "paid") {
      const { error: payableError } = await supabase.from("accounts_payable").insert({
        restaurant_id: restaurantId,
        supplier_id: expenseForm.supplier_id,
        purchase_id: purchase.id,
        description: `Gasto com ${
          selectedSupplierForExpense?.name || "fornecedor"
        } - ${itemName}`,
        category: "Fornecedor",
        amount,
        due_date: expenseForm.due_date,
        status: "pending",
        notes: onlyFilled(expenseForm.notes),
      })

      if (payableError) {
        setError("Gasto criado, mas houve erro ao gerar a conta a pagar.")
        setSaving(false)
        return
      }
    }

    setPurchases((current) => [purchase as SupplierPurchase, ...current])
    setSelectedSupplierId(expenseForm.supplier_id)
    setSuccessMessage("Gasto cadastrado com sucesso.")
    setSaving(false)
    closeExpenseModal()
  }

  async function markAsPaid(purchase: SupplierPurchase) {
    if (!restaurantId) return

    const { data, error: updateError } = await supabase
      .from("supplier_purchases")
      .update({
        payment_status: "paid",
        status: "closed",
      })
      .eq("id", purchase.id)
      .eq("restaurant_id", restaurantId)
      .select(`
        *,
        suppliers (
          name,
          category
        )
      `)
      .single()

    if (updateError || !data) {
      setError("Erro ao marcar gasto como pago.")
      return
    }

    await supabase
      .from("accounts_payable")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("purchase_id", purchase.id)
      .eq("restaurant_id", restaurantId)

    setPurchases((current) =>
      current.map((item) => (item.id === purchase.id ? (data as SupplierPurchase) : item)),
    )
  }

  async function cancelPurchase(purchase: SupplierPurchase) {
    if (!restaurantId) return

    const { data, error: updateError } = await supabase
      .from("supplier_purchases")
      .update({
        payment_status: "canceled",
        status: "canceled",
      })
      .eq("id", purchase.id)
      .eq("restaurant_id", restaurantId)
      .select(`
        *,
        suppliers (
          name,
          category
        )
      `)
      .single()

    if (updateError || !data) {
      setError("Erro ao cancelar gasto.")
      return
    }

    await supabase
      .from("accounts_payable")
      .update({
        status: "canceled",
      })
      .eq("purchase_id", purchase.id)
      .eq("restaurant_id", restaurantId)

    setPurchases((current) =>
      current.map((item) => (item.id === purchase.id ? (data as SupplierPurchase) : item)),
    )
  }

  return (
    <AdminLayout>
      <div className="min-h-[calc(100vh-96px)] bg-[#111111] px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-400 text-black">
                  <ShoppingBag className="h-5 w-5" />
                </div>

                <div>
                  <h1 className="text-xl font-black tracking-tight text-white">
                    Compras de fornecedores
                  </h1>
                  <p className="text-sm font-medium text-zinc-500">
                    Lance compras rápido e veja quanto gastou com cada fornecedor.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={openSupplierModal}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0A0A0A] px-4 text-sm font-black text-zinc-500 transition hover:bg-[#111111]"
                >
                  <Store className="h-4 w-4" />
                  Novo fornecedor
                </button>

                <button
                  type="button"
                  onClick={() => openExpenseModal()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 text-sm font-black text-black transition hover:bg-yellow-300"
                >
                  <Plus className="h-4 w-4" />
                  Registrar compra
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] px-4 py-3 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                Total gasto
              </p>
              <p className="mt-1 text-lg font-black text-white">
                {formatCurrency(totals.totalSpent)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] px-4 py-3 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                Pago
              </p>
              <p className="mt-1 text-lg font-black text-emerald-400">
                {formatCurrency(totals.totalPaid)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] px-4 py-3 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                Pendente
              </p>
              <p className="mt-1 text-lg font-black text-yellow-400">
                {formatCurrency(totals.totalPending)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] px-4 py-3 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                Fornecedores
              </p>
              <p className="mt-1 text-lg font-black text-white">
                {totals.suppliersCount}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] px-4 py-3 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                Compras
              </p>
              <p className="mt-1 text-lg font-black text-white">
                {totals.purchasesCount}
              </p>
            </div>
          </div>

          {successMessage && (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-400">
              {successMessage}
            </div>
          )}

          {error && !isSupplierModalOpen && !isExpenseModalOpen && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-sm">
            <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-black text-white">
                  Fornecedores
                </h2>
                <p className="text-sm font-medium text-zinc-500">
                  Cards compactos. O histórico fica separado embaixo.
                </p>
              </div>

              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar fornecedor, categoria ou compra..."
                  className="h-10 w-full rounded-xl border border-white/10 bg-[#111111] pl-10 pr-4 text-sm font-semibold outline-none transition placeholder:text-zinc-500 focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:ring-4 focus:ring-yellow-400/20"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[240px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm font-bold text-zinc-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Carregando fornecedores...
                </div>
              </div>
            ) : filteredSupplierStats.length === 0 ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#111111] text-zinc-500">
                  <CircleAlert className="h-6 w-6" />
                </div>

                <h3 className="mt-4 text-lg font-black text-white">
                  Nenhum fornecedor encontrado
                </h3>

                <p className="mt-2 max-w-md text-sm font-medium text-zinc-500">
                  Cadastre um fornecedor para começar a lançar compras.
                </p>
              </div>
            ) : (
              <div className="space-y-2 p-3">
  {filteredSupplierStats.map((supplier) => {
    const isSelected = selectedSupplierId === supplier.id

    return (
      <article
        key={supplier.id}
        className={
          isSelected
            ? "grid gap-3 rounded-xl border-2 border-yellow-400/30 bg-yellow-400/10 p-3 shadow-sm lg:grid-cols-[1.4fr_120px_90px_120px_120px_100px_190px] lg:items-center"
            : "grid gap-3 rounded-xl border border-white/10 bg-[#0A0A0A] p-3 shadow-sm transition hover:bg-[#111111] lg:grid-cols-[1.4fr_120px_90px_120px_120px_100px_190px] lg:items-center"
        }
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111111] text-zinc-500">
            <Store className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-white">
              {supplier.name}
            </h3>
            <p className="truncate text-xs font-bold text-zinc-500">
              {supplier.category || "Sem categoria"}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase text-zinc-500">
            Total
          </p>
          <p className="text-sm font-black text-white">
            {formatCurrency(supplier.total)}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase text-zinc-500">
            Compras
          </p>
          <p className="text-sm font-black text-white">
            {supplier.count}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase text-zinc-500">
            Pago
          </p>
          <p className="text-sm font-black text-emerald-400">
            {formatCurrency(supplier.paid)}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase text-zinc-500">
            Pendente
          </p>
          <p className="text-sm font-black text-yellow-400">
            {formatCurrency(supplier.pending)}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase text-zinc-500">
            Última
          </p>
          <p className="text-sm font-black text-zinc-500">
            {formatDate(supplier.lastPurchaseDate)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button
            type="button"
            onClick={() => openExpenseModal(supplier.id)}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-yellow-400 px-3 text-xs font-black text-black transition hover:bg-yellow-300"
          >
            <Plus className="h-3.5 w-3.5" />
            Gasto
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedSupplierId((current) =>
                current === supplier.id ? null : supplier.id,
              )
            }
            className="h-9 rounded-lg border border-white/10 bg-[#0A0A0A] px-3 text-xs font-black text-zinc-500 transition hover:bg-[#111111]"
          >
            {isSelected ? "Ver todas" : "Compras"}
          </button>
        </div>
      </article>
    )
  })}
</div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-sm">
            <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-black text-white">
                  {selectedSupplier ? `Compras de ${selectedSupplier.name}` : "Compras lançadas"}
                </h2>
                <p className="text-sm font-medium text-zinc-500">
                  {selectedSupplier
                    ? "Mostrando apenas as compras deste fornecedor."
                    : "Histórico geral das compras cadastradas."}
                </p>
              </div>

              {selectedSupplier && (
                <button
                  type="button"
                  onClick={() => setSelectedSupplierId(null)}
                  className="rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-2 text-sm font-black text-zinc-500 transition hover:bg-[#111111]"
                >
                  Limpar filtro
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex min-h-[220px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm font-bold text-zinc-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Carregando compras...
                </div>
              </div>
            ) : filteredPurchases.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#111111] text-zinc-500">
                  <ReceiptText className="h-6 w-6" />
                </div>

                <h3 className="mt-4 text-lg font-black text-white">
                  Nenhuma compra lançada
                </h3>

                <p className="mt-2 max-w-md text-sm font-medium text-zinc-500">
                  Clique em “Registrar compra” ou “+ Gasto” dentro de um fornecedor.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {filteredPurchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="grid gap-3 px-5 py-4 transition hover:bg-[#111111] lg:grid-cols-[120px_1fr_150px_170px_170px]"
                  >
                    <div>
                      <p className="text-[11px] font-black uppercase text-zinc-500">
                        Data
                      </p>
                      <p className="mt-1 text-sm font-black text-zinc-500">
                        {formatDate(purchase.purchase_date)}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">
                        {purchase.description || "Gasto sem descrição"}
                      </p>
                      <p className="mt-1 truncate text-xs font-bold text-zinc-500">
                        {purchase.suppliers?.name || "Fornecedor não informado"}
                        {purchase.suppliers?.category
                          ? ` • ${purchase.suppliers.category}`
                          : ""}
                      </p>

                      {purchase.notes && (
                        <p className="mt-1 text-xs font-semibold text-zinc-500">
                          {purchase.notes}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-[11px] font-black uppercase text-zinc-500">
                        Valor
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        {formatCurrency(Number(purchase.total_amount || 0))}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-start gap-2">
                      <span className={getPaymentBadgeClass(purchase.payment_status)}>
                        {getPaymentLabel(purchase.payment_status)}
                      </span>

                      <span className={getPurchaseStatusBadgeClass(purchase.status)}>
                        {getPurchaseStatusLabel(purchase.status)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                      {purchase.payment_status !== "paid" &&
                        purchase.payment_status !== "canceled" && (
                          <button
                            type="button"
                            onClick={() => markAsPaid(purchase)}
                            className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-400 transition hover:bg-emerald-500/15"
                          >
                            Marcar pago
                          </button>
                        )}

                      {purchase.status !== "canceled" && (
                        <button
                          type="button"
                          onClick={() => cancelPurchase(purchase)}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-2 text-xs font-black text-zinc-500 transition hover:bg-[#111111]"
                        >
                          <Trash2 className="h-3 w-3" />
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {isSupplierModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505] px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-[#0A0A0A] shadow-2xl">
              <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
                    Novo fornecedor
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white">
                    Cadastrar fornecedor
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeSupplierModal}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111111] text-zinc-500 transition hover:bg-[#111111] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSupplier} className="space-y-4 p-6">
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                    {error}
                  </div>
                )}

                <label className="block">
                  <span className="text-sm font-black text-zinc-500">Nome</span>
                  <input
                    value={supplierName}
                    onChange={(event) => setSupplierName(event.target.value)}
                    placeholder="Ex: Supermercado BH"
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-4 text-sm font-semibold outline-none transition placeholder:text-zinc-500 focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:ring-4 focus:ring-yellow-400/20"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-black text-zinc-500">Categoria</span>
                  <input
                    value={supplierCategory}
                    onChange={(event) => setSupplierCategory(event.target.value)}
                    placeholder="Ex: Mercado, açougue, bebidas"
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-4 text-sm font-semibold outline-none transition placeholder:text-zinc-500 focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:ring-4 focus:ring-yellow-400/20"
                  />
                </label>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeSupplierModal}
                    disabled={supplierSaving}
                    className="rounded-xl border border-white/10 bg-[#0A0A0A] px-5 py-3 text-sm font-black text-zinc-500 transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={supplierSaving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-3 text-sm font-black text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {supplierSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isExpenseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505] px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-400">
                    Lançamento rápido
                  </p>
                  <h2 className="mt-1 text-lg font-black text-white">
                    Registrar compra
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeExpenseModal}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111111] text-zinc-500 transition hover:bg-[#111111] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateExpense} className="p-5">
                {error && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <label className="block">
                    <span className="text-sm font-black text-zinc-500">Fornecedor</span>
                    <select
                      value={expenseForm.supplier_id}
                      onChange={(event) =>
                        setExpenseForm((current) => ({
                          ...current,
                          supplier_id: event.target.value,
                        }))
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:ring-4 focus:ring-yellow-400/20"
                    >
                      <option value="">Selecione</option>
                      {activeSuppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                    <label className="block">
                      <span className="text-sm font-black text-zinc-500">
                        O que comprou?
                      </span>
                      <input
                        value={expenseForm.item_name}
                        onChange={(event) =>
                          setExpenseForm((current) => ({
                            ...current,
                            item_name: event.target.value,
                          }))
                        }
                        placeholder="Ex: Carne, bebida, embalagem..."
                        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-3 text-sm font-semibold outline-none transition placeholder:text-zinc-500 focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:ring-4 focus:ring-yellow-400/20"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-black text-zinc-500">Valor</span>
                      <input
                        value={expenseForm.amount}
                        onChange={(event) =>
                          setExpenseForm((current) => ({
                            ...current,
                            amount: event.target.value,
                          }))
                        }
                        placeholder="0,00"
                        inputMode="decimal"
                        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-3 text-sm font-black outline-none transition placeholder:text-zinc-500 focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:ring-4 focus:ring-yellow-400/20"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-black text-zinc-500">Data</span>
                      <input
                        type="date"
                        value={expenseForm.purchase_date}
                        onChange={(event) =>
                          setExpenseForm((current) => ({
                            ...current,
                            purchase_date: event.target.value,
                          }))
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:ring-4 focus:ring-yellow-400/20"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-black text-zinc-500">Pagamento</span>
                      <select
                        value={expenseForm.payment_status}
                        onChange={(event) =>
                          setExpenseForm((current) => ({
                            ...current,
                            payment_status: event.target.value as PaymentStatus,
                          }))
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:ring-4 focus:ring-yellow-400/20"
                      >
                        <option value="paid">Pago</option>
                        <option value="pending">Pendente</option>
                        <option value="partial">Parcial</option>
                      </select>
                    </label>
                  </div>

                  {expenseForm.payment_status !== "paid" && (
                    <label className="block">
                      <span className="text-sm font-black text-zinc-500">Vencimento</span>
                      <input
                        type="date"
                        value={expenseForm.due_date}
                        onChange={(event) =>
                          setExpenseForm((current) => ({
                            ...current,
                            due_date: event.target.value,
                          }))
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:ring-4 focus:ring-yellow-400/20"
                      />
                    </label>
                  )}

                  <label className="block">
                    <span className="text-sm font-black text-zinc-500">Observação</span>
                    <input
                      value={expenseForm.notes}
                      onChange={(event) =>
                        setExpenseForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Opcional"
                      className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-3 text-sm font-semibold outline-none transition placeholder:text-zinc-500 focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:ring-4 focus:ring-yellow-400/20"
                    />
                  </label>
                </div>

                <div className="mt-5 flex items-center justify-between rounded-xl bg-[#111111] px-4 py-3">
                  <span className="text-sm font-bold text-zinc-500">Total</span>
                  <span className="text-lg font-black text-white">
                    {formatCurrency(parseMoney(expenseForm.amount))}
                  </span>
                </div>

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeExpenseModal}
                    disabled={saving}
                    className="rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-2.5 text-sm font-black text-zinc-500 transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-black text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar compra
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}