export { fmt, fmt0, fmt2, MONTH_NAMES } from '@dashboard/shared/format'

export function fmtDateIso(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/** Display export timestamp from data.json `generated` (YYYY-MM-DD HH:MM:SS). */
export function formatGeneratedDisplay(generated?: string): string {
  if (!generated) return ''
  const [datePart, timePart] = generated.trim().split(/\s+/)
  if (!datePart) return ''
  const formattedDate = fmtDateIso(datePart)
  const time = timePart?.slice(0, 5) ?? ''
  return time ? `${formattedDate} ${time}` : formattedDate
}
