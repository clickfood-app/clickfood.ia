"use client"

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Copy,
  Edit3,
  FileText,
  Filter,
  Handshake,
  KeyRound,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Truck,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"

type SupplierStatus = "active" | "inactive"
type SupplierFilter = "all" | SupplierStatus
type PixFilter = "all" | "with_pix" | "without_pix"
type ViewMode = "list" | "grid"
type SortMode = "name_asc" | "name_desc" | "newest" | "status"

type Supplier = {
  id: string
  restaurant_id: string
  name: string
  phone: string | null
  email: string | null
  document: string | null
  category: string | null
  contact_name: string | null
  payment_terms: string | null
  pix_key_type: string | null
  pix_key: string | null
  notes: string | null
  status: SupplierStatus
  created_at: string
  updated_at: string
}

type SupplierForm = {
  name: string
  phone: string
  email: string
  document: string
  category: string
  contact_name: string
  payment_terms: string
  pix_key_type: string
  pix_key: string
  notes: string
  status: SupplierStatus
}

const emptyForm: SupplierForm = {
  name: "",
  phone: "",
  email: "",
  document: "",
  category: "",
  contact_name: "",
  payment_terms: "",
  pix_key_type: "",
  pix_key: "",
  notes: "",
  status: "active",
}

const pixTypeLabels: Record<string, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Telefone",
  random: "Chave aleatória",
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Não informado"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Não informado"
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function onlyFilled(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getStatusLabel(status: SupplierStatus) {
  return status === "active" ? "Ativo" : "Inativo"
}

function getPixTypeLabel(value: string | null) {
  if (!value) return "Não informado"
  return pixTypeLabels[value] || value
}

function getWhatsappLink(phone: string | null) {
  if (!phone) return null

  const digits = phone.replace(/\D/g, "")

  if (!digits) return null

  const normalized = digits.startsWith("55") ? digits : `55${digits}`

  return `https://wa.me/${normalized}`
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return "CF"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function getPercent(part: number, total: number) {
  if (total === 0) return "0%"
  return `${Math.round((part / total) * 100)}%`
}

function StatCard({
  title,
  value,
  description,
  detail,
  icon: Icon,
  tone,
}: {
  title: string
  value: string | number
  description: string
  detail: string
  icon: typeof Users
  tone: "blue" | "green" | "orange" | "purple" | "amber" | "slate"
}) {
  const tones = {
    blue: {
      wrapper: "bg-blue-50 text-blue-700 ring-blue-100",
      detail: "text-blue-700",
    },
    green: {
      wrapper: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      detail: "text-emerald-700",
    },
    orange: {
      wrapper: "bg-orange-50 text-orange-700 ring-orange-100",
      detail: "text-orange-700",
    },
    purple: {
      wrapper: "bg-violet-50 text-violet-700 ring-violet-100",
      detail: "text-violet-700",
    },
    amber: {
      wrapper: "bg-amber-50 text-amber-700 ring-amber-100",
      detail: "text-amber-700",
    },
    slate: {
      wrapper: "bg-slate-100 text-slate-700 ring-slate-200",
      detail: "text-slate-600",
    },
  }

  return (
    <div className="group rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/80">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ${tones[tone].wrapper}`}
        >
          <Icon className="h-6 w-6" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold leading-5 text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-400">{description}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className={`text-xs font-black ${tones[tone].detail}`}>{detail}</span>
        <span className="text-xs font-bold text-slate-400">Atualizado agora</span>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: SupplierStatus }) {
  return (
    <span
      className={
        status === "active"
          ? "inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100"
          : "inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200"
      }
    >
      {getStatusLabel(status)}
    </span>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-sm font-black text-slate-700">{children}</span>
}

function fieldClassName() {
  return "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
}

export default function FornecedoresPage() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<SupplierFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [pixFilter, setPixFilter] = useState<PixFilter>("all")
  const [sortMode, setSortMode] = useState<SortMode>("name_asc")
  const [viewMode, setViewMode] = useState<ViewMode>("list")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null)
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null)
  const [copiedSupplierId, setCopiedSupplierId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierForm>(emptyForm)

  async function loadSuppliers() {
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

    const { data, error: suppliersError } = await supabase
      .from("suppliers")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("name", { ascending: true })

    if (suppliersError) {
      setError("Erro ao carregar fornecedores.")
      setLoading(false)
      return
    }

    setSuppliers((data || []) as Supplier[])
    setLoading(false)
  }

  useEffect(() => {
    void loadSuppliers()
  }, [])

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        suppliers
          .map((supplier) => supplier.category?.trim())
          .filter(Boolean) as string[],
      ),
    ).sort((a, b) => a.localeCompare(b))
  }, [suppliers])

  const paymentTerms = useMemo(() => {
    return Array.from(
      new Set(
        suppliers
          .map((supplier) => supplier.payment_terms?.trim())
          .filter(Boolean) as string[],
      ),
    ).sort((a, b) => a.localeCompare(b))
  }, [suppliers])

  const activeSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => supplier.status === "active")
  }, [suppliers])

  const suppliersWithPix = useMemo(() => {
    return suppliers.filter((supplier) => supplier.pix_key?.trim()).length
  }, [suppliers])

  const suppliersWithoutPix = useMemo(() => {
    return suppliers.filter((supplier) => !supplier.pix_key?.trim()).length
  }, [suppliers])

  const suppliersWithoutContact = useMemo(() => {
    return suppliers.filter(
      (supplier) => !supplier.phone?.trim() && !supplier.email?.trim(),
    ).length
  }, [suppliers])

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase()

    const filtered = suppliers.filter((supplier) => {
      const matchesStatus =
        statusFilter === "all" ? true : supplier.status === statusFilter

      const matchesCategory =
        categoryFilter === "all" ? true : supplier.category === categoryFilter

      const matchesPayment =
        paymentFilter === "all" ? true : supplier.payment_terms === paymentFilter

      const matchesPix =
        pixFilter === "all"
          ? true
          : pixFilter === "with_pix"
            ? Boolean(supplier.pix_key?.trim())
            : !supplier.pix_key?.trim()

      const matchesSearch = !term
        ? true
        : [
            supplier.name,
            supplier.phone,
            supplier.email,
            supplier.document,
            supplier.category,
            supplier.contact_name,
            supplier.payment_terms,
            supplier.pix_key,
            supplier.notes,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term))

      return (
        matchesStatus &&
        matchesCategory &&
        matchesPayment &&
        matchesPix &&
        matchesSearch
      )
    })

    return [...filtered].sort((a, b) => {
      if (sortMode === "name_desc") return b.name.localeCompare(a.name)
      if (sortMode === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortMode === "status") {
        return a.status.localeCompare(b.status) || a.name.localeCompare(b.name)
      }

      return a.name.localeCompare(b.name)
    })
  }, [categoryFilter, paymentFilter, pixFilter, search, sortMode, statusFilter, suppliers])

  const hasFilters =
    search.trim() ||
    statusFilter !== "all" ||
    categoryFilter !== "all" ||
    paymentFilter !== "all" ||
    pixFilter !== "all"

  const stats = useMemo(() => {
    return [
      {
        title: "Total de fornecedores",
        value: suppliers.length,
        description: "na sua base de compras",
        detail: `${filteredSuppliers.length} visíveis na lista`,
        icon: Users,
        tone: "blue" as const,
      },
      {
        title: "Fornecedores ativos",
        value: activeSuppliers.length,
        description: "liberados para comprar",
        detail: `${getPercent(activeSuppliers.length, suppliers.length)} do total`,
        icon: CheckCircle2,
        tone: "green" as const,
      },
      {
        title: "Sem contato",
        value: suppliersWithoutContact,
        description: "precisam completar cadastro",
        detail:
          suppliersWithoutContact > 0 ? "Precisam revisão" : "Tudo organizado",
        icon: Phone,
        tone: "orange" as const,
      },
      {
        title: "Pix cadastrado",
        value: suppliersWithPix,
        description: "prontos para pagamento",
        detail: `${getPercent(suppliersWithPix, suppliers.length)} do total`,
        icon: KeyRound,
        tone: "purple" as const,
      },
      {
        title: "Sem Pix",
        value: suppliersWithoutPix,
        description: "pagamento incompleto",
        detail: suppliersWithoutPix > 0 ? "Completar cadastro" : "100% completo",
        icon: FileText,
        tone: "amber" as const,
      },
      {
        title: "Categorias",
        value: categories.length,
        description: "grupos de fornecedores",
        detail: categories.length > 0 ? "Base segmentada" : "Sem categorias",
        icon: ShoppingCart,
        tone: "slate" as const,
      },
    ]
  }, [activeSuppliers.length, categories.length, filteredSuppliers.length, suppliers.length, suppliersWithPix, suppliersWithoutContact, suppliersWithoutPix])

  function openCreateModal() {
    setEditingSupplier(null)
    setForm(emptyForm)
    setIsModalOpen(true)
  }

  function openEditModal(supplier: Supplier) {
    setEditingSupplier(supplier)
    setForm({
      name: supplier.name || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      document: supplier.document || "",
      category: supplier.category || "",
      contact_name: supplier.contact_name || "",
      payment_terms: supplier.payment_terms || "",
      pix_key_type: supplier.pix_key_type || "",
      pix_key: supplier.pix_key || "",
      notes: supplier.notes || "",
      status: supplier.status,
    })
    setIsModalOpen(true)
  }

  function closeModal() {
    if (saving) return

    setIsModalOpen(false)
    setEditingSupplier(null)
    setForm(emptyForm)
  }

  function clearFilters() {
    setSearch("")
    setStatusFilter("all")
    setCategoryFilter("all")
    setPaymentFilter("all")
    setPixFilter("all")
  }

  async function handleSaveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!restaurantId) {
      setError("Restaurante não encontrado.")
      return
    }

    if (!form.name.trim()) {
      setError("Informe o nome do fornecedor.")
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      restaurant_id: restaurantId,
      name: form.name.trim(),
      phone: onlyFilled(form.phone),
      email: onlyFilled(form.email),
      document: onlyFilled(form.document),
      category: onlyFilled(form.category),
      contact_name: onlyFilled(form.contact_name),
      payment_terms: onlyFilled(form.payment_terms),
      pix_key_type: onlyFilled(form.pix_key_type),
      pix_key: onlyFilled(form.pix_key),
      notes: onlyFilled(form.notes),
      status: form.status,
    }

    if (editingSupplier) {
      const { data, error: updateError } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", editingSupplier.id)
        .eq("restaurant_id", restaurantId)
        .select("*")
        .single()

      if (updateError) {
        setError("Erro ao atualizar fornecedor.")
        setSaving(false)
        return
      }

      setSuppliers((current) =>
        current
          .map((supplier) =>
            supplier.id === editingSupplier.id ? (data as Supplier) : supplier,
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
    } else {
      const { data, error: insertError } = await supabase
        .from("suppliers")
        .insert(payload)
        .select("*")
        .single()

      if (insertError) {
        setError("Erro ao cadastrar fornecedor.")
        setSaving(false)
        return
      }

      setSuppliers((current) =>
        [data as Supplier, ...current].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      )
    }

    setSaving(false)
    closeModal()
  }

  async function toggleSupplierStatus(supplier: Supplier) {
    if (!restaurantId) return

    const nextStatus: SupplierStatus =
      supplier.status === "active" ? "inactive" : "active"

    setStatusLoadingId(supplier.id)
    setError(null)

    const { data, error: updateError } = await supabase
      .from("suppliers")
      .update({ status: nextStatus })
      .eq("id", supplier.id)
      .eq("restaurant_id", restaurantId)
      .select("*")
      .single()

    if (updateError) {
      setError("Erro ao alterar status do fornecedor.")
      setStatusLoadingId(null)
      return
    }

    setSuppliers((current) =>
      current.map((item) => (item.id === supplier.id ? (data as Supplier) : item)),
    )

    setStatusLoadingId(null)
  }

  async function deleteSupplier(supplier: Supplier) {
    if (!restaurantId) return

    const confirmed = window.confirm(
      `Excluir fornecedor "${supplier.name}"?\n\nSe esse fornecedor já estiver vinculado a compras, o banco pode bloquear a exclusão. Nesse caso, use "Inativar".`,
    )

    if (!confirmed) return

    setDeleteLoadingId(supplier.id)
    setError(null)

    const { error: deleteError } = await supabase
      .from("suppliers")
      .delete()
      .eq("id", supplier.id)
      .eq("restaurant_id", restaurantId)

    if (deleteError) {
      setError(
        "Não foi possível excluir esse fornecedor. Se ele já tiver histórico, inative em vez de excluir.",
      )
      setDeleteLoadingId(null)
      return
    }

    setSuppliers((current) => current.filter((item) => item.id !== supplier.id))
    setDeleteLoadingId(null)
  }

  async function copyPixKey(supplier: Supplier) {
    if (!supplier.pix_key) return

    try {
      await navigator.clipboard.writeText(supplier.pix_key)
      setCopiedSupplierId(supplier.id)

      window.setTimeout(() => {
        setCopiedSupplierId(null)
      }, 1500)
    } catch {
      setError("Não foi possível copiar a chave Pix.")
    }
  }

  function renderSupplierActions(supplier: Supplier) {
    const whatsappLink = getWhatsappLink(supplier.phone)

    return (
      <div className="flex items-center justify-end gap-2">
        {whatsappLink && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700 transition hover:bg-emerald-50"
            title="Chamar no WhatsApp"
          >
            <Phone className="h-4 w-4" />
          </a>
        )}

        {supplier.pix_key && (
          <button
            type="button"
            onClick={() => void copyPixKey(supplier)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-700 transition hover:bg-blue-50"
            title={copiedSupplierId === supplier.id ? "Pix copiado" : "Copiar Pix"}
          >
            <Copy className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => openEditModal(supplier)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          title="Editar"
        >
          <Edit3 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => void toggleSupplierStatus(supplier)}
          disabled={statusLoadingId === supplier.id}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          title={supplier.status === "active" ? "Inativar" : "Ativar"}
        >
          {statusLoadingId === supplier.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : supplier.status === "active" ? (
            <ToggleRight className="h-4 w-4" />
          ) : (
            <ToggleLeft className="h-4 w-4" />
          )}
        </button>

        <button
          type="button"
          onClick={() => void deleteSupplier(supplier)}
          disabled={deleteLoadingId === supplier.id}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          title="Excluir"
        >
          {deleteLoadingId === supplier.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>
    )
  }

  return (
    <AdminLayout>
      <div className="min-h-[calc(100vh-80px)] bg-[#f4f8ff] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1560px] flex-col gap-6">
          <section className="relative overflow-hidden rounded-[28px] border border-blue-100 bg-white px-5 py-5 shadow-sm shadow-blue-100/60 sm:px-7 sm:py-6">
            <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-orange-100/50 blur-3xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-blue-700 ring-1 ring-blue-100">
                  <Handshake className="h-3.5 w-3.5" />
                  Gestão de compras
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Fornecedores
                </h1>

                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500 sm:text-base">
                  Cadastre, organize e acompanhe parceiros de compra, pagamentos,
                  Pix, contatos e base de negociação do restaurante.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Upload className="h-4 w-4" />
                  Importar fornecedores
                </button>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Novo fornecedor
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {stats.map((stat) => (
              <StatCard key={stat.title} {...stat} />
            ))}
          </section>

          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 shadow-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative w-full xl:max-w-xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar fornecedor, contato, Pix, categoria..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtros avançados
                </button>

                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={!hasFilters}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Limpar
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                  Status
                </span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as SupplierFilter)
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="all">Todos</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                  Categoria
                </span>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="all">Todas</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                  Forma de pagamento
                </span>
                <select
                  value={paymentFilter}
                  onChange={(event) => setPaymentFilter(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="all">Todas</option>
                  {paymentTerms.map((paymentTerm) => (
                    <option key={paymentTerm} value={paymentTerm}>
                      {paymentTerm}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-400">
                  Pix
                </span>
                <select
                  value={pixFilter}
                  onChange={(event) => setPixFilter(event.target.value as PixFilter)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="all">Todos</option>
                  <option value="with_pix">Com Pix</option>
                  <option value="without_pix">Sem Pix</option>
                </select>
              </label>
            </div>
          </section>

          <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
            <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-5 py-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-950">
                  Lista de fornecedores
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {filteredSuppliers.length} fornecedor
                  {filteredSuppliers.length === 1 ? "" : "es"} encontrado
                  {filteredSuppliers.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4">
                  <span className="text-sm font-bold text-slate-500">Ordenar por:</span>
                  <select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value as SortMode)}
                    className="bg-transparent text-sm font-black text-slate-700 outline-none"
                  >
                    <option value="name_asc">Nome A-Z</option>
                    <option value="name_desc">Nome Z-A</option>
                    <option value="newest">Mais recentes</option>
                    <option value="status">Status</option>
                  </select>
                </label>

                <div className="flex h-11 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={
                      viewMode === "list"
                        ? "inline-flex h-9 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"
                        : "inline-flex h-9 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-900"
                    }
                    title="Lista"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={
                      viewMode === "grid"
                        ? "inline-flex h-9 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"
                        : "inline-flex h-9 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-900"
                    }
                    title="Cards"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-500 ring-1 ring-slate-200">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  Carregando fornecedores...
                </div>
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                  <Handshake className="h-9 w-9" />
                </div>
                <h3 className="mt-5 text-2xl font-black tracking-tight text-slate-950">
                  {hasFilters
                    ? "Nenhum fornecedor encontrado"
                    : "Cadastre seu primeiro fornecedor"}
                </h3>
                <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">
                  {hasFilters
                    ? "Ajuste a busca ou limpe os filtros para visualizar outros fornecedores da sua base."
                    : "Organize compras, contatos, Pix e condições comerciais para deixar a gestão do restaurante mais profissional."}
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  {hasFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      <Filter className="h-4 w-4" />
                      Limpar filtros
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Cadastrar fornecedor
                  </button>
                </div>
              </div>
            ) : viewMode === "list" ? (
              <div className="divide-y divide-slate-100">
                {filteredSuppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="grid gap-4 bg-white px-5 py-5 transition hover:bg-slate-50/80 lg:grid-cols-[minmax(260px,1.25fr)_minmax(220px,1fr)_minmax(190px,0.75fr)_minmax(190px,0.75fr)_auto] lg:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div
                        className={
                          supplier.status === "active"
                            ? "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-sm font-black text-blue-700 ring-1 ring-blue-100"
                            : "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-500 ring-1 ring-slate-200"
                        }
                      >
                        {getInitials(supplier.name)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-black text-slate-950">
                            {supplier.name}
                          </p>
                          <StatusBadge status={supplier.status} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-slate-500">
                          <span>{supplier.category || "Sem categoria"}</span>
                          <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-flex" />
                          <span className="inline-flex items-center gap-1.5">
                            <UserRound className="h-3.5 w-3.5" />
                            {supplier.contact_name || "Responsável não informado"}
                          </span>
                        </div>
                        {supplier.notes && (
                          <p className="mt-2 line-clamp-1 text-xs font-semibold text-slate-400">
                            {supplier.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm font-semibold text-slate-600">
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" />
                        {supplier.phone || "Telefone não informado"}
                      </p>
                      <p className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span className="truncate">
                          {supplier.email || "E-mail não informado"}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-2 text-sm font-semibold text-slate-600">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                        Pix
                      </p>
                      {supplier.pix_key ? (
                        <div>
                          <p className="flex items-center gap-2 font-black text-slate-800">
                            <KeyRound className="h-4 w-4 text-emerald-600" />
                            {getPixTypeLabel(supplier.pix_key_type)}
                          </p>
                          <button
                            type="button"
                            onClick={() => void copyPixKey(supplier)}
                            className="mt-1 truncate text-xs font-bold text-blue-700 hover:underline"
                          >
                            {copiedSupplierId === supplier.id
                              ? "Chave copiada"
                              : supplier.pix_key}
                          </button>
                        </div>
                      ) : (
                        <p className="font-black text-red-600">Não cadastrado</p>
                      )}
                    </div>

                    <div className="space-y-2 text-sm font-semibold text-slate-600">
                      <p className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        <span>
                          <strong className="text-slate-800">Cadastro:</strong>{" "}
                          {formatDate(supplier.created_at)}
                        </span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-slate-400" />
                        <span>
                          <strong className="text-slate-800">Pagamento:</strong>{" "}
                          {supplier.payment_terms || "Não informado"}
                        </span>
                      </p>
                    </div>

                    <div className="lg:justify-self-end">{renderSupplierActions(supplier)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredSuppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={
                            supplier.status === "active"
                              ? "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-sm font-black text-blue-700 ring-1 ring-blue-100"
                              : "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-500 ring-1 ring-slate-200"
                          }
                        >
                          {getInitials(supplier.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black text-slate-950">
                            {supplier.name}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-500">
                            {supplier.category || "Sem categoria"}
                          </p>
                        </div>
                      </div>

                      <StatusBadge status={supplier.status} />
                    </div>

                    <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                      <p className="flex items-center gap-2">
                        <UserRound className="h-4 w-4 text-slate-400" />
                        {supplier.contact_name || "Responsável não informado"}
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" />
                        {supplier.phone || "Telefone não informado"}
                      </p>
                      <p className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span className="truncate">
                          {supplier.email || "E-mail não informado"}
                        </span>
                      </p>
                      <p className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-slate-400" />
                        {supplier.pix_key
                          ? `Pix ${getPixTypeLabel(supplier.pix_key_type)}`
                          : "Pix não cadastrado"}
                      </p>
                    </div>

                    {supplier.notes && (
                      <p className="mt-4 line-clamp-3 text-sm font-semibold leading-6 text-slate-500">
                        {supplier.notes}
                      </p>
                    )}

                    <div className="mt-4 border-t border-slate-100 pt-4">
                      {renderSupplierActions(supplier)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-950/20">
              <div className="relative overflow-hidden border-b border-slate-200 px-6 py-5">
                <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-blue-100 blur-3xl" />
                <div className="relative flex items-center justify-between gap-4">
                  <div>
                    <p className="inline-flex items-center rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-orange-600 ring-1 ring-orange-100">
                      {editingSupplier ? "Editar cadastro" : "Novo cadastro"}
                    </p>
                    <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                      {editingSupplier ? "Editar fornecedor" : "Cadastrar fornecedor"}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Mantenha contato, pagamento, Pix e observações sempre atualizados.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleSaveSupplier}
                className="max-h-[calc(92vh-118px)] overflow-y-auto p-6"
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="md:col-span-2">
                    <FieldLabel>Nome do fornecedor *</FieldLabel>
                    <input
                      value={form.name}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Ex: Supermercado BH"
                      className={fieldClassName()}
                    />
                  </label>

                  <label>
                    <FieldLabel>Categoria</FieldLabel>
                    <input
                      value={form.category}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          category: event.target.value,
                        }))
                      }
                      placeholder="Ex: Carnes, bebidas, embalagens"
                      className={fieldClassName()}
                    />
                  </label>

                  <label>
                    <FieldLabel>Documento</FieldLabel>
                    <input
                      value={form.document}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          document: event.target.value,
                        }))
                      }
                      placeholder="CNPJ ou CPF"
                      className={fieldClassName()}
                    />
                  </label>

                  <label>
                    <FieldLabel>Responsável</FieldLabel>
                    <input
                      value={form.contact_name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          contact_name: event.target.value,
                        }))
                      }
                      placeholder="Nome do contato"
                      className={fieldClassName()}
                    />
                  </label>

                  <label>
                    <FieldLabel>Telefone</FieldLabel>
                    <input
                      value={form.phone}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, phone: event.target.value }))
                      }
                      placeholder="(00) 00000-0000"
                      className={fieldClassName()}
                    />
                  </label>

                  <label>
                    <FieldLabel>E-mail</FieldLabel>
                    <input
                      value={form.email}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, email: event.target.value }))
                      }
                      placeholder="fornecedor@email.com"
                      className={fieldClassName()}
                    />
                  </label>

                  <label>
                    <FieldLabel>Condição de pagamento</FieldLabel>
                    <input
                      value={form.payment_terms}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          payment_terms: event.target.value,
                        }))
                      }
                      placeholder="Ex: À vista, 7 dias, 30/60"
                      className={fieldClassName()}
                    />
                  </label>

                  <label>
                    <FieldLabel>Status</FieldLabel>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          status: event.target.value as SupplierStatus,
                        }))
                      }
                      className={fieldClassName()}
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </label>

                  <label>
                    <FieldLabel>Tipo de chave Pix</FieldLabel>
                    <select
                      value={form.pix_key_type}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          pix_key_type: event.target.value,
                        }))
                      }
                      className={fieldClassName()}
                    >
                      <option value="">Selecione</option>
                      <option value="cpf">CPF</option>
                      <option value="cnpj">CNPJ</option>
                      <option value="email">E-mail</option>
                      <option value="phone">Telefone</option>
                      <option value="random">Chave aleatória</option>
                    </select>
                  </label>

                  <label>
                    <FieldLabel>Chave Pix</FieldLabel>
                    <input
                      value={form.pix_key}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          pix_key: event.target.value,
                        }))
                      }
                      placeholder="Chave Pix do fornecedor"
                      className={fieldClassName()}
                    />
                  </label>

                  <label className="md:col-span-2">
                    <FieldLabel>Observações</FieldLabel>
                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, notes: event.target.value }))
                      }
                      placeholder="Ex: entrega terça e quinta, pedido mínimo, contato financeiro..."
                      className="mt-2 min-h-[110px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />
                  </label>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {editingSupplier ? "Salvar alterações" : "Cadastrar fornecedor"}
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
