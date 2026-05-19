"use client"

import { useMemo, useState, type FormEvent } from "react"
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react"
import { signIn } from "@/lib/auth"
import { cn } from "@/lib/utils"

interface LoginFormProps {
  onForgotPassword?: () => void
}

export default function LoginForm({ onForgotPassword }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [touched, setTouched] = useState({
    email: false,
    password: false,
  })

  const cleanEmail = email.trim().toLowerCase()

  const validation = useMemo(() => {
    const emailValid =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
      /^\d{10,11}$/.test(cleanEmail.replace(/\D/g, ""))

    const passwordValid = password.length >= 6

    return {
      email: emailValid,
      password: passwordValid,
      canSubmit: emailValid && passwordValid,
    }
  }, [cleanEmail, password])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setTouched({ email: true, password: true })

    if (!validation.canSubmit) {
      if (!validation.email) {
        setError("Informe um email ou telefone válido")
      } else if (!validation.password) {
        setError("A senha deve ter pelo menos 6 caracteres")
      }

      return
    }

    setIsLoading(true)

    try {
      console.log("LOGIN EMAIL:", cleanEmail)

      const result = await signIn(cleanEmail, password)

      console.log("LOGIN RESULT:", result)

      if (!result.success) {
        setError(result.error || "Email ou senha incorretos")
        return
      }

      window.location.href = "/financeiro"
    } catch (err) {
      console.error("LOGIN EXCEPTION:", err)
      setError("Erro ao efetuar login")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />

          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          Email ou telefone
        </label>

        <div className="group relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Mail
              className={cn(
                "h-5 w-5 transition-colors",
                touched.email && !validation.email
                  ? "text-red-400"
                  : "text-slate-400 group-focus-within:text-[#0B56D9]"
              )}
            />
          </div>

          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
            placeholder="seu@email.com ou telefone"
            disabled={isLoading}
            className={cn(
              "w-full rounded-2xl border bg-slate-50 py-4 pl-12 pr-4 text-base font-medium text-slate-900",
              "placeholder:text-slate-400 transition-all duration-200",
              "focus:bg-white focus:outline-none focus:ring-4",
              "disabled:cursor-not-allowed disabled:opacity-50",
              touched.email && !validation.email
                ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                : "border-slate-200 focus:border-[#0B56D9] focus:ring-[#0B56D9]/10"
            )}
          />
        </div>

        {touched.email && !validation.email && cleanEmail.length > 0 && (
          <p className="mt-2 animate-in fade-in text-xs font-medium text-red-500 duration-150">
            Informe um email ou telefone válido
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          Senha
        </label>

        <div className="group relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Lock
              className={cn(
                "h-5 w-5 transition-colors",
                touched.password && !validation.password
                  ? "text-red-400"
                  : "text-slate-400 group-focus-within:text-[#0B56D9]"
              )}
            />
          </div>

          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
            placeholder="Digite sua senha"
            disabled={isLoading}
            className={cn(
              "w-full rounded-2xl border bg-slate-50 py-4 pl-12 pr-12 text-base font-medium text-slate-900",
              "placeholder:text-slate-400 transition-all duration-200",
              "focus:bg-white focus:outline-none focus:ring-4",
              "disabled:cursor-not-allowed disabled:opacity-50",
              touched.password && !validation.password
                ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                : "border-slate-200 focus:border-[#0B56D9] focus:ring-[#0B56D9]/10"
            )}
          />

          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={isLoading}
            className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>

        {touched.password && !validation.password && password.length > 0 && (
          <p className="mt-2 animate-in fade-in text-xs font-medium text-red-500 duration-150">
            A senha deve ter pelo menos 6 caracteres
          </p>
        )}
      </div>

      {onForgotPassword && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm font-semibold text-[#0B56D9] transition-colors hover:text-[#0847B5]"
          >
            Esqueceu sua senha?
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !validation.canSubmit}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-black transition-all duration-200",
          "active:scale-[0.98]",
          validation.canSubmit && !isLoading
            ? "bg-[#0B56D9] text-white shadow-[0_18px_45px_rgba(11,86,217,0.28)] hover:bg-[#0847B5] hover:shadow-[0_22px_55px_rgba(11,86,217,0.34)]"
            : "cursor-not-allowed bg-slate-200 text-slate-400 shadow-none"
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
    </form>
  )
}