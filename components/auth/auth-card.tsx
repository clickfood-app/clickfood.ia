"use client"

import LoginForm from "./login-form"
import { ShieldCheck } from "lucide-react"

export default function AuthCard() {
  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="animate-in fade-in slide-in-from-right-3 duration-500">
        <LoginForm />
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <ShieldCheck className="h-4 w-4 text-[#0B56D9]" />

        <p className="text-center text-xs font-medium text-slate-500">
          Seus dados são protegidos e criptografados.
        </p>
      </div>
    </div>
  )
}