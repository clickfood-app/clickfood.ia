/**
 * Formata uma string de data para o formato brasileiro DD/MM/YYYY.
 * Faz parsing manual sem usar `new Date()` para evitar hydration mismatch
 * causado por diferenca de timezone entre Server (UTC) e Client (local).
 *
 * Aceita formatos: "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss", ISO strings.
 */
export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "---"
  const datePart = dateStr.split("T")[0]
  const parts = datePart.split("-")
  if (parts.length !== 3) return dateStr
  const [year, month, day] = parts
  return `${day}/${month}/${year}`
}
