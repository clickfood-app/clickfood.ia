import { NextRequest, NextResponse } from "next/server"
import {
  asaasFetchWithAccount,
  getRestaurantAsaasAccount,
} from "@/lib/asaas"
import { supabaseAdmin } from "@/lib/supabase-admin"

type CreatePixPaymentBody = {
  restaurantId: string
  orderId: string
  publicOrderNumber?: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  customerDocument: string
  customerAddress?: string
  customerNeighborhood?: string | null
  orderType?: "delivery" | "pickup"
  deliveryFee?: number
  serviceFee?: number
  couponCode?: string | null
}

type OrderRow = {
  id: string
  restaurant_id: string
  public_order_number: string | null
  total: number | string | null
  payment_method: string | null
  payment_status: string | null
}

type AsaasCustomerResponse = {
  id: string
  name: string
  cpfCnpj: string
}

type AsaasPaymentResponse = {
  object: string
  id: string
  dateCreated: string
  customer: string
  paymentLink?: string | null
  value: number
  netValue?: number
  originalValue?: number | null
  interestValue?: number | null
  description?: string | null
  billingType: string
  status: string
  dueDate: string
  originalDueDate?: string
  invoiceUrl?: string
  bankSlipUrl?: string | null
  externalReference?: string | null
}

type AsaasPixQrCodeResponse = {
  encodedImage?: string | null
  payload?: string | null
  expirationDate?: string | null
}

type AsaasSplitRule = {
  walletId: string
  fixedValue: number
}

function onlyDigits(value: string | undefined | null) {
  return (value || "").replace(/\D/g, "")
}

function getTodayAsaasDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function getEnvNumber(name: string, fallback: number) {
  const rawValue = process.env[name]
  const parsedValue = Number(rawValue)

  if (!rawValue || !Number.isFinite(parsedValue)) {
    return fallback
  }

  return parsedValue
}

function getClickFoodSplitRules(orderTotal: number): AsaasSplitRule[] {
  const walletId = process.env.ASAAS_CLICKFOOD_WALLET_ID?.trim() || ""
  const fixedValue = getEnvNumber("ASAAS_CLICKFOOD_SPLIT_FIXED_VALUE", 1)
  const minimumOrderTotal = getEnvNumber("ASAAS_CLICKFOOD_SPLIT_MIN_ORDER_TOTAL", 3)

  if (!walletId) {
    return []
  }

  if (!Number.isFinite(fixedValue) || fixedValue <= 0) {
    return []
  }

  if (!Number.isFinite(orderTotal) || orderTotal < minimumOrderTotal) {
    return []
  }

  return [
    {
      walletId,
      fixedValue,
    },
  ]
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreatePixPaymentBody

    const restaurantId = body.restaurantId?.trim()
    const orderId = body.orderId?.trim()
    const customerName = body.customerName?.trim()
    const customerPhone = onlyDigits(body.customerPhone)
    const customerDocument = onlyDigits(body.customerDocument)
    const customerEmail = body.customerEmail?.trim() || undefined

    if (!restaurantId) {
      return NextResponse.json(
        { success: false, error: "restaurantId é obrigatório." },
        { status: 400 }
      )
    }

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId é obrigatório." },
        { status: 400 }
      )
    }

    if (!customerName) {
      return NextResponse.json(
        { success: false, error: "customerName é obrigatório." },
        { status: 400 }
      )
    }

    if (!customerPhone) {
      return NextResponse.json(
        { success: false, error: "customerPhone é obrigatório." },
        { status: 400 }
      )
    }

    if (customerDocument.length !== 11) {
      return NextResponse.json(
        { success: false, error: "CPF inválido para pagamento Pix." },
        { status: 400 }
      )
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, restaurant_id, public_order_number, total, payment_method, payment_status"
      )
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId)
      .single()

    if (orderError) {
      return NextResponse.json(
        {
          success: false,
          error: orderError.message || "Erro ao buscar pedido.",
          details: orderError.details || null,
          hint: orderError.hint || null,
          code: orderError.code || null,
        },
        { status: 500 }
      )
    }

    const typedOrder = order as OrderRow | null

    if (!typedOrder) {
      return NextResponse.json(
        { success: false, error: "Pedido não encontrado." },
        { status: 404 }
      )
    }

    const orderTotal = Number(typedOrder.total || 0)

    if (!Number.isFinite(orderTotal) || orderTotal <= 0) {
      return NextResponse.json(
        { success: false, error: "Total do pedido inválido para cobrança Pix." },
        { status: 400 }
      )
    }

    const asaasAccount = await getRestaurantAsaasAccount(restaurantId)

    const customer = await asaasFetchWithAccount<AsaasCustomerResponse>(
      asaasAccount,
      "/customers",
      {
        method: "POST",
        body: {
          name: customerName,
          cpfCnpj: customerDocument,
          email: customerEmail,
          mobilePhone: customerPhone,
          externalReference: typedOrder.id,
          notificationDisabled: true,
        },
      }
    )

    const splitRules = getClickFoodSplitRules(orderTotal)

    const paymentBody: Record<string, unknown> = {
      customer: customer.id,
      billingType: "PIX",
      value: orderTotal,
      dueDate: getTodayAsaasDate(),
      description: `Pedido #${
        typedOrder.public_order_number || body.publicOrderNumber || typedOrder.id
      }`,
      externalReference: typedOrder.id,
    }

    if (splitRules.length > 0) {
      paymentBody.splits = splitRules
    }

    const payment = await asaasFetchWithAccount<AsaasPaymentResponse>(
      asaasAccount,
      "/payments",
      {
        method: "POST",
        body: paymentBody,
      }
    )

    const pixQrCode = await asaasFetchWithAccount<AsaasPixQrCodeResponse>(
      asaasAccount,
      `/payments/${payment.id}/pixQrCode`,
      {
        method: "GET",
      }
    )

    const { error: updateOrderError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "pending",
      })
      .eq("id", typedOrder.id)

    if (updateOrderError) {
      return NextResponse.json(
        {
          success: false,
          error:
            updateOrderError.message ||
            "Cobrança Pix criada, mas erro ao atualizar pedido.",
          details: updateOrderError.details || null,
          hint: updateOrderError.hint || null,
          code: updateOrderError.code || null,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      qrCodeBase64: pixQrCode.encodedImage || null,
      qrCodeUrl: null,
      qrCode: pixQrCode.payload || null,
      pixCopyPaste: pixQrCode.payload || null,
      ticketUrl: payment.invoiceUrl || null,
      status: payment.status || null,
      publicOrderNumber:
        typedOrder.public_order_number || body.publicOrderNumber || null,
      expiresAt: pixQrCode.expirationDate || null,
      splitApplied: splitRules.length > 0,
      splitFixedValue: splitRules[0]?.fixedValue ?? 0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao criar cobrança Pix no Asaas.",
      },
      { status: 500 }
    )
  }
}