import type { SalesRow } from '../types/dashboard'

export type MonthTotalsIndex = Map<string, { cash: number; qty: number }>

export function monthKey(year: number, month: number) {
  return `${year}-${month}`
}

export function buildMonthTotalsIndex(rows: SalesRow[]): MonthTotalsIndex {
  const index: MonthTotalsIndex = new Map()
  for (const r of rows) {
    let yr = Number(r.year)
    let mo = Number(r.month)
    if ((!mo || !yr) && r.date && r.date.length >= 7) {
      yr = yr || parseInt(r.date.substring(0, 4), 10)
      mo = mo || parseInt(r.date.substring(5, 7), 10)
    }
    if (!yr || !mo) continue
    const key = monthKey(yr, mo)
    const cur = index.get(key) ?? { cash: 0, qty: 0 }
    cur.cash += r.cash || 0
    cur.qty += r.qty || 0
    index.set(key, cur)
  }
  return index
}

export function getMonthTotal(index: MonthTotalsIndex, year: number, month: number) {
  return index.get(monthKey(year, month)) ?? { cash: 0, qty: 0 }
}
