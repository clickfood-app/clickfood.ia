"use client"

import LoginForm from "./login-form"
import { ShieldCheck, Sparkles } from "lucide-react"

export default function AuthCard() {
  return (
    <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-6 duration-700">

      {/* Glow externo */}
      <div className="relative">

        <div className="absolute inset-0 rounded-[32px] bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 blur-2xl opacity-40" />

        {/* Card principal */}
        <div className="relative rounded-[28px] border border-white/10 bg-white/95 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.35)] overflow-hidden">

          {/* HEADER */}
          <div className="relative border-b border-slate-200 px-6 py-5 sm:px-8">

            {/* Badge */}
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-600">
              <Sparkles size={12} />
              Acesso seguro
            </div>

            <h2 className="text-lg font-bold text-slate-900">
              Entrar na plataforma
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Use o acesso liberado pela equipe ClickFood
            </p>

            {/* Linha glow */}
            <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-transparent opacity-60" />
          </div>

          {/* BODY */}
          <div className="p-6 sm:p-8">

            <div className="animate-in fade-in slide-in-from-right-3 duration-500">
              <LoginForm />
            </div>

            {/* Segurança */}
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <ShieldCheck className="h-4 w-4 text-violet-600" />
              <p className="text-xs text-slate-600">
                Seus dados são protegidos e criptografados
              </p>
            </div>

          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center">
        <p className="text-xs text-slate-400">
          ClickFood • tecnologia para restaurantes que querem crescer
        </p>
      </div>
    </div>
  )
}