import type {
  CreatePixChargeInput,
  CreatePixChargeOutput,
  PixProvider,
} from "../types"

type PicPayConfig = {
  clientId: string
  clientSecret: string
  environment?: "sandbox" | "production"
}

type PicPayTokenResponse = {
  access_token: string
  expires_in: number
  token_type: string
}

function onlyDigits(value?: string | null) {
  return (value || "").replace(/\D/g, "")
}

function buildPicPayAuthBaseUrl(environment?: "sandbox" | "production") {
  if (environment === "sandbox") {
    return "https://checkout-api-sandbox.picpay.com"
  }

  return "https://checkout-api.picpay.com"
}

function buildPicPayApiBaseUrl(environment?: "sandbox" | "production") {
  if (environment === "sandbox") {
    return "https://checkout-api-sandbox.picpay.com/api/v1"
  }

  return "https://checkout-api.picpay.com/api/v1"
}

function buildMerchantChargeId(orderId: string) {
  const cleaned = orderId.replace(/[^a-zA-Z0-9-]/g, "")

  return cleaned.slice(0, 36)
}

export function createPicPayProvider(config: PicPayConfig): PixProvider {
  const authBaseUrl = buildPicPayAuthBaseUrl(config.environment)
  const apiBaseUrl = buildPicPayApiBaseUrl(config.environment)

  let cachedToken: { accessToken: string; expiresAt: number } | null = null

  async function getAccessToken() {
    const now = Date.now()

    if (cachedToken && cachedToken.expiresAt > now + 30_000) {
      return cachedToken.accessToken
    }

    if (!config.clientId || !config.clientSecret) {
      throw new Error("Credenciais PicPay não configuradas.")
    }

    const response = await fetch(`${authBaseUrl}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    })

    const data = (await response.json()) as PicPayTokenResponse & {
      error?: string
      error_description?: string
      message?: string
    }

    if (!response.ok) {
      throw new Error(
        `Erro ao autenticar no PicPay (${response.status}): ${JSON.stringify(data)}`
      )
    }

    cachedToken = {
      accessToken: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    }

    return data.access_token
  }

  return {
    async createCharge(input: CreatePixChargeInput): Promise<CreatePixChargeOutput> {
      const accessToken = await getAccessToken()
      const providerChargeId = buildMerchantChargeId(input.orderId)

      const document = onlyDigits(input.customer.document)
      const phone = onlyDigits(input.customer.phone)

      const payload = {
        paymentSource: "GATEWAY",
        merchantChargeId: providerChargeId,
        customer: {
          name: input.customer.name || "Cliente ClickFood",
          email: input.customer.email || "cliente@clickfoodbr.com",
          documentType: document.length === 14 ? "CNPJ" : "CPF",
          document: document || "00000000000",
          phone: {
            countryCode: "55",
            areaCode: phone.length >= 10 ? phone.slice(0, 2) : "31",
            number: phone.length >= 10 ? phone.slice(2) : "999999999",
            type: "MOBILE",
          },
        },
        transactions: [
          {
            paymentType: "PIX",
            amount: input.amountCents,
            softDescriptor: "CLICKFOOD",
            pix: {
              expiration: input.expiresInSeconds ?? 900,
            },
          },
        ],
      }

      const response = await fetch(`${apiBaseUrl}/charge/pix`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "caller-origin": "clickfood",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          `Erro ao criar cobrança PicPay (${response.status}): ${JSON.stringify(data)}`
        )
      }

      const transaction = data?.transactions?.[0] ?? null
      const pix = transaction?.pix ?? null

      return {
        provider: "picpay",
        providerChargeId,
        providerTransactionId: transaction?.transactionId ?? null,
        status: "pending",
        qrCode: pix?.qrCode ?? null,
        qrCodeBase64: pix?.qrCodeBase64 ?? null,
        copyPaste: pix?.qrCode ?? null,
        expiresAt: new Date(
          Date.now() + (input.expiresInSeconds ?? 900) * 1000
        ).toISOString(),
        raw: data,
      }
    },
  }
}
