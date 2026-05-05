"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  FolderPlus,
  ImageOff,
  Moon,
  Package,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react"
import AdminLayout from "@/components/admin-layout"
import CategorySection from "@/components/category-section"
import ConfirmationModal from "@/components/confirmation-modal"
import ProductEditorSheet, { type ProductEditorValues } from "@/components/product-editor-sheet"
import ProductsToolbar from "@/components/products-toolbar"
import { useToast } from "@/hooks/use-toast"
import {
  type Category,
  type Product,
  type ProductQuickFilter,
  type SortOption,
  type ViewMode,
  getMargin,
  getProductIndicator,
  getProfit,
  hasImage,
  hasLowMargin,
  hasLowSales,
  hasRegisteredCost,
} from "@/lib/products-data"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

type AvailabilityFilter = "all" | "active" | "inactive"

type ProductSheetState = {
  open: boolean
  mode: "create" | "edit"
  productId: string | null
  preferredCategoryId?: string
}

function normalizeProductOrders(list: Product[]): Product[] {
  const orderById = new Map<string, number>()
  const grouped = new Map<string, Product[]>()

  for (const product of list) {
    const categoryProducts = grouped.get(product.category) ?? []
    categoryProducts.push(product)
    grouped.set(product.category, categoryProducts)
  }

  for (const categoryProducts of grouped.values()) {
    [...categoryProducts]
      .sort((a, b) => a.order - b.order)
      .forEach((product, index) => {
        orderById.set(product.id, index)
      })
  }

  return list.map((product) => ({
    ...product,
    order: orderById.get(product.id) ?? product.order,
  }))
}

function sortProducts(list: Product[], sortBy: SortOption): Product[] {
  const sorted = [...list]

  switch (sortBy) {
    case "manual":
      sorted.sort((a, b) => a.order - b.order)
      break
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name))
      break
    case "price":
      sorted.sort((a, b) => b.price - a.price)
      break
    case "profit":
      sorted.sort((a, b) => getProfit(b.price, b.cost) - getProfit(a.price, a.cost))
      break
  }

  return sorted
}

function matchesQuickFilter(product: Product, filter: ProductQuickFilter): boolean {
  switch (filter) {
    case "low-margin":
      return hasLowMargin(product)
    case "low-sales":
      return hasLowSales(product)
    case "no-image":
      return !hasImage(product)
    case "no-cost":
      return !hasRegisteredCost(product)
  }
}

export default function ProdutosPage() {

  const supabase = useMemo(() => createClient(), [])
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all")
  const [quickFilters, setQuickFilters] = useState<Set<ProductQuickFilter>>(new Set())
  const [sortBy, setSortBy] = useState<SortOption>("manual")
  const [viewMode, setViewMode] = useState<ViewMode>("management")
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())

  const [dragCategoryId, setDragCategoryId] = useState<string | null>(null)
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null)
  const [dragProductId, setDragProductId] = useState<string | null>(null)
  const dragOverProductId = useRef<string | null>(null)

  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryDescription, setNewCategoryDescription] = useState("")
  const [newCategoryOrder, setNewCategoryOrder] = useState(0)
  const [newCategoryActive, setNewCategoryActive] = useState(true)

  

  const [productSheet, setProductSheet] = useState<ProductSheetState>({
    open: false,
    mode: "create",
    productId: null,
  })

  const [deleteModal, setDeleteModal] = useState<{
    type: "product" | "category"
    id: string
    name: string
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  const getAccessToken = useCallback(async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) throw error
  if (!session?.access_token) {
    throw new Error("Sessão inválida. Faça login novamente.")
  }

  return session.access_token
}, [supabase])

useEffect(() => {
  async function loadCatalog() {
    try {
      setLoadingData(true)

      const accessToken = await getAccessToken()

      const response = await fetch("/api/admin/catalog", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível carregar o catálogo.")
      }

      const dbCategories: Category[] = (result.categories ?? []).map((category: any) => ({
        id: category.id,
        name: category.name,
        description: undefined,
        order: category.sort_order ?? 0,
        active: category.is_active ?? true,
      }))

      const dbProducts: Product[] = (result.products ?? []).map((product: any) => ({
        id: product.id,
        name: product.name,
        description: product.description ?? "",
        price: Number(product.price ?? 0),
        cost: 0,
        category: product.category_id ?? "",
        active: product.is_available ?? true,
        salesCount: 0,
        order: product.sort_order ?? 0,
        image: product.image_url ?? null,
        imageSize: undefined,
      }))

      setRestaurantId(result.restaurantId ?? null)
      setCategories(dbCategories)
      setProducts(dbProducts)
    } catch (error) {
      console.error("Erro ao carregar catálogo:", error)
      toast({
        title: "Erro ao carregar dados",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar produtos e categorias.",
        variant: "destructive",
      })
    } finally {
      setLoadingData(false)
    }
  }

  loadCatalog()
}, [getAccessToken, toast])

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories]
  )

  const activeCount = useMemo(() => products.filter((product) => product.active).length, [products])
  const inactiveCount = products.length - activeCount

  const quickFilterCounts = useMemo(
    () => ({
      "low-margin": products.filter(hasLowMargin).length,
      "low-sales": products.filter(hasLowSales).length,
      "no-image": products.filter((product) => !hasImage(product)).length,
      "no-cost": products.filter((product) => !hasRegisteredCost(product)).length,
    }),
    [products]
  )

  const avgMargin = useMemo(() => {
    const activeProducts = products.filter((product) => product.active && product.price > 0)
    if (activeProducts.length === 0) return 0

    const totalMargin = activeProducts.reduce(
      (sum, product) => sum + getMargin(product.price, product.cost),
      0
    )

    return totalMargin / activeProducts.length
  }, [products])

  const categoryProductCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const category of categories) {
      counts[category.id] = products.filter((product) => product.category === category.id).length
    }
    return counts
  }, [categories, products])

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (search.trim()) {
        const query = search.toLowerCase()
        const matchesSearch =
          product.name.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query)

        if (!matchesSearch) return false
      }

      if (categoryFilter !== "all" && product.category !== categoryFilter) {
        return false
      }

      if (availabilityFilter === "active" && !product.active) {
        return false
      }

      if (availabilityFilter === "inactive" && product.active) {
        return false
      }

      for (const filter of quickFilters) {
        if (!matchesQuickFilter(product, filter)) {
          return false
        }
      }

      return true
    })
  }, [availabilityFilter, categoryFilter, products, quickFilters, search])

  const filteredProductsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>()

    for (const category of sortedCategories) {
      const categoryProducts = filteredProducts.filter((product) => product.category === category.id)
      map.set(category.id, sortProducts(categoryProducts, sortBy))
    }

    return map
  }, [filteredProducts, sortBy, sortedCategories])

  const filteredProductsCount = filteredProducts.length
  const hasFilteringState =
    search.trim().length > 0 || availabilityFilter !== "all" || quickFilters.size > 0
  const allowProductDrag =
    viewMode === "management" &&
    sortBy === "manual" &&
    !hasFilteringState

  const currentSheetProduct = useMemo(() => {
    if (!productSheet.productId) return null
    return products.find((product) => product.id === productSheet.productId) ?? null
  }, [productSheet.productId, products])

  const getIndicator = useCallback(
    (product: Product) => getProductIndicator(product, products),
    [products]
  )

  const clearQuickFilters = useCallback(() => {
    setQuickFilters(new Set())
  }, [])

  const toggleQuickFilter = useCallback((filter: ProductQuickFilter) => {
    setQuickFilters((prev) => {
      const next = new Set(prev)
      if (next.has(filter)) next.delete(filter)
      else next.add(filter)
      return next
    })
  }, [])

  const setKpiFilter = useCallback(
    (type: "all" | "active" | "inactive" | ProductQuickFilter) => {
      if (type === "all") {
        setAvailabilityFilter("all")
        setQuickFilters(new Set())
        return
      }

      if (type === "active" || type === "inactive") {
        setAvailabilityFilter((prev) => (prev === type ? "all" : type))
        return
      }

      toggleQuickFilter(type)
    },
    [toggleQuickFilter]
  )

  const openCategoryModal = useCallback(() => {
    setNewCategoryName("")
    setNewCategoryDescription("")
    setNewCategoryOrder(categories.length)
    setNewCategoryActive(true)
    setShowCategoryModal(true)
  }, [categories.length])

  const createCategory = useCallback(async () => {
  if (!newCategoryName.trim()) return

  try {
    setCreatingCategory(true)

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
    if (!restaurant) throw new Error("Restaurante não encontrado.")

    const { data, error } = await supabase
      .from("categories")
      .insert({
        restaurant_id: restaurant.id,
        name: newCategoryName.trim(),
        sort_order: newCategoryOrder,
        is_active: newCategoryActive,
      })
      .select("id, name, sort_order, is_active")
      .single()

    if (error) throw error

    const newCategory: Category = {
      id: data.id,
      name: data.name,
      description: newCategoryDescription.trim() || undefined,
      order: data.sort_order ?? 0,
      active: data.is_active ?? true,
    }

    setCategories((prev) => {
      const adjusted = prev.map((category) =>
        category.order >= newCategory.order
          ? { ...category, order: category.order + 1 }
          : category
      )

      return [...adjusted, newCategory].sort((a, b) => a.order - b.order)
    })

    setShowCategoryModal(false)

    toast({
      title: "Categoria criada",
      description: `"${newCategory.name}" foi criada com sucesso.`,
    })
  } catch (error) {
    console.error("Erro ao criar categoria:", error)
    toast({
      title: "Erro ao criar categoria",
      description:
        error instanceof Error ? error.message : "Não foi possível criar a categoria.",
      variant: "destructive",
    })
  } finally {
    setCreatingCategory(false)
  }
}, [
  supabase,
  newCategoryName,
  newCategoryDescription,
  newCategoryOrder,
  newCategoryActive,
  toast,
])

  const openCreateProductSheet = useCallback(
    (preferredCategoryId?: string) => {
      if (categories.length === 0) {
        toast({
          title: "Crie uma categoria primeiro",
          description: "Voce precisa criar pelo menos uma categoria antes de adicionar produtos.",
        })
        return
      }

      const defaultCategoryId =
        preferredCategoryId ??
        (categoryFilter !== "all" ? categoryFilter : undefined) ??
        categories[0]?.id

      setProductSheet({
        open: true,
        mode: "create",
        productId: null,
        preferredCategoryId: defaultCategoryId,
      })
    },
    [categories, categoryFilter, toast]
  )

  const openEditProductSheet = useCallback((id: string) => {
    setProductSheet({
      open: true,
      mode: "edit",
      productId: id,
    })
  }, [])

  const closeProductSheet = useCallback(() => {
    setProductSheet({
      open: false,
      mode: "create",
      productId: null,
    })
  }, [])

  const saveProduct = useCallback(
    async (values: ProductEditorValues) => {
      try {
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
        if (!restaurant) throw new Error("Restaurante não encontrado.")

        if (productSheet.mode === "edit" && productSheet.productId) {
          const editingProduct = products.find((product) => product.id === productSheet.productId)
          if (!editingProduct) return

          const targetOrder =
            editingProduct.category === values.category
              ? editingProduct.order
              : products.filter(
                  (product) =>
                    product.category === values.category &&
                    product.id !== editingProduct.id
                ).length

          const { data, error } = await supabase
            .from("products")
            .update({
              name: values.name,
              description: values.description || null,
              price: values.price,
              category_id: values.category,
              is_available: values.active,
              image_url: values.image || null,
              sort_order: targetOrder,
            })
            .eq("id", productSheet.productId)
            .eq("restaurant_id", restaurant.id)
            .select("id, name, description, price, image_url, is_available, sort_order, category_id")
            .single()

          if (error) throw error
          if (!data) throw new Error("Produto não encontrado para atualização.")

          const updatedProduct: Product = {
            id: data.id,
            name: data.name,
            description: data.description ?? "",
            price: Number(data.price ?? 0),
            cost: values.cost,
            category: data.category_id ?? "",
            active: data.is_available ?? true,
            salesCount: editingProduct.salesCount ?? 0,
            order: data.sort_order ?? 0,
            image: data.image_url ?? null,
            imageSize: values.imageSize,
          }

          setProducts((prev) =>
            normalizeProductOrders(
              prev.map((product) =>
                product.id === updatedProduct.id ? updatedProduct : product
              )
            )
          )

          toast({
            title: "Produto atualizado",
            description: `"${values.name}" foi atualizado com sucesso.`,
          })
        } else {
          const targetOrder = products.filter(
            (product) => product.category === values.category
          ).length

          const { data, error } = await supabase
            .from("products")
            .insert({
              restaurant_id: restaurant.id,
              category_id: values.category,
              name: values.name,
              description: values.description || null,
              price: values.price,
              image_url: values.image || null,
              is_available: values.active,
              sort_order: targetOrder,
            })
            .select("id, name, description, price, image_url, is_available, sort_order, category_id")
            .single()

          if (error) throw error
          if (!data) throw new Error("Erro ao criar produto.")

          const newProduct: Product = {
            id: data.id,
            name: data.name,
            description: data.description ?? "",
            price: Number(data.price ?? 0),
            cost: values.cost,
            category: data.category_id ?? "",
            active: data.is_available ?? true,
            salesCount: 0,
            order: data.sort_order ?? 0,
            image: data.image_url ?? null,
            imageSize: values.imageSize,
          }

          setProducts((prev) => normalizeProductOrders([...prev, newProduct]))

          toast({
            title: "Produto criado",
            description: `"${values.name}" foi adicionado ao catálogo.`,
          })
        }

        closeProductSheet()
      } catch (error) {
        console.error("Erro ao salvar produto:", error)
        toast({
          title: "Erro ao salvar produto",
          description:
            error instanceof Error ? error.message : "Não foi possível salvar o produto.",
          variant: "destructive",
        })
      }
    },
    [closeProductSheet, productSheet.mode, productSheet.productId, products, supabase, toast]
  )

  const openDeleteModal = useCallback((type: "product" | "category", id: string, name: string) => {
    setDeleteModal({ type, id, name })
  }, [])

  const closeDeleteModal = useCallback(() => {
    setDeleteModal(null)
    setIsDeleting(false)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!deleteModal) return

    try {
      setIsDeleting(true)

      const accessToken = await getAccessToken()

      if (deleteModal.type === "product") {
        const response = await fetch(`/api/admin/products/${deleteModal.id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Não foi possível excluir o produto.")
        }

        setProducts((prev) =>
          normalizeProductOrders(prev.filter((product) => product.id !== deleteModal.id))
        )

        setSelectedProducts((prev) => {
          const next = new Set(prev)
          next.delete(deleteModal.id)
          return next
        })

        if (productSheet.productId === deleteModal.id) {
          closeProductSheet()
        }

        toast({
          title: "Produto excluído",
          description: `"${deleteModal.name}" foi removido com sucesso.`,
        })
      } else {
        const response = await fetch(`/api/admin/categories/${deleteModal.id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Não foi possível excluir a categoria.")
        }

        setCategories((prev) => prev.filter((category) => category.id !== deleteModal.id))

        toast({
          title: "Categoria excluída",
          description: `"${deleteModal.name}" foi removida com sucesso.`,
        })
      }

      setDeleteModal(null)
    } catch (error) {
      console.error("Erro ao excluir:", error)
      toast({
        title: "Erro ao excluir",
        description:
          error instanceof Error ? error.message : "Não foi possível concluir a exclusão.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }, [closeProductSheet, deleteModal, getAccessToken, productSheet.productId, toast])

  const deleteProduct = useCallback(
    (id: string) => {
      const product = products.find((item) => item.id === id)
      if (product) openDeleteModal("product", id, product.name)
    },
    [openDeleteModal, products]
  )

  const deleteCategory = useCallback(
    (id: string) => {
      const category = categories.find((item) => item.id === id)
      if (category) openDeleteModal("category", id, category.name)
    },
    [categories, openDeleteModal]
  )

  const toggleSelect = useCallback((id: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

const toggleProductActive = useCallback(
  async (id: string) => {
    try {
      const accessToken = await getAccessToken()
      const currentProduct = products.find((product) => product.id === id)

      if (!currentProduct) return

      const response = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          is_available: !currentProduct.active,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível atualizar o status do produto.")
      }

      setProducts((prev) =>
        prev.map((product) =>
          product.id === id
            ? { ...product, active: result.product?.is_available ?? !product.active }
            : product
        )
      )

      toast({
        title: "Status atualizado",
        description: `O produto "${currentProduct.name}" foi ${
          result.product?.is_available ? "ativado" : "inativado"
        } com sucesso.`,
      })
    } catch (error) {
      console.error("Erro ao atualizar status:", error)
      toast({
        title: "Erro ao atualizar status",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o status do produto.",
        variant: "destructive",
      })
    }
  },
  [getAccessToken, products, toast]
)

  const batchActivate = useCallback(() => {
    setProducts((prev) =>
      prev.map((product) =>
        selectedProducts.has(product.id) ? { ...product, active: true } : product
      )
    )
    setSelectedProducts(new Set())
  }, [selectedProducts])

  const batchDeactivate = useCallback(() => {
    setProducts((prev) =>
      prev.map((product) =>
        selectedProducts.has(product.id) ? { ...product, active: false } : product
      )
    )
    setSelectedProducts(new Set())
  }, [selectedProducts])

  const batchCategoryChange = useCallback(
    (targetCategoryId: string) => {
      setProducts((prev) => {
        const moving = prev
          .filter((product) => selectedProducts.has(product.id))
          .sort((a, b) => a.order - b.order)

        const targetStart = prev.filter(
          (product) =>
            product.category === targetCategoryId && !selectedProducts.has(product.id)
        ).length

        const movingOrderById = new Map(
          moving.map((product, index) => [product.id, targetStart + index])
        )

        const updated = prev.map((product) =>
          selectedProducts.has(product.id)
            ? {
                ...product,
                category: targetCategoryId,
                order: movingOrderById.get(product.id) ?? product.order,
              }
            : product
        )

        return normalizeProductOrders(updated)
      })
      setSelectedProducts(new Set())
    },
    [selectedProducts]
  )

  const batchPriceAdjust = useCallback(
    (percent: number) => {
      setProducts((prev) =>
        prev.map((product) => {
          if (!selectedProducts.has(product.id)) return product
          const factor = 1 + percent / 100
          return {
            ...product,
            price: Math.round(product.price * factor * 100) / 100,
          }
        })
      )
      setSelectedProducts(new Set())
    },
    [selectedProducts]
  )

  const handleCategoryDragStart = useCallback((categoryId: string) => {
    setDragCategoryId(categoryId)
    setDragProductId(null)
  }, [])

  const handleCategoryDragOver = useCallback(
    (event: React.DragEvent, categoryId: string) => {
      if (!dragCategoryId) return
      event.preventDefault()
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
        const next = [...prev]
        const fromIndex = next.findIndex((category) => category.id === dragCategoryId)
        const toIndex = next.findIndex((category) => category.id === targetCategoryId)

        if (fromIndex === -1 || toIndex === -1) return prev

        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)

        return next.map((category, index) => ({ ...category, order: index }))
      })

      setDragCategoryId(null)
      setDragOverCategoryId(null)
    },
    [dragCategoryId]
  )

  const handleProductDragStart = useCallback((productId: string) => {
    setDragProductId(productId)
    setDragCategoryId(null)
  }, [])

  const handleProductDragOver = useCallback(
    (event: React.DragEvent, productId: string) => {
      if (!dragProductId) return
      event.preventDefault()
      dragOverProductId.current = productId
    },
    [dragProductId]
  )

  const handleProductDrop = useCallback(
    (targetCategoryId: string) => {
      if (!dragProductId) return

      const overId = dragOverProductId.current

      setProducts((prev) => {
        const next = [...prev]
        const dragIndex = next.findIndex((product) => product.id === dragProductId)
        if (dragIndex === -1) return prev

        next[dragIndex] = { ...next[dragIndex], category: targetCategoryId }

        if (overId && overId !== dragProductId) {
          const categoryProducts = next
            .filter((product) => product.category === targetCategoryId)
            .sort((a, b) => a.order - b.order)

          const fromIndex = categoryProducts.findIndex((product) => product.id === dragProductId)
          const toIndex = categoryProducts.findIndex((product) => product.id === overId)

          if (fromIndex !== -1 && toIndex !== -1) {
            const [moved] = categoryProducts.splice(fromIndex, 1)
            categoryProducts.splice(toIndex, 0, moved)

            categoryProducts.forEach((product, index) => {
              const productIndex = next.findIndex((item) => item.id === product.id)
              if (productIndex !== -1) {
                next[productIndex] = { ...next[productIndex], order: index }
              }
            })
          }
        } else {
          const targetCount = next.filter(
            (product) => product.category === targetCategoryId && product.id !== dragProductId
          ).length
          next[dragIndex] = { ...next[dragIndex], category: targetCategoryId, order: targetCount }
        }

        return normalizeProductOrders(next)
      })

      setDragProductId(null)
      dragOverProductId.current = null
    },
    [dragProductId]
  )

  const kpiCards = [
    {
      id: "all" as const,
      title: "Total",
      description: "Visao geral do catalogo",
      value: products.length,
      icon: Package,
      active: availabilityFilter === "all" && quickFilters.size === 0,
    },
    {
      id: "active" as const,
      title: "Ativos",
      description: "Itens prontos para venda",
      value: activeCount,
      icon: AlertCircle,
      active: availabilityFilter === "active",
    },
    {
      id: "inactive" as const,
      title: "Inativos",
      description: "Itens fora do cardapio",
      value: inactiveCount,
      icon: X,
      active: availabilityFilter === "inactive",
    },
    {
      id: "low-margin" as const,
      title: "Margem baixa",
      description: "Abaixo do alvo de 20%",
      value: quickFilterCounts["low-margin"],
      icon: AlertTriangle,
      active: quickFilters.has("low-margin"),
    },
    {
      id: "no-image" as const,
      title: "Sem foto",
      description: "Perdem destaque no cardapio",
      value: quickFilterCounts["no-image"],
      icon: ImageOff,
      active: quickFilters.has("no-image"),
    },
    {
      id: "low-sales" as const,
      title: "Baixa saida",
      description: "Menos de 5 vendas registradas",
      value: quickFilterCounts["low-sales"],
      icon: Moon,
      active: quickFilters.has("low-sales"),
    },
  ]

  if (loadingData) {
    return (
      <AdminLayout>
        <div className="min-h-screen p-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Carregando catálogo...
            </p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="min-h-screen">
        <div className="p-6">
          <div className="mb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-balance text-xl font-bold tracking-tight text-foreground">
                  Produtos e Cardapio
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Organize o catalogo, descubra gargalos e ajuste preco, status e imagem sem sair da tela.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={openCategoryModal}
                  className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <FolderPlus className="h-4 w-4 text-muted-foreground" />
                  <span className="hidden sm:inline">Nova Categoria</span>
                </button>

                <button
                  onClick={() => openCreateProductSheet()}
                  className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-colors hover:bg-[hsl(var(--primary))]/90"
                >
                  <Plus className="h-4 w-4" />
                  Novo Produto
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              {kpiCards.map((card) => {
                const Icon = card.icon

                return (
                  <button
                    key={card.id}
                    onClick={() => setKpiFilter(card.id)}
                    className={cn(
                      "rounded-2xl border px-4 py-4 text-left transition-all",
                      card.active
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/8 shadow-sm"
                        : "border-border bg-card hover:border-[hsl(var(--primary))]/30 hover:bg-card/80"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {card.title}
                        </p>
                        <p className="mt-2 text-2xl font-bold text-foreground">{card.value}</p>
                      </div>
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-2xl",
                          card.active
                            ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                            : "bg-secondary text-secondary-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      {card.description}
                    </p>
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-secondary px-3 py-1 font-medium">
                Margem media dos ativos: {avgMargin.toFixed(1)}%
              </span>
              {sortBy !== "manual" && viewMode === "management" && (
                <span className="rounded-full bg-secondary px-3 py-1 font-medium">
                  Troque para ordem manual para reorganizar por arraste.
                </span>
              )}
              {allowProductDrag && (
                <span className="rounded-full bg-secondary px-3 py-1 font-medium">
                  Arraste produtos entre categorias para ajustar a ordem manual.
                </span>
              )}
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Tag className="h-4 w-4 text-muted-foreground" />
                Categorias
              </h3>
              <span className="text-xs text-muted-foreground">
                {sortedCategories.length} categorias
              </span>
            </div>

            {sortedCategories.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">Nenhuma categoria criada ainda</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Crie sua primeira categoria para comecar a cadastrar produtos.
                </p>
              </div>
            ) : (
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
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      categoryFilter === "all" ? "bg-white/20" : "bg-muted"
                    )}
                  >
                    {products.length}
                  </span>
                </button>

                {sortedCategories.map((category) => (
                  <div key={category.id} className="flex items-center gap-1">
                    <button
                      onClick={() => setCategoryFilter(category.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        categoryFilter === category.id
                          ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                          : "bg-secondary text-muted-foreground hover:text-foreground",
                        !category.active && "opacity-50"
                      )}
                    >
                      {category.name}
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                          categoryFilter === category.id ? "bg-white/20" : "bg-muted"
                        )}
                      >
                        {categoryProductCounts[category.id] || 0}
                      </span>
                      {!category.active && (
                        <span className="rounded bg-muted px-1 text-[9px] font-medium text-muted-foreground">
                          OFF
                        </span>
                      )}
                    </button>

                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        deleteCategory(category.id)
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600"
                      aria-label={`Excluir categoria ${category.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
            visibleCount={filteredProductsCount}
            quickFilters={quickFilters}
            quickFilterCounts={quickFilterCounts}
            onToggleQuickFilter={toggleQuickFilter}
            onClearQuickFilters={clearQuickFilters}
            onBatchActivate={batchActivate}
            onBatchDeactivate={batchDeactivate}
            onBatchCategoryChange={batchCategoryChange}
            onBatchPriceAdjust={batchPriceAdjust}
          />

          <div className="mt-6 flex flex-col gap-6">
            {sortedCategories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
                <h2 className="text-lg font-semibold text-foreground">Nenhum produto cadastrado ainda</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Crie uma categoria e depois adicione seus produtos ao cardapio.
                </p>
              </div>
            ) : filteredProductsCount === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
                <h2 className="text-lg font-semibold text-foreground">Nenhum produto encontrado</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ajuste a busca ou limpe os filtros para voltar a visualizar o catalogo completo.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      setSearch("")
                      setAvailabilityFilter("all")
                      setQuickFilters(new Set())
                      setCategoryFilter("all")
                    }}
                    className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Limpar filtros
                  </button>
                  <button
                    onClick={() => openCreateProductSheet()}
                    className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90"
                  >
                    Novo Produto
                  </button>
                </div>
              </div>
            ) : (
              sortedCategories
                .filter((category) => categoryFilter === "all" || categoryFilter === category.id)
                .map((category) => {
                  const categoryProducts = filteredProductsByCategory.get(category.id) ?? []

                  if (hasFilteringState && categoryProducts.length === 0) {
                    return null
                  }

                  return (
                    <CategorySection
  key={category.id}
  categoryId={category.id}
  categoryName={category.name}
  products={categoryProducts}
  viewMode={viewMode}
  selectedProducts={selectedProducts}
  allowProductDrag={allowProductDrag}
  onToggleSelect={toggleSelect}
  onToggleProductActive={toggleProductActive}
  onEditProduct={openEditProductSheet}
  onDeleteProduct={deleteProduct}
  onEditCategory={(id) => {
    toast({
      title: "Editar categoria",
      description: "Agora vamos ligar a edição real da categoria.",
    })
  }}
  onDeleteCategory={deleteCategory}
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
                })
            )}
          </div>
        </div>

{showCategoryModal && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    onClick={() => setShowCategoryModal(false)}
  >
    <div
      className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10">
            <FolderPlus className="h-5 w-5 text-[hsl(var(--primary))]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-card-foreground">Nova Categoria</h3>
            <p className="text-xs text-muted-foreground">
              Crie uma nova categoria para seus produtos
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCategoryModal(false)}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4 px-6 py-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-card-foreground">
            Nome da categoria <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder="Ex: Pratos Principais"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-card-foreground">
            Descricao <span className="text-xs text-muted-foreground">(opcional)</span>
          </label>
          <textarea
            value={newCategoryDescription}
            onChange={(event) => setNewCategoryDescription(event.target.value)}
            placeholder="Uma breve descricao da categoria..."
            rows={2}
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-card-foreground">
            Ordem de exibicao
          </label>
          <select
            value={newCategoryOrder}
            onChange={(event) => setNewCategoryOrder(Number(event.target.value))}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
          >
            {sortedCategories.map((category, index) => (
              <option key={category.id} value={index}>
                Antes de: {category.name}
              </option>
            ))}
            <option value={sortedCategories.length}>Final da lista</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-card-foreground">
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

      <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/30 px-6 py-4">
        <button
          onClick={() => setShowCategoryModal(false)}
          className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
        >
          Cancelar
        </button>

        <button
          onClick={createCategory}
          disabled={!newCategoryName.trim() || creatingCategory}
          className={cn(
            "rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors",
            newCategoryName.trim() && !creatingCategory
              ? "bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          )}
        >
          {creatingCategory ? "Salvando..." : "Salvar Categoria"}
        </button>
      </div>
    </div>
  </div>
)}

        <ProductEditorSheet
          open={productSheet.open}
          mode={productSheet.mode}
          categories={sortedCategories}
          defaultCategoryId={productSheet.preferredCategoryId}
          product={currentSheetProduct}
          onOpenChange={(open) => {
            if (!open) closeProductSheet()
          }}
          onSave={saveProduct}
        />

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
