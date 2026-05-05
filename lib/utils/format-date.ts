export function formatDate(
  date: string | Date | null | undefined,
  locale = "pt-BR"
): string {
  if (!date) return "-"

  const parsedDate = date instanceof Date ? date : new Date(date)

  if (Number.isNaN(parsedDate.getTime())) {
    return "-"
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate)
}