"use client"

import { AlertTriangle, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "warning"
  isLoading?: boolean
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmar exclusao",
  cancelLabel = "Cancelar",
  variant = "danger",
  isLoading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <div
            className={cn(
              "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full",
              variant === "danger" ? "bg-red-100" : "bg-amber-100"
            )}
          >
            <AlertTriangle
              className={cn(
                "h-6 w-6",
                variant === "danger" ? "text-red-600" : "text-amber-600"
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-card-foreground">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4 bg-muted/30">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50",
              variant === "danger"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-amber-600 hover:bg-amber-700"
            )}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
