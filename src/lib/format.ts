export { fmt, fmt0, fmt2, MONTH_NAMES } from '@dashboard/shared/format'

export function fmtDateIso(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}
