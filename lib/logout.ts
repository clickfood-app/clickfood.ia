// lib/logout.ts
import { createClient } from "@/lib/supabase/client"

export async function logout() {
  try {
    const supabase = createClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error("Erro ao sair:", error.message)
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro desconhecido ao sair"

    console.error("Erro inesperado ao sair:", message)

    return {
      success: false,
      error: message,
    }
  }
}