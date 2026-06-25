"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Zap, Crown, Loader2, ArrowRight, Shield, Clock, Users } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { activateSubscription } from "@/lib/auth"
import { cn } from "@/lib/utils"

const features = [
  "Cardapio digital ilimitado",
  "Pedidos via WhatsApp",
  "Painel administrativo completo",
  "Gestao de produtos e categorias",
  "Relatorios de vendas",
  "Suporte prioritario",
  "Atualizacoes gratuitas",
  "Sem taxa por pedido",
]

const benefits = [
  { icon: Shield, title: "Sem fidelidade", desc: "Cancele quando quiser" },
  { icon: Clock, title: "Setup em 5 min", desc: "Comece a vender hoje" },
  { icon: Users, title: "+2.000 clientes", desc: "Confiam na plataforma" },
]

export default function OfertaPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly")
  const [isLoading, setIsLoading] = useState(false)

  const monthlyPrice = 49.90
  const yearlyPrice = 39.90 // Per month when paying yearly
  const yearlyTotal = yearlyPrice * 12
  const savings = (monthlyPrice - yearlyPrice) * 12

  const userDisplayName = String(
    user?.user_metadata?.name ||
      user?.user_metadata?.full_name ||
      user?.email ||
      "usuario"
  )

  const handleSubscribe = async () => {
    setIsLoading(true)

    // Simulate payment processing
    await new Promise((r) => setTimeout(r, 1500))

    // Activate subscription
    activateSubscription(selectedPlan)

    setIsLoading(false)
    router.push("/gestao")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050505] via-[#080808] to-yellow-400">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0A0A0A] backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">CardapioDigital</span>
          </div>
          {user && (
            <span className="text-sm text-zinc-500">
              Ola, <span className="font-medium text-zinc-500">{userDisplayName}</span>
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-yellow-400/10 px-4 py-1.5 text-sm font-medium text-yellow-400 mb-4">
            <Crown className="h-4 w-4" />
            Oferta especial de lancamento
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Escolha o plano ideal para seu negocio
          </h1>
          <p className="text-lg text-zinc-500 max-w-xl mx-auto">
            Comece a receber pedidos digitais hoje mesmo. Sem taxa por pedido, sem surpresas.
          </p>
        </div>

        {/* Plan Toggle */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <button
            onClick={() => setSelectedPlan("monthly")}
            className={cn(
              "px-6 py-3 rounded-xl text-sm font-semibold transition-all",
              selectedPlan === "monthly"
                ? "bg-[#080808] text-white shadow-lg"
                : "bg-[#111111] text-zinc-500 hover:bg-[#111111]"
            )}
          >
            Mensal
          </button>
          <button
            onClick={() => setSelectedPlan("yearly")}
            className={cn(
              "px-6 py-3 rounded-xl text-sm font-semibold transition-all relative",
              selectedPlan === "yearly"
                ? "bg-[#080808] text-white shadow-lg"
                : "bg-[#111111] text-zinc-500 hover:bg-[#111111]"
            )}
          >
            Anual
            <span className="absolute -top-2 -right-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
              -20%
            </span>
          </button>
        </div>

        {/* Pricing Card */}
        <div className="max-w-lg mx-auto mb-12">
          <div className="rounded-3xl bg-[#0A0A0A] border border-white/10 shadow-xl shadow-black/40 overflow-hidden">
            {/* Card Header */}
            <div className="bg-gradient-to-r from-yellow-400 to-yellow-400 px-8 py-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A0A0A]">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">
                    Plano {selectedPlan === "yearly" ? "Anual" : "Mensal"}
                  </h3>
                  <p className="text-sm text-zinc-400">Acesso completo a plataforma</p>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="px-8 py-8 border-b border-white/10">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-bold text-white">
                  R${" "}
                  {selectedPlan === "yearly"
                    ? yearlyPrice.toFixed(2).replace(".", ",")
                    : monthlyPrice.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-zinc-500">/mes</span>
              </div>
              {selectedPlan === "yearly" && (
                <div className="space-y-1">
                  <p className="text-sm text-zinc-500">
                    Cobrado R$ {yearlyTotal.toFixed(2).replace(".", ",")} anualmente
                  </p>
                  <p className="text-sm font-medium text-emerald-400">
                    Economia de R$ {savings.toFixed(2).replace(".", ",")} por ano
                  </p>
                </div>
              )}
              {selectedPlan === "monthly" && (
                <p className="text-sm text-zinc-500">Sem compromisso, cancele quando quiser</p>
              )}
            </div>

            {/* Features */}
            <div className="px-8 py-6 space-y-3">
              {features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </div>
                  <span className="text-sm text-zinc-500">{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="px-8 py-6 bg-[#111111]">
              <button
                onClick={handleSubscribe}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-yellow-400 py-4 text-sm font-bold text-black shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:shadow-yellow-400/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    Comecar agora
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              <p className="text-xs text-center text-zinc-500 mt-3">
                Pagamento seguro. Cancele a qualquer momento.
              </p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl bg-[#0A0A0A] border border-white/10 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400/10">
                <benefit.icon className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white">{benefit.title}</h4>
                <p className="text-sm text-zinc-500">{benefit.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ / Guarantee */}
        <div className="text-center mt-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400">
            <Shield className="h-4 w-4" />
            Garantia de 7 dias ou seu dinheiro de volta
          </div>
        </div>
      </main>
    </div>
  )
}