"use client"

import { useState } from "react"
import { CheckCircle2, Crown, ExternalLink, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { type PlanData, defaultPlanData, formatBRL } from "@/lib/settings-data"
import { formatDate } from "@/lib/utils/format-date"

export default function PlanTab() {
  const [plan] = useState<PlanData>(defaultPlanData)
  const [loading, setLoading] = useState(false)

  async function handleManage() {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1000))
    setLoading(false)
    toast.info("Redirecionando para o portal de assinatura...")
  }

  const billingLabels: Record<string, string> = {
    mensal: "Mensal",
    trimestral: "Trimestral",
    anual: "Anual",
  }

  return (
    <div className="space-y-8">
      {/* Plan Card */}
      <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--primary))]/30 bg-gradient-to-br from-blue-50 via-card to-card p-8">
        {/* Decorative */}
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[hsl(var(--primary))]/5" />
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-[hsl(var(--primary))]/10" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Left - Plan Info */}
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-lg">
              <Crown className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-card-foreground">{plan.name}</h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
                    plan.status === "ativo"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", plan.status === "ativo" ? "bg-green-500" : "bg-red-500")} />
                  {plan.status === "ativo" ? "Ativo" : "Inativo"}
                </span>
                <span className="rounded-full bg-[hsl(var(--primary))]/10 px-2.5 py-0.5 text-xs font-semibold text-[hsl(var(--primary))]">
                  {billingLabels[plan.billingCycle]}
                </span>
              </div>
            </div>
          </div>

          {/* Right - Price */}
          <div className="text-right">
            <div className="flex items-baseline gap-1 justify-end">
              <span className="text-3xl font-bold text-card-foreground">{formatBRL(plan.price)}</span>
              <span className="text-sm text-muted-foreground">/{plan.billingCycle === "mensal" ? "mes" : plan.billingCycle === "trimestral" ? "trim" : "ano"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-base font-bold text-card-foreground mb-5">Detalhes da Assinatura</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard label="Plano" value={plan.name} />
          <InfoCard
            label="Status"
            value={plan.status === "ativo" ? "Ativo" : "Inativo"}
            valueClass={plan.status === "ativo" ? "text-green-600" : "text-red-600"}
          />
          <InfoCard label="Renovacao" value={formatDate(plan.renewalDate)} />
          <InfoCard label="Cobranca" value={billingLabels[plan.billingCycle]} />
        </div>
      </div>

      {/* Features */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-base font-bold text-card-foreground mb-5">Incluido no seu plano</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            "Pedidos ilimitados",
            "Produtos ilimitados",
            "Relatorios avancados",
            "Gestao de clientes",
            "Cupons e promocoes",
            "Suporte prioritario",
            "Multi-usuarios",
            "Integracoes",
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
              <span className="text-sm text-card-foreground">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Manage */}
      <div className="flex justify-end">
        <button
          onClick={handleManage}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          {loading ? "Carregando..." : "Gerenciar Assinatura"}
        </button>
      </div>
    </div>
  )
}

function InfoCard({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn("mt-1.5 text-sm font-bold text-card-foreground", valueClass)}>{value}</p>
    </div>
  )
}
