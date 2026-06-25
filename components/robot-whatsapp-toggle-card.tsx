"use client"

import { useEffect, useState } from "react"
import { Bot, Loader2, Power, PowerOff, RefreshCw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type RobotSettings = {
  id?: string
  restaurant_id: string
  provider?: string
  session_name?: string
  phone_number?: string | null
  is_enabled: boolean
  auto_reply_enabled: boolean
  sales_mode_enabled?: boolean
  campaign_enabled?: boolean
}

export function RobotWhatsappToggleCard() {
  const [settings, setSettings] = useState<RobotSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  async function getAccessToken() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      throw new Error(sessionError.message)
    }

    if (!session?.access_token) {
      throw new Error("Sessão não encontrada. Faça login novamente.")
    }

    return session.access_token
  }

  async function loadSettings() {
    try {
      setLoading(true)
      setError(null)

      const token = await getAccessToken()

      const response = await fetch("/api/robot/settings", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Não foi possível carregar o robô.")
      }

      setSettings(data.settings)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível carregar as configurações do robô."

      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleRobot() {
    if (!settings) return

    try {
      setSaving(true)
      setError(null)

      const nextEnabled = !settings.is_enabled
      const token = await getAccessToken()

      const response = await fetch("/api/robot/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_enabled: nextEnabled,
          auto_reply_enabled: nextEnabled,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Não foi possível atualizar o robô.")
      }

      setSettings(data.settings)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar o robô."

      setError(message)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isEnabled = settings?.is_enabled === true
  const autoReplyEnabled = settings?.auto_reply_enabled === true

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${
              isEnabled
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-[#111111] text-zinc-500"
            }`}
          >
            <Bot className="h-5 w-5" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-white">
                Robô WhatsApp
              </h3>

              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  isEnabled
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-[#111111] text-zinc-500"
                }`}
              >
                {isEnabled ? "Ativado" : "Desativado"}
              </span>
            </div>

            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              Controle se a IA do WhatsApp pode responder automaticamente os
              clientes e direcionar para o cardápio oficial.
            </p>

            <div className="mt-3 grid gap-2 text-sm text-zinc-500 sm:grid-cols-2">
              <div>
                <span className="font-medium text-white">Provedor:</span>{" "}
                {settings?.provider || "WAHA"}
              </div>

              <div>
                <span className="font-medium text-white">Sessão:</span>{" "}
                {settings?.session_name || "default"}
              </div>

              <div>
                <span className="font-medium text-white">
                  Resposta automática:
                </span>{" "}
                {autoReplyEnabled ? "Ligada" : "Desligada"}
              </div>

              <div>
                <span className="font-medium text-white">Número:</span>{" "}
                {settings?.phone_number || "Não informado"}
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={handleToggleRobot}
            disabled={loading || saving || !settings}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isEnabled
                ? "bg-red-600 hover:bg-red-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEnabled ? (
              <PowerOff className="h-4 w-4" />
            ) : (
              <Power className="h-4 w-4" />
            )}

            {saving
              ? "Salvando..."
              : isEnabled
                ? "Desativar robô"
                : "Ativar robô"}
          </button>

          <button
            type="button"
            onClick={loadSettings}
            disabled={loading || saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-zinc-500 transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar status
          </button>
        </div>
      </div>

      {loading && (
        <div className="mt-4 rounded-xl bg-[#111111] px-4 py-3 text-sm text-zinc-500">
          Carregando configurações do robô...
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}