"use client"

import { useState } from "react"
import { Brain, Check, Gift, Send, UserCheck, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ExclusiveSuggestion, ExclusiveReason } from "@/lib/coupons-data"
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
  fidelidade: "border-yellow-400/30 bg-yellow-400/10",
  pedido_cancelado: "border-red-200 bg-red-50",
  cliente_vip: "border-yellow-400/30 bg-yellow-400/10",
  recuperacao_inativo: "border-emerald-400/30 bg-emerald-500/10",
  manual: "border-border bg-muted",
}

const reasonIconColor: Record<ExclusiveReason, string> = {
  fidelidade: "bg-yellow-400/10 text-yellow-400",
  pedido_cancelado: "bg-red-100 text-red-600",
  cliente_vip: "bg-yellow-400/10 text-yellow-400",
  recuperacao_inativo: "bg-emerald-500/10 text-emerald-400",
  manual: "bg-muted text-muted-foreground",
}

function getSuggestionMessage(suggestion: ExclusiveSuggestion) {
  if (suggestion.observation?.trim()) {
    return suggestion.observation
  }

  if (suggestion.reason === "fidelidade") {
    return "Cliente com bom histórico de compras. Vale enviar um benefício exclusivo para aumentar a recompra."
  }

  if (suggestion.reason === "pedido_cancelado") {
    return "Cliente teve pedido cancelado. Um cupom exclusivo pode ajudar a recuperar a confiança e gerar uma nova compra."
  }

  if (suggestion.reason === "cliente_vip") {
    return "Cliente com alto valor para o restaurante. Uma oferta especial pode fortalecer a fidelização."
  }

  if (suggestion.reason === "recuperacao_inativo") {
    return suggestion.daysInactive
      ? `Cliente está há ${suggestion.daysInactive} dias sem comprar. Uma oferta pode ajudar na recuperação.`
      : "Cliente está inativo. Uma oferta exclusiva pode ajudar a trazer esse cliente de volta."
  }

  return "Sugestão exclusiva para envio manual ao cliente."
}

export default function ExclusiveSuggestions({
  suggestions,
  onAccept,
  onDismiss,
}: ExclusiveSuggestionsProps) {
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
          Nenhuma sugestão pendente no momento
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Brain className="h-5 w-5 text-[hsl(var(--primary))]" />
        <div>
          <h3 className="text-sm font-bold text-card-foreground">
            Inteligência Estratégica
          </h3>
          <p className="text-xs text-muted-foreground">
            Sugestões automáticas baseadas no comportamento dos clientes
          </p>
        </div>
      </div>

      <div className="space-y-3 p-5">
        {visibleSuggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className={cn(
              "flex items-start gap-4 rounded-xl border p-4 transition-all",
              reasonAccentColor[suggestion.reason]
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                reasonIconColor[suggestion.reason]
              )}
            >
              {reasonIcons[suggestion.reason]}
            </span>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-semibold text-card-foreground">
                  {suggestion.clientName}
                </span>

                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    reasonIconColor[suggestion.reason]
                  )}
                >
                  {exclusiveReasonLabels[suggestion.reason]}
                </span>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                {getSuggestionMessage(suggestion)}
              </p>

              <div className="mt-1.5 text-xs text-muted-foreground">
                Desconto sugerido:{" "}
                <span className="font-semibold text-card-foreground">
                  {suggestion.suggestedDiscountType === "percentual"
                    ? `${suggestion.suggestedDiscount}%`
                    : `R$ ${suggestion.suggestedDiscount.toFixed(2).replace(".", ",")}`}
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
                aria-label="Dispensar sugestão"
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