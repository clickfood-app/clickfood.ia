"use client"

import { useState, useRef, useCallback } from "react"
import {
  Building2,
  Camera,
  ImageIcon,
  Loader2,
  Save,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { type StoreData, defaultStoreData, brazilStates } from "@/lib/settings-data"
import CoverImageUpload from "./cover-image-upload"

export default function StoreTab() {
  const [data, setData] = useState<StoreData>(defaultStoreData)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof StoreData, string>>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_SIZE_KB = 300

  const update = useCallback(
    <K extends keyof StoreData>(key: K, value: StoreData[K]) => {
      setData((prev) => ({ ...prev, [key]: value }))
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    []
  )

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowed = ["image/jpeg", "image/png", "image/webp"]
    if (!allowed.includes(file.type)) {
      toast.error("Formato invalido. Aceitos: JPG, PNG ou WebP.")
      return
    }

    if (file.size > MAX_SIZE_KB * 1024) {
      toast.error(`Imagem excede ${MAX_SIZE_KB}KB. Comprima antes de enviar.`)
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setLogoPreview(reader.result as string)
      update("logoUrl", reader.result as string)
      toast.success("Logo carregada com sucesso!")
    }
    reader.readAsDataURL(file)
  }

  function removeLogo() {
    setLogoPreview(null)
    update("logoUrl", "")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof StoreData, string>> = {}
    if (!data.name.trim()) errs.name = "Nome obrigatorio"
    if (!data.cnpj.trim()) errs.cnpj = "CNPJ obrigatorio"
    if (!data.phone.trim()) errs.phone = "Telefone obrigatorio"
    if (!data.email.trim()) errs.email = "Email obrigatorio"
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errs.email = "Email invalido"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate()) {
      toast.error("Corrija os campos obrigatorios.")
      return
    }
    setSaving(true)
    await new Promise((r) => setTimeout(r, 1200))
    setSaving(false)
    toast.success("Dados da loja salvos com sucesso!")
  }

  return (
    <div className="space-y-8">
      {/* Cover Image Upload */}
      <CoverImageUpload />

      {/* Logo Upload */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Camera className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h3 className="text-base font-bold text-card-foreground">Logo da Loja</h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted/50">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo da loja"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            {logoPreview && (
              <button
                onClick={removeLogo}
                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90"
                aria-label="Remover logo"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90"
            >
              Escolher Imagem
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              JPG, PNG ou WebP. Maximo {MAX_SIZE_KB}KB.
            </p>
          </div>
        </div>
      </div>

      {/* Store Info */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Building2 className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h3 className="text-base font-bold text-card-foreground">Informacoes da Loja</h3>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Nome da Loja" required error={errors.name}>
            <input
              type="text"
              value={data.name}
              onChange={(e) => update("name", e.target.value)}
              className={cn("input-field", errors.name && "border-destructive")}
              placeholder="Ex: Meu Restaurante"
            />
          </Field>
          <Field label="CNPJ" required error={errors.cnpj}>
            <input
              type="text"
              value={data.cnpj}
              onChange={(e) => update("cnpj", e.target.value)}
              className={cn("input-field", errors.cnpj && "border-destructive")}
              placeholder="00.000.000/0000-00"
            />
          </Field>
          <Field label="Telefone" required error={errors.phone}>
            <input
              type="text"
              value={data.phone}
              onChange={(e) => update("phone", e.target.value)}
              className={cn("input-field", errors.phone && "border-destructive")}
              placeholder="(00) 0000-0000"
            />
          </Field>
          <Field label="WhatsApp">
            <input
              type="text"
              value={data.whatsapp}
              onChange={(e) => update("whatsapp", e.target.value)}
              className="input-field"
              placeholder="(00) 00000-0000"
            />
          </Field>
          <Field label="Email" required error={errors.email} className="md:col-span-2">
            <input
              type="email"
              value={data.email}
              onChange={(e) => update("email", e.target.value)}
              className={cn("input-field", errors.email && "border-destructive")}
              placeholder="email@exemplo.com"
            />
          </Field>
          <Field label="Endereco" className="md:col-span-2">
            <input
              type="text"
              value={data.address}
              onChange={(e) => update("address", e.target.value)}
              className="input-field"
              placeholder="Rua, numero - Bairro"
            />
          </Field>
          <Field label="Cidade">
            <input
              type="text"
              value={data.city}
              onChange={(e) => update("city", e.target.value)}
              className="input-field"
              placeholder="Cidade"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Estado">
              <select
                value={data.state}
                onChange={(e) => update("state", e.target.value)}
                className="input-field"
              >
                <option value="">UF</option>
                {brazilStates.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </Field>
            <Field label="CEP">
              <input
                type="text"
                value={data.cep}
                onChange={(e) => update("cep", e.target.value)}
                className="input-field"
                placeholder="00000-000"
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Salvando..." : "Salvar Alteracoes"}
        </button>
      </div>
    </div>
  )
}

// ── Reusable Field ──

function Field({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
