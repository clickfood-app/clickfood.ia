"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BadgeDollarSign,
  ImageIcon,
  Package2,
  Percent,
  Plus,
  Save,
  Settings2,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import ImageUpload from "@/components/image-upload"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  type Category,
  type Product,
  getMargin,
  getProfit,
} from "@/lib/products-data"

type PromotionType = "none" | "fixed" | "percentage"

type ProductWithPromotion = Product & {
  promotionActive?: boolean
  promotionType?: PromotionType
  promotionValue?: number
}

type ModifierOptionDraft = {
  id?: string
  name: string
  price: number
  sortOrder: number
}

type ModifierGroupDraft = {
  id?: string
  name: string
  required: boolean
  minSelect: number
  maxSelect: number
  sortOrder: number
  options: ModifierOptionDraft[]
}

type DbModifierGroup = {
  id: string
  name: string
  required: boolean | null
  min_select: number | null
  max_select: number | null
  sort_order: number | null
}

type DbModifierOption = {
  id: string
  group_id: string
  name: string
  price: number | string | null
  sort_order: number | null
}

export interface ProductEditorValues {
  name: string
  description: string
  price: number
  cost: number
  category: string
  active: boolean
  image: string | null
  imageSize?: number
  promotionActive: boolean
  promotionType: PromotionType
  promotionValue: number
}

interface ProductEditorSheetProps {
  open: boolean
  mode: "create" | "edit"
  categories: Category[]
  defaultCategoryId?: string
  product?: ProductWithPromotion | null
  onOpenChange: (open: boolean) => void
  onSave: (values: ProductEditorValues) => void
}

function formatMoneyInput(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ""
  return value.toFixed(2).replace(".", ",")
}

function parseMoneyInput(value: string): number {
  if (!value.trim()) return 0
  return Number.parseFloat(value.replace(",", "."))
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function createEmptyModifierGroup(sortOrder = 0): ModifierGroupDraft {
  return {
    name: "",
    required: false,
    minSelect: 0,
    maxSelect: 1,
    sortOrder,
    options: [
      {
        name: "",
        price: 0,
        sortOrder: 0,
      },
    ],
  }
}

function parseIntegerInput(value: string, fallback = 0) {
  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed)) return fallback

  return Math.max(parsed, 0)
}

function getDiscountValue(price: number, type: PromotionType, value: number) {
  if (type === "percentage") {
    return Math.min(price, price * (value / 100))
  }

  if (type === "fixed") {
    return Math.min(price, value)
  }

  return 0
}

export default function ProductEditorSheet({
  open,
  mode,
  categories,
  defaultCategoryId,
  product,
  onOpenChange,
  onSave,
}: ProductEditorSheetProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [cost, setCost] = useState("")
  const [category, setCategory] = useState("")
  const [active, setActive] = useState(true)
  const [image, setImage] = useState<string | null>(null)
  const [promotionActive, setPromotionActive] = useState(false)
  const [promotionType, setPromotionType] = useState<PromotionType>("none")
  const [promotionValue, setPromotionValue] = useState("")
  const [modifierGroups, setModifierGroups] = useState<ModifierGroupDraft[]>([])
  const [loadingModifiers, setLoadingModifiers] = useState(false)
  const [savingModifiers, setSavingModifiers] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!open) return

    if (mode === "edit" && product) {
      setName(product.name)
      setDescription(product.description)
      setPrice(formatMoneyInput(product.price))
      setCost(formatMoneyInput(product.cost))
      setCategory(product.category)
      setActive(product.active)
      setImage(product.image)
      setPromotionActive(Boolean(product.promotionActive))
      setPromotionType(product.promotionType ?? "none")
      setPromotionValue(formatMoneyInput(product.promotionValue ?? 0))
      return
    }

    setName("")
    setDescription("")
    setPrice("")
    setCost("")
    setCategory(defaultCategoryId ?? categories[0]?.id ?? "")
    setActive(true)
    setImage(null)
    setPromotionActive(false)
    setPromotionType("none")
    setPromotionValue("")
  }, [categories, defaultCategoryId, mode, open, product])

  useEffect(() => {
    let cancelled = false

    async function loadModifierGroups() {
      if (!open || mode !== "edit" || !product?.id) {
        setModifierGroups([])
        return
      }

      try {
        setLoadingModifiers(true)

        const { data: groupsData, error: groupsError } = await supabase
          .from("product_modifier_groups")
          .select("id, name, required, min_select, max_select, sort_order")
          .eq("product_id", product.id)
          .order("sort_order", { ascending: true })

        if (groupsError) throw groupsError

        const groups = (groupsData ?? []) as DbModifierGroup[]
        const groupIds = groups.map((group) => group.id)

        let options: DbModifierOption[] = []

        if (groupIds.length > 0) {
          const { data: optionsData, error: optionsError } = await supabase
            .from("product_modifier_options")
            .select("id, group_id, name, price, sort_order")
            .in("group_id", groupIds)
            .order("sort_order", { ascending: true })

          if (optionsError) throw optionsError

          options = (optionsData ?? []) as DbModifierOption[]
        }

        if (cancelled) return

        setModifierGroups(
          groups.map((group, groupIndex) => ({
            id: group.id,
            name: group.name,
            required: Boolean(group.required),
            minSelect: Number(group.min_select ?? 0),
            maxSelect: Math.max(Number(group.max_select ?? 1), 1),
            sortOrder: Number(group.sort_order ?? groupIndex),
            options: options
              .filter((option) => option.group_id === group.id)
              .map((option, optionIndex) => ({
                id: option.id,
                name: option.name,
                price: Number(option.price ?? 0),
                sortOrder: Number(option.sort_order ?? optionIndex),
              })),
          }))
        )
      } catch (error) {
        console.error("Erro ao carregar complementos:", error)
        if (!cancelled) setModifierGroups([])
      } finally {
        if (!cancelled) setLoadingModifiers(false)
      }
    }

    void loadModifierGroups()

    return () => {
      cancelled = true
    }
  }, [mode, open, product?.id, supabase])

  const numericPrice = parseMoneyInput(price)
  const numericCost = parseMoneyInput(cost)
  const numericPromotionValue = parseMoneyInput(promotionValue)
  const normalizedPromotionActive =
    promotionActive && promotionType !== "none" && numericPromotionValue > 0

  const promotionDiscount = normalizedPromotionActive
    ? getDiscountValue(numericPrice, promotionType, numericPromotionValue)
    : 0

  const finalPrice = Math.max(numericPrice - promotionDiscount, 0)
  const previewProfit = getProfit(finalPrice, numericCost)
  const previewMargin = getMargin(finalPrice, numericCost)
  const baseProfit = getProfit(numericPrice, numericCost)
  const baseMargin = getMargin(numericPrice, numericCost)

const canSave = useMemo(() => {
  const validPromotion =
    !promotionActive ||
    (promotionType !== "none" &&
      Number.isFinite(numericPromotionValue) &&
      numericPromotionValue > 0 &&
      numericPrice > 0 &&
      (promotionType !== "percentage" || numericPromotionValue <= 100) &&
      finalPrice > 0)

  return (
    name.trim().length > 0 &&
    category.trim().length > 0 &&
    Number.isFinite(numericPrice) &&
    numericPrice >= 0 &&
    Number.isFinite(numericCost) &&
    numericCost >= 0 &&
    validPromotion
  )
}, [
  category,
  finalPrice,
  name,
  numericCost,
  numericPrice,
  numericPromotionValue,
  promotionActive,
  promotionType,
])

  const addModifierGroup = () => {
    setModifierGroups((currentGroups) => [
      ...currentGroups,
      createEmptyModifierGroup(currentGroups.length),
    ])
  }

  const removeModifierGroup = (groupIndex: number) => {
    setModifierGroups((currentGroups) =>
      currentGroups.filter((_, index) => index !== groupIndex)
    )
  }

  const updateModifierGroup = (
    groupIndex: number,
    updates: Partial<ModifierGroupDraft>
  ) => {
    setModifierGroups((currentGroups) =>
      currentGroups.map((group, index) =>
        index === groupIndex ? { ...group, ...updates } : group
      )
    )
  }

  const addModifierOption = (groupIndex: number) => {
    setModifierGroups((currentGroups) =>
      currentGroups.map((group, index) => {
        if (index !== groupIndex) return group

        return {
          ...group,
          options: [
            ...group.options,
            {
              name: "",
              price: 0,
              sortOrder: group.options.length,
            },
          ],
        }
      })
    )
  }

  const updateModifierOption = (
    groupIndex: number,
    optionIndex: number,
    updates: Partial<ModifierOptionDraft>
  ) => {
    setModifierGroups((currentGroups) =>
      currentGroups.map((group, currentGroupIndex) => {
        if (currentGroupIndex !== groupIndex) return group

        return {
          ...group,
          options: group.options.map((option, currentOptionIndex) =>
            currentOptionIndex === optionIndex
              ? { ...option, ...updates }
              : option
          ),
        }
      })
    )
  }

  const removeModifierOption = (groupIndex: number, optionIndex: number) => {
    setModifierGroups((currentGroups) =>
      currentGroups.map((group, currentGroupIndex) => {
        if (currentGroupIndex !== groupIndex) return group

        return {
          ...group,
          options: group.options.filter((_, index) => index !== optionIndex),
        }
      })
    )
  }

  const saveModifierGroups = async () => {
    if (mode !== "edit" || !product?.id) return

    const normalizedGroups = modifierGroups
      .map((group, groupIndex) => ({
        ...group,
        name: group.name.trim(),
        minSelect: Math.max(Number(group.minSelect || 0), 0),
        maxSelect: Math.max(Number(group.maxSelect || 1), 1),
        sortOrder: groupIndex,
        options: group.options
          .map((option, optionIndex) => ({
            ...option,
            name: option.name.trim(),
            price: roundMoney(Number(option.price || 0)),
            sortOrder: optionIndex,
          }))
          .filter((option) => option.name.length > 0),
      }))
      .filter((group) => group.name.length > 0)

    const invalidGroup = normalizedGroups.find(
      (group) => group.options.length === 0 || group.minSelect > group.maxSelect
    )

    if (invalidGroup) {
      alert(
        "Revise os complementos: cada grupo precisa ter ao menos uma opção e o mínimo não pode ser maior que o máximo."
      )
      return
    }

    try {
      setSavingModifiers(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error("Usuário não autenticado.")

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .single()

      if (restaurantError) throw restaurantError
      if (!restaurant?.id) throw new Error("Restaurante não encontrado.")

      const { error: deleteError } = await supabase
        .from("product_modifier_groups")
        .delete()
        .eq("product_id", product.id)
        .eq("restaurant_id", restaurant.id)

      if (deleteError) throw deleteError

      for (const group of normalizedGroups) {
        const { data: insertedGroup, error: groupError } = await supabase
          .from("product_modifier_groups")
          .insert({
            restaurant_id: restaurant.id,
            product_id: product.id,
            name: group.name,
            required: group.required,
            min_select: group.required ? Math.max(group.minSelect, 1) : group.minSelect,
            max_select: group.maxSelect,
            sort_order: group.sortOrder,
            is_active: true,
          })
          .select("id")
          .single()

        if (groupError) throw groupError
        if (!insertedGroup?.id) throw new Error("Erro ao salvar grupo de complemento.")

        const optionsToInsert = group.options.map((option) => ({
          group_id: insertedGroup.id,
          name: option.name,
          price: option.price,
          sort_order: option.sortOrder,
          is_active: true,
        }))

        const { error: optionsError } = await supabase
          .from("product_modifier_options")
          .insert(optionsToInsert)

        if (optionsError) throw optionsError
      }

      alert("Complementos salvos com sucesso.")
    } catch (error) {
      console.error("Erro ao salvar complementos:", error)
      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar os complementos."
      )
    } finally {
      setSavingModifiers(false)
    }
  }

  const handleSave = () => {
    if (!canSave) return

    onSave({
      name: name.trim(),
      description: description.trim(),
      price: Math.round(numericPrice * 100) / 100,
      cost: Math.round(numericCost * 100) / 100,
      category,
      active,
      image,
      imageSize: product?.image === image ? product.imageSize : undefined,
      promotionActive: normalizedPromotionActive,
      promotionType: normalizedPromotionActive ? promotionType : "none",
      promotionValue: normalizedPromotionActive ? roundMoney(numericPromotionValue) : 0,
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-hidden p-0 sm:max-w-[760px] xl:max-w-[900px]"
      >
        <div className="flex h-full flex-col bg-slate-50">
          <SheetHeader className="border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                {mode === "create" ? (
                  <Package2 className="h-5 w-5" />
                ) : (
                  <BadgeDollarSign className="h-5 w-5" />
                )}
              </div>

              <div>
                <SheetTitle className="text-lg font-black text-slate-950">
                  {mode === "create" ? "Novo Produto" : "Editar Produto"}
                </SheetTitle>

                <SheetDescription className="text-xs text-slate-500">
                  Ajuste nome, preço, custo, promoção, categoria, status e imagem.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-5">
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0 space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-sm font-black text-slate-950">
                      Dados do produto
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Informações que aparecem no cardápio do cliente.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Nome do produto <span className="text-red-500">*</span>
                      </label>

                      <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Ex: X-Bacon"
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Descrição
                      </label>

                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Ex: Pão brioche, hambúrguer bovino, cheddar, bacon e molho especial..."
                        rows={4}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Categoria <span className="text-red-500">*</span>
                      </label>

                      <select
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                      >
                        {categories.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-sm font-black text-slate-950">
                      Imagem
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Foto do produto no cardápio.
                    </p>
                  </div>

                  <div className="max-w-[340px]">
                    <ImageUpload value={image} onChange={setImage} />
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                        <Settings2 className="h-5 w-5" />
                      </div>

                      <div>
                        <h3 className="text-sm font-black text-slate-950">
                          Complementos e adicionais
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Cadastre extras, molhos, ponto da carne e escolhas obrigatórias.
                        </p>
                      </div>
                    </div>

                    {mode === "edit" && product?.id ? (
                      <button
                        type="button"
                        onClick={addModifierGroup}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Grupo
                      </button>
                    ) : null}
                  </div>

                  {mode !== "edit" || !product?.id ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                      Salve o produto primeiro. Depois abra novamente para cadastrar os complementos.
                    </div>
                  ) : loadingModifiers ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                      Carregando complementos...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {modifierGroups.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/70 p-4 text-sm leading-6 text-blue-800">
                          Nenhum complemento cadastrado ainda. Clique em <strong>Grupo</strong> para criar adicionais como bacon, cheddar, molhos ou ponto da carne.
                        </div>
                      ) : null}

                      {modifierGroups.map((group, groupIndex) => (
                        <div
                          key={`${group.id ?? "new"}-${groupIndex}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                                Nome do grupo
                              </label>
                              <input
                                type="text"
                                value={group.name}
                                onChange={(event) =>
                                  updateModifierGroup(groupIndex, {
                                    name: event.target.value,
                                  })
                                }
                                placeholder="Ex: Adicionais, Molhos, Ponto da carne"
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => removeModifierGroup(groupIndex)}
                              className="mt-6 flex h-10 w-10 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100"
                              aria-label="Remover grupo"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mb-4 grid gap-3 sm:grid-cols-3">
                            <button
                              type="button"
                              onClick={() =>
                                updateModifierGroup(groupIndex, {
                                  required: !group.required,
                                  minSelect: !group.required
                                    ? Math.max(group.minSelect, 1)
                                    : 0,
                                })
                              }
                              className={cn(
                                "rounded-lg border px-3 py-2 text-left transition",
                                group.required
                                  ? "border-orange-300 bg-orange-50 text-orange-700"
                                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                              )}
                            >
                              <p className="text-xs font-black uppercase">Obrigatório</p>
                              <p className="mt-0.5 text-xs">
                                {group.required ? "Sim" : "Não"}
                              </p>
                            </button>

                            <div>
                              <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                                Mínimo
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={group.minSelect}
                                onChange={(event) =>
                                  updateModifierGroup(groupIndex, {
                                    minSelect: parseIntegerInput(event.target.value),
                                  })
                                }
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                              />
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                                Máximo
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={group.maxSelect}
                                onChange={(event) =>
                                  updateModifierGroup(groupIndex, {
                                    maxSelect: Math.max(
                                      parseIntegerInput(event.target.value, 1),
                                      1
                                    ),
                                  })
                                }
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                                Opções
                              </p>
                              <button
                                type="button"
                                onClick={() => addModifierOption(groupIndex)}
                                className="text-xs font-black text-blue-600 hover:text-blue-700"
                              >
                                + Adicionar opção
                              </button>
                            </div>

                            {group.options.map((option, optionIndex) => (
                              <div
                                key={`${option.id ?? "new"}-${optionIndex}`}
                                className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_120px_40px]"
                              >
                                <input
                                  type="text"
                                  value={option.name}
                                  onChange={(event) =>
                                    updateModifierOption(groupIndex, optionIndex, {
                                      name: event.target.value,
                                    })
                                  }
                                  placeholder="Ex: Bacon extra"
                                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                                />

                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                    R$
                                  </span>
                                  <input
  type="number"
  min={0}
  step="0.01"
  value={option.price === 0 ? "" : option.price}
  onChange={(event) =>
    updateModifierOption(groupIndex, optionIndex, {
      price: Number(event.target.value || 0),
    })
  }
  placeholder="0,00"
  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
/>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeModifierOption(groupIndex, optionIndex)}
                                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                                  aria-label="Remover opção"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => void saveModifierGroups()}
                          disabled={savingModifiers}
                          className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingModifiers ? "Salvando..." : "Salvar complementos"}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              <div className="min-w-0 space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-sm font-black text-slate-950">
                      Preço e custo
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      O lucro e a margem são calculados automaticamente.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Preço de venda <span className="text-red-500">*</span>
                      </label>

                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                          R$
                        </span>

                        <input
                          type="text"
                          value={price}
                          onChange={(event) =>
                            setPrice(event.target.value.replace(/[^0-9,.]/g, ""))
                          }
                          placeholder="0,00"
                          className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700">
                        Custo
                      </label>

                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                          R$
                        </span>

                        <input
                          type="text"
                          value={cost}
                          onChange={(event) =>
                            setCost(event.target.value.replace(/[^0-9,.]/g, ""))
                          }
                          placeholder="0,00"
                          className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-950">
                        Promoção fixa
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Desconto direto no produto, em valor fixo ou porcentagem.
                      </p>
                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                      <Percent className="h-5 w-5" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const nextActive = !promotionActive
                      setPromotionActive(nextActive)

                      if (nextActive && promotionType === "none") {
                        setPromotionType("fixed")
                      }

                      if (!nextActive) {
                        setPromotionType("none")
                        setPromotionValue("")
                      }
                    }}
                    className={cn(
                      "mb-4 flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition",
                      promotionActive
                        ? "border-orange-300 bg-orange-50 text-orange-700"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <div>
                      <p className="text-sm font-black">
                        {promotionActive ? "Promoção ativa" : "Sem promoção"}
                      </p>
                      <p className="mt-1 text-xs">
                        {promotionActive
                          ? "O preço promocional será usado no cardápio."
                          : "Ative para aplicar desconto nesse produto."}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "h-6 w-11 rounded-full p-0.5 transition",
                        promotionActive ? "bg-orange-500" : "bg-slate-300"
                      )}
                    >
                      <span
                        className={cn(
                          "block h-5 w-5 rounded-full bg-white shadow transition",
                          promotionActive && "translate-x-5"
                        )}
                      />
                    </span>
                  </button>

                  {promotionActive && (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <div>
                        <label className="mb-1.5 block text-sm font-bold text-slate-700">
                          Tipo
                        </label>

                        <select
                          value={promotionType}
                          onChange={(event) =>
                            setPromotionType(event.target.value as PromotionType)
                          }
                          className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                        >
                          <option value="fixed">Valor fixo</option>
                          <option value="percentage">Porcentagem</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-bold text-slate-700">
                          Valor
                        </label>

                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                            {promotionType === "percentage" ? "%" : "R$"}
                          </span>

                          <input
                            type="text"
                            value={promotionValue}
                            onChange={(event) =>
                              setPromotionValue(
                                event.target.value.replace(/[^0-9,.]/g, "")
                              )
                            }
                            placeholder={
                              promotionType === "percentage" ? "10" : "5,00"
                            }
                            className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                          />
                        </div>

                        {promotionType === "percentage" &&
                          numericPromotionValue > 100 && (
                            <p className="mt-1 text-xs font-semibold text-red-600">
                              A porcentagem não pode passar de 100%.
                            </p>
                          )}

                        {finalPrice <= 0 && numericPrice > 0 && (
                          <p className="mt-1 text-xs font-semibold text-red-600">
                            O desconto não pode zerar o preço do produto.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-950">
                        Resultado do produto
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Visão rápida antes de salvar.
                      </p>
                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Preço base
                      </p>
                      <p className="mt-1 text-xl font-black text-slate-950">
                        {formatCurrency(numericPrice)}
                      </p>
                    </div>

                    {normalizedPromotionActive && (
                      <>
                        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-orange-700">
                            Desconto
                          </p>
                          <p className="mt-1 text-xl font-black text-orange-700">
                            {formatCurrency(promotionDiscount)}
                          </p>
                        </div>

                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                            Preço final
                          </p>
                          <p className="mt-1 text-xl font-black text-emerald-700">
                            {formatCurrency(finalPrice)}
                          </p>
                        </div>
                      </>
                    )}

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Custo
                      </p>
                      <p className="mt-1 text-xl font-black text-slate-950">
                        {formatCurrency(numericCost)}
                      </p>
                    </div>

                    <div
                      className={cn(
                        "rounded-lg border p-4",
                        previewProfit >= 0
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-red-200 bg-red-50"
                      )}
                    >
                      <p
                        className={cn(
                          "text-xs font-bold uppercase tracking-wide",
                          previewProfit >= 0 ? "text-emerald-700" : "text-red-700"
                        )}
                      >
                        Lucro estimado
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-xl font-black",
                          previewProfit >= 0 ? "text-emerald-700" : "text-red-700"
                        )}
                      >
                        {formatCurrency(previewProfit)}
                      </p>

                      {normalizedPromotionActive && (
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Lucro base: {formatCurrency(baseProfit)}
                        </p>
                      )}
                    </div>

                    <div
                      className={cn(
                        "rounded-lg border p-4",
                        previewMargin >= 20
                          ? "border-blue-200 bg-blue-50"
                          : "border-amber-200 bg-amber-50"
                      )}
                    >
                      <p
                        className={cn(
                          "text-xs font-bold uppercase tracking-wide",
                          previewMargin >= 20 ? "text-blue-700" : "text-amber-700"
                        )}
                      >
                        Margem
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-xl font-black",
                          previewMargin >= 20 ? "text-blue-700" : "text-amber-700"
                        )}
                      >
                        {previewMargin.toFixed(1)}%
                      </p>

                      {normalizedPromotionActive && (
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Margem base: {baseMargin.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-black text-slate-950">
                    Status no cardápio
                  </h3>

                  <div className="mt-4 grid gap-3">
                    <button
                      type="button"
                      onClick={() => setActive(true)}
                      className={cn(
                        "rounded-lg border px-4 py-3 text-left transition",
                        active
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      <p className="text-sm font-black">Ativo</p>
                      <p className="mt-1 text-xs">
                        Aparece no cardápio e pode ser vendido.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActive(false)}
                      className={cn(
                        "rounded-lg border px-4 py-3 text-left transition",
                        !active
                          ? "border-amber-400 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      <p className="text-sm font-black">Inativo</p>
                      <p className="mt-1 text-xs">
                        Fica salvo, mas não aparece para o cliente.
                      </p>
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>

          <SheetFooter className="border-t border-slate-200 bg-white px-5 py-3 sm:space-x-0">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                {mode === "create"
                  ? "Revise os dados antes de publicar o item."
                  : "As alterações são aplicadas no catálogo após salvar."}
              </p>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="h-10 rounded-lg border-slate-200 px-4"
                >
                  Cancelar
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={!canSave}
                  className="h-10 rounded-lg bg-blue-600 px-5 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {mode === "create" ? "Salvar Produto" : "Salvar Alterações"}
                </Button>
              </div>
            </div>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  )
}