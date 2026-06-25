"use client"

import Link from "next/link"

export default function GarconsPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0A0A0A] p-6 text-center">
        <h1 className="text-xl font-black">Módulo removido</h1>

        <p className="mt-2 text-sm font-semibold text-zinc-500">
          A área de garçons foi removida do sistema.
        </p>

        <Link
          href="/pedidos"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-yellow-400 px-5 text-sm font-black text-black transition hover:bg-yellow-300"
        >
          Ir para pedidos
        </Link>
      </div>
    </div>
  )
}