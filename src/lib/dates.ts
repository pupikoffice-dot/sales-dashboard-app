/**
 * Every date the website shows is DD/MM/YYYY (owner, 2026-11-08), whatever the browser's own locale is.
 * Dates travel as 'YYYY-MM-DD' (date columns) or as ISO timestamps; these helpers are the one place that turns them into text.
 */

const TZ = 'Asia/Jerusalem'
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const pad = (n: number) => String(n).padStart(2, '0')

const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

function zoned(d: Date) {
  const p = Object.fromEntries(parts.formatToParts(d).map(x => [x.type, x.value]))
  return { y: p.year, m: p.month, d: p.day, hh: p.hour, mm: p.minute }
}

/** 'YYYY-MM-DD' or an ISO timestamp -> 'DD/MM/YYYY'. Empty for missing/invalid input; an unrecognised string is returned unchanged. */
export function fmtDate(v: string | Date | null | undefined): string {
  if (v == null || v === '') return ''
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : (({ y, m, d }) => `${d}/${m}/${y}`)(zoned(v))
  const s = String(v).trim()
  const m = DATE_ONLY.exec(s)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) {
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) return (({ y, m: mo, d: da }) => `${da}/${mo}/${y}`)(zoned(d))
  }
  return s
}

/** ISO timestamp -> 'DD/MM/YYYY HH:MM' (Israel time). */
export function fmtDateTime(v: string | Date | null | undefined): string {
  if (v == null || v === '') return ''
  const d = v instanceof Date ? v : new Date(String(v))
  if (Number.isNaN(d.getTime())) return typeof v === 'string' ? v : ''
  const z = zoned(d)
  return `${z.d}/${z.m}/${z.y} ${z.hh}:${z.mm}`
}

/** Rewrite every 'YYYY-MM-DD' inside a sentence (server-written alert reasons, notes) as 'DD/MM/YYYY'. */
export function fmtDatesInText(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3/$2/$1')
}

/** Typed text -> 'YYYY-MM-DD'. Accepts 5/11/2026, 05-11-2026, 05.11.2026 and 05112026; null when it is not a real calendar date. */
export function parseDmy(text: string): string | null {
  const t = text.trim()
  const m = /^(\d{1,2})[/.\- ]?(\d{1,2})[/.\- ]?(\d{4})$/.exec(t)
  if (!m) return null
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || y < 1900 || y > 2100) return null
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  if (d > last) return null
  return `${y}-${pad(mo)}-${pad(d)}`
}

/** Digits typed so far -> 'DD/MM/YYYY' with the slashes inserted for the user. */
export function maskDmy(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}
