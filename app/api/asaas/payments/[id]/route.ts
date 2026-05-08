import { NextResponse } from "next/server"
import { asaasFetch } from "@/lib/asaas"

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

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    if (!id?.trim()) {
      return NextResponse.json(
        { success: false, error: "id é obrigatório." },
        { status: 400 }
      )
    }

    const payment = await asaasFetch<AsaasPaymentResponse>(`/payments/${id}`, {
      method: "GET",
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
            : "Erro ao buscar cobrança no Asaas.",
      },
      { status: 500 }
    )
  }
}