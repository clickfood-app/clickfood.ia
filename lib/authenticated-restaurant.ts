import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export type AuthenticatedRestaurant = {
  id: string
  name: string
  slug: string | null
}

class AuthenticatedRestaurantError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)

    this.name = "AuthenticatedRestaurantError"
    this.status = status
  }
}

export async function getAuthenticatedRestaurant(): Promise<AuthenticatedRestaurant> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    throw new AuthenticatedRestaurantError(
      authError.message || "Erro ao validar autenticação",
      401,
    )
  }

  if (!user) {
    throw new AuthenticatedRestaurantError(
      "Usuário não autenticado",
      401,
    )
  }

  const {
    data: member,
    error: memberError,
  } = await supabaseAdmin
    .from("restaurant_members")
    .select("restaurant_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle()

  if (memberError) {
    throw new AuthenticatedRestaurantError(
      memberError.message,
      500,
    )
  }

  if (!member?.restaurant_id) {
    throw new AuthenticatedRestaurantError(
      "Usuário sem vínculo com restaurante",
      403,
    )
  }

  const {
    data: restaurant,
    error: restaurantError,
  } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, slug")
    .eq("id", member.restaurant_id)
    .maybeSingle()

  if (restaurantError) {
    throw new AuthenticatedRestaurantError(
      restaurantError.message,
      500,
    )
  }

  if (!restaurant) {
    throw new AuthenticatedRestaurantError(
      "Restaurante não encontrado",
      404,
    )
  }

  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug ?? null,
  }
}

export function getRestaurantErrorStatus(error: unknown) {
  if (error instanceof AuthenticatedRestaurantError) {
    return error.status
  }

  return 500
}