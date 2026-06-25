"use client"

import AuthCard from "@/components/auth/auth-card"

export default function AuthPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-4 py-8">
      <section className="w-full max-w-[420px] rounded-[28px] border border-yellow-400/25 bg-[#080808] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.75)] sm:p-8">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-black tracking-tight text-white">
            Acessar painel
          </h1>

          <p className="mt-2 text-sm font-medium text-zinc-500">
            Entre com seu email e senha.
          </p>
        </div>

        <AuthCard />
      </section>
    </main>
  )
}