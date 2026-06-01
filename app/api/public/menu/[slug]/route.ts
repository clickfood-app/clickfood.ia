import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function calculateRatingSummary(ratings: Array<{ customer_rating: number | string | null }>) {
  const validRatings = ratings
    .map((item) => Number(item.customer_rating))
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5)

  const ratingCount = validRatings.length

  if (ratingCount === 0) {
    return {
      ratingAverage: null,
      ratingCount: 0,
    }
  }

  const ratingTotal = validRatings.reduce((sum, rating) => sum + rating, 0)
  const ratingAverage = Number((ratingTotal / ratingCount).toFixed(1))

  return {
    ratingAverage,
    ratingCount,
  }
}

function pickFirstNumber(
  source: Record<string, unknown>,
  keys: string[],
  fallback: number | null = null
) {
  for (const key of keys) {
    if (!(key in source)) continue

    const value = source[key]

    if (value === null || value === undefined || value === "") continue

    const numericValue = Number(value)

    if (Number.isFinite(numericValue)) {
      return numericValue
    }
  }

  return fallback
}

function pickFirstBoolean(source: Record<string, unknown>, keys: string[], fallback = false) {
  for (const key of keys) {
    if (!(key in source)) continue

    const value = source[key]

    if (typeof value === "boolean") return value

    if (typeof value === "string") {
      const normalizedValue = value.trim().toLowerCase()

      if (["true", "1", "sim", "yes", "active", "ativo"].includes(normalizedValue)) {
        return true
      }

      if (["false", "0", "nao", "não", "no", "inactive", "inativo"].includes(normalizedValue)) {
        return false
      }
    }

    if (typeof value === "number") {
      return value === 1
    }
  }

  return fallback
}

function normalizeProductPricing(product: Record<string, unknown>) {
  const basePrice = toNumber(product.price, 0)

  const explicitOriginalPrice = pickFirstNumber(product, [
    "original_price",
    "originalPrice",
    "regular_price",
    "regularPrice",
    "base_price",
    "basePrice",
    "old_price",
    "oldPrice",
    "compare_at_price",
    "compareAtPrice",
    "list_price",
    "listPrice",
  ])

  const explicitPromotionalPrice = pickFirstNumber(product, [
    "promotional_price",
    "promotionalPrice",
    "promotion_price",
    "promotionPrice",
    "sale_price",
    "salePrice",
    "offer_price",
    "offerPrice",
    "discount_price",
    "discountPrice",
    "discounted_price",
    "discountedPrice",
    "price_on_menu",
    "priceOnMenu",
    "menu_price",
    "menuPrice",
  ])

  const explicitDiscountPercentage = pickFirstNumber(product, [
    "discount_percentage",
    "discountPercentage",
    "discount_percent",
    "discountPercent",
    "promotion_discount_percentage",
    "promotionDiscountPercentage",
    "promotion_percent",
    "promotionPercent",
  ])

  const explicitDiscountAmount = pickFirstNumber(product, [
    "discount_amount",
    "discountAmount",
    "promotion_discount_amount",
    "promotionDiscountAmount",
  ])

  const promotionFlag = pickFirstBoolean(product, [
    "is_promotional",
    "isPromotional",
    "is_promotion",
    "isPromotion",
    "has_promotion",
    "hasPromotion",
    "promotion_active",
    "promotionActive",
    "on_sale",
    "onSale",
  ])

  const promotionTypeRaw = String(
    product.promotion_type ??
      product.promotionType ??
      product.discount_type ??
      product.discountType ??
      ""
  )
    .trim()
    .toLowerCase()

  const promotionValue = pickFirstNumber(product, [
    "promotion_value",
    "promotionValue",
    "discount_value",
    "discountValue",
    "value",
  ])

  const originalPrice = explicitOriginalPrice ?? basePrice
  let finalPrice = basePrice

  if (
    explicitPromotionalPrice !== null &&
    explicitPromotionalPrice > 0 &&
    explicitPromotionalPrice < originalPrice
  ) {
    finalPrice = explicitPromotionalPrice
  } else if (
    promotionFlag &&
    promotionTypeRaw === "percentage" &&
    promotionValue !== null &&
    promotionValue > 0 &&
    promotionValue < 100
  ) {
    finalPrice = Number((basePrice * (1 - promotionValue / 100)).toFixed(2))
  } else if (
    promotionFlag &&
    promotionTypeRaw === "fixed" &&
    promotionValue !== null &&
    promotionValue > 0
  ) {
    finalPrice = Math.max(0, Number((basePrice - promotionValue).toFixed(2)))
  } else if (
    promotionFlag &&
    explicitDiscountPercentage !== null &&
    explicitDiscountPercentage > 0 &&
    explicitDiscountPercentage < 100
  ) {
    finalPrice = Number((basePrice * (1 - explicitDiscountPercentage / 100)).toFixed(2))
  } else if (
    promotionFlag &&
    explicitDiscountAmount !== null &&
    explicitDiscountAmount > 0
  ) {
    finalPrice = Math.max(0, Number((basePrice - explicitDiscountAmount).toFixed(2)))
  }

  const isPromotional = originalPrice > 0 && finalPrice > 0 && finalPrice < originalPrice

  const finalDiscountPercentage = isPromotional
    ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100)
    : 0

  return {
    price: finalPrice,
    originalPrice: isPromotional ? originalPrice : null,
    promotionalPrice: isPromotional ? finalPrice : null,
    isPromotional,
    discountPercentage: finalDiscountPercentage,
    promotionActive: promotionFlag,
    promotionType: promotionTypeRaw || null,
    promotionValue: promotionValue ?? 0,
  }
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

type ModifierGroupRow = {
  id: string
  restaurant_id: string
  name: string
  required: boolean | null
  min_select: number | string | null
  max_select: number | string | null
  sort_order: number | string | null
  is_active: boolean | null
  created_at?: string | null
}

type ModifierOptionRow = {
  id: string
  restaurant_id: string
  group_id: string
  name: string
  price: number | string | null
  sort_order: number | string | null
  is_active: boolean | null
  created_at?: string | null
}

type ProductModifierGroupLinkRow = {
  id: string
  restaurant_id: string
  product_id: string
  group_id: string
  sort_order: number | string | null
  is_active: boolean | null
  created_at?: string | null
}

type ProductAvailabilityRuleRow = {
  id: string
  restaurant_id: string
  product_id: string
  display_category_id: string | null
  weekdays: Array<number | string> | null
  start_time: string | null
  end_time: string | null
  is_active: boolean | null
  sort_order: number | string | null
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

    const [
      categoriesResult,
      productsResult,
      availabilityRulesResult,
      deliveryRulesResult,
      ratingsResult,
      modifierGroupsResult,
      modifierGroupLinksResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("categories")
        .select("id, restaurant_id, name, sort_order, is_active, created_at")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),

      supabaseAdmin
        .from("products")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .eq("is_available", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),

      supabaseAdmin
        .from("product_availability_rules")
        .select(
          "id, restaurant_id, product_id, display_category_id, weekdays, start_time, end_time, is_active, sort_order, created_at"
        )
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),

      supabaseAdmin
        .from("delivery_fee_rules")
        .select("id, restaurant_id, label, fee, neighborhoods, is_active, sort_order, created_at")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),

      supabaseAdmin
        .from("orders")
        .select("customer_rating")
        .eq("restaurant_id", restaurant.id)
        .not("customer_rating", "is", null),

      supabaseAdmin
        .from("modifier_groups")
        .select(
          "id, restaurant_id, name, required, min_select, max_select, sort_order, is_active, created_at"
        )
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),

      supabaseAdmin
        .from("product_modifier_group_links")
        .select(
          "id, restaurant_id, product_id, group_id, sort_order, is_active, created_at"
        )
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

    if (availabilityRulesResult.error) {
      console.error("Erro ao buscar regras de disponibilidade públicas:", {
        restaurantId: restaurant.id,
        message: availabilityRulesResult.error.message,
        details: availabilityRulesResult.error.details,
        hint: availabilityRulesResult.error.hint,
        code: availabilityRulesResult.error.code,
      })

      return NextResponse.json(
        {
          error:
            availabilityRulesResult.error.message ||
            "Erro ao buscar regras de disponibilidade dos produtos.",
        },
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

    if (ratingsResult.error) {
      console.error("Erro ao buscar avaliações públicas:", {
        restaurantId: restaurant.id,
        message: ratingsResult.error.message,
        details: ratingsResult.error.details,
        hint: ratingsResult.error.hint,
        code: ratingsResult.error.code,
      })

      return NextResponse.json(
        { error: ratingsResult.error.message || "Erro ao buscar avaliações." },
        { status: 500 }
      )
    }

    if (modifierGroupsResult.error) {
      console.error("Erro ao buscar grupos de complementos públicos:", {
        restaurantId: restaurant.id,
        message: modifierGroupsResult.error.message,
        details: modifierGroupsResult.error.details,
        hint: modifierGroupsResult.error.hint,
        code: modifierGroupsResult.error.code,
      })

      return NextResponse.json(
        {
          error:
            modifierGroupsResult.error.message ||
            "Erro ao buscar grupos de complementos do cardápio.",
        },
        { status: 500 }
      )
    }

    if (modifierGroupLinksResult.error) {
      console.error("Erro ao buscar vínculos de complementos públicos:", {
        restaurantId: restaurant.id,
        message: modifierGroupLinksResult.error.message,
        details: modifierGroupLinksResult.error.details,
        hint: modifierGroupLinksResult.error.hint,
        code: modifierGroupLinksResult.error.code,
      })

      return NextResponse.json(
        {
          error:
            modifierGroupLinksResult.error.message ||
            "Erro ao buscar vínculos de complementos do cardápio.",
        },
        { status: 500 }
      )
    }

    const modifierGroups = (modifierGroupsResult.data ?? []) as ModifierGroupRow[]
    const modifierGroupLinks =
      (modifierGroupLinksResult.data ?? []) as ProductModifierGroupLinkRow[]
    const modifierGroupIds = modifierGroups.map((group) => group.id)
    let modifierOptions: ModifierOptionRow[] = []

    if (modifierGroupIds.length > 0) {
      const { data: modifierOptionsData, error: modifierOptionsError } =
        await supabaseAdmin
          .from("modifier_group_options")
          .select("id, restaurant_id, group_id, name, price, sort_order, is_active, created_at")
          .eq("restaurant_id", restaurant.id)
          .eq("is_active", true)
          .in("group_id", modifierGroupIds)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })

      if (modifierOptionsError) {
        console.error("Erro ao buscar opções de complementos públicos:", {
          restaurantId: restaurant.id,
          message: modifierOptionsError.message,
          details: modifierOptionsError.details,
          hint: modifierOptionsError.hint,
          code: modifierOptionsError.code,
        })

        return NextResponse.json(
          {
            error:
              modifierOptionsError.message ||
              "Erro ao buscar opções de complementos do cardápio.",
          },
          { status: 500 }
        )
      }

      modifierOptions = (modifierOptionsData ?? []) as ModifierOptionRow[]
    }

    const optionsByGroup = new Map<string, ModifierOptionRow[]>()

    for (const option of modifierOptions) {
      const current = optionsByGroup.get(option.group_id) ?? []
      current.push(option)
      optionsByGroup.set(option.group_id, current)
    }

    const modifierGroupsById = new Map<string, ModifierGroupRow>()

    for (const group of modifierGroups) {
      modifierGroupsById.set(group.id, group)
    }

    const modifierGroupLinksByProduct = new Map<string, ProductModifierGroupLinkRow[]>()

    for (const link of modifierGroupLinks) {
      const current = modifierGroupLinksByProduct.get(link.product_id) ?? []
      current.push(link)
      modifierGroupLinksByProduct.set(link.product_id, current)
    }

    const modifierGroupsByProduct = new Map<
      string,
      Array<{
        id: string
        name: string
        required: boolean
        minSelect: number
        maxSelect: number
        options: Array<{
          id: string
          name: string
          price: number
        }>
      }>
    >()

    for (const [productId, links] of modifierGroupLinksByProduct.entries()) {
      const normalizedGroups = links
        .sort((a, b) => toNumber(a.sort_order, 0) - toNumber(b.sort_order, 0))
        .map((link) => {
          const group = modifierGroupsById.get(link.group_id)

          if (!group) return null

          return {
            id: group.id,
            name: group.name,
            required: Boolean(group.required),
            minSelect: toNumber(group.min_select, 0),
            maxSelect: Math.max(1, toNumber(group.max_select, 1)),
            options: (optionsByGroup.get(group.id) ?? [])
              .sort((a, b) => toNumber(a.sort_order, 0) - toNumber(b.sort_order, 0))
              .map((option) => ({
                id: option.id,
                name: option.name,
                price: toNumber(option.price, 0),
              })),
          }
        })
                .filter(
          (
            group
          ): group is {
            id: string
            name: string
            required: boolean
            minSelect: number
            maxSelect: number
            options: Array<{
              id: string
              name: string
              price: number
            }>
          } => {
            if (!group) return false

            return group.options.length > 0
          }
        )

      modifierGroupsByProduct.set(productId, normalizedGroups)
    }

    const categories = categoriesResult.data ?? []
    const products = productsResult.data ?? []
    const availabilityRules =
      (availabilityRulesResult.data ?? []) as ProductAvailabilityRuleRow[]
    const deliveryRules = (deliveryRulesResult.data ?? []) as DeliveryFeeRuleRow[]
    const ratingSummary = calculateRatingSummary(ratingsResult.data ?? [])

    const availabilityRulesByProduct = new Map<string, ProductAvailabilityRuleRow[]>()

    for (const rule of availabilityRules) {
      const current = availabilityRulesByProduct.get(rule.product_id) ?? []
      current.push(rule)
      availabilityRulesByProduct.set(rule.product_id, current)
    }

    const categoriesMap = new Map(categories.map((category) => [category.id, category]))
    const productsByCategory = new Map<string, any[]>()

    for (const product of products) {
      const categoryKey = product.category_id ?? "sem-categoria"
      const category = product.category_id
        ? categoriesMap.get(product.category_id)
        : null

      const pricing = normalizeProductPricing(product as Record<string, unknown>)
      const productAvailabilityRules = (availabilityRulesByProduct.get(product.id) ?? []).map(
        (rule) => ({
          id: rule.id,
          restaurantId: rule.restaurant_id,
          restaurant_id: rule.restaurant_id,
          productId: rule.product_id,
          product_id: rule.product_id,
          displayCategoryId: rule.display_category_id,
          display_category_id: rule.display_category_id,
          weekdays: Array.isArray(rule.weekdays)
            ? rule.weekdays
                .map((weekday) => Number(weekday))
                .filter((weekday) =>
                  Number.isInteger(weekday) && weekday >= 0 && weekday <= 6
                )
            : [],
          startTime: rule.start_time,
          start_time: rule.start_time,
          endTime: rule.end_time,
          end_time: rule.end_time,
          isActive: rule.is_active ?? true,
          is_active: rule.is_active ?? true,
          sortOrder: toNumber(rule.sort_order, 0),
          sort_order: toNumber(rule.sort_order, 0),
        })
      )

      const availabilityType = String(product.availability_type ?? "always")
      const productModifierGroups = modifierGroupsByProduct.get(product.id) ?? []

      const normalizedProduct = {
        id: product.id,
        restaurantId: product.restaurant_id,
        categoryId: product.category_id,
        category: category?.name ?? "Sem categoria",
        name: product.name,
        description: product.description ?? "",
        price: pricing.price,
        originalPrice: pricing.originalPrice,
        original_price: pricing.originalPrice,
        promotionalPrice: pricing.promotionalPrice,
        promotional_price: pricing.promotionalPrice,
        isPromotional: pricing.isPromotional,
        is_promotional: pricing.isPromotional,
        discountPercentage: pricing.discountPercentage,
        discount_percentage: pricing.discountPercentage,
        promotionActive: pricing.promotionActive,
        promotion_active: pricing.promotionActive,
        promotionType: pricing.promotionType,
        promotion_type: pricing.promotionType,
        promotionValue: pricing.promotionValue,
        promotion_value: pricing.promotionValue,
        cost: 0,
        active: product.is_available ?? true,
        availabilityType,
        availability_type: availabilityType,
        availabilityRules: productAvailabilityRules,
        availability_rules: productAvailabilityRules,
        productAvailabilityRules,
        product_availability_rules: productAvailabilityRules,
        salesCount: 0,
        order: toNumber(product.sort_order, 0),
        image: product.image_url ?? null,
        imageSize: null,
        imageUrl: product.image_url ?? null,
        modifierGroups: productModifierGroups,
        modifier_groups: productModifierGroups,
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
      pixEnabled: Boolean(restaurant.pix_enabled ?? false),
      pix_enabled: Boolean(restaurant.pix_enabled ?? false),
      pixKey: restaurant.pix_key ?? null,
      pix_key: restaurant.pix_key ?? null,
      pixKeyType: restaurant.pix_key_type ?? null,
      pix_key_type: restaurant.pix_key_type ?? null,
      pixReceiverName: restaurant.pix_receiver_name ?? null,
      pix_receiver_name: restaurant.pix_receiver_name ?? null,
      pixReceiverCity: restaurant.pix_receiver_city ?? null,
      pix_receiver_city: restaurant.pix_receiver_city ?? null,
      pixInstructions: restaurant.pix_instructions ?? null,
      pix_instructions: restaurant.pix_instructions ?? null,
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
      ratingAverage: ratingSummary.ratingAverage,
      ratingCount: ratingSummary.ratingCount,
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