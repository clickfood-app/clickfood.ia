"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  DollarSign,
  Edit3,
  Eye,
  EyeOff,
  FolderPlus,
  ImageOff,
  Loader2,
  Package,
  Percent,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"

import AdminLayout from "@/components/admin-layout"
import ProductEditorSheet, {
  type ProductEditorValues,
} from "@/components/product-editor-sheet"
import { useToast } from "@/hooks/use-toast"
import {
  type Category,
  type Product,
  getMargin,
  getProfit,
  hasImage,
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

type CategoryModalState = {
  open: boolean
  mode: "create" | "edit"
  categoryId: string | null
}

type DbCategory = {
  id: string
  name: string
  sort_order: number | null
  is_active: boolean | null
}

type DbProduct = {
  id: string
  name: string
  description: string | null
  price: number | string | null
  cost_price: number | string | null
  category_id: string | null
  image_url: string | null
  is_available: boolean | null
  sort_order: number | null
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function normalizeProduct(product: DbProduct, salesCount = 0): Product {
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? "",
    price: Number(product.price ?? 0),
    cost: Number(product.cost_price ?? 0),
    category: product.category_id ?? "",
    active: product.is_available ?? true,
    salesCount,
    order: product.sort_order ?? 0,
    image: product.image_url ?? null,
    imageSize: undefined,
  }
}

function normalizeCategory(category: DbCategory): Category {
  return {
    id: category.id,
    name: category.name,
    description: undefined,
    order: category.sort_order ?? 0,
    active: category.is_active ?? true,
  }
}

function sortByOrder<T extends { order: number }>(items: T[]) {
  return [...items].sort((a, b) => a.order - b.order)
}

export default function ProdutosPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [availabilityFilter, setAvailabilityFilter] =
    useState<AvailabilityFilter>("all")

  const [productSheet, setProductSheet] = useState<ProductSheetState>({
    open: false,
    mode: "create",
    productId: null,
  })

  const [categoryModal, setCategoryModal] = useState<CategoryModalState>({
    open: false,
    mode: "create",
    categoryId: null,
  })

  const [categoryName, setCategoryName] = useState("")
  const [categoryActive, setCategoryActive] = useState(true)
  const [savingCategory, setSavingCategory] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingProductId, setSavingProductId] = useState<string | null>(null)

  const sortedCategories = useMemo(() => sortByOrder(categories), [categories])

  const currentSheetProduct = useMemo(() => {
    if (!productSheet.productId) return null

    return products.find((product) => product.id === productSheet.productId) ?? null
  }, [productSheet.productId, products])

  const activeProducts = useMemo(
    () => products.filter((product) => product.active),
    [products]
  )

  const inactiveProducts = useMemo(
    () => products.filter((product) => !product.active),
    [products]
  )

  const noImageProducts = useMemo(
    () => products.filter((product) => !hasImage(product)),
    [products]
  )

  const noCostProducts = useMemo(
    () => products.filter((product) => !hasRegisteredCost(product)),
    [products]
  )

  const averageMargin = useMemo(() => {
    const validProducts = products.filter((product) => product.price > 0)

    if (validProducts.length === 0) return 0

    const marginSum = validProducts.reduce(
      (sum, product) => sum + getMargin(product.price, product.cost),
      0
    )

    return marginSum / validProducts.length
  }, [products])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()

    return products.filter((product) => {
      if (query) {
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

      return true
    })
  }, [availabilityFilter, categoryFilter, products, search])

  const productsByCategory = useMemo(() => {
    const grouped = new Map<string, Product[]>()

    for (const category of sortedCategories) {
      grouped.set(
        category.id,
        filteredProducts
          .filter((product) => product.category === category.id)
          .sort((a, b) => a.order - b.order)
      )
    }

    return grouped
  }, [filteredProducts, sortedCategories])

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

  const resolveRestaurantId = useCallback(async () => {
    if (restaurantId) return restaurantId

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

    setRestaurantId(restaurant.id)

    return restaurant.id
  }, [restaurantId, supabase])

  const loadCatalog = useCallback(async () => {
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

      const dbCategories: Category[] = (result.categories ?? []).map(
        (category: DbCategory) => normalizeCategory(category)
      )

      const dbProducts: Product[] = (result.products ?? []).map(
        (product: DbProduct) => normalizeProduct(product)
      )

      setRestaurantId(result.restaurantId ?? null)
      setCategories(sortByOrder(dbCategories))
      setProducts(sortByOrder(dbProducts))
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
  }, [getAccessToken, toast])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  const openCreateProductSheet = useCallback(
    (preferredCategoryId?: string) => {
      if (categories.length === 0) {
        toast({
          title: "Crie uma categoria primeiro",
          description:
            "Você precisa criar pelo menos uma categoria antes de adicionar produtos.",
        })
        return
      }

      setProductSheet({
        open: true,
        mode: "create",
        productId: null,
        preferredCategoryId:
          preferredCategoryId ??
          (categoryFilter !== "all" ? categoryFilter : undefined) ??
          categories[0]?.id,
      })
    },
    [categories, categoryFilter, toast]
  )

  const openEditProductSheet = useCallback((productId: string) => {
    setProductSheet({
      open: true,
      mode: "edit",
      productId,
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
        const resolvedRestaurantId = await resolveRestaurantId()

        if (productSheet.mode === "edit" && productSheet.productId) {
          const editingProduct = products.find(
            (product) => product.id === productSheet.productId
          )

          if (!editingProduct) return

          setSavingProductId(editingProduct.id)

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
              cost_price: values.cost,
              category_id: values.category,
              is_available: values.active,
              image_url: values.image || null,
              sort_order: targetOrder,
            })
            .eq("id", productSheet.productId)
            .eq("restaurant_id", resolvedRestaurantId)
            .select(
              "id, name, description, price, cost_price, image_url, is_available, sort_order, category_id"
            )
            .single()

          if (error) throw error
          if (!data) throw new Error("Produto não encontrado para atualização.")

          const updatedProduct: Product = {
            ...normalizeProduct(data as DbProduct, editingProduct.salesCount ?? 0),
            imageSize: values.imageSize,
          }

          setProducts((prev) =>
            sortByOrder(
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
          const resolvedCategoryId = values.category

          setSavingProductId("new")

          const targetOrder = products.filter(
            (product) => product.category === resolvedCategoryId
          ).length

          const { data, error } = await supabase
            .from("products")
            .insert({
              restaurant_id: resolvedRestaurantId,
              category_id: resolvedCategoryId,
              name: values.name,
              description: values.description || null,
              price: values.price,
              cost_price: values.cost,
              image_url: values.image || null,
              is_available: values.active,
              sort_order: targetOrder,
            })
            .select(
              "id, name, description, price, cost_price, image_url, is_available, sort_order, category_id"
            )
            .single()

          if (error) throw error
          if (!data) throw new Error("Erro ao criar produto.")

          const newProduct: Product = {
            ...normalizeProduct(data as DbProduct, 0),
            imageSize: values.imageSize,
          }

          setProducts((prev) => sortByOrder([...prev, newProduct]))

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
            error instanceof Error
              ? error.message
              : "Não foi possível salvar o produto.",
          variant: "destructive",
        })
      } finally {
        setSavingProductId(null)
      }
    },
    [
      closeProductSheet,
      productSheet.mode,
      productSheet.productId,
      products,
      resolveRestaurantId,
      supabase,
      toast,
    ]
  )

  const toggleProductActive = useCallback(
    async (productId: string) => {
      const product = products.find((item) => item.id === productId)

      if (!product) return

      try {
        const resolvedRestaurantId = await resolveRestaurantId()
        setSavingProductId(productId)

        const nextActive = !product.active

        const { data, error } = await supabase
          .from("products")
          .update({
            is_available: nextActive,
          })
          .eq("id", productId)
          .eq("restaurant_id", resolvedRestaurantId)
          .select(
            "id, name, description, price, cost_price, image_url, is_available, sort_order, category_id"
          )
          .single()

        if (error) throw error
        if (!data) throw new Error("Produto não encontrado.")

        setProducts((prev) =>
          prev.map((item) =>
            item.id === productId
              ? {
                  ...item,
                  active: data.is_available ?? nextActive,
                }
              : item
          )
        )

        toast({
          title: nextActive ? "Produto ativado" : "Produto inativado",
          description: `"${product.name}" foi atualizado.`,
        })
      } catch (error) {
        console.error("Erro ao alterar status:", error)

        toast({
          title: "Erro ao alterar status",
          description:
            error instanceof Error
              ? error.message
              : "Não foi possível alterar o status do produto.",
          variant: "destructive",
        })
      } finally {
        setSavingProductId(null)
      }
    },
    [products, resolveRestaurantId, supabase, toast]
  )

  const deleteProduct = useCallback(
    async (productId: string) => {
      const product = products.find((item) => item.id === productId)

      if (!product) return

      const confirmed = window.confirm(
        `Tem certeza que deseja excluir "${product.name}"? Essa ação não pode ser desfeita.`
      )

      if (!confirmed) return

      try {
        const resolvedRestaurantId = await resolveRestaurantId()
        setDeletingId(productId)

        const { error } = await supabase
          .from("products")
          .delete()
          .eq("id", productId)
          .eq("restaurant_id", resolvedRestaurantId)

        if (error) throw error

        setProducts((prev) => prev.filter((item) => item.id !== productId))

        toast({
          title: "Produto excluído",
          description: `"${product.name}" foi removido.`,
        })
      } catch (error) {
        console.error("Erro ao excluir produto:", error)

        toast({
          title: "Erro ao excluir produto",
          description:
            error instanceof Error
              ? error.message
              : "Não foi possível excluir o produto.",
          variant: "destructive",
        })
      } finally {
        setDeletingId(null)
      }
    },
    [products, resolveRestaurantId, supabase, toast]
  )

  const openCreateCategoryModal = useCallback(() => {
    setCategoryModal({
      open: true,
      mode: "create",
      categoryId: null,
    })
    setCategoryName("")
    setCategoryActive(true)
  }, [])

  const openEditCategoryModal = useCallback((category: Category) => {
    setCategoryModal({
      open: true,
      mode: "edit",
      categoryId: category.id,
    })
    setCategoryName(category.name)
    setCategoryActive(category.active)
  }, [])

  const closeCategoryModal = useCallback(() => {
    setCategoryModal({
      open: false,
      mode: "create",
      categoryId: null,
    })
    setCategoryName("")
    setCategoryActive(true)
  }, [])

  const saveCategory = useCallback(async () => {
    if (!categoryName.trim()) return

    try {
      const resolvedRestaurantId = await resolveRestaurantId()
      setSavingCategory(true)

      if (categoryModal.mode === "edit" && categoryModal.categoryId) {
        const { data, error } = await supabase
          .from("categories")
          .update({
            name: categoryName.trim(),
            is_active: categoryActive,
          })
          .eq("id", categoryModal.categoryId)
          .eq("restaurant_id", resolvedRestaurantId)
          .select("id, name, sort_order, is_active")
          .single()

        if (error) throw error
        if (!data) throw new Error("Categoria não encontrada.")

        const updatedCategory = normalizeCategory(data as DbCategory)

        setCategories((prev) =>
          sortByOrder(
            prev.map((category) =>
              category.id === updatedCategory.id ? updatedCategory : category
            )
          )
        )

        toast({
          title: "Categoria atualizada",
          description: `"${updatedCategory.name}" foi atualizada.`,
        })
      } else {
        const targetOrder = categories.length

        const { data, error } = await supabase
          .from("categories")
          .insert({
            restaurant_id: resolvedRestaurantId,
            name: categoryName.trim(),
            sort_order: targetOrder,
            is_active: categoryActive,
          })
          .select("id, name, sort_order, is_active")
          .single()

        if (error) throw error
        if (!data) throw new Error("Erro ao criar categoria.")

        const newCategory = normalizeCategory(data as DbCategory)

        setCategories((prev) => sortByOrder([...prev, newCategory]))

        toast({
          title: "Categoria criada",
          description: `"${newCategory.name}" foi criada.`,
        })
      }

      closeCategoryModal()
    } catch (error) {
      console.error("Erro ao salvar categoria:", error)

      toast({
        title: "Erro ao salvar categoria",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a categoria.",
        variant: "destructive",
      })
    } finally {
      setSavingCategory(false)
    }
  }, [
    categories.length,
    categoryActive,
    categoryModal.categoryId,
    categoryModal.mode,
    categoryName,
    closeCategoryModal,
    resolveRestaurantId,
    supabase,
    toast,
  ])

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      const category = categories.find((item) => item.id === categoryId)

      if (!category) return

      const productsInCategory = products.filter(
        (product) => product.category === categoryId
      )

      if (productsInCategory.length > 0) {
        toast({
          title: "Categoria possui produtos",
          description:
            "Mova ou exclua os produtos dessa categoria antes de apagar.",
          variant: "destructive",
        })
        return
      }

      const confirmed = window.confirm(
        `Tem certeza que deseja excluir a categoria "${category.name}"?`
      )

      if (!confirmed) return

      try {
        const resolvedRestaurantId = await resolveRestaurantId()
        setDeletingId(categoryId)

        const { error } = await supabase
          .from("categories")
          .delete()
          .eq("id", categoryId)
          .eq("restaurant_id", resolvedRestaurantId)

        if (error) throw error

        setCategories((prev) => prev.filter((item) => item.id !== categoryId))

        toast({
          title: "Categoria excluída",
          description: `"${category.name}" foi removida.`,
        })
      } catch (error) {
        console.error("Erro ao excluir categoria:", error)

        toast({
          title: "Erro ao excluir categoria",
          description:
            error instanceof Error
              ? error.message
              : "Não foi possível excluir a categoria.",
          variant: "destructive",
        })
      } finally {
        setDeletingId(null)
      }
    },
    [categories, products, resolveRestaurantId, supabase, toast]
  )

  if (loadingData) {
    return (
      <AdminLayout title="Produtos">
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-white">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando catálogo...
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Produtos">
      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-950">
                Produtos e Cardápio
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Edite produtos, categorias, preço, custo, lucro e status do cardápio.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openCreateCategoryModal}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <FolderPlus className="h-4 w-4" />
                Nova categoria
              </button>

              <button
                type="button"
                onClick={() => openCreateProductSheet()}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Novo produto
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Total
                </p>
                <Package className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {products.length}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                  Ativos
                </p>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-900">
                {activeProducts.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Inativos
                </p>
                <EyeOff className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {inactiveProducts.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Sem foto
                </p>
                <ImageOff className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {noImageProducts.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Sem custo
                </p>
                <DollarSign className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {noCostProducts.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Margem média
                </p>
                <Percent className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {averageMargin.toFixed(1)}%
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar produto por nome ou descrição..."
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="all">Todas categorias</option>
              {sortedCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={availabilityFilter}
              onChange={(event) =>
                setAvailabilityFilter(event.target.value as AvailabilityFilter)
              }
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="all">Todos status</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-950">
                Categorias
              </h2>
              <p className="text-sm text-slate-500">
                Edite o nome, ative ou inative categorias do cardápio.
              </p>
            </div>

            <p className="text-sm font-semibold text-slate-500">
              {sortedCategories.length} categoria(s)
            </p>
          </div>

          {sortedCategories.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-sm font-bold text-slate-700">
                Nenhuma categoria cadastrada
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Crie uma categoria para começar a adicionar produtos.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold transition",
                  categoryFilter === "all"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
              >
                Todas
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  {products.length}
                </span>
              </button>

              {sortedCategories.map((category) => {
                const count = products.filter(
                  (product) => product.category === category.id
                ).length

                return (
                  <div
                    key={category.id}
                    className={cn(
                      "inline-flex h-10 items-center overflow-hidden rounded-lg border",
                      categoryFilter === category.id
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setCategoryFilter(category.id)}
                      className="flex h-full items-center gap-2 px-3 text-sm font-bold"
                    >
                      {category.name}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          categoryFilter === category.id
                            ? "bg-white/20"
                            : "bg-slate-100 text-slate-500"
                        )}
                      >
                        {count}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditCategoryModal(category)}
                      className={cn(
                        "flex h-full w-9 items-center justify-center border-l transition",
                        categoryFilter === category.id
                          ? "border-white/20 hover:bg-white/10"
                          : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => void deleteCategory(category.id)}
                      disabled={deletingId === category.id}
                      className={cn(
                        "flex h-full w-9 items-center justify-center border-l transition disabled:opacity-50",
                        categoryFilter === category.id
                          ? "border-white/20 hover:bg-white/10"
                          : "border-slate-200 hover:bg-red-50 hover:text-red-600"
                      )}
                    >
                      {deletingId === category.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="space-y-4">
          {sortedCategories.map((category) => {
            const categoryProducts = productsByCategory.get(category.id) ?? []

            if (categoryFilter !== "all" && categoryFilter !== category.id) {
              return null
            }

            if (categoryProducts.length === 0 && search.trim()) {
              return null
            }

            return (
              <div
                key={category.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black uppercase tracking-wide text-slate-950">
                        {category.name}
                      </h3>

                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">
                        {categoryProducts.length}
                      </span>

                      {!category.active && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                          Inativa
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      Produtos, preço, custo, lucro e margem.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openCreateProductSheet(category.id)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                  >
                    <Plus className="h-4 w-4" />
                    Produto nessa categoria
                  </button>
                </div>

                {categoryProducts.length === 0 ? (
                  <div className="p-4">
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                      <p className="text-sm font-bold text-slate-700">
                        Nenhum produto nessa categoria
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Adicione produtos para montar o cardápio.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {categoryProducts.map((product) => {
                      const profit = getProfit(product.price, product.cost)
                      const margin = getMargin(product.price, product.cost)
                      const isSaving = savingProductId === product.id
                      const isDeleting = deletingId === product.id

                      return (
                        <div
                          key={product.id}
                          className="grid gap-4 px-4 py-4 transition hover:bg-slate-50/70 xl:grid-cols-[minmax(0,1.5fr)_120px_120px_120px_100px_150px_150px]"
                        >
                          <div className="flex min-w-0 gap-3">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                              {product.image ? (
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <ImageOff className="h-5 w-5 text-slate-400" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-black text-slate-950">
                                  {product.name}
                                </p>

                                {!product.active && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                                    Inativo
                                  </span>
                                )}

                                {!hasRegisteredCost(product) && (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                                    Sem custo
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                                {product.description || "Sem descrição cadastrada."}
                              </p>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                              Preço
                            </p>
                            <p className="mt-1 text-sm font-black text-slate-950">
                              {formatCurrency(product.price)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                              Custo
                            </p>
                            <p className="mt-1 text-sm font-black text-slate-950">
                              {formatCurrency(product.cost)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                              Lucro
                            </p>
                            <p
                              className={cn(
                                "mt-1 text-sm font-black",
                                profit >= 0 ? "text-emerald-600" : "text-red-600"
                              )}
                            >
                              {formatCurrency(profit)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                              Margem
                            </p>
                            <p
                              className={cn(
                                "mt-1 text-sm font-black",
                                margin >= 20 ? "text-emerald-600" : "text-amber-600"
                              )}
                            >
                              {margin.toFixed(1)}%
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                              Status
                            </p>
                            <button
                              type="button"
                              onClick={() => void toggleProductActive(product.id)}
                              disabled={isSaving}
                              className={cn(
                                "mt-1 inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-bold transition disabled:opacity-50",
                                product.active
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                              )}
                            >
                              {isSaving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : product.active ? (
                                <Eye className="h-3.5 w-3.5" />
                              ) : (
                                <EyeOff className="h-3.5 w-3.5" />
                              )}
                              {product.active ? "Ativo" : "Inativo"}
                            </button>
                          </div>

                          <div className="flex items-center gap-2 xl:justify-end">
                            <button
                              type="button"
                              onClick={() => openEditProductSheet(product.id)}
                              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                            >
                              <Edit3 className="h-4 w-4" />
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => void deleteProduct(product.id)}
                              disabled={isDeleting}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                            >
                              {isDeleting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {filteredProducts.length === 0 && products.length > 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <p className="text-sm font-bold text-slate-700">
                Nenhum produto encontrado
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Ajuste a busca ou os filtros para ver os produtos.
              </p>
            </div>
          )}
        </section>

        {categoryModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-black text-slate-950">
                    {categoryModal.mode === "create"
                      ? "Nova categoria"
                      : "Editar categoria"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Organize os produtos do cardápio.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeCategoryModal}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 px-5 py-4">
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-700">
                    Nome da categoria
                  </label>
                  <input
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    placeholder="Ex: Lanches"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-700">
                    Status
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCategoryActive(true)}
                      className={cn(
                        "h-10 rounded-lg border text-sm font-bold transition",
                        categoryActive
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      Ativa
                    </button>

                    <button
                      type="button"
                      onClick={() => setCategoryActive(false)}
                      className={cn(
                        "h-10 rounded-lg border text-sm font-bold transition",
                        !categoryActive
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      Inativa
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
                <button
                  type="button"
                  onClick={closeCategoryModal}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => void saveCategory()}
                  disabled={!categoryName.trim() || savingCategory}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingCategory && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Salvar
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
      </div>
    </AdminLayout>
  )
}