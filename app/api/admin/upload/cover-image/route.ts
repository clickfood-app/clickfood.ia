import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

async function getAuthenticatedUserFromRequest(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configuração do Supabase ausente.")
  }

  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim()

  if (!token) {
    throw new Error("Usuário não autenticado.")
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUserFromRequest(req)

    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (restaurantError) {
      console.error("Erro ao buscar restaurante para upload de capa:", {
        userId: user.id,
        message: restaurantError.message,
        code: restaurantError.code,
      })

      return jsonError("Erro ao buscar restaurante.", 500)
    }

    if (!restaurant) {
      return jsonError("Restaurante não encontrado.", 404)
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return jsonError("Arquivo não enviado.", 400)
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return jsonError("Formato inválido. Use JPG, PNG ou WEBP.", 400)
    }

    if (file.size <= 0) {
      return jsonError("Arquivo inválido.", 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return jsonError("A capa deve ter no máximo 5MB.", 400)
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const extension = getExtensionFromMimeType(file.type)
    const filePath = `restaurants/${restaurant.id}/cover/cover-${Date.now()}-${crypto.randomUUID()}.${extension}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from("restaurant-assets")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
        cacheControl: "3600",
      })

    if (uploadError) {
      console.error("Erro ao enviar capa para Storage:", {
        restaurantId: restaurant.id,
        message: uploadError.message,
      })

      return jsonError("Erro ao enviar capa.", 500)
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("restaurant-assets")
      .getPublicUrl(filePath)

    if (!publicUrlData?.publicUrl) {
      return jsonError("Não foi possível gerar a URL pública da capa.", 500)
    }

    const cleanCoverUrl = publicUrlData.publicUrl.split("?")[0]

    const { data: updatedRestaurant, error: updateError } = await supabaseAdmin
      .from("restaurants")
      .update({
        cover_image_url: cleanCoverUrl,
      })
      .eq("id", restaurant.id)
      .select(
        "id, slug, logo_url, cover_image_url, theme_color, theme_mode, floating_cart_bg_color, floating_cart_text_color, floating_cart_number_color"
      )
      .single()

    if (updateError) {
      console.error("Erro ao salvar URL da capa no restaurante:", {
        restaurantId: restaurant.id,
        message: updateError.message,
        code: updateError.code,
      })

      await supabaseAdmin.storage.from("restaurant-assets").remove([filePath])

      return jsonError("Erro ao salvar capa no restaurante.", 500)
    }

    return NextResponse.json({
      success: true,
      imageUrl: cleanCoverUrl,
      filePath,
      restaurant: updatedRestaurant,
    })
  } catch (error) {
    console.error("POST /api/admin/upload/cover-image error:", error)

    return jsonError("Erro ao enviar capa.", 500)
  }
}