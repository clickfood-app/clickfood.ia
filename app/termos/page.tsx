"use client"

import Link from "next/link"
import { ArrowLeft, FileText, UserCircle, ShieldCheck, CreditCard, AlertTriangle, Mail } from "lucide-react"

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b border-blue-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao site
          </Link>
          <span className="text-lg font-bold text-blue-600">ClickFood</span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-2xl border border-blue-100 bg-white p-8 md:p-12 shadow-sm">
          {/* Title */}
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
              <FileText className="h-7 w-7 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Termos de Servico</h1>
            <p className="mt-2 text-sm text-gray-500">Ultima atualizacao: Fevereiro de 2026</p>
          </div>

          {/* Sections */}
          <div className="space-y-8 text-gray-700 leading-relaxed">
            {/* Intro */}
            <p>
              Ao utilizar a plataforma ClickFood, voce concorda com os termos e condicoes descritos abaixo.
              Leia atentamente antes de usar nossos servicos.
            </p>

            {/* Section 1 */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">1. Aceitacao dos Termos</h2>
              </div>
              <p>
                Ao acessar ou utilizar a ClickFood, voce declara ter lido, compreendido e concordado com
                estes Termos de Servico. Caso nao concorde com alguma disposicao, voce nao devera utilizar
                a plataforma.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <UserCircle className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">2. Conta de Usuario</h2>
              </div>
              <p className="mb-3">
                Para utilizar nossos servicos, voce devera criar uma conta fornecendo informacoes verdadeiras
                e atualizadas. Voce e responsavel por:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Manter a confidencialidade da sua senha.</li>
                <li>Todas as atividades realizadas em sua conta.</li>
                <li>Notificar imediatamente a ClickFood sobre qualquer uso nao autorizado.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">3. Uso do Servico</h2>
              </div>
              <p className="mb-3">Ao utilizar a ClickFood, voce concorda em:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Nao utilizar a plataforma para fins ilegais ou fraudulentos.</li>
                <li>Nao tentar acessar areas restritas ou sistemas da plataforma.</li>
                <li>Nao interferir no funcionamento normal dos servicos.</li>
                <li>Respeitar os direitos de propriedade intelectual da ClickFood.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">4. Pagamentos</h2>
              </div>
              <p className="mb-3">
  Os pagamentos realizados atraves da ClickFood sao processados por parceiros de pagamento
  confiaveis e integracoes financeiras utilizadas pela plataforma.
</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Os precos exibidos incluem todas as taxas aplicaveis.</li>
                <li>Reembolsos seguem a politica de cada restaurante parceiro.</li>
                <li>A ClickFood nao armazena dados completos de cartao de credito.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">5. Limitacao de Responsabilidade</h2>
              </div>
              <p className="mb-3">A ClickFood nao se responsabiliza por:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Qualidade, seguranca ou legalidade dos produtos vendidos pelos restaurantes.</li>
                <li>Atrasos ou falhas na entrega causados por terceiros.</li>
                <li>Indisponibilidade temporaria da plataforma por manutencao ou problemas tecnicos.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">6. Modificacoes</h2>
              </div>
              <p>
                A ClickFood reserva-se o direito de modificar estes Termos a qualquer momento.
                Alteracoes significativas serao comunicadas por e-mail ou notificacao na plataforma.
                O uso continuado apos as alteracoes implica aceitacao dos novos termos.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <Mail className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">7. Contato</h2>
              </div>
              <p>
                Para duvidas sobre estes Termos de Servico, entre em contato conosco:
              </p>
              <div className="mt-4 rounded-xl bg-blue-50 p-4">
                <a
                  href="mailto:goeatscentral@gmail.com"
                  className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  goeatscentral@gmail.com
                </a>
              </div>
            </section>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
          <Link href="/privacidade" className="text-blue-600 hover:text-blue-700 hover:underline">
            Politica de Privacidade
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/contato" className="text-blue-600 hover:text-blue-700 hover:underline">
            Fale Conosco
          </Link>
        </div>
      </main>
    </div>
  )
}
