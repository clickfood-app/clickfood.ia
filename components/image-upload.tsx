"use client"

import React from "react"

import { useState, useRef, useCallback } from "react"
import { Upload, X, ImageIcon, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImageUploadProps {
  value: string | null
  onChange: (value: string | null) => void
  /** Compact mode for inline thumbnails */
  compact?: boolean
}

/** Max file size after compression: 300KB */
const MAX_FINAL_SIZE = 300 * 1024
/** Max initial file size for processing: 1.5MB */
const MAX_INITIAL_SIZE = 1.5 * 1024 * 1024
/** Max dimension for resize */
const MAX_DIMENSION = 800
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"]

/**
 * Compresses and resizes an image to fit within MAX_FINAL_SIZE (300KB)
 * - Resizes to max 800x800px
 * - Converts to WEBP/JPEG with progressive quality reduction
 */
function compressImage(file: File): Promise<{ dataUrl: string; size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
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

        // Try WEBP first, then JPEG with progressive quality reduction
        let quality = 0.85
        let dataUrl = canvas.toDataURL("image/webp", quality)
        let size = Math.round((dataUrl.length * 3) / 4)

        while (size > MAX_FINAL_SIZE && quality > 0.3) {
          quality -= 0.1
          dataUrl = canvas.toDataURL("image/webp", quality)
          size = Math.round((dataUrl.length * 3) / 4)
        }

        // If still too large, try JPEG
        if (size > MAX_FINAL_SIZE) {
          quality = 0.8
          dataUrl = canvas.toDataURL("image/jpeg", quality)
          size = Math.round((dataUrl.length * 3) / 4)

          while (size > MAX_FINAL_SIZE && quality > 0.3) {
            quality -= 0.1
            dataUrl = canvas.toDataURL("image/jpeg", quality)
            size = Math.round((dataUrl.length * 3) / 4)
          }
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

export default function ImageUpload({
  value,
  onChange,
  compact = false,
}: ImageUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [imageSize, setImageSize] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    async (file: File) => {
      setError(null)

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Formato invalido. Use JPG, PNG ou WEBP.")
        return
      }
      if (file.size > MAX_INITIAL_SIZE) {
        setError("Imagem muito grande. Maximo 1.5MB para processamento.")
        return
      }

      setIsProcessing(true)

      try {
        const { dataUrl, size } = await compressImage(file)

        if (size > MAX_FINAL_SIZE) {
          setError(`A imagem deve ter no maximo 300KB. Tamanho atual: ${Math.round(size / 1024)}KB`)
          setIsProcessing(false)
          return
        }

        setImageSize(size)
        onChange(dataUrl)
      } catch {
        setError("Erro ao processar imagem.")
      }

      setIsProcessing(false)
    },
    [onChange]
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
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ""
    },
    [processFile]
  )

  const handleRemove = useCallback(() => {
    onChange(null)
    setError(null)
  }, [onChange])

  // --- Compact mode: small thumbnail with change/remove ---
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {value ? (
          <div className="relative h-12 w-12 flex-shrink-0 rounded-lg overflow-hidden border border-border">
            <img
              src={value || "/placeholder.svg"}
              alt="Produto"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            <button
              onClick={handleRemove}
              className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-white shadow-sm"
              aria-label="Remover imagem"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 text-muted-foreground transition-colors hover:border-[hsl(var(--primary))]/40 hover:text-[hsl(var(--primary))]"
            aria-label="Adicionar imagem"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Selecionar imagem do produto"
        />
        {value && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:underline hover:text-[hsl(var(--primary))]"
          >
            Trocar
          </button>
        )}
      </div>
    )
  }

  // --- Full mode: drag & drop area ---
  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="relative">
          <div className="relative h-40 w-full overflow-hidden rounded-xl border border-border bg-muted/30">
            <img
              src={value || "/placeholder.svg"}
              alt="Preview do produto"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            {/* Size indicator overlay */}
            {imageSize > 0 && (
              <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1">
                <span className="text-[10px] font-medium text-white">
                  {Math.round(imageSize / 1024)}KB
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))]"
            >
              <Upload className="h-3.5 w-3.5" />
              Trocar imagem
            </button>
            <button
              onClick={handleRemove}
              className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
              Remover
            </button>
          </div>
        </div>
      ) : isProcessing ? (
        <div className="flex h-36 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5">
          <Loader2 className="h-8 w-8 text-[hsl(var(--primary))] animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Processando imagem...</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Otimizando para 300KB</p>
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
            "flex h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-all duration-200",
            isDragOver
              ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 scale-[1.01]"
              : "border-border bg-muted/20 hover:border-[hsl(var(--primary))]/40 hover:bg-muted/40"
          )}
        >
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
              isDragOver
                ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Upload className="h-5 w-5" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {isDragOver ? "Solte a imagem aqui" : "Arraste ou clique para enviar"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              JPG, PNG ou WEBP (max. 300KB)
            </p>
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Selecionar imagem do produto"
      />
      {error && (
        <p className="text-xs font-medium text-destructive">{error}</p>
      )}
    </div>
  )
}
