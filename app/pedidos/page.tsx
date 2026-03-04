"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import {
  Search, PauseCircle, PlayCircle, RefreshCw, Filter, X,
  Bike, Store, UtensilsCrossed, AlertTriangle, User, Check
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import KanbanColumn from "@/components/kanban-column"
import { OrderDetailsModal } from "@/components/order-card"
import type { KanbanOrder, KanbanStatus, OrderType, OrderPayment, DeliveryStatus } from "@/components/order-card"
import { cn } from "@/lib/utils"
import { getActiveDeliveryStaff, type StaffMember } from "@/lib/staff-data"

// ── Deterministic mock data (hydration-safe: no Date.now() at module level) ──

function buildMockOrders(now: number): KanbanOrder[] {
  return [
    {
      id: "4830", customerName: "Lucas Ferreira", customerPhone: "(11) 99887-1234",
      customerAddress: "Rua das Flores, 123 - Vila Nova",
      items: [
        { name: "Pizza Margherita", quantity: 2, price: 45.9 },
        { name: "Refrigerante 2L", quantity: 1, price: 12.0 },
      ],
      total: 103.8, time: "14:32", status: "pendente", type: "delivery", payment: "pix",
      priority: "normal", createdAt: now - 120_000,
      deliveryFee: 8, deliveryStatus: "nao_atribuido",
    },
    {
      id: "4831", customerName: "Ana Carolina Silva", customerPhone: "(11) 98765-4321",
      items: [
        { name: "Hamburguer Artesanal", quantity: 1, price: 38.5 },
        { name: "Batata Frita G", quantity: 1, price: 18.0 },
        { name: "Milkshake Chocolate", quantity: 2, price: 22.0 },
      ],
      total: 100.5, time: "14:28", status: "pendente", type: "retirada", payment: "cartao",
      priority: "alta", observations: "Sem cebola no hamburguer", createdAt: now - 180_000,
    },
    {
      id: "4832", customerName: "Roberto Santos", customerPhone: "(21) 97654-3210",
      customerAddress: "Av. Brasil, 456 - Centro",
      items: [
        { name: "Acai 500ml", quantity: 3, price: 25.0 },
        { name: "Granola Extra", quantity: 3, price: 5.0 },
      ],
      total: 90.0, time: "14:15", status: "pendente", type: "delivery", payment: "dinheiro",
      priority: "urgente", createdAt: now - 300_000,
      deliveryFee: 8, deliveryStatus: "nao_atribuido",
    },
    {
      id: "4825", customerName: "Mariana Costa", customerPhone: "(11) 91234-5678",
      items: [
        { name: "Combo Familia", quantity: 1, price: 89.9 },
        { name: "Suco Natural 1L", quantity: 2, price: 15.0 },
      ],
      total: 119.9, time: "13:50", status: "em_preparo", type: "delivery", payment: "pix",
      priority: "normal", prepTime: 25, customerAddress: "Rua Boa Vista, 88 - Jd. America",
      createdAt: now - 600_000,
      deliveryFee: 8, deliveryPersonId: "s4", deliveryPersonName: "Lucas Ferreira", deliveryStatus: "atribuido",
    },
    {
      id: "4826", customerName: "Felipe Oliveira", customerPhone: "(21) 98877-6543",
      items: [
        { name: "Pizza Calabresa G", quantity: 1, price: 52.0 },
        { name: "Borda Recheada", quantity: 1, price: 12.0 },
      ],
      total: 64.0, time: "13:45", status: "em_preparo", type: "retirada", payment: "cartao",
      priority: "alta", prepTime: 35, observations: "Cliente VIP - Prioridade",
      createdAt: now - 900_000,
    },
    {
      id: "4827", customerName: "Juliana Martins", customerPhone: "(11) 95544-3322",
      items: [
        { name: "Lasanha Bolonhesa", quantity: 1, price: 42.0 },
        { name: "Salada Caesar", quantity: 1, price: 28.0 },
      ],
      total: 70.0, time: "13:30", status: "em_preparo", type: "mesa", payment: "cartao",
      priority: "normal", prepTime: 20, tableNumber: 5,
      createdAt: now - 1_200_000,
    },
    {
      id: "4822", customerName: "Carla Mendes", customerPhone: "(11) 94433-2211",
      customerAddress: "Rua Augusta, 200 - Consolacao",
      items: [
        { name: "Salada Caesar", quantity: 2, price: 32.0 },
        { name: "Agua Mineral", quantity: 2, price: 6.0 },
      ],
      total: 76.0, time: "13:20", status: "pronto", type: "delivery", payment: "vale",
      priority: "normal", prepTime: 15,
      createdAt: now - 1_800_000,
      deliveryFee: 8, deliveryPersonId: "s5", deliveryPersonName: "Rafael Costa", deliveryStatus: "atribuido",
    },
    {
      id: "4823", customerName: "Joao Pedro Lima", customerPhone: "(21) 93322-1100",
      items: [
        { name: "Esfiha Carne", quantity: 10, price: 6.5 },
        { name: "Esfiha Queijo", quantity: 5, price: 6.5 },
      ],
      total: 97.5, time: "13:10", status: "pronto", type: "retirada", payment: "pix",
      priority: "normal", prepTime: 20,
      createdAt: now - 2_100_000,
    },
  ]
}

// ── Filter chips ──

type FilterChip = {
  key: string
  label: string
  icon?: typeof Bike
  filter: (o: KanbanOrder) => boolean
}

const FILTER_CHIPS: FilterChip[] = [
  { key: "all", label: "Todos", filter: () => true },
  { key: "delivery", label: "Delivery", icon: Bike, filter: (o) => o.type === "delivery" },
  { key: "retirada", label: "Retirada", icon: Store, filter: (o) => o.type === "retirada" },
  { key: "mesa", label: "Mesa", icon: UtensilsCrossed, filter: (o) => o.type === "mesa" },
  { key: "atrasados", label: "Atrasados", icon: AlertTriangle, filter: () => false }, // computed dynamically
  { key: "pix", label: "Pix", filter: (o) => o.payment === "pix" },
  { key: "cartao", label: "Cartao", filter: (o) => o.payment === "cartao" },
]

// ── Column config ──

const COLUMNS: { status: KanbanStatus; title: string; color: string }[] = [
  { status: "pendente", title: "Pendentes", color: "#EAB308" },
  { status: "em_preparo", title: "Em Preparo", color: "#3B82F6" },
  { status: "pronto", title: "Pronto", color: "#22C55E" },
]

// ── Page Component ──

export default function PedidosPage() {
  const [mounted, setMounted] = useState(false)
  const [orders, setOrders] = useState<KanbanOrder[]>([])
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("all")
  const [isPaused, setIsPaused] = useState(false)
  const [detailOrder, setDetailOrder] = useState<KanbanOrder | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [assigningOrder, setAssigningOrder] = useState<KanbanOrder | null>(null)
  const [deliveryStaff, setDeliveryStaff] = useState<StaffMember[]>([])

  // Hydration-safe init: only build orders after mount
  useEffect(() => {
    setOrders(buildMockOrders(Date.now()))
    setDeliveryStaff(getActiveDeliveryStaff())
    setMounted(true)
  }, [])

  // ── Actions ──

  const moveOrder = useCallback((orderId: string, newStatus: KanbanStatus | "remover", prepTime?: number) => {
    setExitingIds((prev) => new Set(prev).add(orderId))
    setTimeout(() => {
      setOrders((prev) => {
        if (newStatus === "remover") return prev.filter((o) => o.id !== orderId)
        return prev.map((o) =>
          o.id === orderId
            ? { ...o, status: newStatus, ...(prepTime !== undefined ? { prepTime } : {}) }
            : o
        )
      })
      setExitingIds((prev) => { const n = new Set(prev); n.delete(orderId); return n })
      setDetailOrder(null)
    }, 350)
  }, [])

  // ── Assign Delivery Person ──

  const handleAssignDelivery = useCallback((orderId: string, staff: StaffMember) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              deliveryPersonId: staff.id,
              deliveryPersonName: staff.name,
              deliveryFee: staff.baseValue,
              deliveryStatus: "atribuido" as DeliveryStatus,
            }
          : o
      )
    )
    setAssigningOrder(null)
  }, [])

  // ── Filtering ──

  const filteredOrders = useMemo(() => {
    let result = orders

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((o) =>
        o.id.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q)
      )
    }

    // Filter chip
    if (activeFilter !== "all") {
      if (activeFilter === "atrasados") {
        const now = Date.now()
        result = result.filter((o) => {
          const elapsedMin = Math.floor((now - o.createdAt) / 60_000)
          return o.prepTime ? elapsedMin > o.prepTime : elapsedMin > 30
        })
      } else {
        const chip = FILTER_CHIPS.find((c) => c.key === activeFilter)
        if (chip) result = result.filter(chip.filter)
      }
    }

    return result
  }, [orders, searchQuery, activeFilter])

  // ── Column data ──

  const columnOrders = useMemo(() => {
    const map: Record<string, KanbanOrder[]> = {
      pendente: [], em_preparo: [], pronto: [],
    }
    for (const o of filteredOrders) {
      if (map[o.status]) map[o.status].push(o)
    }
    return map
  }, [filteredOrders])

  // ── Status history helper ──

  const getStatusHistory = (order: KanbanOrder) => {
    const history: { status: string; time: string }[] = []
    const statuses: KanbanStatus[] = ["pendente", "em_preparo", "pronto"]
    const currentIdx = statuses.indexOf(order.status)
    const labels = ["Recebido", "Em Preparo", "Pronto"]
    for (let i = 0; i <= Math.max(0, currentIdx); i++) {
      const offset = i * 8
      const h = parseInt(order.time.split(":")[0]) || 12
      const m = (parseInt(order.time.split(":")[1]) || 0) + offset
      history.push({
        status: labels[i],
        time: `${h}:${m.toString().padStart(2, "0")}`,
      })
    }
    return history
  }

  // ── Render actions per column ──

  const getColumnActions = useCallback((order: KanbanOrder) => {
    switch (order.status) {
      case "pendente":
        return [
          { label: "Aceitar", color: "bg-green-600 hover:bg-green-700", onClick: (pt?: number) => moveOrder(order.id, "em_preparo", pt) },
          { label: "Negar", color: "bg-red-600 hover:bg-red-700", onClick: () => moveOrder(order.id, "remover") },
        ]
      case "em_preparo":
        return [{ label: "Pronto", color: "bg-blue-600 hover:bg-blue-700", onClick: () => moveOrder(order.id, "pronto") }]
      case "pronto":
        return order.type === "delivery"
          ? [{ label: "Despachar", color: "bg-purple-600 hover:bg-purple-700", onClick: () => moveOrder(order.id, "remover") }]
          : [{ label: "Finalizar", color: "bg-green-700 hover:bg-green-800", onClick: () => moveOrder(order.id, "remover") }]
      default:
        return []
    }
  }, [moveOrder])

  // ── Skeleton state before mount ──

  if (!mounted) {
    return (
      <AdminLayout>
        <div className="p-6 space-y-6">
          <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-96 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        {/* ── Page Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight text-balance">Pedidos</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {orders.length} pedidos ativos agora
            </p>
          </div>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.97]",
              isPaused
                ? "bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/25"
                : "bg-card border border-border text-foreground hover:bg-secondary"
            )}
          >
            {isPaused ? <><PauseCircle className="h-4 w-4" />Pausado</> : <><PlayCircle className="h-4 w-4" />Pausar</>}
          </button>
        </div>

        {/* ── Paused Banner ── */}
        {isPaused && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
            <PauseCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Recebimento de pedidos pausado</p>
              <p className="text-xs text-amber-600 mt-0.5">Novos pedidos estao bloqueados. Clique em &quot;Pausado&quot; para retomar.</p>
            </div>
          </div>
        )}

        {/* ── Search + Filters ── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por pedido ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-10"
              />
            </div>
            {/* Toggle filters */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                showFilters
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                  : "border-border text-muted-foreground hover:bg-secondary"
              )}
            >
              <Filter className="h-4 w-4" />
              Filtros
            </button>
            {/* Refresh */}
            <button
              onClick={() => setOrders(buildMockOrders(Date.now()))}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
          </div>

          {/* Filter chips */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
              {FILTER_CHIPS.map((chip) => {
                const isActive = activeFilter === chip.key
                const ChipIcon = chip.icon
                return (
                  <button
                    key={chip.key}
                    onClick={() => setActiveFilter(isActive ? "all" : chip.key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.97]",
                      isActive
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    {ChipIcon && <ChipIcon className="h-3 w-3" />}
                    {chip.label}
                    {isActive && chip.key !== "all" && <X className="h-3 w-3 ml-0.5" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Kanban Board ── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.status}>
              <KanbanColumn
                title={col.title}
                headerColor={col.color}
                count={columnOrders[col.status].length}
                orders={columnOrders[col.status]}
                exitingIds={exitingIds}
                renderActions={getColumnActions}
                onViewDetails={setDetailOrder}
                onAssignDelivery={setAssigningOrder}
              />
            </div>
          ))}
        </div>

        {/* ── Order Details Modal ── */}
        {detailOrder && (
          <OrderDetailsModal
            order={detailOrder}
            onClose={() => setDetailOrder(null)}
            actions={getColumnActions(detailOrder).map((a) => ({
              label: a.label,
              color: a.color,
              onClick: () => a.onClick(),
            }))}
            statusHistory={getStatusHistory(detailOrder)}
            onAssignDelivery={setAssigningOrder}
          />
        )}

        {/* ── Delivery Assignment Modal ── */}
        {assigningOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAssigningOrder(null)}>
            <div
              className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <h3 className="text-lg font-bold text-card-foreground">Atribuir Entregador</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Pedido #{assigningOrder.id}</p>
                </div>
                <button onClick={() => setAssigningOrder(null)} className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Order Info */}
              <div className="border-b border-border px-6 py-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{assigningOrder.customerName}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    R$ {assigningOrder.total.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                {assigningOrder.customerAddress && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-1">
                    {assigningOrder.customerAddress}
                  </p>
                )}
              </div>

              {/* Delivery Staff List */}
              <div className="px-6 py-4 max-h-80 overflow-y-auto">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Entregadores Disponiveis
                </p>
                <div className="space-y-2">
                  {deliveryStaff.map((staff) => {
                    const isCurrentAssigned = assigningOrder.deliveryPersonId === staff.id
                    return (
                      <button
                        key={staff.id}
                        onClick={() => handleAssignDelivery(assigningOrder.id, staff)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border p-3 transition-all",
                          isCurrentAssigned
                            ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200"
                            : "border-border hover:bg-muted/50 hover:border-border"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold",
                            isCurrentAssigned ? "bg-blue-200 text-blue-700" : "bg-secondary text-muted-foreground"
                          )}>
                            {staff.name.charAt(0)}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-card-foreground">{staff.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {staff.deliveriesToday || 0} entregas hoje
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-card-foreground">
                            R$ {staff.baseValue.toFixed(2).replace(".", ",")}
                          </p>
                          <p className="text-[10px] text-muted-foreground">por entrega</p>
                          {isCurrentAssigned && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              <Check className="h-3 w-3" /> Atribuido
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/30">
                <div>
                  <p className="text-xs text-muted-foreground">Taxa de entrega</p>
                  <p className="text-sm font-semibold text-card-foreground">
                    R$ {(assigningOrder.deliveryFee || 8).toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <button
                  onClick={() => setAssigningOrder(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
