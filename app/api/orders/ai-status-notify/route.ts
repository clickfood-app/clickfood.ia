import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const orderId = String(body?.orderId || "").trim()
    const status = String(body?.status || "").trim()

    if (!orderId || !status) {
      return NextResponse.json(
        { ok: false, error: "missing_order_id_or_status" },
        { status: 400 }
      )
    }

    const agentUrl = process.env.CLICKFOOD_AI_AGENT_URL
    const secret = process.env.CLICKFOOD_AI_AGENT_SECRET

    if (!agentUrl || !secret) {
      return NextResponse.json(
        { ok: false, error: "missing_ai_agent_env" },
        { status: 500 }
      )
    }

    const response = await fetch(
      `${agentUrl.replace(/\/$/, "")}/internal/orders/status-notify?secret=${encodeURIComponent(secret)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          status,
        }),
      }
    )

    const data = await response.json().catch(() => null)

    return NextResponse.json(
      {
        ok: response.ok,
        status: response.status,
        data,
      },
      { status: response.ok ? 200 : 502 }
    )
  } catch (error) {
    console.error("Erro ao notificar status do pedido IA:", error)

    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    )
  }
}
