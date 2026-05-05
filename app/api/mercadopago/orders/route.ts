import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

type OrderStatus = "pending" | "preparing" | "finished" | "cancelled"
type PaymentMethod = "Pix" | "Cartao" | "Dinheiro" | "Vale Refeicao"

function mapStatus(status: string): OrderStatus {
  if (status === "pending") return "pending"
  if (status === "preparing") return "preparing"
  if (status === "finished") return "finished"
  if (status === "cancelled") return "cancelled"
  return "pending"
}

function mapPaymentMethod(method: string): PaymentMethod {
  if (method === "Pix") return "Pix"
  if (method === "Cartao") return "Cartao"
  if (method === "Dinheiro") return "Dinheiro"
  if (method === "Vale Refeicao") return "Vale Refeicao"
  return "Pix"
}

async function getSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )
}

async function getAuthenticatedUser() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

async function getRestaurantIdByUserId(userId: string) {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return String(data.id)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return NextResponse.json(
        { message: "Usuário não autenticado" },
        { status: 401 }
      )
    }

    const restaurantId = await getRestaurantIdByUserId(user.id)

    if (!restaurantId) {
      return NextResponse.json(
        { message: "Restaurante não encontrado para este usuário" },
        { status: 404 }
      )
    }

    const supabase = await getSupabaseServerClient()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get("search") ?? ""
    const dateFrom = searchParams.get("dateFrom") ?? ""
    const dateTo = searchParams.get("dateTo") ?? ""
    const status = searchParams.get("status") ?? ""
    const paymentMethod = searchParams.get("paymentMethod") ?? ""
    const minValue = searchParams.get("minValue") ?? ""
    const maxValue = searchParams.get("maxValue") ?? ""
    const page = Number(searchParams.get("page") ?? "1")
    const perPage = Number(searchParams.get("perPage") ?? "10")

    const from = (page - 1) * perPage
    const to = from + perPage - 1

    let query = supabase
      .from("orders")
      .select(
        `
          id,
          total,
          status,
          payment_method,
          created_at,
          customer:customers (
            name,
            phone
          ),
          items:order_items (
            quantity,
            unit_price,
            subtotal,
            product:products (
              id,
              name
            )
          )
        `,
        { count: "exact" }
      )
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })

    if (dateFrom) {
      query = query.gte("created_at", `${dateFrom}T00:00:00`)
    }

    if (dateTo) {
      query = query.lte("created_at", `${dateTo}T23:59:59`)
    }

    if (status) {
      query = query.eq("status", status)
    }

    if (paymentMethod) {
      query = query.eq("payment_method", paymentMethod)
    }

    if (minValue) {
      const parsed = Number(minValue)
      if (!Number.isNaN(parsed)) {
        query = query.gte("total", parsed)
      }
    }

    if (maxValue) {
      const parsed = Number(maxValue)
      if (!Number.isNaN(parsed)) {
        query = query.lte("total", parsed)
      }
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    const orders =
      data?.map((order: any) => {
        const customer = Array.isArray(order.customer)
          ? order.customer[0]
          : order.customer

        return {
          id: String(order.id),
          clientName: customer?.name ?? "Cliente sem nome",
          clientPhone: customer?.phone ?? "",
          status: mapStatus(order.status),
          paymentMethod: mapPaymentMethod(order.payment_method),
          items:
            order.items?.map((item: any) => {
              const product = Array.isArray(item.product)
                ? item.product[0]
                : item.product

              return {
                productId: product?.id ? String(product.id) : "",
                name: product?.name ?? "Produto",
                quantity: Number(item.quantity ?? 0),
                unitPrice: Number(item.unit_price ?? 0),
                subtotal: Number(item.subtotal ?? 0),
              }
            }) ?? [],
          total: Number(order.total ?? 0),
          date: String(order.created_at).slice(0, 10),
          createdAt: String(order.created_at),
        }
      }) ?? []

    const filteredOrders = search
      ? orders.filter((o) => {
          const q = search.toLowerCase()
          return (
            o.clientName.toLowerCase().includes(q) ||
            o.clientPhone.includes(q) ||
            o.id.toLowerCase().includes(q)
          )
        })
      : orders

    return NextResponse.json({
      data: filteredOrders,
      totalPages: Math.ceil((count ?? 0) / perPage),
      totalItems: count ?? 0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Erro interno ao buscar pedidos",
      },
      { status: 500 }
    )
  }
}