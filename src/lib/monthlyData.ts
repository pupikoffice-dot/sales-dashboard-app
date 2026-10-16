import type { SalesRow } from '../types/dashboard'

/** Receipts are stored gross (VAT included); sales are net, so receipts are shown net like in Oversight. */
export const RECEIPTS_VAT_RATE = 1.18

export interface YearMonth {
  year: number
  month: number // 1-12
}

/** Years that have data for the company: sales rows (invoiced sales, tagged with the company id) and receipts. */
export function availableYears(
  rows: SalesRow[],
  receipts: Record<string, number> | undefined,
  company: string,
): number[] {
  const years = new Set<number>()
  for (const r of rows) {
    if (r.company !== company) continue
    const y = Number(r.year)
    if (y > 2000) years.add(y)
  }
  for (const ym of Object.keys(receipts ?? {})) {
    const y = Number(ym.slice(0, 4))
    if (y > 2000) years.add(y)
  }
  return [...years].sort((a, b) => a - b)
}

const key = (year: number, month: number) => year * 12 + (month - 1)

/** Sales cash per (year, month) for the company, only for the months asked for. */
export function salesByMonth(rows: SalesRow[], company: string, picks: YearMonth[]): Map<number, number> {
  const want = new Set(picks.map(p => key(p.year, p.month)))
  const out = new Map<number, number>()
  for (const r of rows) {
    if (r.company !== company) continue
    const k = key(Number(r.year), Number(r.month))
    if (!want.has(k)) continue
    out.set(k, (out.get(k) ?? 0) + (Number(r.cash) || 0))
  }
  return out
}

/** Net receipts per (year, month) for the months asked for. */
export function receiptsByMonth(receipts: Record<string, number> | undefined, picks: YearMonth[]): Map<number, number> {
  const out = new Map<number, number>()
  for (const p of picks) {
    const gross = receipts?.[`${p.year}-${String(p.month).padStart(2, '0')}`]
    if (gross != null) out.set(key(p.year, p.month), Number(gross) / RECEIPTS_VAT_RATE)
  }
  return out
}

/** Sales cash per day of month (index 0 = day 1) for one month. */
export function salesByDay(rows: SalesRow[], company: string, year: number, month: number): number[] {
  const days = new Date(year, month, 0).getDate()
  const out = new Array<number>(days).fill(0)
  for (const r of rows) {
    if (r.company !== company || Number(r.year) !== year || Number(r.month) !== month) continue
    const d = Number(String(r.date ?? '').slice(8, 10))
    if (d >= 1 && d <= days) out[d - 1] += Number(r.cash) || 0
  }
  return out
}

/** Least-squares straight line through `values`, in the same order. */
export function linearTrend(values: number[]): number[] {
  const n = values.length
  if (n === 0) return []
  if (n === 1) return [values[0]]
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    const y = values[i]
    sumX += i
    sumY += y
    sumXY += i * y
    sumXX += i * i
  }
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return values.map(() => sumY / n)
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return values.map((_, i) => intercept + slope * i)
}

/** Every (year, month) combination of the chosen years and months, oldest first. */
export function combinePicks(years: number[], months: number[]): YearMonth[] {
  const out: YearMonth[] = []
  for (const year of [...years].sort((a, b) => a - b)) {
    for (const month of [...months].sort((a, b) => a - b)) out.push({ year, month })
  }
  return out
}

export interface MonthlySummaryRow {
  year: number
  month: number
  sales: number
  receipts: number | null
  /** Receipts as a percentage of sales (null when either is missing or sales are 0). */
  ratio: number | null
}

export function summarize(
  picks: YearMonth[],
  sales: Map<number, number>,
  receipts: Map<number, number>,
): MonthlySummaryRow[] {
  return picks.map(p => {
    const k = key(p.year, p.month)
    const s = sales.get(k) ?? 0
    const r = receipts.has(k) ? (receipts.get(k) as number) : null
    return { ...p, sales: s, receipts: r, ratio: r != null && s > 0 ? (r / s) * 100 : null }
  })
}
