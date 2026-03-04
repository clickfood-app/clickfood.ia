"use client"

import React from "react"

import { useState, useCallback, useMemo, useRef } from "react"
import AdminLayout from "@/components/admin-layout"
import ProductsToolbar from "@/components/products-toolbar"
import CategorySection from "@/components/category-section"
import {
  type Product,
  type Category,
  type ViewMode,
  type SortOption,
  initialProducts,
  initialCategories,
  getProductIndicator,
  getProfit,
} from "@/lib/products-data"
import { Plus, FolderPlus, X, Tag, Package, Upload, ImageIcon, Trash2, AlertCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import ConfirmationModal from "@/components/confirmation-modal"
import { useToast } from "@/hooks/use-toast"

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortBy, setSortBy] = useState<SortOption>("name")
  const [viewMode, setViewMode] = useState<ViewMode>("management")
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())

  // Drag state
  const [dragCategoryId, setDragCategoryId] = useState<string | null>(null)
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null)
  const [dragProductId, setDragProductId] = useState<string | null>(null)
  const [dragProductSourceCat, setDragProductSourceCat] = useState<string | null>(null)
  const dragOverProductId = useRef<string | null>(null)

  // Category modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryDescription, setNewCategoryDescription] = useState("")
  const [newCategoryOrder, setNewCategoryOrder] = useState(0)
  const [newCategoryActive, setNewCategoryActive] = useState(true)

  // Product modal state
  const [showProductModal, setShowProductModal] = useState(false)
  const [newProductName, setNewProductName] = useState("")
  const [newProductDescription, setNewProductDescription] = useState("")
  const [newProductPrice, setNewProductPrice] = useState("")
  const [newProductCost, setNewProductCost] = useState("")
  const [newProductCategory, setNewProductCategory] = useState("")
  const [newProductActive, setNewProductActive] = useState(true)
  const [newProductImage, setNewProductImage] = useState<string | null>(null)
  const [newProductImageSize, setNewProductImageSize] = useState<number>(0)
  const [imageError, setImageError] = useState<string | null>(null)
  const [isProcessingImage, setIsProcessingImage] = useState(false)
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Delete confirmation state
  const [deleteModal, setDeleteModal] = useState<{
    type: "product" | "category"
    id: string
    name: string
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  // --- Image processing utilities ---
  const MAX_IMAGE_SIZE = 300 * 1024 // 300KB
  const MAX_DIMENSION = 800
  const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]

  const compressImage = useCallback(async (file: File): Promise<{ dataUrl: string; size: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
          // Calculate new dimensions
          let { width, height } = img
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
            width = Math.round(width * ratio)
            height = Math.round(height * ratio)
          }

          // Create canvas and draw resized image
          const canvas = document.createElement("canvas")
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            reject(new Error("Canvas context not available"))
            return
          }
          ctx.drawImage(img, 0, 0, width, height)

          // Try WEBP first, then JPEG with progressive quality reduction
          let quality = 0.85
          let dataUrl = canvas.toDataURL("image/webp", quality)
          let size = Math.round((dataUrl.length * 3) / 4) // Approximate base64 size

          // If WEBP is too large, reduce quality
          while (size > MAX_IMAGE_SIZE && quality > 0.3) {
            quality -= 0.1
            dataUrl = canvas.toDataURL("image/webp", quality)
            size = Math.round((dataUrl.length * 3) / 4)
          }

          // If still too large, try JPEG
          if (size > MAX_IMAGE_SIZE) {
            quality = 0.8
            dataUrl = canvas.toDataURL("image/jpeg", quality)
            size = Math.round((dataUrl.length * 3) / 4)

            while (size > MAX_IMAGE_SIZE && quality > 0.3) {
              quality -= 0.1
              dataUrl = canvas.toDataURL("image/jpeg", quality)
              size = Math.round((dataUrl.length * 3) / 4)
            }
          }

          resolve({ dataUrl, size })
        }
        img.onerror = () => reject(new Error("Erro ao carregar imagem"))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error("Erro ao ler arquivo"))
      reader.readAsDataURL(file)
    })
  }, [])

  const handleImageSelect = useCallback(async (file: File) => {
    setImageError(null)

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageError("Formato invalido. Use JPG, PNG ou WEBP.")
      return
    }

    // Validate initial size (warn if too large - 1.5MB max for processing)
    if (file.size > MAX_IMAGE_SIZE * 5) {
      setImageError("Imagem muito grande. Maximo recomendado: 1.5MB para processamento.")
      return
    }

    setIsProcessingImage(true)

    try {
      const { dataUrl, size } = await compressImage(file)

      if (size > MAX_IMAGE_SIZE) {
        setImageError(`A imagem deve ter no maximo 300KB. Tamanho atual: ${Math.round(size / 1024)}KB`)
        setIsProcessingImage(false)
        return
      }

      setNewProductImage(dataUrl)
      setNewProductImageSize(size)
    } catch {
      setImageError("Erro ao processar imagem. Tente novamente.")
    }

    setIsProcessingImage(false)
  }, [compressImage])

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingImage(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleImageSelect(file)
  }, [handleImageSelect])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImageSelect(file)
  }, [handleImageSelect])

  const removeImage = useCallback(() => {
    setNewProductImage(null)
    setNewProductImageSize(0)
    setImageError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  // --- Product CRUD ---
  const openProductModal = useCallback(() => {
    setNewProductName("")
    setNewProductDescription("")
    setNewProductPrice("")
    setNewProductCost("")
    setNewProductCategory(categories[0]?.id || "")
    setNewProductActive(true)
    setNewProductImage(null)
    setNewProductImageSize(0)
    setImageError(null)
    setShowProductModal(true)
  }, [categories])

  const createProduct = useCallback(() => {
    if (!newProductName.trim() || !newProductPrice) return

    const price = parseFloat(newProductPrice.replace(",", "."))
    const cost = parseFloat(newProductCost.replace(",", ".")) || 0

    if (isNaN(price) || price <= 0) return

    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      name: newProductName.trim(),
      description: newProductDescription.trim(),
      price,
      cost,
      category: newProductCategory || categories[0]?.id || "cat-1",
      active: newProductActive,
      salesCount: 0,
      order: products.filter((p) => p.category === newProductCategory).length,
      image: newProductImage,
      imageSize: newProductImageSize || undefined,
    }

    setProducts((prev) => [...prev, newProduct])
    setShowProductModal(false)
  }, [newProductName, newProductDescription, newProductPrice, newProductCost, newProductCategory, newProductActive, newProductImage, newProductImageSize, categories, products])

  // --- Category CRUD ---
  const openCategoryModal = useCallback(() => {
    setNewCategoryName("")
    setNewCategoryDescription("")
    setNewCategoryOrder(categories.length)
    setNewCategoryActive(true)
    setShowCategoryModal(true)
  }, [categories.length])

  const createCategory = useCallback(() => {
    if (!newCategoryName.trim()) return

    const newCategory: Category = {
      id: `cat-${Date.now()}`,
      name: newCategoryName.trim(),
      description: newCategoryDescription.trim() || undefined,
      order: newCategoryOrder,
      active: newCategoryActive,
    }

    setCategories((prev) => {
      // Adjust order if inserting in middle
      const adjusted = prev.map((c) =>
        c.order >= newCategoryOrder ? { ...c, order: c.order + 1 } : c
      )
      return [...adjusted, newCategory].sort((a, b) => a.order - b.order)
    })

    setShowCategoryModal(false)
  }, [newCategoryName, newCategoryDescription, newCategoryOrder, newCategoryActive])

  // --- Delete handlers ---
  const openDeleteModal = useCallback((type: "product" | "category", id: string, name: string) => {
    setDeleteModal({ type, id, name })
  }, [])

  const closeDeleteModal = useCallback(() => {
    setDeleteModal(null)
    setIsDeleting(false)
  }, [])

  const confirmDelete = useCallback(() => {
    if (!deleteModal) return

    setIsDeleting(true)

    if (deleteModal.type === "product") {
      // Delete product
      setProducts((prev) => prev.filter((p) => p.id !== deleteModal.id))
      toast({
        title: "Produto excluido",
        description: `"${deleteModal.name}" foi removido com sucesso.`,
      })
    } else {
      // Check if category has products
      const hasProducts = products.some((p) => p.category === deleteModal.id)
      if (hasProducts) {
        toast({
          title: "Nao foi possivel excluir",
          description: "Esta categoria possui produtos vinculados. Remova ou mova os produtos antes de excluir.",
          variant: "destructive",
        })
        setIsDeleting(false)
        setDeleteModal(null)
        return
      }

      // Delete category
      setCategories((prev) => prev.filter((c) => c.id !== deleteModal.id))
      toast({
        title: "Categoria excluida",
        description: `"${deleteModal.name}" foi removida com sucesso.`,
      })
    }

    setIsDeleting(false)
    setDeleteModal(null)
  }, [deleteModal, products, toast])

  const deleteProduct = useCallback((id: string) => {
    const product = products.find((p) => p.id === id)
    if (product) {
      openDeleteModal("product", id, product.name)
    }
  }, [products, openDeleteModal])

  const deleteCategory = useCallback((id: string) => {
    const category = categories.find((c) => c.id === id)
    if (category) {
      openDeleteModal("category", id, category.name)
    }
  }, [categories, openDeleteModal])

  // --- Product CRUD ---
  const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    )
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // --- Batch actions ---
  const batchActivate = useCallback(() => {
    setProducts((prev) =>
      prev.map((p) => (selectedProducts.has(p.id) ? { ...p, active: true } : p))
    )
    setSelectedProducts(new Set())
  }, [selectedProducts])

  const batchDeactivate = useCallback(() => {
    setProducts((prev) =>
      prev.map((p) => (selectedProducts.has(p.id) ? { ...p, active: false } : p))
    )
    setSelectedProducts(new Set())
  }, [selectedProducts])

  const batchCategoryChange = useCallback(
    (categoryId: string) => {
      setProducts((prev) =>
        prev.map((p) =>
          selectedProducts.has(p.id) ? { ...p, category: categoryId } : p
        )
      )
      setSelectedProducts(new Set())
    },
    [selectedProducts]
  )

  const batchPriceAdjust = useCallback(
    (percent: number) => {
      setProducts((prev) =>
        prev.map((p) => {
          if (!selectedProducts.has(p.id)) return p
          const factor = 1 + percent / 100
          return { ...p, price: Math.round(p.price * factor * 100) / 100 }
        })
      )
      setSelectedProducts(new Set())
    },
    [selectedProducts]
  )

  // --- Category drag-and-drop ---
  const handleCategoryDragStart = useCallback((categoryId: string) => {
    setDragCategoryId(categoryId)
    setDragProductId(null)
  }, [])

  const handleCategoryDragOver = useCallback(
    (e: React.DragEvent, categoryId: string) => {
      if (!dragCategoryId) return
      e.preventDefault()
      setDragOverCategoryId(categoryId)
    },
    [dragCategoryId]
  )

  const handleCategoryDrop = useCallback(
    (targetCategoryId: string) => {
      if (!dragCategoryId || dragCategoryId === targetCategoryId) {
        setDragCategoryId(null)
        setDragOverCategoryId(null)
        return
      }
      setCategories((prev) => {
        const arr = [...prev]
        const fromIdx = arr.findIndex((c) => c.id === dragCategoryId)
        const toIdx = arr.findIndex((c) => c.id === targetCategoryId)
        if (fromIdx === -1 || toIdx === -1) return prev
        const [moved] = arr.splice(fromIdx, 1)
        arr.splice(toIdx, 0, moved)
        return arr.map((c, i) => ({ ...c, order: i }))
      })
      setDragCategoryId(null)
      setDragOverCategoryId(null)
    },
    [dragCategoryId]
  )

  // --- Product drag-and-drop ---
  const handleProductDragStart = useCallback(
    (productId: string, categoryId: string) => {
      setDragProductId(productId)
      setDragProductSourceCat(categoryId)
      setDragCategoryId(null)
    },
    []
  )

  const handleProductDragOver = useCallback(
    (e: React.DragEvent, productId: string, _categoryId: string) => {
      if (!dragProductId) return
      e.preventDefault()
      dragOverProductId.current = productId
    },
    [dragProductId]
  )

  const handleProductDrop = useCallback(
    (targetCategoryId: string) => {
      if (!dragProductId) return

      const overId = dragOverProductId.current

      setProducts((prev) => {
        const arr = [...prev]
        const dragIdx = arr.findIndex((p) => p.id === dragProductId)
        if (dragIdx === -1) return prev

        // Update category if dropped in different category
        arr[dragIdx] = { ...arr[dragIdx], category: targetCategoryId }

        // Reorder within category
        if (overId && overId !== dragProductId) {
          const catProducts = arr
            .filter((p) => p.category === targetCategoryId)
            .sort((a, b) => a.order - b.order)
          const fromIdx = catProducts.findIndex((p) => p.id === dragProductId)
          const toIdx = catProducts.findIndex((p) => p.id === overId)
          if (fromIdx !== -1 && toIdx !== -1) {
            const [moved] = catProducts.splice(fromIdx, 1)
            catProducts.splice(toIdx, 0, moved)
            catProducts.forEach((p, i) => {
              const mainIdx = arr.findIndex((ap) => ap.id === p.id)
              if (mainIdx !== -1) arr[mainIdx] = { ...arr[mainIdx], order: i }
            })
          }
        }

        return arr
      })

      setDragProductId(null)
      setDragProductSourceCat(null)
      dragOverProductId.current = null
    },
    [dragProductId]
  )

  // --- Filtering & sorting ---
  const filteredSortedProducts = useMemo(() => {
    let result = [...products]

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      )
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter((p) => p.category === categoryFilter)
    }

    // Sort
    switch (sortBy) {
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
      case "price":
        result.sort((a, b) => b.price - a.price)
        break
      case "profit":
        result.sort((a, b) => getProfit(b.price, b.cost) - getProfit(a.price, a.cost))
        break
    }

    return result
  }, [products, search, categoryFilter, sortBy])

  // Group products by category
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  )

  // Count products per category
  const categoryProductCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const cat of categories) {
      counts[cat.id] = products.filter((p) => p.category === cat.id).length
    }
    return counts
  }, [categories, products])

  const getIndicator = useCallback(
    (product: Product) => getProductIndicator(product, products),
    [products]
  )

  // Stats
  const activeCount = products.filter((p) => p.active).length
  const totalProducts = products.length
  const avgMargin = useMemo(() => {
    const active = products.filter((p) => p.active && p.price > 0)
    if (active.length === 0) return 0
    const sum = active.reduce(
      (acc, p) => acc + ((p.price - p.cost) / p.price) * 100,
      0
    )
    return sum / active.length
  }, [products])

  return (
    <AdminLayout>
      <div className="min-h-screen">
        <div className="p-6">
          {/* Page header */}
          <div className="mb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight text-balance">
                  Produtos e Cardapio
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Gerencie seus produtos, precos e categorias do cardapio.
                </p>
              </div>
              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={openCategoryModal}
                  className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <FolderPlus className="h-4 w-4 text-muted-foreground" />
                  <span className="hidden sm:inline">Nova Categoria</span>
                </button>
                <button
                  onClick={openProductModal}
                  className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-colors hover:bg-[hsl(var(--primary))]/90"
                >
                  <Plus className="h-4 w-4" />
                  Novo Produto
                </button>
              </div>
            </div>
            {/* Quick stats */}
            <div className="mt-4 flex flex-wrap gap-4">
              <div className="rounded-lg border border-border bg-card px-4 py-2.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Total
                </span>
                <p className="text-lg font-bold text-foreground">{totalProducts}</p>
              </div>
              <div className="rounded-lg border border-border bg-card px-4 py-2.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Ativos
                </span>
                <p className="text-lg font-bold text-green-600">{activeCount}</p>
              </div>
              <div className="rounded-lg border border-border bg-card px-4 py-2.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Inativos
                </span>
                <p className="text-lg font-bold text-muted-foreground">
                  {totalProducts - activeCount}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card px-4 py-2.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Margem media
                </span>
                <p className="text-lg font-bold text-[hsl(var(--primary))]">
                  {avgMargin.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Category Sidebar / Filter Section */}
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                Categorias
              </h3>
              <span className="text-xs text-muted-foreground">{sortedCategories.length} categorias</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoryFilter("all")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  categoryFilter === "all"
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                <Package className="h-3.5 w-3.5" />
                Todas
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  categoryFilter === "all" ? "bg-white/20" : "bg-muted"
                )}>
                  {totalProducts}
                </span>
              </button>
              {sortedCategories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-1">
                <button
                  onClick={() => setCategoryFilter(cat.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    categoryFilter === cat.id
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                    !cat.active && "opacity-50"
                  )}
                >
                  {cat.name}
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    categoryFilter === cat.id ? "bg-white/20" : "bg-muted"
                  )}>
                    {categoryProductCounts[cat.id] || 0}
                  </span>
                  {!cat.active && (
                    <span className="rounded bg-muted px-1 text-[9px] font-medium text-muted-foreground">OFF</span>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteCategory(cat.id)
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600"
                  aria-label={`Excluir categoria ${cat.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              ))}
            </div>
          </div>

          {/* Toolbar */}
          <ProductsToolbar
            search={search}
            onSearchChange={setSearch}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            categories={sortedCategories}
            sortBy={sortBy}
            onSortChange={setSortBy}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            selectedCount={selectedProducts.size}
            onBatchActivate={batchActivate}
            onBatchDeactivate={batchDeactivate}
            onBatchCategoryChange={batchCategoryChange}
            onBatchPriceAdjust={batchPriceAdjust}
          />

          {/* Categories & products */}
          <div className="mt-6 flex flex-col gap-6">
            {sortedCategories
              .filter(
                (cat) =>
                  categoryFilter === "all" || categoryFilter === cat.id
              )
              .map((category) => {
                const catProducts = filteredSortedProducts
                  .filter((p) => p.category === category.id)
                  .sort((a, b) => {
                    // If default sort (name), also respect manual order
                    if (sortBy === "name") return a.order - b.order
                    return 0 // other sorts already applied
                  })

                // Hide empty categories when searching
                if (search.trim() && catProducts.length === 0) return null

                return (
                  <CategorySection
                    key={category.id}
                    categoryId={category.id}
                    categoryName={category.name}
                    products={catProducts}
                    allProducts={products}
                    viewMode={viewMode}
                    selectedProducts={selectedProducts}
                    onToggleSelect={toggleSelect}
                    onUpdateProduct={updateProduct}
                    onDeleteProduct={deleteProduct}
                    getIndicator={getIndicator}
                    onCategoryDragStart={handleCategoryDragStart}
                    onCategoryDragOver={handleCategoryDragOver}
                    onCategoryDrop={handleCategoryDrop}
                    onProductDragStart={handleProductDragStart}
                    onProductDragOver={handleProductDragOver}
                    onProductDrop={handleProductDrop}
                    isDragOverCategory={dragOverCategoryId === category.id}
                  />
                )
              })}
          </div>
        </div>

        {/* Category Creation Modal */}
        {showCategoryModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setShowCategoryModal(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10">
                    <FolderPlus className="h-5 w-5 text-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-card-foreground">Nova Categoria</h3>
                    <p className="text-xs text-muted-foreground">Crie uma nova categoria para seus produtos</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form */}
              <div className="px-6 py-5 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">
                    Nome da categoria <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Ex: Pratos Principais"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">
                    Descricao <span className="text-muted-foreground text-xs">(opcional)</span>
                  </label>
                  <textarea
                    value={newCategoryDescription}
                    onChange={(e) => setNewCategoryDescription(e.target.value)}
                    placeholder="Uma breve descricao da categoria..."
                    rows={2}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] resize-none"
                  />
                </div>

                {/* Order */}
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">
                    Ordem de exibicao
                  </label>
                  <select
                    value={newCategoryOrder}
                    onChange={(e) => setNewCategoryOrder(Number(e.target.value))}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                  >
                    {sortedCategories.map((cat, idx) => (
                      <option key={cat.id} value={idx}>
                        Antes de: {cat.name}
                      </option>
                    ))}
                    <option value={sortedCategories.length}>
                      Final da lista
                    </option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">
                    Status
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setNewCategoryActive(true)}
                      className={cn(
                        "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                        newCategoryActive
                          ? "border-green-300 bg-green-50 text-green-700"
                          : "border-input bg-background text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      Ativa
                    </button>
                    <button
                      onClick={() => setNewCategoryActive(false)}
                      className={cn(
                        "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                        !newCategoryActive
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-input bg-background text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      Inativa
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4 bg-muted/30">
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  onClick={createCategory}
                  disabled={!newCategoryName.trim()}
                  className={cn(
                    "rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors",
                    newCategoryName.trim()
                      ? "bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  Salvar Categoria
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Product Creation Modal */}
        {showProductModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
            onClick={() => setShowProductModal(false)}
          >
            <div
              className="w-full max-w-lg my-8 rounded-2xl bg-card border border-border shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10">
                    <Plus className="h-5 w-5 text-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-card-foreground">Novo Produto</h3>
                    <p className="text-xs text-muted-foreground">Adicione um produto ao seu cardapio</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form */}
              <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Imagem do Produto
                  </label>
                  
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {newProductImage ? (
                    // Image preview
                    <div className="relative rounded-xl border border-border overflow-hidden bg-muted/30">
                      <img
                        src={newProductImage}
                        alt="Preview"
                        className="w-full h-48 object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
                        <span className="text-xs text-white font-medium">
                          {Math.round(newProductImageSize / 1024)}KB
                        </span>
                        <button
                          onClick={removeImage}
                          className="flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Upload area
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingImage(true) }}
                      onDragLeave={() => setIsDraggingImage(false)}
                      onDrop={handleFileDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all",
                        isDraggingImage
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5"
                          : "border-border hover:border-[hsl(var(--primary))]/50 hover:bg-muted/30"
                      )}
                    >
                      {isProcessingImage ? (
                        <div className="text-center">
                          <Loader2 className="h-10 w-10 text-[hsl(var(--primary))] animate-spin mb-3 mx-auto" />
                          <p className="text-sm font-medium text-card-foreground">Processando imagem...</p>
                          <p className="text-xs text-muted-foreground mt-1">Otimizando e comprimindo para 300KB</p>
                          {/* Progress bar */}
                          <div className="mt-4 w-48 mx-auto">
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-[hsl(var(--primary))] rounded-full animate-pulse" style={{ width: "75%" }} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
                            <Upload className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-card-foreground">
                            Arraste uma imagem ou clique para selecionar
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            JPG, PNG ou WEBP - Maximo 300KB
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {/* Error message */}
                  {imageError && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                      <p className="text-xs text-red-600">{imageError}</p>
                    </div>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">
                    Nome do produto <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="Ex: X-Burger Especial"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">
                    Descricao
                  </label>
                  <textarea
                    value={newProductDescription}
                    onChange={(e) => setNewProductDescription(e.target.value)}
                    placeholder="Ingredientes e detalhes do produto..."
                    rows={2}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] resize-none"
                  />
                </div>

                {/* Price and Cost */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1.5">
                      Preco de venda <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                      <input
                        type="text"
                        value={newProductPrice}
                        onChange={(e) => setNewProductPrice(e.target.value.replace(/[^0-9,\.]/g, ""))}
                        placeholder="0,00"
                        className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1.5">
                      Custo
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                      <input
                        type="text"
                        value={newProductCost}
                        onChange={(e) => setNewProductCost(e.target.value.replace(/[^0-9,\.]/g, ""))}
                        placeholder="0,00"
                        className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                      />
                    </div>
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">
                    Categoria
                  </label>
                  <select
                    value={newProductCategory}
                    onChange={(e) => setNewProductCategory(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                  >
                    {sortedCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">
                    Status
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setNewProductActive(true)}
                      className={cn(
                        "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                        newProductActive
                          ? "border-green-300 bg-green-50 text-green-700"
                          : "border-input bg-background text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      Ativo
                    </button>
                    <button
                      onClick={() => setNewProductActive(false)}
                      className={cn(
                        "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                        !newProductActive
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-input bg-background text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      Inativo
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4 bg-muted/30">
                <button
                  onClick={() => setShowProductModal(false)}
                  className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  onClick={createProduct}
                  disabled={!newProductName.trim() || !newProductPrice || !!imageError}
                  className={cn(
                    "rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors",
                    newProductName.trim() && newProductPrice && !imageError
                      ? "bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  Salvar Produto
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={!!deleteModal}
          onClose={closeDeleteModal}
          onConfirm={confirmDelete}
          title={deleteModal?.type === "product" ? "Excluir produto" : "Excluir categoria"}
          message={
            deleteModal?.type === "product"
              ? `Tem certeza que deseja excluir "${deleteModal?.name}"? Essa acao nao pode ser desfeita.`
              : `Tem certeza que deseja excluir a categoria "${deleteModal?.name}"? Essa acao nao pode ser desfeita.`
          }
          confirmLabel="Confirmar exclusao"
          cancelLabel="Cancelar"
          variant="danger"
          isLoading={isDeleting}
        />
      </div>
    </AdminLayout>
  )
}
