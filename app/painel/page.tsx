import { redirect } from "next/navigation"
import AdminLayout from "@/components/admin-layout"
import DashboardContent from "@/components/dashboard-content"
import { createClient } from "@/lib/supabase/server"

export default async function PainelPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/auth")
  }

  return (
    <AdminLayout>
      <DashboardContent />
    </AdminLayout>
  )
}