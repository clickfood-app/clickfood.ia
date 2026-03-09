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
  const { user } = useAuth()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const handleSelectPlan = async (planId: string) => {
    setSelectedPlan(planId)
    setIsProcessing(true)

    await new Promise((r) => setTimeout(r, 1500))

    activateSubscription("monthly")

    setIsProcessing(false)
    router.push("/configurar")
  }

  const handleSkip = () => {
    router.push("/configurar")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 relative overflow-hidden">
      {/* resto do código permanece exatamente igual */}
    </div>
  )
}