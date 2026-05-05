import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

type RouteContext = {
  params: Promise<{
    slug: string
  }>
}

type DeliveryFeeRuleRow = {
  id: string
  restaurant_id: string
  label: string | null
  fee: number | string | null
  neighborhoods: string[] | null
  is_active: boolean | null
  sort_order: number | null
  created_at?: string | null
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params
    const decodedSlug = decodeURIComponent(slug)

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("*")
      .eq("slug", decodedSlug)
      .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao buscar restaurante público:", {
        slug: decodedSlug,
        message: restaurantError.message,
        details: restaurantError.details,
        hint: restaurantError.hint,
        code: restaurantError.code,
      })

      return NextResponse.json(
        { error: restaurantError.message || "Erro ao buscar restaurante." },
        { status: 500 }
      )
    }

    if (!restaurant) {
      return NextResponse.json(
        { error: `Restaurante não encontrado para o slug: ${decodedSlug}` },
        { status: 404 }
      )
    }

    if (restaurant.is_active === false) {
      return NextResponse.json(
        { error: "Este restaurante está inativo." },
        { status: 404 }
      )
    }

    const [categoriesResult, productsResult, deliveryRulesResult] = await Promise.all([
      supabaseAdmin
        .from("categories")
        .select("id, restaurant_id, name, sort_order, is_active, created_at")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),

      supabaseAdmin
        .from("products")
        .select(
          "id, restaurant_id, category_id, name, description, price, image_url, is_available, sort_order, created_at"
        )
        .eq("restaurant_id", restaurant.id)
        .eq("is_available", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),

      supabaseAdmin
        .from("delivery_fee_rules")
        .select("id, restaurant_id, label, fee, neighborhoods, is_active, sort_order, created_at")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ])

    if (categoriesResult.error) {
      console.error("Erro ao buscar categorias públicas:", {
        restaurantId: restaurant.id,
        message: categoriesResult.error.message,
        details: categoriesResult.error.details,
        hint: categoriesResult.error.hint,
        code: categoriesResult.error.code,
      })

      return NextResponse.json(
        { error: categoriesResult.error.message || "Erro ao buscar categorias." },
        { status: 500 }
      )
    }

    if (productsResult.error) {
      console.error("Erro ao buscar produtos públicos:", {
        restaurantId: restaurant.id,
        message: productsResult.error.message,
        details: productsResult.error.details,
        hint: productsResult.error.hint,
        code: productsResult.error.code,
      })

      return NextResponse.json(
        { error: productsResult.error.message || "Erro ao buscar produtos." },
        { status: 500 }
      )
    }

    if (deliveryRulesResult.error) {
      console.error("Erro ao buscar regras de entrega públicas:", {
        restaurantId: restaurant.id,
        message: deliveryRulesResult.error.message,
        details: deliveryRulesResult.error.details,
        hint: deliveryRulesResult.error.hint,
        code: deliveryRulesResult.error.code,
      })

      return NextResponse.json(
        { error: deliveryRulesResult.error.message || "Erro ao buscar regras de entrega." },
        { status: 500 }
      )
    }

    const categories = categoriesResult.data ?? []
    const products = productsResult.data ?? []
    const deliveryRules = (deliveryRulesResult.data ?? []) as DeliveryFeeRuleRow[]

    const categoriesMap = new Map(categories.map((category) => [category.id, category]))
    const productsByCategory = new Map<string, any[]>()

    for (const product of products) {
      const categoryKey = product.category_id ?? "sem-categoria"
      const category = product.category_id
        ? categoriesMap.get(product.category_id)
        : null

      const normalizedProduct = {
        id: product.id,
        restaurantId: product.restaurant_id,
        categoryId: product.category_id,
        category: category?.name ?? "Sem categoria",
        name: product.name,
        description: product.description ?? "",
        price: toNumber(product.price, 0),
        cost: 0,
        active: product.is_available ?? true,
        salesCount: 0,
        order: toNumber(product.sort_order, 0),
        image: product.image_url ?? null,
        imageSize: null,
        imageUrl: product.image_url ?? null,
      }

      const current = productsByCategory.get(categoryKey) ?? []
      current.push(normalizedProduct)
      productsByCategory.set(categoryKey, current)
    }

    const normalizedCategories = categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        description: "",
        order: toNumber(category.sort_order, 0),
        active: category.is_active ?? true,
        products: (productsByCategory.get(category.id) ?? []).sort(
          (a, b) => a.order - b.order
        ),
      }))
      .filter((category) => category.products.length > 0)

    const uncategorizedProducts = (productsByCategory.get("sem-categoria") ?? []).sort(
      (a, b) => a.order - b.order
    )

    if (uncategorizedProducts.length > 0) {
      normalizedCategories.push({
        id: "sem-categoria",
        name: "Sem categoria",
        description: "",
        order: 999999,
        active: true,
        products: uncategorizedProducts,
      })
    }

    const normalizedDeliveryRules = deliveryRules.map((rule, index) => ({
      id: rule.id,
      label: rule.label?.trim() || `Faixa ${index + 1}`,
      fee: toNumber(rule.fee, 0),
      neighborhoods: Array.isArray(rule.neighborhoods)
        ? rule.neighborhoods.filter(Boolean)
        : [],
      isActive: rule.is_active ?? true,
      sortOrder: toNumber(rule.sort_order, index),
    }))

    const fallbackDeliveryFee =
      normalizedDeliveryRules.length > 0
        ? normalizedDeliveryRules[0].fee
        : toNumber(restaurant.delivery_fee, 0)

    const normalizedRestaurant = {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      description: restaurant.description ?? "",
      logoUrl: restaurant.logo_url ?? null,
      phone: restaurant.phone ?? "",
      whatsapp: restaurant.whatsapp ?? restaurant.phone ?? "",
      address: restaurant.address ?? "",
      city: restaurant.city ?? "",
      state: restaurant.state ?? "",
      openTime: restaurant.open_time ?? "11:00",
      closeTime: restaurant.close_time ?? "23:00",
      avgPrepTime: Number(restaurant.avg_prep_time ?? 35),
      closedToday: restaurant.closed_today ?? false,
      closedMessage:
        restaurant.closed_message ?? "Estamos fechados no momento. Voltamos em breve!",
      activeDays: Array.isArray(restaurant.active_days) ? restaurant.active_days : [],
      deliveryFee: fallbackDeliveryFee,
      deliveryFeeRules: normalizedDeliveryRules,
      minimumOrder: toNumber(restaurant.minimum_order, 0),
      estimatedDeliveryTime: restaurant.estimated_delivery_time ?? "30-45 min",
      deliveryEnabled:
        typeof restaurant.delivery_enabled === "boolean"
          ? restaurant.delivery_enabled
          : true,
      pickupEnabled:
        typeof restaurant.pickup_enabled === "boolean"
          ? restaurant.pickup_enabled
          : true,
      themeColor: restaurant.theme_color ?? null,
      coverImageUrl: restaurant.cover_image_url ?? null,
      themeMode: restaurant.theme_mode ?? "dark",
      floatingCartBgColor:
        restaurant.floating_cart_bg_color ?? restaurant.theme_color ?? "#7c3aed",
      floatingCartTextColor: restaurant.floating_cart_text_color ?? "#ffffff",
      floatingCartNumberColor: restaurant.floating_cart_number_color ?? "#ffffff",
    }

    return NextResponse.json({
      restaurant: normalizedRestaurant,
      categories: normalizedCategories.sort((a, b) => a.order - b.order),
    })
  } catch (error) {
    console.error("GET /api/public/menu/[slug] error:", error)

    return NextResponse.json(
      { error: "Erro interno ao carregar o cardápio público." },
      { status: 500 }
    )
  }
}