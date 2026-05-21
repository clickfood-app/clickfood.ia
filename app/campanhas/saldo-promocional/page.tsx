"use client"

import Link from "next/link"
import {
  ArrowLeft,
  BadgeDollarSign,
  Megaphone,
  PiggyBank,
  PlusCircle,
  Receipt,
} from "lucide-react"

export default function SaldoPromocionalPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link
              href="/campanhas"
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-violet-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para campanhas
            </Link>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Saldo Promocional
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Use saldo subsidiado pela ClickFood para criar ofertas, descontos
              e campanhas estratégicas no plano Advanced.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700"
          >
            <PlusCircle className="h-5 w-5" />
            Nova oferta
          </button>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <PiggyBank className="mb-4 h-6 w-6 text-violet-600" />
            <p className="text-sm font-medium text-slate-500">Saldo disponível</p>
            <strong className="mt-2 block text-2xl font-black text-slate-950">
              R$ 0,00
            </strong>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <BadgeDollarSign className="mb-4 h-6 w-6 text-violet-600" />
            <p className="text-sm font-medium text-slate-500">Saldo utilizado</p>
            <strong className="mt-2 block text-2xl font-black text-slate-950">
              R$ 0,00
            </strong>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <Receipt className="mb-4 h-6 w-6 text-violet-600" />
            <p className="text-sm font-medium text-slate-500">Pedidos gerados</p>
            <strong className="mt-2 block text-2xl font-black text-slate-950">0</strong>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <Megaphone className="mb-4 h-6 w-6 text-violet-600" />
            <p className="text-sm font-medium text-slate-500">Campanhas ativas</p>
            <strong className="mt-2 block text-2xl font-black text-slate-950">0</strong>
          </div>
        </section>

        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <BadgeDollarSign className="h-7 w-7" />
          </div>

          <h2 className="text-xl font-black text-slate-950">
            Nenhuma oferta com saldo promocional criada
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Aqui o restaurante poderá usar saldo promocional para criar descontos
            controlados, frete grátis ou campanhas subsidiadas pela ClickFood.
          </p>
        </section>
      </div>
    </main>
  )
}