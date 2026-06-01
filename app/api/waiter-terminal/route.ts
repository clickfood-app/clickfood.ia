import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

type WaiterOrderModifier = {
  option_id?: string
  option_name?: string
  name?: string
  price_delta?: number | string | null
  price?: number | string | null
}

type WaiterOrderItem = {
  product_id: string
  quantity: number
  modifiers?: WaiterOrderModifier[]
}

type CreateWaiterOrderPayload = {
  slug?: string
  table_id?: string | null
  table_number?: string | number | null
  guest_count?: number | string | null
  notes?: string | null
  items?: WaiterOrderItem[]
}

type OrderItemRow = {
  id: string
  order_id: string
  product_id?: string | null
  product_name?: string | null
  quantity?: number | string | null
  unit_price?: number | string | null
  total_price?: number | string | null
  [key: string]: unknown
}

function getCookieName(slug: string) {
  return `waiter_session_${slug}`
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".")
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function createPublicOrderNumber() {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, "0")
  const minutes = String(now.getMinutes()).padStart(2, "0")
  const seconds = String(now.getSeconds()).padStart(2, "0")
  const random = Math.floor(Math.random() * 900 + 100)

  return `G${hours}${minutes}${seconds}${random}`
}

function getProductName(product: Record<string, unknown>) {
  return (
    String(product.name || "").trim() ||
    String(product.title || "").trim() ||
    "Produto sem nome"
  )
}

function getProductPrice(product: Record<string, unknown>) {
  const possiblePrices = [
    product.price,
    product.sale_price,
    product.selling_price,
    product.final_price,
    product.base_price,
  ]

  for (const price of possiblePrices) {
    const number = toNumber(price)

    if (number > 0) return number
  }

  return 0
}

function getOptionName(option: Record<string, unknown>) {
  return (
    String(option.name || "").trim() ||
    String(option.title || "").trim() ||
    String(option.label || "").trim() ||
    "Complemento"
  )
}

function getOptionPrice(option: Record<string, unknown>) {
  return (
    toNumber(option.price_delta) ||
    toNumber(option.additional_price) ||
    toNumber(option.extra_price) ||
    toNumber(option.price) ||
    0
  )
}

function getGroupName(group: Record<string, unknown>) {
  return (
    String(group.name || "").trim() ||
    String(group.title || "").trim() ||
    "Complementos"
  )
}

function getGroupMin(group: Record<string, unknown>) {
  return (
    toNumber(group.min_select) ||
    toNumber(group.min_selection) ||
    toNumber(group.minimum_options) ||
    toNumber(group.min_required) ||
    0
  )
}

function getGroupMax(group: Record<string, unknown>) {
  return (
    toNumber(group.max_select) ||
    toNumber(group.max_selection) ||
    toNumber(group.maximum_options) ||
    toNumber(group.max_allowed) ||
    0
  )
}

function getTableSortValue(table: Record<string, unknown>) {
  return (
    toNumber(table.table_number) ||
    toNumber(table.number) ||
    toNumber(table.name) ||
    toNumber(table.label) ||
    999999
  )
}

function isOpenTableOrder(order: Record<string, unknown>) {
  const paymentStatus = String(order.payment_status || "").toLowerCase()
  const status = String(order.status || "").toLowerCase()

  if (paymentStatus === "paid") return false

  return !["cancelled", "canceled", "cancelado"].includes(status)
}

async function getWaiterSession(request: NextRequest, slug: string) {
  const token = request.cookies.get(getCookieName(slug))?.value

  if (!token) {
    return {
      error: NextResponse.json(
        {
          success: false,
          authenticated: false,
          error: "Sessão do garçom não encontrada.",
        },
        { status: 401 },
      ),
      waiter: null,
      restaurant: null,
    }
  }

  const { data: sessionData, error: sessionError } = await supabaseAdmin.rpc(
    "validate_waiter_session",
    {
      p_token: token,
    },
  )

  if (sessionError) {
    console.error("Erro ao validar sessão do garçom:", sessionError)

    return {
      error: NextResponse.json(
        {
          success: false,
          authenticated: false,
          error: "Erro ao validar sessão do garçom.",
        },
        { status: 500 },
      ),
      waiter: null,
      restaurant: null,
    }
  }

  const waiter = Array.isArray(sessionData) ? sessionData[0] : null

  if (!waiter) {
    return {
      error: NextResponse.json(
        {
          success: false,
          authenticated: false,
          error: "Sessão inválida ou expirada.",
        },
        { status: 401 },
      ),
      waiter: null,
      restaurant: null,
    }
  }

  const { data: restaurant, error: restaurantError } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, slug, logo_url, description")
    .eq("id", waiter.restaurant_id)
    .eq("slug", slug)
    .maybeSingle()

  if (restaurantError) {
    console.error("Erro ao buscar restaurante do garçom:", restaurantError)

    return {
      error: NextResponse.json(
        {
          success: false,
          authenticated: false,
          error: "Erro ao buscar restaurante.",
        },
        { status: 500 },
      ),
      waiter: null,
      restaurant: null,
    }
  }

  if (!restaurant) {
    return {
      error: NextResponse.json(
        {
          success: false,
          authenticated: false,
          error: "Restaurante não encontrado para essa sessão.",
        },
        { status: 404 },
      ),
      waiter: null,
      restaurant: null,
    }
  }

  return {
    error: null,
    waiter,
    restaurant,
  }
}

async function loadProductModifierGroups(restaurantId: string, productIds: string[]) {
  if (productIds.length === 0) return {}

  try {
    const { data: links, error: linksError } = await supabaseAdmin
      .from("product_modifier_group_links")
      .select("*")
      .in("product_id", productIds)

    if (linksError) {
      console.error("Erro ao buscar vínculos de complementos:", linksError)
      return {}
    }

    const modifierGroupIds = Array.from(
      new Set(
        (links || [])
          .map((link) =>
            String(link.modifier_group_id || link.group_id || "").trim(),
          )
          .filter(Boolean),
      ),
    )

    if (modifierGroupIds.length === 0) return {}

    const [groupsResponse, optionsResponse] = await Promise.all([
      supabaseAdmin
        .from("modifier_groups")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .in("id", modifierGroupIds),
      supabaseAdmin
        .from("modifier_group_options")
        .select("*")
        .in("group_id", modifierGroupIds),
    ])

    if (groupsResponse.error) {
      console.error("Erro ao buscar grupos de complementos:", groupsResponse.error)
      return {}
    }

    if (optionsResponse.error) {
      console.error("Erro ao buscar opções de complementos:", optionsResponse.error)
      return {}
    }

    const optionsByGroup = new Map<string, Record<string, unknown>[]>()

    for (const option of optionsResponse.data || []) {
      if (option.is_active === false) continue

      const groupId = String(
        option.group_id || option.modifier_group_id || "",
      ).trim()

      if (!groupId) continue

      const current = optionsByGroup.get(groupId) || []
      current.push(option)
      optionsByGroup.set(groupId, current)
    }

    const groupById = new Map<string, Record<string, unknown>>()

    for (const group of groupsResponse.data || []) {
      if (group.is_active === false) continue
      groupById.set(String(group.id), group)
    }

    const modifiersByProduct: Record<string, unknown[]> = {}

    for (const link of links || []) {
      const productId = String(link.product_id || "").trim()
      const groupId = String(
        link.modifier_group_id || link.group_id || "",
      ).trim()

      if (!productId || !groupId) continue

      const group = groupById.get(groupId)

      if (!group) continue

      const options = (optionsByGroup.get(groupId) || []).map((option) => ({
        id: String(option.id),
        name: getOptionName(option),
        price_delta: getOptionPrice(option),
      }))

      if (options.length === 0) continue

      const normalizedGroup = {
        id: groupId,
        name: getGroupName(group),
        min_select: getGroupMin(group),
        max_select: getGroupMax(group),
        is_required:
          Boolean(group.is_required) ||
          Boolean(group.required) ||
          getGroupMin(group) > 0,
        options,
      }

      if (!modifiersByProduct[productId]) {
        modifiersByProduct[productId] = []
      }

      modifiersByProduct[productId].push(normalizedGroup)
    }

    return modifiersByProduct
  } catch (err) {
    console.error("Erro inesperado ao montar complementos:", err)
    return {}
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = String(searchParams.get("slug") || "").trim()

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Slug do restaurante não informado." },
        { status: 400 },
      )
    }

    const { error, waiter, restaurant } = await getWaiterSession(request, slug)

    if (error) return error

    if (!waiter || !restaurant) {
      return NextResponse.json(
        { success: false, error: "Sessão inválida." },
        { status: 401 },
      )
    }

    const [tablesResponse, categoriesResponse, productsResponse, ordersResponse] =
      await Promise.all([
        supabaseAdmin
          .from("restaurant_tables")
          .select("*")
          .eq("restaurant_id", restaurant.id),
        supabaseAdmin
          .from("categories")
          .select("*")
          .eq("restaurant_id", restaurant.id),
        supabaseAdmin
          .from("products")
          .select("*")
          .eq("restaurant_id", restaurant.id),
        supabaseAdmin
          .from("orders")
          .select(
            "id, public_order_number, table_id, table_number, guest_count, status, payment_status, total, subtotal, notes, created_at, waiter_name, order_source",
          )
          .eq("restaurant_id", restaurant.id),
      ])

    if (tablesResponse.error) {
      console.error("Erro ao buscar mesas:", tablesResponse.error)

      return NextResponse.json(
        {
          success: false,
          error: `Erro ao buscar mesas: ${tablesResponse.error.message}`,
        },
        { status: 500 },
      )
    }

    if (categoriesResponse.error) {
      console.error("Erro ao buscar categorias:", categoriesResponse.error)

      return NextResponse.json(
        {
          success: false,
          error: `Erro ao buscar categorias: ${categoriesResponse.error.message}`,
        },
        { status: 500 },
      )
    }

    if (productsResponse.error) {
      console.error("Erro ao buscar produtos:", productsResponse.error)

      return NextResponse.json(
        {
          success: false,
          error: `Erro ao buscar produtos: ${productsResponse.error.message}`,
        },
        { status: 500 },
      )
    }

    if (ordersResponse.error) {
      console.error("Erro ao buscar comandas abertas:", ordersResponse.error)

      return NextResponse.json(
        {
          success: false,
          error: `Erro ao buscar comandas abertas: ${ordersResponse.error.message}`,
        },
        { status: 500 },
      )
    }

    const tables = [...(tablesResponse.data || [])].sort((a, b) => {
      return getTableSortValue(a) - getTableSortValue(b)
    })

    const categories = [...(categoriesResponse.data || [])].sort((a, b) => {
      const nameA = String(a.name || a.title || "").toLowerCase()
      const nameB = String(b.name || b.title || "").toLowerCase()

      return nameA.localeCompare(nameB)
    })

    const products = [...(productsResponse.data || [])]
      .filter((product) => {
        if (product.is_active === false) return false
        if (product.is_available === false) return false

        return true
      })
      .sort((a, b) => {
        const nameA = String(a.name || a.title || "").toLowerCase()
        const nameB = String(b.name || b.title || "").toLowerCase()

        return nameA.localeCompare(nameB)
      })

    const openOrders = [...(ordersResponse.data || [])]
      .filter((order) => isOpenTableOrder(order))
      .sort((a, b) => {
        return (
          new Date(String(a.created_at || "")).getTime() -
          new Date(String(b.created_at || "")).getTime()
        )
      })

    const openOrderIds = openOrders.map((order) => String(order.id))

    const orderItemsByOrderId = new Map<string, OrderItemRow[]>()

    if (openOrderIds.length > 0) {
      const { data: orderItemsData, error: orderItemsError } = await supabaseAdmin
        .from("order_items")
        .select("*")
        .in("order_id", openOrderIds)

      if (orderItemsError) {
        console.error("Erro ao buscar itens das comandas:", orderItemsError)
      } else {
        for (const item of (orderItemsData || []) as OrderItemRow[]) {
          const orderId = String(item.order_id || "")

          if (!orderId) continue

          const current = orderItemsByOrderId.get(orderId) || []
          current.push(item)
          orderItemsByOrderId.set(orderId, current)
        }
      }
    }

    const openOrdersWithItems = openOrders.map((order) => ({
      ...order,
      items: orderItemsByOrderId.get(String(order.id)) || [],
    }))

    const productIds = products.map((product) => String(product.id))
    const productModifierGroups = await loadProductModifierGroups(
      restaurant.id,
      productIds,
    )

    return NextResponse.json({
      success: true,
      authenticated: true,
      restaurant,
      waiter: {
        id: waiter.waiter_id,
        name: waiter.waiter_name,
        role: waiter.waiter_role,
        restaurant_id: waiter.restaurant_id,
      },
      tables,
      open_orders: openOrdersWithItems,
      categories,
      products,
      product_modifier_groups: productModifierGroups,
    })
  } catch (err) {
    console.error("Erro inesperado ao carregar terminal do garçom:", err)

    return NextResponse.json(
      {
        success: false,
        error: "Erro inesperado ao carregar terminal do garçom.",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateWaiterOrderPayload

    const slug = String(body.slug || "").trim()

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Slug do restaurante não informado." },
        { status: 400 },
      )
    }

    const { error, waiter, restaurant } = await getWaiterSession(request, slug)

    if (error) return error

    if (!waiter || !restaurant) {
      return NextResponse.json(
        { success: false, error: "Sessão inválida." },
        { status: 401 },
      )
    }

    const items = Array.isArray(body.items) ? body.items : []

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Adicione pelo menos um item ao pedido." },
        { status: 400 },
      )
    }

    const tableNumber = body.table_number
      ? String(body.table_number).trim()
      : ""

    if (!tableNumber) {
      return NextResponse.json(
        { success: false, error: "Selecione uma mesa antes de enviar." },
        { status: 400 },
      )
    }

    const productIds = items
      .map((item) => String(item.product_id || "").trim())
      .filter(Boolean)

    if (productIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nenhum produto válido informado." },
        { status: 400 },
      )
    }

    const modifierOptionIds = Array.from(
      new Set(
        items
          .flatMap((item) => item.modifiers || [])
          .map((modifier) => String(modifier.option_id || "").trim())
          .filter(Boolean),
      ),
    )

    const [productsResponse, optionsResponse] = await Promise.all([
      supabaseAdmin
        .from("products")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .in("id", productIds),
      modifierOptionIds.length > 0
        ? supabaseAdmin
            .from("modifier_group_options")
            .select("*")
            .in("id", modifierOptionIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (productsResponse.error) {
      console.error("Erro ao buscar produtos do pedido:", productsResponse.error)

      return NextResponse.json(
        { success: false, error: "Erro ao buscar produtos do pedido." },
        { status: 500 },
      )
    }

    if (optionsResponse.error) {
      console.error("Erro ao buscar complementos do pedido:", optionsResponse.error)
    }

    const products = productsResponse.data || []
    const options = optionsResponse.data || []

    const productById = new Map(products.map((product) => [String(product.id), product]))
    const optionById = new Map(options.map((option) => [String(option.id), option]))

    const orderItems = items.map((item) => {
      const productId = String(item.product_id || "").trim()
      const product = productById.get(productId)

      if (!product) {
        throw new Error("Produto inválido no pedido.")
      }

      const quantity = Math.max(1, toNumber(item.quantity))
      const basePrice = getProductPrice(product)

      const selectedModifiers = (item.modifiers || [])
        .map((modifier) => {
          const optionId = String(modifier.option_id || "").trim()
          const optionFromDatabase = optionById.get(optionId)

          if (optionFromDatabase) {
            return {
              name: getOptionName(optionFromDatabase),
              price: getOptionPrice(optionFromDatabase),
            }
          }

          return {
            name:
              String(modifier.option_name || modifier.name || "").trim() ||
              "Complemento",
            price: toNumber(modifier.price_delta || modifier.price),
          }
        })
        .filter((modifier) => modifier.name)

      const modifiersTotal = selectedModifiers.reduce((sum, modifier) => {
        return sum + modifier.price
      }, 0)

      const unitPrice = basePrice + modifiersTotal
      const totalPrice = quantity * unitPrice

      const modifierText = selectedModifiers.length
        ? ` (${selectedModifiers.map((modifier) => modifier.name).join(", ")})`
        : ""

      return {
        product_id: product.id,
        product_name: `${getProductName(product)}${modifierText}`,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
      }
    })

    const subtotal = orderItems.reduce((sum, item) => {
      return sum + item.total_price
    }, 0)

    const guestCount = Math.max(1, toNumber(body.guest_count) || 1)

    const { data: insertedOrder, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        restaurant_id: restaurant.id,
        public_order_number: createPublicOrderNumber(),
        customer_name: `Mesa ${tableNumber}`,
        customer_phone: "Não informado",
        status: "pending",
        payment_status: "pending",
        payment_method: "mesa",
        subtotal,
        delivery_fee: 0,
        total: subtotal,
        notes: String(body.notes || "").trim() || null,
        table_id: body.table_id || null,
        table_number: tableNumber,
        guest_count: guestCount,
        waiter_user_id: waiter.waiter_id,
        waiter_name: waiter.waiter_name,
        order_source: "waiter",
      })
      .select("id")
      .single()

    if (orderError) {
      console.error("Erro ao criar pedido do garçom:", orderError)

      return NextResponse.json(
        {
          success: false,
          error: `Erro ao criar pedido do garçom: ${orderError.message}`,
        },
        { status: 500 },
      )
    }

    const orderItemsPayload = orderItems.map((item) => ({
      order_id: insertedOrder.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }))

    const { error: orderItemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsPayload)

    if (orderItemsError) {
      console.error("Erro ao criar itens do pedido:", orderItemsError)

      await supabaseAdmin.from("orders").delete().eq("id", insertedOrder.id)

      return NextResponse.json(
        {
          success: false,
          error: `Erro ao criar itens do pedido: ${orderItemsError.message}`,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      order_id: insertedOrder.id,
    })
  } catch (err) {
    console.error("Erro inesperado ao criar pedido do garçom:", err)

    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Erro inesperado ao criar pedido do garçom.",
      },
      { status: 500 },
    )
  }
}