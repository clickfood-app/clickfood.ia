"use client"

import AuthCard from "@/components/auth/auth-card"
import {
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Wallet,
  BarChart3,
  Store,
  Zap,
  ArrowUpRight,
} from "lucide-react"
import { motion } from "framer-motion"

const features = [
  {
    icon: BarChart3,
    title: "Mais clareza",
    description: "Veja os números do restaurante sem depender de planilhas confusas.",
  },
  {
    icon: Wallet,
    title: "Mais controle",
    description: "Entenda receitas, despesas e oportunidades de lucro com facilidade.",
  },
  {
    icon: Store,
    title: "Mais crescimento",
    description: "Use dados reais para tomar decisões melhores no dia a dia.",
  },
]

const floatingCards = [
  {
    title: "Faturamento hoje",
    value: "R$ 3.480",
    badge: "+12,4%",
    icon: TrendingUp,
  },
  {
    title: "Insight da semana",
    value: "Combo premium",
    badge: "Em alta",
    icon: Zap,
  },
  {
    title: "Segurança",
    value: "Acesso protegido",
    badge: "Confiável",
    icon: ShieldCheck,
  },
]

export default function AuthPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#081225] text-white">
      {/* Fundo animado */}
      <div className="absolute inset-0 -z-20">
        <div className="absolute left-[-120px] top-[-100px] h-[420px] w-[420px] rounded-full bg-violet-600/30 blur-[120px] animate-pulse" />
        <div className="absolute right-[-100px] top-[20%] h-[380px] w-[380px] rounded-full bg-fuchsia-500/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-120px] left-[20%] h-[340px] w-[340px] rounded-full bg-indigo-500/20 blur-[120px] animate-pulse" />
      </div>

      {/* Pontinhos/grid */}
      <div
        className="absolute inset-0 -z-10 opacity-20"
        style={{
          backgroundImage: `
            radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
        }}
      />

      {/* bolhas decorativas */}
      <motion.div
        animate={{ y: [0, -18, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-[8%] top-[22%] h-5 w-5 rounded-full bg-violet-400/60 blur-[1px]"
      />
      <motion.div
        animate={{ y: [0, 22, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-[12%] top-[18%] h-4 w-4 rounded-full bg-fuchsia-400/70 blur-[1px]"
      />
      <motion.div
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[18%] left-[42%] h-3 w-3 rounded-full bg-cyan-300/70 blur-[1px]"
      />

      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        {/* Lado esquerdo */}
        <section className="relative flex w-full items-center px-6 py-14 sm:px-10 lg:w-[57%] lg:px-14 xl:px-20">
          <div className="w-full max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8 flex items-center gap-4"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_12px_40px_rgba(139,92,246,0.45)]">
                <Sparkles className="h-6 w-6 text-white" />
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-violet-300">
                  ClickFood
                </p>
                <p className="text-sm text-slate-300">
                  Gestão inteligente para restaurantes
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-white/5 px-4 py-2 text-sm font-medium text-violet-200 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
                <ArrowUpRight className="h-4 w-4" />
                Uma plataforma jovem, moderna e feita para crescer com o seu negócio
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.12 }}
              className="mt-8 text-4xl font-black leading-[0.98] tracking-tight text-white sm:text-5xl xl:text-7xl"
            >
              A nova geração da gestão para
              <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                restaurantes que querem crescer
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.18 }}
              className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg"
            >
              A ClickFood nasceu para ajudar restaurantes e operações food service a
              saírem do achismo. Nossa missão é transformar números, rotina e operação
              em decisões mais inteligentes, com uma plataforma visual, prática e feita
              para quem quer controlar melhor o presente e crescer no futuro.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.26 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 backdrop-blur-md">
                Financeiro
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 backdrop-blur-md">
                Operação
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 backdrop-blur-md">
                Crescimento
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 backdrop-blur-md">
                Insights
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 backdrop-blur-md">
                Gestão moderna
              </span>
            </motion.div>

            {/* Features */}
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.34 }}
              className="mt-12 grid gap-4 sm:grid-cols-3"
            >
              {features.map((item, index) => {
                const Icon = item.icon

                return (
                  <motion.div
                    key={item.title}
                    animate={{ y: [0, -5, 0] }}
                    transition={{
                      duration: 4 + index,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.22)]"
                  >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {item.description}
                    </p>
                  </motion.div>
                )
              })}
            </motion.div>

            {/* Floating cards */}
            <div className="relative mt-14 hidden min-h-[220px] lg:block">
              {floatingCards.map((card, index) => {
                const Icon = card.icon

                const positions = [
                  "left-0 top-6",
                  "left-[220px] top-0",
                  "left-[460px] top-10",
                ]

                return (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: [0, -10, 0] }}
                    transition={{
                      opacity: { duration: 0.5, delay: 0.45 + index * 0.1 },
                      y: {
                        duration: 4.5 + index,
                        repeat: Infinity,
                        ease: "easeInOut",
                      },
                    }}
                    className={`absolute ${positions[index]} w-[210px] rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.25)]`}
                  >
                    <div className="flex items-center gap-2 text-violet-300">
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{card.badge}</span>
                    </div>

                    <p className="mt-4 text-xl font-bold text-white">{card.value}</p>
                    <p className="mt-1 text-sm text-slate-300">{card.title}</p>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Lado direito */}
        <section className="relative flex w-full items-center justify-center px-6 py-10 sm:px-10 lg:w-[43%] lg:px-12">
          <div className="absolute inset-0 bg-white/[0.04] backdrop-blur-[2px]" />

          <motion.div
            initial={{ opacity: 0, x: 22 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.75, delay: 0.12 }}
            className="relative z-10 w-full max-w-md"
          >
            <div className="rounded-[34px] border border-white/10 bg-white/95 p-3 text-slate-900 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8">
                <div className="mb-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-violet-600">
                    Área de acesso
                  </p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                    Entre na sua conta
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Entre na plataforma da ClickFood e acompanhe sua operação com uma
                    visão mais moderna, prática e inteligente.
                  </p>
                </div>

                <AuthCard />

                <div className="mt-5 rounded-2xl bg-violet-50 px-4 py-3 text-center">
                  <p className="text-xs font-medium text-violet-700">
                    ClickFood • tecnologia, gestão e crescimento para restaurantes
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  )
}