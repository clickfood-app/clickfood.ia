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
  asaas_payment_id: string | null
  asaas_payment_status: string | null
  asaas_invoice_url: string | null
  asaas_pix_expires_at: string | null
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

function cleanText(value: unknown, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
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
  const minimumOrderTotal = getEnvNumber(
    "ASAAS_CLICKFOOD_SPLIT_MIN_ORDER_TOTAL",
    3
  )

  if (!walletId) return []
  if (!Number.isFinite(fixedValue) || fixedValue <= 0) return []
  if (!Number.isFinite(orderTotal) || orderTotal < minimumOrderTotal) return []

  return [
    {
      walletId,
      fixedValue,
    },
  ]
}

function isPaidPaymentStatus(paymentStatus: string | null) {
  const normalizedPaymentStatus = String(paymentStatus || "")
    .trim()
    .toLowerCase()

  return ["paid", "received", "confirmed"].includes(normalizedPaymentStatus)
}

function isPixPaymentMethod(paymentMethod: string | null) {
  const normalizedPaymentMethod = String(paymentMethod || "")
    .trim()
    .toLowerCase()

  return normalizedPaymentMethod === "pix"
}

function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(extra || {}),
    },
    { status }
  )
}

export async function POST(req: NextRequest) {
  let pixCreationLockOrderId: string | null = null
  let asaasPaymentWasCreated = false

  try {
    let body: CreatePixPaymentBody

    try {
      body = (await req.json()) as CreatePixPaymentBody
    } catch {
      return jsonError("Corpo da requisição inválido.", 400)
    }

    const restaurantId = cleanText(body.restaurantId, 80)
    const orderId = cleanText(body.orderId, 80)
    const customerName = cleanText(body.customerName, 120)
    const customerPhone = onlyDigits(body.customerPhone)
    const customerDocument = onlyDigits(body.customerDocument)
    const customerEmail = cleanText(body.customerEmail, 160) || undefined

    if (!restaurantId) {
      return jsonError("restaurantId é obrigatório.", 400)
    }

    if (!orderId) {
      return jsonError("orderId é obrigatório.", 400)
    }

    if (!customerName) {
      return jsonError("customerName é obrigatório.", 400)
    }

    if (!customerPhone) {
      return jsonError("customerPhone é obrigatório.", 400)
    }

    if (customerDocument.length !== 11) {
      return jsonError("CPF inválido para pagamento Pix.", 400)
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, restaurant_id, public_order_number, total, payment_method, payment_status, asaas_payment_id, asaas_payment_status, asaas_invoice_url, asaas_pix_expires_at"
      )
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle()

    if (orderError) {
      console.error("Erro ao buscar pedido para Pix Asaas:", {
        restaurantId,
        orderId,
        message: orderError.message,
        code: orderError.code,
      })

      return jsonError("Erro ao buscar pedido.", 500)
    }

    const typedOrder = order as OrderRow | null

    if (!typedOrder) {
      return jsonError("Pedido não encontrado.", 404)
    }

    if (!isPixPaymentMethod(typedOrder.payment_method)) {
      return jsonError(
        "Este pedido não foi criado com forma de pagamento Pix.",
        400
      )
    }

    if (isPaidPaymentStatus(typedOrder.payment_status)) {
      return jsonError("Este pedido já está pago.", 409, {
        orderId: typedOrder.id,
        publicOrderNumber:
          typedOrder.public_order_number || body.publicOrderNumber || null,
      })
    }

    const orderTotal = Number(typedOrder.total || 0)

    if (!Number.isFinite(orderTotal) || orderTotal <= 0) {
      return jsonError("Total do pedido inválido para cobrança Pix.", 400)
    }

    const asaasAccount = await getRestaurantAsaasAccount(restaurantId)

    if (typedOrder.asaas_payment_id) {
      const pixQrCode = await asaasFetchWithAccount<AsaasPixQrCodeResponse>(
        asaasAccount,
        `/payments/${typedOrder.asaas_payment_id}/pixQrCode`,
        {
          method: "GET",
        }
      )

      return NextResponse.json({
        success: true,
        reusedPayment: true,
        paymentId: typedOrder.asaas_payment_id,
        qrCodeBase64: pixQrCode.encodedImage || null,
        qrCodeUrl: null,
        qrCode: pixQrCode.payload || null,
        pixCopyPaste: pixQrCode.payload || null,
        ticketUrl: typedOrder.asaas_invoice_url || null,
        status:
          typedOrder.asaas_payment_status ||
          typedOrder.payment_status ||
          "pending",
        publicOrderNumber:
          typedOrder.public_order_number || body.publicOrderNumber || null,
        expiresAt:
          pixQrCode.expirationDate || typedOrder.asaas_pix_expires_at || null,
        splitApplied: false,
        splitFixedValue: 0,
      })
    }

    if (typedOrder.asaas_payment_status === "CREATING_PIX") {
      return jsonError(
        "A cobrança Pix deste pedido já está sendo criada. Aguarde alguns segundos e tente novamente.",
        409
      )
    }

    const { data: lockedOrder, error: lockError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "pending",
        asaas_payment_status: "CREATING_PIX",
      })
      .eq("id", typedOrder.id)
      .is("asaas_payment_id", null)
      .or("asaas_payment_status.is.null,asaas_payment_status.neq.CREATING_PIX")
      .select("id")
      .maybeSingle()

    if (lockError) {
      console.error("Erro ao criar trava de Pix Asaas:", {
        restaurantId,
        orderId: typedOrder.id,
        message: lockError.message,
        code: lockError.code,
      })

      return jsonError("Erro ao preparar pedido para cobrança Pix.", 500)
    }

    if (!lockedOrder) {
      return jsonError(
        "A cobrança Pix deste pedido já foi iniciada. Aguarde alguns segundos e tente novamente.",
        409
      )
    }

    pixCreationLockOrderId = typedOrder.id

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

    asaasPaymentWasCreated = true

    const { error: paymentUpdateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "pending",
        asaas_payment_id: payment.id,
        asaas_payment_status: payment.status || "PENDING",
        asaas_invoice_url: payment.invoiceUrl || null,
      })
      .eq("id", typedOrder.id)

    if (paymentUpdateError) {
      console.error("Cobrança Pix criada, mas erro ao salvar no pedido:", {
        restaurantId,
        orderId: typedOrder.id,
        paymentId: payment.id,
        message: paymentUpdateError.message,
        code: paymentUpdateError.code,
      })

      return jsonError(
        "Cobrança Pix criada, mas houve erro ao salvar os dados no pedido.",
        500,
        {
          paymentId: payment.id,
        }
      )
    }

    const pixQrCode = await asaasFetchWithAccount<AsaasPixQrCodeResponse>(
      asaasAccount,
      `/payments/${payment.id}/pixQrCode`,
      {
        method: "GET",
      }
    )

    const { error: pixUpdateError } = await supabaseAdmin
      .from("orders")
      .update({
        asaas_pix_expires_at: pixQrCode.expirationDate || null,
      })
      .eq("id", typedOrder.id)

    if (pixUpdateError) {
      console.error("Erro ao salvar vencimento do QR Code Pix:", {
        restaurantId,
        orderId: typedOrder.id,
        paymentId: payment.id,
        message: pixUpdateError.message,
        code: pixUpdateError.code,
      })

      return jsonError(
        "Cobrança Pix criada, mas houve erro ao salvar o vencimento do QR Code.",
        500,
        {
          paymentId: payment.id,
        }
      )
    }

    return NextResponse.json({
      success: true,
      reusedPayment: false,
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
    if (pixCreationLockOrderId && !asaasPaymentWasCreated) {
      await supabaseAdmin
        .from("orders")
        .update({
          asaas_payment_status: null,
        })
        .eq("id", pixCreationLockOrderId)
        .eq("asaas_payment_status", "CREATING_PIX")
        .is("asaas_payment_id", null)
    }

    console.error("POST /api/asaas/pix error:", error)

    return jsonError("Erro ao criar cobrança Pix no Asaas.", 500)
  }
}