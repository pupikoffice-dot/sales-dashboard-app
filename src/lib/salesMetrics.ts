import type { DashboardFiltersState } from '../context/DashboardFiltersContext'
import { fmt, MONTH_NAMES } from './format'
import { getSortedMonths } from './salesDateFilter'
import type { LogicalCompany, SalesRow } from '../types/dashboard'
import type { WmsStockMap } from './wmsData'

export function sumRows(rows: SalesRow[]): { cash: number; qty: number } {
  return {
    cash: rows.reduce((a, r) => a + (r.cash || 0), 0),
    qty: rows.reduce((a, r) => a + (r.qty || 0), 0),
  }
}

export function companyLabel(co: LogicalCompany): string {
  if (co === 'pupik') return 'Pupik'
  if (co === 'mt') return 'Monkeytime'
  if (co === 'grow') return 'Grow'
  if (co === 'gold') return 'Goldbug'
  return co
}

export function getDateLabel(
  filters: DashboardFiltersState,
  // Widened from the inferred 12-tuple of MONTH_NAMES: callers pass the
  // locale-driven string[] from LocaleContext, and this only ever indexes it.
  monthNames: readonly string[] = MONTH_NAMES,
): string {
  if (filters.dateMode === 'openorders') return 'Open Orders'
  if (filters.dateMode === 'stock') return 'Stock'
  if (filters.dateMode === 'range') {
    return `${filters.dateFrom} → ${filters.dateTo}`
  }
  return getSortedMonths(filters.selectedMonths)
    .map(k => {
      const [y, m] = k.split('-')
      return `${monthNames[+m - 1] ?? MONTH_NAMES[+m - 1]} ${y}`
    })
    .join(', ')
}

export function getWmsQty(
  sku: string,
  company: LogicalCompany | null,
  wmsStock: WmsStockMap,
): number | null {
  if (!company || !wmsStock[company]) return null
  const v = wmsStock[company][sku]
  return v != null ? v : null
}

export interface MonthSkew {
  year: number
  /** 1-12 */
  month: number
  /** That month's share of total cash, 0-100. */
  pct: number
  /** Share of the month's cash carried by its largest few rows, 0-100. */
  concentrationPct: number
}

/** Rows in the top slice used to detect accumulation entries (min 3). */
const SKEW_TOP_SLICE = 0.01
const SKEW_MIN_SHARE_PCT = 60
const SKEW_MIN_CONCENTRATION_PCT = 50

/**
 * Detects the fingerprint of ERP year-end "accumulation" rows: one month
 * dominating the selected period AND that month's cash being carried by a
 * handful of huge rows.
 *
 * Dominance ALONE is not evidence — it used to be the only test, which meant a
 * two-month selection warned on any 60/40 split, i.e. on perfectly ordinary
 * data (e.g. Pupik Feb+Mar 2026: March was 64% simply because it was ~2x the
 * month February was, spread over 4,573 rows with the largest at 0.8%).
 * Requiring concentration as well is what separates "a big month" from "a few
 * bogus rows".
 *
 * Returns the facts; the caller formats them (so the copy can be translated).
 */
export function monthSkewWarning(
  filters: DashboardFiltersState,
  rows: SalesRow[],
): MonthSkew | null {
  if (filters.dateMode !== 'months' || !rows.length) return null
  const months = getSortedMonths(filters.selectedMonths)
  if (months.length < 2) return null

  // One pass for per-month cash + the overall total.
  const byMonth = new Map<string, number>()
  let totalCash = 0
  for (const r of rows) {
    const cash = r.cash || 0
    if (cash <= 0) continue
    const mk = `${Number(r.year)}-${Number(r.month)}`
    byMonth.set(mk, (byMonth.get(mk) ?? 0) + cash)
    totalCash += cash
  }
  if (totalCash <= 0) return null

  let maxMk = ''
  let maxVal = 0
  for (const mk of months) {
    const v = byMonth.get(mk) ?? 0
    if (v > maxVal) {
      maxVal = v
      maxMk = mk
    }
  }
  if (!maxMk || maxVal <= 0) return null

  const pct = (maxVal / totalCash) * 100
  if (pct <= SKEW_MIN_SHARE_PCT) return null

  // Only now (and only for the one dominant month) pay for the concentration
  // check, so this stays cheap on every status-bar render.
  const [y, m] = maxMk.split('-').map(Number)
  const cashes: number[] = []
  for (const r of rows) {
    const cash = r.cash || 0
    if (cash > 0 && Number(r.year) === y && Number(r.month) === m) cashes.push(cash)
  }
  if (cashes.length < 10) return null
  cashes.sort((a, b) => b - a)
  const topN = Math.max(3, Math.ceil(cashes.length * SKEW_TOP_SLICE))
  let top = 0
  for (let i = 0; i < topN; i++) top += cashes[i]
  const concentrationPct = (top / maxVal) * 100
  if (concentrationPct < SKEW_MIN_CONCENTRATION_PCT) return null

  return { year: y, month: m, pct, concentrationPct }
}

export function formatTotals(cash: number, qty: number): { cash: string; qty: string } {
  return { cash: fmt(cash), qty: fmt(qty) }
}
