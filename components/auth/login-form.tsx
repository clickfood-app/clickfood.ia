"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react"
import { signIn } from "@/lib/auth"
import { useAuth } from "@/components/auth/auth-provider"
import { cn } from "@/lib/utils"

interface LoginFormProps {
  onForgotPassword?: () => void
}

export default function LoginForm({ onForgotPassword }: LoginFormProps) {
  const router = useRouter()
  const { refreshSession } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [touched, setTouched] = useState({ email: false, password: false })

  // Real-time validation
  const validation = useMemo(() => {
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /^\d{10,11}$/.test(email.replace(/\D/g, ""))
    const passwordValid = password.length >= 6
    return {
      email: emailValid,
      password: passwordValid,
      canSubmit: emailValid && passwordValid,
    }
  }, [email, password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setTouched({ email: true, password: true })

    if (!validation.canSubmit) {
      if (!validation.email) {
        setError("Informe um email ou telefone valido")
      } else if (!validation.password) {
        setError("A senha deve ter pelo menos 6 caracteres")
      }
      return
    }

    setIsLoading(true)

    const result = await signIn(email, password)

    if (!result.success) {
      setError(result.error || "Email ou senha incorretos")
      setIsLoading(false)
      return
    }

    refreshSession()
    setIsLoading(false)

    if (result.needsSubscription) {
      router.push("/oferta")
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Email/Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email ou telefone
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Mail className={cn(
              "h-5 w-5 transition-colors",
              touched.email && !validation.email ? "text-red-400" : "text-gray-400 group-focus-within:text-blue-500"
            )} />
          </div>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            placeholder="Seu email ou telefone"
            disabled={isLoading}
            className={cn(
              "w-full rounded-xl border bg-gray-50/50 pl-12 pr-4 py-3.5 text-base text-gray-900",
              "placeholder:text-gray-400 transition-all duration-200",
              "focus:bg-white focus:outline-none focus:ring-2 focus:ring-offset-0",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              touched.email && !validation.email
                ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                : "border-gray-200 focus:border-blue-400 focus:ring-blue-100"
            )}
          />
        </div>
        {touched.email && !validation.email && email.length > 0 && (
          <p className="mt-1.5 text-xs text-red-500 animate-in fade-in duration-150">
            Informe um email ou telefone valido
          </p>
        )}
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Senha
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Lock className={cn(
              "h-5 w-5 transition-colors",
              touched.password && !validation.password ? "text-red-400" : "text-gray-400 group-focus-within:text-blue-500"
            )} />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            placeholder="Sua senha"
            disabled={isLoading}
            className={cn(
              "w-full rounded-xl border bg-gray-50/50 pl-12 pr-12 py-3.5 text-base text-gray-900",
              "placeholder:text-gray-400 transition-all duration-200",
              "focus:bg-white focus:outline-none focus:ring-2 focus:ring-offset-0",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              touched.password && !validation.password
                ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                : "border-gray-200 focus:border-blue-400 focus:ring-blue-100"
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {touched.password && !validation.password && password.length > 0 && (
          <p className="mt-1.5 text-xs text-red-500 animate-in fade-in duration-150">
            A senha deve ter pelo menos 6 caracteres
          </p>
        )}
      </div>

      {/* Forgot Password Link */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors hover:underline"
        >
          Esqueci minha senha
        </button>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !validation.canSubmit}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-xl py-4 text-base font-semibold transition-all duration-200",
          "shadow-lg active:scale-[0.98]",
          validation.canSubmit && !isLoading
            ? "bg-blue-600 text-white shadow-blue-600/25 hover:bg-blue-700 hover:shadow-blue-600/30"
            : "bg-gray-200 text-gray-400 shadow-none cursor-not-allowed"
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Entrando...
          </>
        ) : (
          "Entrar"
        )}
      </button>

      {/* Social Login Divider */}
      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-4 text-gray-400">ou continue com</span>
        </div>
      </div>

      {/* Social Login Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={isLoading}
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google
        </button>
        <button
          type="button"
          disabled={isLoading}
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          Apple
        </button>
      </div>
    </form>
  )
}
