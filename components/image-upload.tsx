"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface ImageUploadProps {
  value: string | null
  onChange: (value: string | null) => void
  maxSizeKb?: number
  className?: string
}

async function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<File> {
  const imageBitmap = await createImageBitmap(file)

  const scale = Math.min(1, maxWidth / imageBitmap.width)
  const width = Math.round(imageBitmap.width * scale)
  const height = Math.round(imageBitmap.height * scale)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Não foi possível processar a imagem.")
  }

  ctx.drawImage(imageBitmap, 0, 0, width, height)

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("Falha ao comprimir imagem."))
          return
        }
        resolve(result)
      },
      "image/jpeg",
      quality
    )
  })

  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
    type: "image/jpeg",
  })
}

export default function ImageUpload({
  value,
  onChange,
  maxSizeKb = 300,
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const supabase = createClient()

  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function uploadFile(originalFile: File) {
    try {
      setUploading(true)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError
      if (!session?.access_token) {
        throw new Error("Sessão inválida. Faça login novamente.")
      }

      let fileToUpload = originalFile

      if (originalFile.size > maxSizeKb * 1024) {
        fileToUpload = await compressImage(originalFile)
      }

      if (fileToUpload.size > maxSizeKb * 1024) {
        throw new Error(`A imagem deve ter no máximo ${maxSizeKb}KB.`)
      }

      const formData = new FormData()
      formData.append("file", fileToUpload)

      const response = await fetch("/api/admin/upload/product-image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Erro ao enviar imagem.")
      }

      onChange(result.imageUrl || null)
    } catch (error) {
      console.error("Erro no upload da imagem:", error)
      alert(error instanceof Error ? error.message : "Erro ao enviar imagem.")
    } finally {
      setUploading(false)
    }
  }

  async function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Formato inválido. Use JPG, PNG ou WEBP.")
      return
    }

    await uploadFile(file)
  }

  return (
    <div className={cn("space-y-3", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.currentTarget.value = ""
        }}
      />

      {value ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={value}
                alt="Imagem do produto"
                fill
                className="object-cover"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Trocar imagem
            </button>

            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={async (e) => {
            e.preventDefault()
            setDragging(false)
            await handleFiles(e.dataTransfer.files)
          }}
          disabled={uploading}
          className={cn(
            "flex w-full flex-col items-center justify-center rounded-xl border border-dashed px-4 py-10 text-center transition-colors",
            dragging
              ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5"
              : "border-border bg-card hover:bg-muted/50",
            uploading && "opacity-60"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Enviando imagem...</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Aguarde um instante
              </p>
            </>
          ) : (
            <>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Clique ou arraste uma imagem
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG ou WEBP • até {maxSizeKb}KB
              </p>
            </>
          )}
        </button>
      )}
    </div>
  )
}