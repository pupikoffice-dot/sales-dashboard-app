export { fmt, fmt0, fmt2, MONTH_NAMES } from '@dashboard/shared/format'

export function fmtDateIso(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/** Display timestamp from `generated` (ISO 8601 or YYYY-MM-DD HH:MM:SS). Format: DD/MM/YYYY HH:MM. */
export function formatGeneratedDisplay(generated?: string): string {
  if (!generated) return ''
  const s = generated.trim()
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  // Explicit DD/MM/YYYY HH:MM 24-hour format (not locale-dependent)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const year = d.getUTCFullYear()
  const hours = String(d.getUTCHours()).padStart(2, '0')
  const mins = String(d.getUTCMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${mins}`
}
