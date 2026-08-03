"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Poppins } from "next/font/google"
import {
  ArrowRight,
  BarChart3,
  Bike,
  Bot,
  Boxes,
  Check,
  ChevronDown,
  Clock3,
  Menu,
  MessageCircle,
  MonitorSmartphone,
  ShieldCheck,
  ShoppingBag,
  UtensilsCrossed,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react"

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
})

const navigation = [
  { label: "Soluções", href: "#solucoes" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Diferenciais", href: "#diferenciais" },
  { label: "Dúvidas", href: "#duvidas" },
]

const features: {
  title: string
  description: string
  icon: LucideIcon
  color: string
}[] = [
  {
    title: "Gestão de pedidos",
    description:
      "Receba e acompanhe todos os pedidos em uma operação visual e organizada.",
    icon: ShoppingBag,
    color: "bg-blue-50 text-blue-600",
  },
  {
    title: "Cardápio digital",
    description:
      "Venda por um cardápio próprio, rápido e preparado para qualquer dispositivo.",
    icon: MonitorSmartphone,
    color: "bg-orange-50 text-orange-600",
  },
  {
    title: "WhatsApp inteligente",
    description:
      "Automatize o atendimento sem perder a proximidade com seus clientes.",
    icon: Bot,
    color: "bg-violet-50 text-violet-600",
  },
  {
    title: "Controle financeiro",
    description:
      "Entenda vendas, formas de pagamento e resultados em um único painel.",
    icon: WalletCards,
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "Estoque e ficha técnica",
    description:
      "Controle insumos, custos e baixas de estoque conforme os pedidos são produzidos.",
    icon: Boxes,
    color: "bg-amber-50 text-amber-600",
  },
  {
    title: "Gestão de entregas",
    description:
      "Organize entregadores, acompanhe pedidos e mantenha o controle das taxas.",
    icon: Bike,
    color: "bg-sky-50 text-sky-600",
  },
]

const faqs = [
  {
    question: "A ClickFood serve para qualquer tipo de restaurante?",
    answer:
      "Sim. A estrutura pode ser configurada para hamburguerias, pizzarias, restaurantes, lanchonetes, delivery e outras operações de food service.",
  },
  {
    question: "Preciso instalar algum programa?",
    answer:
      "Não. A ClickFood funciona pela internet e pode ser acessada pelo computador, tablet ou celular.",
  },
  {
    question: "O sistema é configurado para o meu restaurante?",
    answer:
      "Sim. Configuramos o ambiente, o cardápio e os recursos necessários de acordo com a operação do estabelecimento.",
  },
  {
    question: "Consigo controlar pedidos e financeiro no mesmo lugar?",
    answer:
      "Sim. Pedidos, formas de pagamento, entregas, produtos, estoque e informações financeiras ficam integrados no mesmo sistema.",
  },
]

interface ImageSlotProps {
  src: string
  alt: string
  label: string
  className?: string
}

function ImageSlot({
  src,
  alt,
  label,
  className = "",
}: ImageSlotProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 ${className}`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
          <MonitorSmartphone className="h-7 w-7" />
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-700">{label}</p>
          <p className="mt-1 text-xs text-slate-400">{src}</p>
        </div>
      </div>

      {!failed && (
        <Image
          fill
          src={src}
          alt={alt}
          sizes="(max-width: 768px) 100vw, 50vw"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`object-contain transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  )
}

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <main
      className={`${poppins.className} min-h-screen overflow-x-hidden bg-white text-slate-950`}
    >
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1180px] items-center justify-between px-5 lg:px-8">
          <Link
            href="/"
            className="flex items-center"
            aria-label="Página inicial da ClickFood"
          >
            <Image
              src="/logo.png"
              alt="ClickFood"
              width={190}
              height={60}
              priority
              className="h-12 w-auto object-contain"
            />
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-slate-600 transition hover:text-[#111936]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              href="/auth"
              className="rounded-xl px-5 py-3 text-sm font-semibold text-[#111936] transition hover:bg-slate-100"
            >
              Entrar
            </Link>

            <a
              href="#contato"
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-orange-600"
            >
              Quero conhecer
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-[#111936] transition hover:bg-slate-100 lg:hidden"
            aria-label="Abrir menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-5 py-6 shadow-lg lg:hidden">
            <nav className="mx-auto flex max-w-[1180px] flex-col gap-2">
              {navigation.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-[#111936]"
                >
                  {item.label}
                </a>
              ))}

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link
                  href="/auth"
                  className="flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-[#111936] transition hover:bg-slate-100"
                >
                  Entrar
                </Link>

                <a
                  href="#contato"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white"
                >
                  Quero conhecer
                </a>
              </div>
            </nav>
          </div>
        )}
      </header>

      <section className="relative overflow-hidden bg-[#111936] pb-20 pt-32 text-white sm:pb-28 sm:pt-40 lg:min-h-[790px] lg:pb-32">
        <div className="absolute -left-40 top-28 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-[460px] w-[460px] rounded-full bg-orange-500/15 blur-3xl" />

        <div className="absolute inset-0 opacity-[0.035]">
          <div className="h-full w-full bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:56px_56px]" />
        </div>

        <div className="relative mx-auto grid max-w-[1180px] items-center gap-14 px-5 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:px-8">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-xs font-semibold text-blue-200">
              <UtensilsCrossed className="h-4 w-4" />
              Tecnologia criada para food service
            </div>

            <h1 className="max-w-[680px] text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] sm:text-5xl lg:text-[64px]">
              Seu restaurante no controle.
              <span className="block text-orange-500">Do pedido ao lucro.</span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-8 text-white/65 sm:text-lg">
              Centralize pedidos, cardápio, atendimento, estoque, entregas e
              financeiro em uma estrutura desenvolvida para a realidade do seu
              restaurante.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#solucoes"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 text-sm font-semibold text-white shadow-xl shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-500"
              >
                Conhecer a ClickFood
                <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/auth"
                className="inline-flex min-h-14 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-7 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Já sou cliente
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/55">
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-orange-500" />
                Configuração personalizada
              </span>

              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-orange-500" />
                Acesso por qualquer dispositivo
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[650px] lg:translate-x-8">
            <div className="absolute -left-6 top-10 h-36 w-36 rounded-full bg-blue-500/20 blur-2xl" />
            <div className="absolute -right-10 bottom-4 h-40 w-40 rounded-full bg-orange-500/20 blur-2xl" />

            <div className="relative rotate-[1.5deg] rounded-[28px] border border-white/15 bg-white/10 p-3 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="rounded-[22px] bg-white p-2">
                <ImageSlot
                  src="/landing/hero-dashboard.png"
                  alt="Painel principal da ClickFood"
                  label="PNG principal do painel"
                  className="aspect-[16/10] rounded-[18px]"
                />
              </div>
            </div>

            <div className="absolute -bottom-8 -left-3 rounded-2xl border border-white/10 bg-white p-4 text-slate-950 shadow-2xl sm:-left-8 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <ShoppingBag className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Nova venda
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    Pedido recebido
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute -right-2 top-8 hidden rounded-2xl border border-white/10 bg-[#1c2854] p-4 shadow-2xl sm:block">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-blue-300" />

                <div>
                  <p className="text-xs text-white/50">Operação</p>
                  <p className="text-sm font-semibold text-white">
                    Em tempo real
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 -mt-7 px-5 lg:px-8">
        <div className="mx-auto grid max-w-[1080px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 sm:grid-cols-3">
          {[
            {
              icon: Clock3,
              title: "Operação ágil",
              text: "Menos etapas e mais produtividade",
            },
            {
              icon: ShieldCheck,
              title: "Dados organizados",
              text: "Informações centralizadas e seguras",
            },
            {
              icon: BarChart3,
              title: "Decisões melhores",
              text: "Indicadores claros para sua gestão",
            },
          ].map((item, index) => {
            const Icon = item.icon

            return (
              <div
                key={item.title}
                className={`flex items-center gap-4 px-6 py-6 ${
                  index !== 2
                    ? "border-b border-slate-200 sm:border-b-0 sm:border-r"
                    : ""
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {item.text}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="px-5 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-[1180px]">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-orange-500">
              Uma operação conectada
            </span>

            <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-[-0.03em] text-[#111936] sm:text-5xl">
              Menos improviso. Mais controle sobre o seu restaurante.
            </h2>

            <p className="mt-6 text-base leading-8 text-slate-500 sm:text-lg">
              A ClickFood reúne os pontos mais importantes da operação para que
              sua equipe trabalhe com clareza e seu negócio cresça com dados.
            </p>
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon

              return (
                <article
                  key={feature.title}
                  className="group rounded-2xl border border-slate-200 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-950/5"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${feature.color}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  <h3 className="mt-6 text-lg font-bold text-[#111936]">
                    {feature.title}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-slate-500">
                    {feature.description}
                  </p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section
        id="solucoes"
        className="scroll-mt-20 overflow-hidden bg-slate-50 px-5 py-24 sm:py-32 lg:px-8"
      >
        <div className="mx-auto grid max-w-[1180px] items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div className="relative">
            <div className="absolute -left-16 -top-16 h-52 w-52 rounded-full bg-blue-100 blur-3xl" />

            <div className="relative rounded-[28px] border border-slate-200 bg-white p-3 shadow-2xl shadow-blue-950/10">
              <ImageSlot
                src="/landing/pedidos.png"
                alt="Tela de gestão de pedidos da ClickFood"
                label="PNG da tela de pedidos"
                className="aspect-[4/3] rounded-[20px]"
              />
            </div>
          </div>

          <div>
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">
              Gestão de pedidos
            </span>

            <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-[-0.03em] text-[#111936] sm:text-5xl">
              Todos os pedidos em uma única operação.
            </h2>

            <p className="mt-6 text-base leading-8 text-slate-500">
              Acompanhe cada etapa do pedido, desde o recebimento até a entrega,
              sem depender de anotações soltas ou várias telas desconectadas.
            </p>

            <div className="mt-8 space-y-4">
              {[
                "Visão organizada por etapa do pedido",
                "Atualização da operação em tempo real",
                "Informações completas para produção e entrega",
                "Experiência adaptada para computador e celular",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <Check className="h-3.5 w-3.5" />
                  </div>

                  <p className="text-sm font-medium leading-6 text-slate-700">
                    {item}
                  </p>
                </div>
              ))}
            </div>

            <a
              href="#contato"
              className="mt-9 inline-flex items-center gap-2 text-sm font-bold text-blue-600 transition hover:gap-3"
            >
              Quero organizar minha operação
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section
        id="diferenciais"
        className="scroll-mt-20 bg-[#111936] px-5 py-24 text-white sm:py-32 lg:px-8"
      >
        <div className="mx-auto grid max-w-[1180px] items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-xs font-semibold text-orange-300">
              <MessageCircle className="h-4 w-4" />
              Atendimento conectado à operação
            </div>

            <h2 className="mt-6 text-3xl font-extrabold leading-tight tracking-[-0.03em] sm:text-5xl">
              Seu WhatsApp deixa de ser uma bagunça.
            </h2>

            <p className="mt-6 max-w-xl text-base leading-8 text-white/60">
              Automatize o primeiro atendimento, apresente o cardápio e conduza
              o cliente até o pedido sem sobrecarregar sua equipe.
            </p>

            <div className="mt-9 grid gap-4 sm:grid-cols-2">
              {[
                "Atendimento automático",
                "Cardápio sempre disponível",
                "Pedidos conectados ao painel",
                "Mais agilidade para responder",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <Check className="h-4 w-4 shrink-0 text-orange-400" />
                  <span className="text-sm font-medium text-white/80">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -right-16 -top-16 h-60 w-60 rounded-full bg-orange-500/10 blur-3xl" />

            <div className="relative rounded-[28px] border border-white/10 bg-white/10 p-3 shadow-2xl shadow-black/30">
              <ImageSlot
                src="/landing/whatsapp.png"
                alt="Atendimento pelo WhatsApp conectado à ClickFood"
                label="PNG do atendimento pelo WhatsApp"
                className="aspect-[4/3] rounded-[20px] bg-white"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden px-5 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto grid max-w-[1180px] items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div className="order-2 lg:order-1">
            <div className="relative rounded-[28px] border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10">
              <ImageSlot
                src="/landing/financeiro.png"
                alt="Painel financeiro da ClickFood"
                label="PNG da tela financeira"
                className="aspect-[4/3] rounded-[20px]"
              />
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-orange-500">
              Gestão financeira
            </span>

            <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-[-0.03em] text-[#111936] sm:text-5xl">
              Dados que mostram o que realmente está acontecendo.
            </h2>

            <p className="mt-6 text-base leading-8 text-slate-500">
              Visualize vendas, ticket médio, formas de pagamento e resultados
              sem depender de planilhas difíceis de manter.
            </p>

            <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-6">
              <BarChart3 className="h-7 w-7 text-blue-600" />

              <p className="mt-4 text-base font-bold text-[#111936]">
                Informação simples para decisões mais rápidas.
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Entenda os números do restaurante sem precisar procurar dados
                em vários lugares.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="como-funciona"
        className="scroll-mt-20 bg-blue-600 px-5 py-24 text-white sm:py-28 lg:px-8"
      >
        <div className="mx-auto max-w-[1180px]">
          <div className="max-w-2xl">
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-blue-100">
              Como funciona
            </span>

            <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-[-0.03em] sm:text-5xl">
              A tecnologia se adapta ao seu restaurante.
            </h2>

            <p className="mt-6 text-base leading-8 text-blue-100">
              Nossa equipe prepara a estrutura para que sua operação comece de
              forma organizada.
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {[
              {
                number: "01",
                title: "Entendemos sua operação",
                description:
                  "Mapeamos o atendimento, o cardápio, as entregas e as necessidades do restaurante.",
              },
              {
                number: "02",
                title: "Configuramos a ClickFood",
                description:
                  "Preparamos o sistema, cadastramos a estrutura e conectamos os recursos necessários.",
              },
              {
                number: "03",
                title: "Sua equipe começa a operar",
                description:
                  "O restaurante recebe o ambiente pronto para vender, atender e controlar a operação.",
              },
            ].map((step) => (
              <article
                key={step.number}
                className="rounded-2xl border border-white/15 bg-white/10 p-7 backdrop-blur"
              >
                <span className="text-sm font-extrabold text-orange-300">
                  {step.number}
                </span>

                <h3 className="mt-8 text-xl font-bold">{step.title}</h3>

                <p className="mt-4 text-sm leading-7 text-blue-100">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="duvidas"
        className="scroll-mt-20 px-5 py-24 sm:py-32 lg:px-8"
      >
        <div className="mx-auto grid max-w-[1080px] gap-14 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <div>
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-orange-500">
              Dúvidas frequentes
            </span>

            <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-[-0.03em] text-[#111936] sm:text-4xl">
              Tudo o que você precisa saber.
            </h2>

            <p className="mt-5 text-sm leading-7 text-slate-500">
              Ainda ficou alguma dúvida? Fale com a nossa equipe e conheça a
              estrutura ideal para o seu restaurante.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-slate-200 bg-white px-6"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-6 text-sm font-bold text-[#111936] sm:text-base">
                  {faq.question}

                  <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
                </summary>

                <p className="border-t border-slate-100 pb-6 pt-5 text-sm leading-7 text-slate-500">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="contato" className="px-5 pb-20 lg:px-8">
        <div className="relative mx-auto max-w-[1180px] overflow-hidden rounded-[32px] bg-[#111936] px-6 py-16 text-center text-white sm:px-12 sm:py-20">
          <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-blue-600/25 blur-3xl" />
          <div className="absolute -bottom-36 -right-28 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl" />

          <div className="relative mx-auto max-w-3xl">
            <h2 className="text-3xl font-extrabold leading-tight tracking-[-0.03em] sm:text-5xl">
              Pronto para colocar seu restaurante no controle?
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-white/60">
              Conheça uma estrutura criada para organizar sua operação, melhorar
              o atendimento e ajudar seu restaurante a crescer.
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href="https://www.clickfoodbr.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-orange-500 px-7 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-orange-600"
              >
                Falar com a ClickFood
                <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/auth"
                className="inline-flex min-h-14 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-7 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Acessar minha conta
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-9 lg:px-8">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-6 sm:flex-row">
          <Link
            href="/"
            className="flex items-center"
            aria-label="Página inicial da ClickFood"
          >
            <Image
              src="/logo.png"
              alt="ClickFood"
              width={160}
              height={50}
              className="h-10 w-auto object-contain"
            />
          </Link>

          <p className="text-center text-xs text-slate-400">
            © 2026 ClickFood. Tecnologia para food service.
          </p>

          <Link
            href="/auth"
            className="text-sm font-semibold text-slate-600 transition hover:text-blue-600"
          >
            Área do cliente
          </Link>
        </div>
      </footer>
    </main>
  )
}