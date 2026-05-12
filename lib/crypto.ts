import crypto from "crypto"

const ENCRYPTION_SECRET = process.env.ASAAS_CREDENTIALS_SECRET

function getKey() {
  if (!ENCRYPTION_SECRET) {
    throw new Error("ASAAS_CREDENTIALS_SECRET não configurada.")
  }

  return crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest()
}

export function encryptText(value: string) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv)

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ])

  const authTag = cipher.getAuthTag()

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":")
}

export function decryptText(payload: string) {
  const [ivHex, authTagHex, encryptedHex] = payload.split(":")

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Payload criptografado inválido.")
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivHex, "hex")
  )

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}

export function getLast4(value: string) {
  const normalized = value.trim()
  return normalized.slice(-4)
}