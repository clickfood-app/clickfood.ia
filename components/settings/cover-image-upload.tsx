"use client"

import { useState, useRef, useCallback } from "react"
import Image from "next/image"
import {
  Upload,
  X,
  ImageIcon,
  Loader2,
  AlertCircle,
  Trash2,
  CheckCircle2,
  Info,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth/auth-provider"

/** Max file size: 400KB */
const MAX_SIZE = 400 * 1024
/** Max initial file size for processing: 2MB */
const MAX_INITIAL_SIZE = 2 * 1024 * 1024
/** Max dimension for resize */
const MAX_WIDTH = 1200
const MAX_HEIGHT = 400
const ACCEPTED_TYPES = ["image/jpeg", "image/png"]

/**
 * Compresses and resizes an image to fit within MAX_SIZE (400KB)
 * - Resizes to max 1200x400px (cover ratio)
 * - Converts to JPEG with progressive quality reduction
 */
function compressCoverImage(file: File): Promise<{ dataUrl: string; size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio for cover
        let { width, height } = img
        
        // Scale to fit within max dimensions
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width)
          width = MAX_WIDTH
        }
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height)
          height = MAX_HEIGHT
        }

        // Ensure minimum height for cover
        if (height < 200) {
          height = 200
          width = Math.round((img.width * 200) / img.height)
          if (width > MAX_WIDTH) width = MAX_WIDTH
        }

        // Create canvas and draw resized image
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas context not available"))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)

        // Progressive quality reduction for JPEG
        let quality = 0.9
        let dataUrl = canvas.toDataURL("image/jpeg", quality)
        let size = Math.round((dataUrl.length * 3) / 4)

        while (size > MAX_SIZE && quality > 0.3) {
          quality -= 0.05
          dataUrl = canvas.toDataURL("image/jpeg", quality)
          size = Math.round((dataUrl.length * 3) / 4)
        }

        resolve({ dataUrl, size })
      }
      img.onerror = () => reject(new Error("Erro ao carregar imagem"))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"))
    reader.readAsDataURL(file)
  })
}

// Local storage key for cover images (prepared for Supabase)
const COVER_STORAGE_KEY = "clickfood_restaurant_covers"

function getCoverFromStorage(restaurantId: string): string | null {
  if (typeof window === "undefined") return null
  const covers = JSON.parse(localStorage.getItem(COVER_STORAGE_KEY) || "{}")
  return covers[restaurantId] || null
}

function saveCoverToStorage(restaurantId: string, coverUrl: string | null): void {
  if (typeof window === "undefined") return
  const covers = JSON.parse(localStorage.getItem(COVER_STORAGE_KEY) || "{}")
  if (coverUrl) {
    covers[restaurantId] = coverUrl
  } else {
    delete covers[restaurantId]
  }
  localStorage.setItem(COVER_STORAGE_KEY, JSON.stringify(covers))
}

// Export for use in cardapio page
export { getCoverFromStorage }

export default function CoverImageUpload() {
  const { restaurant } = useAuth()
  const [coverUrl, setCoverUrl] = useState<string | null>(() => 
    restaurant?.id ? getCoverFromStorage(restaurant.id) : null
  )
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [imageSize, setImageSize] = useState<number>(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    async (file: File) => {
      setError(null)

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Formato invalido. Use JPG, JPEG ou PNG.")
        return
      }
      if (file.size > MAX_INITIAL_SIZE) {
        setError("Imagem muito grande. Maximo 2MB para processamento.")
        return
      }

      setIsProcessing(true)

      try {
        const { dataUrl, size } = await compressCoverImage(file)

        if (size > MAX_SIZE) {
          setError(`A imagem deve ter no maximo 400KB. Tamanho apos compressao: ${Math.round(size / 1024)}KB`)
          setIsProcessing(false)
          return
        }

        setImageSize(size)
        setPreviewUrl(dataUrl)
      } catch (err) {
        setError("Erro ao processar imagem.")
      }

      setIsProcessing(false)
    },
    []
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
      if (fileInputRef.current) fileInputRef.current.value = ""
    },
    [processFile]
  )

  const handleSave = useCallback(async () => {
    if (!previewUrl || !restaurant?.id) return

    setIsSaving(true)

    // Simulate API call (prepared for Supabase Storage)
    await new Promise((r) => setTimeout(r, 1000))

    // Save to local storage (will be replaced with Supabase)
    saveCoverToStorage(restaurant.id, previewUrl)
    setCoverUrl(previewUrl)
    setPreviewUrl(null)

    setIsSaving(false)
    toast.success("Imagem de capa atualizada com sucesso!")
  }, [previewUrl, restaurant?.id])

  const handleRemove = useCallback(async () => {
    if (!restaurant?.id) return

    setIsSaving(true)
    await new Promise((r) => setTimeout(r, 500))

    // Remove from storage
    saveCoverToStorage(restaurant.id, null)
    setCoverUrl(null)
    setPreviewUrl(null)
    setImageSize(0)
    setError(null)

    setIsSaving(false)
    toast.success("Imagem de capa removida")
  }, [restaurant?.id])

  const handleCancelPreview = useCallback(() => {
    setPreviewUrl(null)
    setImageSize(0)
    setError(null)
  }, [])

  const displayUrl = previewUrl || coverUrl

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <ImageIcon className="h-5 w-5 text-[hsl(var(--primary))]" />
        <h3 className="text-base font-bold text-card-foreground">Imagem de Capa do Cardapio</h3>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Esta imagem aparecera no topo do seu cardapio publico. Recomendamos imagens na proporcao 3:1 (ex: 1200x400px).
      </p>

      {displayUrl ? (
        <div className="space-y-4">
          {/* Preview */}
          <div className="relative overflow-hidden rounded-xl border border-border">
            <div className="relative h-44 w-full bg-muted/30">
              <Image
                src={displayUrl}
                alt="Capa do cardapio"
                fill
                className="object-cover transition-all duration-500"
                sizes="(max-width: 768px) 100vw, 600px"
              />
              {/* Overlay preview */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 text-white">
                <p className="text-xs font-medium text-white/70">Preview</p>
                <p className="text-lg font-bold">{restaurant?.name || "Seu Restaurante"}</p>
              </div>
            </div>

            {/* Size indicator */}
            {imageSize > 0 && (
              <div className="absolute top-3 right-3 rounded-lg bg-black/60 backdrop-blur-sm px-2.5 py-1.5 flex items-center gap-1.5">
                {imageSize <= MAX_SIZE ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                )}
                <span className="text-xs font-medium text-white">
                  {Math.round(imageSize / 1024)}KB
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {previewUrl ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Salvar
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancelPreview}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))]"
                >
                  <Upload className="h-4 w-4" />
                  Trocar imagem
                </button>
                <button
                  onClick={handleRemove}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Remover imagem
                </button>
              </>
            )}
          </div>
        </div>
      ) : isProcessing ? (
        <div className="flex h-44 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5">
          <Loader2 className="h-8 w-8 text-[hsl(var(--primary))] animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Processando imagem...</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Otimizando para 400KB</p>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click()
          }}
          className={cn(
            "flex h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all duration-200",
            isDragOver
              ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 scale-[1.01]"
              : "border-border bg-muted/20 hover:border-[hsl(var(--primary))]/40 hover:bg-muted/40"
          )}
        >
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
              isDragOver
                ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Upload className="h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {isDragOver ? "Solte a imagem aqui" : "Arraste ou clique para enviar"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPG ou PNG. Tamanho maximo: 400KB
            </p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Selecionar imagem de capa"
      />

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5">
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-destructive">{error}</p>
        </div>
      )}

      {/* Info box */}
      <div className="mt-4 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5">
        <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          Se nenhuma imagem for cadastrada, sera exibido um banner padrao azul no cardapio publico.
        </p>
      </div>
    </div>
  )
}
