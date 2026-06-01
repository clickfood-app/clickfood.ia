"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  Building2,
  CheckCircle2,
  Edit3,
  Handshake,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  Truck,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type SupplierStatus = "active" | "inactive"

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

function onlyFilled(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export default function FornecedoresPage() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
      .order("created_at", { ascending: false })

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

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return suppliers

    return suppliers.filter((supplier) => {
      return [
        supplier.name,
        supplier.phone,
        supplier.email,
        supplier.document,
        supplier.category,
        supplier.contact_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [search, suppliers])

  const activeSuppliers = suppliers.filter((supplier) => supplier.status === "active")
  const inactiveSuppliers = suppliers.filter((supplier) => supplier.status === "inactive")
  const categoriesCount = new Set(
    suppliers
      .map((supplier) => supplier.category?.trim())
      .filter(Boolean),
  ).size

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
        current.map((supplier) =>
          supplier.id === editingSupplier.id ? (data as Supplier) : supplier,
        ),
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

      setSuppliers((current) => [data as Supplier, ...current])
    }

    setSaving(false)
    closeModal()
  }

  async function toggleSupplierStatus(supplier: Supplier) {
    if (!restaurantId) return

    const nextStatus: SupplierStatus =
      supplier.status === "active" ? "inactive" : "active"

    const { data, error: updateError } = await supabase
      .from("suppliers")
      .update({ status: nextStatus })
      .eq("id", supplier.id)
      .eq("restaurant_id", restaurantId)
      .select("*")
      .single()

    if (updateError) {
      setError("Erro ao alterar status do fornecedor.")
      return
    }

    setSuppliers((current) =>
      current.map((item) => (item.id === supplier.id ? (data as Supplier) : item)),
    )
  }

  return (
    <div className="min-h-[calc(100vh-96px)] bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <Handshake className="h-6 w-6" />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
                Gestão
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                Fornecedores
              </h1>
              <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">
                Cadastre fornecedores, contatos, Pix, condições de pagamento e prepare a base para compras, contas a pagar e estoque.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Novo fornecedor
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-500">Total</p>
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <p className="mt-3 text-3xl font-black text-slate-950">{suppliers.length}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              fornecedores cadastrados
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-500">Ativos</p>
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="mt-3 text-3xl font-black text-slate-950">{activeSuppliers.length}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              disponíveis para compras
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-500">Inativos</p>
              <ToggleLeft className="h-5 w-5 text-slate-400" />
            </div>
            <p className="mt-3 text-3xl font-black text-slate-950">{inactiveSuppliers.length}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              pausados ou antigos
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-500">Categorias</p>
              <Truck className="h-5 w-5 text-orange-500" />
            </div>
            <p className="mt-3 text-3xl font-black text-slate-950">{categoriesCount}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              tipos de fornecimento
            </p>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-950">
                Lista de fornecedores
              </h2>
              <p className="text-sm font-medium text-slate-500">
                Use essa base depois para compras, estoque e contas a pagar.
              </p>
            </div>

            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar fornecedor..."
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </div>

          {error && (
            <div className="mx-4 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando fornecedores...
              </div>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <Handshake className="h-7 w-7" />
              </div>

              <h3 className="mt-4 text-lg font-black text-slate-950">
                Nenhum fornecedor encontrado
              </h3>

              <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
                Cadastre seus principais fornecedores para começar a organizar compras, vencimentos e estoque.
              </p>

              <button
                type="button"
                onClick={openCreateModal}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Cadastrar fornecedor
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-black uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-4">Fornecedor</th>
                    <th className="px-5 py-4">Contato</th>
                    <th className="px-5 py-4">Categoria</th>
                    <th className="px-5 py-4">Pagamento</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Cadastro</th>
                    <th className="px-5 py-4 text-right">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="transition hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-black text-slate-950">{supplier.name}</p>
                          {supplier.document && (
                            <p className="mt-1 text-xs font-semibold text-slate-400">
                              Doc: {supplier.document}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          {supplier.contact_name && (
                            <p className="text-sm font-bold text-slate-700">
                              {supplier.contact_name}
                            </p>
                          )}

                          {supplier.phone && (
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                              <Phone className="h-3.5 w-3.5" />
                              {supplier.phone}
                            </p>
                          )}

                          {supplier.email && (
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                              <Mail className="h-3.5 w-3.5" />
                              {supplier.email}
                            </p>
                          )}

                          {!supplier.contact_name && !supplier.phone && !supplier.email && (
                            <p className="text-xs font-semibold text-slate-400">
                              Não informado
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                          {supplier.category || "Sem categoria"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-700">
                            {supplier.payment_terms || "Não informado"}
                          </p>

                          {supplier.pix_key && (
                            <p className="text-xs font-semibold text-slate-400">
                              Pix: {supplier.pix_key_type || "chave"} cadastrada
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={
                            supplier.status === "active"
                              ? "inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700"
                              : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500"
                          }
                        >
                          {supplier.status === "active" ? "Ativo" : "Inativo"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-slate-500">
                        {formatDate(supplier.created_at)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
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
                            onClick={() => toggleSupplierStatus(supplier)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                            title={supplier.status === "active" ? "Desativar" : "Ativar"}
                          >
                            {supplier.status === "active" ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
                  {editingSupplier ? "Editar" : "Novo"}
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  {editingSupplier ? "Editar fornecedor" : "Cadastrar fornecedor"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="overflow-y-auto p-6">
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
                    placeholder="Ex: Distribuidora Nova Era"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>

                <label>
                  <span className="text-sm font-black text-slate-700">Categoria</span>
                  <input
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, category: event.target.value }))
                    }
                    placeholder="Ex: Bebidas, carnes, embalagens"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>

                <label>
                  <span className="text-sm font-black text-slate-700">Documento</span>
                  <input
                    value={form.document}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, document: event.target.value }))
                    }
                    placeholder="CNPJ ou CPF"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>

                <label>
                  <span className="text-sm font-black text-slate-700">
                    Nome do contato
                  </span>
                  <input
                    value={form.contact_name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        contact_name: event.target.value,
                      }))
                    }
                    placeholder="Ex: Carlos"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>

                <label>
                  <span className="text-sm font-black text-slate-700">Telefone</span>
                  <input
                    value={form.phone}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, phone: event.target.value }))
                    }
                    placeholder="(00) 00000-0000"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>

                <label>
                  <span className="text-sm font-black text-slate-700">E-mail</span>
                  <input
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, email: event.target.value }))
                    }
                    placeholder="fornecedor@email.com"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
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
                    placeholder="Ex: 7 dias, à vista, quinzenal"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
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
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
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
                  <span className="text-sm font-black text-slate-700">Chave Pix</span>
                  <input
                    value={form.pix_key}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, pix_key: event.target.value }))
                    }
                    placeholder="Chave Pix do fornecedor"
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
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
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </label>

                <label className="md:col-span-2">
                  <span className="text-sm font-black text-slate-700">Observações</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    placeholder="Observações sobre entrega, pedido mínimo, contato, negociação..."
                    rows={4}
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
  )
}