"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { activateSubscription } from "@/lib/auth"
import {
  Bot,
  Package,
  Wallet,
  Truck,
  Users,
  Sparkles,
  ArrowRight,
  Check,
  Star,
  Loader2,
  Crown,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Plan benefits with icons
const planBenefits = [
  { icon: Bot, label: "Atendente de IA" },
  { icon: Package, label: "Controle de estoque" },
  { icon: Wallet, label: "Fluxo de caixa" },
  { icon: Truck, label: "Controle de fornecedores" },
  { icon: Users, label: "Gestao de funcionarios" },
  { icon: Sparkles, label: "E muito mais" },
]

const plans = [
  {
    id: "monthly",
    name: "Mensal",
    price: 49.9,
    period: "/mes",
    totalLabel: null,
    description: "Ideal para comecar",
    popular: false,
    badge: null,
    savings: null,
  },
  {
    id: "quarterly",
    name: "Trimestral",
    price: 119.9,
    period: "/3 meses",
    totalLabel: "R$ 39,97/mes",
    description: "Mais popular",
    popular: true,
    badge: "Mais Popular",
    savings: "Economize 20%",
  },
  {
    id: "annual",
    name: "Anual",
    price: 359.9,
    period: "/ano",
    totalLabel: "R$ 29,99/mes",
    description: "Melhor custo-beneficio",
    popular: false,
    badge: "Melhor Valor",
    savings: "Economize 40%",
  },
]

// Animated counter hook
function useAnimatedCounter(end: number, duration: number = 1500, startOnView: boolean = true) {
  const [count, setCount] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!startOnView || hasAnimated) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)
          let startTime: number | null = null
          const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp
            const progress = Math.min((timestamp - startTime) / duration, 1)
            setCount(progress * end)
            if (progress < 1) {
              requestAnimationFrame(animate)
            }
          }
          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.5 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [end, duration, hasAnimated, startOnView])

  return { count, ref }
}

function AnimatedPrice({ value }: { value: number }) {
  const { count, ref } = useAnimatedCounter(value)
  const formatted = count.toFixed(2).replace(".", ",")
  
  return <span ref={ref}>{formatted}</span>
}

export default function WelcomePage() {
  const router = useRouter()
  const { user, refreshSession, isLoading: authLoading } = useAuth()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSelectPlan = async (planId: string) => {
    setSelectedPlan(planId)
    setIsProcessing(true)

    // Simulate payment processing
    await new Promise((r) => setTimeout(r, 1500))

    // Activate subscription
    activateSubscription("monthly") // Using monthly for demo
    refreshSession()

    setIsProcessing(false)
    router.push("/configurar")
  }

  const handleSkip = () => {
    router.push("/configurar")
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-br from-blue-200/30 to-indigo-200/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-br from-indigo-200/30 to-blue-200/30 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-blue-100/20 to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-12 sm:py-16">
        {/* Header - Animated fade-in */}
        <div 
          className={cn(
            "text-center mb-14 transition-all duration-1000",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white mb-8 shadow-lg shadow-blue-500/25 animate-pulse">
            <Sparkles className="h-4 w-4" />
            Bem-vindo a ClickFood!
          </div>

          <h1 
            className={cn(
              "text-4xl sm:text-5xl font-bold text-gray-900 mb-5 transition-all duration-1000 delay-200",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            Ola{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
          </h1>
          
          <p 
            className={cn(
              "text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed transition-all duration-1000 delay-300",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            Escolha o plano que mais combina com seu restaurante e leve sua gestao para o proximo nivel.
          </p>
        </div>

        {/* Plans Section */}
        <div 
          className={cn(
            "mb-16 transition-all duration-1000 delay-500",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, index) => (
              <div
                key={plan.id}
                className={cn(
                  "group relative rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02]",
                  plan.popular
                    ? "bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white shadow-2xl shadow-blue-500/30 scale-[1.02] z-10"
                    : "bg-white border border-gray-200 shadow-xl hover:shadow-2xl hover:border-blue-200"
                )}
                style={{ 
                  transitionDelay: mounted ? `${600 + index * 100}ms` : "0ms" 
                }}
              >
                {/* Badge */}
                {plan.badge && (
                  <div 
                    className={cn(
                      "absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold shadow-lg",
                      plan.popular 
                        ? "bg-yellow-400 text-yellow-900" 
                        : "bg-blue-100 text-blue-700"
                    )}
                  >
                    {plan.popular ? <Star className="h-3.5 w-3.5 fill-current" /> : <Crown className="h-3.5 w-3.5" />}
                    {plan.badge}
                  </div>
                )}

                {/* Plan header */}
                <div className="text-center mb-6 pt-2">
                  <h3
                    className={cn(
                      "text-xl font-bold mb-4",
                      plan.popular ? "text-white" : "text-gray-900"
                    )}
                  >
                    {plan.name}
                  </h3>

                  {/* Price with animation */}
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={cn("text-lg", plan.popular ? "text-blue-200" : "text-gray-500")}>
                      R$
                    </span>
                    <span
                      className={cn(
                        "text-5xl font-bold tracking-tight",
                        plan.popular ? "text-white" : "text-gray-900"
                      )}
                    >
                      <AnimatedPrice value={plan.price} />
                    </span>
                  </div>
                  
                  <span className={cn("text-sm", plan.popular ? "text-blue-200" : "text-gray-500")}>
                    {plan.period}
                  </span>

                  {plan.totalLabel && (
                    <p className={cn(
                      "mt-2 text-sm font-medium",
                      plan.popular ? "text-blue-200" : "text-blue-600"
                    )}>
                      {plan.totalLabel}
                    </p>
                  )}

                  {plan.savings && (
                    <div 
                      className={cn(
                        "inline-flex items-center gap-1 mt-3 rounded-full px-3 py-1 text-xs font-semibold",
                        plan.popular 
                          ? "bg-white/20 text-white" 
                          : "bg-green-100 text-green-700"
                      )}
                    >
                      <Zap className="h-3 w-3" />
                      {plan.savings}
                    </div>
                  )}
                </div>

                {/* Benefits list */}
                <ul className="space-y-3 mb-8">
                  {planBenefits.map((benefit) => {
                    const Icon = benefit.icon
                    return (
                      <li key={benefit.label} className="flex items-center gap-3 text-sm">
                        <div
                          className={cn(
                            "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                            plan.popular 
                              ? "bg-white/20 group-hover:bg-white/30" 
                              : "bg-blue-50 group-hover:bg-blue-100"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4",
                              plan.popular ? "text-white" : "text-blue-600"
                            )}
                          />
                        </div>
                        <span className={plan.popular ? "text-white/90" : "text-gray-700"}>
                          {benefit.label}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isProcessing}
                  className={cn(
                    "w-full py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2",
                    plan.popular
                      ? "bg-white text-blue-600 hover:bg-blue-50 shadow-lg hover:shadow-xl"
                      : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 hover:shadow-xl",
                    isProcessing && selectedPlan === plan.id && "opacity-80 cursor-not-allowed"
                  )}
                >
                  {isProcessing && selectedPlan === plan.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      Escolher Plano
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Skip / Continue Button */}
        <div 
          className={cn(
            "text-center transition-all duration-1000 delay-700",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          <button
            onClick={handleSkip}
            className="group inline-flex items-center gap-2 rounded-xl bg-gray-900 px-10 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-gray-800 hover:shadow-xl hover:scale-[1.02]"
          >
            Vamos comecar!
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>
          <p className="mt-4 text-sm text-gray-500">
            Voce pode assinar a qualquer momento nas configuracoes
          </p>
        </div>

        {/* Trust indicators */}
        <div 
          className={cn(
            "mt-16 flex flex-wrap items-center justify-center gap-8 text-gray-400 transition-all duration-1000 delay-[800ms]",
            mounted ? "opacity-100" : "opacity-0"
          )}
        >
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            <span>Sem fidelidade</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            <span>Cancele quando quiser</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            <span>Suporte humanizado</span>
          </div>
        </div>
      </div>
    </div>
  )
}
