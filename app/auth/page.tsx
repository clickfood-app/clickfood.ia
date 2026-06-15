"use client"

import AuthCard from "@/components/auth/auth-card"
import { Headphones, ShieldCheck } from "lucide-react"

const WHATSAPP_NUMBER = "5531973046166"

function getWhatsappLink() {
  const message = "Olá! Preciso de ajuda para acessar o painel da ClickFood."
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

export default function AuthPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#06152D] px-4 py-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.32),transparent_30%),radial-gradient(circle_at_80%_12%,rgba(255,107,26,0.22),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(59,130,246,0.12),transparent_34%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:42px_42px]" />

      <section className="relative z-10 grid w-full max-w-[1040px] overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.08] shadow-[0_40px_120px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:grid-cols-[1fr_430px]">
        <div className="hidden min-h-[610px] flex-col justify-between border-r border-white/10 bg-[#071B35]/70 p-10 lg:flex">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-orange-300">
              <ShieldCheck className="h-4 w-4" />
              Portal administrativo
            </div>

            <h1 className="mt-8 max-w-[520px] text-[48px] font-black leading-[1.03] tracking-tight">
              Acesse sua operação com segurança.
            </h1>

            <p className="mt-5 max-w-[470px] text-sm leading-7 text-blue-50/65">
              Painel exclusivo para restaurantes parceiros acompanharem pedidos,
              caixa, cardápio, clientes e rotina operacional.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-100/45">
                Status
              </p>
              <p className="mt-1 text-lg font-black text-white">
                Sistema online
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-100/45">
                Ambiente
              </p>
              <p className="mt-1 text-lg font-black text-white">
                Protegido para administradores
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white px-5 py-8 text-[#06152D] sm:px-8 lg:px-9">
          <div className="mx-auto w-full max-w-[360px]">
            <div className="mb-7 text-center">
              <div className="mb-5 flex justify-center">
                <div className="flex h-14 items-center rounded-2xl border border-slate-200 bg-white px-5 shadow-sm">
                  <img
                    src="/logo.png"
                    alt="ClickFood"
                    className="h-9 w-auto object-contain"
                  />
                </div>
              </div>

              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#FF6B1A]">
                <span className="h-2 w-2 rounded-full bg-[#FF6B1A]" />
                Acesso restrito
              </div>

              <h2 className="mt-4 text-2xl font-black tracking-tight text-[#06152D]">
                Entrar no painel
              </h2>

              <p className="mx-auto mt-2 max-w-[300px] text-sm leading-6 text-slate-500">
                Use seu email e senha para acessar sua conta administrativa.
              </p>
            </div>

            <AuthCard />

            <div className="mt-5 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-center text-xs font-bold text-orange-700">
              <div className="flex items-center justify-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Ambiente protegido para restaurantes parceiros.
              </div>
            </div>

            <a
              href={getWhatsappLink()}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#FF6B1A]"
            >
              <Headphones className="h-4 w-4" />
              Precisa de ajuda para acessar?
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}