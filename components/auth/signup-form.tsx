"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Mail, Lock, User, Store } from "lucide-react"
import { signUp } from "@/lib/auth"
import { useAuth } from "@/components/auth/auth-provider"

export default function SignUpForm() {
  const router = useRouter()
  const { refreshSession } = useAuth()
  const [name, setName] = useState("")
  const [restaurantName, setRestaurantName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Basic validation
    if (!name.trim()) {
      setError("Por favor, informe seu nome")
      return
    }
    if (!restaurantName.trim()) {
      setError("Por favor, informe o nome do seu restaurante")
      return
    }
    if (!email.trim()) {
      setError("Por favor, informe seu email")
      return
    }
    if (!password) {
      setError("Por favor, crie uma senha")
      return
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres")
      return
    }
    if (password !== confirmPassword) {
      setError("As senhas nao coincidem")
      return
    }

    setIsLoading(true)

    const result = await signUp(email, password, name, restaurantName)

    if (!result.success) {
      setError(result.error || "Erro ao criar conta")
      setIsLoading(false)
      return
    }

    // Refresh session in context
    refreshSession()

    setIsLoading(false)

    // After successful signup, redirect to welcome page
    router.push("/bem-vindo")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Seu nome
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <User className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome completo"
            disabled={isLoading}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Restaurant Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Nome do restaurante
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Store className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            placeholder="Ex: Pizzaria do Joao"
            disabled={isLoading}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Email
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Mail className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            disabled={isLoading}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Senha
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Lock className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimo 6 caracteres"
            disabled={isLoading}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Confirmar senha
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Lock className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repita sua senha"
            disabled={isLoading}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-blue-600/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 disabled:active:scale-100"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Criando conta...
          </>
        ) : (
          "Comecar teste gratis"
        )}
      </button>

      {/* Terms */}
      <p className="text-xs text-center text-gray-500">
        Ao criar sua conta, voce concorda com nossos{" "}
        <a href="/termos" className="text-blue-600 hover:underline">
          Termos de Uso
        </a>{" "}
        e{" "}
        <a href="/privacidade" className="text-blue-600 hover:underline">
          Politica de Privacidade
        </a>
      </p>
    </form>
  )
}
