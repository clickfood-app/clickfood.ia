"use client"

import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import Image from "next/image"
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  ImageIcon,
  Link2,
  Loader2,
  Palette,
  QrCode,
  Save,
  Share2,
  Smartphone,
  Store,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
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

type ImageType = "logo" | "cover"

const CLICKFOOD_BLUE = "#2563eb"
const CLICKFOOD_ORANGE = "#f97316"
const MAX_FILE_SIZE_MB = 5
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

export default function CardapioIndexPage() {
  const supabase = useMemo(() => createClient(), [])

  const logoInputRef = useRef<HTMLInputElement | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showQrCode, setShowQrCode] = useState(false)
  const [showMobilePreview, setShowMobilePreview] = useState(false)
  const [uploadingImage, setUploadingImage] = useState<ImageType | null>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [coverImageUrl, setCoverImageUrl] = useState("")

  const publicMenuUrl =
    typeof window !== "undefined" && restaurant?.slug
      ? `${window.location.origin}/cardapio/${restaurant.slug}`
      : ""

  const qrCodeUrl = publicMenuUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=18&data=${encodeURIComponent(
        publicMenuUrl
      )}`
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
          theme_color: CLICKFOOD_BLUE,
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
        theme_color: CLICKFOOD_BLUE,
      })

      alert("Cardápio salvo com sucesso!")
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
      }, 2000)
    } catch {
      alert("Não foi possível copiar o link.")
    }
  }

  function handleGenerateQrCode() {
    if (!publicMenuUrl) {
      alert("Link do cardápio não encontrado.")
      return
    }

    setShowQrCode(true)
  }

  function handleDownloadQrCode() {
    if (!qrCodeUrl) return

    const link = document.createElement("a")
    link.href = qrCodeUrl
    link.download = `qrcode-cardapio-${restaurant?.slug ?? "clickfood"}.png`
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function handleImageUpload(
    event: ChangeEvent<HTMLInputElement>,
    imageType: ImageType
  ) {
    if (!restaurant) return

    const file = event.target.files?.[0]

    if (!file) return

    try {
      if (!file.type.startsWith("image/")) {
        alert("Envie apenas imagens PNG, JPG ou WEBP.")
        return
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`A imagem precisa ter no máximo ${MAX_FILE_SIZE_MB} MB.`)
        return
      }

      setUploadingImage(imageType)

      const extension =
        file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
        "png"

      const filePath = `restaurants/${restaurant.id}/${imageType}-${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from("restaurant-assets")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) {
        throw uploadError
      }

      const { data } = supabase.storage
        .from("restaurant-assets")
        .getPublicUrl(filePath)

      if (imageType === "logo") {
        setLogoUrl(data.publicUrl)
      } else {
        setCoverImageUrl(data.publicUrl)
      }
    } catch (error) {
      console.error("Erro ao enviar imagem:", error)
      alert("Erro ao enviar imagem.")
    } finally {
      setUploadingImage(null)
      event.target.value = ""
    }
  }

  function handleRemoveImage(imageType: ImageType) {
    if (imageType === "logo") {
      setLogoUrl("")
      return
    }

    setCoverImageUrl("")
  }

  const content = (() => {
    if (isLoading) {
      return (
        <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-sm font-semibold text-slate-600">
              Carregando cardápio...
            </span>
          </div>
        </div>
      )
    }

    if (!restaurant) {
      return (
        <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
              <Store className="h-6 w-6 text-slate-500" />
            </div>

            <h1 className="text-lg font-black text-slate-950">
              Restaurante não encontrado
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Não encontramos um restaurante vinculado à sua conta.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-slate-50 px-3 pb-20 pt-4 sm:px-4 lg:px-6 lg:pb-6">
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={(event) => handleImageUpload(event, "logo")}
        />

        <input
          ref={coverInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={(event) => handleImageUpload(event, "cover")}
        />

        <div className="mx-auto max-w-7xl space-y-3">
          <header className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="mb-1 inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-blue-700">
                  <Palette className="h-3 w-3" />
                  Cardápio
                </div>

                <h1 className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">
                  Aparência e divulgação
                </h1>

                <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                  Edite dados públicos, imagens, link e QR Code do cardápio.
                </p>
              </div>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="hidden h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}

                {isSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </header>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <main className="space-y-3">
              <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Share2 className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-slate-950">
                      Divulgação
                    </h2>

                    <p className="text-xs text-slate-500">
                      Link público e QR Code do cardápio.
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                  <div className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                    <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">
                      {publicMenuUrl || "Slug do restaurante não encontrado"}
                    </span>
                  </div>

                  <button
                    onClick={handleCopyLink}
                    disabled={!publicMenuUrl}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}

                    {copied ? "Copiado" : "Copiar"}
                  </button>

                  <a
                    href={publicMenuUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50",
                      !publicMenuUrl && "pointer-events-none opacity-50"
                    )}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir
                  </a>

                  <button
                    type="button"
                    onClick={handleGenerateQrCode}
                    disabled={!publicMenuUrl}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <QrCode className="h-4 w-4" />
                    Gerar QR Code
                  </button>
                </div>

                {showQrCode && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="mx-auto flex h-32 w-32 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-2 sm:mx-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qrCodeUrl}
                          alt="QR Code do cardápio"
                          className="h-full w-full object-contain"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-black text-slate-950">
                              QR Code gerado
                            </h3>

                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              Use em mesas, balcão, embalagem, panfleto ou
                              Instagram.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setShowQrCode(false)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={handleDownloadQrCode}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-black text-white transition hover:bg-slate-800"
                          >
                            <Download className="h-4 w-4" />
                            Baixar PNG
                          </button>

                          <button
                            type="button"
                            onClick={handleCopyLink}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                          >
                            <Copy className="h-4 w-4" />
                            Copiar link
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <Store className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-slate-950">
                      Dados principais
                    </h2>

                    <p className="text-xs text-slate-500">
                      Nome e descrição exibidos no cardápio.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                      Nome do restaurante
                    </label>

                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Nome do restaurante"
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                      Descrição curta
                    </label>

                    <input
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Ex: Hambúrguer artesanal, porções e bebidas."
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
                    <ImageIcon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-slate-950">
                      Imagens
                    </h2>

                    <p className="text-xs text-slate-500">
                      Logo e capa do cardápio. PNG, JPG ou WEBP até 5 MB.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <ImageRow
                    title="Logo do restaurante"
                    description="Imagem pequena que aparece no topo do cardápio."
                    imageUrl={logoUrl}
                    imageAlt="Logo do restaurante"
                    imageType="logo"
                    isUploading={uploadingImage === "logo"}
                    onUpload={() => logoInputRef.current?.click()}
                    onRemove={() => handleRemoveImage("logo")}
                  />

                  <ImageRow
                    title="Capa do cardápio"
                    description="Imagem horizontal principal do cardápio público."
                    imageUrl={coverImageUrl}
                    imageAlt="Capa do cardápio"
                    imageType="cover"
                    isUploading={uploadingImage === "cover"}
                    onUpload={() => coverInputRef.current?.click()}
                    onRemove={() => handleRemoveImage("cover")}
                  />
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <Palette className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-black text-slate-950">
                      Cores oficiais do cardápio
                    </h2>

                    <p className="text-xs leading-5 text-slate-500">
                      O restaurante não edita a cor. A ClickFood mantém o padrão
                      azul e laranja em todos os cardápios.
                    </p>
                  </div>

                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">
                      <span
                        className="h-3.5 w-3.5 rounded-full"
                        style={{ backgroundColor: CLICKFOOD_BLUE }}
                      />
                      Azul
                    </span>

                    <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">
                      <span
                        className="h-3.5 w-3.5 rounded-full"
                        style={{ backgroundColor: CLICKFOOD_ORANGE }}
                      />
                      Laranja
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:hidden">
                <button
                  type="button"
                  onClick={() => setShowMobilePreview((current) => !current)}
                  className="flex w-full items-center justify-between gap-3"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <Smartphone className="h-4 w-4" />
                    </span>

                    <span className="min-w-0 text-left">
                      <span className="block text-sm font-black text-slate-950">
                        Preview do cardápio
                      </span>

                      <span className="block text-xs text-slate-500">
                        Fica fechado no celular para não ocupar tela.
                      </span>
                    </span>
                  </span>

                  <span className="text-xs font-black text-blue-600">
                    {showMobilePreview ? "Fechar" : "Ver"}
                  </span>
                </button>

                {showMobilePreview && (
                  <div className="mt-3">
                    <CompactPreview
                      name={name}
                      description={description}
                      logoUrl={logoUrl}
                      coverImageUrl={coverImageUrl}
                    />
                  </div>
                )}
              </section>
            </main>

            <aside className="hidden lg:block">
              <div className="sticky top-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-black text-slate-950">
                      Preview
                    </h2>

                    <p className="text-xs text-slate-500">Prévia compacta.</p>
                  </div>

                  <Smartphone className="h-5 w-5 text-slate-400" />
                </div>

                <CompactPreview
                  name={name}
                  description={description}
                  logoUrl={logoUrl}
                  coverImageUrl={coverImageUrl}
                />
              </div>
            </aside>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-2 shadow-[0_-10px_30px_rgba(15,23,42,0.10)] sm:hidden">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
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
    )
  })()

  return <AdminLayout>{content}</AdminLayout>
}

type ImageRowProps = {
  title: string
  description: string
  imageUrl: string
  imageAlt: string
  imageType: ImageType
  isUploading: boolean
  onUpload: () => void
  onRemove: () => void
}

function ImageRow({
  title,
  description,
  imageUrl,
  imageAlt,
  imageType,
  isUploading,
  onUpload,
  onRemove,
}: ImageRowProps) {
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:items-center">
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white",
          imageType === "logo" ? "h-16 w-16" : "h-16 w-24"
        )}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            className="object-cover"
          />
        ) : (
          <ImageIcon className="h-5 w-5 text-slate-400" />
        )}
      </div>

      <div className="min-w-0">
        <h3 className="text-sm font-black text-slate-950">{title}</h3>

        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>

        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          {imageUrl ? "Imagem carregada." : "Nenhuma imagem adicionada."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button
          type="button"
          onClick={onUpload}
          disabled={isUploading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}

          {isUploading ? "Enviando" : "Trocar"}
        </button>

        <button
          type="button"
          onClick={onRemove}
          disabled={!imageUrl || isUploading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          Remover
        </button>
      </div>
    </div>
  )
}

type CompactPreviewProps = {
  name: string
  description: string
  logoUrl: string
  coverImageUrl: string
}

function CompactPreview({
  name,
  description,
  logoUrl,
  coverImageUrl,
}: CompactPreviewProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="relative h-36">
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
              background: `linear-gradient(135deg, ${CLICKFOOD_BLUE}, ${CLICKFOOD_ORANGE})`,
            }}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

        <div className="absolute bottom-3 left-3 right-3 flex items-end gap-2">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/30 bg-white shadow-lg">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="Logo do restaurante"
                fill
                className="object-cover"
              />
            ) : (
              <Store className="h-6 w-6 text-slate-400" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-black text-white">
              {name || "Nome do restaurante"}
            </h3>

            <p className="mt-1 line-clamp-2 text-xs leading-4 text-white/75">
              {description || "Descrição curta do restaurante aparecerá aqui."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 border-t border-slate-200 bg-white text-center">
        <div className="px-2 py-3">
          <p className="text-[10px] font-black uppercase text-slate-400">
            Status
          </p>
          <p className="mt-1 text-xs font-black text-slate-950">Aberto</p>
        </div>

        <div className="border-x border-slate-200 px-2 py-3">
          <p className="text-[10px] font-black uppercase text-slate-400">
            Entrega
          </p>
          <p className="mt-1 text-xs font-black text-slate-950">Ativa</p>
        </div>

        <div className="px-2 py-3">
          <p className="text-[10px] font-black uppercase text-slate-400">
            Tema
          </p>

          <div className="mt-1 flex justify-center gap-1">
            <span
              className="h-4 w-4 rounded-full border border-slate-200"
              style={{ backgroundColor: CLICKFOOD_BLUE }}
            />

            <span
              className="h-4 w-4 rounded-full border border-slate-200"
              style={{ backgroundColor: CLICKFOOD_ORANGE }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}