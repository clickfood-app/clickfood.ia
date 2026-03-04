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
  const { user, refreshSession } = useAuth()
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly")
  const [isLoading, setIsLoading] = useState(false)

  const monthlyPrice = 49.90
  const yearlyPrice = 39.90 // Per month when paying yearly
  const yearlyTotal = yearlyPrice * 12
  const savings = (monthlyPrice - yearlyPrice) * 12

  const handleSubscribe = async () => {
    setIsLoading(true)

    // Simulate payment processing
    await new Promise((r) => setTimeout(r, 1500))

    // Activate subscription
    activateSubscription(selectedPlan)
    refreshSession()

    setIsLoading(false)
    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">CardapioDigital</span>
          </div>
          {user && (
            <span className="text-sm text-gray-500">
              Ola, <span className="font-medium text-gray-700">{user.name}</span>
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700 mb-4">
            <Crown className="h-4 w-4" />
            Oferta especial de lancamento
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Escolha o plano ideal para seu negocio
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
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
                ? "bg-gray-900 text-white shadow-lg"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            Mensal
          </button>
          <button
            onClick={() => setSelectedPlan("yearly")}
            className={cn(
              "px-6 py-3 rounded-xl text-sm font-semibold transition-all relative",
              selectedPlan === "yearly"
                ? "bg-gray-900 text-white shadow-lg"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            Anual
            <span className="absolute -top-2 -right-2 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white">
              -20%
            </span>
          </button>
        </div>

        {/* Pricing Card */}
        <div className="max-w-lg mx-auto mb-12">
          <div className="rounded-3xl bg-white border border-gray-200 shadow-xl shadow-gray-200/50 overflow-hidden">
            {/* Card Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Plano {selectedPlan === "yearly" ? "Anual" : "Mensal"}</h3>
                  <p className="text-sm text-blue-100">Acesso completo a plataforma</p>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="px-8 py-8 border-b border-gray-100">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-bold text-gray-900">
                  R$ {selectedPlan === "yearly" ? yearlyPrice.toFixed(2).replace(".", ",") : monthlyPrice.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-gray-500">/mes</span>
              </div>
              {selectedPlan === "yearly" && (
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">
                    Cobrado R$ {yearlyTotal.toFixed(2).replace(".", ",")} anualmente
                  </p>
                  <p className="text-sm font-medium text-green-600">
                    Economia de R$ {savings.toFixed(2).replace(".", ",")} por ano
                  </p>
                </div>
              )}
              {selectedPlan === "monthly" && (
                <p className="text-sm text-gray-500">Sem compromisso, cancele quando quiser</p>
              )}
            </div>

            {/* Features */}
            <div className="px-8 py-6 space-y-3">
              {features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                  <span className="text-sm text-gray-700">{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="px-8 py-6 bg-gray-50">
              <button
                onClick={handleSubscribe}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-blue-600/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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
              <p className="text-xs text-center text-gray-500 mt-3">
                Pagamento seguro via Stripe. Cancele a qualquer momento.
              </p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl bg-white border border-gray-100 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                <benefit.icon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{benefit.title}</h4>
                <p className="text-sm text-gray-500">{benefit.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ / Guarantee */}
        <div className="text-center mt-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
            <Shield className="h-4 w-4" />
            Garantia de 7 dias ou seu dinheiro de volta
          </div>
        </div>
      </main>
    </div>
  )
}
