import { asaasRequest } from "@/lib/asaas"

type CreateAsaasPixPaymentInput = {
  customer: string
  value: number
  dueDate: string
  description?: string
  externalReference?: string
}

type AsaasPixPayment = {
  id: string
  customer: string
  billingType: "PIX"
  value: number
  dueDate: string
  status: string
  invoiceUrl?: string
}

export async function createAsaasPixPayment(
  input: CreateAsaasPixPaymentInput
): Promise<AsaasPixPayment> {
  return asaasRequest<AsaasPixPayment>("/payments", {
    method: "POST",
    body: {
      customer: input.customer,
      billingType: "PIX",
      value: input.value,
      dueDate: input.dueDate,
      description: input.description,
      externalReference: input.externalReference,
    },
  })
}