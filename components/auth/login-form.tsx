"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react"
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react"
import { signIn } from "@/lib/auth"
import { cn } from "@/lib/utils"

interface LoginFormProps {
  onForgotPassword?: () => void
}

export default function LoginForm({ onForgotPassword }: LoginFormProps) {
  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const passwordInputRef = useRef<HTMLInputElement | null>(null)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [touched, setTouched] = useState({
    email: false,
    password: false,
  })

  useEffect(() => {
    const syncAutofillValues = () => {
      const autofilledEmail = emailInputRef.current?.value ?? ""
      const autofilledPassword = passwordInputRef.current?.value ?? ""

      if (autofilledEmail) {
        setEmail(autofilledEmail)
      }

      if (autofilledPassword) {
        setPassword(autofilledPassword)
      }
    }

    syncAutofillValues()

    const timeout = window.setTimeout(syncAutofillValues, 300)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [])

  const cleanEmail = email.trim().toLowerCase()

  const validation = useMemo(() => {
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
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
        setError("Informe um email válido")
      } else if (!validation.password) {
        setError("A senha deve ter pelo menos 6 caracteres")
      }

      return
    }

    setIsLoading(true)

    try {
      const result = await signIn(cleanEmail, password)

      if (!result.success) {
        setError(result.error || "Email ou senha incorretos")
        return
      }

      window.location.href = "/pedidos"
    } catch (err) {
      console.error("LOGIN EXCEPTION:", err)
      setError("Erro ao acessar o painel")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <style>{`
        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:hover,
        .login-input:-webkit-autofill:focus,
        .login-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #050505 inset !important;
          -webkit-text-fill-color: #ffffff !important;
          caret-color: #ffffff !important;
          border-color: rgba(250, 204, 21, 0.55) !important;
          transition: background-color 9999s ease-in-out 0s !important;
        }
      `}</style>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />

          <p className="text-sm font-semibold text-red-300">{error}</p>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-black text-yellow-400">
          Email
        </label>

        <div className="group relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Mail
              className={cn(
                "h-5 w-5 transition-colors",
                touched.email && !validation.email
                  ? "text-red-400"
                  : "text-yellow-400"
              )}
            />
          </div>

          <input
            ref={emailInputRef}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onInput={(e) => setEmail(e.currentTarget.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
            placeholder="seu@email.com"
            autoComplete="email"
            disabled={isLoading}
            className={cn(
              "login-input w-full rounded-2xl border bg-[#050505] py-4 pl-12 pr-4 text-base font-black text-white",
              "placeholder:text-zinc-500 transition-all duration-200",
              "focus:bg-[#050505] focus:outline-none focus:ring-4",
              "disabled:cursor-not-allowed disabled:opacity-50",
              touched.email && !validation.email
                ? "border-red-500 focus:border-red-400 focus:ring-red-500/10"
                : "border-yellow-400/55 focus:border-yellow-400 focus:ring-yellow-400/15"
            )}
          />
        </div>

        {touched.email && !validation.email && cleanEmail.length > 0 && (
          <p className="mt-2 animate-in fade-in text-xs font-semibold text-red-400 duration-150">
            Informe um email válido
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-black text-yellow-400">
          Senha
        </label>

        <div className="group relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Lock
              className={cn(
                "h-5 w-5 transition-colors",
                touched.password && !validation.password
                  ? "text-red-400"
                  : "text-yellow-400"
              )}
            />
          </div>

          <input
            ref={passwordInputRef}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onInput={(e) => setPassword(e.currentTarget.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
            placeholder="Digite sua senha"
            autoComplete="current-password"
            disabled={isLoading}
            className={cn(
              "login-input w-full rounded-2xl border bg-[#050505] py-4 pl-12 pr-12 text-base font-black text-white",
              "placeholder:text-zinc-500 transition-all duration-200",
              "focus:bg-[#050505] focus:outline-none focus:ring-4",
              "disabled:cursor-not-allowed disabled:opacity-50",
              touched.password && !validation.password
                ? "border-red-500 focus:border-red-400 focus:ring-red-500/10"
                : "border-yellow-400/55 focus:border-yellow-400 focus:ring-yellow-400/15"
            )}
          />

          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={isLoading}
            className="absolute inset-y-0 right-0 flex items-center pr-4 text-yellow-400 transition-colors hover:text-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>

        {touched.password && !validation.password && password.length > 0 && (
          <p className="mt-2 animate-in fade-in text-xs font-semibold text-red-400 duration-150">
            A senha deve ter pelo menos 6 caracteres
          </p>
        )}
      </div>

      {onForgotPassword && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm font-bold text-yellow-400 transition-colors hover:text-yellow-300"
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
            ? "bg-yellow-400 text-black shadow-[0_18px_45px_rgba(250,204,21,0.28)] hover:bg-yellow-300"
            : "cursor-not-allowed bg-yellow-400/35 text-black/45 shadow-none"
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Acessando...
          </>
        ) : (
          "Acessar painel"
        )}
      </button>
    </form>
  )
}