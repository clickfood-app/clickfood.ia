"use client"

import Image from "next/image"
import AuthCard from "@/components/auth/auth-card"

export default function AuthPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-br from-blue-50 via-white to-blue-50/50">
      {/* Background Pattern */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 w-[500px] h-[500px] rounded-full bg-blue-100/50 blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[400px] h-[400px] rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute top-1/4 left-1/3 w-64 h-64 rounded-full bg-indigo-100/40 blur-3xl" />
      </div>

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="relative h-14 w-14 mb-3">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-white" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight text-center">
          Bem-vindo a ClickFood
        </h1>
        <p className="mt-2 text-gray-500 text-sm">
          Acesse sua conta ou crie uma nova
        </p>
      </div>

      {/* Auth Card */}
      <AuthCard />

      {/* Footer */}
      <div className="mt-8 text-center space-y-2">
        <p className="text-xs text-gray-400">
          Ao continuar, voce concorda com nossos{" "}
          <a href="/termos" className="text-blue-600 hover:underline">
            Termos de Servico
          </a>{" "}
          e{" "}
          <a href="/privacidade" className="text-blue-600 hover:underline">
            Politica de Privacidade
          </a>
        </p>
        <p className="text-xs text-gray-400">
          Duvidas?{" "}
          <a href="/contato" className="text-blue-600 hover:underline font-medium">
            Fale conosco
          </a>
        </p>
      </div>
    </div>
  )
}
