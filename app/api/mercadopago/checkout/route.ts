import { NextRequest, NextResponse } from "next/server"

interface CheckoutItem {
  title: string
  quantity: number
  unit_price: number
  description?: string
}

interface CheckoutRequest {
  restaurantId: string
  items: CheckoutItem[]
  customerName: string
  customerPhone: string
  customerAddress?: string
  orderType: "delivery" | "pickup"
  deliveryFee?: number
  serviceFee?: number
}

// This would come from Supabase in production
function getRestaurantMercadoPagoToken(restaurantId: string): string | null {
  // In production, fetch from database
  // For demo, we check localStorage on client and pass token in request
  // But since this is server-side, we use env var for demo
  return process.env.MERCADOPAGO_RESTAURANT_ACCESS_TOKEN || null
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutRequest & { accessToken?: string } = await request.json()
    const { restaurantId, items, customerName, customerPhone, customerAddress, orderType, deliveryFee = 0, serviceFee = 0, accessToken } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Carrinho vazio" }, { status: 400 })
    }

    // Get restaurant's Mercado Pago access token
    // In production this would come from database
    const mpAccessToken = accessToken || getRestaurantMercadoPagoToken(restaurantId)

    if (!mpAccessToken) {
      return NextResponse.json(
        { error: "Restaurante nao configurado para pagamentos online" },
        { status: 400 }
      )
    }

    // Build preference items
    const preferenceItems = items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      unit_price: item.unit_price,
      currency_id: "BRL",
      description: item.description || "",
    }))

    // Add service fee as item if present
    if (serviceFee > 0) {
      preferenceItems.push({
        title: "Taxa de servico",
        quantity: 1,
        unit_price: serviceFee,
        currency_id: "BRL",
        description: "Taxa de servico do pedido",
      })
    }

    // Add delivery fee as item if present
    if (orderType === "delivery" && deliveryFee > 0) {
      preferenceItems.push({
        title: "Taxa de entrega",
        quantity: 1,
        unit_price: deliveryFee,
        currency_id: "BRL",
        description: "Taxa de entrega",
      })
    }

    // Create preference in Mercado Pago
    const preference = {
      items: preferenceItems,
      payer: {
        name: customerName,
        phone: {
          number: customerPhone.replace(/\D/g, ""),
        },
        address: customerAddress
          ? {
              street_name: customerAddress,
            }
          : undefined,
      },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL || "https://clickfood.vercel.app"}/cardapio/pedido-confirmado`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL || "https://clickfood.vercel.app"}/cardapio/pedido-falhou`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL || "https://clickfood.vercel.app"}/cardapio/pedido-pendente`,
      },
      auto_return: "approved",
      statement_descriptor: "CLICKFOOD",
      external_reference: `order_${Date.now()}`,
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://clickfood.vercel.app"}/api/mercadopago/webhook`,
      metadata: {
        restaurant_id: restaurantId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        order_type: orderType,
      },
    }

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify(preference),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("Mercado Pago error:", error)
      return NextResponse.json(
        { error: "Erro ao criar checkout" },
        { status: 500 }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      checkoutUrl: data.init_point,
      preferenceId: data.id,
    })
  } catch (error) {
    console.error("Checkout error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
