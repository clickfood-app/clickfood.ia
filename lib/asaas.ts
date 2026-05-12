import { decryptText } from "@/lib/crypto"
import { supabaseAdmin } from "@/lib/supabase-admin"

const ASAAS_GLOBAL_BASE_URL = process.env.ASAAS_BASE_URL
const ASAAS_GLOBAL_API_KEY = process.env.ASAAS_API_KEY
const ASAAS_GLOBAL_USER_AGENT = process.env.ASAAS_USER_AGENT || "clickfood"

type AsaasRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
  headers?: Record<string, string>
  cache?: RequestCache
}

export type AsaasAccountConfig = {
  baseUrl: string
  apiKey: string
  webhookToken?: string | null
  walletId?: string | null
  userAgent: string
  environment: "sandbox" | "production"
}

type RestaurantAsaasAccountRow = {
  environment: "sandbox" | "production"
  api_key_encrypted: string | null
  webhook_token_encrypted: string | null
  wallet_id: string | null
  user_agent: string | null
  is_active: boolean
}

function getBaseUrlByEnvironment(environment: "sandbox" | "production") {
  return environment === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3"
}

function buildAsaasUrl(baseUrl: string, path: string) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`
}

// BLOCO 1: executor interno que faz a chamada no Asaas com a conta recebida
async function runAsaasFetch<T = unknown>(
  config: AsaasAccountConfig,
  path: string,
  options: AsaasRequestOptions = {}
): Promise<T> {
  const response = await fetch(buildAsaasUrl(config.baseUrl, path), {
    method: options.method || "GET",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      access_token: config.apiKey,
      "User-Agent": config.userAgent,
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

// BLOCO 2: compatibilidade com a conta global antiga
function assertGlobalAsaasEnv() {
  if (!ASAAS_GLOBAL_BASE_URL) {
    throw new Error("ASAAS_BASE_URL não configurada.")
  }

  if (!ASAAS_GLOBAL_API_KEY) {
    throw new Error("ASAAS_API_KEY não configurada.")
  }
}

export async function asaasFetch<T = unknown>(
  path: string,
  options: AsaasRequestOptions = {}
): Promise<T> {
  assertGlobalAsaasEnv()

  return runAsaasFetch<T>(
    {
      baseUrl: ASAAS_GLOBAL_BASE_URL!,
      apiKey: ASAAS_GLOBAL_API_KEY!,
      userAgent: ASAAS_GLOBAL_USER_AGENT,
      environment: "production",
    },
    path,
    options
  )
}

// BLOCO 3: busca a conta Asaas salva do restaurante e descriptografa
export async function getRestaurantAsaasAccount(
  restaurantId: string
): Promise<AsaasAccountConfig> {
  const { data, error } = await supabaseAdmin
    .from("restaurant_asaas_accounts")
    .select(
      "environment, api_key_encrypted, webhook_token_encrypted, wallet_id, user_agent, is_active"
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || "Erro ao buscar conta Asaas do restaurante.")
  }

  const account = data as RestaurantAsaasAccountRow | null

  if (!account || !account.is_active) {
    throw new Error("Conta Asaas do restaurante não conectada.")
  }

  if (!account.api_key_encrypted) {
    throw new Error("API Key do Asaas do restaurante não configurada.")
  }

  const environment =
    account.environment === "production" ? "production" : "sandbox"

  return {
    environment,
    baseUrl: getBaseUrlByEnvironment(environment),
    apiKey: decryptText(account.api_key_encrypted),
    webhookToken: account.webhook_token_encrypted
      ? decryptText(account.webhook_token_encrypted)
      : null,
    walletId: account.wallet_id || null,
    userAgent: account.user_agent?.trim() || "clickfood",
  }
}

// BLOCO 4: chamada usando a conta dinâmica do restaurante
export async function asaasFetchWithAccount<T = unknown>(
  account: AsaasAccountConfig,
  path: string,
  options: AsaasRequestOptions = {}
): Promise<T> {
  return runAsaasFetch<T>(account, path, options)
}