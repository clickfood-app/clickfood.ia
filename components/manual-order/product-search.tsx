"use client"

import { useState, useMemo } from "react"
import { Search, Plus, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Product, Category } from "@/lib/products-data"

interface ProductSearchProps {
  products: Product[]
  categories: Category[]
  onAddProduct: (product: Product) => void
}

export default function ProductSearch({ products, categories, onAddProduct }: ProductSearchProps) {
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.active) return false
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = selectedCategory === "all" || p.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [products, search, selectedCategory])

  const sortedCategories = useMemo(() => {
    return [...categories].filter((c) => c.active).sort((a, b) => a.order - b.order)
  }, [categories])

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produto..."
          className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
        />
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory("all")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            selectedCategory === "all"
              ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          )}
        >
          Todos
        </button>
        {sortedCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              selectedCategory === cat.id
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 gap-2 max-h-[320px] overflow-y-auto pr-1">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3 min-w-0">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-10 w-10 rounded-lg object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground">
                  R$ {product.price.toFixed(2).replace(".", ",")}
                </p>
              </div>
            </div>
            <button
              onClick={() => onAddProduct(product)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ))}

        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum produto encontrado</p>
          </div>
        )}
      </div>
    </div>
  )
}
