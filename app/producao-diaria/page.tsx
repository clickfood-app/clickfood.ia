"use client"

import Link from "next/link"

export default function ProducaoDiariaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.06] p-6 text-center">
        <h1 className="text-xl font-black">Módulo removido</h1>

        <p className="mt-2 text-sm font-semibold text-slate-400">
          A área de produção diária foi removida do sistema.
        </p>

        <Link
          href="/pedidos"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-orange-500 px-5 text-sm font-black text-white transition hover:bg-orange-600"
        >
          Ir para pedidos
        </Link>
      </div>
    </div>
  )
}