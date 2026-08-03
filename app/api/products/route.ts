import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import {
  getAuthenticatedRestaurant as getRestaurant,
  getRestaurantErrorStatus,
} from "@/lib/authenticated-restaurant"

type RecipeItemBody = {
  stockItemId?: string
  quantity?: number | string
}

type ProductBody = {
  id?: string
  name?: string
  description?: string
  price?: number
  cost?: number
  category?: string
  image?: string
  available?: boolean
  recipeItems?: RecipeItemBody[]
}

type DatabaseCategory = {
  id: string
  name: string
  description: string | null
  sort_order: number | null
  is_active: boolean | null
}

type DatabaseProduct = {
  id: string
  category_id: string | null
  name: string
  description: string | null
  price: number | null
  cost: number | null
  image_url: string | null
  is_active: boolean | null
  is_featured: boolean | null
}

type DatabaseStockItem = {
  id: string
  name: string | null
  unit: string | null
  quantity: number | null
  min_quantity: number | null
  cost_price: number | null
  status: string | null
}

type DatabaseRecipeItem = {
  id: string
  product_id: string
  stock_item_id: string
  quantity: number | null
  unit: string | null
}

function safeString(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback

  const text = String(value).trim()

  return text.length > 0 ? text : fallback
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d,.-]/g, "")

    if (!cleaned) return fallback

    const normalized = cleaned.includes(",")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned

    const parsed = Number(normalized)

    return Number.isFinite(parsed) ? parsed : fallback
  }

  return fallback
}

async function getCategoriesByRestaurant(restaurantId: string) {
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("id, name, description, sort_order, is_active")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as DatabaseCategory[]
}

async function getCategoryNameById(
  restaurantId: string,
  categoryId: string | null,
) {
  if (!categoryId) {
    return "Outros"
  }

  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("id, name")
    .eq("restaurant_id", restaurantId)
    .eq("id", categoryId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data?.name ?? "Outros"
}

async function getOrCreateCategory(
  restaurantId: string,
  categoryName: string,
) {
  const name = categoryName.trim()

  const { data: existingCategory, error: findError } = await supabaseAdmin
    .from("categories")
    .select("id, name")
    .eq("restaurant_id", restaurantId)
    .ilike("name", name)
    .maybeSingle()

  if (findError) {
    throw new Error(findError.message)
  }

  if (existingCategory) {
    return existingCategory
  }

  const { data: lastCategory } = await supabaseAdmin
    .from("categories")
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextSortOrder = Number(lastCategory?.sort_order ?? 0) + 1

  const { data: newCategory, error: createError } = await supabaseAdmin
    .from("categories")
    .insert({
      restaurant_id: restaurantId,
      name,
      description: null,
      sort_order: nextSortOrder,
      is_active: true,
    })
    .select("id, name")
    .single()

  if (createError || !newCategory) {
    throw new Error(createError?.message || "Erro ao criar categoria")
  }

  return newCategory
}

function mapProduct(
  product: DatabaseProduct,
  categoryName: string,
  recipeItems: ReturnType<typeof mapRecipeItem>[] = [],
) {
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? "",
    price: Number(product.price ?? 0),
    cost: Number(product.cost ?? 0),
    category: categoryName,
    image: product.image_url || "/placeholder.svg",
    available: product.is_active ?? true,
    sold: 0,
    recipeItems,
  }
}

function mapStockItem(item: DatabaseStockItem) {
  return {
    id: item.id,
    name: safeString(item.name, "Insumo sem nome"),
    unit: safeString(item.unit, "un"),
    quantity: Number(item.quantity ?? 0),
    minQuantity: Number(item.min_quantity ?? 0),
    costPrice: Number(item.cost_price ?? 0),
    status: item.status ?? "active",
  }
}

function mapRecipeItem(
  item: DatabaseRecipeItem,
  stockItem?: DatabaseStockItem,
) {
  return {
    id: item.id,
    productId: item.product_id,
    stockItemId: item.stock_item_id,
    stockItemName: safeString(
      stockItem?.name,
      "Insumo não encontrado",
    ),
    quantity: Number(item.quantity ?? 0),
    unit: safeString(item.unit ?? stockItem?.unit, "un"),
  }
}

function validateProductPayload(body: ProductBody) {
  if (!body.name?.trim()) {
    return "Nome do produto é obrigatório"
  }

  if (!body.category?.trim()) {
    return "Categoria é obrigatória"
  }

  if (
    Number.isNaN(Number(body.price)) ||
    Number(body.price ?? 0) < 0
  ) {
    return "Preço inválido"
  }

  if (
    Number.isNaN(Number(body.cost ?? 0)) ||
    Number(body.cost ?? 0) < 0
  ) {
    return "Custo inválido"
  }

  return null
}

async function getStockItems(restaurantId: string) {
  const { data, error } = await supabaseAdmin
    .from("stock_items")
    .select(
      "id, name, unit, quantity, min_quantity, cost_price, status",
    )
    .eq("restaurant_id", restaurantId)
    .order("name", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as DatabaseStockItem[]
}

async function getRecipeItemsByProductIds(
  restaurantId: string,
  productIds: string[],
) {
  if (productIds.length === 0) {
    return new Map<
      string,
      ReturnType<typeof mapRecipeItem>[]
    >()
  }

  const stockItems = await getStockItems(restaurantId)
  const stockItemsById = new Map(
    stockItems.map((item) => [item.id, item]),
  )

  const { data, error } = await supabaseAdmin
    .from("product_recipe_items")
    .select(
      "id, product_id, stock_item_id, quantity, unit",
    )
    .eq("restaurant_id", restaurantId)
    .in("product_id", productIds)
    .order("created_at", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const recipesByProductId = new Map<
    string,
    ReturnType<typeof mapRecipeItem>[]
  >()

  for (const item of (data ?? []) as DatabaseRecipeItem[]) {
    const currentItems =
      recipesByProductId.get(item.product_id) ?? []

    currentItems.push(
      mapRecipeItem(
        item,
        stockItemsById.get(item.stock_item_id),
      ),
    )

    recipesByProductId.set(item.product_id, currentItems)
  }

  return recipesByProductId
}

async function saveRecipeItems(
  restaurantId: string,
  productId: string,
  recipeItems: RecipeItemBody[],
) {
  const normalizedItems = recipeItems
    .map((item) => ({
      stockItemId: safeString(item.stockItemId, ""),
      quantity: toNumber(item.quantity, 0),
    }))
    .filter(
      (item) => item.stockItemId && item.quantity > 0,
    )

  const { error: deleteError } = await supabaseAdmin
    .from("product_recipe_items")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("product_id", productId)

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  if (normalizedItems.length === 0) {
    return []
  }

  const stockItemIds = Array.from(
    new Set(
      normalizedItems.map((item) => item.stockItemId),
    ),
  )

  const {
    data: stockItemsData,
    error: stockItemsError,
  } = await supabaseAdmin
    .from("stock_items")
    .select("id, name, unit")
    .eq("restaurant_id", restaurantId)
    .in("id", stockItemIds)

  if (stockItemsError) {
    throw new Error(stockItemsError.message)
  }

  const stockItems =
    (stockItemsData ?? []) as DatabaseStockItem[]

  const stockItemsById = new Map(
    stockItems.map((item) => [item.id, item]),
  )

  const itemsToInsert = normalizedItems.map((item) => {
    const stockItem = stockItemsById.get(item.stockItemId)

    if (!stockItem) {
      throw new Error(
        "Um dos insumos selecionados não pertence a este restaurante",
      )
    }

    return {
      restaurant_id: restaurantId,
      product_id: productId,
      stock_item_id: item.stockItemId,
      quantity: item.quantity,
      unit: safeString(stockItem.unit, "un"),
      updated_at: new Date().toISOString(),
    }
  })

  const {
    data: insertedItems,
    error: insertError,
  } = await supabaseAdmin
    .from("product_recipe_items")
    .insert(itemsToInsert)
    .select(
      "id, product_id, stock_item_id, quantity, unit",
    )

  if (insertError) {
    throw new Error(insertError.message)
  }

  return (
    (insertedItems ?? []) as DatabaseRecipeItem[]
  ).map((item) =>
    mapRecipeItem(
      item,
      stockItemsById.get(item.stock_item_id),
    ),
  )
}

async function getProductById(
  restaurantId: string,
  productId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select(
      "id, category_id, name, description, price, cost, image_url, is_active, is_featured",
    )
    .eq("restaurant_id", restaurantId)
    .eq("id", productId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data as DatabaseProduct | null
}

export async function GET() {
  try {
    const restaurant = await getRestaurant()
    const categories = await getCategoriesByRestaurant(
      restaurant.id,
    )
    const stockItems = await getStockItems(restaurant.id)

    const categoriesById = new Map(
      categories.map((category) => [
        category.id,
        category.name,
      ]),
    )

    const {
      data: productsData,
      error: productsError,
    } = await supabaseAdmin
      .from("products")
      .select(
        "id, category_id, name, description, price, cost, image_url, is_active, is_featured",
      )
      .eq("restaurant_id", restaurant.id)
      .order("name", { ascending: true })

    if (productsError) {
      return NextResponse.json(
        {
          ok: false,
          error: productsError.message,
        },
        { status: 500 },
      )
    }

    const databaseProducts =
      (productsData ?? []) as DatabaseProduct[]

    const recipeItemsByProductId =
      await getRecipeItemsByProductIds(
        restaurant.id,
        databaseProducts.map((product) => product.id),
      )

    const products = databaseProducts.map((product) =>
      mapProduct(
        product,
        categoriesById.get(product.category_id ?? "") ??
          "Outros",
        recipeItemsByProductId.get(product.id) ?? [],
      ),
    )

    const categoryNamesFromProducts = products
      .map((product) => product.category)
      .filter(Boolean)

    const categoryNamesFromTable = categories
      .map((category) => category.name)
      .filter(Boolean)

    const categoryNames = Array.from(
      new Set([
        ...categoryNamesFromTable,
        ...categoryNamesFromProducts,
      ]),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"))

    return NextResponse.json({
      ok: true,
      restaurant,
      categories: categoryNames,
      products,
      stockItems: stockItems
        .map(mapStockItem)
        .filter((item) => item.status !== "inactive"),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado",
      },
      {
        status: getRestaurantErrorStatus(error),
      },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProductBody
    const validationError = validateProductPayload(body)

    if (validationError) {
      return NextResponse.json(
        {
          ok: false,
          error: validationError,
        },
        { status: 400 },
      )
    }

    const restaurant = await getRestaurant()

    const category = await getOrCreateCategory(
      restaurant.id,
      body.category ?? "Outros",
    )

    const imageUrl =
      body.image && body.image !== "/placeholder.svg"
        ? body.image.trim()
        : null

    const {
      data: product,
      error: productError,
    } = await supabaseAdmin
      .from("products")
      .insert({
        restaurant_id: restaurant.id,
        category_id: category.id,
        name: body.name?.trim(),
        description: body.description?.trim() || null,
        price: Number(body.price ?? 0),
        cost: Number(body.cost ?? 0),
        image_url: imageUrl,
        is_active: body.available ?? true,
        is_featured: false,
      })
      .select(
        "id, category_id, name, description, price, cost, image_url, is_active, is_featured",
      )
      .single()

    if (productError || !product) {
      return NextResponse.json(
        {
          ok: false,
          error:
            productError?.message ||
            "Erro ao criar produto",
        },
        { status: 500 },
      )
    }

    const recipeItems = Array.isArray(body.recipeItems)
      ? await saveRecipeItems(
          restaurant.id,
          product.id,
          body.recipeItems,
        )
      : []

    return NextResponse.json({
      ok: true,
      product: mapProduct(
        product as DatabaseProduct,
        category.name,
        recipeItems,
      ),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado",
      },
      {
        status: getRestaurantErrorStatus(error),
      },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as ProductBody

    if (!body.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "ID do produto é obrigatório",
        },
        { status: 400 },
      )
    }

    const restaurant = await getRestaurant()

    const isRecipeOnlyUpdate =
      Array.isArray(body.recipeItems) &&
      body.name === undefined &&
      body.category === undefined &&
      body.price === undefined

    if (isRecipeOnlyUpdate) {
      const currentProduct = await getProductById(
        restaurant.id,
        body.id,
      )

      if (!currentProduct) {
        return NextResponse.json(
          {
            ok: false,
            error: "Produto não encontrado",
          },
          { status: 404 },
        )
      }

      const categoryName = await getCategoryNameById(
        restaurant.id,
        currentProduct.category_id,
      )

      const recipeItems = await saveRecipeItems(
        restaurant.id,
        body.id,
        body.recipeItems ?? [],
      )

      return NextResponse.json({
        ok: true,
        product: mapProduct(
          currentProduct,
          categoryName,
          recipeItems,
        ),
      })
    }

    const validationError = validateProductPayload(body)

    if (validationError) {
      return NextResponse.json(
        {
          ok: false,
          error: validationError,
        },
        { status: 400 },
      )
    }

    const category = await getOrCreateCategory(
      restaurant.id,
      body.category ?? "Outros",
    )

    const imageUrl =
      body.image && body.image !== "/placeholder.svg"
        ? body.image.trim()
        : null

    const {
      data: product,
      error: productError,
    } = await supabaseAdmin
      .from("products")
      .update({
        category_id: category.id,
        name: body.name?.trim(),
        description: body.description?.trim() || null,
        price: Number(body.price ?? 0),
        cost: Number(body.cost ?? 0),
        image_url: imageUrl,
        is_active: body.available ?? true,
      })
      .eq("id", body.id)
      .eq("restaurant_id", restaurant.id)
      .select(
        "id, category_id, name, description, price, cost, image_url, is_active, is_featured",
      )
      .single()

    if (productError || !product) {
      return NextResponse.json(
        {
          ok: false,
          error:
            productError?.message ||
            "Erro ao atualizar produto",
        },
        { status: 500 },
      )
    }

    let recipeItems: ReturnType<
      typeof mapRecipeItem
    >[] = []

    if (Array.isArray(body.recipeItems)) {
      recipeItems = await saveRecipeItems(
        restaurant.id,
        body.id,
        body.recipeItems,
      )
    } else {
      const recipeItemsByProductId =
        await getRecipeItemsByProductIds(
          restaurant.id,
          [body.id],
        )

      recipeItems =
        recipeItemsByProductId.get(body.id) ?? []
    }

    return NextResponse.json({
      ok: true,
      product: mapProduct(
        product as DatabaseProduct,
        category.name,
        recipeItems,
      ),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado",
      },
      {
        status: getRestaurantErrorStatus(error),
      },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "ID do produto é obrigatório",
        },
        { status: 400 },
      )
    }

    const restaurant = await getRestaurant()

    const {
      data: product,
      error,
    } = await supabaseAdmin
      .from("products")
      .update({
        is_active: false,
      })
      .eq("id", id)
      .eq("restaurant_id", restaurant.id)
      .select(
        "id, category_id, name, description, price, cost, image_url, is_active, is_featured",
      )
      .single()

    if (error || !product) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error?.message ||
            "Erro ao desativar produto",
        },
        { status: 500 },
      )
    }

    const categoryName = await getCategoryNameById(
      restaurant.id,
      product.category_id,
    )

    const recipeItemsByProductId =
      await getRecipeItemsByProductIds(
        restaurant.id,
        [id],
      )

    return NextResponse.json({
      ok: true,
      id,
      product: mapProduct(
        product as DatabaseProduct,
        categoryName,
        recipeItemsByProductId.get(id) ?? [],
      ),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado",
      },
      {
        status: getRestaurantErrorStatus(error),
      },
    )
  }
}