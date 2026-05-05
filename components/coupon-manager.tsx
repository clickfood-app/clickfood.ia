"use client"

import { useEffect, useMemo, useState } from "react"
import {
  createCoupon,
  deleteCoupon,
  getMyRestaurantId,
  listCoupons,
  updateCoupon,
  type CouponDbRow,
} from "@/lib/coupon-service"

type Coupon = CouponDbRow

type FormData = {
  code: string
  title: string
  description: string
  discount_type: "percentage" | "fixed"
  discount_value: string
  min_order_value: string
  max_discount_value: string
  usage_limit: string
  starts_at: string
  expires_at: string
  active: boolean
}

const initialForm: FormData = {
  code: "",
  title: "",
  description: "",
  discount_type: "percentage",
  discount_value: "",
  min_order_value: "",
  max_discount_value: "",
  usage_limit: "",
  starts_at: "",
  expires_at: "",
  active: true,
}

export default function CouponManager() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormData>(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  async function loadCoupons() {
    try {
      setLoading(true)
      setError(null)

      const restId = restaurantId ?? (await getMyRestaurantId())
      if (!restaurantId) setRestaurantId(restId)

      const data = await listCoupons()
      setCoupons(data)
    } catch (err: any) {
      setError(err.message || "Erro ao carregar cupons.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCoupons()
  }, [])

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
  }

  function handleChange<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const restId = restaurantId ?? (await getMyRestaurantId())
      if (!restaurantId) setRestaurantId(restId)

      const payload = {
        restaurant_id: restId,
        code: form.code.trim().toUpperCase(),
        title: form.title.trim() || null,
        description: form.description.trim() || null,
        coupon_type: "manual" as const,
        discount_type: form.discount_type,
        discount_value: form.discount_value ? Number(form.discount_value) : 0,
        min_order_value: form.min_order_value ? Number(form.min_order_value) : null,
        max_discount_value: form.max_discount_value ? Number(form.max_discount_value) : null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        starts_at: form.starts_at || null,
        expires_at: form.expires_at || null,
        active: form.active,
        max_per_client: 1,
        notify_clients: false,
        send_channels: [],
      }

      if (!payload.code) {
        throw new Error("Informe o código do cupom.")
      }

      if (!payload.discount_value || payload.discount_value <= 0) {
        throw new Error("Informe um valor de desconto válido.")
      }

      if (payload.discount_type === "percentage" && payload.discount_value > 100) {
        throw new Error("Desconto percentual não pode ser maior que 100.")
      }

      if (editingId) {
        await updateCoupon(editingId, payload)
        setSuccess("Cupom atualizado com sucesso.")
      } else {
        await createCoupon(payload)
        setSuccess("Cupom criado com sucesso.")
      }

      resetForm()
      await loadCoupons()
    } catch (err: any) {
      if (err?.message?.toLowerCase()?.includes("duplicate") || err?.message?.toLowerCase()?.includes("unique")) {
        setError("Já existe um cupom com esse código.")
      } else {
        setError(err.message || "Erro ao salvar cupom.")
      }
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(coupon: Coupon) {
    setEditingId(coupon.id)
    setForm({
      code: coupon.code ?? "",
      title: coupon.title ?? "",
      description: coupon.description ?? "",
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value ?? ""),
      min_order_value: coupon.min_order_value != null ? String(coupon.min_order_value) : "",
      max_discount_value: coupon.max_discount_value != null ? String(coupon.max_discount_value) : "",
      usage_limit: coupon.usage_limit != null ? String(coupon.usage_limit) : "",
      starts_at: coupon.starts_at ? coupon.starts_at.slice(0, 16) : "",
      expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 16) : "",
      active: coupon.active,
    })
    setSuccess(null)
    setError(null)
  }

  async function handleToggleActive(coupon: Coupon) {
    try {
      setError(null)
      setSuccess(null)

      await updateCoupon(coupon.id, { active: !coupon.active })

      setSuccess(`Cupom ${!coupon.active ? "ativado" : "desativado"} com sucesso.`)
      await loadCoupons()
    } catch (err: any) {
      setError(err.message || "Erro ao alterar status do cupom.")
    }
  }

  async function handleDelete(coupon: Coupon) {
    const confirmed = window.confirm("Tem certeza que deseja excluir este cupom?")
    if (!confirmed) return

    try {
      setError(null)
      setSuccess(null)

      await deleteCoupon(coupon.id)

      if (editingId === coupon.id) resetForm()

      setSuccess("Cupom excluído com sucesso.")
      await loadCoupons()
    } catch (err: any) {
      setError(err.message || "Erro ao excluir cupom.")
    }
  }

  const filteredCoupons = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return coupons

    return coupons.filter((coupon) => {
      return (
        (coupon.code || "").toLowerCase().includes(term) ||
        (coupon.title || "").toLowerCase().includes(term) ||
        (coupon.description || "").toLowerCase().includes(term)
      )
    })
  }, [coupons, search])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-gray-900">
            {editingId ? "Editar cupom" : "Criar cupom"}
          </h2>
          <p className="text-sm text-gray-500">
            Cadastre cupons de desconto para o seu restaurante.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Código</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
              placeholder="Ex: PROMO10"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Título</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="Ex: Cupom de boas-vindas"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-purple-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Descrição</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Ex: válido para primeira compra"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de desconto</label>
            <select
              value={form.discount_type}
              onChange={(e) => handleChange("discount_type", e.target.value as "percentage" | "fixed")}
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-purple-500"
            >
              <option value="percentage">Porcentagem (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Valor do desconto</label>
            <input
              type="number"
              step="0.01"
              value={form.discount_value}
              onChange={(e) => handleChange("discount_value", e.target.value)}
              placeholder={form.discount_type === "percentage" ? "10" : "5.00"}
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pedido mínimo (R$)</label>
            <input
              type="number"
              step="0.01"
              value={form.min_order_value}
              onChange={(e) => handleChange("min_order_value", e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Desconto máximo (R$)</label>
            <input
              type="number"
              step="0.01"
              value={form.max_discount_value}
              onChange={(e) => handleChange("max_discount_value", e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Limite de usos</label>
            <input
              type="number"
              value={form.usage_limit}
              onChange={(e) => handleChange("usage_limit", e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Início</label>
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => handleChange("starts_at", e.target.value)}
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Expira em</label>
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => handleChange("expires_at", e.target.value)}
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="active"
              type="checkbox"
              checked={form.active}
              onChange={(e) => handleChange("active", e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="active" className="text-sm font-medium text-gray-700">
              Cupom ativo
            </label>
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-700 disabled:opacity-60"
            >
              {saving ? "Salvando..." : editingId ? "Atualizar cupom" : "Criar cupom"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border px-5 py-3 font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Cupons cadastrados</h2>
            <p className="text-sm text-gray-500">
              Gerencie, edite, ative ou exclua seus cupons.
            </p>
          </div>

          <input
            type="text"
            placeholder="Buscar cupom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 outline-none focus:border-purple-500 md:w-72"
          />
        </div>

        {loading ? (
          <div className="py-8 text-sm text-gray-500">Carregando cupons...</div>
        ) : filteredCoupons.length === 0 ? (
          <div className="py-8 text-sm text-gray-500">Nenhum cupom encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-sm text-gray-500">
                  <th className="px-3">Código</th>
                  <th className="px-3">Desconto</th>
                  <th className="px-3">Usos</th>
                  <th className="px-3">Validade</th>
                  <th className="px-3">Status</th>
                  <th className="px-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredCoupons.map((coupon) => (
                  <tr key={coupon.id} className="rounded-2xl bg-gray-50">
                    <td className="px-3 py-4 font-semibold text-gray-900">
                      <div>{coupon.code}</div>
                      {coupon.title && (
                        <div className="mt-1 text-xs font-normal text-gray-500">{coupon.title}</div>
                      )}
                    </td>

                    <td className="px-3 py-4 text-sm text-gray-700">
                      {coupon.discount_type === "percentage"
                        ? `${coupon.discount_value}%`
                        : `R$ ${Number(coupon.discount_value).toFixed(2)}`}
                    </td>

                    <td className="px-3 py-4 text-sm text-gray-700">
                      {coupon.used_count}
                      {coupon.usage_limit ? ` / ${coupon.usage_limit}` : ""}
                    </td>

                    <td className="px-3 py-4 text-sm text-gray-700">
                      {coupon.expires_at
                        ? new Date(coupon.expires_at).toLocaleString("pt-BR")
                        : "Sem expiração"}
                    </td>

                    <td className="px-3 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          coupon.active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {coupon.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td className="px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleEdit(coupon)}
                          className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white"
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => handleToggleActive(coupon)}
                          className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white"
                        >
                          {coupon.active ? "Desativar" : "Ativar"}
                        </button>

                        <button
                          onClick={() => handleDelete(coupon)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}