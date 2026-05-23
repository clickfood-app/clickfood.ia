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

export async function POST(req: NextRequest) {
  let pixCreationLockOrderId: string | null = null
  let asaasPaymentWasCreated = false

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
        "id, restaurant_id, public_order_number, total, payment_method, payment_status, asaas_payment_id, asaas_payment_status, asaas_invoice_url, asaas_pix_expires_at"
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

    if (!isPixPaymentMethod(typedOrder.payment_method)) {
      return NextResponse.json(
        {
          success: false,
          error: "Este pedido não foi criado com forma de pagamento Pix.",
        },
        { status: 400 }
      )
    }

    if (isPaidPaymentStatus(typedOrder.payment_status)) {
      return NextResponse.json(
        {
          success: false,
          error: "Este pedido já está pago.",
          orderId: typedOrder.id,
          publicOrderNumber:
            typedOrder.public_order_number || body.publicOrderNumber || null,
        },
        { status: 409 }
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
      return NextResponse.json(
        {
          success: false,
          error:
            "A cobrança Pix deste pedido já está sendo criada. Aguarde alguns segundos e tente novamente.",
        },
        { status: 409 }
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
      return NextResponse.json(
        {
          success: false,
          error:
            lockError.message ||
            "Erro ao preparar pedido para cobrança Pix.",
          details: lockError.details || null,
          hint: lockError.hint || null,
          code: lockError.code || null,
        },
        { status: 500 }
      )
    }

    if (!lockedOrder) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A cobrança Pix deste pedido já foi iniciada. Aguarde alguns segundos e tente novamente.",
        },
        { status: 409 }
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
      return NextResponse.json(
        {
          success: false,
          error:
            paymentUpdateError.message ||
            "Cobrança Pix criada, mas erro ao salvar dados do pagamento no pedido.",
          details: paymentUpdateError.details || null,
          hint: paymentUpdateError.hint || null,
          code: paymentUpdateError.code || null,
          paymentId: payment.id,
        },
        { status: 500 }
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
      return NextResponse.json(
        {
          success: false,
          error:
            pixUpdateError.message ||
            "Cobrança Pix criada, mas erro ao salvar vencimento do QR Code.",
          details: pixUpdateError.details || null,
          hint: pixUpdateError.hint || null,
          code: pixUpdateError.code || null,
          paymentId: payment.id,
        },
        { status: 500 }
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