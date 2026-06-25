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

const planBenefits = [
  { icon: Bot, label: "Atendente de IA" },
  { icon: Package, label: "Controle de estoque" },
  { icon: Wallet, label: "Fluxo de caixa" },
  { icon: Truck, label: "Controle de fornecedores" },
  { icon: Users, label: "Gestão de funcionários" },
  { icon: Sparkles, label: "E muito mais" },
]

const plans = [
  {
    id: "monthly",
    name: "Mensal",
    price: 49.9,
    period: "/mês",
    totalLabel: null,
    description: "Ideal para começar",
    popular: false,
    badge: null,
    savings: null,
  },
  {
    id: "quarterly",
    name: "Trimestral",
    price: 119.9,
    period: "/3 meses",
    totalLabel: "R$ 39,97/mês",
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
    totalLabel: "R$ 29,99/mês",
    description: "Melhor custo-benefício",
    popular: false,
    badge: "Melhor Valor",
    savings: "Economize 40%",
  },
]

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
            if (progress < 1) requestAnimationFrame(animate)
          }

          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.5 }
    )

    if (ref.current) observer.observe(ref.current)

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
  const { user, isLoading } = useAuth()

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (isLoading) return

    if (!user) {
      router.replace("/auth")
    }
  }, [mounted, isLoading, user, router])

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-400 to-indigo-50">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    )
  }

  const handleSelectPlan = async (planId: string) => {
    try {
      setSelectedPlan(planId)
      setIsProcessing(true)
      setError(null)

      const result = await activateSubscription(planId)

      if (!result?.success) {
        setError(result?.error || "Não foi possível ativar o plano.")
        setIsProcessing(false)
        return
      }

      router.push("/configurar")
    } catch (err: any) {
      setError(err?.message || "Erro inesperado ao ativar o plano.")
      setIsProcessing(false)
    }
  }

  const handleSkip = () => {
    router.push("/configurar")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050505] via-[#080808] to-yellow-400 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(147,51,234,0.15),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_30%)]" />

      <div className="relative mx-auto max-w-7xl px-6 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-[#0A0A0A] px-4 py-2 text-sm font-medium text-yellow-400 shadow-sm backdrop-blur">
            <Sparkles className="h-4 w-4" />
            Bem-vindo à ClickFood
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white md:text-6xl">
            Escolha o plano ideal para o seu restaurante
          </h1>

          <p className="mt-5 text-lg text-zinc-500">
            {user?.email ? `Conta conectada: ${user.email}` : "Sua conta está pronta."}  
            Agora é só escolher um plano e continuar a configuração.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {planBenefits.map((benefit) => {
            const Icon = benefit.icon
            return (
              <div
                key={benefit.label}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0A0A0A] px-4 py-4 shadow-sm backdrop-blur"
              >
                <div className="rounded-xl bg-yellow-400/10 p-2 text-yellow-400">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="font-medium text-zinc-500">{benefit.label}</span>
              </div>
            )
          })}
        </div>

        {error && (
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id
            const isBusy = isProcessing && isSelected

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative rounded-3xl border bg-[#0A0A0A] p-6 shadow-xl transition-all",
                  plan.popular
                    ? "border-yellow-400/30 ring-2 ring-yellow-400/20 scale-[1.02]"
                    : "border-white/10 hover:border-yellow-400/30",
                  isSelected && "border-yellow-400/30 ring-2 ring-yellow-400/20"
                )}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-yellow-400 px-4 py-1 text-xs font-semibold text-black shadow">
                    {plan.badge}
                  </div>
                )}

                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                    <p className="mt-1 text-sm text-zinc-500">{plan.description}</p>
                  </div>

                  <div className="rounded-xl bg-[#111111] p-2 text-zinc-500">
                    {plan.popular ? <Crown className="h-5 w-5" /> : <Star className="h-5 w-5" />}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-end gap-1">
                    <span className="text-sm font-medium text-zinc-500">R$</span>
                    <span className="text-4xl font-extrabold text-white">
                      <AnimatedPrice value={plan.price} />
                    </span>
                    <span className="mb-1 text-zinc-500">{plan.period}</span>
                  </div>

                  {plan.totalLabel && (
                    <p className="mt-2 text-sm font-medium text-yellow-400">{plan.totalLabel}</p>
                  )}

                  {plan.savings && (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                      <Zap className="h-3.5 w-3.5" />
                      {plan.savings}
                    </div>
                  )}
                </div>

                <ul className="mt-6 space-y-3">
                  {planBenefits.map((benefit) => (
                    <li key={benefit.label} className="flex items-center gap-3 text-zinc-500">
                      <div className="rounded-full bg-emerald-500/10 p-1 text-emerald-400">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <span>{benefit.label}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isProcessing}
                  className={cn(
                    "mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    plan.popular
                      ? "bg-yellow-400 text-black hover:bg-yellow-300"
                      : "bg-[#080808] text-white hover:bg-[#111111]",
                    isProcessing && "cursor-not-allowed opacity-70"
                  )}
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Ativando...
                    </>
                  ) : (
                    <>
                      Escolher plano
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        <div className="mt-10 flex justify-center">
          <button
            onClick={handleSkip}
            disabled={isProcessing}
            className="rounded-2xl border border-white/10 bg-[#0A0A0A] px-5 py-3 text-sm font-semibold text-zinc-500 transition hover:bg-[#111111] disabled:opacity-60"
          >
            Pular por agora
          </button>
        </div>
      </div>
    </div>
  )
}