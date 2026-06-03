import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )

          supabaseResponse = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname.startsWith("/auth")

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth"
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = "/pedidos"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/",
    "/auth/:path*",

    "/gestao/:path*",
    "/painel/:path*",
    "/pedidos/:path*",
    "/novo-pedido/:path*",
    "/produtos/:path*",
    "/combos/:path*",
    "/clientes/:path*",
    "/cupons/:path*",
    "/campanhas/:path*",
    "/crescimento/:path*",
    "/metas/:path*",

    "/mesas/:path*",
    "/entregadores/:path*",
    "/entregas/:path*",
    "/funcionarios/:path*",
    "/equipe/:path*",
    "/kds/:path*",

    "/financeiro/:path*",
    "/relatorios/:path*",
    "/compras-fornecedores/:path*",
    "/fornecedores/:path*",
    "/ficha-tecnica/:path*",
    "/producao-diaria/:path*",
    "/perdas-desperdicio/:path*",

    "/configuracoes/:path*",
    "/configurar/:path*",
    "/divulgar-cardapio/:path*",
    "/clickclub/:path*",
  ],
}