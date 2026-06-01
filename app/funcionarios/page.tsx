"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  Banknote,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCcw,
  Search,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type WorkerType = "fixed" | "freelancer"
type StaffStatus = "active" | "inactive"
type PaymentStatus = "pending" | "paid"
type PaymentType = "salary" | "daily" | "bonus" | "advance" | "other"

type StaffMember = {
  id: string
  restaurant_id: string
  name: string
  phone: string | null
  role: string
  worker_type: WorkerType | string
  monthly_salary: number | null
  daily_rate: number | null
  pix_key_type: string | null
  pix_key: string | null
  status: StaffStatus | string
  notes: string | null
  created_at: string
  updated_at: string
}

type StaffPayment = {
  id: string
  restaurant_id: string
  staff_id: string
  payment_type: PaymentType | string
  reference_month: string | null
  amount: number
  status: PaymentStatus | string
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  payment_method: string | null
  payment_reference: string | null
  staff_daily_entry_id: string | null
  accounts_payable_id: string | null
}

const workerTypeLabels: Record<string, string> = {
  fixed: "Fixo",
  freelancer: "Freelancer",
}

const statusLabels: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
}

const paymentTypeLabels: Record<string, string> = {
  salary: "Salário",
  daily: "Diária",
  bonus: "Bônus",
  advance: "Adiantamento",
  other: "Outro",
}

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function currentMonthReference() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")

  return `${year}-${month}`
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "")
}

export default function FuncionariosPage() {
  const supabase = createClient()

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [payments, setPayments] = useState<StaffPayment[]>([])
  const [loading, setLoading] = useState(true)

  const [savingStaff, setSavingStaff] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [generatingPayroll, setGeneratingPayroll] = useState(false)

  const [search, setSearch] = useState("")

  const [showStaffForm, setShowStaffForm] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)

  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState("")
  const [workerType, setWorkerType] = useState<WorkerType>("fixed")
  const [monthlySalary, setMonthlySalary] = useState("")
  const [dailyRate, setDailyRate] = useState("")
  const [pixKeyType, setPixKeyType] = useState("")
  const [pixKey, setPixKey] = useState("")
  const [notes, setNotes] = useState("")

  const [paymentStaffId, setPaymentStaffId] = useState("")
  const [paymentType, setPaymentType] = useState<PaymentType>("salary")
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentReferenceMonth, setPaymentReferenceMonth] = useState(
    currentMonthReference(),
  )
  const [paymentMethod, setPaymentMethod] = useState("pix")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("pending")

  const activeStaffMembers = useMemo(() => {
    return staffMembers.filter((member) => member.status === "active")
  }, [staffMembers])

  const staffById = useMemo(() => {
    return staffMembers.reduce<Record<string, StaffMember>>((acc, member) => {
      acc[member.id] = member
      return acc
    }, {})
  }, [staffMembers])

  const filteredStaffMembers = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return staffMembers

    return staffMembers.filter((member) => {
      return (
        member.name.toLowerCase().includes(term) ||
        member.role.toLowerCase().includes(term) ||
        member.phone?.toLowerCase().includes(term)
      )
    })
  }, [search, staffMembers])

  const pendingPayments = useMemo(() => {
    return payments.filter((payment) => payment.status === "pending")
  }, [payments])

  const paidPayments = useMemo(() => {
    return payments.filter((payment) => payment.status === "paid")
  }, [payments])

  const totals = useMemo(() => {
    const monthStart = `${currentMonthReference()}-01`

    const nextMonth = new Date(`${monthStart}T00:00:00`)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    const nextMonthStart = nextMonth.toISOString().slice(0, 10)

    const fixedPayroll = staffMembers.reduce((acc, member) => {
      if (member.status === "active" && member.worker_type === "fixed") {
        return acc + toNumber(member.monthly_salary)
      }

      return acc
    }, 0)

    const pendingTotal = payments.reduce((acc, payment) => {
      if (payment.status === "pending") {
        return acc + toNumber(payment.amount)
      }

      return acc
    }, 0)

    const freelancerPending = payments.reduce((acc, payment) => {
      if (payment.status === "pending" && payment.payment_type === "daily") {
        return acc + toNumber(payment.amount)
      }

      return acc
    }, 0)

    const paidThisMonth = payments.reduce((acc, payment) => {
      const paidAt = payment.paid_at?.slice(0, 10)

      if (
        payment.status === "paid" &&
        paidAt &&
        paidAt >= monthStart &&
        paidAt < nextMonthStart
      ) {
        return acc + toNumber(payment.amount)
      }

      return acc
    }, 0)

    return {
      activeCount: staffMembers.filter((member) => member.status === "active")
        .length,
      fixedPayroll,
      freelancerPending,
      pendingTotal,
      paidThisMonth,
    }
  }, [payments, staffMembers])

  async function loadData() {
    try {
      setLoading(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error("Usuário não autenticado.")
      }

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .single()

      if (restaurantError || !restaurant) {
        throw new Error("Restaurante não encontrado.")
      }

      setRestaurantId(restaurant.id)

      const [staffResponse, paymentsResponse] = await Promise.all([
        supabase
          .from("staff_members")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("staff_payments")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false })
          .limit(80),
      ])

      if (staffResponse.error) throw staffResponse.error
      if (paymentsResponse.error) throw paymentsResponse.error

      setStaffMembers(
        (staffResponse.data || []).map((member) => ({
          ...member,
          monthly_salary:
            member.monthly_salary === null
              ? null
              : toNumber(member.monthly_salary),
          daily_rate:
            member.daily_rate === null ? null : toNumber(member.daily_rate),
        })),
      )

      setPayments(
        (paymentsResponse.data || []).map((payment) => ({
          ...payment,
          amount: toNumber(payment.amount),
        })),
      )
    } catch (error) {
      console.error(error)
      alert("Não foi possível carregar a gestão de funcionários.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetStaffForm() {
    setEditingStaffId(null)
    setName("")
    setPhone("")
    setRole("")
    setWorkerType("fixed")
    setMonthlySalary("")
    setDailyRate("")
    setPixKeyType("")
    setPixKey("")
    setNotes("")
  }

  function closeStaffForm() {
    resetStaffForm()
    setShowStaffForm(false)
  }

  function resetPaymentForm() {
    setPaymentStaffId("")
    setPaymentType("salary")
    setPaymentAmount("")
    setPaymentReferenceMonth(currentMonthReference())
    setPaymentMethod("pix")
    setPaymentNotes("")
    setPaymentStatus("pending")
  }

  function closePaymentForm() {
    resetPaymentForm()
    setShowPaymentForm(false)
  }

  function handleOpenNewStaffForm() {
    resetStaffForm()
    setShowStaffForm(true)
  }

  function handleEditStaff(member: StaffMember) {
    setEditingStaffId(member.id)
    setName(member.name)
    setPhone(member.phone || "")
    setRole(member.role)
    setWorkerType((member.worker_type as WorkerType) || "fixed")
    setMonthlySalary(
      member.monthly_salary !== null && member.monthly_salary !== undefined
        ? String(member.monthly_salary)
        : "",
    )
    setDailyRate(
      member.daily_rate !== null && member.daily_rate !== undefined
        ? String(member.daily_rate)
        : "",
    )
    setPixKeyType(member.pix_key_type || "")
    setPixKey(member.pix_key || "")
    setNotes(member.notes || "")
    setShowStaffForm(true)
  }

  function fillPaymentFromStaff(member: StaffMember) {
    const isFreelancer = member.worker_type === "freelancer"

    setPaymentStaffId(member.id)
    setPaymentType(isFreelancer ? "daily" : "salary")
    setPaymentAmount(
      isFreelancer
        ? String(member.daily_rate || "")
        : String(member.monthly_salary || ""),
    )
    setPaymentReferenceMonth(currentMonthReference())
    setPaymentStatus("pending")
    setPaymentMethod("pix")
    setPaymentNotes(isFreelancer ? "Diária lançada pela aba Funcionários." : "")
    setShowPaymentForm(true)
  }

  function getPaymentCategory(
    paymentTypeValue: PaymentType | string,
    member: StaffMember,
  ) {
    if (paymentTypeValue === "salary") return "Funcionários / Fixos"
    if (paymentTypeValue === "daily") return "Funcionários / Freelancers"
    if (paymentTypeValue === "advance") return "Funcionários / Adiantamentos"
    if (paymentTypeValue === "bonus") return "Funcionários / Bônus"

    return member.worker_type === "freelancer"
      ? "Funcionários / Freelancers"
      : "Funcionários / Outros"
  }

  function getPaymentCategoryLabel(payment: StaffPayment) {
    if (payment.payment_type === "salary") return "Funcionários / Fixos"
    if (payment.payment_type === "daily") return "Funcionários / Freelancers"
    if (payment.payment_type === "advance") return "Funcionários / Adiantamentos"
    if (payment.payment_type === "bonus") return "Funcionários / Bônus"

    return "Funcionários / Outros"
  }

  function getPaymentDescription(
    paymentTypeValue: PaymentType | string,
    member: StaffMember,
    referenceMonthDate: string | null,
  ) {
    const label = paymentTypeLabels[paymentTypeValue] || "Pagamento"

    const reference = referenceMonthDate
      ? new Intl.DateTimeFormat("pt-BR", {
          month: "2-digit",
          year: "numeric",
        }).format(new Date(`${referenceMonthDate}T00:00:00`))
      : null

    return reference
      ? `${label} - ${member.name} - ${reference}`
      : `${label} - ${member.name}`
  }

  function getMonthEndDate(referenceMonth: string) {
    const date = new Date(`${referenceMonth}-01T00:00:00`)
    date.setMonth(date.getMonth() + 1)
    date.setDate(0)

    return date.toISOString().slice(0, 10)
  }

  async function createLinkedAccountsPayable(params: {
    paymentId: string
    member: StaffMember
    paymentTypeValue: PaymentType | string
    referenceMonthDate: string | null
    amount: number
    status: PaymentStatus | string
    paymentMethodValue: string | null
    notesValue: string | null
    dueDate: string
  }) {
    const {
      paymentId,
      member,
      paymentTypeValue,
      referenceMonthDate,
      amount,
      status,
      paymentMethodValue,
      notesValue,
      dueDate,
    } = params

    const { data: payable, error: payableError } = await supabase
      .from("accounts_payable")
      .insert({
        restaurant_id: member.restaurant_id,
        description: getPaymentDescription(
          paymentTypeValue,
          member,
          referenceMonthDate,
        ),
        category: getPaymentCategory(paymentTypeValue, member),
        amount,
        due_date: dueDate,
        status,
        paid_at: status === "paid" ? new Date().toISOString() : null,
        payment_method: status === "paid" ? paymentMethodValue : null,
        notes: notesValue,
        staff_payment_id: paymentId,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (payableError) throw payableError

    const { error: updatePaymentError } = await supabase
      .from("staff_payments")
      .update({
        accounts_payable_id: payable.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId)

    if (updatePaymentError) throw updatePaymentError
  }

  async function handleSubmitStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!restaurantId) {
      alert("Restaurante não encontrado.")
      return
    }

    if (!name.trim()) {
      alert("Informe o nome.")
      return
    }

    if (!role.trim()) {
      alert("Informe o cargo/função.")
      return
    }

    try {
      setSavingStaff(true)

      const payload = {
        restaurant_id: restaurantId,
        name: name.trim(),
        phone: normalizePhone(phone) || null,
        role: role.trim(),
        worker_type: workerType,
        monthly_salary: workerType === "fixed" ? toNumber(monthlySalary) : null,
        daily_rate: workerType === "freelancer" ? toNumber(dailyRate) : null,
        pix_key_type: pixKeyType.trim() || null,
        pix_key: pixKey.trim() || null,
        notes: notes.trim() || null,
        status: "active",
        updated_at: new Date().toISOString(),
      }

      if (editingStaffId) {
        const { error } = await supabase
          .from("staff_members")
          .update(payload)
          .eq("id", editingStaffId)

        if (error) throw error
      } else {
        const { error } = await supabase.from("staff_members").insert(payload)

        if (error) throw error
      }

      closeStaffForm()
      await loadData()
    } catch (error: any) {
      console.error("Erro ao salvar funcionário:", error)
      alert(error?.message || "Não foi possível salvar o funcionário.")
    } finally {
      setSavingStaff(false)
    }
  }

  async function updateStaffStatus(member: StaffMember, nextStatus: StaffStatus) {
    try {
      const { error } = await supabase
        .from("staff_members")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", member.id)

      if (error) throw error

      await loadData()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "Não foi possível atualizar o funcionário.")
    }
  }

  async function handleSubmitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!restaurantId) {
      alert("Restaurante não encontrado.")
      return
    }

    if (!paymentStaffId) {
      alert("Selecione uma pessoa.")
      return
    }

    const parsedAmount = toNumber(paymentAmount)

    if (parsedAmount <= 0) {
      alert("Informe um valor válido.")
      return
    }

    try {
      setSavingPayment(true)

      const selectedStaff = staffById[paymentStaffId]

      if (!selectedStaff) {
        throw new Error("Funcionário não encontrado.")
      }

      const referenceMonthDate = paymentReferenceMonth
        ? `${paymentReferenceMonth}-01`
        : null
      const paidAt = paymentStatus === "paid" ? new Date().toISOString() : null
      const cleanNotes = paymentNotes.trim() || null
      const cleanPaymentMethod = paymentMethod.trim() || null

      const { data: createdPayment, error } = await supabase
        .from("staff_payments")
        .insert({
          restaurant_id: restaurantId,
          staff_id: paymentStaffId,
          payment_type: paymentType,
          reference_month: referenceMonthDate,
          amount: parsedAmount,
          status: paymentStatus,
          paid_at: paidAt,
          payment_method: cleanPaymentMethod,
          payment_reference: null,
          notes: cleanNotes,
        })
        .select("id")
        .single()

      if (error) throw error

      await createLinkedAccountsPayable({
        paymentId: createdPayment.id,
        member: selectedStaff,
        paymentTypeValue: paymentType,
        referenceMonthDate,
        amount: parsedAmount,
        status: paymentStatus,
        paymentMethodValue: cleanPaymentMethod,
        notesValue: cleanNotes,
        dueDate: todayDate(),
      })

      closePaymentForm()
      await loadData()
    } catch (error: any) {
      console.error("Erro ao registrar pagamento:", error)
      alert(error?.message || "Não foi possível registrar o pagamento.")
    } finally {
      setSavingPayment(false)
    }
  }

  async function markPaymentAsPaid(payment: StaffPayment) {
    try {
      const paidAt = new Date().toISOString()

      const { error } = await supabase
        .from("staff_payments")
        .update({
          status: "paid",
          paid_at: paidAt,
          updated_at: paidAt,
        })
        .eq("id", payment.id)

      if (error) throw error

      if (payment.accounts_payable_id) {
        const { error: payableError } = await supabase
          .from("accounts_payable")
          .update({
            status: "paid",
            paid_at: paidAt,
            updated_at: paidAt,
          })
          .eq("id", payment.accounts_payable_id)

        if (payableError) throw payableError
      }

      await loadData()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "Não foi possível marcar como pago.")
    }
  }

  async function generateMonthlyPayroll() {
    if (!restaurantId) {
      alert("Restaurante não encontrado.")
      return
    }

    const referenceMonth = currentMonthReference()
    const referenceMonthDate = `${referenceMonth}-01`
    const dueDate = getMonthEndDate(referenceMonth)

    const fixedMembers = activeStaffMembers.filter((member) => {
      return member.worker_type === "fixed" && toNumber(member.monthly_salary) > 0
    })

    if (fixedMembers.length === 0) {
      alert("Nenhum funcionário fixo ativo com salário cadastrado.")
      return
    }

    try {
      setGeneratingPayroll(true)

      const { data: existingPayments, error: existingError } = await supabase
        .from("staff_payments")
        .select("staff_id")
        .eq("restaurant_id", restaurantId)
        .eq("payment_type", "salary")
        .eq("reference_month", referenceMonthDate)

      if (existingError) throw existingError

      const alreadyGenerated = new Set(
        (existingPayments || []).map((payment) => payment.staff_id),
      )

      const membersToGenerate = fixedMembers.filter(
        (member) => !alreadyGenerated.has(member.id),
      )

      if (membersToGenerate.length === 0) {
        alert("A folha fixa deste mês já foi gerada.")
        return
      }

      for (const member of membersToGenerate) {
        const amount = toNumber(member.monthly_salary)

        const { data: createdPayment, error: paymentError } = await supabase
          .from("staff_payments")
          .insert({
            restaurant_id: restaurantId,
            staff_id: member.id,
            payment_type: "salary",
            reference_month: referenceMonthDate,
            amount,
            status: "pending",
            paid_at: null,
            payment_method: null,
            payment_reference: null,
            notes: "Folha fixa gerada automaticamente.",
          })
          .select("id")
          .single()

        if (paymentError) throw paymentError

        await createLinkedAccountsPayable({
          paymentId: createdPayment.id,
          member,
          paymentTypeValue: "salary",
          referenceMonthDate,
          amount,
          status: "pending",
          paymentMethodValue: null,
          notesValue: "Folha fixa gerada automaticamente pela aba Funcionários.",
          dueDate,
        })
      }

      await loadData()
      alert("Folha fixa gerada e enviada para Contas a Pagar.")
    } catch (error: any) {
      console.error("Erro ao gerar folha fixa:", error)
      alert(error?.message || "Não foi possível gerar a folha fixa.")
    } finally {
      setGeneratingPayroll(false)
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-full space-y-5 overflow-hidden">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <UsersRound className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-xl font-semibold text-slate-950">
                  Funcionários
                </h1>
                <p className="text-sm text-slate-500">
                  Controle equipe, folha, diárias e custos enviados para Contas a Pagar.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleOpenNewStaffForm}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Novo funcionário
              </Button>

              <Button
                type="button"
                onClick={generateMonthlyPayroll}
                disabled={generatingPayroll || loading}
                className="gap-2"
              >
                {generatingPayroll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Gerar folha fixa
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={loadData}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCcw
                  className={cn("h-4 w-4", loading && "animate-spin")}
                />
                Atualizar
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Ativos</p>
            <strong className="mt-1 block text-2xl font-semibold text-slate-950">
              {totals.activeCount}
            </strong>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Folha fixa</p>
            <strong className="mt-1 block text-2xl font-semibold text-slate-950">
              {formatCurrency(totals.fixedPayroll)}
            </strong>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Freelancers pendentes</p>
            <strong className="mt-1 block text-2xl font-semibold text-violet-700">
              {formatCurrency(totals.freelancerPending)}
            </strong>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total pendente</p>
            <strong className="mt-1 block text-2xl font-semibold text-orange-600">
              {formatCurrency(totals.pendingTotal)}
            </strong>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Pago no mês</p>
            <strong className="mt-1 block text-2xl font-semibold text-emerald-600">
              {formatCurrency(totals.paidThisMonth)}
            </strong>
          </div>
        </div>

        {showStaffForm && (
          <form
            onSubmit={handleSubmitStaff}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">
                  {editingStaffId ? "Editar funcionário" : "Novo funcionário"}
                </h2>
                <p className="text-sm text-slate-500">
                  Cadastre fixo com salário mensal ou freelancer com valor de diária.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeStaffForm}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex: João Silva"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="11999999999"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Função</Label>
                <Input
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  placeholder="Ex: Cozinha"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <select
                  value={workerType}
                  onChange={(event) =>
                    setWorkerType(event.target.value as WorkerType)
                  }
                  className={selectClassName}
                >
                  <option value="fixed">Fixo</option>
                  <option value="freelancer">Freelancer</option>
                </select>
              </div>

              {workerType === "fixed" ? (
                <div className="space-y-1.5">
                  <Label>Salário mensal</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlySalary}
                    onChange={(event) => setMonthlySalary(event.target.value)}
                    placeholder="Ex: 1800.00"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Valor da diária</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={dailyRate}
                    onChange={(event) => setDailyRate(event.target.value)}
                    placeholder="Ex: 120.00"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Tipo da chave Pix</Label>
                <Input
                  value={pixKeyType}
                  onChange={(event) => setPixKeyType(event.target.value)}
                  placeholder="CPF, telefone, e-mail..."
                />
              </div>

              <div className="space-y-1.5">
                <Label>Chave Pix</Label>
                <Input
                  value={pixKey}
                  onChange={(event) => setPixKey(event.target.value)}
                  placeholder="Chave para pagamento"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2 xl:col-span-1">
                <Label>Observação</Label>
                <Input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ex: Trabalha finais de semana"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeStaffForm}>
                Cancelar
              </Button>

              <Button type="submit" disabled={savingStaff} className="gap-2">
                {savingStaff ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {editingStaffId ? "Salvar alterações" : "Cadastrar"}
              </Button>
            </div>
          </form>
        )}

        {showPaymentForm && (
          <form
            onSubmit={handleSubmitPayment}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">
                  Registrar custo de funcionário
                </h2>
                <p className="text-sm text-slate-500">
                  Esse lançamento também aparece em Contas a Pagar por categoria.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closePaymentForm}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="space-y-1.5 xl:col-span-2">
                <Label>Pessoa</Label>
                <select
                  value={paymentStaffId}
                  onChange={(event) => setPaymentStaffId(event.target.value)}
                  className={selectClassName}
                >
                  <option value="">Selecione</option>
                  {activeStaffMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} — {member.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <select
                  value={paymentType}
                  onChange={(event) =>
                    setPaymentType(event.target.value as PaymentType)
                  }
                  className={selectClassName}
                >
                  <option value="salary">Salário</option>
                  <option value="daily">Diária</option>
                  <option value="bonus">Bônus</option>
                  <option value="advance">Adiantamento</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Valor</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  placeholder="Ex: 120.00"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Mês</Label>
                <Input
                  type="month"
                  value={paymentReferenceMonth}
                  onChange={(event) =>
                    setPaymentReferenceMonth(event.target.value)
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  value={paymentStatus}
                  onChange={(event) =>
                    setPaymentStatus(event.target.value as PaymentStatus)
                  }
                  className={selectClassName}
                >
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Método</Label>
                <Input
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  placeholder="pix, dinheiro..."
                />
              </div>

              <div className="space-y-1.5 md:col-span-2 xl:col-span-5">
                <Label>Observação</Label>
                <Input
                  value={paymentNotes}
                  onChange={(event) => setPaymentNotes(event.target.value)}
                  placeholder="Ex: Diária do sábado"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={closePaymentForm}>
                Cancelar
              </Button>

              <Button type="submit" disabled={savingPayment} className="gap-2">
                {savingPayment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Banknote className="h-4 w-4" />
                )}
                Registrar custo
              </Button>
            </div>
          </form>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">
                Equipe cadastrada
              </h2>
              <p className="text-sm text-slate-500">
                Ações rápidas por funcionário: lançar salário, diária, editar ou inativar.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar funcionário..."
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando equipe...
            </div>
          ) : filteredStaffMembers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
              <UsersRound className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 font-medium text-slate-800">
                Nenhuma pessoa cadastrada
              </p>
              <p className="text-sm text-slate-500">
                Cadastre funcionários fixos ou freelancers para começar.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStaffMembers.map((member) => (
                <div
                  key={member.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="grid gap-3 lg:grid-cols-[1.6fr_0.8fr_0.9fr_1fr_auto] lg:items-center">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {member.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {member.role}
                        {member.phone ? ` • ${member.phone}` : ""}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Tipo</p>
                      <span className="inline-flex rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700">
                        {workerTypeLabels[member.worker_type] ||
                          member.worker_type}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        {member.worker_type === "fixed"
                          ? "Salário"
                          : "Diária"}
                      </p>
                      <p className="font-semibold text-slate-950">
                        {member.worker_type === "fixed"
                          ? formatCurrency(member.monthly_salary)
                          : formatCurrency(member.daily_rate)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Status / Pix</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                            member.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600",
                          )}
                        >
                          {statusLabels[member.status] || member.status}
                        </span>

                        <span className="text-xs text-slate-500">
                          {member.pix_key ? "Pix cadastrado" : "Sem Pix"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => fillPaymentFromStaff(member)}
                      >
                        {member.worker_type === "freelancer"
                          ? "Lançar diária"
                          : "Lançar salário"}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditStaff(member)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateStaffStatus(
                            member,
                            member.status === "active" ? "inactive" : "active",
                          )
                        }
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">
                  Pagamentos pendentes
                </h2>
                <p className="text-sm text-slate-500">
                  Salários, diárias e bônus ainda não pagos.
                </p>
              </div>

              <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
                {formatCurrency(totals.pendingTotal)}
              </span>
            </div>

            {pendingPayments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Nenhum pagamento pendente.
              </div>
            ) : (
              <div className="space-y-2">
                {pendingPayments.slice(0, 10).map((payment) => {
                  const member = staffById[payment.staff_id]

                  return (
                    <div
                      key={payment.id}
                      className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-950">
                          {member?.name || "Funcionário removido"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {paymentTypeLabels[payment.payment_type] ||
                            payment.payment_type}{" "}
                          • {getPaymentCategoryLabel(payment)} •{" "}
                          {formatDate(payment.reference_month)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <strong className="text-slate-950">
                          {formatCurrency(payment.amount)}
                        </strong>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() => markPaymentAsPaid(payment)}
                          className="gap-2"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Marcar pago
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">Pagos recentes</h2>
                <p className="text-sm text-slate-500">
                  Histórico rápido dos últimos pagamentos quitados.
                </p>
              </div>

              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                {formatCurrency(totals.paidThisMonth)}
              </span>
            </div>

            {paidPayments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Nenhum pagamento pago ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {paidPayments.slice(0, 10).map((payment) => {
                  const member = staffById[payment.staff_id]

                  return (
                    <div
                      key={payment.id}
                      className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-950">
                          {member?.name || "Funcionário removido"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {paymentTypeLabels[payment.payment_type] ||
                            payment.payment_type}{" "}
                          • Pago em {formatDate(payment.paid_at)}
                        </p>
                      </div>

                      <strong className="text-emerald-700">
                        {formatCurrency(payment.amount)}
                      </strong>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}