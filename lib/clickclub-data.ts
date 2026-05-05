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
  features: string[]
}

export const CLICK_CLUB_STORAGE_KEY = "clickclub_points"
export const CLICK_CLUB_REDEEMED_KEY = "clickclub_redeemed"
export const CLICK_CLUB_INITIAL_POINTS = 4200

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
      "Um dos prêmios mais desejados da Click Club. Ideal para transformar performance dentro da plataforma em uma recompensa de alto impacto.",
    features: [
      "Resgate premium",
      "Alta percepção de valor",
      "Excelente para campanhas de incentivo",
      "Produto com forte apelo emocional",
    ],
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
      "Uma recompensa de alto valor para restaurantes que querem trocar pontos por algo realmente grande.",
    features: [
      'Tela 50" 4K',
      "Ótimo valor percebido",
      "Prêmio com forte desejo de resgate",
      "Excelente para campanhas sazonais",
    ],
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
      "Prêmio de elite da vitrine. Criado para estimular retenção, engajamento e uso recorrente da plataforma.",
    features: [
      "Categoria premium",
      "Alto valor percebido",
      "Ideal para metas altas",
      "Perfeito para elevar desejo de uso",
    ],
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
      "Uma opção excelente para quem quer trocar pontos por um prêmio útil, forte e com valor real.",
    features: [
      "Alta utilidade",
      "Ótimo custo-benefício",
      "Boa atratividade de resgate",
      "Produto com apelo profissional",
    ],
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
      "Prêmio acessível para gerar sensação de conquista mais rápida e manter o restaurante motivado.",
    features: [
      "Baixa barreira de resgate",
      "Excelente para primeiras trocas",
      "Valor percebido alto",
      "Ótimo item de entrada",
    ],
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
      "Uma opção leve e estratégica para incentivar os primeiros resgates dentro da plataforma.",
    features: [
      "Resgate acessível",
      "Perfeito para início de jornada",
      "Boa percepção de inovação",
      "Ótimo giro de vitrine",
    ],
  },
]