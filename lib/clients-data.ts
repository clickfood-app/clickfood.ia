export interface ClientOrder {
  id: string
  date: string
  items: string[]
  total: number
  status: "Entregue" | "Em trânsito" | "Cancelado" | "Pendente"
}

export interface Client {
  id: string
  name: string
  phone: string
  email: string | null
  address: string | null
  registeredAt: string
  orders: ClientOrder[]
  totalSpent: number
  lastPurchase: string | null
  status: "ativo" | "inativo"
  isFavorite: boolean
  isBlocked: boolean
  notes: string
  topProduct: string | null
}

export const MOCK_CLIENTS: Client[] = [
  {
    id: "c1",
    name: "Lucas Ferreira",
    phone: "(11) 99123-4567",
    email: "lucas.f@email.com",
    address: "Rua das Flores, 120 - Centro",
    registeredAt: "2024-03-15",
    totalSpent: 1245.8,
    lastPurchase: "2026-02-06",
    status: "ativo",
    isFavorite: true,
    isBlocked: false,
    notes: "Prefere entrega a noite",
    topProduct: "Pizza Margherita",
    orders: [
      { id: "p101", date: "2026-02-06", items: ["Pizza Margherita", "Refrigerante 2L"], total: 72.9, status: "Entregue" },
      { id: "p092", date: "2026-01-28", items: ["Pizza Calabresa", "Suco Natural"], total: 68.5, status: "Entregue" },
      { id: "p078", date: "2026-01-15", items: ["Pizza 4 Queijos"], total: 59.9, status: "Entregue" },
      { id: "p065", date: "2025-12-20", items: ["Combo Familia", "Sobremesa"], total: 129.0, status: "Entregue" },
      { id: "p044", date: "2025-11-10", items: ["Pizza Margherita", "Pizza Pepperoni"], total: 119.8, status: "Entregue" },
      { id: "p030", date: "2025-10-05", items: ["Pizza Margherita"], total: 54.9, status: "Entregue" },
      { id: "p018", date: "2025-09-12", items: ["Pizza Margherita", "Refrigerante 2L", "Borda Recheada"], total: 89.9, status: "Entregue" },
      { id: "p010", date: "2025-08-01", items: ["Pizza Calabresa"], total: 52.9, status: "Entregue" },
    ],
  },
  {
    id: "c2",
    name: "Maria Oliveira",
    phone: "(11) 98765-4321",
    email: "maria.oli@email.com",
    address: "Av. Paulista, 900 - Apto 42",
    registeredAt: "2024-06-20",
    totalSpent: 890.5,
    lastPurchase: "2026-02-04",
    status: "ativo",
    isFavorite: false,
    isBlocked: false,
    notes: "",
    topProduct: "Hamburguer Artesanal",
    orders: [
      { id: "p098", date: "2026-02-04", items: ["Hamburguer Artesanal", "Batata Frita"], total: 62.0, status: "Entregue" },
      { id: "p085", date: "2026-01-20", items: ["Hamburguer Artesanal", "Milkshake"], total: 74.5, status: "Entregue" },
      { id: "p070", date: "2025-12-28", items: ["Combo Duplo"], total: 98.0, status: "Entregue" },
      { id: "p055", date: "2025-11-22", items: ["Hamburguer Artesanal"], total: 45.0, status: "Entregue" },
      { id: "p040", date: "2025-10-18", items: ["Hamburguer Artesanal", "Onion Rings"], total: 58.0, status: "Entregue" },
    ],
  },
  {
    id: "c3",
    name: "Carlos Santos",
    phone: "(21) 97654-3210",
    email: null,
    address: "Rua do Comércio, 45",
    registeredAt: "2025-01-10",
    totalSpent: 320.0,
    lastPurchase: "2026-01-30",
    status: "ativo",
    isFavorite: false,
    isBlocked: false,
    notes: "Cliente novo, fez 3 pedidos no primeiro mes",
    topProduct: "Esfiha de Carne",
    orders: [
      { id: "p090", date: "2026-01-30", items: ["Esfiha de Carne x5", "Refrigerante Lata"], total: 48.5, status: "Entregue" },
      { id: "p082", date: "2026-01-18", items: ["Esfiha de Carne x10"], total: 75.0, status: "Entregue" },
      { id: "p075", date: "2026-01-08", items: ["Esfiha Mista x8", "Suco Natural"], total: 68.0, status: "Entregue" },
    ],
  },
  {
    id: "c4",
    name: "Ana Beatriz Lima",
    phone: "(11) 91234-5678",
    email: "ana.b.lima@email.com",
    address: null,
    registeredAt: "2023-11-05",
    totalSpent: 2150.3,
    lastPurchase: "2026-02-07",
    status: "ativo",
    isFavorite: true,
    isBlocked: false,
    notes: "Cliente VIP - sempre pede para eventos",
    topProduct: "Combo Familia",
    orders: [
      { id: "p100", date: "2026-02-07", items: ["Combo Familia", "Sobremesa x2", "Refrigerante 2L x2"], total: 189.0, status: "Em trânsito" },
      { id: "p088", date: "2026-01-25", items: ["Combo Familia", "Sobremesa"], total: 145.0, status: "Entregue" },
      { id: "p072", date: "2026-01-05", items: ["Pizza Margherita x2", "Refrigerante 2L"], total: 135.8, status: "Entregue" },
      { id: "p058", date: "2025-12-01", items: ["Combo Festa 20 pessoas"], total: 450.0, status: "Entregue" },
      { id: "p042", date: "2025-10-20", items: ["Combo Familia", "Sobremesa x3"], total: 198.0, status: "Entregue" },
      { id: "p028", date: "2025-09-08", items: ["Combo Festa 10 pessoas"], total: 280.0, status: "Entregue" },
      { id: "p015", date: "2025-07-15", items: ["Pizza Margherita x3"], total: 164.7, status: "Entregue" },
      { id: "p008", date: "2025-06-01", items: ["Combo Familia"], total: 129.0, status: "Entregue" },
      { id: "p003", date: "2025-04-10", items: ["Combo Festa 15 pessoas"], total: 365.0, status: "Entregue" },
    ],
  },
  {
    id: "c5",
    name: "Roberto Almeida",
    phone: "(31) 99876-5432",
    email: "roberto.alm@email.com",
    address: "Rua Minas Gerais, 300 - Sala 5",
    registeredAt: "2024-08-12",
    totalSpent: 156.0,
    lastPurchase: "2025-06-15",
    status: "inativo",
    isFavorite: false,
    isBlocked: false,
    notes: "",
    topProduct: "Pizza Pepperoni",
    orders: [
      { id: "p025", date: "2025-06-15", items: ["Pizza Pepperoni", "Refrigerante Lata"], total: 62.0, status: "Entregue" },
      { id: "p012", date: "2025-03-20", items: ["Pizza Pepperoni"], total: 54.0, status: "Entregue" },
      { id: "p005", date: "2024-11-10", items: ["Pizza Calabresa"], total: 40.0, status: "Cancelado" },
    ],
  },
  {
    id: "c6",
    name: "Juliana Mendes",
    phone: "(11) 98234-1234",
    email: "ju.mendes@email.com",
    address: "Rua Augusta, 1500 - Apto 10",
    registeredAt: "2025-06-01",
    totalSpent: 540.0,
    lastPurchase: "2026-02-05",
    status: "ativo",
    isFavorite: false,
    isBlocked: false,
    notes: "Alergica a camarao",
    topProduct: "Salada Caesar",
    orders: [
      { id: "p099", date: "2026-02-05", items: ["Salada Caesar", "Suco Detox"], total: 52.0, status: "Entregue" },
      { id: "p087", date: "2026-01-22", items: ["Salada Caesar", "Wrap Integral"], total: 64.0, status: "Entregue" },
      { id: "p074", date: "2026-01-10", items: ["Bowl Proteico"], total: 58.0, status: "Entregue" },
      { id: "p060", date: "2025-12-05", items: ["Salada Caesar x2"], total: 78.0, status: "Entregue" },
    ],
  },
  {
    id: "c7",
    name: "Pedro Henrique Costa",
    phone: "(21) 91876-5432",
    email: null,
    address: "Rua do Sol, 88",
    registeredAt: "2025-09-20",
    totalSpent: 98.0,
    lastPurchase: "2025-10-05",
    status: "inativo",
    isFavorite: false,
    isBlocked: false,
    notes: "",
    topProduct: "Pizza Calabresa",
    orders: [
      { id: "p048", date: "2025-10-05", items: ["Pizza Calabresa", "Guarana 2L"], total: 58.0, status: "Entregue" },
      { id: "p046", date: "2025-09-25", items: ["Pizza Calabresa"], total: 40.0, status: "Entregue" },
    ],
  },
  {
    id: "c8",
    name: "Fernanda Ribeiro",
    phone: "(11) 97777-8888",
    email: "fernanda.r@email.com",
    address: "Alameda Santos, 200",
    registeredAt: "2024-01-20",
    totalSpent: 1680.0,
    lastPurchase: "2026-02-08",
    status: "ativo",
    isFavorite: true,
    isBlocked: false,
    notes: "Sempre pede no sabado",
    topProduct: "Pizza 4 Queijos",
    orders: [
      { id: "p102", date: "2026-02-08", items: ["Pizza 4 Queijos", "Pizza Margherita", "Refrigerante 2L"], total: 132.8, status: "Pendente" },
      { id: "p095", date: "2026-02-01", items: ["Pizza 4 Queijos", "Sobremesa"], total: 85.9, status: "Entregue" },
      { id: "p083", date: "2026-01-18", items: ["Combo Casal"], total: 109.0, status: "Entregue" },
      { id: "p068", date: "2025-12-25", items: ["Combo Festa 10 pessoas"], total: 280.0, status: "Entregue" },
      { id: "p052", date: "2025-11-15", items: ["Pizza 4 Queijos x2"], total: 119.8, status: "Entregue" },
      { id: "p038", date: "2025-10-11", items: ["Pizza 4 Queijos", "Pizza Pepperoni"], total: 114.0, status: "Entregue" },
      { id: "p022", date: "2025-08-30", items: ["Combo Casal"], total: 109.0, status: "Entregue" },
    ],
  },
  {
    id: "c9",
    name: "Thiago Martins",
    phone: "(11) 96543-2100",
    email: "thiago.m@email.com",
    address: null,
    registeredAt: "2025-11-01",
    totalSpent: 52.0,
    lastPurchase: "2025-11-08",
    status: "inativo",
    isFavorite: false,
    isBlocked: true,
    notes: "Bloqueado: tentativa de fraude no pagamento",
    topProduct: null,
    orders: [
      { id: "p056", date: "2025-11-08", items: ["Combo Festa 15 pessoas"], total: 0, status: "Cancelado" },
      { id: "p054", date: "2025-11-03", items: ["Pizza Margherita"], total: 52.0, status: "Entregue" },
    ],
  },
  {
    id: "c10",
    name: "Patricia Souza",
    phone: "(11) 94321-8765",
    email: "patricia.s@email.com",
    address: "Rua Consolacao, 450 - Apto 8B",
    registeredAt: "2024-05-15",
    totalSpent: 780.0,
    lastPurchase: "2026-01-28",
    status: "ativo",
    isFavorite: false,
    isBlocked: false,
    notes: "",
    topProduct: "Hamburguer Artesanal",
    orders: [
      { id: "p091", date: "2026-01-28", items: ["Hamburguer Artesanal x2", "Batata Frita x2"], total: 124.0, status: "Entregue" },
      { id: "p076", date: "2026-01-12", items: ["Hamburguer Artesanal", "Milkshake"], total: 74.5, status: "Entregue" },
      { id: "p062", date: "2025-12-10", items: ["Combo Duplo", "Onion Rings"], total: 112.0, status: "Entregue" },
      { id: "p050", date: "2025-11-08", items: ["Hamburguer Artesanal"], total: 45.0, status: "Entregue" },
      { id: "p035", date: "2025-10-01", items: ["Combo Duplo"], total: 98.0, status: "Entregue" },
    ],
  },
  {
    id: "c11",
    name: "Diego Nascimento",
    phone: "(21) 93456-7890",
    email: null,
    address: "Rua Copacabana, 78",
    registeredAt: "2025-12-10",
    totalSpent: 185.0,
    lastPurchase: "2026-02-03",
    status: "ativo",
    isFavorite: false,
    isBlocked: false,
    notes: "Cliente novo, potencial recorrente",
    topProduct: "Esfiha de Carne",
    orders: [
      { id: "p097", date: "2026-02-03", items: ["Esfiha de Carne x10", "Refrigerante 2L"], total: 85.0, status: "Entregue" },
      { id: "p086", date: "2026-01-20", items: ["Esfiha Mista x5"], total: 40.0, status: "Entregue" },
      { id: "p080", date: "2025-12-15", items: ["Esfiha de Carne x8"], total: 60.0, status: "Entregue" },
    ],
  },
  {
    id: "c12",
    name: "Camila Rodrigues",
    phone: "(11) 92222-3333",
    email: "camila.r@email.com",
    address: "Rua Oscar Freire, 320",
    registeredAt: "2024-09-01",
    totalSpent: 1420.0,
    lastPurchase: "2026-02-06",
    status: "ativo",
    isFavorite: true,
    isBlocked: false,
    notes: "Sempre adiciona observacao nos pedidos",
    topProduct: "Pizza Margherita",
    orders: [
      { id: "p100b", date: "2026-02-06", items: ["Pizza Margherita", "Pizza 4 Queijos", "Sobremesa"], total: 142.8, status: "Entregue" },
      { id: "p089", date: "2026-01-26", items: ["Pizza Margherita x2"], total: 109.8, status: "Entregue" },
      { id: "p077", date: "2026-01-14", items: ["Combo Familia", "Refrigerante 2L x2"], total: 149.0, status: "Entregue" },
      { id: "p064", date: "2025-12-18", items: ["Pizza Margherita", "Pizza Pepperoni", "Sobremesa"], total: 148.8, status: "Entregue" },
      { id: "p049", date: "2025-11-05", items: ["Pizza Margherita x3"], total: 164.7, status: "Entregue" },
      { id: "p036", date: "2025-10-02", items: ["Combo Festa 10 pessoas"], total: 280.0, status: "Entregue" },
    ],
  },
]

/** Helpers */
export function isRecurrentClient(client: Client): boolean {
  return client.orders.length >= 5
}

export function isNewClient(client: Client): boolean {
  const registered = new Date(client.registeredAt)
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  return registered >= threeMonthsAgo
}

export function isInactiveForLong(client: Client): boolean {
  if (!client.lastPurchase) return true
  const last = new Date(client.lastPurchase)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  return last < sixMonthsAgo
}

export function getAverageTimeBetweenOrders(client: Client): string {
  if (client.orders.length < 2) return "N/A"
  const sorted = [...client.orders]
    .map((o) => new Date(o.date).getTime())
    .sort((a, b) => a - b)
  let totalDiff = 0
  for (let i = 1; i < sorted.length; i++) {
    totalDiff += sorted[i] - sorted[i - 1]
  }
  const avgMs = totalDiff / (sorted.length - 1)
  const avgDays = Math.round(avgMs / (1000 * 60 * 60 * 24))
  return `${avgDays} dias`
}

export function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export { formatDate } from "@/lib/utils/format-date"

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}
