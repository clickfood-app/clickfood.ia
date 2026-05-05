"use client"

import { useEffect, useMemo, useState } from "react"
import { BadgeDollarSign, ImageIcon, Package2, Save } from "lucide-react"
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
import { type Category, type Product, getMargin, getProfit } from "@/lib/products-data"

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
      <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-2xl">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                {mode === "create" ? <Package2 className="h-5 w-5" /> : <BadgeDollarSign className="h-5 w-5" />}
              </div>
              <div>
                <SheetTitle>{mode === "create" ? "Novo Produto" : "Editar Produto"}</SheetTitle>
                <SheetDescription>
                  {mode === "create"
                    ? "Preencha os dados do item para publicar no cardapio."
                    : "Atualize nome, categoria, status, precificacao e imagem no mesmo fluxo."}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-5">
                <section className="rounded-2xl border border-border bg-card/60 p-4">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Apresentacao do produto</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Um cadastro completo ajuda a vender melhor e evita ajustes manuais depois.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                        Nome do produto <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Ex: X-Burger Especial"
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                        Descricao
                      </label>
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Ingredientes, acompanhamentos e diferenciais do produto..."
                        rows={4}
                        className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                        Imagem
                      </label>
                      <ImageUpload value={image} onChange={setImage} />
                    </div>
                  </div>
                </section>
              </div>

              <div className="space-y-5">
                <section className="rounded-2xl border border-border bg-card/60 p-4">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Precificacao e operacao</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Defina como o item sera exibido e acompanhe a margem antes de salvar.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                          Preco de venda <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            R$
                          </span>
                          <input
                            type="text"
                            value={price}
                            onChange={(event) => setPrice(event.target.value.replace(/[^0-9,.]/g, ""))}
                            placeholder="0,00"
                            className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                          Custo
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            R$
                          </span>
                          <input
                            type="text"
                            value={cost}
                            onChange={(event) => setCost(event.target.value.replace(/[^0-9,.]/g, ""))}
                            placeholder="0,00"
                            className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                        Categoria <span className="text-destructive">*</span>
                      </label>
                      <select
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                      >
                        {categories.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-card-foreground">
                        Status
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setActive(true)}
                          className={cn(
                            "rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                            active
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-input bg-background text-muted-foreground hover:bg-secondary"
                          )}
                        >
                          <p className="font-medium">Ativo</p>
                          <p className="mt-1 text-xs opacity-80">Aparece no cardapio e entra nas buscas.</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActive(false)}
                          className={cn(
                            "rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                            !active
                              ? "border-amber-300 bg-amber-50 text-amber-700"
                              : "border-input bg-background text-muted-foreground hover:bg-secondary"
                          )}
                        >
                          <p className="font-medium">Inativo</p>
                          <p className="mt-1 text-xs opacity-80">Fica salvo, mas some da operacao e do cliente.</p>
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-card/60 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Resumo de margem</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Veja o impacto financeiro antes de publicar a alteracao.
                      </p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border bg-background px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Preco
                      </p>
                      <p className="mt-2 text-lg font-bold text-foreground">R$ {numericPrice.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-background px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Lucro estimado
                      </p>
                      <p
                        className={cn(
                          "mt-2 text-lg font-bold",
                          previewProfit > 0 ? "text-emerald-600" : "text-destructive"
                        )}
                      >
                        R$ {previewProfit.toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-background px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Margem
                      </p>
                      <p
                        className={cn(
                          "mt-2 text-lg font-bold",
                          previewMargin >= 20 ? "text-[hsl(var(--primary))]" : "text-amber-600"
                        )}
                      >
                        {previewMargin.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>

          <SheetFooter className="border-t border-border px-6 py-4 sm:space-x-0">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {mode === "create"
                  ? "Voce pode revisar tudo antes de publicar o novo item."
                  : "As alteracoes sao aplicadas imediatamente no catalogo interno."}
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={!canSave}>
                  <Save className="h-4 w-4" />
                  {mode === "create" ? "Salvar Produto" : "Salvar Alteracoes"}
                </Button>
              </div>
            </div>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  )
}
