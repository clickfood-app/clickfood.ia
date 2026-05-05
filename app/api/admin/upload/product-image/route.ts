import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { supabaseAdmin } from "@/lib/supabase-admin"

async function getAuthenticatedUserFromRequest(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Variáveis públicas do Supabase não configuradas.")
  }

  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "")

  if (!token) {
    throw new Error("Token não enviado.")
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey)

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) {
    throw new Error("Usuário não autenticado.")
  }

  return user
}

function getExtensionFromMimeType(contentType: string) {
  if (contentType === "image/png") return "png"
  if (contentType === "image/webp") return "webp"
  return "jpg"
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUserFromRequest(req)

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .single()

    if (restaurantError || !restaurant) {
      return NextResponse.json(
        { error: "Restaurante não encontrado." },
        { status: 404 }
      )
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Arquivo não enviado." },
        { status: 400 }
      )
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return NextResponse.json(
        { error: "Formato inválido. Use JPG, PNG ou WEBP." },
        { status: 400 }
      )
    }

    if (file.size > 300 * 1024) {
      return NextResponse.json(
        { error: "A imagem deve ter no máximo 300KB." },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const extension = getExtensionFromMimeType(file.type)
    const filePath = `restaurants/${restaurant.id}/products/${Date.now()}.${extension}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from("restaurant-assets")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 400 }
      )
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("restaurant-assets")
      .getPublicUrl(filePath)

    return NextResponse.json({
      success: true,
      imageUrl: publicUrlData.publicUrl,
      filePath,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao enviar imagem do produto.",
      },
      { status: 500 }
    )
  }
}