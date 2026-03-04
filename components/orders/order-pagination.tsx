"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface PaginationProps {
  page: number
  totalPages: number
  totalItems: number
  perPage: number
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
}

const PER_PAGE_OPTIONS = [10, 25, 50]

export default function OrderPagination({
  page,
  totalPages,
  totalItems,
  perPage,
  onPageChange,
  onPerPageChange,
}: PaginationProps) {
  const startItem = (page - 1) * perPage + 1
  const endItem = Math.min(page * perPage, totalItems)

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      {/* Info + per page */}
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-card-foreground">{startItem}</span>
          {" - "}
          <span className="font-medium text-card-foreground">{endItem}</span>
          {" de "}
          <span className="font-medium text-card-foreground">{totalItems}</span>
          {" registros"}
        </p>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Exibir:</label>
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(parseInt(e.target.value))}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground shadow-sm focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]/20"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm transition-colors",
            page <= 1
              ? "cursor-not-allowed text-muted-foreground/40"
              : "hover:bg-muted text-card-foreground"
          )}
          aria-label="Pagina anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page numbers */}
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNum: number
          if (totalPages <= 5) {
            pageNum = i + 1
          } else if (page <= 3) {
            pageNum = i + 1
          } else if (page >= totalPages - 2) {
            pageNum = totalPages - 4 + i
          } else {
            pageNum = page - 2 + i
          }

          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={cn(
                "flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors",
                pageNum === page
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "border-border text-card-foreground hover:bg-muted"
              )}
            >
              {pageNum}
            </button>
          )
        })}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm transition-colors",
            page >= totalPages
              ? "cursor-not-allowed text-muted-foreground/40"
              : "hover:bg-muted text-card-foreground"
          )}
          aria-label="Proxima pagina"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
