"use client"

import { useState, useMemo, useCallback } from "react"
import { Download } from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import OrderSearchBar from "@/components/orders/search-bar"
import OrderFiltersPanel from "@/components/orders/order-filters"
import OrderSummaryCards from "@/components/orders/summary-cards"
import OrdersTable from "@/components/orders/orders-table"
import OrderPagination from "@/components/orders/order-pagination"
import OrderDetailsModal from "@/components/orders/order-details-modal"
import {
  type Order,
  type OrderStatus,
  type OrderFilters,
  DEFAULT_FILTERS,
  filterOrders,
  getOrderSummary,
  paginateOrders,
  exportOrdersCSV,
} from "@/lib/orders-data"

export default function HistoricoPedidosPage() {
  const [filters, setFilters] = useState<OrderFilters>(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [statusOverrides, setStatusOverrides] = useState<Record<string, OrderStatus>>({})

  // Filter + apply status overrides
  const filteredOrders = useMemo(() => {
    const raw = filterOrders(filters)
    return raw.map((o) =>
      statusOverrides[o.id] ? { ...o, status: statusOverrides[o.id] } : o
    )
  }, [filters, statusOverrides])

  // Summary from filtered data
  const summary = useMemo(() => getOrderSummary(filteredOrders), [filteredOrders])

  // Paginate
  const { data: pageOrders, totalPages, totalItems } = useMemo(
    () => paginateOrders(filteredOrders, page, perPage),
    [filteredOrders, page, perPage]
  )

  // Reset page on filter change
  const handleFiltersChange = useCallback((newFilters: OrderFilters) => {
    setFilters(newFilters)
    setPage(1)
  }, [])

  const handleSearchChange = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }))
    setPage(1)
  }, [])

  const handlePerPageChange = useCallback((newPerPage: number) => {
    setPerPage(newPerPage)
    setPage(1)
  }, [])

  // Status change from modal
  const handleStatusChange = useCallback((orderId: string, newStatus: OrderStatus) => {
    setStatusOverrides((prev) => ({ ...prev, [orderId]: newStatus }))
    setSelectedOrder((prev) => (prev && prev.id === orderId ? { ...prev, status: newStatus } : prev))
  }, [])

  // CSV export
  const handleExportCSV = useCallback(() => {
    const csv = exportOrdersCSV(filteredOrders)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `pedidos_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [filteredOrders])

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Historico de Pedidos
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Visualize e filtre todos os pedidos realizados
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-card-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>

        {/* Search */}
        <OrderSearchBar value={filters.search} onChange={handleSearchChange} />

        {/* Advanced Filters */}
        <OrderFiltersPanel
          filters={filters}
          onChange={handleFiltersChange}
          loading={false}
        />

        {/* Summary Cards */}
        <OrderSummaryCards summary={summary} loading={false} />

        {/* Table */}
        <OrdersTable
          orders={pageOrders}
          loading={false}
          onViewDetails={setSelectedOrder}
        />

        {/* Pagination */}
        {totalItems > 0 && (
          <OrderPagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            perPage={perPage}
            onPageChange={setPage}
            onPerPageChange={handlePerPageChange}
          />
        )}

        {/* Details Modal */}
        {selectedOrder && (
          <OrderDetailsModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>
    </AdminLayout>
  )
}
