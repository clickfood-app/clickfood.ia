"use client"

import AuthCard from "@/components/auth/auth-card"
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  LockKeyhole,
  Store,
  TrendingUp,
  Zap,
} from "lucide-react"
import { motion } from "framer-motion"

const benefits = [
  {
    icon: TrendingUp,
    title: "Cresça mais",
    description: "com inteligência",
  },
  {
    icon: Store,
    title: "Opere com",
    description: "eficiência",
  },
  {
    icon: BarChart3,
    title: "Tenha controle",
    description: "financeiro",
  },
  {
    icon: Zap,
    title: "Modernidade",
    description: "que transforma",
  },
]

export default function AuthPage() {
  return (
<main className="relative min-h-dvh overflow-x-hidden bg-[#06152D] text-white">      {/* Fundo */}
      <div className="absolute inset-0 -z-20">
        <div className="absolute inset-y-0 left-0 w-full bg-[radial-gradient(circle_at_18%_20%,rgba(11,86,217,0.32),transparent_34%),linear-gradient(90deg,#06152D_0%,#06152D_58%,#F8FAFF_58%,#FFFFFF_100%)]" />
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-[#0B56D9]/25 blur-[120px]" />
        <div className="absolute bottom-[-160px] left-[8%] h-[420px] w-[420px] rounded-full bg-[#FF6B1A]/18 blur-[120px]" />
      </div>

      {/* Textura */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      {/* Linhas decorativas */}
      <div className="pointer-events-none absolute bottom-[-260px] left-[-170px] h-[620px] w-[620px] rounded-full border border-[#FF6B1A]/22" />
      <div className="pointer-events-none absolute bottom-[-290px] left-[-120px] h-[700px] w-[700px] rounded-full border border-[#0B56D9]/22" />
      <div className="pointer-events-none absolute bottom-[14%] left-[3.5%] h-3 w-3 rounded-full bg-[#FF6B1A] shadow-[0_0_35px_rgba(255,107,26,0.95)]" />

<div className="mx-auto grid min-h-dvh max-w-[1440px] lg:grid-cols-[0.58fr_0.42fr]">        {/* ESQUERDA */}
        <section className="relative flex items-center px-6 py-8 sm:px-10 lg:px-14 xl:px-20">
          <div className="w-full max-w-[760px]">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="mb-9"
            >
              <img
                src="/logo.jpg"
                alt="ClickFood"
                className="h-12 w-auto object-contain sm:h-14"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.055] px-4 py-2 text-xs font-semibold text-slate-100 backdrop-blur-xl">
                <ArrowUpRight className="h-4 w-4 text-[#FF6B1A]" />
                Plataforma moderna para restaurantes que querem crescer
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="mt-7 max-w-[720px] text-[42px] font-black leading-[0.98] tracking-tight text-white sm:text-[52px] xl:text-[64px]"
            >
              A gestão inteligente que impulsiona{" "}
              <span className="text-[#FF6B1A]">restaurantes.</span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 86 }}
              transition={{ duration: 0.5, delay: 0.22 }}
              className="mt-4 h-1 rounded-full bg-[#FF6B1A]"
            />

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15 }}
              className="mt-6 max-w-[620px] text-[15px] leading-7 text-slate-200 sm:text-base"
            >
              A plataforma completa para quem quer crescer com mais{" "}
              <strong className="font-bold text-white">controle</strong>,{" "}
              <strong className="font-bold text-white">eficiência</strong> e{" "}
              <strong className="font-bold text-white">resultado</strong>.
            </motion.p>

            {/* Benefícios em linha */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.22 }}
              className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
              {benefits.map((item) => {
                const Icon = item.icon

                return (
                  <div
                    key={item.title}
                    className="flex items-center gap-3 border-white/10 xl:border-r xl:pr-4 last:xl:border-r-0"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#FF6B1A]/45 bg-[#FF6B1A]/10 text-[#FF6B1A]">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-sm text-slate-300">{item.title}</p>
                      <p className="text-sm font-black text-white">
                        {item.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </motion.div>

            {/* Asaas */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3 }}
              className="mt-8 max-w-[680px] rounded-[28px] border border-[#0B56D9]/40 bg-[#08214A]/72 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-[#0B56D9] shadow-[0_16px_45px_rgba(11,86,217,0.35)]">
                  <span className="text-xl font-semibold tracking-wide text-white">
                    ASAAS
                  </span>
                </div>

                <div className="flex-1">
                  <span className="inline-flex items-center rounded-full bg-[#0B56D9]/45 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-blue-100">
                    Pagamentos com Asaas
                  </span>

                  <h2 className="mt-3 text-lg font-black text-white sm:text-xl">
                    Pix e cobranças com praticidade e segurança.
                  </h2>

                  <div className="mt-4 grid gap-3 text-xs text-slate-200 sm:grid-cols-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#0B78FF]" />
                      Receba via Pix
                    </div>

                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#0B78FF]" />
                      Mais controle
                    </div>

                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#0B78FF]" />
                      Conciliação automática
                    </div>
                  </div>

                  <p className="mt-4 text-xs leading-6 text-slate-300">
                    ClickFood integrada ao Asaas para facilitar pagamentos,
                    organização financeira e confirmação de cobranças.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* DIREITA */}
        <section className="relative flex min-h-dvh items-center justify-center bg-[#F8FAFF] px-6 py-10 sm:px-10 lg:min-h-0 lg:py-8">
          <div className="absolute right-8 top-8 h-40 w-40 rounded-full bg-[#0B56D9]/5 blur-3xl" />

          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="relative z-10 w-full max-w-[430px]"
          >
            <div className="rounded-[36px] border border-white/80 bg-white/90 p-3 shadow-[0_30px_90px_rgba(6,21,45,0.18)] backdrop-blur-2xl">
              <div className="rounded-[28px] border border-slate-200/80 bg-white px-6 py-8 text-slate-900 sm:px-8">
                <div className="mb-7 text-center">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#F1F6FF] text-[#FF6B1A]">
                    <LockKeyhole className="h-6 w-6" />
                  </div>

                  <p className="text-[11px] font-black uppercase tracking-[0.32em] text-[#0B56D9]">
                    Área de acesso
                  </p>

                  <h2 className="mt-3 text-3xl font-black tracking-tight text-[#06152D]">
                    Entre na sua conta
                  </h2>

                  <p className="mx-auto mt-3 max-w-[320px] text-sm leading-6 text-slate-500">
                    Acesse sua plataforma ClickFood e continue gerenciando seu
                    restaurante com eficiência.
                  </p>
                </div>

                <AuthCard />
              </div>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  )
}