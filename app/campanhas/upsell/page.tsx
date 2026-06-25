"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  ChevronDown,
  Edit3,
  Lightbulb,
  Loader2,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import AdminLayout from "@/components/admin-layout"

type Product = Record<string, any>
type Category = Record<string, any>

type TriggerType = "product" | "category" | "cart_total"
type DiscountType = "none" | "fixed" | "percentage" | "special_price" | "free_item"

type UpsellRule = {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  trigger_type: TriggerType
  trigger_product_id: string | null
  trigger_category_id: string | null
  minimum_cart_total: number
  offered_product_id: string | null
  offered_title: string | null
  offered_description: string | null
  discount_type: DiscountType
  discount_value: number
  special_price: number | null
  priority: number
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

type UpsellForm = {
  name: string
  description: string
  trigger_type: TriggerType
  trigger_product_id: string
  trigger_category_id: string
  minimum_cart_total: string
  offered_product_id: string
  offered_title: string
  offered_description: string
  discount_type: DiscountType
  discount_value: string
  special_price: string
  priority: string
  is_active: boolean
  starts_at: string
  ends_at: string
}

const emptyForm: UpsellForm = {
  name: "",
  description: "",
  trigger_type: "product",
  trigger_product_id: "",
  trigger_category_id: "",
  minimum_cart_total: "0",
  offered_product_id: "",
  offered_title: "",
  offered_description: "",
  discount_type: "none",
  discount_value: "0",
  special_price: "",
  priority: "0",
  is_active: true,
  starts_at: "",
  ends_at: "",
}

function parseNumber(value: string | number | null | undefined) {
  const normalized = String(value ?? "").replace(",", ".")
  const number = Number(normalized)

  return Number.isFinite(number) ? number : 0
}

function onlyFilled(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0)
}

function formatDateTime(value: string | null) {
  if (!value) return "Sem limite"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ""

  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)

  return local.toISOString().slice(0, 16)
}

function toIsoOrNull(value: string) {
  if (!value) return null

  return new Date(value).toISOString()
}

function getProductName(product?: Product) {
  if (!product) return "Produto não encontrado"

  return product.name || product.title || product.product_name || "Produto sem nome"
}

function getProductPrice(product?: Product) {
  if (!product) return 0

  return Number(
    product.price ||
      product.sale_price ||
      product.selling_price ||
      product.final_price ||
      0,
  )
}

function getProductDescription(product?: Product) {
  if (!product) return ""

  return (
    product.description ||
    product.short_description ||
    product.details ||
    product.observation ||
    ""
  )
}

function getCategoryName(category?: Category) {
  if (!category) return "Categoria não encontrada"

  return category.name || category.title || "Categoria sem nome"
}

function getTriggerLabel(rule: UpsellRule, productsById: Map<string, Product>, categoriesById: Map<string, Category>) {
  if (rule.trigger_type === "cart_total") {
    return `Carrinho acima de ${formatCurrency(Number(rule.minimum_cart_total || 0))}`
  }

  if (rule.trigger_type === "category") {
    return `Categoria: ${getCategoryName(categoriesById.get(rule.trigger_category_id || ""))}`
  }

  return `Produto: ${getProductName(productsById.get(rule.trigger_product_id || ""))}`
}

function getDiscountLabel(rule: UpsellRule) {
  if (rule.discount_type === "none") return "Sem desconto"
  if (rule.discount_type === "fixed") return `${formatCurrency(Number(rule.discount_value || 0))} off`
  if (rule.discount_type === "percentage") return `${Number(rule.discount_value || 0)}% off`
  if (rule.discount_type === "special_price") return `Preço especial: ${formatCurrency(Number(rule.special_price || 0))}`
  if (rule.discount_type === "free_item") return "Item grátis"

  return "Sem desconto"
}

export default function UpsellPage() {
  const supabase = useMemo(() => createClient(), [])

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<UpsellRule[]>([])

  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<UpsellRule | null>(null)
  const [form, setForm] = useState<UpsellForm>(emptyForm)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  async function loadPageData() {
    setLoading(true)
    setError(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError("Não foi possível identificar o usuário logado.")
      setLoading(false)
      return
    }

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError || !restaurant) {
      setError("Não foi possível encontrar o restaurante vinculado a este usuário.")
      setLoading(false)
      return
    }

    setRestaurantId(restaurant.id)

    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })

    if (productsError) {
      setError("Erro ao carregar produtos.")
      setLoading(false)
      return
    }

    const { data: categoriesData, error: categoriesError } = await supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order", { ascending: true })

    if (categoriesError) {
      setError("Erro ao carregar categorias.")
      setLoading(false)
      return
    }

    const { data: rulesData, error: rulesError } = await supabase
      .from("upsell_rules")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })

    if (rulesError) {
      setError("Erro ao carregar regras de upsell.")
      setLoading(false)
      return
    }

    setProducts((productsData || []) as Product[])
    setCategories((categoriesData || []) as Category[])
    setRules((rulesData || []) as UpsellRule[])
    setLoading(false)
  }

  useEffect(() => {
    void loadPageData()
  }, [])

  const productsById = useMemo(() => {
    const map = new Map<string, Product>()

    for (const product of products) {
      map.set(product.id, product)
    }

    return map
  }, [products])

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>()

    for (const category of categories) {
      map.set(category.id, category)
    }

    return map
  }, [categories])

  const filteredRules = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return rules

    return rules.filter((rule) => {
      return [
        rule.name,
        rule.description,
        rule.offered_title,
        rule.offered_description,
        getTriggerLabel(rule, productsById, categoriesById),
        getDiscountLabel(rule),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [rules, search, productsById, categoriesById])

  const totals = useMemo(() => {
    const activeRules = rules.filter((rule) => rule.is_active)
    const productRules = rules.filter((rule) => rule.trigger_type === "product")
    const categoryRules = rules.filter((rule) => rule.trigger_type === "category")
    const cartRules = rules.filter((rule) => rule.trigger_type === "cart_total")

    return {
      total: rules.length,
      active: activeRules.length,
      productRules: productRules.length,
      categoryRules: categoryRules.length,
      cartRules: cartRules.length,
    }
  }, [rules])

  function openCreateModal() {
    setEditingRule(null)
    setForm(emptyForm)
    setAdvancedOpen(false)
    setIsModalOpen(true)
    setError(null)
  }

  function openEditModal(rule: UpsellRule) {
    setEditingRule(rule)
    setForm({
      name: rule.name || "",
      description: rule.description || "",
      trigger_type: rule.trigger_type,
      trigger_product_id: rule.trigger_product_id || "",
      trigger_category_id: rule.trigger_category_id || "",
      minimum_cart_total: String(rule.minimum_cart_total ?? 0),
      offered_product_id: rule.offered_product_id || "",
      offered_title: rule.offered_title || "",
      offered_description: rule.offered_description || "",
      discount_type: rule.discount_type,
      discount_value: String(rule.discount_value ?? 0),
      special_price: rule.special_price !== null && rule.special_price !== undefined ? String(rule.special_price) : "",
      priority: String(rule.priority ?? 0),
      is_active: rule.is_active,
      starts_at: toDateTimeLocal(rule.starts_at),
      ends_at: toDateTimeLocal(rule.ends_at),
    })
    setAdvancedOpen(false)
    setIsModalOpen(true)
    setError(null)
  }

  function closeModal() {
    if (saving) return

    setIsModalOpen(false)
    setEditingRule(null)
    setForm(emptyForm)
    setAdvancedOpen(false)
  }

  function getFormTriggerSummary() {
    if (form.trigger_type === "cart_total") {
      const value = parseNumber(form.minimum_cart_total)
      return value > 0 ? `carrinho acima de ${formatCurrency(value)}` : "valor mínimo no carrinho"
    }

    if (form.trigger_type === "category") {
      const category = categoriesById.get(form.trigger_category_id)
      return form.trigger_category_id ? getCategoryName(category) : "categoria escolhida"
    }

    const product = productsById.get(form.trigger_product_id)
    return form.trigger_product_id ? getProductName(product) : "produto escolhido"
  }

  function getFormOfferSummary() {
    const product = productsById.get(form.offered_product_id)
    const title = form.offered_title.trim()

    if (title) return title
    if (form.offered_product_id) return getProductName(product)

    return "produto sugerido"
  }

  function getFormConditionSummary() {
    if (form.discount_type === "fixed") {
      return `${formatCurrency(parseNumber(form.discount_value))} de desconto`
    }

    if (form.discount_type === "percentage") {
      return `${parseNumber(form.discount_value)}% de desconto`
    }

    if (form.discount_type === "special_price") {
      const value = parseNumber(form.special_price)
      return value > 0 ? `por ${formatCurrency(value)}` : "com preço especial"
    }

    if (form.discount_type === "free_item") {
      return "como item grátis"
    }

    return "sem desconto"
  }

  function applyQuickTemplate(template: "product" | "category" | "cart_total") {
    setForm((current) => {
      if (template === "cart_total") {
        return {
          ...current,
          trigger_type: "cart_total",
          trigger_product_id: "",
          trigger_category_id: "",
          minimum_cart_total: "50",
          discount_type: "special_price",
        }
      }

      if (template === "category") {
        return {
          ...current,
          trigger_type: "category",
          trigger_product_id: "",
          minimum_cart_total: "0",
          discount_type: "none",
        }
      }

      return {
        ...current,
        trigger_type: "product",
        trigger_category_id: "",
        minimum_cart_total: "0",
        discount_type: "special_price",
      }
    })
  }

  async function handleSaveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!restaurantId) {
      setError("Restaurante não encontrado.")
      return
    }

    if (form.trigger_type === "product" && !form.trigger_product_id) {
      setError("Selecione o produto que ativa o upsell.")
      return
    }

    if (form.trigger_type === "category" && !form.trigger_category_id) {
      setError("Selecione a categoria que ativa o upsell.")
      return
    }

    if (form.trigger_type === "cart_total" && parseNumber(form.minimum_cart_total) <= 0) {
      setError("Informe o valor mínimo do carrinho.")
      return
    }

    if (!form.offered_product_id && !form.offered_title.trim()) {
      setError("Selecione um produto ofertado ou informe um título para a oferta.")
      return
    }

    setSaving(true)
    setError(null)

    const selectedOfferedProduct = form.offered_product_id
      ? productsById.get(form.offered_product_id)
      : null

    const ruleName =
      form.name.trim() ||
      `Upsell: ${getFormTriggerSummary()} → ${getFormOfferSummary()}`

    const payload = {
      restaurant_id: restaurantId,
      name: ruleName,
      description: onlyFilled(form.description),
      trigger_type: form.trigger_type,
      trigger_product_id:
        form.trigger_type === "product" ? form.trigger_product_id || null : null,
      trigger_category_id:
        form.trigger_type === "category" ? form.trigger_category_id || null : null,
      minimum_cart_total:
        form.trigger_type === "cart_total"
          ? parseNumber(form.minimum_cart_total)
          : 0,
      offered_product_id: form.offered_product_id || null,
      offered_title:
        onlyFilled(form.offered_title) ||
        (selectedOfferedProduct ? getProductName(selectedOfferedProduct) : null),
      offered_description: onlyFilled(form.offered_description),
      discount_type: form.discount_type,
      discount_value:
        form.discount_type === "fixed" || form.discount_type === "percentage"
          ? parseNumber(form.discount_value)
          : 0,
      special_price:
        form.discount_type === "special_price"
          ? parseNumber(form.special_price)
          : null,
      priority: Math.trunc(parseNumber(form.priority)),
      is_active: form.is_active,
      starts_at: toIsoOrNull(form.starts_at),
      ends_at: toIsoOrNull(form.ends_at),
    }

    if (editingRule) {
      const { data, error: updateError } = await supabase
        .from("upsell_rules")
        .update(payload)
        .eq("id", editingRule.id)
        .eq("restaurant_id", restaurantId)
        .select("*")
        .single()

      if (updateError || !data) {
        setError("Erro ao atualizar regra de upsell.")
        setSaving(false)
        return
      }

      setRules((current) =>
        current.map((rule) => (rule.id === editingRule.id ? (data as UpsellRule) : rule)),
      )
    } else {
      const { data, error: insertError } = await supabase
        .from("upsell_rules")
        .insert(payload)
        .select("*")
        .single()

      if (insertError || !data) {
        setError("Erro ao criar regra de upsell.")
        setSaving(false)
        return
      }

      setRules((current) => [data as UpsellRule, ...current])
    }

    setSaving(false)
    closeModal()
  }

  async function toggleRule(rule: UpsellRule) {
    if (!restaurantId) return

    const { data, error: updateError } = await supabase
      .from("upsell_rules")
      .update({
        is_active: !rule.is_active,
      })
      .eq("id", rule.id)
      .eq("restaurant_id", restaurantId)
      .select("*")
      .single()

    if (updateError || !data) {
      setError("Erro ao alterar status da regra.")
      return
    }

    setRules((current) =>
      current.map((item) => (item.id === rule.id ? (data as UpsellRule) : item)),
    )
  }

  async function deleteRule(rule: UpsellRule) {
    if (!restaurantId) return

    const { error: deleteError } = await supabase
      .from("upsell_rules")
      .delete()
      .eq("id", rule.id)
      .eq("restaurant_id", restaurantId)

    if (deleteError) {
      setError("Erro ao remover regra de upsell.")
      return
    }

    setRules((current) => current.filter((item) => item.id !== rule.id))
  }

  const selectedOfferedProduct = form.offered_product_id
    ? productsById.get(form.offered_product_id)
    : undefined
  const selectedOfferTitle = getFormOfferSummary()
  const selectedOfferDescription =
    form.offered_description.trim() ||
    getProductDescription(selectedOfferedProduct) ||
    `Combina com ${getFormTriggerSummary()}.`
  const selectedConditionLabel = getFormConditionSummary()
  const suggestedPrice =
    form.discount_type === "special_price"
      ? parseNumber(form.special_price)
      : getProductPrice(selectedOfferedProduct)

  return (
  <AdminLayout>
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-400">
            Campanhas / Upsell
          </p>

          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
            Upsell inteligente
          </h1>

          <p className="mt-1 max-w-2xl text-sm font-semibold text-zinc-500">
            Crie ofertas automáticas baseadas no que o cliente colocou no carrinho.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-none bg-yellow-400 px-4 py-3 text-sm font-black text-black shadow-lg shadow-yellow-400/20 transition hover:bg-yellow-300"
        >
          <Plus className="h-4 w-4" />
          Nova regra
        </button>
      </div> 

        <div className="grid gap-4 md:grid-cols-5">
          <div className="rounded-none border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
            <p className="text-sm font-bold text-zinc-500">Total</p>
            <p className="mt-3 text-3xl font-black text-white">{totals.total}</p>
            <p className="mt-1 text-xs font-semibold text-zinc-500">regras criadas</p>
          </div>

          <div className="rounded-none border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
            <p className="text-sm font-bold text-zinc-500">Ativas</p>
            <p className="mt-3 text-3xl font-black text-emerald-400">{totals.active}</p>
            <p className="mt-1 text-xs font-semibold text-zinc-500">em funcionamento</p>
          </div>

          <div className="rounded-none border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
            <p className="text-sm font-bold text-zinc-500">Por produto</p>
            <p className="mt-3 text-3xl font-black text-white">{totals.productRules}</p>
            <p className="mt-1 text-xs font-semibold text-zinc-500">gatilho produto</p>
          </div>

          <div className="rounded-none border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
            <p className="text-sm font-bold text-zinc-500">Por categoria</p>
            <p className="mt-3 text-3xl font-black text-white">{totals.categoryRules}</p>
            <p className="mt-1 text-xs font-semibold text-zinc-500">gatilho categoria</p>
          </div>

          <div className="rounded-none border border-white/10 bg-[#0A0A0A] p-5 shadow-sm">
            <p className="text-sm font-bold text-zinc-500">Por valor</p>
            <p className="mt-3 text-3xl font-black text-white">{totals.cartRules}</p>
            <p className="mt-1 text-xs font-semibold text-zinc-500">gatilho carrinho</p>
          </div>
        </div>

        <div className="rounded-none border border-white/10 bg-[#0A0A0A] shadow-sm">
          <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-white">
                Regras de upsell
              </h2>
              <p className="text-sm font-medium text-zinc-500">
                Configure ofertas para aparecerem no carrinho público.
              </p>
            </div>

            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar regra..."
                className="h-11 w-full rounded-none border border-white/10 bg-[#111111] pl-10 pr-4 text-sm font-semibold outline-none transition placeholder:text-zinc-500 focus:border-yellow-400/30 focus:bg-[#0A0A0A] focus:ring-4 focus:ring-yellow-400/20"
              />
            </div>
          </div>

          {error && (
            <div className="mx-4 mt-4 rounded-none border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm font-bold text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando upsells...
              </div>
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-none bg-[#111111] text-zinc-500">
                <ShoppingCart className="h-7 w-7" />
              </div>

              <h3 className="mt-4 text-lg font-black text-white">
                Nenhuma regra de upsell criada
              </h3>

              <p className="mt-2 max-w-md text-sm font-medium text-zinc-500">
                Crie uma regra para sugerir complemento quando o cliente adicionar um produto, categoria ou atingir valor mínimo.
              </p>

              <button
                type="button"
                onClick={openCreateModal}
                className="mt-5 inline-flex items-center gap-2 rounded-none bg-yellow-400 px-4 py-3 text-sm font-black text-black shadow-lg shadow-yellow-400/20 transition hover:bg-yellow-300"
              >
                <Plus className="h-4 w-4" />
                Criar regra
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left">
                <thead>
                  <tr className="border-b border-white/10 bg-[#111111] text-xs font-black uppercase tracking-wide text-zinc-500">
                    <th className="px-5 py-4">Regra</th>
                    <th className="px-5 py-4">Gatilho</th>
                    <th className="px-5 py-4">Oferta</th>
                    <th className="px-5 py-4">Desconto</th>
                    <th className="px-5 py-4">Validade</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {filteredRules.map((rule) => (
                    <tr key={rule.id} className="transition hover:bg-[#111111]">
                      <td className="px-5 py-4">
                        <p className="font-black text-white">{rule.name}</p>
                        {rule.description && (
                          <p className="mt-1 max-w-xs text-xs font-semibold text-zinc-500">
                            {rule.description}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-none bg-yellow-400/10 px-3 py-1 text-xs font-black text-yellow-400">
                          {getTriggerLabel(rule, productsById, categoriesById)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-bold text-zinc-500">
                          {rule.offered_title ||
                            getProductName(productsById.get(rule.offered_product_id || ""))}
                        </p>
                        {rule.offered_description && (
                          <p className="mt-1 max-w-xs text-xs font-semibold text-zinc-500">
                            {rule.offered_description}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-none bg-yellow-400/10 px-3 py-1 text-xs font-black text-yellow-400">
                          {getDiscountLabel(rule)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-xs font-semibold text-zinc-500">
                        <p>Início: {formatDateTime(rule.starts_at)}</p>
                        <p className="mt-1">Fim: {formatDateTime(rule.ends_at)}</p>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={
                            rule.is_active
                              ? "inline-flex rounded-none bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-400"
                              : "inline-flex rounded-none bg-[#111111] px-3 py-1 text-xs font-black text-zinc-500"
                          }
                        >
                          {rule.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(rule)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-none border border-white/10 bg-[#0A0A0A] text-zinc-500 transition hover:bg-yellow-400/10 hover:text-yellow-400"
                            title="Editar"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleRule(rule)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-none border border-white/10 bg-[#0A0A0A] text-zinc-500 transition hover:bg-yellow-400/10 hover:text-yellow-400"
                            title={rule.is_active ? "Desativar" : "Ativar"}
                          >
                            {rule.is_active ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteRule(rule)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-none border border-white/10 bg-[#0A0A0A] text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
                            title="Remover"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505] px-3 py-4 backdrop-blur-sm sm:px-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-none border border-white/10 bg-[#0A0A0A] shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-400">
                  Upsell
                </p>
                <h2 className="mt-1 text-xl font-black text-white">
                  {editingRule ? "Editar regra de upsell" : "Nova regra de upsell"}
                </h2>
                <p className="mt-1 max-w-2xl text-sm font-semibold text-zinc-500">
                  Crie uma sugestão rápida: cliente escolhe um item, o sistema oferece outro no carrinho.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none bg-[#111111] text-zinc-500 transition hover:bg-[#111111] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="flex max-h-[calc(92vh-82px)] flex-col">
              <div className="overflow-y-auto px-5 py-4">
                <div className="border border-yellow-400/30 bg-yellow-400/10 p-3">
                  <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
                    <div className="border border-yellow-400/30 bg-[#0A0A0A] px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Quando
                      </p>
                      <p className="mt-1 truncate text-sm font-black text-white">
                        {getFormTriggerSummary()}
                      </p>
                    </div>

                    <ArrowRight className="hidden h-4 w-4 text-zinc-4000 md:block" />

                    <div className="border border-yellow-400/30 bg-[#0A0A0A] px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Oferecer
                      </p>
                      <p className="mt-1 truncate text-sm font-black text-white">
                        {selectedOfferTitle}
                      </p>
                    </div>

                    <ArrowRight className="hidden h-4 w-4 text-zinc-4000 md:block" />

                    <div className="border border-yellow-400/30 bg-[#0A0A0A] px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Condição
                      </p>
                      <p className="mt-1 truncate text-sm font-black text-white">
                        {selectedConditionLabel}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyQuickTemplate("product")}
                    className="border border-white/10 bg-[#0A0A0A] px-3 py-2 text-xs font-black text-zinc-500 transition hover:border-yellow-400/30 hover:bg-yellow-400/10 hover:text-yellow-400"
                  >
                    Produto + complemento
                  </button>

                  <button
                    type="button"
                    onClick={() => applyQuickTemplate("category")}
                    className="border border-white/10 bg-[#0A0A0A] px-3 py-2 text-xs font-black text-zinc-500 transition hover:border-yellow-400/30 hover:bg-yellow-400/10 hover:text-yellow-400"
                  >
                    Categoria + oferta
                  </button>

                  <button
                    type="button"
                    onClick={() => applyQuickTemplate("cart_total")}
                    className="border border-white/10 bg-[#0A0A0A] px-3 py-2 text-xs font-black text-zinc-500 transition hover:border-emerald-400/30 hover:bg-emerald-500/15 hover:text-emerald-400"
                  >
                    Pedido mínimo
                  </button>
                </div>

                <div className="mt-4 border border-white/10 bg-[#0A0A0A]">
                  <div className="border-b border-white/10 bg-[#111111] px-4 py-3">
                    <h3 className="text-sm font-black text-white">
                      Montar regra
                    </h3>
                    <p className="mt-0.5 text-xs font-semibold text-zinc-500">
                      Selecione o gatilho, o produto sugerido e a condição comercial.
                    </p>
                  </div>

                  <div className="divide-y divide-white/10">
                    <div className="grid gap-3 p-4 lg:grid-cols-[180px_1fr] lg:items-end">
                      <div>
                        <p className="text-sm font-black text-white">
                          1. Quando mostrar
                        </p>
                        <p className="mt-1 text-xs font-semibold text-zinc-500">
                          O que o cliente precisa fazer.
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                        <label>
                          <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
                            Tipo
                          </span>

                          <select
                            value={form.trigger_type}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                trigger_type: event.target.value as TriggerType,
                                trigger_product_id: "",
                                trigger_category_id: "",
                                minimum_cart_total: "0",
                              }))
                            }
                            className="mt-1 h-11 w-full rounded-none border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                          >
                            <option value="product">Produto específico</option>
                            <option value="category">Categoria</option>
                            <option value="cart_total">Valor mínimo</option>
                          </select>
                        </label>

                        {form.trigger_type === "product" && (
                          <label>
                            <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
                              Produto gatilho *
                            </span>

                            <select
                              value={form.trigger_product_id}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  trigger_product_id: event.target.value,
                                }))
                              }
                              className="mt-1 h-11 w-full rounded-none border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                            >
                              <option value="">Selecione o produto</option>
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {getProductName(product)}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}

                        {form.trigger_type === "category" && (
                          <label>
                            <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
                              Categoria gatilho *
                            </span>

                            <select
                              value={form.trigger_category_id}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  trigger_category_id: event.target.value,
                                }))
                              }
                              className="mt-1 h-11 w-full rounded-none border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                            >
                              <option value="">Selecione a categoria</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {getCategoryName(category)}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}

                        {form.trigger_type === "cart_total" && (
                          <label>
                            <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
                              Valor mínimo *
                            </span>

                            <input
                              value={form.minimum_cart_total}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  minimum_cart_total: event.target.value,
                                }))
                              }
                              placeholder="Ex: 50"
                              className="mt-1 h-11 w-full rounded-none border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3 p-4 lg:grid-cols-[180px_1fr] lg:items-start">
                      <div>
                        <p className="text-sm font-black text-white">
                          2. O que oferecer
                        </p>
                        <p className="mt-1 text-xs font-semibold text-zinc-500">
                          Produto que vai aparecer no carrinho.
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <label>
                          <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
                            Produto do upsell
                          </span>

                          <select
                            value={form.offered_product_id}
                            onChange={(event) => {
                              const product = productsById.get(event.target.value)

                              setForm((current) => ({
                                ...current,
                                offered_product_id: event.target.value,
                                offered_title: product ? getProductName(product) : current.offered_title,
                                offered_description:
                                  product && !current.offered_description
                                    ? getProductDescription(product)
                                    : current.offered_description,
                                special_price:
                                  product &&
                                  current.discount_type === "special_price" &&
                                  !current.special_price
                                    ? String(getProductPrice(product))
                                    : current.special_price,
                              }))
                            }}
                            className="mt-1 h-11 w-full rounded-none border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                          >
                            <option value="">Oferta manual</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {getProductName(product)}
                                {getProductPrice(product) > 0
                                  ? ` — ${formatCurrency(getProductPrice(product))}`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
                            Título da oferta *
                          </span>

                          <input
                            value={form.offered_title}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                offered_title: event.target.value,
                              }))
                            }
                            placeholder="Ex: Adicione uma Coca 2L"
                            className="mt-1 h-11 w-full rounded-none border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                          />
                        </label>

                        <label className="md:col-span-2">
                          <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
                            Descrição curta
                          </span>

                          <input
                            value={form.offered_description}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                offered_description: event.target.value,
                              }))
                            }
                            placeholder="Ex: Combina muito com esse pedido"
                            className="mt-1 h-11 w-full rounded-none border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="grid gap-3 p-4 lg:grid-cols-[180px_1fr] lg:items-start">
                      <div>
                        <p className="text-sm font-black text-white">
                          3. Condição
                        </p>
                        <p className="mt-1 text-xs font-semibold text-zinc-500">
                          Preço, desconto e status.
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <label>
                          <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
                            Oferta
                          </span>

                          <select
                            value={form.discount_type}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                discount_type: event.target.value as DiscountType,
                              }))
                            }
                            className="mt-1 h-11 w-full rounded-none border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                          >
                            <option value="none">Sem desconto</option>
                            <option value="special_price">Preço especial</option>
                            <option value="fixed">Desconto em R$</option>
                            <option value="percentage">Desconto em %</option>
                            <option value="free_item">Item grátis</option>
                          </select>
                        </label>

                        {(form.discount_type === "fixed" ||
                          form.discount_type === "percentage") && (
                          <label>
                            <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
                              Valor
                            </span>

                            <input
                              value={form.discount_value}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  discount_value: event.target.value,
                                }))
                              }
                              placeholder="Ex: 5 ou 10"
                              className="mt-1 h-11 w-full rounded-none border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                            />
                          </label>
                        )}

                        {form.discount_type === "special_price" && (
                          <label>
                            <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
                              Preço especial
                            </span>

                            <input
                              value={form.special_price}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  special_price: event.target.value,
                                }))
                              }
                              placeholder="Ex: 9,90"
                              className="mt-1 h-11 w-full rounded-none border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                            />
                          </label>
                        )}

                        <label className="flex h-11 items-center gap-3 border border-white/10 bg-[#0A0A0A] px-3 md:mt-5">
                          <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                is_active: event.target.checked,
                              }))
                            }
                            className="h-4 w-4 rounded-none border-white/10"
                          />

                          <span className="text-sm font-black text-zinc-500">
                            Regra ativa
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="border border-yellow-400/30 bg-yellow-400/10 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
                      <div>
                        <p className="text-sm font-black text-white">
                          Preview no carrinho
                        </p>
                        <p className="mt-1 text-sm font-semibold text-zinc-500">
                          {selectedOfferTitle} · {selectedConditionLabel}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-zinc-500">
                          {selectedOfferDescription}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-black text-yellow-400">
                    {getFormTriggerSummary()} → {selectedOfferTitle}
                  </div>
                </div>

                <div className="mt-4 border border-white/10 bg-[#0A0A0A]">
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((current) => !current)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-[#111111]"
                  >
                    <div>
                      <p className="text-sm font-black text-white">Opções avançadas</p>
                      <p className="text-xs font-semibold text-zinc-500">
                        Nome interno, prioridade e período de exibição.
                      </p>
                    </div>
                    <ChevronDown
                      className={
                        advancedOpen
                          ? "h-5 w-5 rotate-180 text-zinc-500 transition"
                          : "h-5 w-5 text-zinc-500 transition"
                      }
                    />
                  </button>

                  {advancedOpen && (
                    <div className="grid gap-3 border-t border-white/10 bg-[#111111] p-4 md:grid-cols-2">
                      <label className="md:col-span-2">
                        <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
                          Nome interno da regra
                        </span>

                        <input
                          value={form.name}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, name: event.target.value }))
                          }
                          placeholder={`Ex: Upsell ${selectedOfferTitle}`}
                          className="mt-1 h-11 w-full rounded-none border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                        />
                      </label>

                      <label className="md:col-span-2">
                        <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
                          Descrição interna
                        </span>

                        <input
                          value={form.description}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          placeholder="Opcional, aparece só para controle interno"
                          className="mt-1 h-11 w-full rounded-none border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                        />
                      </label>

                      <label>
                        <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
                          Prioridade
                        </span>

                        <input
                          value={form.priority}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              priority: event.target.value,
                            }))
                          }
                          placeholder="0"
                          className="mt-1 h-11 w-full rounded-none border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                        />
                      </label>

                      <label>
                        <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
                          Início
                        </span>

                        <input
                          type="datetime-local"
                          value={form.starts_at}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              starts_at: event.target.value,
                            }))
                          }
                          className="mt-1 h-11 w-full rounded-none border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                        />
                      </label>

                      <label>
                        <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
                          Fim
                        </span>

                        <input
                          type="datetime-local"
                          value={form.ends_at}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              ends_at: event.target.value,
                            }))
                          }
                          className="mt-1 h-11 w-full rounded-none border border-white/10 bg-[#0A0A0A] px-3 text-sm font-semibold outline-none transition focus:border-yellow-400/30 focus:ring-4 focus:ring-yellow-400/20"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 bg-[#0A0A0A] px-5 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-none border border-white/10 bg-[#0A0A0A] px-5 py-3 text-sm font-black text-zinc-500 transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-none bg-yellow-400 px-5 py-3 text-sm font-black text-black shadow-lg shadow-yellow-400/20 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingRule ? "Salvar alterações" : "Salvar regra"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
