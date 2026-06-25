"use client"

import Link from "next/link"
import {
  ArrowLeft,
  ChefHat,
  Flame,
  PlusCircle,
  ShoppingBasket,
  Sparkles,
  Utensils,
} from "lucide-react"

export default function MeuLanchePage() {
  return (
    <main className="min-h-screen bg-[#111111] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link
              href="/campanhas"
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 transition hover:text-yellow-400"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para campanhas
            </Link>

            <h1 className="text-3xl font-bold tracking-tight text-white">
              Meu Lanche
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Crie sugestões autorais da ClickFood junto com o restaurante para
              lançar combos, produtos e ofertas exclusivas.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-bold text-black shadow-lg shadow-yellow-400/20 transition hover:bg-yellow-300"
          >
            <PlusCircle className="h-5 w-5" />
            Criar sugestão
          </button>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
            <ChefHat className="mb-4 h-6 w-6 text-yellow-400" />
            <p className="text-sm font-medium text-zinc-500">Sugestões criadas</p>
            <strong className="mt-2 block text-2xl font-black text-white">0</strong>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
            <Flame className="mb-4 h-6 w-6 text-yellow-400" />
            <p className="text-sm font-medium text-zinc-500">Ofertas ativas</p>
            <strong className="mt-2 block text-2xl font-black text-white">0</strong>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
            <ShoppingBasket className="mb-4 h-6 w-6 text-yellow-400" />
            <p className="text-sm font-medium text-zinc-500">Pedidos gerados</p>
            <strong className="mt-2 block text-2xl font-black text-white">0</strong>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
            <Sparkles className="mb-4 h-6 w-6 text-yellow-400" />
            <p className="text-sm font-medium text-zinc-500">Ideias disponíveis</p>
            <strong className="mt-2 block text-2xl font-black text-white">0</strong>
          </div>
        </section>

        <section className="rounded-[28px] border border-dashed border-white/10 bg-[#0A0A0A] p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-400">
            <Utensils className="h-7 w-7" />
          </div>

          <h2 className="text-xl font-black text-white">
            Nenhuma sugestão autoral criada ainda
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
            Aqui a ClickFood poderá sugerir combos e produtos autorais para o
            restaurante vender melhor, com nome, preço, descrição e estratégia.
          </p>
        </section>
      </div>
    </main>
  )
}