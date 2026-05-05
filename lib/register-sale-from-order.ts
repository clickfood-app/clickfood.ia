import type { SupabaseClient } from "@supabase/supabase-js"

type OrderRow = {
  id: string
  restaurant_id: string | null
  customer_name: string | null
  status: string | null
  total: number | string | null
  payment_method: string | null
  notes: string | null
}

export async function registerSaleFromOrder(
  supabase: SupabaseClient,
  order: OrderRow,
  userId: string
) {
  const normalizedStatus = String(order.status || "").trim().toLowerCase()

  const shouldRegister =
    normalizedStatus === "concluido" ||
    normalizedStatus === "concluído" ||
    normalizedStatus === "pago" ||
    normalizedStatus === "completed" ||
    normalizedStatus === "paid"

  if (!shouldRegister) {
    return {
      success: false,
      skipped: true,
      reason: "Status não exige registro no histórico.",
    }
  }

  const { data: existingSale, error: existingSaleError } = await supabase
    .from("sales_history")
    .select("id")
    .eq("order_id", order.id)
    .maybeSingle()

  if (existingSaleError) {
    return {
      success: false,
      skipped: false,
      reason: existingSaleError.message,
    }
  }

  if (existingSale) {
    return {
      success: true,
      skipped: true,
      reason: "Venda já registrada para este pedido.",
    }
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("quantity")
    .eq("order_id", order.id)

  if (itemsError) {
    return {
      success: false,
      skipped: false,
      reason: itemsError.message,
    }
  }

  const itemsCount =
    items?.reduce((acc, item) => acc + Number(item.quantity || 0), 0) || 1

  const payload = {
    user_id: userId,
    order_id: order.id,
    customer_name: order.customer_name || null,
    payment_method: order.payment_method || null,
    items_count: itemsCount > 0 ? itemsCount : 1,
    total_amount: Number(order.total || 0),
    status: "pago",
    notes: order.notes || null,
    sold_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("sales_history")
    .insert(payload)
    .select("*")
    .single()

  if (error) {
    return {
      success: false,
      skipped: false,
      reason: error.message,
    }
  }

  return {
    success: true,
    skipped: false,
    sale: data,
  }
}