"use client"

import Link from "next/link"
import { ArrowLeft, Shield, Database, Share2, UserCheck, Mail } from "lucide-react"

export default function PrivacidadePage() {
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
              <Shield className="h-7 w-7 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Politica de Privacidade</h1>
            <p className="mt-2 text-sm text-gray-500">Ultima atualizacao: Fevereiro de 2026</p>
          </div>

          {/* Sections */}
          <div className="space-y-8 text-gray-700 leading-relaxed">
            {/* Intro */}
            <p>
              A ClickFood valoriza a privacidade e a seguranca dos seus dados. Esta Politica de Privacidade
              descreve como coletamos, usamos, armazenamos e protegemos suas informacoes pessoais ao utilizar
              nossa plataforma.
            </p>

            {/* Section 1 */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <Database className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">1. Dados Coletados</h2>
              </div>
              <p className="mb-3">
                Para oferecer nossos servicos, coletamos os seguintes tipos de informacoes:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Dados de cadastro:</strong> nome completo, e-mail, telefone e endereco.</li>
                <li><strong>Dados de pedidos:</strong> historico de compras, preferencias e itens favoritos.</li>
                <li><strong>Dados de acesso:</strong> endereco IP, tipo de dispositivo e navegador utilizado.</li>
                <li><strong>Dados de pagamento:</strong> informacoes processadas por parceiros como Mercado Pago.</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <Shield className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">2. Como Usamos seus Dados</h2>
              </div>
              <p className="mb-3">Utilizamos suas informacoes para:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Criar e gerenciar sua conta na plataforma.</li>
                <li>Processar pedidos e pagamentos.</li>
                <li>Enviar comunicacoes sobre seu pedido, promocoes e novidades.</li>
                <li>Melhorar nossos servicos e personalizar sua experiencia.</li>
                <li>Cumprir obrigacoes legais e regulatorias.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <Share2 className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">3. Compartilhamento com Terceiros</h2>
              </div>
              <p className="mb-3">
                Seus dados podem ser compartilhados com parceiros de confianca, incluindo:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Processadores de pagamento:</strong> como Mercado Pago, para transacoes seguras.</li>
                <li><strong>Restaurantes parceiros:</strong> para processamento e entrega de pedidos.</li>
                <li><strong>Servicos de analise:</strong> para melhorar a plataforma (dados anonimizados).</li>
              </ul>
              <p className="mt-3">
                Nao vendemos ou alugamos suas informacoes pessoais para terceiros.
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <UserCheck className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">4. Seus Direitos</h2>
              </div>
              <p className="mb-3">Voce tem direito a:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Acessar:</strong> solicitar uma copia dos dados que temos sobre voce.</li>
                <li><strong>Corrigir:</strong> atualizar informacoes incorretas ou desatualizadas.</li>
                <li><strong>Excluir:</strong> solicitar a remocao dos seus dados pessoais.</li>
                <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <Mail className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">5. Contato</h2>
              </div>
              <p>
                Para exercer seus direitos ou tirar duvidas sobre esta politica, entre em contato conosco:
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
          <Link href="/termos" className="text-blue-600 hover:text-blue-700 hover:underline">
            Termos de Servico
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
