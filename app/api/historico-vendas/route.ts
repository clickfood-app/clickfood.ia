import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("sales_history")
      .select("*")
      .eq("user_id", user.id)
      .order("sold_at", { ascending: false })

    if (error) {
      console.error("Erro ao buscar histórico:", error)
      return NextResponse.json(
        { error: "Erro ao buscar histórico de vendas." },
        { status: 500 }
      )
    }

    return NextResponse.json({ sales: data ?? [] })
  } catch (error) {
    console.error("GET /api/historico-vendas error:", error)
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

    const body = await req.json()

    const customer_name = String(body?.customer_name || "").trim() || null
    const payment_method = String(body?.payment_method || "").trim() || null
    const items_count = Number(body?.items_count || 1)
    const total_amount = Number(body?.total_amount || 0)
    const status = String(body?.status || "pago").trim() || "pago"
    const notes = String(body?.notes || "").trim() || null
    const sold_at = body?.sold_at || new Date().toISOString()

    if (total_amount <= 0) {
      return NextResponse.json(
        { error: "O valor da venda deve ser maior que zero." },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("sales_history")
      .insert({
        user_id: user.id,
        order_id: null,
        customer_name,
        payment_method,
        items_count: items_count > 0 ? items_count : 1,
        total_amount,
        status,
        notes,
        sold_at,
      })
      .select("*")
      .single()

    if (error) {
      console.error("Erro ao salvar venda manual:", error)
      return NextResponse.json(
        { error: "Erro ao salvar venda." },
        { status: 500 }
      )
    }

    return NextResponse.json({ sale: data }, { status: 201 })
  } catch (error) {
    console.error("POST /api/historico-vendas error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    )
  }
}