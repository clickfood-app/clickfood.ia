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

const MAX_IMAGE_SIZE_KB = 300
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_KB * 1024
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
      alert(`A imagem deve ter no máximo ${MAX_IMAGE_SIZE_KB} KB.`)
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
      <div className="space-y-6">
        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-slate-950 text-white shadow-sm">
          <div className="relative p-6 lg:p-8">
            <div
              className="absolute right-0 top-0 h-72 w-72 rounded-full blur-3xl"
              style={{ backgroundColor: `${themeColor}55` }}
            />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div
                  className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-white"
                  style={{ backgroundColor: `${themeColor}40` }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Cardápio digital
                </div>

                <h1 className="text-3xl font-black tracking-tight lg:text-4xl">
                  Aparência e divulgação
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  Ajuste o visual que o cliente vê e copie o link para divulgar
                  no Instagram, WhatsApp, bio e QR Code.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundColor: themeColor,
                  boxShadow: `0 18px 40px -20px ${themeColor}`,
                }}
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
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    <Share2 className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-slate-950">
                      Link de divulgação
                    </h2>

                    <p className="text-sm text-slate-500">
                      Esse é o link que o restaurante coloca na bio, status e QR Code.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Link público do cardápio
                </label>

                <div className="mt-3 flex flex-col gap-3 lg:flex-row">
                  <div className="flex min-h-12 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
                    <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">
                      {publicMenuUrl || "Slug do restaurante não encontrado"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    disabled={!publicMenuUrl}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>

                  <a
                    href={publicMenuUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50",
                      !publicMenuUrl && "pointer-events-none opacity-50",
                    )}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir
                  </a>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                  <Palette className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Aparência do cardápio
                  </h2>

                  <p className="text-sm text-slate-500">
                    Esses dados aparecem no topo do cardápio público.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Nome do restaurante
                  </label>

                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nome do restaurante"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-950 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Descrição curta
                  </label>

                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Ex: Hambúrguer artesanal, porções e bebidas geladas."
                    rows={3}
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Logo do cardápio
                    </label>

                    <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt="Logo do restaurante"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-7 w-7 text-slate-400" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-slate-950">
                            Enviar logo
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            PNG, JPG ou WEBP até {MAX_IMAGE_SIZE_KB} KB.
                          </p>

                          <label className="mt-3 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white transition hover:bg-black">
                            {isUploadingLogo ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}

                            {isUploadingLogo ? "Enviando..." : "Escolher imagem"}

                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={handleLogoUpload}
                              disabled={isUploadingLogo}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {logoUrl && (
                          <button
                            type="button"
                            onClick={() => setLogoUrl("")}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                            aria-label="Remover logo"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Capa do cardápio
                    </label>

                    <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          {coverImageUrl ? (
                            <img
                              src={coverImageUrl}
                              alt="Capa do cardápio"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-7 w-7 text-slate-400" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-slate-950">
                            Enviar capa
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            PNG, JPG ou WEBP até {MAX_IMAGE_SIZE_KB} KB.
                          </p>

                          <label className="mt-3 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white transition hover:bg-black">
                            {isUploadingCover ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}

                            {isUploadingCover ? "Enviando..." : "Escolher imagem"}

                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={handleCoverUpload}
                              disabled={isUploadingCover}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {coverImageUrl && (
                          <button
                            type="button"
                            onClick={() => setCoverImageUrl("")}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                            aria-label="Remover capa"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Cores oficiais do cardápio
                  </label>

                  <div className="mt-3 flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      <span
                        className="h-5 w-5 rounded-full border border-slate-200"
                        style={{ backgroundColor: themeColor }}
                      />
                      <span className="text-xs font-black text-slate-700">
                        Azul ClickFood
                      </span>
                    </div>

                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      <span
                        className="h-5 w-5 rounded-full border border-slate-200"
                        style={{ backgroundColor: accentColor }}
                      />
                      <span className="text-xs font-black text-slate-700">
                        Laranja destaque
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    A cor do cardápio segue o padrão oficial da ClickFood para manter
                    consistência visual em todos os restaurantes.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Preview rápido
                </h2>

                <p className="text-sm text-slate-500">
                  Prévia do topo do cardápio.
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <Eye className="h-5 w-5" />
              </div>
            </div>

            <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl shadow-slate-200">
              <div className="relative h-[320px]">
                {coverImageUrl ? (
                  <img
                    src={coverImageUrl}
                    alt="Capa do cardápio"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(135deg, ${themeColor}, #020617)`,
                    }}
                  />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

                <div className="absolute left-4 top-4">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-black text-white backdrop-blur-md">
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    Aberto agora
                  </span>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-5">
                  <div className="flex items-end gap-4">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-white/20 bg-white shadow-xl">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Logo do restaurante"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center"
                          style={{ backgroundColor: themeColor }}
                        >
                          <Store className="h-10 w-10 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-2xl font-black text-white">
                        {name || "Nome do restaurante"}
                      </h3>

                      <p className="mt-2 line-clamp-2 text-sm leading-5 text-white/75">
                        {description || "Descrição curta do restaurante aparecerá aqui."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 border-t border-slate-200 bg-white">
                <div className="px-3 py-4 text-center">
                  <p className="text-[10px] font-black uppercase text-slate-400">
                    Status
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">Aberto</p>
                </div>

                <div className="border-x border-slate-200 px-3 py-4 text-center">
                  <p className="text-[10px] font-black uppercase text-slate-400">
                    Entrega
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">Ativa</p>
                </div>

                <div className="px-3 py-4 text-center">
                  <p className="text-[10px] font-black uppercase text-slate-400">
                    Tema
                  </p>

                  <div className="mt-1 flex justify-center">
                    <span
                      className="h-5 w-5 rounded-full border border-slate-200"
                      style={{ backgroundColor: themeColor }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AdminLayout>
  )
}