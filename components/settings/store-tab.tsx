"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Building2, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { brazilStates } from "@/lib/settings-data"

type StoreData = {
  name: string
  cnpj: string
  phone: string
  whatsapp: string
  email: string
  address: string
  city: string
  state: string
  cep: string
}

const emptyStoreData: StoreData = {
  name: "",
  cnpj: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  city: "",
  state: "",
  cep: "",
}

interface RestaurantStoreRow {
  id: string
  owner_id: string
  name: string | null
  cnpj: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  cep: string | null
}

export default function StoreTab() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [data, setData] = useState<StoreData>(emptyStoreData)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof StoreData, string>>>({})

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

        const { data: restaurant, error: restaurantError } = await supabase
          .from("restaurants")
          .select("id, owner_id, name, cnpj, phone, whatsapp, email, address, city, state, cep")
          .eq("owner_id", user.id)
          .single()

        if (restaurantError) throw restaurantError
        if (!restaurant) throw new Error("Restaurante nao encontrado.")

        const row = restaurant as RestaurantStoreRow

        setRestaurantId(row.id)
        setData({
          name: row.name || "",
          cnpj: row.cnpj || "",
          phone: row.phone || "",
          whatsapp: row.whatsapp || "",
          email: row.email || "",
          address: row.address || "",
          city: row.city || "",
          state: row.state || "",
          cep: row.cep || "",
        })
      } catch (error) {
        console.error(error)
        toast.error("Nao foi possivel carregar os dados da loja.")
      } finally {
        setLoading(false)
      }
    }

    loadRestaurant()
  }, [supabase])

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

  function validate() {
    const errs: Partial<Record<keyof StoreData, string>> = {}

    if (!data.name.trim()) errs.name = "Nome obrigatorio"
    if (!data.cnpj.trim()) errs.cnpj = "CNPJ obrigatorio"
    if (!data.phone.trim()) errs.phone = "Telefone obrigatorio"
    if (!data.email.trim()) errs.email = "Email obrigatorio"

    if (data.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      errs.email = "Email invalido"
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!restaurantId) {
      toast.error("Restaurante nao encontrado.")
      return
    }

    if (!validate()) {
      toast.error("Corrija os campos obrigatorios.")
      return
    }

    try {
      setSaving(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error("Usuario nao autenticado.")

      const payload = {
        name: data.name.trim() || null,
        cnpj: data.cnpj.trim() || null,
        phone: data.phone.trim() || null,
        whatsapp: data.whatsapp.trim() || null,
        email: data.email.trim() || null,
        address: data.address.trim() || null,
        city: data.city.trim() || null,
        state: data.state.trim() || null,
        cep: data.cep.trim() || null,
      }

      const { error: updateError } = await supabase
        .from("restaurants")
        .update(payload)
        .eq("id", restaurantId)
        .eq("owner_id", user.id)

      if (updateError) throw updateError

      toast.success("Dados da loja salvos com sucesso!")
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar os dados da loja.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando dados da loja...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2">
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

          <Field label="Estado">
            <select
              value={data.state}
              onChange={(e) => update("state", e.target.value)}
              className="input-field"
            >
              <option value="">Selecione</option>
              {brazilStates.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
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

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Salvando..." : "Salvar Dados"}
        </button>
      </div>
    </div>
  )
}

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
      <label className="mb-2 block text-sm font-medium text-card-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}