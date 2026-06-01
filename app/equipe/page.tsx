"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  Loader2,
  Plus,
  Search,
  Users,
  Wallet,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type StaffMember = {
  id: string
  restaurant_id: string
  name: string
  phone: string | null
  role: string
  worker_type: "fixed" | "freelancer" | "family" | "temporary"
  monthly_salary: number | null
  daily_rate: number | null
  pix_key_type: string | null
  pix_key: string | null
  status: "active" | "inactive"
  notes: string | null
  created_at: string
}

type Restaurant = {
  id: string
  name: string | null
}

const workerTypeLabel: Record<StaffMember["worker_type"], string> = {
  fixed: "Fixo",
  freelancer: "Freelancer",
  family: "Familiar",
  temporary: "Temporário",
}

const statusLabel: Record<StaffMember["status"], string> = {
  active: "Ativo",
  inactive: "Inativo",
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export default function EquipePage() {
  const supabase = createClient()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    role: "",
    worker_type: "fixed" as StaffMember["worker_type"],
    monthly_salary: "",
    daily_rate: "",
    pix_key_type: "",
    pix_key: "",
    notes: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setIsLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("owner_id", user.id)
        .single()

      if (restaurantError) {
        console.error("Erro ao buscar restaurante:", restaurantError)
        return
      }

      setRestaurant(restaurantData)

      const { data: staffData, error: staffError } = await supabase
        .from("staff_members")
        .select("*")
        .eq("restaurant_id", restaurantData.id)
        .order("created_at", { ascending: false })

      if (staffError) {
        console.error("Erro ao buscar equipe:", staffError)
        return
      }

      setStaffMembers((staffData || []) as StaffMember[])
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateStaffMember() {
    if (!restaurant || !formData.name.trim()) return

    try {
      setIsSaving(true)

      const monthlySalary =
        formData.worker_type === "fixed" && formData.monthly_salary
          ? Number(formData.monthly_salary)
          : null

      const dailyRate =
        formData.worker_type !== "fixed" && formData.daily_rate
          ? Number(formData.daily_rate)
          : null

      const { error } = await supabase.from("staff_members").insert({
        restaurant_id: restaurant.id,
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        role: formData.role.trim() || "Atendente",
        worker_type: formData.worker_type,
        monthly_salary: monthlySalary,
        daily_rate: dailyRate,
        pix_key_type: formData.pix_key_type.trim() || null,
        pix_key: formData.pix_key.trim() || null,
        notes: formData.notes.trim() || null,
        status: "active",
      })

      if (error) {
        console.error("Erro ao cadastrar pessoa:", error)
        return
      }

      setFormData({
        name: "",
        phone: "",
        role: "",
        worker_type: "fixed",
        monthly_salary: "",
        daily_rate: "",
        pix_key_type: "",
        pix_key: "",
        notes: "",
      })

      setShowForm(false)
      await loadData()
    } finally {
      setIsSaving(false)
    }
  }

  const filteredStaffMembers = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return staffMembers

    return staffMembers.filter((member) => {
      return (
        member.name.toLowerCase().includes(term) ||
        member.role.toLowerCase().includes(term) ||
        workerTypeLabel[member.worker_type].toLowerCase().includes(term)
      )
    })
  }, [staffMembers, search])

  const activeMembers = staffMembers.filter((member) => member.status === "active")

  const monthlyPayroll = staffMembers.reduce((total, member) => {
    if (member.status !== "active") return total
    return total + Number(member.monthly_salary || 0)
  }, 0)

  const estimatedDailyFreelancerCost = staffMembers.reduce((total, member) => {
    if (member.status !== "active") return total
    return total + Number(member.daily_rate || 0)
  }, 0)

  return (
    <AdminLayout>
      <main className="min-h-screen bg-slate-50 px-4 py-4 text-slate-950 md:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
                Gestão de pessoas
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-tight md:text-2xl">
                Equipe
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Controle funcionários fixos, freelancers, salários, diárias e escala da operação.
              </p>
            </div>

            <Button
              onClick={() => setShowForm((current) => !current)}
              className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova pessoa
            </Button>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Pessoas ativas
                </span>
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <strong className="mt-3 block text-2xl font-bold">
                {activeMembers.length}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Folha fixa
                </span>
                <Wallet className="h-4 w-4 text-emerald-600" />
              </div>
              <strong className="mt-3 block text-2xl font-bold">
                {formatCurrency(monthlyPayroll)}
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Freelas cadastrados
                </span>
                <CalendarDays className="h-4 w-4 text-orange-500" />
              </div>
              <strong className="mt-3 block text-2xl font-bold">
                {
                  staffMembers.filter(
                    (member) => member.worker_type === "freelancer",
                  ).length
                }
              </strong>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Diária estimada
                </span>
                <Wallet className="h-4 w-4 text-violet-600" />
              </div>
              <strong className="mt-3 block text-2xl font-bold">
                {formatCurrency(estimatedDailyFreelancerCost)}
              </strong>
            </div>
          </section>

          {showForm && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold">Cadastrar pessoa</h2>
                  <p className="text-sm text-slate-500">
                    Adicione funcionário fixo, freelancer, familiar ou temporário.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Nome
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Ex: João Silva"
                    className="h-10 rounded-xl"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Telefone
                  </label>
                  <Input
                    value={formData.phone}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="(31) 99999-9999"
                    className="h-10 rounded-xl"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Função
                  </label>
                  <Input
                    value={formData.role}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        role: event.target.value,
                      }))
                    }
                    placeholder="Ex: Cozinha"
                    className="h-10 rounded-xl"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Tipo
                  </label>
                  <select
                    value={formData.worker_type}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        worker_type: event.target.value as StaffMember["worker_type"],
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="fixed">Fixo</option>
                    <option value="freelancer">Freelancer</option>
                    <option value="family">Familiar</option>
                    <option value="temporary">Temporário</option>
                  </select>
                </div>

                {formData.worker_type === "fixed" ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">
                      Salário mensal
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.monthly_salary}
                      onChange={(event) =>
                        setFormData((current) => ({
                          ...current,
                          monthly_salary: event.target.value,
                        }))
                      }
                      placeholder="1800"
                      className="h-10 rounded-xl"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">
                      Valor da diária
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.daily_rate}
                      onChange={(event) =>
                        setFormData((current) => ({
                          ...current,
                          daily_rate: event.target.value,
                        }))
                      }
                      placeholder="100"
                      className="h-10 rounded-xl"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Tipo da chave Pix
                  </label>
                  <Input
                    value={formData.pix_key_type}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        pix_key_type: event.target.value,
                      }))
                    }
                    placeholder="CPF, telefone, e-mail..."
                    className="h-10 rounded-xl"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Chave Pix
                  </label>
                  <Input
                    value={formData.pix_key}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        pix_key: event.target.value,
                      }))
                    }
                    placeholder="Chave Pix para pagamento"
                    className="h-10 rounded-xl"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Observação
                  </label>
                  <Input
                    value={formData.notes}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Ex: Trabalha melhor à noite, só fim de semana..."
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  className="h-10 rounded-xl"
                >
                  Cancelar
                </Button>

                <Button
                  type="button"
                  onClick={handleCreateStaffMember}
                  disabled={isSaving || !formData.name.trim()}
                  className="h-10 rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando
                    </>
                  ) : (
                    "Salvar pessoa"
                  )}
                </Button>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-bold">Pessoas cadastradas</h2>
                <p className="text-sm text-slate-500">
                  Lista compacta da equipe do estabelecimento.
                </p>
              </div>

              <div className="relative w-full md:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar pessoa..."
                  className="h-10 rounded-xl pl-9"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando equipe...
              </div>
            ) : filteredStaffMembers.length === 0 ? (
              <div className="px-4 py-14 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                  <Users className="h-5 w-5 text-slate-500" />
                </div>

                <h3 className="mt-3 text-base font-bold">
                  Nenhuma pessoa cadastrada
                </h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  Cadastre funcionários fixos, freelancers ou familiares para começar a controlar equipe, escala e pagamentos.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-semibold">Nome</th>
                      <th className="px-4 py-3 font-semibold">Função</th>
                      <th className="px-4 py-3 font-semibold">Tipo</th>
                      <th className="px-4 py-3 font-semibold">Valor</th>
                      <th className="px-4 py-3 font-semibold">Pix</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredStaffMembers.map((member) => {
                      const value =
                        member.worker_type === "fixed"
                          ? member.monthly_salary
                          : member.daily_rate

                      return (
                        <tr
                          key={member.id}
                          className="border-b border-slate-100 transition hover:bg-slate-50"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {member.name}
                              </p>
                              {member.phone && (
                                <p className="text-xs text-slate-500">
                                  {member.phone}
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {member.role}
                          </td>

                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "rounded-full px-2.5 py-1 text-xs font-semibold",
                                member.worker_type === "fixed" &&
                                  "bg-blue-50 text-blue-700",
                                member.worker_type === "freelancer" &&
                                  "bg-orange-50 text-orange-700",
                                member.worker_type === "family" &&
                                  "bg-violet-50 text-violet-700",
                                member.worker_type === "temporary" &&
                                  "bg-slate-100 text-slate-700",
                              )}
                            >
                              {workerTypeLabel[member.worker_type]}
                            </Badge>
                          </td>

                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {value ? formatCurrency(Number(value)) : "—"}
                            <span className="ml-1 text-xs font-normal text-slate-500">
                              {member.worker_type === "fixed" ? "/mês" : "/dia"}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {member.pix_key ? (
                              <div>
                                <p className="text-xs font-semibold text-slate-500">
                                  {member.pix_key_type || "Pix"}
                                </p>
                                <p className="max-w-[180px] truncate">
                                  {member.pix_key}
                                </p>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "rounded-full px-2.5 py-1 text-xs font-semibold",
                                member.status === "active"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500",
                              )}
                            >
                              {statusLabel[member.status]}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </AdminLayout>
  )
}