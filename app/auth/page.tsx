"use client"

import Image from "next/image"
import { CheckCircle2 } from "lucide-react"
import AuthCard from "@/components/auth/auth-card"

const benefits = [
  "Pedidos e operação em um só lugar",
  "Controle simples para sua equipe",
  "Acesso protegido e exclusivo",
]

export default function AuthPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f4f7fb] sm:px-6 sm:py-8">
      <section className="grid min-h-dvh w-full overflow-hidden bg-white shadow-[0_30px_100px_rgba(15,23,42,0.12)] sm:min-h-0 sm:max-w-[1040px] sm:rounded-[32px] sm:border sm:border-slate-200/80 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative overflow-hidden bg-white px-6 py-7 sm:px-8 lg:flex lg:min-h-[640px] lg:flex-col lg:justify-between lg:p-10">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-50" />
          <div className="absolute -bottom-32 -left-28 h-72 w-72 rounded-full bg-orange-50" />

          <div className="relative z-10">
            <Image
              src="/logo.png"
              alt="ClickFood"
              width={230}
              height={55}
              priority
              className="h-auto w-[180px] object-contain sm:w-[210px]"
            />

            <div className="mt-7 max-w-md lg:mt-20">
              <div className="mb-4 h-1 w-10 rounded-full bg-[#f97316]" />

              <h2 className="text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
                Seu estabelecimento,
                <span className="block text-[#2563eb]">
                  sempre no controle.
                </span>
              </h2>

              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500 sm:text-base lg:mt-5">
                Acesse o painel para acompanhar seus pedidos e administrar sua
                operação.
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-9 hidden space-y-4 lg:block">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50">
                  <CheckCircle2 className="h-5 w-5 text-[#2563eb]" />
                </div>

                <span className="text-sm font-semibold text-slate-700">
                  {benefit}
                </span>
              </div>
            ))}
          </div>
        </aside>

        <div className="relative flex flex-1 items-start justify-center overflow-hidden bg-[#2563eb] px-4 py-7 sm:px-10 sm:py-12 lg:items-center lg:px-14">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/10" />
          <div className="absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-[#f97316]/20" />

          <div className="relative z-10 w-full max-w-[440px] rounded-[28px] bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.24)] sm:p-8">
            <div className="mb-7">
              <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#f97316]">
                Área do estabelecimento
              </span>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                Acessar painel
              </h1>

              <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                Entre com o email e a senha cadastrados para continuar.
              </p>
            </div>

            <AuthCard />

            <p className="mt-7 text-center text-xs leading-5 text-slate-400">
              Ambiente seguro e exclusivo para estabelecimentos parceiros.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}