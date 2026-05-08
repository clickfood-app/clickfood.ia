const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL
const ASAAS_API_KEY = process.env.ASAAS_API_KEY
const ASAAS_USER_AGENT = process.env.ASAAS_USER_AGENT || "click"

function assertAsaasEnv() {
  if (!ASAAS_BASE_URL) {
    throw new Error("ASAAS_BASE_URL não configurada.")
  }

  if (!ASAAS_API_KEY) {
    throw new Error("ASAAS_API_KEY não configurada.")
  }
}

type AsaasRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
  headers?: Record<string, string>
  cache?: RequestCache
}

export async function asaasFetch<T = unknown>(
  path: string,
  options: AsaasRequestOptions = {}
): Promise<T> {
  assertAsaasEnv()

  const url = `${ASAAS_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      access_token: ASAAS_API_KEY!,
      "User-Agent": ASAAS_USER_AGENT,
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: options.cache || "no-store",
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      data?.errors?.[0]?.description ||
      data?.message ||
      "Erro ao comunicar com o Asaas."

    throw new Error(message)
  }

  return data as T
}