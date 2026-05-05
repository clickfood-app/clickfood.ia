"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/menu-data"
import {
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Monitor,
  Moon,
  Palette,
  Plus,
  Save,
  Store,
  Sun,
  Trash2,
  Upload,
} from "lucide-react"

type ThemeMode = "dark" | "light"

interface RestaurantThemeData {
  id: string
  owner_id: string
  name: string
  slug: string
  logo_url: string | null
  cover_image_url: string | null
  theme_color: string | null
  theme_mode: ThemeMode | null
  floating_cart_bg_color: string | null
  floating_cart_text_color: string | null
  floating_cart_number_color: string | null
}

function stripUrlParams(url: string) {
  return url.split("?")[0]
}

function withCacheBust(url: string) {
  const cleanUrl = stripUrlParams(url)
  return `${cleanUrl}?t=${Date.now()}`
}

export default function CardapioTab() {
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState("")
  const [restaurantSlug, setRestaurantSlug] = useState("")

  const [logoUrl, setLogoUrl] = useState("")
  const [coverImageUrl, setCoverImageUrl] = useState("")
  const [themeColor, setThemeColor] = useState("#7c3aed")
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark")

  const [floatingCartBgColor, setFloatingCartBgColor] = useState("#7c3aed")
  const [floatingCartTextColor, setFloatingCartTextColor] = useState("#ffffff")
  const [floatingCartNumberColor, setFloatingCartNumberColor] = useState("#ffffff")

  useEffect(() => {
    async function loadRestaurant() {
      try {
        setLoading(true)

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError
        if (!user) throw new Error("Usuario nao autenticado.")

        const { data, error } = await supabase
          .from("restaurants")
          .select(
            "id, owner_id, name, slug, logo_url, cover_image_url, theme_color, theme_mode, floating_cart_bg_color, floating_cart_text_color, floating_cart_number_color"
          )
          .eq("owner_id", user.id)
          .single()

        if (error) throw error

        const restaurant = data as RestaurantThemeData

        setRestaurantId(restaurant.id)
        setRestaurantName(restaurant.name || "")
        setRestaurantSlug(restaurant.slug || "")
        setLogoUrl(restaurant.logo_url ? withCacheBust(restaurant.logo_url) : "")
        setCoverImageUrl(
          restaurant.cover_image_url ? withCacheBust(restaurant.cover_image_url) : ""
        )
        setThemeColor(restaurant.theme_color || "#7c3aed")
        setThemeMode((restaurant.theme_mode as ThemeMode) || "dark")
        setFloatingCartBgColor(
          restaurant.floating_cart_bg_color || restaurant.theme_color || "#7c3aed"
        )
        setFloatingCartTextColor(restaurant.floating_cart_text_color || "#ffffff")
        setFloatingCartNumberColor(restaurant.floating_cart_number_color || "#ffffff")
      } catch (error) {
        console.error(error)
        alert("Nao foi possivel carregar a personalizacao do cardapio.")
      } finally {
        setLoading(false)
      }
    }

    loadRestaurant()
  }, [supabase])

  async function handleLogoUpload(file: File) {
    if (!restaurantId) {
      alert("Restaurante nao encontrado.")
      return
    }

    try {
      setUploadingLogo(true)

      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        alert("Envie uma imagem JPG, PNG ou WEBP.")
        return
      }

      if (file.size > 300 * 1024) {
        alert("A logo deve ter no maximo 300KB.")
        return
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError
      if (!session?.access_token) {
        throw new Error("Sessao invalida. Faca login novamente.")
      }

      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/admin/upload/logo-image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Erro ao enviar a logo.")
      }

      const restaurant = result.restaurant as RestaurantThemeData

      setLogoUrl(restaurant.logo_url ? withCacheBust(restaurant.logo_url) : "")
      setCoverImageUrl(
        restaurant.cover_image_url ? withCacheBust(restaurant.cover_image_url) : ""
      )
      setThemeColor(restaurant.theme_color || "#7c3aed")
      setThemeMode((restaurant.theme_mode as ThemeMode) || "dark")
      setFloatingCartBgColor(
        restaurant.floating_cart_bg_color || restaurant.theme_color || "#7c3aed"
      )
      setFloatingCartTextColor(restaurant.floating_cart_text_color || "#ffffff")
      setFloatingCartNumberColor(restaurant.floating_cart_number_color || "#ffffff")

      alert("Logo salva com sucesso.")
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : "Erro ao enviar a logo.")
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleCoverUpload(file: File) {
    if (!restaurantId) {
      alert("Restaurante nao encontrado.")
      return
    }

    try {
      setUploadingCover(true)

      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        alert("Envie uma imagem JPG, PNG ou WEBP.")
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        alert("A capa deve ter no maximo 5MB.")
        return
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError
      if (!session?.access_token) {
        throw new Error("Sessao invalida. Faca login novamente.")
      }

      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/admin/upload/cover-image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Erro ao enviar a capa.")
      }

      const restaurant = result.restaurant as RestaurantThemeData

      setLogoUrl(restaurant.logo_url ? withCacheBust(restaurant.logo_url) : "")
      setCoverImageUrl(
        restaurant.cover_image_url ? withCacheBust(restaurant.cover_image_url) : ""
      )
      setThemeColor(restaurant.theme_color || "#7c3aed")
      setThemeMode((restaurant.theme_mode as ThemeMode) || "dark")
      setFloatingCartBgColor(
        restaurant.floating_cart_bg_color || restaurant.theme_color || "#7c3aed"
      )
      setFloatingCartTextColor(restaurant.floating_cart_text_color || "#ffffff")
      setFloatingCartNumberColor(restaurant.floating_cart_number_color || "#ffffff")

      alert("Capa salva com sucesso.")
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : "Erro ao enviar a capa.")
    } finally {
      setUploadingCover(false)
    }
  }

  async function handleSave() {
    if (!restaurantId) {
      alert("Restaurante nao encontrado.")
      return
    }

    try {
      setSaving(true)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError
      if (!session?.access_token) {
        throw new Error("Sessao invalida. Faca login novamente.")
      }

      const response = await fetch("/api/restaurants/theme", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          logo_url: logoUrl.trim() ? stripUrlParams(logoUrl.trim()) : null,
          cover_image_url: coverImageUrl.trim()
            ? stripUrlParams(coverImageUrl.trim())
            : null,
          theme_color: themeColor.trim() || "#7c3aed",
          theme_mode: themeMode,
          floating_cart_bg_color: floatingCartBgColor.trim() || "#7c3aed",
          floating_cart_text_color: floatingCartTextColor.trim() || "#ffffff",
          floating_cart_number_color: floatingCartNumberColor.trim() || "#ffffff",
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Erro ao salvar personalizacao.")
      }

      const restaurant = result.restaurant as RestaurantThemeData

      setLogoUrl(restaurant.logo_url ? withCacheBust(restaurant.logo_url) : "")
      setCoverImageUrl(
        restaurant.cover_image_url ? withCacheBust(restaurant.cover_image_url) : ""
      )
      setThemeColor(restaurant.theme_color || "#7c3aed")
      setThemeMode((restaurant.theme_mode as ThemeMode) || "dark")
      setFloatingCartBgColor(
        restaurant.floating_cart_bg_color || restaurant.theme_color || "#7c3aed"
      )
      setFloatingCartTextColor(restaurant.floating_cart_text_color || "#ffffff")
      setFloatingCartNumberColor(restaurant.floating_cart_number_color || "#ffffff")

      alert("Personalizacao salva com sucesso.")
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : "Erro ao salvar a personalizacao.")
    } finally {
      setSaving(false)
    }
  }

  const publicMenuUrl =
    typeof window !== "undefined" && restaurantSlug
      ? `${window.location.origin}/cardapio/${restaurantSlug}`
      : ""

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Carregando personalizacao do cardapio...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Cardapio Publico</h2>
            <p className="text-sm text-muted-foreground">
              Personalize o visual do seu cardapio publico com a cara da sua marca.
            </p>
          </div>

          {publicMenuUrl ? (
            <a
              href={publicMenuUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4" />
              Ver cardapio
            </a>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-background p-5">
              <div className="mb-4 flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Identidade</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Nome da loja
                  </label>
                  <input
                    value={restaurantName}
                    readOnly
                    className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Slug do cardapio
                  </label>
                  <input
                    value={restaurantSlug}
                    readOnly
                    className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Logo da loja
                  </label>

                  <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border bg-white shadow-sm">
                      {logoUrl ? (
                        <Image
                          src={logoUrl}
                          alt="Logo da loja"
                          width={80}
                          height={80}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center"
                          style={{ backgroundColor: themeColor }}
                        >
                          <Store className="h-7 w-7 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col gap-2">
                      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
                        {uploadingLogo ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {uploadingLogo ? "Enviando..." : "Enviar logo"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleLogoUpload(file)
                            e.currentTarget.value = ""
                          }}
                        />
                      </label>

                      {logoUrl ? (
                        <button
                          type="button"
                          onClick={() => setLogoUrl("")}
                          className="inline-flex w-fit items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remover logo
                        </button>
                      ) : null}

                      <p className="text-xs text-muted-foreground">
                        Formatos: JPG, PNG ou WEBP. Tamanho maximo: 300KB.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    URL da logo
                  </label>
                  <input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-5">
              <div className="mb-4 flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Visual</h3>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Cor principal
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      className="h-12 w-16 cursor-pointer rounded-xl border border-border bg-background p-1"
                    />
                    <input
                      value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      placeholder="#7c3aed"
                      className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-sm font-medium text-foreground">
                    Modo do tema
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setThemeMode("dark")}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-all",
                        themeMode === "dark"
                          ? "border-transparent text-white shadow-lg"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      )}
                      style={themeMode === "dark" ? { backgroundColor: themeColor } : undefined}
                    >
                      <Moon className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-semibold">Escuro</p>
                        <p
                          className={cn(
                            "text-xs",
                            themeMode === "dark" ? "text-white/80" : "text-muted-foreground"
                          )}
                        >
                          Mais premium e forte
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setThemeMode("light")}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-all",
                        themeMode === "light"
                          ? "border-transparent text-white shadow-lg"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      )}
                      style={themeMode === "light" ? { backgroundColor: themeColor } : undefined}
                    >
                      <Sun className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-semibold">Claro</p>
                        <p
                          className={cn(
                            "text-xs",
                            themeMode === "light" ? "text-white/80" : "text-muted-foreground"
                          )}
                        >
                          Mais leve e limpo
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Imagem de capa</label>

                  <div className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="relative h-44 w-full bg-muted">
                      {coverImageUrl ? (
                        <img
                          src={coverImageUrl}
                          alt="Preview da capa"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center"
                          style={{ backgroundColor: themeColor }}
                        >
                          <ImageIcon className="h-8 w-8 text-white/80" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 p-4">
                      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
                        {uploadingCover ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {uploadingCover ? "Enviando..." : "Enviar capa"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleCoverUpload(file)
                            e.currentTarget.value = ""
                          }}
                        />
                      </label>

                      {coverImageUrl ? (
                        <button
                          type="button"
                          onClick={() => setCoverImageUrl("")}
                          className="inline-flex w-fit items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remover capa
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Formatos: JPG, PNG ou WEBP. Tamanho maximo: 5MB.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    URL da capa do cardapio
                  </label>
                  <input
                    type="text"
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    Voce tambem pode colar uma URL manualmente, se quiser.
                  </p>
                </div>

                <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Card flutuante do carrinho
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Personalize as cores do botao flutuante que aparece no cardapio
                      publico.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Cor de fundo
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={floatingCartBgColor}
                          onChange={(e) => setFloatingCartBgColor(e.target.value)}
                          className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-background p-1"
                        />
                        <input
                          type="text"
                          value={floatingCartBgColor}
                          onChange={(e) => setFloatingCartBgColor(e.target.value)}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Cor do texto
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={floatingCartTextColor}
                          onChange={(e) => setFloatingCartTextColor(e.target.value)}
                          className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-background p-1"
                        />
                        <input
                          type="text"
                          value={floatingCartTextColor}
                          onChange={(e) => setFloatingCartTextColor(e.target.value)}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Cor dos numeros
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={floatingCartNumberColor}
                          onChange={(e) => setFloatingCartNumberColor(e.target.value)}
                          className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-background p-1"
                        />
                        <input
                          type="text"
                          value={floatingCartNumberColor}
                          onChange={(e) => setFloatingCartNumberColor(e.target.value)}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between rounded-2xl px-4 py-3 shadow-lg"
                    style={{ backgroundColor: floatingCartBgColor }}
                  >
                    <div className="flex items-center gap-3" style={{ color: floatingCartTextColor }}>
                      <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                        <span className="text-sm">🛍️</span>
                        <span
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold"
                          style={{ color: floatingCartNumberColor }}
                        >
                          2
                        </span>
                      </div>

                      <div className="flex flex-col items-start">
                        <span className="text-[10px] font-medium opacity-80">Ver carrinho</span>
                        <span
                          className="text-sm font-bold"
                          style={{ color: floatingCartNumberColor }}
                        >
                          2 itens
                        </span>
                      </div>
                    </div>

                    <div
                      className="flex flex-col items-end"
                      style={{ color: floatingCartTextColor }}
                    >
                      <span className="text-[10px] font-medium opacity-80">Total</span>
                      <span
                        className="text-base font-bold"
                        style={{ color: floatingCartNumberColor }}
                      >
                        R$ 49,90
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                style={{ backgroundColor: themeColor }}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? "Salvando..." : "Salvar personalizacao"}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Previa</h3>
              </div>

              <div
                className={cn(
                  "overflow-hidden rounded-[24px] border shadow-sm",
                  themeMode === "dark"
                    ? "border-white/10 bg-neutral-950"
                    : "border-border bg-gray-50"
                )}
              >
                <div className="relative h-48 overflow-hidden">
                  {coverImageUrl ? (
                    <img
                      src={coverImageUrl}
                      alt="Capa"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{ backgroundColor: themeColor }}
                    />
                  )}

                  <div className="absolute inset-0 bg-black/35" />
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      background: `linear-gradient(180deg, ${themeColor}22 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.75) 100%)`,
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
                </div>

                <div className="relative -mt-12 px-4 pb-4">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-xl">
                      {logoUrl ? (
                        <Image
                          src={logoUrl}
                          alt="Previa da logo"
                          width={96}
                          height={96}
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

                    <h4
                      className={cn(
                        "mt-3 text-lg font-black",
                        themeMode === "dark" ? "text-white" : "text-gray-900"
                      )}
                    >
                      {restaurantName || "Seu restaurante"}
                    </h4>

                    <p
                      className={cn(
                        "mt-1 text-xs",
                        themeMode === "dark" ? "text-white/70" : "text-gray-500"
                      )}
                    >
                      Seu cardapio com a identidade da sua marca.
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      <span
                        className="rounded-full px-3 py-1 text-[11px] font-semibold"
                        style={{
                          backgroundColor:
                            themeMode === "dark" ? "rgba(255,255,255,0.10)" : "#ffffff",
                          color: themeMode === "dark" ? "#ffffff" : "#111827",
                          border:
                            themeMode === "dark"
                              ? "1px solid rgba(255,255,255,0.10)"
                              : "1px solid #e5e7eb",
                        }}
                      >
                        30-45 min
                      </span>

                      <span
                        className="rounded-full px-3 py-1 text-[11px] font-semibold"
                        style={{
                          backgroundColor:
                            themeMode === "dark" ? "rgba(255,255,255,0.10)" : "#ffffff",
                          color: themeMode === "dark" ? "#ffffff" : "#111827",
                          border:
                            themeMode === "dark"
                              ? "1px solid rgba(255,255,255,0.10)"
                              : "1px solid #e5e7eb",
                        }}
                      >
                        Entrega {formatPrice(8.9)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div
                      className={cn(
                        "w-full rounded-xl px-4 py-3 text-sm",
                        themeMode === "dark"
                          ? "border border-white/10 bg-white/10 text-white"
                          : "border border-gray-200 bg-white text-gray-900"
                      )}
                    >
                      Buscar no cardapio...
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2 overflow-hidden">
                    {["Burgers", "Combos", "Bebidas"].map((item, index) => (
                      <div
                        key={item}
                        className={cn(
                          "rounded-full px-4 py-2 text-xs font-semibold",
                          index === 0
                            ? "text-white"
                            : themeMode === "dark"
                              ? "border border-white/10 bg-white/5 text-white/80"
                              : "border border-gray-200 bg-white text-gray-600"
                        )}
                        style={index === 0 ? { backgroundColor: themeColor } : undefined}
                      >
                        {item}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm">
                    <div className="flex gap-3">
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-gray-100">
                        <ImageIcon className="h-6 w-6 text-gray-400" />
                      </div>

                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900">Smash Bacon</p>
                        <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                          Pao brioche, carne smash, cheddar e bacon crocante.
                        </p>

                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm font-bold text-gray-900">
                            {formatPrice(32.9)}
                          </span>

                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-md"
                            style={{ backgroundColor: themeColor }}
                          >
                            <Plus className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="mt-4 flex items-center justify-between rounded-2xl px-4 py-3 shadow-lg"
                    style={{ backgroundColor: floatingCartBgColor }}
                  >
                    <div className="flex items-center gap-3" style={{ color: floatingCartTextColor }}>
                      <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                        <span className="text-sm">🛍️</span>
                        <span
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold"
                          style={{ color: floatingCartNumberColor }}
                        >
                          2
                        </span>
                      </div>

                      <div className="flex flex-col items-start">
                        <span className="text-[10px] font-medium opacity-80">Ver carrinho</span>
                        <span
                          className="text-sm font-bold"
                          style={{ color: floatingCartNumberColor }}
                        >
                          2 itens
                        </span>
                      </div>
                    </div>

                    <div
                      className="flex flex-col items-end"
                      style={{ color: floatingCartTextColor }}
                    >
                      <span className="text-[10px] font-medium opacity-80">Total</span>
                      <span
                        className="text-base font-bold"
                        style={{ color: floatingCartNumberColor }}
                      >
                        R$ 49,90
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                Essa e uma previa visual. O cardapio publico real usa essas mesmas
                preferencias.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}