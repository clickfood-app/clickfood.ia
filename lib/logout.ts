import { supabase } from './supabase'

export async function logout() {
  try {
    await supabase.auth.signOut()
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao sair"
    console.error("Erro ao sair:", message)
    return { success: false, error: message }
  }
}
