import { NextRequest, NextResponse } from "next/server"
import { asaasFetch } from "@/lib/asaas"

type AsaasCreateCustomerBody = {
  name: string
  cpfCnpj: string
  email?: string
  mobilePhone?: string
  externalReference?: string
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Rota /api/asaas/customers carregada com sucesso.",
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AsaasCreateCustomerBody

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Nome é obrigatório." },
        { status: 400 }
      )
    }

    if (!body.cpfCnpj?.trim()) {
      return NextResponse.json(
        { success: false, error: "cpfCnpj é obrigatório." },
        { status: 400 }
      )
    }

    const customer = await asaasFetch("/customers", {
      method: "POST",
      body: {
        name: body.name.trim(),
        cpfCnpj: body.cpfCnpj.replace(/\D/g, ""),
        email: body.email?.trim() || undefined,
        mobilePhone: body.mobilePhone?.replace(/\D/g, "") || undefined,
        externalReference: body.externalReference?.trim() || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      customer,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao criar cliente no Asaas.",
      },
      { status: 500 }
    )
  }
}