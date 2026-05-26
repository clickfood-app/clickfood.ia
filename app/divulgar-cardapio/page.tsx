"use client"

import { ChangeEvent, useEffect, useMemo, useState } from "react"
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  ImageIcon,
  Link2,
  Loader2,
  Palette,
  RefreshCw,
  Save,
  Share2,
  Sparkles,
  Store,
  Upload,
  X,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Restaurant = {
  id: string
  name: string | null
  slug: string | null
  description: string | null
  logo_url: string | null
  cover_image_url: string | null
  theme_color: string | null
}

const MAX_IMAGE_SIZE_KB = 5 * 1024
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_KB * 1024
const MAX_IMAGE_SIZE_LABEL = "5 MB"
const STORAGE_BUCKET = "restaurant-assets"
const CLICKFOOD_BLUE = "#2563eb"
const CLICKFOOD_ORANGE = "#f97316"

export default function DivulgarCardapioPage() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [copied, setCopied] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [coverImageUrl, setCoverImageUrl] = useState("")
  const themeColor = CLICKFOOD_BLUE
  const accentColor = CLICKFOOD_ORANGE

  const publicMenuUrl =
    typeof window !== "undefined" && restaurant?.slug
      ? `${window.location.origin}/cardapio/${restaurant.slug}`
      : ""

  const previewUrl = publicMenuUrl
    ? `${publicMenuUrl}?preview=${previewKey}`
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
          .select("id, name, slug, description, logo_url, cover_image_url, theme_color")
          .eq("owner_id", user.id)
          .maybeSingle()

        if (error) {
          throw error
        }

        if (!data) {
          setRestaurant(null)
          return
        }

        setRestaurant(data as Restaurant)
        setName(data.name ?? "")
        setDescription(data.description ?? "")
        setLogoUrl(data.logo_url ?? "")
        setCoverImageUrl(data.cover_image_url ?? "")
      } catch (error) {
        console.error("Erro ao carregar dados do cardápio:", error)
        setRestaurant(null)
      } finally {
        setIsLoading(false)
      }
    }

    void loadRestaurant()
  }, [supabase])

  function validateImage(file: File) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]

    if (!allowedTypes.includes(file.type)) {
      alert("Envie uma imagem em PNG, JPG ou WEBP.")
      return false
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      alert(`A imagem deve ter no máximo ${MAX_IMAGE_SIZE_LABEL}.`)
      return false
    }

    return true
  }

  async function uploadRestaurantImage(file: File, type: "logo" | "cover") {
    if (!restaurant) return null
    if (!validateImage(file)) return null

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.user?.id) {
      throw new Error("Sessão expirada. Faça login novamente.")
    }

    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg"

    const filePath = `restaurants/${session.user.id}/${restaurant.id}/${type}-${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      throw new Error(uploadError.message || "Erro ao enviar imagem.")
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath)

    if (!data.publicUrl) {
      throw new Error("Imagem enviada, mas a URL pública não foi retornada.")
    }

    return data.publicUrl
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) return

    try {
      setIsUploadingLogo(true)

      const uploadedUrl = await uploadRestaurantImage(file, "logo")

      if (!uploadedUrl) return

      setLogoUrl(uploadedUrl)
    } catch (error) {
      console.error("Erro ao enviar logo:", error)
      alert(error instanceof Error ? error.message : "Erro ao enviar logo.")
    } finally {
      setIsUploadingLogo(false)
    }
  }

  async function handleCoverUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) return

    try {
      setIsUploadingCover(true)

      const uploadedUrl = await uploadRestaurantImage(file, "cover")

      if (!uploadedUrl) return

      setCoverImageUrl(uploadedUrl)
    } catch (error) {
      console.error("Erro ao enviar capa:", error)
      alert(error instanceof Error ? error.message : "Erro ao enviar imagem de capa.")
    } finally {
      setIsUploadingCover(false)
    }
  }

  async function handleSave() {
    if (!restaurant) return

    try {
      setIsSaving(true)

      const nextName = name.trim()
      const nextDescription = description.trim()
      const nextLogoUrl = logoUrl.trim()
      const nextCoverImageUrl = coverImageUrl.trim()

      const { error } = await supabase
        .from("restaurants")
        .update({
          name: nextName,
          description: nextDescription || null,
          logo_url: nextLogoUrl || null,
          cover_image_url: nextCoverImageUrl || null,
        })
        .eq("id", restaurant.id)

      if (error) {
        throw error
      }

      setRestaurant({
        ...restaurant,
        name: nextName,
        description: nextDescription || null,
        logo_url: nextLogoUrl || null,
        cover_image_url: nextCoverImageUrl || null,
      })

      setPreviewKey((current) => current + 1)

      alert("Cardápio atualizado com sucesso!")
    } catch (error) {
      console.error("Erro ao salvar cardápio:", error)
      alert("Erro ao salvar cardápio.")
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
      }, 1800)
    } catch {
      alert("Não foi possível copiar o link.")
    }
  }

  if (isLoading) {
    return (
      <AdminLayout title="Cardápio">
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-sm font-semibold text-slate-600">
              Carregando cardápio...
            </span>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!restaurant) {
    return (
      <AdminLayout title="Cardápio">
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="max-w-md rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <Store className="h-7 w-7 text-slate-500" />
            </div>

            <h1 className="text-xl font-black text-slate-950">
              Restaurante não encontrado
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Não encontrei um restaurante vinculado à sua conta.
            </p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Cardápio">
      <div className="space-y-5">
        <div className="sticky top-4 z-20 overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 shadow-sm shadow-slate-200/70 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.14),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.10),transparent_30%)]" />

          <div className="relative flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Cardápio digital
                </span>

                <span className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">
                  Identidade pública
                </span>
              </div>

              <h1 className="text-2xl font-black tracking-tight text-slate-950">
                Editor De Cardápio
              </h1>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Configure como o cliente enxerga seu restaurante e use o link público
                para vender pelo Instagram, WhatsApp e QR Code.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white shadow-xl shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}

              {isSaving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-5">
            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
              <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                      <Share2 className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-base font-black text-slate-950">
                        Link público
                      </h2>

                      <p className="text-sm text-slate-500">
                        Copie e divulgue em qualquer canal.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row lg:w-[560px]">
                    <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm">
                      <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate">
                        {publicMenuUrl || "Slug do restaurante não encontrado"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyLink}
                      disabled={!publicMenuUrl}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>

                    <a
                      href={publicMenuUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50",
                        !publicMenuUrl && "pointer-events-none opacity-50",
                      )}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir
                    </a>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 p-5 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                    Bio do Instagram
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    Link direto
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                    WhatsApp
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    Envie para clientes
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                    QR Code
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    Ideal para balcão
                  </p>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
              <div className="border-b border-slate-100 bg-gradient-to-r from-white to-slate-50 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                    <Palette className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-slate-950">
                      Identidade do cardápio
                    </h2>

                    <p className="text-sm text-slate-500">
                      Dados exibidos no topo do cardápio público.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-5">
                <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Nome do restaurante
                    </label>

                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Nome do restaurante"
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Descrição curta
                    </label>

                    <input
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Ex: Hambúrguer artesanal, porções e bebidas geladas."
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt="Logo do restaurante"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-slate-400" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-950">
                            Logo do restaurante
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Aparece no topo do cardápio. PNG, JPG ou WEBP até{" "}
                            {MAX_IMAGE_SIZE_LABEL}.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-black">
                          {isUploadingLogo ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}

                          {isUploadingLogo ? "Enviando..." : "Trocar"}

                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleLogoUpload}
                            disabled={isUploadingLogo}
                            className="hidden"
                          />
                        </label>

                        {logoUrl && (
                          <button
                            type="button"
                            onClick={() => setLogoUrl("")}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                            aria-label="Remover logo"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          {coverImageUrl ? (
                            <img
                              src={coverImageUrl}
                              alt="Capa do cardápio"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-slate-400" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-950">
                            Capa do cardápio
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Imagem horizontal de impacto para abertura do cardápio.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-black">
                          {isUploadingCover ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}

                          {isUploadingCover ? "Enviando..." : "Trocar"}

                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleCoverUpload}
                            disabled={isUploadingCover}
                            className="hidden"
                          />
                        </label>

                        {coverImageUrl && (
                          <button
                            type="button"
                            onClick={() => setCoverImageUrl("")}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                            aria-label="Remover capa"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Cores oficiais do cardápio
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Mantém a identidade visual da ClickFood em todos os restaurantes.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                        <span
                          className="h-4 w-4 rounded-full border border-slate-200"
                          style={{ backgroundColor: themeColor }}
                        />
                        <span className="text-xs font-black text-slate-700">
                          Azul ClickFood
                        </span>
                      </div>

                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                        <span
                          className="h-4 w-4 rounded-full border border-slate-200"
                          style={{ backgroundColor: accentColor }}
                        />
                        <span className="text-xs font-black text-slate-700">
                          Laranja destaque
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="xl:sticky xl:top-28 xl:self-start">
            <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    Preview completo
                  </h2>

                  <p className="text-sm text-slate-500">
                    Role a tela como no celular do cliente.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewKey((current) => current + 1)}
                    disabled={!publicMenuUrl}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Atualizar preview"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>

                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                    <Eye className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_35%),linear-gradient(180deg,#f8fafc,#ffffff)] p-5">
                <div className="mx-auto max-w-[330px] rounded-[42px] bg-slate-950 p-2 shadow-2xl shadow-slate-950/25">
                  <div className="mb-2 flex justify-center pt-1">
                    <div className="h-1.5 w-16 rounded-full bg-white/20" />
                  </div>

                  <div className="overflow-hidden rounded-[34px] bg-white">
                    {previewUrl ? (
                      <iframe
                        key={previewKey}
                        src={previewUrl}
                        title="Preview do cardápio público"
                        className="h-[650px] w-full border-0 bg-white"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-[650px] items-center justify-center bg-slate-50 p-6 text-center">
                        <div>
                          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                            <Store className="h-7 w-7 text-slate-400" />
                          </div>

                          <p className="text-sm font-black text-slate-950">
                            Preview indisponível
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            O restaurante precisa ter um slug público para abrir a prévia.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex justify-center pb-1">
                    <div className="h-1 w-20 rounded-full bg-white/20" />
                  </div>
                </div>

                <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                  Depois de alterar nome, logo ou capa, clique em{" "}
                  <span className="font-black text-slate-700">Salvar alterações</span>{" "}
                  para atualizar o preview público.
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AdminLayout>
  )
}