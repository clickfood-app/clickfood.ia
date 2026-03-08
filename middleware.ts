import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  let res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          res.cookies.set({
            name,
            value: "",
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = req.nextUrl.pathname

  const isAuthPage = pathname.startsWith("/auth")

  if (!session && !isAuthPage) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = "/auth/login"
    return NextResponse.redirect(redirectUrl)
  }

  if (session && isAuthPage) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = "/"
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: [
    "/pedidos/:path*",
    "/produtos/:path*",
    "/clientes/:path*",
    "/financeiro/:path*",
    "/relatorios/:path*",
    "/funcionarios/:path*",
    "/configuracoes/:path*",
    "/novo-pedido/:path*",
  ],
}