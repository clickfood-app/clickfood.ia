import { asaasRequest } from "@/lib/asaas"

type AsaasPixQrCode = {
  encodedImage: string
  payload: string
  expirationDate: string
}

export async function getAsaasPixQrCode(
  paymentId: string
): Promise<AsaasPixQrCode> {
  return asaasRequest<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`)
}