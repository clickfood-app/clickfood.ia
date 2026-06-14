export type PaymentProvider = "picpay" | "asaas" | "inter" | "sicoob" | "efi"

export type PaymentEnvironment = "sandbox" | "production"

export type PixChargeStatus =
  | "pending"
  | "paid"
  | "expired"
  | "cancelled"
  | "refunded"
  | "failed"

export type CreatePixChargeInput = {
  restaurantId: string
  orderId: string
  amountCents: number
  customer: {
    name: string
    phone?: string | null
    email?: string | null
    document?: string | null
  }
  description?: string
  expiresInSeconds?: number
}

export type CreatePixChargeOutput = {
  provider: PaymentProvider
  providerChargeId: string
  providerTransactionId?: string | null
  status: PixChargeStatus
  qrCode?: string | null
  qrCodeBase64?: string | null
  copyPaste?: string | null
  expiresAt?: string | null
  raw: unknown
}

export type PixProvider = {
  createCharge(input: CreatePixChargeInput): Promise<CreatePixChargeOutput>
}
