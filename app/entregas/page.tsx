import ComingSoonPage from "@/components/coming-soon-page"
import { Truck } from "lucide-react"

export default function EntregasPage() {
  return (
    <ComingSoonPage
      title="Entregas"
      description="Central para acompanhar pedidos em rota, tempo de entrega, bairros atendidos e responsáveis pela entrega."
      icon={Truck}
    />
  )
}
