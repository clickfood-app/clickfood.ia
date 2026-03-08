import { createClient } from "@/lib/supabase/client"

export async function logout() {
  const supabase = createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error("Erro ao sair:", error.message)
    return
  }

  window.location.href = "/login"
}