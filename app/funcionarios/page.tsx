"use client"

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react"
import {
  Banknote,
  Bus,
  Calculator,
  CheckCircle2,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
  Wallet,
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
type PayrollComponent =
  | "salary"
  | "fgts"
  | "charges"
  | "transport"
  | "daily"
  | "bonus"
  | "advance"
  | "other"

type StaffPayrollConfig = {
  fgtsPercent: number
  companyInssPercent: number
  ratPercent: number
  thirdPartyPercent: number
  transportValuePerDay: number
  transportDays: number
  transportDiscountPercent: number
  mealBenefit: number
  insalubrityPercent: number
  insalubrityBase: number
}

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

const PAYROLL_CONFIG_PREFIX = "__CLICKFOOD_PAYROLL_CONFIG__:"
const PAYMENT_COMPONENT_PREFIX = "CF_PAYROLL_COMPONENT:"

const defaultPayrollConfig: StaffPayrollConfig = {
  fgtsPercent: 8,
  companyInssPercent: 20,
  ratPercent: 2,
  thirdPartyPercent: 5.8,
  transportValuePerDay: 0,
  transportDays: 26,
  transportDiscountPercent: 6,
  mealBenefit: 0,
  insalubrityPercent: 0,
  insalubrityBase: 0,
}

const workerTypeLabels: Record<string, string> = {
  fixed: "CLT",
  freelancer: "Freelancer",
}

const statusLabels: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
}

const componentLabels: Record<PayrollComponent, string> = {
  salary: "Salário",
  fgts: "FGTS",
  charges: "INSS / Encargos",
  transport: "Passagem / Benefícios",
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

function getMonthEndDate(referenceMonth: string) {
  const date = new Date(`${referenceMonth}-01T00:00:00`)
  date.setMonth(date.getMonth() + 1)
  date.setDate(0)

  return date.toISOString().slice(0, 10)
}

function getReferenceMonthLabel(referenceMonthDate: string | null) {
  if (!referenceMonthDate) return "Sem competência"

  return new Intl.DateTimeFormat("pt-BR", {
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${referenceMonthDate.slice(0, 10)}T00:00:00`))
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "")
}

function normalizePayrollConfig(
  value: Partial<StaffPayrollConfig> | null | undefined,
) {
  return {
    fgtsPercent: toNumber(value?.fgtsPercent ?? defaultPayrollConfig.fgtsPercent),
    companyInssPercent: toNumber(
      value?.companyInssPercent ?? defaultPayrollConfig.companyInssPercent,
    ),
    ratPercent: toNumber(value?.ratPercent ?? defaultPayrollConfig.ratPercent),
    thirdPartyPercent: toNumber(
      value?.thirdPartyPercent ?? defaultPayrollConfig.thirdPartyPercent,
    ),
    transportValuePerDay: toNumber(
      value?.transportValuePerDay ?? defaultPayrollConfig.transportValuePerDay,
    ),
    transportDays: toNumber(
      value?.transportDays ?? defaultPayrollConfig.transportDays,
    ),
    transportDiscountPercent: toNumber(
      value?.transportDiscountPercent ??
        defaultPayrollConfig.transportDiscountPercent,
    ),
    mealBenefit: toNumber(value?.mealBenefit ?? defaultPayrollConfig.mealBenefit),
    insalubrityPercent: toNumber(
      value?.insalubrityPercent ?? defaultPayrollConfig.insalubrityPercent,
    ),
    insalubrityBase: toNumber(
      value?.insalubrityBase ?? defaultPayrollConfig.insalubrityBase,
    ),
  }
}

function parseStoredNotes(value: string | null | undefined) {
  if (!value) {
    return {
      publicNotes: "",
      payrollConfig: defaultPayrollConfig,
    }
  }

  const markerIndex = value.indexOf(PAYROLL_CONFIG_PREFIX)

  if (markerIndex === -1) {
    return {
      publicNotes: value.trim(),
      payrollConfig: defaultPayrollConfig,
    }
  }

  const publicNotes = value.slice(0, markerIndex).trim()
  const rawConfig = value.slice(markerIndex + PAYROLL_CONFIG_PREFIX.length).trim()

  try {
    return {
      publicNotes,
      payrollConfig: normalizePayrollConfig(JSON.parse(rawConfig)),
    }
  } catch {
    return {
      publicNotes,
      payrollConfig: defaultPayrollConfig,
    }
  }
}

function buildStoredNotes(publicNotes: string, payrollConfig: StaffPayrollConfig) {
  const cleanNotes = publicNotes.trim()
  const configText = `${PAYROLL_CONFIG_PREFIX}${JSON.stringify(payrollConfig)}`

  return cleanNotes ? `${cleanNotes}\n\n${configText}` : configText
}

function buildPaymentNotes(
  component: PayrollComponent,
  notesValue?: string | null,
) {
  const cleanNotes = notesValue?.trim()

  return cleanNotes
    ? `${PAYMENT_COMPONENT_PREFIX}${component}\n${cleanNotes}`
    : `${PAYMENT_COMPONENT_PREFIX}${component}`
}

function getPaymentComponent(
  payment: Pick<StaffPayment, "payment_type" | "notes">,
) {
  const notes = payment.notes || ""
  const markerIndex = notes.indexOf(PAYMENT_COMPONENT_PREFIX)

  if (markerIndex >= 0) {
    const component = notes
      .slice(markerIndex + PAYMENT_COMPONENT_PREFIX.length)
      .split("\n")[0]
      .trim()

    if (component in componentLabels) {
      return component as PayrollComponent
    }
  }

  if (payment.payment_type === "salary") return "salary"
  if (payment.payment_type === "daily") return "daily"
  if (payment.payment_type === "bonus") return "bonus"
  if (payment.payment_type === "advance") return "advance"

  return "other"
}

function paymentTypeFromComponent(component: PayrollComponent): PaymentType {
  if (component === "salary") return "salary"
  if (component === "daily") return "daily"
  if (component === "bonus") return "bonus"
  if (component === "advance") return "advance"

  return "other"
}

function getPaymentCategory(component: PayrollComponent, member?: StaffMember) {
  if (component === "salary") return "Funcionários / Salários"
  if (component === "fgts") return "Funcionários / FGTS"
  if (component === "charges") return "Funcionários / INSS e Encargos"
  if (component === "transport") return "Funcionários / Passagem e Benefícios"
  if (component === "daily") return "Funcionários / Freelancers"
  if (component === "advance") return "Funcionários / Adiantamentos"
  if (component === "bonus") return "Funcionários / Bônus"

  return member?.worker_type === "freelancer"
    ? "Funcionários / Freelancers"
    : "Funcionários / Outros"
}

function getPaymentDescription(
  component: PayrollComponent,
  member: StaffMember,
  referenceMonthDate: string | null,
) {
  const reference = getReferenceMonthLabel(referenceMonthDate)
  return `${componentLabels[component]} - ${member.name} - ${reference}`
}

function calculatePayroll(params: {
  monthlySalary: number
  payrollConfig: StaffPayrollConfig
}) {
  const monthlySalary = toNumber(params.monthlySalary)
  const config = normalizePayrollConfig(params.payrollConfig)

  const insalubrityAmount =
    (toNumber(config.insalubrityBase) * toNumber(config.insalubrityPercent)) /
    100
  const salaryWithAdditional = monthlySalary + insalubrityAmount

  const fgts = (salaryWithAdditional * toNumber(config.fgtsPercent)) / 100
  const companyInss =
    (salaryWithAdditional * toNumber(config.companyInssPercent)) / 100
  const rat = (salaryWithAdditional * toNumber(config.ratPercent)) / 100
  const thirdParty =
    (salaryWithAdditional * toNumber(config.thirdPartyPercent)) / 100
  const charges = companyInss + rat + thirdParty

  const transportGross =
    toNumber(config.transportValuePerDay) * toNumber(config.transportDays)
  const transportEmployeeDiscount =
    (monthlySalary * toNumber(config.transportDiscountPercent)) / 100
  const transportCompany = Math.max(transportGross - transportEmployeeDiscount, 0)
  const benefits = transportCompany + toNumber(config.mealBenefit)

  const thirteenthProvision = salaryWithAdditional / 12
  const vacationProvision = salaryWithAdditional / 12
  const vacationThirdProvision = salaryWithAdditional / 36
  const provisions =
    thirteenthProvision + vacationProvision + vacationThirdProvision

  const companyCostWithoutProvisions =
    salaryWithAdditional + fgts + charges + benefits
  const companyCostWithProvisions = companyCostWithoutProvisions + provisions

  return {
    monthlySalary,
    insalubrityAmount,
    salaryWithAdditional,
    fgts,
    companyInss,
    rat,
    thirdParty,
    charges,
    transportGross,
    transportEmployeeDiscount,
    transportCompany,
    mealBenefit: toNumber(config.mealBenefit),
    benefits,
    thirteenthProvision,
    vacationProvision,
    vacationThirdProvision,
    provisions,
    companyCostWithoutProvisions,
    companyCostWithProvisions,
  }
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
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
  const [markingAllPaid, setMarkingAllPaid] = useState(false)
  const [deletingStaff, setDeletingStaff] = useState(false)

  const [search, setSearch] = useState("")
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)

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

  const [fgtsPercent, setFgtsPercent] = useState(
    String(defaultPayrollConfig.fgtsPercent),
  )
  const [companyInssPercent, setCompanyInssPercent] = useState(
    String(defaultPayrollConfig.companyInssPercent),
  )
  const [ratPercent, setRatPercent] = useState(
    String(defaultPayrollConfig.ratPercent),
  )
  const [thirdPartyPercent, setThirdPartyPercent] = useState(
    String(defaultPayrollConfig.thirdPartyPercent),
  )
  const [transportValuePerDay, setTransportValuePerDay] = useState("")
  const [transportDays, setTransportDays] = useState(
    String(defaultPayrollConfig.transportDays),
  )
  const [transportDiscountPercent, setTransportDiscountPercent] = useState(
    String(defaultPayrollConfig.transportDiscountPercent),
  )
  const [mealBenefit, setMealBenefit] = useState("")
  const [insalubrityPercent, setInsalubrityPercent] = useState("0")
  const [insalubrityBase, setInsalubrityBase] = useState("")

  const [paymentStaffId, setPaymentStaffId] = useState("")
  const [paymentComponent, setPaymentComponent] =
    useState<PayrollComponent>("salary")
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentReferenceMonth, setPaymentReferenceMonth] = useState(
    currentMonthReference(),
  )
  const [paymentMethod, setPaymentMethod] = useState("pix")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("pending")

  const staffFormPayrollConfig = useMemo(() => {
    return normalizePayrollConfig({
      fgtsPercent: toNumber(fgtsPercent),
      companyInssPercent: toNumber(companyInssPercent),
      ratPercent: toNumber(ratPercent),
      thirdPartyPercent: toNumber(thirdPartyPercent),
      transportValuePerDay: toNumber(transportValuePerDay),
      transportDays: toNumber(transportDays),
      transportDiscountPercent: toNumber(transportDiscountPercent),
      mealBenefit: toNumber(mealBenefit),
      insalubrityPercent: toNumber(insalubrityPercent),
      insalubrityBase: toNumber(insalubrityBase),
    })
  }, [
    companyInssPercent,
    fgtsPercent,
    insalubrityBase,
    insalubrityPercent,
    mealBenefit,
    ratPercent,
    thirdPartyPercent,
    transportDays,
    transportDiscountPercent,
    transportValuePerDay,
  ])

  const staffFormCalculation = useMemo(() => {
    return calculatePayroll({
      monthlySalary: toNumber(monthlySalary),
      payrollConfig: staffFormPayrollConfig,
    })
  }, [monthlySalary, staffFormPayrollConfig])

  const activeStaffMembers = useMemo(() => {
    return staffMembers.filter((member) => member.status === "active")
  }, [staffMembers])

  const staffById = useMemo(() => {
    return staffMembers.reduce<Record<string, StaffMember>>((acc, member) => {
      acc[member.id] = member
      return acc
    }, {})
  }, [staffMembers])

  const staffCostPreviewById = useMemo(() => {
    return staffMembers.reduce<Record<string, ReturnType<typeof calculatePayroll>>>(
      (acc, member) => {
        const { payrollConfig } = parseStoredNotes(member.notes)

        acc[member.id] = calculatePayroll({
          monthlySalary: toNumber(member.monthly_salary),
          payrollConfig,
        })

        return acc
      },
      {},
    )
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

  const currentMonthPayments = useMemo(() => {
    return payments.filter((payment) => {
      return payment.reference_month?.slice(0, 7) === currentMonthReference()
    })
  }, [payments])

  const pendingPayments = useMemo(() => {
    return currentMonthPayments.filter((payment) => payment.status === "pending")
  }, [currentMonthPayments])

  const selectedStaff = selectedStaffId ? staffById[selectedStaffId] : null

  const selectedStaffPayments = useMemo(() => {
    if (!selectedStaffId) return []

    return currentMonthPayments.filter(
      (payment) => payment.staff_id === selectedStaffId,
    )
  }, [currentMonthPayments, selectedStaffId])

  const selectedStaffPendingTotal = useMemo(() => {
    return selectedStaffPayments.reduce((acc, payment) => {
      if (payment.status === "pending") return acc + toNumber(payment.amount)
      return acc
    }, 0)
  }, [selectedStaffPayments])

  const totals = useMemo(() => {
    const monthStart = `${currentMonthReference()}-01`

    const nextMonth = new Date(`${monthStart}T00:00:00`)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    const nextMonthStart = nextMonth.toISOString().slice(0, 10)

    const pendingByComponent = pendingPayments.reduce(
      (acc, payment) => {
        const component = getPaymentComponent(payment)
        acc[component] = (acc[component] || 0) + toNumber(payment.amount)
        return acc
      },
      {} as Record<PayrollComponent, number>,
    )

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

    const provisionsEstimated = staffMembers.reduce((acc, member) => {
      if (member.status === "active" && member.worker_type === "fixed") {
        return acc + (staffCostPreviewById[member.id]?.provisions || 0)
      }

      return acc
    }, 0)

    const pendingTotal = pendingPayments.reduce((acc, payment) => {
      return acc + toNumber(payment.amount)
    }, 0)

    return {
      activeCount: staffMembers.filter((member) => member.status === "active")
        .length,
      salaryPending: pendingByComponent.salary || 0,
      fgtsPending: pendingByComponent.fgts || 0,
      chargesPending: pendingByComponent.charges || 0,
      transportPending: pendingByComponent.transport || 0,
      freelancerPending: pendingByComponent.daily || 0,
      provisionsEstimated,
      pendingTotal,
      paidThisMonth,
    }
  }, [payments, pendingPayments, staffCostPreviewById, staffMembers])

  useEffect(() => {
    if (selectedStaffId && !staffById[selectedStaffId]) {
      setSelectedStaffId(null)
    }
  }, [selectedStaffId, staffById])

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
          .limit(200),
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
    setFgtsPercent(String(defaultPayrollConfig.fgtsPercent))
    setCompanyInssPercent(String(defaultPayrollConfig.companyInssPercent))
    setRatPercent(String(defaultPayrollConfig.ratPercent))
    setThirdPartyPercent(String(defaultPayrollConfig.thirdPartyPercent))
    setTransportValuePerDay("")
    setTransportDays(String(defaultPayrollConfig.transportDays))
    setTransportDiscountPercent(
      String(defaultPayrollConfig.transportDiscountPercent),
    )
    setMealBenefit("")
    setInsalubrityPercent("0")
    setInsalubrityBase("")
  }

  function closeStaffForm() {
    resetStaffForm()
    setShowStaffForm(false)
  }

  function resetPaymentForm() {
    setPaymentStaffId("")
    setPaymentComponent("salary")
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
    const parsedNotes = parseStoredNotes(member.notes)
    const config = parsedNotes.payrollConfig

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
    setNotes(parsedNotes.publicNotes)
    setFgtsPercent(String(config.fgtsPercent))
    setCompanyInssPercent(String(config.companyInssPercent))
    setRatPercent(String(config.ratPercent))
    setThirdPartyPercent(String(config.thirdPartyPercent))
    setTransportValuePerDay(
      config.transportValuePerDay ? String(config.transportValuePerDay) : "",
    )
    setTransportDays(String(config.transportDays))
    setTransportDiscountPercent(String(config.transportDiscountPercent))
    setMealBenefit(config.mealBenefit ? String(config.mealBenefit) : "")
    setInsalubrityPercent(String(config.insalubrityPercent))
    setInsalubrityBase(
      config.insalubrityBase ? String(config.insalubrityBase) : "",
    )
    setShowStaffForm(true)
  }

  function fillPaymentFromStaff(member: StaffMember) {
    const isFreelancer = member.worker_type === "freelancer"
    const calculation = staffCostPreviewById[member.id]

    setPaymentStaffId(member.id)
    setPaymentComponent(isFreelancer ? "daily" : "salary")
    setPaymentAmount(
      isFreelancer
        ? String(member.daily_rate || "")
        : String(calculation?.salaryWithAdditional || member.monthly_salary || ""),
    )
    setPaymentReferenceMonth(currentMonthReference())
    setPaymentStatus("pending")
    setPaymentMethod("pix")
    setPaymentNotes(isFreelancer ? "Diária lançada pela aba Funcionários." : "")
    setShowPaymentForm(true)
  }

  async function createLinkedAccountsPayable(params: {
    paymentId: string
    member: StaffMember
    component: PayrollComponent
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
      component,
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
        description: getPaymentDescription(component, member, referenceMonthDate),
        category: getPaymentCategory(component, member),
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

  async function updateLinkedAccountsPayable(params: {
    payment: StaffPayment
    member: StaffMember
    component: PayrollComponent
    referenceMonthDate: string | null
    amount: number
    notesValue: string | null
    dueDate: string
  }) {
    const {
      payment,
      member,
      component,
      referenceMonthDate,
      amount,
      notesValue,
      dueDate,
    } = params

    if (!payment.accounts_payable_id) {
      await createLinkedAccountsPayable({
        paymentId: payment.id,
        member,
        component,
        referenceMonthDate,
        amount,
        status: payment.status,
        paymentMethodValue: payment.payment_method,
        notesValue,
        dueDate,
      })
      return
    }

    const { error } = await supabase
      .from("accounts_payable")
      .update({
        description: getPaymentDescription(component, member, referenceMonthDate),
        category: getPaymentCategory(component, member),
        amount,
        due_date: dueDate,
        notes: notesValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.accounts_payable_id)

    if (error) throw error
  }

  async function createStaffPayment(params: {
    member: StaffMember
    component: PayrollComponent
    amount: number
    referenceMonthDate: string
    dueDate: string
    notesValue: string
  }) {
    const { member, component, amount, referenceMonthDate, dueDate, notesValue } =
      params
    const paymentType = paymentTypeFromComponent(component)
    const notesWithComponent = buildPaymentNotes(component, notesValue)

    const { data: createdPayment, error: paymentError } = await supabase
      .from("staff_payments")
      .insert({
        restaurant_id: member.restaurant_id,
        staff_id: member.id,
        payment_type: paymentType,
        reference_month: referenceMonthDate,
        amount: roundMoney(amount),
        status: "pending",
        paid_at: null,
        payment_method: null,
        payment_reference: null,
        notes: notesWithComponent,
      })
      .select("id")
      .single()

    if (paymentError) throw paymentError

    await createLinkedAccountsPayable({
      paymentId: createdPayment.id,
      member,
      component,
      referenceMonthDate,
      amount: roundMoney(amount),
      status: "pending",
      paymentMethodValue: null,
      notesValue: notesWithComponent,
      dueDate,
    })
  }

  async function syncStaffPayrollForCurrentMonth(member: StaffMember) {
    if (!restaurantId) return
    if (member.worker_type !== "fixed" || toNumber(member.monthly_salary) <= 0)
      return

    const referenceMonth = currentMonthReference()
    const referenceMonthDate = `${referenceMonth}-01`
    const dueDate = getMonthEndDate(referenceMonth)
    const { payrollConfig } = parseStoredNotes(member.notes)
    const calculation = calculatePayroll({
      monthlySalary: toNumber(member.monthly_salary),
      payrollConfig,
    })

    const componentsToSync: Array<{
      component: PayrollComponent
      amount: number
      notesValue: string
    }> = [
      {
        component: "salary",
        amount: calculation.salaryWithAdditional,
        notesValue:
          calculation.insalubrityAmount > 0
            ? "Salário da competência com adicional de insalubridade."
            : "Salário da competência.",
      },
      {
        component: "fgts",
        amount: calculation.fgts,
        notesValue: `FGTS estimado: ${payrollConfig.fgtsPercent}% sobre salário + adicionais.`,
      },
      {
        component: "charges",
        amount: calculation.charges,
        notesValue: `Encargos estimados: INSS patronal ${payrollConfig.companyInssPercent}%, RAT ${payrollConfig.ratPercent}% e terceiros ${payrollConfig.thirdPartyPercent}%.`,
      },
      {
        component: "transport",
        amount: calculation.benefits,
        notesValue: "Passagem e benefícios da competência.",
      },
    ]

    const { data: existingPayments, error: existingError } = await supabase
      .from("staff_payments")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("staff_id", member.id)
      .eq("reference_month", referenceMonthDate)

    if (existingError) throw existingError

    const existingByComponent = new Map<PayrollComponent, StaffPayment>()

    ;((existingPayments || []) as StaffPayment[]).forEach((payment) => {
      existingByComponent.set(getPaymentComponent(payment), {
        ...payment,
        amount: toNumber(payment.amount),
      })
    })

    for (const item of componentsToSync) {
      const amount = roundMoney(item.amount)
      if (amount <= 0) continue

      const existingPayment = existingByComponent.get(item.component)
      const notesWithComponent = buildPaymentNotes(item.component, item.notesValue)

      if (!existingPayment) {
        await createStaffPayment({
          member,
          component: item.component,
          amount,
          referenceMonthDate,
          dueDate,
          notesValue: item.notesValue,
        })
        continue
      }

      if (existingPayment.status === "paid") continue

      const { error: updatePaymentError } = await supabase
        .from("staff_payments")
        .update({
          amount,
          notes: notesWithComponent,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPayment.id)

      if (updatePaymentError) throw updatePaymentError

      await updateLinkedAccountsPayable({
        payment: existingPayment,
        member,
        component: item.component,
        referenceMonthDate,
        amount,
        notesValue: notesWithComponent,
        dueDate,
      })
    }
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
        notes:
          workerType === "fixed"
            ? buildStoredNotes(notes, staffFormPayrollConfig)
            : notes.trim() || null,
        status: "active",
        updated_at: new Date().toISOString(),
      }

      if (editingStaffId) {
        const { data: updatedStaff, error } = await supabase
          .from("staff_members")
          .update(payload)
          .eq("id", editingStaffId)
          .select("*")
          .single()

        if (error) throw error

        await syncStaffPayrollForCurrentMonth({
          ...updatedStaff,
          monthly_salary:
            updatedStaff.monthly_salary === null
              ? null
              : toNumber(updatedStaff.monthly_salary),
          daily_rate:
            updatedStaff.daily_rate === null
              ? null
              : toNumber(updatedStaff.daily_rate),
        })

        setSelectedStaffId(updatedStaff.id)
      } else {
        const { data: createdStaff, error } = await supabase
          .from("staff_members")
          .insert(payload)
          .select("*")
          .single()

        if (error) throw error

        await syncStaffPayrollForCurrentMonth({
          ...createdStaff,
          monthly_salary:
            createdStaff.monthly_salary === null
              ? null
              : toNumber(createdStaff.monthly_salary),
          daily_rate:
            createdStaff.daily_rate === null
              ? null
              : toNumber(createdStaff.daily_rate),
        })

        setSelectedStaffId(createdStaff.id)
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

  async function deleteStaffMember(member: StaffMember) {
    const confirmed = window.confirm(
      `Excluir ${member.name}?\n\nIsso também remove os lançamentos de folha vinculados a essa pessoa.`,
    )

    if (!confirmed) return

    try {
      setDeletingStaff(true)

      const { data: memberPayments, error: paymentsError } = await supabase
        .from("staff_payments")
        .select("id, accounts_payable_id")
        .eq("restaurant_id", member.restaurant_id)
        .eq("staff_id", member.id)

      if (paymentsError) throw paymentsError

      const paymentIds = (memberPayments || []).map((payment) => payment.id)
      const payableIds = (memberPayments || [])
        .map((payment) => payment.accounts_payable_id)
        .filter(Boolean) as string[]

      if (payableIds.length > 0) {
        const { error: payableError } = await supabase
          .from("accounts_payable")
          .delete()
          .in("id", payableIds)

        if (payableError) throw payableError
      }

      if (paymentIds.length > 0) {
        const { error: deletePaymentsError } = await supabase
          .from("staff_payments")
          .delete()
          .in("id", paymentIds)

        if (deletePaymentsError) throw deletePaymentsError
      }

      const { error: deleteStaffError } = await supabase
        .from("staff_members")
        .delete()
        .eq("id", member.id)

      if (deleteStaffError) throw deleteStaffError

      if (selectedStaffId === member.id) {
        setSelectedStaffId(null)
      }

      await loadData()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "Não foi possível excluir o funcionário.")
    } finally {
      setDeletingStaff(false)
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

      const selectedMember = staffById[paymentStaffId]

      if (!selectedMember) {
        throw new Error("Funcionário não encontrado.")
      }

      const referenceMonthDate = paymentReferenceMonth
        ? `${paymentReferenceMonth}-01`
        : null
      const paidAt = paymentStatus === "paid" ? new Date().toISOString() : null
      const cleanNotes = paymentNotes.trim() || null
      const paymentNotesWithComponent = buildPaymentNotes(
        paymentComponent,
        cleanNotes,
      )
      const cleanPaymentMethod = paymentMethod.trim() || null
      const paymentType = paymentTypeFromComponent(paymentComponent)

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
          notes: paymentNotesWithComponent,
        })
        .select("id")
        .single()

      if (error) throw error

      await createLinkedAccountsPayable({
        paymentId: createdPayment.id,
        member: selectedMember,
        component: paymentComponent,
        referenceMonthDate,
        amount: parsedAmount,
        status: paymentStatus,
        paymentMethodValue: cleanPaymentMethod,
        notesValue: paymentNotesWithComponent,
        dueDate: todayDate(),
      })

      setSelectedStaffId(paymentStaffId)
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

  async function markAllPendingAsPaid() {
    if (pendingPayments.length === 0) {
      alert("Nenhum lançamento pendente nesta competência.")
      return
    }

    const confirmed = window.confirm(
      `Marcar ${pendingPayments.length} lançamento(s) pendente(s) como pago(s)?`,
    )

    if (!confirmed) return

    try {
      setMarkingAllPaid(true)

      const paidAt = new Date().toISOString()
      const paymentIds = pendingPayments.map((payment) => payment.id)
      const payableIds = pendingPayments
        .map((payment) => payment.accounts_payable_id)
        .filter(Boolean) as string[]

      const { error } = await supabase
        .from("staff_payments")
        .update({
          status: "paid",
          paid_at: paidAt,
          updated_at: paidAt,
        })
        .in("id", paymentIds)

      if (error) throw error

      if (payableIds.length > 0) {
        const { error: payableError } = await supabase
          .from("accounts_payable")
          .update({
            status: "paid",
            paid_at: paidAt,
            updated_at: paidAt,
          })
          .in("id", payableIds)

        if (payableError) throw payableError
      }

      await loadData()
      alert("Todos os lançamentos pendentes foram marcados como pagos.")
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "Não foi possível pagar todos os lançamentos.")
    } finally {
      setMarkingAllPaid(false)
    }
  }

  async function generateMonthlyPayroll() {
    if (!restaurantId) {
      alert("Restaurante não encontrado.")
      return
    }

    const fixedMembers = activeStaffMembers.filter((member) => {
      return member.worker_type === "fixed" && toNumber(member.monthly_salary) > 0
    })

    if (fixedMembers.length === 0) {
      alert("Nenhum funcionário CLT ativo com salário cadastrado.")
      return
    }

    try {
      setGeneratingPayroll(true)

      for (const member of fixedMembers) {
        await syncStaffPayrollForCurrentMonth(member)
      }

      await loadData()
      alert("Lançamentos atualizados e enviados para o Financeiro como despesas pendentes.")
    } catch (error: any) {
      console.error("Erro ao gerar lançamentos:", error)
      alert(error?.message || "Não foi possível gerar os lançamentos.")
    } finally {
      setGeneratingPayroll(false)
    }
  }

  const selectedParsedNotes = selectedStaff
    ? parseStoredNotes(selectedStaff.notes)
    : null
  const selectedCalculation = selectedStaff
    ? staffCostPreviewById[selectedStaff.id]
    : null

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1350px] space-y-4 overflow-hidden pb-6">
        <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">
                <UsersRound className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h1 className="text-lg font-semibold leading-tight text-white">
                  Funcionários e Folha
                </h1>
                <p className="text-sm text-zinc-500">
                  Lista de funcionários, custos trabalhistas e pendências da competência.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleOpenNewStaffForm}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Novo funcionário
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={generateMonthlyPayroll}
                disabled={generatingPayroll || loading}
                className="gap-2"
              >
                {generatingPayroll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Gerar lançamentos
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={markAllPendingAsPaid}
                disabled={
                  markingAllPaid || loading || pendingPayments.length === 0
                }
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                {markingAllPaid ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Marcar todos como pagos
              </Button>

              <Button
                type="button"
                size="sm"
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            title="Total pendente"
            value={formatCurrency(totals.pendingTotal)}
            subtitle="salários, encargos e benefícios"
            icon={<Wallet className="h-4 w-4" />}
            className="border-yellow-400/30 bg-yellow-400/10"
            valueClassName="text-yellow-400"
          />

          <DashboardCard
            title="Salários"
            value={formatCurrency(totals.salaryPending)}
            subtitle={`${totals.activeCount} ativo(s)`}
            icon={<Banknote className="h-4 w-4" />}
          />

          <DashboardCard
            title="Encargos"
            value={formatCurrency(totals.fgtsPending + totals.chargesPending)}
            subtitle="FGTS, INSS, RAT e terceiros"
            icon={<ShieldCheck className="h-4 w-4" />}
          />

          <DashboardCard
            title="Pago no mês"
            value={formatCurrency(totals.paidThisMonth)}
            subtitle="lançamentos quitados"
            icon={<CheckCircle2 className="h-4 w-4" />}
            className="border-emerald-400/30 bg-emerald-500/10"
            valueClassName="text-emerald-400"
          />
        </div>

        <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-400">
          Ao cadastrar CLT, o sistema gera salário, FGTS, INSS/encargos e passagem como despesas pendentes.
          Provisões gerenciais de 13º e férias:{" "}
          <strong>{formatCurrency(totals.provisionsEstimated)}</strong>.
        </div>

        {showStaffForm && (
          <form
            onSubmit={handleSubmitStaff}
            className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">
                  {editingStaffId ? "Editar funcionário" : "Novo funcionário"}
                </h2>
                <p className="text-sm text-zinc-500">
                  Se for CLT, configure salário, encargos, passagem, benefícios e insalubridade.
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

            <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Ex: Maria Silva"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="31999999999"
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
                      <option value="fixed">CLT</option>
                      <option value="freelancer">Freelancer / Diarista</option>
                    </select>
                  </div>
                </div>

                {workerType === "fixed" ? (
                  <div className="rounded-2xl border border-white/10 bg-[#111111] p-4">
                    <div className="mb-3">
                      <h3 className="font-semibold text-white">
                        Dados da folha CLT
                      </h3>
                      <p className="text-xs text-zinc-500">
                        Esses dados alimentam as pendências da competência.
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label>Salário base</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={monthlySalary}
                          onChange={(event) =>
                            setMonthlySalary(event.target.value)
                          }
                          placeholder="Ex: 1800.00"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>FGTS (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={fgtsPercent}
                          onChange={(event) => setFgtsPercent(event.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>INSS patronal (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={companyInssPercent}
                          onChange={(event) =>
                            setCompanyInssPercent(event.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>RAT (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={ratPercent}
                          onChange={(event) => setRatPercent(event.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Terceiros (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={thirdPartyPercent}
                          onChange={(event) =>
                            setThirdPartyPercent(event.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Base insalubridade</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={insalubrityBase}
                          onChange={(event) =>
                            setInsalubrityBase(event.target.value)
                          }
                          placeholder="Ex: 1518.00"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Insalubridade (%)</Label>
                        <select
                          value={insalubrityPercent}
                          onChange={(event) =>
                            setInsalubrityPercent(event.target.value)
                          }
                          className={selectClassName}
                        >
                          <option value="0">Não tem</option>
                          <option value="10">10% - mínimo</option>
                          <option value="20">20% - médio</option>
                          <option value="40">40% - máximo</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Passagem por dia</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={transportValuePerDay}
                          onChange={(event) =>
                            setTransportValuePerDay(event.target.value)
                          }
                          placeholder="Ex: 12.00"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Dias de passagem</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={transportDays}
                          onChange={(event) =>
                            setTransportDays(event.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Desconto VT (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={transportDiscountPercent}
                          onChange={(event) =>
                            setTransportDiscountPercent(event.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>VA / Benefícios mês</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={mealBenefit}
                          onChange={(event) => setMealBenefit(event.target.value)}
                          placeholder="Ex: 180.00"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-[#111111] p-4">
                    <div className="grid gap-3 md:grid-cols-2">
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
                    </div>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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

                  <div className="space-y-1.5">
                    <Label>Observação</Label>
                    <Input
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Ex: Trabalha finais de semana"
                    />
                  </div>
                </div>
              </div>

              {workerType === "fixed" && (
                <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-yellow-400" />
                    <h3 className="font-semibold text-white">
                      Prévia automática
                    </h3>
                  </div>

                  <div className="space-y-2 text-sm">
                    <CostLine
                      label="Salário base"
                      value={staffFormCalculation.monthlySalary}
                    />
                    <CostLine
                      label="Insalubridade"
                      value={staffFormCalculation.insalubrityAmount}
                    />
                    <CostLine
                      label="Salário pendente"
                      value={staffFormCalculation.salaryWithAdditional}
                      strong
                    />
                    <CostLine label="FGTS" value={staffFormCalculation.fgts} />
                    <CostLine
                      label="INSS patronal"
                      value={staffFormCalculation.companyInss}
                    />
                    <CostLine label="RAT" value={staffFormCalculation.rat} />
                    <CostLine
                      label="Terceiros"
                      value={staffFormCalculation.thirdParty}
                    />
                    <CostLine
                      label="Passagem bruta"
                      value={staffFormCalculation.transportGross}
                    />
                    <CostLine
                      label="(-) Desconto VT"
                      value={staffFormCalculation.transportEmployeeDiscount}
                    />
                    <CostLine
                      label="VA / Benefícios"
                      value={staffFormCalculation.mealBenefit}
                    />
                    <CostLine
                      label="13º provisionado"
                      value={staffFormCalculation.thirteenthProvision}
                    />
                    <CostLine
                      label="Férias"
                      value={staffFormCalculation.vacationProvision}
                    />
                    <CostLine
                      label="1/3 férias"
                      value={staffFormCalculation.vacationThirdProvision}
                    />

                    <div className="mt-3 rounded-xl bg-[#0A0A0A] p-3">
                      <CostLine
                        label="Custo total estimado"
                        value={staffFormCalculation.companyCostWithProvisions}
                        strong
                        valueClassName="text-yellow-400"
                      />
                    </div>
                  </div>
                </div>
              )}
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
                {editingStaffId ? "Salvar alterações" : "Cadastrar e gerar pendências"}
              </Button>
            </div>
          </form>
        )}

        {showPaymentForm && (
          <form
            onSubmit={handleSubmitPayment}
            className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">
                  Registrar custo avulso
                </h2>
                <p className="text-sm text-zinc-500">
                  Lançamento extra para a competência atual.
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
                  value={paymentComponent}
                  onChange={(event) =>
                    setPaymentComponent(event.target.value as PayrollComponent)
                  }
                  className={selectClassName}
                >
                  <option value="salary">Salário</option>
                  <option value="fgts">FGTS</option>
                  <option value="charges">INSS / Encargos</option>
                  <option value="transport">Passagem / Benefícios</option>
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

        <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-white">
                Lista de funcionários
              </h2>
              <p className="text-sm text-zinc-500">
                Clique em uma pessoa para abrir os detalhes da folha.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar funcionário..."
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando equipe...
            </div>
          ) : filteredStaffMembers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
              <UsersRound className="mx-auto h-8 w-8 text-zinc-500" />
              <p className="mt-2 font-medium text-white">
                Nenhum funcionário cadastrado
              </p>
              <p className="text-sm text-zinc-500">
                Cadastre funcionários CLT ou freelancers para começar.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStaffMembers.map((member) => {
                const calculation = staffCostPreviewById[member.id]
                const isClt = member.worker_type === "fixed"

                const memberPending = currentMonthPayments.reduce(
                  (acc, payment) => {
                    if (
                      payment.staff_id === member.id &&
                      payment.status === "pending"
                    ) {
                      return acc + toNumber(payment.amount)
                    }

                    return acc
                  },
                  0,
                )

                const isSelected = member.id === selectedStaffId

                return (
                  <div
                    key={member.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setSelectedStaffId((current) =>
                        current === member.id ? null : member.id,
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        setSelectedStaffId((current) =>
                          current === member.id ? null : member.id,
                        )
                      }
                    }}
                    className={cn(
                      "cursor-pointer rounded-xl border bg-[#0A0A0A] p-3 transition hover:border-yellow-400/30 hover:bg-yellow-400/10",
                      isSelected
                        ? "border-yellow-400/30 bg-yellow-400/10 ring-1 ring-yellow-400/20"
                        : "border-white/10",
                    )}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                            isClt
                              ? "bg-yellow-400/10 text-yellow-400"
                              : "bg-yellow-400/10 text-yellow-400",
                          )}
                        >
                          {member.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">
                            {member.name}
                          </p>
                          <p className="truncate text-sm text-zinc-500">
                            {member.role}
                            {member.phone ? ` • ${member.phone}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-2 text-sm sm:grid-cols-2 md:min-w-[520px] md:grid-cols-4">
                        <ListInfo
                          label="Tipo"
                          value={workerTypeLabels[member.worker_type] || member.worker_type}
                        />
                        <ListInfo
                          label={isClt ? "Salário" : "Diária"}
                          value={
                            isClt
                              ? formatCurrency(member.monthly_salary)
                              : formatCurrency(member.daily_rate)
                          }
                        />
                        <ListInfo
                          label="Custo estimado"
                          value={
                            isClt
                              ? formatCurrency(
                                  calculation?.companyCostWithProvisions || 0,
                                )
                              : formatCurrency(member.daily_rate)
                          }
                          valueClassName="text-yellow-400"
                        />
                        <ListInfo
                          label="Pendente"
                          value={formatCurrency(memberPending)}
                          valueClassName="text-yellow-400"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {selectedStaff && selectedCalculation && selectedParsedNotes && (
          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-white">
                    {selectedStaff.name}
                  </h2>

                  <span className="rounded-full bg-yellow-400/10 px-2 py-1 text-xs font-semibold text-yellow-400">
                    {workerTypeLabels[selectedStaff.worker_type] ||
                      selectedStaff.worker_type}
                  </span>

                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-xs font-semibold",
                      selectedStaff.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-[#111111] text-zinc-500",
                    )}
                  >
                    {statusLabels[selectedStaff.status] || selectedStaff.status}
                  </span>
                </div>

                <p className="mt-1 text-sm text-zinc-500">
                  {selectedStaff.role}
                  {selectedStaff.phone ? ` • ${selectedStaff.phone}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleEditStaff(selectedStaff)}
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateStaffStatus(
                      selectedStaff,
                      selectedStaff.status === "active" ? "inactive" : "active",
                    )
                  }
                  className="gap-2"
                >
                  <Power className="h-4 w-4" />
                  {selectedStaff.status === "active" ? "Inativar" : "Ativar"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => deleteStaffMember(selectedStaff)}
                  disabled={deletingStaff}
                  className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  {deletingStaff ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Excluir
                </Button>
              </div>
            </div>

            {selectedStaff.worker_type === "fixed" ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MiniMetric
                    label="Salário base"
                    value={formatCurrency(selectedCalculation.monthlySalary)}
                  />
                  <MiniMetric
                    label="Pendente"
                    value={formatCurrency(selectedStaffPendingTotal)}
                    valueClassName="text-yellow-400"
                  />
                  <MiniMetric
                    label="Custo empresa"
                    value={formatCurrency(
                      selectedCalculation.companyCostWithProvisions,
                    )}
                    valueClassName="text-yellow-400"
                  />
                  <MiniMetric
                    label="Provisões"
                    value={formatCurrency(selectedCalculation.provisions)}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-white/10 p-4">
                    <h3 className="mb-3 font-semibold text-white">
                      Pagamento e benefícios
                    </h3>

                    <CostLine
                      label="Salário base"
                      value={selectedCalculation.monthlySalary}
                    />
                    <CostLine
                      label="Insalubridade"
                      value={selectedCalculation.insalubrityAmount}
                    />
                    <CostLine
                      label="Salário pendente"
                      value={selectedCalculation.salaryWithAdditional}
                      strong
                      valueClassName="text-yellow-400"
                    />

                    <div className="my-3 border-t border-white/10" />

                    <CostLine
                      label="Passagem bruta"
                      value={selectedCalculation.transportGross}
                    />
                    <CostLine
                      label="(-) Desconto VT"
                      value={selectedCalculation.transportEmployeeDiscount}
                    />
                    <CostLine
                      label="VA / Benefícios"
                      value={selectedCalculation.mealBenefit}
                    />
                    <CostLine
                      label="Custo empresa com VT/benefícios"
                      value={selectedCalculation.benefits}
                      strong
                    />
                  </div>

                  <div className="rounded-xl border border-white/10 p-4">
                    <h3 className="mb-3 font-semibold text-white">
                      Encargos e provisões
                    </h3>

                    <CostLine
                      label={`FGTS (${selectedParsedNotes.payrollConfig.fgtsPercent}%)`}
                      value={selectedCalculation.fgts}
                    />
                    <CostLine
                      label={`INSS patronal (${selectedParsedNotes.payrollConfig.companyInssPercent}%)`}
                      value={selectedCalculation.companyInss}
                    />
                    <CostLine
                      label={`RAT (${selectedParsedNotes.payrollConfig.ratPercent}%)`}
                      value={selectedCalculation.rat}
                    />
                    <CostLine
                      label={`Terceiros (${selectedParsedNotes.payrollConfig.thirdPartyPercent}%)`}
                      value={selectedCalculation.thirdParty}
                    />

                    <div className="my-3 border-t border-white/10" />

                    <CostLine
                      label="13º provisionado"
                      value={selectedCalculation.thirteenthProvision}
                    />
                    <CostLine
                      label="Férias provisionadas"
                      value={selectedCalculation.vacationProvision}
                    />
                    <CostLine
                      label="1/3 férias"
                      value={selectedCalculation.vacationThirdProvision}
                    />
                    <CostLine
                      label="Custo total estimado"
                      value={selectedCalculation.companyCostWithProvisions}
                      strong
                      valueClassName="text-yellow-400"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 p-4">
                <h3 className="font-semibold text-white">
                  Freelancer / Diarista
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Valor da diária:{" "}
                  <strong className="text-white">
                    {formatCurrency(selectedStaff.daily_rate)}
                  </strong>
                </p>

                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  onClick={() => fillPaymentFromStaff(selectedStaff)}
                >
                  Lançar diária
                </Button>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-white/10 p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-white">
                    Lançamentos da competência
                  </h3>
                  <p className="text-sm text-zinc-500">
                    Pendências vinculadas ao financeiro.
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fillPaymentFromStaff(selectedStaff)}
                >
                  Custo avulso
                </Button>
              </div>

              {selectedStaffPayments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-sm text-zinc-500">
                  Nenhum lançamento para esta competência.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedStaffPayments.map((payment) => {
                    const component = getPaymentComponent(payment)
                    const isPaid = payment.status === "paid"

                    return (
                      <div
                        key={payment.id}
                        className="flex flex-col gap-2 rounded-lg bg-[#111111] p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-semibold text-white">
                            {componentLabels[component]}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {getPaymentCategory(component, selectedStaff)} •{" "}
                            {getReferenceMonthLabel(payment.reference_month)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 sm:justify-end">
                          <strong
                            className={cn(
                              "text-sm",
                              isPaid ? "text-emerald-400" : "text-yellow-400",
                            )}
                          >
                            {formatCurrency(payment.amount)}
                          </strong>

                          <span
                            className={cn(
                              "rounded-full px-2 py-1 text-xs font-semibold",
                              isPaid
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-yellow-400/10 text-yellow-400",
                            )}
                          >
                            {isPaid ? "Pago" : "Pendente"}
                          </span>

                          {!isPaid && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => markPaymentAsPaid(payment)}
                            >
                              Pagar
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function DashboardCard({
  title,
  value,
  subtitle,
  icon,
  className,
  valueClassName,
}: {
  title: string
  value: string
  subtitle: string
  icon: ReactNode
  className?: string
  valueClassName?: string
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-zinc-500">{title}</p>
          <strong
            className={cn(
              "mt-1 block truncate text-xl font-semibold text-white",
              valueClassName,
            )}
          >
            {value}
          </strong>
          <span className="text-xs text-zinc-500">{subtitle}</span>
        </div>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">
          {icon}
        </div>
      </div>
    </div>
  )
}

function MiniMetric({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#111111] p-3">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <strong className={cn("mt-1 block text-sm text-white", valueClassName)}>
        {value}
      </strong>
    </div>
  )
}

function CostLine({
  label,
  value,
  strong,
  valueClassName,
}: {
  label: string
  value: number
  strong?: boolean
  valueClassName?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span
        className={cn(
          "text-zinc-500",
          strong && "font-semibold text-white",
        )}
      >
        {label}
      </span>

      <strong
        className={cn(
          "text-right text-white",
          strong && "font-semibold",
          valueClassName,
        )}
      >
        {formatCurrency(value)}
      </strong>
    </div>
  )
}

function ListInfo({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className={cn("font-semibold text-white", valueClassName)}>
        {value}
      </p>
    </div>
  )
}