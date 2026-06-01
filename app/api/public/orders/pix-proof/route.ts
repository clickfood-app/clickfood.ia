import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

type PixProofOrder = {
  id: string
  restaurant_id: string
  public_order_number: string | null
  payment_method: string | null
  payment_status: string | null
  status: string | null
}

function cleanText(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function normalizeStatus(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function getFileExtension(file: File) {
  if (file.type === "image/png") return "png"
  if (file.type === "image/webp") return "webp"
  return "jpg"
}

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  )
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const restaurantId = cleanText(formData.get("restaurantId"), 80)
    const orderId = cleanText(formData.get("orderId"), 80)
    const proof = formData.get("proof")

    if (!restaurantId || !orderId) {
      return jsonError("Pedido inválido.", 400)
    }

    if (!(proof instanceof File)) {
      return jsonError("Envie a foto do comprovante.", 400)
    }

    if (!ALLOWED_TYPES.includes(proof.type)) {
      return jsonError("Formato inválido. Envie PNG, JPG ou WEBP.", 400)
    }

    if (proof.size <= 0) {
      return jsonError("Arquivo inválido.", 400)
    }

    if (proof.size > MAX_FILE_SIZE) {
      return jsonError("O comprovante deve ter no máximo 5 MB.", 400)
    }

    const { data: orderData, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, restaurant_id, public_order_number, payment_method, payment_status, status"
      )
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle()

    if (orderError) {
      console.error("Erro ao buscar pedido para comprovante Pix:", {
        restaurantId,
        orderId,
        message: orderError.message,
        code: orderError.code,
      })

      return jsonError("Erro ao localizar pedido.", 500)
    }

    if (!orderData) {
      return jsonError("Pedido não encontrado.", 404)
    }

    const order = orderData as PixProofOrder

    const paymentMethod = normalizeStatus(order.payment_method)
    const orderStatus = normalizeStatus(order.status)

    if (["cancelled", "canceled", "cancelado"].includes(orderStatus)) {
      return jsonError("Não é possível enviar comprovante para pedido cancelado.", 400)
    }

    if (
      paymentMethod &&
      !["pix", "pix_manual", "pix_direto"].includes(paymentMethod)
    ) {
      return jsonError("Este pedido não usa pagamento Pix.", 400)
    }

    const extension = getFileExtension(proof)
    const proofPath = `${restaurantId}/${orderId}/${Date.now()}-${crypto.randomUUID()}.${extension}`
    const fileBuffer = await proof.arrayBuffer()

    const { error: uploadError } = await supabaseAdmin.storage
      .from("payment-proofs")
      .upload(proofPath, fileBuffer, {
        contentType: proof.type,
        upsert: false,
      })

    if (uploadError) {
      console.error("Erro ao enviar comprovante Pix:", {
        restaurantId,
        orderId,
        message: uploadError.message,
      })

      return jsonError("Erro ao enviar comprovante.", 500)
    }

    const { data: signedUrlData, error: signedUrlError } =
      await supabaseAdmin.storage
        .from("payment-proofs")
        .createSignedUrl(proofPath, 60 * 60 * 24 * 7)

    if (signedUrlError) {
      console.error("Erro ao criar URL assinada do comprovante:", {
        restaurantId,
        orderId,
        message: signedUrlError.message,
      })
    }

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
      .select(
        "id, restaurant_id, public_order_number, status, payment_status, total, payment_method, order_type, delivery_fee, created_at, pix_proof_path, pix_proof_url, pix_proof_uploaded_at"
      )
      .single()

    if (updateError || !updatedOrder) {
      console.error("Erro ao atualizar pedido com comprovante Pix:", {
        restaurantId,
        orderId,
        message: updateError?.message,
        code: updateError?.code,
      })

      await supabaseAdmin.storage.from("payment-proofs").remove([proofPath])

      return jsonError("Erro ao atualizar pedido.", 500)
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      proofUrl: signedUrlData?.signedUrl ?? null,
    })
  } catch (error) {
    console.error("POST /api/public/orders/pix-proof error:", error)

    return jsonError("Erro interno ao enviar comprovante.", 500)
  }
}