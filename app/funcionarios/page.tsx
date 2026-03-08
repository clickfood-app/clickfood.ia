"use client"

import React, { useState, useMemo, useCallback } from "react"
import AdminLayout from "@/components/admin-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Users,
  Truck,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  CheckCircle,
  Phone,
  Mail,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Banknote,
  Package,
  Percent,
  PlusCircle,
  Trash2,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  type StaffMember,
  type StaffType,
  type PaymentModel,
  type PaymentStatus,
  type ManualPayment,
  type ManualPaymentType,
  type ManualPaymentMethod,
  type ManualPaymentStatus,
  getAllStaffMembers,
  getStaffSummary,
  getPaymentsByStaffId,
  getTodayDeliveriesByStaffId,
  getManualPaymentsByStaffId,
  formatBRL,
  formatPaymentModel,
  formatStaffType,
  formatManualPaymentType,
  formatManualPaymentMethod,
  isNegativePaymentType,
} from "@/lib/staff-data"

type FilterType = "todos" | "funcionario" | "entregador"
type FilterPeriod = "hoje" | "semana" | "mes"
type ViewMode = "list" | "details"

const ITEMS_PER_PAGE = 8

export default function FuncionariosPage() {
  const [mounted, setMounted] = useState(false)
  const [filterType, setFilterType] = useState<FilterType>("todos")
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("hoje")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentModalStaff, setPaymentModalStaff] = useState<StaffMember | null>(null)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [manualPayments, setManualPayments] = useState<ManualPayment[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Form state for new staff modal
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    type: "funcionario" as StaffType,
    paymentModel: "mensal" as PaymentModel,
    baseValue: "",
    pixKey: "",
    phone: "",
    active: true,
  })

  // Form state for manual payment modal
  const [paymentFormData, setPaymentFormData] = useState({
    type: "bonus" as ManualPaymentType,
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "pix" as ManualPaymentMethod,
    status: "pendente" as ManualPaymentStatus,
  })

  // Mount effect
  React.useEffect(() => {
    setStaff(getAllStaffMembers())
    // Initialize manual payments from all staff
    const allPayments: ManualPayment[] = []
    getAllStaffMembers().forEach(s => {
      allPayments.push(...getManualPaymentsByStaffId(s.id))
    })
    setManualPayments(allPayments)
    setMounted(true)
  }, [])

  // Filtered staff
  const filteredStaff = useMemo(() => {
    let result = staff.filter(s => s.active)

    if (filterType !== "todos") {
      result = result.filter(s => s.type === filterType)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q)
      )
    }

    return result
  }, [staff, filterType, searchQuery])

  // Pagination
  const totalPages = Math.ceil(filteredStaff.length / ITEMS_PER_PAGE)
  const paginatedStaff = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredStaff.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredStaff, currentPage])

  // Summary
  const summary = useMemo(() => getStaffSummary(), [])

  // Get manual payments for a specific staff member
  const getStaffManualPayments = useCallback((staffId: string) => {
    return manualPayments.filter(p => p.staffId === staffId)
  }, [manualPayments])

  // Calculate staff financials with manual payments
  const getStaffFinancials = useCallback((member: StaffMember) => {
    const payments = getStaffManualPayments(member.id)
    let totalPositive = 0
    let totalNegative = 0
    
    for (const payment of payments) {
      if (isNegativePaymentType(payment.type)) {
        totalNegative += payment.amount
      } else {
        totalPositive += payment.amount
      }
    }
    
    const grossTotal = member.monthEarnings + totalPositive
    const adjustments = totalPositive - totalNegative
    const netTotal = grossTotal - totalNegative
    
    return { grossTotal, adjustments, netTotal, totalPositive, totalNegative }
  }, [getStaffManualPayments])

  // Handlers
  const handleViewDetails = useCallback((member: StaffMember) => {
    setSelectedStaff(member)
    setViewMode("details")
  }, [])

  const handleMarkAsPaid = useCallback((id: string) => {
    setStaff(prev => prev.map(s =>
      s.id === id ? { ...s, status: "pago" as PaymentStatus } : s
    ))
  }, [])

  const handleBackToList = useCallback(() => {
    setViewMode("list")
    setSelectedStaff(null)
  }, [])

  const handleOpenPaymentModal = useCallback((member: StaffMember) => {
    setPaymentModalStaff(member)
    setPaymentFormData({
      type: "bonus",
      amount: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      paymentMethod: "pix",
      status: "pendente",
    })
    setIsPaymentModalOpen(true)
  }, [])

  const handleSaveNewStaff = useCallback(async () => {
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 800))

    const newMember: StaffMember = {
      id: `s${Date.now()}`,
      restaurantId: "r1",
      name: formData.name,
      role: formData.role,
      type: formData.type,
      paymentModel: formData.paymentModel,
      baseValue: parseFloat(formData.baseValue) || 0,
      pixKey: formData.pixKey || undefined,
      phone: formData.phone,
      active: formData.active,
      createdAt: new Date().toISOString().split("T")[0],
      todayEarnings: 0,
      monthEarnings: 0,
      avgDaily: 0,
      status: "pendente",
      deliveriesToday: formData.type === "entregador" ? 0 : undefined,
      deliveriesMonth: formData.type === "entregador" ? 0 : undefined,
    }

    setStaff(prev => [newMember, ...prev])
    setIsNewModalOpen(false)
    setFormData({
      name: "",
      role: "",
      type: "funcionario",
      paymentModel: "mensal",
      baseValue: "",
      pixKey: "",
      phone: "",
      active: true,
    })
    setIsSaving(false)
  }, [formData])

  const handleSaveManualPayment = useCallback(async () => {
    if (!paymentModalStaff) return
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 600))

    const newPayment: ManualPayment = {
      id: `mp${Date.now()}`,
      staffId: paymentModalStaff.id,
      restaurantId: "r1",
      type: paymentFormData.type,
      amount: parseFloat(paymentFormData.amount) || 0,
      description: paymentFormData.description,
      date: paymentFormData.date,
      paymentMethod: paymentFormData.paymentMethod,
      status: paymentFormData.status,
    }

    setManualPayments(prev => [newPayment, ...prev])

    // Update staff earnings based on payment type
    const amount = parseFloat(paymentFormData.amount) || 0
    const isNegative = isNegativePaymentType(paymentFormData.type)
    
    setStaff(prev => prev.map(s => {
      if (s.id === paymentModalStaff.id) {
        return {
          ...s,
          todayEarnings: s.todayEarnings + (isNegative ? -amount : amount),
          monthEarnings: s.monthEarnings + (isNegative ? -amount : amount),
        }
      }
      return s
    }))

    setIsPaymentModalOpen(false)
    setPaymentModalStaff(null)
    setIsSaving(false)
  }, [paymentFormData, paymentModalStaff])

  const handleDeleteManualPayment = useCallback((paymentId: string) => {
    const payment = manualPayments.find(p => p.id === paymentId)
    if (!payment) return

    setManualPayments(prev => prev.filter(p => p.id !== paymentId))
    
    // Revert the earnings
    const isNegative = isNegativePaymentType(payment.type)
    setStaff(prev => prev.map(s => {
      if (s.id === payment.staffId) {
        return {
          ...s,
          todayEarnings: s.todayEarnings + (isNegative ? payment.amount : -payment.amount),
          monthEarnings: s.monthEarnings + (isNegative ? payment.amount : -payment.amount),
        }
      }
      return s
    }))
  }, [manualPayments])

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      role: "",
      type: "funcionario",
      paymentModel: "mensal",
      baseValue: "",
      pixKey: "",
      phone: "",
      active: true,
    })
  }, [])

  // Skeleton for initial load
  if (!mounted) {
    return (
      <AdminLayout>
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </AdminLayout>
    )
  }

  // Details View
  if (viewMode === "details" && selectedStaff) {
    return (
      <AdminLayout>
        <StaffDetailsView
          staff={selectedStaff}
          onBack={handleBackToList}
          onMarkAsPaid={() => handleMarkAsPaid(selectedStaff.id)}
          onAddPayment={() => handleOpenPaymentModal(selectedStaff)}
          manualPayments={getStaffManualPayments(selectedStaff.id)}
          financials={getStaffFinancials(selectedStaff)}
          onDeletePayment={handleDeleteManualPayment}
        />
      </AdminLayout>
    )
  }

  // List View
  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestao de Funcionarios</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie sua equipe e controle os pagamentos
            </p>
          </div>
          <Button
            onClick={() => setIsNewModalOpen(true)}
            className="gap-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
          >
            <Plus className="h-4 w-4" />
            Novo Funcionario
          </Button>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["todos", "funcionario", "entregador"] as FilterType[]).map(type => (
              <button
                key={type}
                onClick={() => { setFilterType(type); setCurrentPage(1) }}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  filterType === type
                    ? "bg-[hsl(var(--primary))] text-white"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                )}
              >
                {type === "todos" ? "Todos" : type === "funcionario" ? "Funcionarios" : "Entregadores"}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(["hoje", "semana", "mes"] as FilterPeriod[]).map(period => (
              <button
                key={period}
                onClick={() => setFilterPeriod(period)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  filterPeriod === period
                    ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                    : "text-muted-foreground hover:bg-secondary"
                )}
              >
                {period === "hoje" ? "Hoje" : period === "semana" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={<DollarSign className="h-5 w-5" />}
            iconBg="bg-blue-100 text-blue-600"
            title="Total Gasto Hoje"
            value={formatBRL(summary.totalToday)}
            subtitle="Com toda equipe"
            variation={summary.totalTodayVariation}
          />
          <SummaryCard
            icon={<Truck className="h-5 w-5" />}
            iconBg="bg-purple-100 text-purple-600"
            title="Entregadores Hoje"
            value={formatBRL(summary.entregadorestoday)}
            subtitle={`${summary.totalEntregadores} ativos`}
            variation={summary.entregadoresVariation}
          />
          <SummaryCard
            icon={<Users className="h-5 w-5" />}
            iconBg="bg-green-100 text-green-600"
            title="Funcionarios Hoje"
            value={formatBRL(summary.funcionariosToday)}
            subtitle={`${summary.totalFuncionarios} ativos`}
            variation={summary.funcionariosVariation}
          />
          <SummaryCard
            icon={<Percent className="h-5 w-5" />}
            iconBg="bg-orange-100 text-orange-600"
            title="% do Faturamento"
            value={`${summary.percentOfRevenue.toFixed(1)}%`}
            subtitle="Comprometido c/ equipe"
            variation={summary.percentVariation}
          />
        </div>

        {/* Search + Table */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                className="pl-9"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredStaff.length} funcionario(s)
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cargo</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">Tipo</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell">Modelo Pgto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ganho Hoje</th>
                  <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:table-cell">Ganho Mes</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStaff.map(member => (
                  <tr
                    key={member.id}
                    className="group border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-sm font-semibold text-[hsl(var(--primary))]">
                          {member.name.charAt(0)}
                        </div>
                        <span className="font-medium text-foreground">{member.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{member.role}</td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                        member.type === "funcionario"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                      )}>
                        {member.type === "funcionario" ? <Users className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                        {formatStaffType(member.type)}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                      {formatPaymentModel(member.paymentModel)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-foreground">{formatBRL(member.todayEarnings)}</span>
                      {member.type === "entregador" && member.deliveriesToday !== undefined && (
                        <p className="text-xs text-muted-foreground">{member.deliveriesToday} entregas</p>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm text-muted-foreground sm:table-cell">
                      {formatBRL(member.monthEarnings)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        member.status === "pago"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      )}>
                        {member.status === "pago" ? "Pago" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(member)} className="gap-2 cursor-pointer">
                            <Eye className="h-4 w-4" />
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenPaymentModal(member)} className="gap-2 cursor-pointer">
                            <PlusCircle className="h-4 w-4" />
                            Adicionar Pagamento
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {member.status === "pendente" && (
                            <DropdownMenuItem onClick={() => handleMarkAsPaid(member.id)} className="gap-2 cursor-pointer">
                              <CheckCircle className="h-4 w-4" />
                              Marcar como pago
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {paginatedStaff.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      Nenhum funcionario encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Pagina {currentPage} de {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:pointer-events-none"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:pointer-events-none"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Staff Modal */}
      <Dialog open={isNewModalOpen} onOpenChange={open => { setIsNewModalOpen(open); if (!open) resetForm() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Funcionario</DialogTitle>
            <DialogDescription>
              Preencha os dados para cadastrar um novo membro da equipe.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                placeholder="Ex: Joao da Silva"
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Cargo</Label>
              <Input
                id="role"
                placeholder="Ex: Cozinheiro, Atendente, Entregador"
                value={formData.role}
                onChange={e => setFormData(f => ({ ...f, role: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v: StaffType) => setFormData(f => ({ ...f, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="funcionario">Funcionario Interno</SelectItem>
                    <SelectItem value="entregador">Entregador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Modelo de Pagamento</Label>
                <Select
                  value={formData.paymentModel}
                  onValueChange={(v: PaymentModel) => setFormData(f => ({ ...f, paymentModel: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="diaria">Diaria</SelectItem>
                    <SelectItem value="turno">Por Turno</SelectItem>
                    <SelectItem value="entrega">Por Entrega</SelectItem>
                    <SelectItem value="percentual">Percentual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="baseValue">
                {formData.paymentModel === "mensal" ? "Salario Mensal" :
                 formData.paymentModel === "diaria" ? "Valor da Diaria" :
                 formData.paymentModel === "turno" ? "Valor por Turno" :
                 formData.paymentModel === "entrega" ? "Valor por Entrega" :
                 "Percentual por Pedido (%)"}
              </Label>
              <Input
                id="baseValue"
                type="number"
                placeholder={formData.paymentModel === "percentual" ? "Ex: 10" : "Ex: 2500"}
                value={formData.baseValue}
                onChange={e => setFormData(f => ({ ...f, baseValue: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(11) 99999-9999"
                  value={formData.phone}
                  onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pix">Chave Pix (opcional)</Label>
                <Input
                  id="pix"
                  placeholder="email@exemplo.com"
                  value={formData.pixKey}
                  onChange={e => setFormData(f => ({ ...f, pixKey: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="active" className="font-medium">Status Ativo</Label>
                <p className="text-xs text-muted-foreground">Funcionario esta disponivel para trabalho</p>
              </div>
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={v => setFormData(f => ({ ...f, active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveNewStaff}
              disabled={!formData.name || !formData.role || !formData.baseValue || isSaving}
              className="gap-2"
            >
              {isSaving ? "Salvando..." : "Salvar Funcionario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Payment Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lancar Pagamento Manual</DialogTitle>
            <DialogDescription>
              {paymentModalStaff ? `Adicionar lancamento para ${paymentModalStaff.name}` : "Adicionar lancamento financeiro"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Funcionario</Label>
              <Input
                value={paymentModalStaff?.name || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo de Lancamento</Label>
                <Select
                  value={paymentFormData.type}
                  onValueChange={(v: ManualPaymentType) => setPaymentFormData(f => ({ ...f, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bonus">Bonus</SelectItem>
                    <SelectItem value="hora_extra">Hora Extra</SelectItem>
                    <SelectItem value="vale">Vale/Adiantamento</SelectItem>
                    <SelectItem value="desconto">Desconto</SelectItem>
                    <SelectItem value="ajuste">Ajuste Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="paymentAmount">Valor (R$)</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  placeholder="Ex: 100.00"
                  value={paymentFormData.amount}
                  onChange={e => setPaymentFormData(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="paymentDesc">Descricao</Label>
              <Input
                id="paymentDesc"
                placeholder="Ex: Bonus por meta atingida"
                value={paymentFormData.description}
                onChange={e => setPaymentFormData(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="paymentDate">Data</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentFormData.date}
                  onChange={e => setPaymentFormData(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Forma de Pagamento</Label>
                <Select
                  value={paymentFormData.paymentMethod}
                  onValueChange={(v: ManualPaymentMethod) => setPaymentFormData(f => ({ ...f, paymentMethod: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="nao_pago">Nao pago ainda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={paymentFormData.status}
                onValueChange={(v: ManualPaymentStatus) => setPaymentFormData(f => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Preview */}
            <div className={cn(
              "rounded-lg border p-3",
              isNegativePaymentType(paymentFormData.type) ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"
            )}>
              <p className="text-sm font-medium">
                {isNegativePaymentType(paymentFormData.type) ? "Desconto de" : "Acrescimo de"}{" "}
                <span className={isNegativePaymentType(paymentFormData.type) ? "text-red-600" : "text-green-600"}>
                  {formatBRL(parseFloat(paymentFormData.amount) || 0)}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {isNegativePaymentType(paymentFormData.type) 
                  ? "Este valor sera subtraido do total" 
                  : "Este valor sera somado ao total"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveManualPayment}
              disabled={!paymentFormData.amount || !paymentFormData.description || isSaving}
              className="gap-2"
            >
              {isSaving ? "Salvando..." : "Salvar Lancamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}

// Summary Card Component
function SummaryCard({
  icon,
  iconBg,
  title,
  value,
  subtitle,
  variation,
}: {
  icon: React.ReactNode
  iconBg: string
  title: string
  value: string
  subtitle: string
  variation: number
}) {
  const isPositive = variation >= 0

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", iconBg)}>
          {icon}
        </div>
        <div className={cn(
          "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
          isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        )}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isPositive ? "+" : ""}{variation.toFixed(1)}%
        </div>
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground/70">{subtitle}</p>
      </div>
    </div>
  )
}

// Staff Details View Component
function StaffDetailsView({
  staff,
  onBack,
  onMarkAsPaid,
  onAddPayment,
  manualPayments,
  financials,
  onDeletePayment,
}: {
  staff: StaffMember
  onBack: () => void
  onMarkAsPaid: () => void
  onAddPayment: () => void
  manualPayments: ManualPayment[]
  financials: { grossTotal: number; adjustments: number; netTotal: number; totalPositive: number; totalNegative: number }
  onDeletePayment: (id: string) => void
}) {
  const payments = getPaymentsByStaffId(staff.id)
  const todayDeliveries = staff.type === "entregador" ? getTodayDeliveriesByStaffId(staff.id) : []

  return (
    <div className="p-8 space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para lista
      </button>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-2xl font-bold text-[hsl(var(--primary))]">
            {staff.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{staff.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-muted-foreground">{staff.role}</span>
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                staff.type === "funcionario"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-purple-100 text-purple-700"
              )}>
                {staff.type === "funcionario" ? <Users className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                {formatStaffType(staff.type)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={onAddPayment} variant="outline" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Adicionar Pagamento
          </Button>
          {staff.status === "pendente" && (
            <Button onClick={onMarkAsPaid} className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Marcar como Pago
            </Button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span className="text-sm">Telefone</span>
          </div>
          <p className="mt-1 font-medium">{staff.phone}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Banknote className="h-4 w-4" />
            <span className="text-sm">Modelo de Pagamento</span>
          </div>
          <p className="mt-1 font-medium">{formatPaymentModel(staff.paymentModel)}</p>
          <p className="text-xs text-muted-foreground">
            {staff.paymentModel === "percentual" ? `${staff.baseValue}% por pedido` : formatBRL(staff.baseValue)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span className="text-sm">Chave Pix</span>
          </div>
          <p className="mt-1 font-medium">{staff.pixKey || "Nao informado"}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Cadastrado em</span>
          </div>
          <p className="mt-1 font-medium">{staff.createdAt}</p>
        </div>
      </div>

      {/* Financial Summary Cards - NEW */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Total Bruto do Mes</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-blue-800">{formatBRL(financials.grossTotal)}</p>
          <p className="mt-1 text-xs text-blue-600">Base + bonus e extras</p>
        </div>
        <div className={cn(
          "rounded-xl border p-5",
          financials.adjustments >= 0 
            ? "border-green-200 bg-green-50" 
            : "border-red-200 bg-red-50"
        )}>
          <div className="flex items-center gap-2">
            <FileText className={cn("h-5 w-5", financials.adjustments >= 0 ? "text-green-600" : "text-red-600")} />
            <span className={cn("text-sm font-medium", financials.adjustments >= 0 ? "text-green-700" : "text-red-700")}>
              Ajustes (+/-)
            </span>
          </div>
          <p className={cn(
            "mt-2 text-3xl font-bold",
            financials.adjustments >= 0 ? "text-green-800" : "text-red-800"
          )}>
            {financials.adjustments >= 0 ? "+" : ""}{formatBRL(financials.adjustments)}
          </p>
          <p className={cn("mt-1 text-xs", financials.adjustments >= 0 ? "text-green-600" : "text-red-600")}>
            +{formatBRL(financials.totalPositive)} / -{formatBRL(financials.totalNegative)}
          </p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium text-purple-700">Total Liquido a Pagar</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-purple-800">{formatBRL(financials.netTotal)}</p>
          <p className="mt-1 text-xs text-purple-600">Valor final</p>
        </div>
      </div>

      {/* Tabs for different sections */}
      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="movimentacoes">Movimentacoes</TabsTrigger>
          <TabsTrigger value="historico">Historico Pgtos</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="mt-4 space-y-4">
          {/* Daily Financial Summary */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <h2 className="font-semibold text-foreground">Resumo Financeiro Diario</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <p className="text-sm text-green-700">Ganho Hoje</p>
                <p className="mt-1 text-2xl font-bold text-green-800">{formatBRL(staff.todayEarnings)}</p>
                {staff.type === "entregador" && staff.deliveriesToday !== undefined && (
                  <p className="text-xs text-green-600">{staff.deliveriesToday} entregas x {formatBRL(staff.baseValue)}</p>
                )}
              </div>
              <div className="rounded-lg bg-blue-50 p-4 text-center">
                <p className="text-sm text-blue-700">Ganho no Mes (Base)</p>
                <p className="mt-1 text-2xl font-bold text-blue-800">{formatBRL(staff.monthEarnings)}</p>
                {staff.type === "entregador" && staff.deliveriesMonth !== undefined && (
                  <p className="text-xs text-blue-600">{staff.deliveriesMonth} entregas no mes</p>
                )}
              </div>
              <div className="rounded-lg bg-purple-50 p-4 text-center">
                <p className="text-sm text-purple-700">Media Diaria</p>
                <p className="mt-1 text-2xl font-bold text-purple-800">{formatBRL(staff.avgDaily)}</p>
              </div>
            </div>
          </div>

          {/* Delivery History (for delivery staff) */}
          {staff.type === "entregador" && todayDeliveries.length > 0 && (
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border p-4">
                <h2 className="font-semibold text-foreground">Entregas de Hoje</h2>
              </div>
              <div className="divide-y divide-border">
                {todayDeliveries.map(delivery => (
                  <div key={delivery.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                        <Package className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Pedido #{delivery.orderId}</p>
                        <p className="text-sm text-muted-foreground">{delivery.customerName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{formatBRL(delivery.value)}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {delivery.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="movimentacoes" className="mt-4">
          {/* Manual Payments / Financial Movements - NEW */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="font-semibold text-foreground">Movimentacoes Financeiras</h2>
              <Button onClick={onAddPayment} size="sm" variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Lancamento
              </Button>
            </div>
            {manualPayments.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2">Nenhuma movimentacao registrada</p>
                <p className="text-sm">Clique em &quot;Novo Lancamento&quot; para adicionar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descricao</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Forma</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualPayments.map(payment => {
                      const isNegative = isNegativePaymentType(payment.type)
                      return (
                        <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-muted-foreground">{payment.date}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                              isNegative ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                            )}>
                              {formatManualPaymentType(payment.type)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">{payment.description}</td>
                          <td className={cn(
                            "px-4 py-3 text-right font-semibold",
                            isNegative ? "text-red-600" : "text-green-600"
                          )}>
                            {isNegative ? "-" : "+"}{formatBRL(payment.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                              payment.status === "pago" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                            )}>
                              {payment.status === "pago" ? "Pago" : "Pendente"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-muted-foreground capitalize">
                            {formatManualPaymentMethod(payment.paymentMethod)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors mx-auto">
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem className="gap-2 cursor-pointer text-red-600" onClick={() => onDeletePayment(payment.id)}>
                                  <Trash2 className="h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          {/* Payment History */}
          {payments.length > 0 ? (
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border p-4">
                <h2 className="font-semibold text-foreground">Historico de Pagamentos</h2>
              </div>
              <div className="divide-y divide-border">
                {payments.map(payment => (
                  <div key={payment.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{payment.period}</p>
                        <p className="text-sm text-muted-foreground capitalize">{payment.method}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">{formatBRL(payment.amount)}</p>
                      <p className="text-xs text-muted-foreground">{payment.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2">Nenhum pagamento registrado ainda</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
