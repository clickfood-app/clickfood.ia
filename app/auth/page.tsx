"use client"

import AuthCard from "@/components/auth/auth-card"
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Headphones,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Store,
  Utensils,
  Users,
  WalletCards,
} from "lucide-react"
import { motion } from "framer-motion"

const WHATSAPP_NUMBER = "5531999999999"

const highlights = [
  {
    icon: ClipboardList,
    title: "Pedidos organizados",
    description: "Acompanhe os pedidos da operação em um fluxo simples e claro.",
  },
  {
    icon: Store,
    title: "Cardápio online",
    description: "Divulgue seu cardápio digital no WhatsApp, Instagram e redes sociais.",
  },
  {
    icon: Utensils,
    title: "PDV e mesas",
    description: "Controle atendimento, balcão, mesas e rotina do restaurante.",
  },
  {
    icon: WalletCards,
    title: "Financeiro",
    description: "Tenha mais clareza sobre vendas, caixa, recebimentos e despesas.",
  },
  {
    icon: Users,
    title: "Clientes",
    description: "Organize clientes, histórico e oportunidades de recompra.",
  },
  {
    icon: BarChart3,
    title: "Gestão inteligente",
    description: "Veja dados importantes para tomar decisões melhores no dia a dia.",
  },
]

function getWhatsappLink() {
  const message =
    "Olá! Quero saber mais sobre a ClickFood para o meu restaurante."
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

export default function AuthPage() {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#06152D] text-white">
      <div className="fixed inset-0 -z-30 bg-[#06152D]" />
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_14%_12%,rgba(37,99,235,0.34),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(255,107,26,0.25),transparent_25%),radial-gradient(circle_at_50%_100%,rgba(59,130,246,0.16),transparent_36%)]" />
      <div className="fixed inset-0 -z-10 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:44px_44px]" />

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-[76px] max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <a href="#inicio" className="flex items-center">
            <img
              src="/logo.png"
              alt="ClickFood"
              className="h-12 w-auto object-contain"
            />
          </a>

          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-600 lg:flex">
            <a href="#acesso" className="transition hover:text-[#0B56D9]">
              Acesso
            </a>

            <a href="#recursos" className="transition hover:text-[#0B56D9]">
              Recursos
            </a>

            <a href="#contato" className="transition hover:text-[#0B56D9]">
              Contato
            </a>
          </nav>

          <a
            href={getWhatsappLink()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#FF6B1A] px-4 py-2.5 text-xs font-black text-white shadow-[0_14px_35px_rgba(255,107,26,0.28)] transition hover:bg-[#f05f10] sm:px-5 sm:text-sm"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        </div>
      </header>

      <section
        id="inicio"
        className="relative mx-auto grid max-w-[1180px] gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_430px] lg:items-center lg:py-14"
      >
        <div className="pointer-events-none absolute left-[-120px] top-16 h-[320px] w-[320px] rounded-full bg-blue-500/20 blur-[110px]" />
        <div className="pointer-events-none absolute right-[-120px] top-24 h-[320px] w-[320px] rounded-full bg-[#FF6B1A]/22 blur-[110px]" />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative z-10"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-orange-300">
            <Sparkles className="h-4 w-4" />
            Portal administrativo
          </div>

          <h1 className="mt-6 max-w-[760px] text-[38px] font-black leading-[1.02] tracking-tight text-white sm:text-[52px] lg:text-[64px]">
            Acesse o painel da{" "}
            <span className="bg-gradient-to-r from-orange-300 via-[#FF6B1A] to-orange-400 bg-clip-text text-transparent">
              ClickFood
            </span>{" "}
            e gerencie sua operação.
          </h1>

          <p className="mt-6 max-w-[650px] text-sm leading-7 text-blue-50/72 sm:text-base sm:leading-8">
            Um ambiente criado para restaurantes controlarem pedidos, cardápio,
            mesas, financeiro, clientes e operação com mais organização,
            clareza e agilidade.
          </p>

          <div className="mt-8 grid max-w-[720px] gap-4 sm:grid-cols-3">
            <div className="rounded-[26px] border border-white/10 bg-white/[0.07] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.20)] backdrop-blur-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-50/45">
                Operação
              </p>
              <p className="mt-2 text-xl font-black text-white">
                Pedidos e mesas
              </p>
            </div>

            <div className="rounded-[26px] border border-orange-300/20 bg-orange-400/10 p-5 shadow-[0_20px_70px_rgba(255,107,26,0.12)] backdrop-blur-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-200">
                Controle
              </p>
              <p className="mt-2 text-xl font-black text-orange-300">
                Financeiro
              </p>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.07] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.20)] backdrop-blur-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-50/45">
                Crescimento
              </p>
              <p className="mt-2 text-xl font-black text-white">
                Clientes e dados
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#recursos"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FF6B1A] px-7 py-4 text-sm font-black text-white shadow-[0_18px_45px_rgba(255,107,26,0.34)] transition hover:bg-[#f05f10]"
            >
              Ver recursos
              <ArrowRight className="h-4 w-4" />
            </a>

            <a
              href={getWhatsappLink()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.07] px-7 py-4 text-sm font-black text-white backdrop-blur-xl transition hover:bg-white/[0.11]"
            >
              <MessageCircle className="h-4 w-4" />
              Falar com a ClickFood
            </a>
          </div>
        </motion.div>

        <motion.div
          id="acesso"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="relative z-10 mx-auto w-full max-w-[430px]"
        >
          <div className="absolute inset-0 rounded-[40px] bg-gradient-to-br from-orange-400/30 via-blue-400/12 to-white/10 blur-3xl" />

          <div className="relative rounded-[40px] border border-white/14 bg-white/[0.10] p-3 shadow-[0_34px_110px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
            <div className="rounded-[32px] bg-white px-5 py-7 text-[#06152D] sm:px-8">
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
                  Painel administrativo
                </div>

                <h2 className="mt-4 text-2xl font-black tracking-tight text-[#06152D]">
                  Entrar no painel
                </h2>

                <p className="mx-auto mt-2 max-w-[300px] text-sm leading-6 text-slate-500">
                  Use suas credenciais para acessar sua conta administrativa.
                </p>
              </div>

              <AuthCard />

              <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-center text-xs font-bold text-orange-700">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Ambiente protegido para administradores.
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section
        id="recursos"
        className="relative overflow-hidden bg-[#F7F8FC] py-14 text-[#06152D] sm:py-20"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(255,107,26,0.08),transparent_26%),radial-gradient(circle_at_86%_28%,rgba(37,99,235,0.06),transparent_24%)]" />

        <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8">
          <div className="grid gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FF6B1A]">
                Recursos da plataforma
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
                Tudo no mesmo lugar para o restaurante trabalhar melhor.
              </h2>
            </div>

            <p className="max-w-[560px] text-sm leading-7 text-slate-600 sm:text-base lg:ml-auto">
              A ClickFood centraliza as principais áreas da operação em uma
              experiência simples, visual e pensada para o dia a dia do
              restaurante.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.map((item) => {
              const Icon = item.icon

              return (
                <div
                  key={item.title}
                  className="group rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_26px_80px_rgba(15,23,42,0.10)]"
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6B1A] transition group-hover:bg-[#FF6B1A] group-hover:text-white">
                    <Icon className="h-6 w-6" />
                  </div>

                  <h3 className="text-lg font-black">{item.title}</h3>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section id="contato" className="bg-[#06152D] py-14 text-white sm:py-20">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <div className="rounded-[36px] border border-white/10 bg-white/[0.07] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-8">
            <div className="grid gap-7 lg:grid-cols-[1fr_320px] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-orange-300">
                  <Headphones className="h-4 w-4" />
                  Atendimento ClickFood
                </div>

                <h2 className="mt-5 max-w-[760px] text-3xl font-black tracking-tight sm:text-5xl">
                  Quer conhecer a ClickFood para o seu restaurante?
                </h2>

                <p className="mt-4 max-w-[680px] text-sm leading-7 text-blue-50/68 sm:text-base">
                  Fale com a gente pelo WhatsApp para entender como a plataforma
                  pode ajudar na organização da sua operação.
                </p>
              </div>

              <a
                href={getWhatsappLink()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FF6B1A] px-6 py-4 text-sm font-black text-white shadow-[0_18px_45px_rgba(255,107,26,0.34)] transition hover:bg-[#f05f10]"
              >
                <MessageCircle className="h-5 w-5" />
                Chamar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#03101F] py-10 text-white">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-5 sm:px-8 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <div className="flex items-center">
              <div className="flex h-14 items-center rounded-2xl bg-white px-4 shadow-sm">
                <img
                  src="/logo.png"
                  alt="ClickFood"
                  className="h-9 w-auto object-contain"
                />
              </div>
            </div>

            <p className="mt-5 max-w-[430px] text-sm leading-7 text-blue-50/60">
              Plataforma para restaurantes que querem organizar pedidos,
              cardápio, financeiro, clientes e operação em um só painel.
            </p>
          </div>

          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-orange-300">
              Empresa
            </p>

            <div className="mt-4 space-y-3 text-sm text-blue-50/65">
              <p>ClickFood Tecnologia</p>
              <p>Brasil</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-orange-300">
              Informações
            </p>

            <div className="mt-4 space-y-3 text-sm text-blue-50/65">
              <a href="#" className="block transition hover:text-white">
                Termos de uso
              </a>

              <a href="#" className="block transition hover:text-white">
                Política de privacidade
              </a>

              <a
                href={getWhatsappLink()}
                target="_blank"
                rel="noreferrer"
                className="block transition hover:text-white"
              >
                WhatsApp comercial
              </a>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-[1180px] border-t border-white/10 px-5 pt-6 text-xs text-blue-50/45 sm:px-8">
          © 2026 ClickFood. Todos os direitos reservados.
        </div>
      </footer>
    </main>
  )
}