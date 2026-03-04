import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Cardapio Digital | Restaurante AdminPro",
  description: "Veja nosso cardapio completo, faca seu pedido e receba em casa. Hamburguer artesanal, lanches especiais e muito sabor.",
  openGraph: {
    title: "Cardapio Digital | Restaurante AdminPro",
    description: "Veja nosso cardapio completo. Delivery e retirada.",
    type: "website",
  },
}

export default function CardapioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
