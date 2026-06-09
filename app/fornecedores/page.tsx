"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Copy,
  Edit3,
  Filter,
  Handshake,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Truck,
  X,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"

type SupplierStatus = "active" | "inactive"
type SupplierFilter = "all" | SupplierStatus

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

export default function FornecedoresPage() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<SupplierFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState("all")

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

  const activeSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => supplier.status === "active")
  }, [suppliers])

  const suppliersWithPix = useMemo(() => {
    return suppliers.filter((supplier) => supplier.pix_key?.trim()).length
  }, [suppliers])

  const suppliersWithoutContact = useMemo(() => {
    return suppliers.filter(
      (supplier) => !supplier.phone?.trim() && !supplier.email?.trim(),
    ).length
  }, [suppliers])

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase()

    return suppliers.filter((supplier) => {
      const matchesStatus =
        statusFilter === "all" ? true : supplier.status === statusFilter

      const matchesCategory =
        categoryFilter === "all" ? true : supplier.category === categoryFilter

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
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term))

      return matchesStatus && matchesCategory && matchesSearch
    })
  }, [categoryFilter, search, statusFilter, suppliers])

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

  return (
    <AdminLayout>
      <div className="min-h-[calc(100vh-80px)] bg-slate-100 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-100 pb-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-orange-500">
                <Handshake className="h-4 w-4" />
                Gestão de compras
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                Fornecedores
              </h1>
              <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
                Cadastro operacional para compras, contas a pagar, Pix, contatos e
                base de negociação com fornecedores.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Novo fornecedor
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Total
                </span>
                <Building2 className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {suppliers.length}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                fornecedores cadastrados
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Ativos
                </span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {activeSuppliers.length}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                liberados para compras
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Sem contato
                </span>
                <Phone className="h-4 w-4 text-orange-500" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {suppliersWithoutContact}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                precisam completar cadastro
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Pix cadastrado
                </span>
                <Truck className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {suppliersWithPix}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                prontos para pagamento
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-950">
                    Base de fornecedores
                  </h2>
                  <p className="text-sm font-semibold text-slate-500">
                    Controle em formato de lista, sem painel lateral poluindo a tela.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative w-full sm:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar fornecedor, contato, Pix..."
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                  >
                    <Filter className="h-4 w-4" />
                    Limpar
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-[180px_minmax(0,1fr)]">
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as SupplierFilter)
                  }
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="all">Todos os status</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="all">Todas as categorias</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm font-black text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Carregando fornecedores...
                </div>
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <Handshake className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-lg font-black text-slate-950">
                  Nenhum fornecedor encontrado
                </h3>
                <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
                  Cadastre fornecedores para organizar compras, contatos, Pix e
                  condições comerciais.
                </p>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Cadastrar fornecedor
                </button>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[1120px] text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Fornecedor</th>
                        <th className="px-4 py-3">Contato</th>
                        <th className="px-4 py-3">Categoria</th>
                        <th className="px-4 py-3">Pagamento</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Cadastro</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSuppliers.map((supplier) => {
                        const whatsappLink = getWhatsappLink(supplier.phone)

                        return (
                          <tr
                            key={supplier.id}
                            className="bg-white transition hover:bg-slate-50"
                          >
                            <td className="px-4 py-4 align-top">
                              <p className="font-black text-slate-950">
                                {supplier.name}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-400">
                                {supplier.document || "Documento não informado"}
                              </p>
                              {supplier.notes && (
                                <p className="mt-2 line-clamp-2 max-w-md text-xs font-semibold leading-5 text-slate-500">
                                  {supplier.notes}
                                </p>
                              )}
                            </td>

                            <td className="px-4 py-4 align-top">
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-slate-700">
                                  {supplier.contact_name || "Responsável não informado"}
                                </p>
                                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                  <Phone className="h-3.5 w-3.5" />
                                  {supplier.phone || "Telefone não informado"}
                                </p>
                                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                  <Mail className="h-3.5 w-3.5" />
                                  {supplier.email || "E-mail não informado"}
                                </p>
                              </div>
                            </td>

                            <td className="px-4 py-4 align-top">
                              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                                {supplier.category || "Sem categoria"}
                              </span>
                            </td>

                            <td className="px-4 py-4 align-top">
                              <p className="text-sm font-bold text-slate-700">
                                {supplier.payment_terms || "Não informado"}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-400">
                                {supplier.pix_key
                                  ? `Pix: ${getPixTypeLabel(supplier.pix_key_type)}`
                                  : "Pix não cadastrado"}
                              </p>
                            </td>

                            <td className="px-4 py-4 align-top">
                              <span
                                className={
                                  supplier.status === "active"
                                    ? "inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700"
                                    : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500"
                                }
                              >
                                {getStatusLabel(supplier.status)}
                              </span>
                            </td>

                            <td className="px-4 py-4 align-top text-sm font-bold text-slate-500">
                              {formatDate(supplier.created_at)}
                            </td>

                            <td className="px-4 py-4 align-top">
                              <div className="flex justify-end gap-2">
                                {whatsappLink && (
                                  <a
                                    href={whatsappLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700 transition hover:bg-emerald-50"
                                    title="Chamar no WhatsApp"
                                  >
                                    <Phone className="h-4 w-4" />
                                  </a>
                                )}

                                {supplier.pix_key && (
                                  <button
                                    type="button"
                                    onClick={() => void copyPixKey(supplier)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                    title={
                                      copiedSupplierId === supplier.id
                                        ? "Pix copiado"
                                        : "Copiar Pix"
                                    }
                                  >
                                    <Copy className="h-4 w-4" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => openEditModal(supplier)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                  title="Editar"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void toggleSupplierStatus(supplier)}
                                  disabled={statusLoadingId === supplier.id}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                                  title={
                                    supplier.status === "active" ? "Inativar" : "Ativar"
                                  }
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
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  title="Excluir"
                                >
                                  {deleteLoadingId === supplier.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-slate-100 lg:hidden">
                  {filteredSuppliers.map((supplier) => {
                    const whatsappLink = getWhatsappLink(supplier.phone)

                    return (
                      <div key={supplier.id} className="bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-black text-slate-950">
                              {supplier.name}
                            </p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {supplier.category || "Sem categoria"}
                            </p>
                          </div>
                          <span
                            className={
                              supplier.status === "active"
                                ? "shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700"
                                : "shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500"
                            }
                          >
                            {getStatusLabel(supplier.status)}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                          <p>
                            <strong className="text-slate-900">Contato:</strong>{" "}
                            {supplier.contact_name || "Não informado"}
                          </p>
                          <p>
                            <strong className="text-slate-900">Telefone:</strong>{" "}
                            {supplier.phone || "Não informado"}
                          </p>
                          <p>
                            <strong className="text-slate-900">Pagamento:</strong>{" "}
                            {supplier.payment_terms || "Não informado"}
                          </p>
                          <p>
                            <strong className="text-slate-900">Pix:</strong>{" "}
                            {supplier.pix_key
                              ? getPixTypeLabel(supplier.pix_key_type)
                              : "Não cadastrado"}
                          </p>
                        </div>

                        {supplier.notes && (
                          <p className="mt-3 line-clamp-3 text-xs font-semibold leading-5 text-slate-500">
                            {supplier.notes}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {whatsappLink && (
                            <a
                              href={whatsappLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700"
                            >
                              <Phone className="h-4 w-4" />
                              WhatsApp
                            </a>
                          )}

                          {supplier.pix_key && (
                            <button
                              type="button"
                              onClick={() => void copyPixKey(supplier)}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700"
                            >
                              <Copy className="h-4 w-4" />
                              {copiedSupplierId === supplier.id ? "Copiado" : "Pix"}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openEditModal(supplier)}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"
                          >
                            <Edit3 className="h-4 w-4" />
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => void toggleSupplierStatus(supplier)}
                            disabled={statusLoadingId === supplier.id}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {statusLoadingId === supplier.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : supplier.status === "active" ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                            {supplier.status === "active" ? "Inativar" : "Ativar"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void deleteSupplier(supplier)}
                            disabled={deleteLoadingId === supplier.id}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deleteLoadingId === supplier.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Excluir
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">
                    {editingSupplier ? "Editar" : "Novo cadastro"}
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    {editingSupplier ? "Editar fornecedor" : "Cadastrar fornecedor"}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={handleSaveSupplier}
                className="max-h-[calc(92vh-86px)] overflow-y-auto p-5"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="md:col-span-2">
                    <span className="text-sm font-black text-slate-700">
                      Nome do fornecedor *
                    </span>
                    <input
                      value={form.name}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Ex: Supermercado BH"
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />
                  </label>

                  <label>
                    <span className="text-sm font-black text-slate-700">
                      Categoria
                    </span>
                    <input
                      value={form.category}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          category: event.target.value,
                        }))
                      }
                      placeholder="Ex: Carnes, bebidas, embalagens"
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />
                  </label>

                  <label>
                    <span className="text-sm font-black text-slate-700">
                      Documento
                    </span>
                    <input
                      value={form.document}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          document: event.target.value,
                        }))
                      }
                      placeholder="CNPJ ou CPF"
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />
                  </label>

                  <label>
                    <span className="text-sm font-black text-slate-700">
                      Responsável
                    </span>
                    <input
                      value={form.contact_name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          contact_name: event.target.value,
                        }))
                      }
                      placeholder="Nome do contato"
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />
                  </label>

                  <label>
                    <span className="text-sm font-black text-slate-700">
                      Telefone
                    </span>
                    <input
                      value={form.phone}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, phone: event.target.value }))
                      }
                      placeholder="(00) 00000-0000"
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />
                  </label>

                  <label>
                    <span className="text-sm font-black text-slate-700">
                      E-mail
                    </span>
                    <input
                      value={form.email}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, email: event.target.value }))
                      }
                      placeholder="fornecedor@email.com"
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />
                  </label>

                  <label>
                    <span className="text-sm font-black text-slate-700">
                      Condição de pagamento
                    </span>
                    <input
                      value={form.payment_terms}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          payment_terms: event.target.value,
                        }))
                      }
                      placeholder="Ex: À vista, 7 dias, quinzenal"
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />
                  </label>

                  <label>
                    <span className="text-sm font-black text-slate-700">
                      Tipo de chave Pix
                    </span>
                    <select
                      value={form.pix_key_type}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          pix_key_type: event.target.value,
                        }))
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    >
                      <option value="">Não informado</option>
                      <option value="cpf">CPF</option>
                      <option value="cnpj">CNPJ</option>
                      <option value="email">E-mail</option>
                      <option value="phone">Telefone</option>
                      <option value="random">Chave aleatória</option>
                    </select>
                  </label>

                  <label>
                    <span className="text-sm font-black text-slate-700">
                      Chave Pix
                    </span>
                    <input
                      value={form.pix_key}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          pix_key: event.target.value,
                        }))
                      }
                      placeholder="Chave Pix do fornecedor"
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />
                  </label>

                  <label>
                    <span className="text-sm font-black text-slate-700">Status</span>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          status: event.target.value as SupplierStatus,
                        }))
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </label>

                  <label className="md:col-span-2">
                    <span className="text-sm font-black text-slate-700">
                      Observações
                    </span>
                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, notes: event.target.value }))
                      }
                      placeholder="Pedido mínimo, dias de entrega, condições negociadas, responsável, observações internas..."
                      rows={4}
                      className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />
                  </label>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
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
