import type { DateFilterInput, SalesRow } from './types'

export function getSortedMonths(selectedMonths: Set<string>): string[] {
  return [...selectedMonths].sort((a, b) => {
    const [ay, am] = a.split('-').map(Number)
    const [by, bm] = b.split('-').map(Number)
    return ay * 100 + am - (by * 100 + bm)
  })
}

export interface DualMonthCol {
  m: number
  cur: number
  prev: number
}

export function getDualMonthCols(selectedMonths: Set<string>): DualMonthCol[] {
  const byMonth: Record<number, number> = {}
  getSortedMonths(selectedMonths).forEach(mk => {
    const [y, m] = mk.split('-').map(Number)
    if (!byMonth[m] || y > byMonth[m]) byMonth[m] = y
  })
  return Object.entries(byMonth)
    .map(([m, y]) => ({ m: +m, cur: +y, prev: +y - 1 }))
    .sort((a, b) => a.cur * 100 + a.m - (b.cur * 100 + b.m))
}

export function sumMonthRows(rows: SalesRow[], year: number, month: number) {
  const matched = rows.filter(r => Number(r.year) === year && Number(r.month) === month)
  return {
    cash: matched.reduce((a, r) => a + (r.cash || 0), 0),
    qty: matched.reduce((a, r) => a + (r.qty || 0), 0),
  }
}

/** Generic over the row type: this only ever narrows the array, so callers with
 *  a richer SalesRow (the app's, which adds agent/docNum/etc.) get their own
 *  type back rather than the widened shared shape. */
export function filterByDate<T extends SalesRow>(rows: T[], filters: DateFilterInput): T[] {
  if (filters.dateMode === 'range') {
    const from = filters.dateFrom ? new Date(filters.dateFrom) : null
    const to = filters.dateTo ? new Date(filters.dateTo) : null
    return rows.filter(r => {
      if (!r.date) return false
      const d = new Date(r.date)
      if (from && d < from) return false
      if (to && d > to) return false
      return true
    })
  }

  if (filters.dateMode === 'months') {
    if (!filters.selectedMonths.size) return []
    return rows.filter(r => {
      let yr = Number(r.year)
      let mo = Number(r.month)
      if ((!mo || !yr) && r.date && r.date.length >= 7) {
        yr = yr || parseInt(r.date.substring(0, 4), 10)
        mo = mo || parseInt(r.date.substring(5, 7), 10)
      }
      return filters.selectedMonths.has(`${yr}-${mo}`)
    })
  }

  return rows
}
