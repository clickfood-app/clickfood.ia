"use client"

import Link from "next/link"
import {
  Gift,
  BadgeDollarSign,
  ChefHat,
  Crown,
  ArrowRight,
  Sparkles,
} from "lucide-react"

const campaignCards = [
  {
    title: "Card Fidelidade",
    description:
      "Crie cartões de fidelidade para recompensar clientes que compram com frequência.",
    href: "/campanhas/fidelidade",
    icon: Gift,
    badge: "Recompra",
  },
  {
    title: "Saldo Promocional",
    description:
      "Use saldo subsidiado pela ClickFood para criar ofertas estratégicas.",
    href: "/campanhas/saldo-promocional",
    icon: BadgeDollarSign,
    badge: "Advanced",
  },
  {
    title: "Meu Lanche",
    description:
      "Crie combos e itens autorais sugeridos pela ClickFood junto com o restaurante.",
    href: "/campanhas/meu-lanche",
    icon: ChefHat,
    badge: "Autoral",
  },
]

export default function CampanhasPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-violet-100 bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-600 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                <Crown className="h-4 w-4 text-yellow-300" />
                Plano Advanced
              </div>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Campanhas inteligentes para vender mais
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-violet-50 sm:text-base">
                Use fidelidade, saldo promocional e ofertas autorais para trazer
                clientes de volta, aumentar pedidos e criar ações exclusivas no
                restaurante.
              </p>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-violet-700">
                  <Sparkles className="h-6 w-6" />
                </div>

                <div>
                  <p className="text-sm text-violet-100">Status da área</p>
                  <p className="text-lg font-bold">Módulo Advanced</p>
                </div>
              </div>

              <p className="mt-4 max-w-xs text-sm text-violet-50">
                Esse módulo pode ficar bloqueado para restaurantes do plano
                básico e liberado apenas no plano Advanced.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {campaignCards.map((card) => {
            const Icon = card.icon

            return (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg"
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 transition group-hover:bg-violet-600 group-hover:text-white">
                    <Icon className="h-6 w-6" />
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {card.badge}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-slate-900">
                  {card.title}
                </h2>

                <p className="mt-2 min-h-[64px] text-sm leading-6 text-slate-500">
                  {card.description}
                </p>

                <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-violet-700">
                  Acessar campanha
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            )
          })}
        </section>
      </div>
    </main>
  )
}