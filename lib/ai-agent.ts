type NotifyAiPublicOrderCreatedParams = {
  restaurantId: string
  orderId: string
  source?: string
}

export async function notifyAiPublicOrderCreated({
  restaurantId,
  orderId,
  source = "public_menu",
}: NotifyAiPublicOrderCreatedParams) {
  const agentUrl =
    process.env.AI_AGENT_INTERNAL_URL ||
    process.env.CLICKFOOD_AI_AGENT_URL

  const secret =
    process.env.AI_AGENT_WEBHOOK_SECRET ||
    process.env.CLICKFOOD_AI_AGENT_SECRET

  if (!agentUrl || !secret) {
    console.warn("[AI Agent] Env ausente. Pulando notificacao.", {
      hasAgentUrl: Boolean(agentUrl),
      hasSecret: Boolean(secret),
    })

    return {
      ok: false,
      skipped: true,
      reason: "missing_env",
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(`${agentUrl}/internal/public-order-created`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({
        restaurant_id: restaurantId,
        order_id: orderId,
        source,
      }),
      signal: controller.signal,
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      console.error("[AI Agent] Erro ao notificar pedido publico:", {
        url: agentUrl,
        status: response.status,
        data,
      })

      return {
        ok: false,
        status: response.status,
        data,
      }
    }
return {
      ok: true,
      status: response.status,
      data,
    }
  } catch (error) {
    console.error("[AI Agent] Falha ao chamar agente:", {
      url: agentUrl,
      restaurantId,
      orderId,
      error,
    })

    return {
      ok: false,
      error,
    }
  } finally {
    clearTimeout(timeout)
  }
}
