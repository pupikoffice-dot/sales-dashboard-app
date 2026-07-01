export { fmt, fmt0, fmt2, MONTH_NAMES } from '@dashboard/shared/format'

export function fmtDateIso(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/** Display timestamp from `generated` (ISO 8601 or YYYY-MM-DD HH:MM:SS). */
export function formatGeneratedDisplay(generated?: string): string {
  if (!generated) return ''
  const s = generated.trim()
  // ISO 8601: "2026-07-01T15:43:04.000Z" or space: "2026-07-01 15:43:04"
  const [datePart, timePart] = s.includes('T')
    ? s.split('T')
    : s.split(/\s+/)
  if (!datePart) return ''
  const formattedDate = fmtDateIso(datePart)
  const time = timePart?.slice(0, 5) ?? ''
  return time ? `${formattedDate} ${time}` : formattedDate
}
