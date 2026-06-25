"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  ExternalLink,
  Link2,
  Loader2,
  Palette,
  Save,
  Share2,
  Store,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Restaurant = {
  id: string
  name: string
  slug: string | null
  description: string | null
  logo_url: string | null
  cover_image_url: string | null
  theme_color: string | null
}

export default function CardapioIndexPage() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [coverImageUrl, setCoverImageUrl] = useState("")
  const [themeColor, setThemeColor] = useState("#facc15")

  const publicMenuUrl =
    typeof window !== "undefined" && restaurant?.slug
      ? `${window.location.origin}/cardapio/${restaurant.slug}`
      : ""

  useEffect(() => {
    async function loadRestaurant() {
      try {
        setIsLoading(true)

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          throw userError
        }

        if (!user) {
          setRestaurant(null)
          return
        }

        const { data, error } = await supabase
          .from("restaurants")
          .select(
            "id, name, slug, description, logo_url, cover_image_url, theme_color"
          )
          .eq("owner_id", user.id)
          .single()

        if (error) {
          throw error
        }

        setRestaurant(data as Restaurant)
        setName(data.name ?? "")
        setDescription(data.description ?? "")
        setLogoUrl(data.logo_url ?? "")
        setCoverImageUrl(data.cover_image_url ?? "")
        setThemeColor(data.theme_color ?? "#facc15")
      } catch (error) {
        console.error("Erro ao carregar cardápio:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadRestaurant()
  }, [supabase])

  async function handleSave() {
    if (!restaurant) return

    try {
      setIsSaving(true)

      const { error } = await supabase
        .from("restaurants")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          logo_url: logoUrl.trim() || null,
          cover_image_url: coverImageUrl.trim() || null,
          theme_color: themeColor || "#facc15",
        })
        .eq("id", restaurant.id)

      if (error) {
        throw error
      }

      setRestaurant({
        ...restaurant,
        name: name.trim(),
        description: description.trim() || null,
        logo_url: logoUrl.trim() || null,
        cover_image_url: coverImageUrl.trim() || null,
        theme_color: themeColor || "#facc15",
      })

      alert("Aparência do cardápio salva com sucesso!")
    } catch (error) {
      console.error("Erro ao salvar aparência do cardápio:", error)
      alert("Erro ao salvar aparência do cardápio.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCopyLink() {
    if (!publicMenuUrl) return

    try {
      await navigator.clipboard.writeText(publicMenuUrl)
      setCopied(true)

      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch {
      alert("Não foi possível copiar o link.")
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0A0A0A] px-5 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
          <span className="text-sm font-medium text-zinc-500">
            Carregando cardápio...
          </span>
        </div>
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border border-white/10 bg-[#0A0A0A] p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#111111]">
            <Store className="h-7 w-7 text-zinc-500" />
          </div>

          <h1 className="text-xl font-black text-white">
            Restaurante não encontrado
          </h1>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Não encontramos um restaurante vinculado à sua conta.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#111111] px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-bold text-yellow-400">
              <Palette className="h-3.5 w-3.5" />
              Cardápio digital
            </div>

            <h1 className="text-2xl font-black tracking-tight text-white lg:text-3xl">
              Aparência e divulgação
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Ajuste o visual do cardápio que o cliente vê e copie o link para
              divulgar no Instagram, WhatsApp e QR Code.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-bold text-black shadow-lg shadow-yellow-400/20 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}

            {isSaving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm lg:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-400">
                  <Palette className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-black text-white">
                    Aparência do cardápio
                  </h2>

                  <p className="text-sm text-zinc-500">
                    Esses dados aparecem no topo do cardápio público.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                    Nome do restaurante
                  </label>

                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nome do restaurante"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:ring-4 focus:ring-yellow-400/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                    Descrição curta
                  </label>

                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Ex: Hambúrguer artesanal, porções e bebidas geladas."
                    rows={3}
                    className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:ring-4 focus:ring-yellow-400/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                    URL da logo
                  </label>

                  <input
                    value={logoUrl}
                    onChange={(event) => setLogoUrl(event.target.value)}
                    placeholder="https://..."
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:ring-4 focus:ring-yellow-400/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                    URL da imagem de capa
                  </label>

                  <input
                    value={coverImageUrl}
                    onChange={(event) => setCoverImageUrl(event.target.value)}
                    placeholder="https://..."
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:ring-4 focus:ring-yellow-400/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                    Cor principal
                  </label>

                  <div className="mt-2 flex gap-3">
                    <input
                      type="color"
                      value={themeColor}
                      onChange={(event) => setThemeColor(event.target.value)}
                      className="h-12 w-16 cursor-pointer rounded-2xl border border-white/10 bg-[#0A0A0A] p-1"
                    />

                    <input
                      value={themeColor}
                      onChange={(event) => setThemeColor(event.target.value)}
                      placeholder="#facc15"
                      className="flex-1 rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:ring-4 focus:ring-yellow-400/20"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-5 shadow-sm lg:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                  <Share2 className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-black text-white">
                    Divulgação
                  </h2>

                  <p className="text-sm text-zinc-500">
                    Use esse link na bio do Instagram, WhatsApp ou QR Code.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#111111] p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
                  Link público do cardápio
                </p>

                <div className="flex flex-col gap-3 lg:flex-row">
                  <div className="flex min-h-12 flex-1 items-center rounded-xl border border-white/10 bg-[#0A0A0A] px-4 text-sm font-medium text-zinc-500">
                    <span className="truncate">
                      {publicMenuUrl || "Slug do restaurante não encontrado"}
                    </span>
                  </div>

                  <button
                    onClick={handleCopyLink}
                    disabled={!publicMenuUrl}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#080808] px-4 py-3 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Link2 className="h-4 w-4" />
                    {copied ? "Copiado" : "Copiar"}
                  </button>

                  <a
                    href={publicMenuUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-3 text-sm font-bold text-zinc-500 transition hover:bg-[#111111]",
                      !publicMenuUrl && "pointer-events-none opacity-50"
                    )}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir
                  </a>
                </div>
              </div>
            </section>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-[#0A0A0A] p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-black text-white">
                Preview rápido
              </h2>

              <p className="text-sm text-zinc-500">
                Prévia simples do topo do cardápio.
              </p>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0A0A0A] shadow-xl">
              <div className="relative h-56">
                {coverImageUrl ? (
                  <Image
                    src={coverImageUrl}
                    alt="Capa do cardápio"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(135deg, ${themeColor}, #111827)`,
                    }}
                  />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

                <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-[#0A0A0A] shadow-xl">
                    {logoUrl ? (
                      <Image
                        src={logoUrl}
                        alt="Logo do restaurante"
                        width={80}
                        height={80}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center"
                        style={{ backgroundColor: themeColor }}
                      >
                        <Store className="h-8 w-8 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-xl font-black text-white">
                      {name || "Nome do restaurante"}
                    </h3>

                    <p className="mt-1 line-clamp-2 text-sm text-white/75">
                      {description ||
                        "Descrição curta do restaurante aparecerá aqui."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 border-t border-white/10 bg-[#0A0A0A]">
                <div className="px-3 py-4 text-center">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">
                    Status
                  </p>
                  <p className="mt-1 text-sm font-black text-white">Aberto</p>
                </div>

                <div className="border-x border-white/10 px-3 py-4 text-center">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">
                    Entrega
                  </p>
                  <p className="mt-1 text-sm font-black text-white">Ativa</p>
                </div>

                <div className="px-3 py-4 text-center">
                  <p className="text-[10px] font-bold uppercase text-zinc-500">
                    Tema
                  </p>
                  <div className="mt-1 flex justify-center">
                    <span
                      className="h-5 w-5 rounded-full border border-white/10"
                      style={{ backgroundColor: themeColor }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}