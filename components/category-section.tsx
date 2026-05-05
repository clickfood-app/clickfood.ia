"use client"

import { useEffect, useRef, useState } from "react"
import { GripVertical, ChevronDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import ProductCard from "@/components/product-card"
import type { Product, ViewMode, ProductIndicator } from "@/lib/products-data"

interface CategorySectionProps {
  categoryId: string
  categoryName: string
  products: Product[]
  viewMode: ViewMode
  selectedProducts: Set<string>
  allowProductDrag: boolean
  onToggleSelect: (id: string) => void
  onToggleProductActive: (id: string) => void
  onEditProduct: (id: string) => void
  onDeleteProduct?: (id: string) => void
  onEditCategory?: (id: string) => void
  onDeleteCategory?: (id: string) => void
  getIndicator: (product: Product) => ProductIndicator
  onCategoryDragStart: (categoryId: string) => void
  onCategoryDragOver: (e: React.DragEvent, categoryId: string) => void
  onCategoryDrop: (categoryId: string) => void
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
  allowProductDrag,
  onToggleSelect,
  onToggleProductActive,
  onEditProduct,
  onDeleteProduct,
  onEditCategory,
  onDeleteCategory,
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const canManage = viewMode === "management"

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [])

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
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
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

        {canManage && allowProductDrag && (
          <span className="rounded-full bg-[hsl(var(--primary))]/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--primary))]">
            Ordem manual
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {canManage && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label={`Ações da categoria ${categoryName}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-10 z-30 min-w-[190px] rounded-xl border border-border bg-popover p-1.5 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onEditCategory?.(categoryId)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-muted"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar categoria
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onDeleteCategory?.(categoryId)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir categoria
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
      </div>

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
                draggable={allowProductDrag}
                onDragStart={() => onProductDragStart(product.id, categoryId)}
                onDragOver={(e) => onProductDragOver(e, product.id, categoryId)}
                onDrop={() => onProductDrop(categoryId)}
                className={cn(allowProductDrag && "cursor-grab active:cursor-grabbing")}
              >
                <ProductCard
                  product={product}
                  indicator={getIndicator(product)}
                  viewMode={viewMode}
                  selected={selectedProducts.has(product.id)}
                  allowSelection={canManage}
                  onToggleSelect={onToggleSelect}
                  onToggleActive={onToggleProductActive}
                  onEdit={onEditProduct}
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