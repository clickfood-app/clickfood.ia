import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

function getFileExtension(file: File) {
  if (file.type === "image/png") return "png"
  if (file.type === "image/webp") return "webp"
  return "jpg"
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const restaurantId = String(formData.get("restaurantId") || "")
    const orderId = String(formData.get("orderId") || "")
    const proof = formData.get("proof")

    if (!restaurantId || !orderId) {
      return NextResponse.json(
        { success: false, error: "Pedido inválido." },
        { status: 400 }
      )
    }

    if (!(proof instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Envie a foto do comprovante." },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(proof.type)) {
      return NextResponse.json(
        { success: false, error: "Formato inválido. Envie PNG, JPG ou WEBP." },
        { status: 400 }
      )
    }

    if (proof.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "O comprovante deve ter no máximo 5 MB." },
        { status: 400 }
      )
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, restaurant_id, public_order_number")
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: "Pedido não encontrado." },
        { status: 404 }
      )
    }

    const extension = getFileExtension(proof)
    const proofPath = `${restaurantId}/${orderId}/${Date.now()}.${extension}`
    const fileBuffer = await proof.arrayBuffer()

    const { error: uploadError } = await supabaseAdmin.storage
      .from("payment-proofs")
      .upload(proofPath, fileBuffer, {
        contentType: proof.type,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json(
        {
          success: false,
          error: "Erro ao enviar comprovante.",
          details: uploadError.message,
        },
        { status: 500 }
      )
    }

    const { data: signedUrlData } = await supabaseAdmin.storage
      .from("payment-proofs")
      .createSignedUrl(proofPath, 60 * 60 * 24 * 7)

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        pix_proof_path: proofPath,
        pix_proof_url: signedUrlData?.signedUrl ?? null,
        pix_proof_uploaded_at: new Date().toISOString(),
        payment_method: "pix_manual",
        payment_status: "awaiting_review",
        status: "waiting_pix_confirmation",
      })
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId)
      .select("*")
      .single()

    if (updateError) {
      return NextResponse.json(
        {
          success: false,
          error: "Erro ao atualizar pedido.",
          details: updateError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      proofUrl: signedUrlData?.signedUrl ?? null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao enviar comprovante.",
      },
      { status: 500 }
    )
  }
}
