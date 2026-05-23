import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Cardápio Online | ClickFood BR",
  description:
    "Veja o cardápio online, escolha seus produtos e faça seu pedido de forma rápida e prática.",
  openGraph: {
    title: "Cardápio Online | ClickFood BR",
    description:
      "Acesse o cardápio online, confira os produtos disponíveis e faça seu pedido.",
    type: "website",
    siteName: "ClickFood BR",
    locale: "pt_BR",
  },
}

export default function CardapioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}