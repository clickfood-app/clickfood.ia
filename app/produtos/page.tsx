"use client"

import {
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  DollarSign,
  Edit3,
  Eye,
  EyeOff,
  FolderPlus,
  GripVertical,
  ImageOff,
  Loader2,
  Package,
  Percent,
  Plus,
  Search,
  SlidersHorizontal,
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
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type AvailabilityFilter = "all" | "active" | "inactive"
type PromotionType = "none" | "fixed" | "percentage"
type AvailabilityType = "always" | "scheduled"

type CatalogProduct = Product & {
  promotionActive: boolean
  promotionType: PromotionType
  promotionValue: number
  availabilityType: AvailabilityType
  availabilityWeekdays: number[]
  availabilityStartTime: string | null
  availabilityEndTime: string | null
  availabilityCategory: string | null
}

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
  promotion_active: boolean | null
  promotion_type: string | null
  promotion_value: number | string | null
  availability_type: string | null
}

type DbProductAvailabilityRule = {
  id: string
  product_id: string
  display_category_id: string | null
  weekdays: number[] | null
  start_time: string | null
  end_time: string | null
  is_active: boolean | null
}

const PRODUCT_SELECT =
  "id, name, description, price, cost_price, image_url, is_available, sort_order, category_id, promotion_active, promotion_type, promotion_value, availability_type"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0))
}

function getNormalizedPromotionType(value: string | null | undefined): PromotionType {
  if (value === "fixed" || value === "percentage") return value

  return "none"
}

function getPromotionDiscount(product: CatalogProduct) {
  if (!product.promotionActive || product.promotionType === "none") return 0

  if (product.promotionType === "percentage") {
    return Math.min(product.price, product.price * (product.promotionValue / 100))
  }

  return Math.min(product.price, product.promotionValue)
}

function getPromotionalPrice(product: CatalogProduct) {
  return Math.max(product.price - getPromotionDiscount(product), 0)
}

function getNormalizedAvailabilityType(
  value: string | null | undefined
): AvailabilityType {
  return value === "scheduled" ? "scheduled" : "always"
}

function normalizeAvailabilityTime(value: string | null | undefined) {
  if (!value) return null

  return value.slice(0, 5)
}

function normalizeProduct(
  product: DbProduct,
  salesCount = 0,
  availabilityRule?: DbProductAvailabilityRule | null
): CatalogProduct {
  const promotionType = getNormalizedPromotionType(product.promotion_type)
  const promotionValue = Number(product.promotion_value ?? 0)
  const promotionActive =
    Boolean(product.promotion_active) &&
    promotionType !== "none" &&
    promotionValue > 0
  const activeAvailabilityRule =
    availabilityRule?.is_active === true ? availabilityRule : null

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
    promotionActive,
    promotionType: promotionActive ? promotionType : "none",
    promotionValue: promotionActive ? promotionValue : 0,
    availabilityType: activeAvailabilityRule
      ? "scheduled"
      : getNormalizedAvailabilityType(product.availability_type),
    availabilityWeekdays: activeAvailabilityRule?.weekdays ?? [],
    availabilityStartTime: normalizeAvailabilityTime(
      activeAvailabilityRule?.start_time
    ),
    availabilityEndTime: normalizeAvailabilityTime(activeAvailabilityRule?.end_time),
    availabilityCategory: activeAvailabilityRule?.display_category_id ?? null,
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

function getProductFinalPrice(product: CatalogProduct) {
  return product.promotionActive ? getPromotionalPrice(product) : product.price
}

function getProductStatusLabel(product: CatalogProduct) {
  if (!product.active) return "Inativo"
  if (product.availabilityType === "scheduled") return "Programado"

  return "Ativo"
}

export default function ProdutosPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  const [products, setProducts] = useState<CatalogProduct[]>([])
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

  const [categoryOrderModalOpen, setCategoryOrderModalOpen] = useState(false)
  const [categoryOrderDraft, setCategoryOrderDraft] = useState<Category[]>([])
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null)
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([])

  const [categoryName, setCategoryName] = useState("")
  const [categoryActive, setCategoryActive] = useState(true)
  const [savingCategory, setSavingCategory] = useState(false)
  const [savingCategoryOrder, setSavingCategoryOrder] = useState(false)
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
    const grouped = new Map<string, CatalogProduct[]>()

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

  const visibleCategories = useMemo(() => {
    if (categoryFilter !== "all") {
      return sortedCategories.filter((category) => category.id === categoryFilter)
    }

    const hasActiveSearchOrStatusFilter =
      search.trim().length > 0 || availabilityFilter !== "all"

    if (!hasActiveSearchOrStatusFilter) return sortedCategories

    return sortedCategories.filter(
      (category) => (productsByCategory.get(category.id)?.length ?? 0) > 0
    )
  }, [availabilityFilter, categoryFilter, productsByCategory, search, sortedCategories])

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

      const rawProducts = (result.products ?? []) as DbProduct[]
      const productIds = rawProducts.map((product) => product.id)
      const availabilityRulesByProductId = new Map<
        string,
        DbProductAvailabilityRule
      >()

      if (result.restaurantId && productIds.length > 0) {
        const { data: availabilityRules, error: availabilityRulesError } =
          await supabase
            .from("product_availability_rules")
            .select(
              "id, product_id, display_category_id, weekdays, start_time, end_time, is_active"
            )
            .eq("restaurant_id", result.restaurantId)
            .eq("is_active", true)
            .in("product_id", productIds)

        if (availabilityRulesError) throw availabilityRulesError

        ;((availabilityRules ?? []) as DbProductAvailabilityRule[]).forEach(
          (rule) => {
            if (!availabilityRulesByProductId.has(rule.product_id)) {
              availabilityRulesByProductId.set(rule.product_id, rule)
            }
          }
        )
      }

      const dbProducts: CatalogProduct[] = rawProducts.map((product) =>
        normalizeProduct(product, 0, availabilityRulesByProductId.get(product.id))
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
  }, [getAccessToken, supabase, toast])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    setExpandedCategoryIds((prev) => {
      const validCategoryIds = new Set(sortedCategories.map((category) => category.id))
      const keptCategoryIds = prev.filter((categoryId) =>
        validCategoryIds.has(categoryId)
      )

      if (keptCategoryIds.length > 0) return keptCategoryIds

      const firstCategoryId = sortedCategories[0]?.id

      return firstCategoryId ? [firstCategoryId] : []
    })
  }, [sortedCategories])

  const toggleCategoryExpanded = useCallback((categoryId: string) => {
    setExpandedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((currentCategoryId) => currentCategoryId !== categoryId)
        : [...prev, categoryId]
    )
  }, [])

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
        const promotionActive =
          values.promotionActive &&
          values.promotionType !== "none" &&
          values.promotionValue > 0
        const promotionType: PromotionType = promotionActive
          ? values.promotionType
          : "none"
        const promotionValue = promotionActive ? values.promotionValue : 0
        const availabilityType: AvailabilityType = values.availabilityType
        const normalizedAvailabilityWeekdays =
          availabilityType === "scheduled" ? values.availabilityWeekdays : []
        const normalizedAvailabilityStartTime =
          availabilityType === "scheduled" ? values.availabilityStartTime : null
        const normalizedAvailabilityEndTime =
          availabilityType === "scheduled" ? values.availabilityEndTime : null
        const normalizedAvailabilityCategory =
          availabilityType === "scheduled" ? values.availabilityCategory : null

        async function saveProductAvailabilityRule(productId: string) {
          const { error: deleteRuleError } = await supabase
            .from("product_availability_rules")
            .delete()
            .eq("restaurant_id", resolvedRestaurantId)
            .eq("product_id", productId)

          if (deleteRuleError) throw deleteRuleError

          if (availabilityType !== "scheduled") return

          if (
            normalizedAvailabilityWeekdays.length === 0 ||
            !normalizedAvailabilityCategory
          ) {
            throw new Error(
              "Escolha os dias e a categoria da disponibilidade programada."
            )
          }

          const { error: insertRuleError } = await supabase
            .from("product_availability_rules")
            .insert({
              restaurant_id: resolvedRestaurantId,
              product_id: productId,
              display_category_id: normalizedAvailabilityCategory,
              weekdays: normalizedAvailabilityWeekdays,
              start_time: normalizedAvailabilityStartTime,
              end_time: normalizedAvailabilityEndTime,
              is_active: true,
              sort_order: 0,
            })

          if (insertRuleError) throw insertRuleError
        }

        if (productSheet.mode === "edit" && productSheet.productId) {
          const editingProduct = products.find(
            (product) => product.id === productSheet.productId
          )

          if (!editingProduct) return null

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
              promotion_active: promotionActive,
              promotion_type: promotionType,
              promotion_value: promotionValue,
              availability_type: availabilityType,
            })
            .eq("id", productSheet.productId)
            .eq("restaurant_id", resolvedRestaurantId)
            .select(PRODUCT_SELECT)
            .single()

          if (error) throw error
          if (!data) throw new Error("Produto não encontrado para atualização.")

          await saveProductAvailabilityRule(productSheet.productId)

          const updatedProduct: CatalogProduct = {
            ...normalizeProduct(data as DbProduct, editingProduct.salesCount ?? 0, {
              id: "local",
              product_id: productSheet.productId,
              display_category_id: normalizedAvailabilityCategory,
              weekdays: normalizedAvailabilityWeekdays,
              start_time: normalizedAvailabilityStartTime,
              end_time: normalizedAvailabilityEndTime,
              is_active: availabilityType === "scheduled",
            }),
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

          return productSheet.productId
        }

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
            promotion_active: promotionActive,
            promotion_type: promotionType,
            promotion_value: promotionValue,
            availability_type: availabilityType,
          })
          .select(PRODUCT_SELECT)
          .single()

        if (error) throw error
        if (!data) throw new Error("Erro ao criar produto.")

        await saveProductAvailabilityRule(data.id)

        const newProduct: CatalogProduct = {
          ...normalizeProduct(data as DbProduct, 0, {
            id: "local",
            product_id: data.id,
            display_category_id: normalizedAvailabilityCategory,
            weekdays: normalizedAvailabilityWeekdays,
            start_time: normalizedAvailabilityStartTime,
            end_time: normalizedAvailabilityEndTime,
            is_active: availabilityType === "scheduled",
          }),
          imageSize: values.imageSize,
        }

        setProducts((prev) => sortByOrder([...prev, newProduct]))

        toast({
          title: "Produto criado",
          description: `"${values.name}" foi adicionado ao catálogo.`,
        })

        return data.id
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

        return null
      } finally {
        setSavingProductId(null)
      }
    },
    [
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
          .select(PRODUCT_SELECT)
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

        await Promise.allSettled([
          supabase
            .from("product_modifier_group_links")
            .delete()
            .eq("restaurant_id", resolvedRestaurantId)
            .eq("product_id", productId),
          supabase
            .from("product_availability_rules")
            .delete()
            .eq("restaurant_id", resolvedRestaurantId)
            .eq("product_id", productId),
          supabase.from("product_recipe_items").delete().eq("product_id", productId),
        ])

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

      const confirmed = window.confirm(
        productsInCategory.length > 0
          ? `A categoria "${category.name}" possui ${productsInCategory.length} produto(s).\n\nAo excluir a categoria, esses produtos também serão excluídos do catálogo.\n\nDeseja continuar?`
          : `Tem certeza que deseja excluir a categoria "${category.name}"?`
      )

      if (!confirmed) return

      try {
        const resolvedRestaurantId = await resolveRestaurantId()
        setDeletingId(categoryId)

        const productIds = productsInCategory.map((product) => product.id)

        if (productIds.length > 0) {
          await Promise.allSettled([
            supabase
              .from("product_modifier_group_links")
              .delete()
              .eq("restaurant_id", resolvedRestaurantId)
              .in("product_id", productIds),
            supabase
              .from("product_availability_rules")
              .delete()
              .eq("restaurant_id", resolvedRestaurantId)
              .in("product_id", productIds),
            supabase
              .from("product_recipe_items")
              .delete()
              .in("product_id", productIds),
          ])

          const { error: deleteProductsError } = await supabase
            .from("products")
            .delete()
            .eq("restaurant_id", resolvedRestaurantId)
            .eq("category_id", categoryId)

          if (deleteProductsError) throw deleteProductsError
        }

        const { error } = await supabase
          .from("categories")
          .delete()
          .eq("id", categoryId)
          .eq("restaurant_id", resolvedRestaurantId)

        if (error) throw error

        setProducts((prev) =>
          prev.filter((product) => product.category !== categoryId)
        )
        setCategories((prev) => prev.filter((item) => item.id !== categoryId))
        setExpandedCategoryIds((prev) =>
          prev.filter((currentCategoryId) => currentCategoryId !== categoryId)
        )

        if (categoryFilter === categoryId) {
          setCategoryFilter("all")
        }

        toast({
          title: "Categoria excluída",
          description:
            productsInCategory.length > 0
              ? `"${category.name}" e seus produtos foram removidos.`
              : `"${category.name}" foi removida.`,
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
    [categories, categoryFilter, products, resolveRestaurantId, supabase, toast]
  )

  const openCategoryOrderModal = useCallback(() => {
    setCategoryOrderDraft(sortedCategories)
    setDraggedCategoryId(null)
    setCategoryOrderModalOpen(true)
  }, [sortedCategories])

  const closeCategoryOrderModal = useCallback(() => {
    setCategoryOrderModalOpen(false)
    setCategoryOrderDraft([])
    setDraggedCategoryId(null)
  }, [])

  const reorderCategoryDraft = useCallback(
    (draggedId: string, targetId: string) => {
      if (draggedId === targetId) return

      setCategoryOrderDraft((prev) => {
        const draggedIndex = prev.findIndex((category) => category.id === draggedId)
        const targetIndex = prev.findIndex((category) => category.id === targetId)

        if (draggedIndex === -1 || targetIndex === -1) return prev

        const next = [...prev]
        const [draggedCategory] = next.splice(draggedIndex, 1)

        if (!draggedCategory) return prev

        next.splice(targetIndex, 0, draggedCategory)

        return next.map((category, index) => ({
          ...category,
          order: index,
        }))
      })
    },
    []
  )

  const handleCategoryDragStart = useCallback((categoryId: string) => {
    setDraggedCategoryId(categoryId)
  }, [])

  const handleCategoryDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>, targetCategoryId: string) => {
      event.preventDefault()

      if (!draggedCategoryId) return

      reorderCategoryDraft(draggedCategoryId, targetCategoryId)
    },
    [draggedCategoryId, reorderCategoryDraft]
  )

  const handleCategoryDragEnd = useCallback(() => {
    setDraggedCategoryId(null)
  }, [])

  const saveCategoryOrder = useCallback(async () => {
    try {
      const resolvedRestaurantId = await resolveRestaurantId()
      setSavingCategoryOrder(true)

      const normalizedDraft = categoryOrderDraft.map((category, index) => ({
        ...category,
        order: index,
      }))

      const results = await Promise.all(
        normalizedDraft.map((category) =>
          supabase
            .from("categories")
            .update({ sort_order: category.order })
            .eq("id", category.id)
            .eq("restaurant_id", resolvedRestaurantId)
        )
      )

      const failedResult = results.find((result) => result.error)

      if (failedResult?.error) throw failedResult.error

      setCategories(normalizedDraft)
      setCategoryOrderModalOpen(false)
      setCategoryOrderDraft([])
      setDraggedCategoryId(null)

      toast({
        title: "Ordem atualizada",
        description: "A hierarquia das categorias foi salva no cardápio.",
      })
    } catch (error) {
      console.error("Erro ao salvar ordem das categorias:", error)

      toast({
        title: "Erro ao salvar ordem",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a ordem das categorias.",
        variant: "destructive",
      })
    } finally {
      setSavingCategoryOrder(false)
    }
  }, [categoryOrderDraft, resolveRestaurantId, supabase, toast])

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
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                Cardápio
              </p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                Produtos e categorias
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Organize a ordem das categorias, cadastre produtos e mantenha o cardápio limpo para o cliente.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={openCategoryOrderModal}
                disabled={sortedCategories.length === 0}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Organizar categorias
              </button>

              <button
                type="button"
                onClick={openCreateCategoryModal}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                <FolderPlus className="h-4 w-4" />
                Nova categoria
              </button>

              <button
                type="button"
                onClick={() => openCreateProductSheet()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Novo produto
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Total
                </p>
                <Package className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {products.length}
              </p>
              <p className="text-xs font-semibold text-slate-500">produtos</p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                  Ativos
                </p>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-900">
                {activeProducts.length}
              </p>
              <p className="text-xs font-semibold text-emerald-700">
                visíveis no cardápio
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Sem foto
                </p>
                <ImageOff className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {noImageProducts.length}
              </p>
              <p className="text-xs font-semibold text-slate-500">para revisar</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Sem custo
                </p>
                <DollarSign className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {noCostProducts.length}
              </p>
              <p className="text-xs font-semibold text-slate-500">sem CMV</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Margem média
                </p>
                <Percent className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {averageMargin.toFixed(1)}%
              </p>
              <p className="text-xs font-semibold text-slate-500">
                {inactiveProducts.length} inativo(s)
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px_190px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar produto por nome ou descrição..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(event) => {
                const nextCategoryFilter = event.target.value

                setCategoryFilter(nextCategoryFilter)

                if (nextCategoryFilter !== "all") {
                  setExpandedCategoryIds((prev) =>
                    prev.includes(nextCategoryFilter)
                      ? prev
                      : [...prev, nextCategoryFilter]
                  )
                }
              }}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
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
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="all">Todos status</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-950">
                Categorias do cardápio
              </h2>
              <p className="text-sm font-semibold text-slate-500">
                Clique na categoria para abrir os produtos. A ordem abaixo é a hierarquia do cardápio público.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={openCategoryOrderModal}
                disabled={sortedCategories.length === 0}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Reordenar
              </button>

              <button
                type="button"
                onClick={openCreateCategoryModal}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                <FolderPlus className="h-4 w-4" />
                Nova categoria
              </button>
            </div>
          </div>

          {visibleCategories.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-black text-slate-700">
                Nenhum produto encontrado
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Ajuste a busca ou os filtros para ver os produtos.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {visibleCategories.map((category, index) => {
                const categoryProducts = productsByCategory.get(category.id) ?? []
                const totalProductsInCategory = products.filter(
                  (product) => product.category === category.id
                ).length
                const isExpanded = expandedCategoryIds.includes(category.id)
                const isDeletingCategory = deletingId === category.id

                return (
                  <div key={category.id} className="bg-white">
                    <div
                      className={cn(
                        "flex flex-col gap-3 px-4 py-3 transition sm:flex-row sm:items-center sm:justify-between",
                        isExpanded ? "bg-blue-50/40" : "hover:bg-slate-50"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCategoryExpanded(category.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-slate-600 transition",
                            isExpanded
                              ? "border-blue-200 bg-white text-blue-700"
                              : "border-slate-200 bg-slate-50"
                          )}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </span>

                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-500">
                          {index + 1}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-black uppercase tracking-wide text-slate-950">
                              {category.name}
                            </span>

                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                              {totalProductsInCategory}
                            </span>

                            {!category.active && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-700">
                                Oculta
                              </span>
                            )}
                          </span>

                          <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                            {isExpanded
                              ? "Produtos visíveis abaixo"
                              : "Clique para abrir os produtos dessa categoria"}
                          </span>
                        </span>
                      </button>

                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <button
                          type="button"
                          onClick={() => openCreateProductSheet(category.id)}
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Produto
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditCategoryModal(category)}
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => void deleteCategory(category.id)}
                          disabled={isDeletingCategory}
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          {isDeletingCategory ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Excluir
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/60">
                        {categoryProducts.length === 0 ? (
                          <div className="p-4">
                            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
                              <p className="text-sm font-black text-slate-700">
                                Nenhum produto nessa categoria
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                Adicione produtos para montar essa seção do cardápio.
                              </p>
                              <button
                                type="button"
                                onClick={() => openCreateProductSheet(category.id)}
                                className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"
                              >
                                <Plus className="h-4 w-4" />
                                Adicionar produto
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-200">
                            {categoryProducts.map((product) => {
                              const finalPrice = getProductFinalPrice(product)
                              const profit = getProfit(finalPrice, product.cost)
                              const margin = getMargin(finalPrice, product.cost)
                              const isSaving = savingProductId === product.id
                              const isDeleting = deletingId === product.id

                              return (
                                <div
                                  key={product.id}
                                  className="grid gap-3 bg-white px-4 py-3 transition hover:bg-slate-50 xl:grid-cols-[minmax(0,1.7fr)_150px_145px_210px] xl:items-center"
                                >
                                  <div className="flex min-w-0 gap-3">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
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

                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="truncate text-sm font-black text-slate-950">
                                          {product.name}
                                        </p>

                                        {product.promotionActive && (
                                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-black text-orange-700">
                                            Promoção
                                          </span>
                                        )}

                                        {!hasImage(product) && (
                                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
                                            Sem foto
                                          </span>
                                        )}

                                        {!hasRegisteredCost(product) && (
                                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-700">
                                            Sem custo
                                          </span>
                                        )}
                                      </div>

                                      <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                                        {product.description || "Sem descrição cadastrada."}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:block">
                                    <div>
                                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                                        Preço
                                      </p>

                                      {product.promotionActive ? (
                                        <div className="mt-1">
                                          <p className="text-sm font-black text-emerald-600">
                                            {formatCurrency(finalPrice)}
                                          </p>
                                          <p className="text-xs font-bold text-slate-400 line-through">
                                            {formatCurrency(product.price)}
                                          </p>
                                        </div>
                                      ) : (
                                        <p className="mt-1 text-sm font-black text-slate-950">
                                          {formatCurrency(product.price)}
                                        </p>
                                      )}
                                    </div>

                                    <div className="xl:mt-2">
                                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                                        Custo
                                      </p>
                                      <p className="mt-1 text-sm font-black text-slate-950">
                                        {formatCurrency(product.cost)}
                                      </p>
                                    </div>

                                    <div className="xl:hidden">
                                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
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
                                  </div>

                                  <div className="hidden xl:block">
                                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                                      Resultado
                                    </p>
                                    <p
                                      className={cn(
                                        "mt-1 text-sm font-black",
                                        profit >= 0 ? "text-emerald-600" : "text-red-600"
                                      )}
                                    >
                                      {formatCurrency(profit)}
                                    </p>
                                    <p
                                      className={cn(
                                        "text-xs font-bold",
                                        margin >= 20 ? "text-emerald-600" : "text-amber-600"
                                      )}
                                    >
                                      {margin.toFixed(1)}% margem
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                                    <button
                                      type="button"
                                      onClick={() => void toggleProductActive(product.id)}
                                      disabled={isSaving}
                                      className={cn(
                                        "inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-black transition disabled:opacity-50",
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
                                      {getProductStatusLabel(product)}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => openEditProductSheet(product.id)}
                                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                      Editar
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => void deleteProduct(product.id)}
                                      disabled={isDeleting}
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                                      aria-label={`Excluir ${product.name}`}
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
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {categoryModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-black text-slate-950">
                    {categoryModal.mode === "create"
                      ? "Nova categoria"
                      : "Editar categoria"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Organize a estrutura do cardápio.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeCategoryModal}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 px-5 py-4">
                <div>
                  <label className="mb-1.5 block text-sm font-black text-slate-700">
                    Nome da categoria
                  </label>
                  <input
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    placeholder="Ex: Lanches"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-black text-slate-700">
                    Status
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCategoryActive(true)}
                      className={cn(
                        "h-10 rounded-xl border text-sm font-black transition",
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
                        "h-10 rounded-xl border text-sm font-black transition",
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
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => void saveCategory()}
                  disabled={!categoryName.trim() || savingCategory}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingCategory && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {categoryOrderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-black text-slate-950">
                    Organizar categorias
                  </h2>
                  <p className="text-sm text-slate-500">
                    Arraste as categorias para definir a hierarquia do cardápio público.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeCategoryOrderModal}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-2">
                  {categoryOrderDraft.map((category, index) => {
                    const isDragging = draggedCategoryId === category.id

                    return (
                      <div
                        key={category.id}
                        draggable
                        onDragStart={() => handleCategoryDragStart(category.id)}
                        onDragOver={(event) =>
                          handleCategoryDragOver(event, category.id)
                        }
                        onDragEnd={handleCategoryDragEnd}
                        className={cn(
                          "flex cursor-grab items-center gap-3 rounded-xl border bg-white p-3 transition active:cursor-grabbing",
                          isDragging
                            ? "border-blue-300 bg-blue-50 opacity-70 shadow-md ring-2 ring-blue-500/10"
                            : "border-slate-200 hover:border-blue-200 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                          <GripVertical className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-400">
                              {index + 1}.
                            </span>
                            <p className="truncate text-sm font-black text-slate-900">
                              {category.name}
                            </p>
                          </div>
                          <p className="mt-0.5 text-xs font-semibold text-slate-500">
                            {
                              products.filter(
                                (product) => product.category === category.id
                              ).length
                            }{" "}
                            produto(s)
                          </p>
                        </div>

                        <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500 sm:inline-flex">
                          Arraste
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
                <button
                  type="button"
                  onClick={closeCategoryOrderModal}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => void saveCategoryOrder()}
                  disabled={savingCategoryOrder}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingCategoryOrder && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Salvar ordem
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