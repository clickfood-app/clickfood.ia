"use client"

import { useState } from "react"
import { GripVertical, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import ProductCard from "@/components/product-card"
import type { Product, ViewMode, ProductIndicator } from "@/lib/products-data"

interface CategorySectionProps {
  categoryId: string
  categoryName: string
  products: Product[]
  allProducts: Product[]
  viewMode: ViewMode
  selectedProducts: Set<string>
  onToggleSelect: (id: string) => void
  onUpdateProduct: (id: string, updates: Partial<Product>) => void
  onDeleteProduct?: (id: string) => void
  getIndicator: (product: Product) => ProductIndicator
  /** Category drag */
  onCategoryDragStart: (categoryId: string) => void
  onCategoryDragOver: (e: React.DragEvent, categoryId: string) => void
  onCategoryDrop: (categoryId: string) => void
  /** Product drag within category */
  onProductDragStart: (productId: string, categoryId: string) => void
  onProductDragOver: (e: React.DragEvent, productId: string, categoryId: string) => void
  onProductDrop: (categoryId: string) => void
  isDragOverCategory: boolean
}

export default function CategorySection({
  categoryId,
  categoryName,
  products,
  viewMode,
  selectedProducts,
  onToggleSelect,
  onUpdateProduct,
  onDeleteProduct,
  getIndicator,
  onCategoryDragStart,
  onCategoryDragOver,
  onCategoryDrop,
  onProductDragStart,
  onProductDragOver,
  onProductDrop,
  isDragOverCategory,
}: CategorySectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-all duration-200",
        isDragOverCategory
          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 shadow-lg"
          : "border-border"
      )}
      onDragOver={(e) => onCategoryDragOver(e, categoryId)}
      onDrop={() => onCategoryDrop(categoryId)}
    >
      {/* Category header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        {/* Drag handle for category */}
        {viewMode === "management" && (
          <button
            draggable
            onDragStart={() => onCategoryDragStart(categoryId)}
            className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:cursor-grabbing"
            aria-label={`Reordenar categoria ${categoryName}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
          {categoryName}
        </h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {products.length}
        </span>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label={isCollapsed ? "Expandir" : "Recolher"}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isCollapsed && "-rotate-90"
            )}
          />
        </button>
      </div>

      {/* Products */}
      {!isCollapsed && (
        <div className="flex flex-col gap-3 p-4">
          {products.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum produto nesta categoria
            </p>
          ) : (
            products.map((product) => (
              <div
                key={product.id}
                draggable={viewMode === "management"}
                onDragStart={() => onProductDragStart(product.id, categoryId)}
                onDragOver={(e) => onProductDragOver(e, product.id, categoryId)}
                onDrop={() => onProductDrop(categoryId)}
                className={cn(
                  viewMode === "management" && "cursor-grab active:cursor-grabbing"
                )}
              >
                <ProductCard
                  product={product}
                  indicator={getIndicator(product)}
                  viewMode={viewMode}
                  selected={selectedProducts.has(product.id)}
                  onToggleSelect={onToggleSelect}
                  onUpdate={onUpdateProduct}
                  onDelete={onDeleteProduct}
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
