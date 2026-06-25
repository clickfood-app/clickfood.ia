"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail, Send, Clock, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ContatoPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)

    // Simulate sending
    await new Promise((resolve) => setTimeout(resolve, 1500))

    setSending(false)
    setSent(true)
  }

  const isValid = name.trim() && email.trim() && message.trim()

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-400 to-[#080808]">
      {/* Header */}
      <header className="border-b border-yellow-400/30 bg-[#0A0A0A] backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-yellow-400 hover:text-yellow-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao site
          </Link>
          <span className="text-lg font-bold text-yellow-400">ClickFood</span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-yellow-400/30 bg-[#0A0A0A] p-8 md:p-12 shadow-sm">
          {/* Title */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/10">
              <Mail className="h-7 w-7 text-yellow-400" />
            </div>
            <h1 className="text-3xl font-bold text-white">Fale Conosco</h1>
            <p className="mt-2 text-zinc-500">
              Estamos aqui para ajudar. Envie sua mensagem e responderemos o mais breve possivel.
            </p>
          </div>

          {sent ? (
            /* Success State */
            <div className="text-center py-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Mensagem enviada!</h2>
              <p className="text-zinc-500 mb-6">
                Obrigado por entrar em contato. Responderemos em ate 48 horas uteis.
              </p>
              <button
                onClick={() => {
                  setSent(false)
                  setName("")
                  setEmail("")
                  setSubject("")
                  setMessage("")
                }}
                className="text-yellow-400 hover:text-yellow-400 hover:underline font-medium"
              >
                Enviar outra mensagem
              </button>
            </div>
          ) : (
            /* Contact Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-zinc-500 mb-1.5">
                  Seu nome *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como podemos te chamar?"
                  className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white placeholder:text-zinc-500 transition-all focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-zinc-500 mb-1.5">
                  Seu e-mail *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white placeholder:text-zinc-500 transition-all focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-zinc-500 mb-1.5">
                  Assunto
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Sobre o que voce quer falar?"
                  className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white placeholder:text-zinc-500 transition-all focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-zinc-500 mb-1.5">
                  Mensagem *
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escreva sua mensagem aqui..."
                  rows={5}
                  className="w-full rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white placeholder:text-zinc-500 transition-all focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-yellow-400/20 resize-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!isValid || sending}
                className={cn(
                  "w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all",
                  isValid && !sending
                    ? "bg-yellow-400 text-black hover:bg-yellow-300 shadow-sm"
                    : "bg-[#111111] text-zinc-500 cursor-not-allowed"
                )}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Enviar mensagem
                  </>
                )}
              </button>
            </form>
          )}

          {/* Response Time */}
          <div className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-yellow-400/10 px-4 py-3">
            <Clock className="h-4 w-4 text-yellow-400" />
            <span className="text-sm text-yellow-400">
              Respondemos em ate <strong>48 horas uteis</strong>
            </span>
          </div>

          {/* Direct Email */}
          <div className="mt-6 text-center">
            <p className="text-sm text-zinc-500 mb-2">Ou envie diretamente para:</p>
            <a
              href="mailto:goeatscentral@gmail.com"
              className="inline-flex items-center gap-2 text-yellow-400 hover:text-yellow-400 hover:underline font-semibold"
            >
              <Mail className="h-4 w-4" />
              goeatscentral@gmail.com
            </a>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
          <Link href="/privacidade" className="text-yellow-400 hover:text-yellow-400 hover:underline">
            Politica de Privacidade
          </Link>
          <span className="text-zinc-500">|</span>
          <Link href="/termos" className="text-yellow-400 hover:text-yellow-400 hover:underline">
            Termos de Servico
          </Link>
        </div>
      </main>
    </div>
  )
}
