export type ClickClubProduct = {
  id: number
  title: string
  category: string
  image: string
  oldPoints: number
  points: number
  discount: number
  rating: number
  reviews: number
  badge: string
  highlight: string
  rarity: string
  description: string
}

export const clickClubProducts: ClickClubProduct[] = [
  {
    id: 1,
    title: "PlayStation 5",
    category: "Gaming",
    image: "/click-club/products/ps5.png",
    oldPoints: 4200,
    points: 3490,
    discount: 17,
    rating: 5,
    reviews: 28,
    badge: "Mais desejado",
    highlight: "Console premium para premiar grandes resultados",
    rarity: "Ultra prêmio",
    description:
      "O PlayStation 5 é um prêmio de alto impacto para restaurantes que acumulam muitos pontos. Ideal para criar desejo real dentro da plataforma e transformar performance em recompensa grande.",
  },
  {
    id: 2,
    title: 'Smart TV 50" 4K',
    category: "Eletrônicos",
    image: "/click-club/products/tv-50.png",
    oldPoints: 3200,
    points: 2690,
    discount: 15,
    rating: 5,
    reviews: 19,
    badge: "Top resgate",
    highlight: "Ideal para salão, recepção ou uso pessoal",
    rarity: "Premium",
    description:
      "Uma Smart TV 4K é um prêmio extremamente desejado e útil. Pode ser usada no restaurante, em recepção, no salão ou até como benefício pessoal do dono.",
  },
  {
    id: 3,
    title: "iPhone 15",
    category: "Smartphones",
    image: "/click-club/products/iphone-15.png",
    oldPoints: 5100,
    points: 4590,
    discount: 10,
    rating: 5,
    reviews: 14,
    badge: "Exclusivo",
    highlight: "Tecnologia de alto valor para grandes metas",
    rarity: "Luxo",
    description:
      "O iPhone 15 entra como um prêmio premium de altíssima percepção de valor, ideal para campanhas de retenção e engajamento dentro do Click Club.",
  },
  {
    id: 4,
    title: "Notebook Lenovo IdeaPad",
    category: "Informática",
    image: "/click-club/products/notebook.png",
    oldPoints: 3600,
    points: 2990,
    discount: 16,
    rating: 4,
    reviews: 17,
    badge: "Escolha inteligente",
    highlight: "Prêmio útil e valorizado no dia a dia",
    rarity: "Premium",
    description:
      "Um notebook é um prêmio funcional, útil e valorizado. Excelente para recompensar consistência no uso da plataforma.",
  },
  {
    id: 5,
    title: "Air Fryer Digital",
    category: "Utilidades",
    image: "/click-club/products/airfryer.png",
    oldPoints: 1200,
    points: 890,
    discount: 26,
    rating: 5,
    reviews: 33,
    badge: "Oferta quente",
    highlight: "Resgate rápido com alta percepção de valor",
    rarity: "Popular",
    description:
      "Perfeito para quem quer trocar pontos mais cedo. É um prêmio com custo menor, mas ainda com ótima percepção de valor.",
  },
  {
    id: 6,
    title: "Alexa Echo Dot",
    category: "Casa inteligente",
    image: "/click-club/products/alexa.png",
    oldPoints: 980,
    points: 690,
    discount: 30,
    rating: 5,
    reviews: 41,
    badge: "Baixo custo",
    highlight: "Perfeito para quem quer resgatar cedo",
    rarity: "Acessível",
    description:
      "Um prêmio acessível, moderno e desejado. Ideal para acelerar a primeira troca e fazer o usuário sentir valor rápido no programa.",
  },
]

export function getClickClubProductById(id: number) {
  return clickClubProducts.find((product) => product.id === id)
}
