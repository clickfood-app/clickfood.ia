import { NextRequest, NextResponse } from "next/server"
import { asaasFetch } from "@/lib/asaas"

type CreatePixPaymentBody = {
  customer: string
  value: number
  description?: string
  dueDate?: string
  externalReference?: string
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

function getTodayAsaasDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreatePixPaymentBody

    if (!body.customer?.trim()) {
      return NextResponse.json(
        { success: false, error: "customer é obrigatório." },
        { status: 400 }
      )
    }

    if (!body.value || Number(body.value) <= 0) {
      return NextResponse.json(
        { success: false, error: "value deve ser maior que 0." },
        { status: 400 }
      )
    }

    const payment = await asaasFetch<AsaasPaymentResponse>("/payments", {
      method: "POST",
      body: {
        customer: body.customer.trim(),
        billingType: "PIX",
        value: Number(body.value),
        dueDate: body.dueDate || getTodayAsaasDate(),
        description: body.description?.trim() || undefined,
        externalReference: body.externalReference?.trim() || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      payment,
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