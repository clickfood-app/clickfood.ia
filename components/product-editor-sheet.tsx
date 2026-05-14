"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BadgeDollarSign,
  ImageIcon,
  Package2,
  Save,
  Settings2,
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
import { cn } from "@/lib/utils"
import {
  type Category,
  type Product,
  getMargin,
  getProfit,
} from "@/lib/products-data"

export interface ProductEditorValues {
  name: string
  description: string
  price: number
  cost: number
  category: string
  active: boolean
  image: string | null
  imageSize?: number
}

interface ProductEditorSheetProps {
  open: boolean
  mode: "create" | "edit"
  categories: Category[]
  defaultCategoryId?: string
  product?: Product | null
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
      return
    }

    setName("")
    setDescription("")
    setPrice("")
    setCost("")
    setCategory(defaultCategoryId ?? categories[0]?.id ?? "")
    setActive(true)
    setImage(null)
  }, [categories, defaultCategoryId, mode, open, product])

  const numericPrice = parseMoneyInput(price)
  const numericCost = parseMoneyInput(cost)
  const previewProfit = getProfit(numericPrice, numericCost)
  const previewMargin = getMargin(numericPrice, numericCost)

  const canSave = useMemo(() => {
    return (
      name.trim().length > 0 &&
      category.trim().length > 0 &&
      Number.isFinite(numericPrice) &&
      numericPrice > 0 &&
      Number.isFinite(numericCost) &&
      numericCost >= 0
    )
  }, [category, name, numericCost, numericPrice])

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
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-hidden p-0 sm:max-w-3xl"
      >
        <div className="flex h-full flex-col bg-slate-50">
          <SheetHeader className="border-b border-slate-200 bg-white px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                {mode === "create" ? (
                  <Package2 className="h-5 w-5" />
                ) : (
                  <BadgeDollarSign className="h-5 w-5" />
                )}
              </div>

              <div>
                <SheetTitle className="text-xl font-black text-slate-950">
                  {mode === "create" ? "Novo Produto" : "Editar Produto"}
                </SheetTitle>

                <SheetDescription className="text-sm text-slate-500">
                  Ajuste nome, preço, custo, margem, categoria, status e imagem.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
              <div className="space-y-5">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-sm font-black text-slate-950">
                      Imagem
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Foto do produto no cardápio.
                    </p>
                  </div>

                  <div className="max-w-sm">
                    <ImageUpload value={image} onChange={setImage} />
                  </div>
                </section>

                <section className="rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                      <Settings2 className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="text-sm font-black text-blue-950">
                        Complementos e adicionais
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-blue-800">
                        A próxima etapa é ligar os complementos no banco:
                        adicionais, molhos, ponto da carne, obrigatório/opcional,
                        mínimo e máximo de escolhas.
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              <div className="space-y-5">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-sm font-black text-slate-950">
                      Preço e custo
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      O lucro e a margem são calculados automaticamente.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
                        Preço
                      </p>
                      <p className="mt-1 text-xl font-black text-slate-950">
                        {formatCurrency(numericPrice)}
                      </p>
                    </div>

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
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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

          <SheetFooter className="border-t border-slate-200 bg-white px-6 py-4 sm:space-x-0">
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