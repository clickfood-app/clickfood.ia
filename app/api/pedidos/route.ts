import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type CreateOrderItemInput = {
  product_id: string
  quantity: number
}

type CreateOrderBody = {
  customer_name?: string
  customer_phone?: string
  status?: string
  payment_method?: string
  notes?: string
  source?: string
  order_type?: string
  table_number?: string
  delivery_address?: string
  discount_amount?: number | string
  delivery_fee?: number | string
  coupon_code?: string
  items?: CreateOrderItemInput[]
}

export async function GET() {
  try {
    console.log("API PEDIDOS RODANDO")
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
    }

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, owner_id, name")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao buscar restaurante:", restaurantError)
      return NextResponse.json(
        { error: "Erro ao buscar restaurante." },
        { status: 500 }
      )
    }

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurante não encontrado para este usuário." },
        { status: 404 }
      )
    }

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        restaurant_id,
        customer_name,
        customer_phone,
        status,
        total,
        payment_method,
        payment_status,
        notes,
        source,
        order_type,
        table_number,
        delivery_address,
        subtotal,
        discount_amount,
        delivery_fee,
        coupon_code,
        created_at,
        updated_at
      `)
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })

    if (ordersError) {
      console.error("Erro ao buscar pedidos:", ordersError)
      return NextResponse.json(
        { error: "Erro ao buscar pedidos." },
        { status: 500 }
      )
    }

    const visibleOrders = (orders ?? []).filter((order) => {
      const paymentMethod = String(order.payment_method || "").toLowerCase()
      const paymentStatus = String(order.payment_status || "").toLowerCase()

      if (paymentMethod !== "pix") {
        return true
      }

      return paymentStatus === "paid"
    })

    return NextResponse.json({
      restaurant,
      orders: visibleOrders,
    })
  } catch (error) {
    console.error("GET /api/pedidos error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
    }

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, owner_id")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao buscar restaurante:", restaurantError)
      return NextResponse.json(
        { error: "Erro ao buscar restaurante." },
        { status: 500 }
      )
    }

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurante não encontrado para este usuário." },
        { status: 404 }
      )
    }

    const body = (await req.json()) as CreateOrderBody

    const customerName = String(body?.customer_name || "").trim() || null
    const customerPhone = String(body?.customer_phone || "").trim() || null
    const status = String(body?.status || "pending").trim() || "pending"
    const paymentMethod = String(body?.payment_method || "").trim() || null
    const notes = String(body?.notes || "").trim() || null
    const source = String(body?.source || "admin").trim() || "admin"
    const orderType = String(body?.order_type || "delivery").trim() || "delivery"
    const tableNumber = String(body?.table_number || "").trim() || null
    const deliveryAddress =
      String(body?.delivery_address || "").trim() || null
    const couponCode = String(body?.coupon_code || "").trim() || null
    const discountAmount = Number(body?.discount_amount || 0)
    const deliveryFee = Number(body?.delivery_fee || 0)
    const items = Array.isArray(body?.items) ? body.items : []

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Adicione ao menos um item ao pedido." },
        { status: 400 }
      )
    }

    const productIds = items
      .map((item) => item.product_id)
      .filter(Boolean)

    if (productIds.length === 0) {
      return NextResponse.json(
        { error: "Itens inválidos." },
        { status: 400 }
      )
    }

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, restaurant_id, name, price, active")
      .in("id", productIds)

    if (productsError) {
      console.error("Erro ao buscar produtos:", productsError)
      return NextResponse.json(
        { error: "Erro ao buscar produtos." },
        { status: 500 }
      )
    }

    if (!products || products.length === 0) {
      return NextResponse.json(
        { error: "Nenhum produto válido encontrado." },
        { status: 400 }
      )
    }

    const invalidProduct = products.find(
      (product) =>
        product.restaurant_id !== restaurant.id || product.active === false
    )

    if (invalidProduct) {
      return NextResponse.json(
        { error: "Há produto inválido ou inativo no pedido." },
        { status: 400 }
      )
    }

    const orderItemsPayload = items.map((item) => {
      const product = products.find((p) => p.id === item.product_id)
      const quantity = Number(item.quantity || 0)

      if (!product || quantity <= 0) {
        return null
      }

      return {
        product_id: product.id,
        quantity,
        price: Number(product.price || 0),
      }
    })

    const validOrderItems = orderItemsPayload.filter(Boolean) as Array<{
      product_id: string
      quantity: number
      price: number
    }>

    if (validOrderItems.length === 0) {
      return NextResponse.json(
        { error: "Os itens do pedido são inválidos." },
        { status: 400 }
      )
    }

    const subtotal = validOrderItems.reduce(
      (acc, item) => acc + Number(item.price) * Number(item.quantity),
      0
    )

    const normalizedDiscount = discountAmount > 0 ? discountAmount : 0
    const normalizedDeliveryFee = deliveryFee > 0 ? deliveryFee : 0
    const total = subtotal - normalizedDiscount + normalizedDeliveryFee

    const { data: createdOrder, error: createOrderError } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurant.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        status,
        total,
        payment_method: paymentMethod,
        notes,
        source,
        order_type: orderType,
        table_number: tableNumber,
        delivery_address: deliveryAddress,
        subtotal,
        discount_amount: normalizedDiscount,
        delivery_fee: normalizedDeliveryFee,
        coupon_code: couponCode,
      })
      .select("*")
      .single()

    if (createOrderError) {
      console.error("Erro ao criar pedido:", createOrderError)
      return NextResponse.json(
        { error: "Erro ao criar pedido." },
        { status: 500 }
      )
    }

    const orderItemsToInsert = validOrderItems.map((item) => ({
      order_id: createdOrder.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price,
    }))

    const { error: orderItemsError } = await supabase
      .from("order_items")
      .insert(orderItemsToInsert)

    if (orderItemsError) {
      console.error("Erro ao criar itens do pedido:", orderItemsError)
      return NextResponse.json(
        { error: "Pedido criado, mas houve erro ao salvar os itens." },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        order: createdOrder,
        items: orderItemsToInsert,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/pedidos error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    )
  }
}