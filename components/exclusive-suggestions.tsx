"use client"

import { useState } from "react"
import {
  Brain,
  Check,
  Gift,
  Send,
  UserCheck,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  ExclusiveSuggestion,
  ExclusiveReason,
} from "@/lib/coupons-data"
import { exclusiveReasonLabels } from "@/lib/coupons-data"

interface ExclusiveSuggestionsProps {
  suggestions: ExclusiveSuggestion[]
  onAccept: (suggestion: ExclusiveSuggestion) => void
  onDismiss: (id: string) => void
}

const reasonIcons: Record<ExclusiveReason, React.ReactNode> = {
  fidelidade: <Gift className="h-4 w-4" />,
  pedido_cancelado: <X className="h-4 w-4" />,
  cliente_vip: <UserCheck className="h-4 w-4" />,
  recuperacao_inativo: <Send className="h-4 w-4" />,
  manual: <Gift className="h-4 w-4" />,
}

const reasonAccentColor: Record<ExclusiveReason, string> = {
  fidelidade: "border-blue-200 bg-blue-50",
  pedido_cancelado: "border-red-200 bg-red-50",
  cliente_vip: "border-amber-200 bg-amber-50",
  recuperacao_inativo: "border-green-200 bg-green-50",
  manual: "border-border bg-muted",
}

const reasonIconColor: Record<ExclusiveReason, string> = {
  fidelidade: "bg-blue-100 text-blue-600",
  pedido_cancelado: "bg-red-100 text-red-600",
  cliente_vip: "bg-amber-100 text-amber-600",
  recuperacao_inativo: "bg-green-100 text-green-600",
  manual: "bg-muted text-muted-foreground",
}

export default function ExclusiveSuggestions({ suggestions, onAccept, onDismiss }: ExclusiveSuggestionsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [accepted, setAccepted] = useState<Set<string>>(new Set())

  const visibleSuggestions = suggestions.filter(
    (s) => !dismissed.has(s.id) && !accepted.has(s.id)
  )

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id))
    onDismiss(id)
  }

  const handleAccept = (suggestion: ExclusiveSuggestion) => {
    setAccepted((prev) => new Set(prev).add(suggestion.id))
    onAccept(suggestion)
  }

  if (visibleSuggestions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <Brain className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">
          Nenhuma sugestao pendente no momento
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Brain className="h-5 w-5 text-[hsl(var(--primary))]" />
        <div>
          <h3 className="text-sm font-bold text-card-foreground">Inteligencia Estrategica</h3>
          <p className="text-xs text-muted-foreground">Sugestoes automaticas baseadas no comportamento dos clientes</p>
        </div>
      </div>

      <div className="p-5 space-y-3">
        {visibleSuggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className={cn(
              "flex items-start gap-4 rounded-xl border p-4 transition-all",
              reasonAccentColor[suggestion.reason]
            )}
          >
            <span className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
              reasonIconColor[suggestion.reason]
            )}>
              {reasonIcons[suggestion.reason]}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-card-foreground">{suggestion.clientName}</span>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  reasonIconColor[suggestion.reason]
                )}>
                  {exclusiveReasonLabels[suggestion.reason]}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{suggestion.message}</p>
              <div className="mt-1.5 text-xs text-muted-foreground">
                Desconto sugerido:{" "}
                <span className="font-semibold text-card-foreground">
                  {suggestion.suggestedDiscountType === "percentual"
                    ? `${suggestion.suggestedDiscount}%`
                    : `R$ ${suggestion.suggestedDiscount},00`}
                </span>
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-1.5">
              <button
                onClick={() => handleAccept(suggestion)}
                className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90"
              >
                <Check className="h-3 w-3" />
                Enviar
              </button>
              <button
                onClick={() => handleDismiss(suggestion.id)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                aria-label="Dispensar sugestao"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
