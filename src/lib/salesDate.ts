/**
 * Normalize sales-line dates to YYYY-MM-DD for reliable day matching.
 * Dashboard rows historically arrived as ISO dates, ISO datetimes, or dd/mm/yyyy;
 * strict string equality against a local calendar day then silently drops rows
 * (e.g. "2026-07-22T00:00:00.000Z" ≠ "2026-07-22").
 */
export function normalizeSalesDate(val: unknown): string | null {
  if (val == null || val === '') return null

  if (typeof val === 'string') {
    const s = val.trim()
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

    const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
    if (dmy) {
      const dd = dmy[1].padStart(2, '0')
      const mm = dmy[2].padStart(2, '0')
      return `${dmy[3]}-${mm}-${dd}`
    }
    return null
  }

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return [
      val.getFullYear(),
      String(val.getMonth() + 1).padStart(2, '0'),
      String(val.getDate()).padStart(2, '0'),
    ].join('-')
  }

  return null
}

/** JS getDay(): 0=Sun … 5=Fri, 6=Sat. Israel work week excludes Fri+Sat. */
export function isWeekendFriSat(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return false
  const dow = new Date(y, m - 1, d).getDay()
  return dow === 5 || dow === 6
}

/** English 3-letter weekday (Sun…Sat), keyed by YYYY-MM-DD. */
const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function weekdayShortEn(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return ''
  return DOW_EN[new Date(y, m - 1, d).getDay()] ?? ''
}
