"use client"

import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

export type CouponDbRow = {
  id: string
  restaurant_id: string
  code: string | null
  title: string | null
  description: string | null
  coupon_type: "manual" | "automatico" | "relampago" | "campanha" | "exclusivo"
  status: "ativo" | "pausado" | "expirado"
  discount_type: "percentual" | "fixo"
  discount_value: number | string
  min_order_value: number | string | null
  max_discount_value: number | string | null
  usage_limit: number | null
  used_count: number
  max_per_client: number
  starts_at: string | null
  expires_at: string | null
  auto_trigger:
    | "primeiro_pedido"
    | "inativo_dias"
    | "pedido_acima"
    | "aniversario"
    | "vip"
    | null
  auto_param: number | string | null
  duration_hours: number | null
  client_name: string | null
  customer_phone: string | null
  customer_email: string | null
  exclusive_reason:
    | "fidelidade"
    | "pedido_cancelado"
    | "cliente_vip"
    | "recuperacao_inativo"
    | "manual"
    | null
  send_channels: ("whatsapp" | "notificacao" | "email")[] | null
  created_at: string
  updated_at: string
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

async function resolveRestaurantId(providedRestaurantId?: string | null) {
  if (providedRestaurantId) return providedRestaurantId
  return getMyRestaurantId()
}

export async function getMyRestaurantId() {
  const { data, error } = await supabase.rpc("get_my_restaurant_id")

  if (error) {
    throw new Error(`Erro ao buscar restaurante: ${error.message}`)
  }

  if (!data) {
    throw new Error("Restaurante não encontrado para este usuário.")
  }

  return data as string
}

export async function listCoupons(restaurantId?: string | null) {
  const resolvedRestaurantId = await resolveRestaurantId(restaurantId)

  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("restaurant_id", resolvedRestaurantId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Erro ao listar cupons: ${error.message}`)
  }

  return (data ?? []) as CouponDbRow[]
}

export async function getCouponById(id: string, restaurantId?: string | null) {
  const resolvedRestaurantId = await resolveRestaurantId(restaurantId)

  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("id", id)
    .eq("restaurant_id", resolvedRestaurantId)
    .single()

  if (error) {
    throw new Error(`Erro ao buscar cupom: ${error.message}`)
  }

  return data as CouponDbRow
}

export async function createCoupon(input: {
  restaurant_id: string
  code?: string | null
  title?: string | null
  description?: string | null
  coupon_type: "manual" | "automatico" | "relampago" | "campanha" | "exclusivo"
  status?: "ativo" | "pausado" | "expirado"
  discount_type: "percentual" | "fixo"
  discount_value: number
  min_order_value?: number | null
  max_discount_value?: number | null
  usage_limit?: number | null
  used_count?: number
  max_per_client?: number
  starts_at?: string | null
  expires_at?: string | null
  auto_trigger?: "primeiro_pedido" | "inativo_dias" | "pedido_acima" | "aniversario" | "vip" | null
  auto_param?: number | null
  duration_hours?: number | null
  client_name?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  exclusive_reason?:
    | "fidelidade"
    | "pedido_cancelado"
    | "cliente_vip"
    | "recuperacao_inativo"
    | "manual"
    | null
  send_channels?: ("whatsapp" | "notificacao" | "email")[]
}) {
  const payload = {
    restaurant_id: input.restaurant_id,
    code: input.code ? input.code.trim().toUpperCase() : null,
    title: input.title ?? null,
    description: input.description ?? null,
    coupon_type: input.coupon_type,
    status: input.status ?? "ativo",
    discount_type: input.discount_type,
    discount_value: Number(input.discount_value ?? 0),
    min_order_value: toNumber(input.min_order_value),
    max_discount_value: toNumber(input.max_discount_value),
    usage_limit: input.usage_limit ?? null,
    used_count: input.used_count ?? 0,
    max_per_client: input.max_per_client ?? 1,
    starts_at: input.starts_at ?? null,
    expires_at: input.expires_at ?? null,
    auto_trigger: input.auto_trigger ?? null,
    auto_param: toNumber(input.auto_param),
    duration_hours: input.duration_hours ?? null,
    client_name: input.client_name ?? null,
    customer_phone: input.customer_phone ?? null,
    customer_email: input.customer_email ?? null,
    exclusive_reason: input.exclusive_reason ?? null,
    send_channels: input.send_channels ?? [],
  }

  const { data, error } = await supabase
    .from("coupons")
    .insert([payload])
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar cupom: ${error.message}`)
  }

  return data as CouponDbRow
}

export async function updateCoupon(
  id: string,
  input: Partial<{
    code: string | null
    title: string | null
    description: string | null
    coupon_type: "manual" | "automatico" | "relampago" | "campanha" | "exclusivo"
    status: "ativo" | "pausado" | "expirado"
    discount_type: "percentual" | "fixo"
    discount_value: number
    min_order_value: number | null
    max_discount_value: number | null
    usage_limit: number | null
    used_count: number
    max_per_client: number
    starts_at: string | null
    expires_at: string | null
    auto_trigger: "primeiro_pedido" | "inativo_dias" | "pedido_acima" | "aniversario" | "vip" | null
    auto_param: number | null
    duration_hours: number | null
    client_name: string | null
    customer_phone: string | null
    customer_email: string | null
    exclusive_reason:
      | "fidelidade"
      | "pedido_cancelado"
      | "cliente_vip"
      | "recuperacao_inativo"
      | "manual"
      | null
    send_channels: ("whatsapp" | "notificacao" | "email")[]
  }>,
  restaurantId?: string | null
) {
  const resolvedRestaurantId = await resolveRestaurantId(restaurantId)

  const payload = {
    ...input,
    code:
      input.code === undefined
        ? undefined
        : input.code
          ? input.code.trim().toUpperCase()
          : null,
    min_order_value:
      input.min_order_value === undefined ? undefined : toNumber(input.min_order_value),
    max_discount_value:
      input.max_discount_value === undefined ? undefined : toNumber(input.max_discount_value),
    auto_param: input.auto_param === undefined ? undefined : toNumber(input.auto_param),
  }

  const { data, error } = await supabase
    .from("coupons")
    .update(payload)
    .eq("id", id)
    .eq("restaurant_id", resolvedRestaurantId)
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao atualizar cupom: ${error.message}`)
  }

  return data as CouponDbRow
}

export async function deleteCoupon(id: string, restaurantId?: string | null) {
  const resolvedRestaurantId = await resolveRestaurantId(restaurantId)

  const { error } = await supabase
    .from("coupons")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", resolvedRestaurantId)

  if (error) {
    throw new Error(`Erro ao excluir cupom: ${error.message}`)
  }
}

export async function activateCoupon(id: string, restaurantId?: string | null) {
  return updateCoupon(id, { status: "ativo" }, restaurantId)
}

export async function deactivateCoupon(id: string, restaurantId?: string | null) {
  return updateCoupon(id, { status: "pausado" }, restaurantId)
}