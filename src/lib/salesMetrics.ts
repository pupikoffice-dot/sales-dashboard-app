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
  return co
}

export function getDateLabel(filters: DashboardFiltersState): string {
  if (filters.dateMode === 'openorders') return 'Open Orders'
  if (filters.dateMode === 'stock') return 'Stock'
  if (filters.dateMode === 'range') {
    return `${filters.dateFrom} → ${filters.dateTo}`
  }
  return getSortedMonths(filters.selectedMonths)
    .map(k => {
      const [y, m] = k.split('-')
      return `${MONTH_NAMES[+m - 1]} ${y}`
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

export function monthSkewWarning(
  filters: DashboardFiltersState,
  rows: SalesRow[],
): string | null {
  if (filters.dateMode !== 'months' || !rows.length) return null
  const totalCash = rows.reduce((a, r) => a + (r.cash || 0), 0)
  if (totalCash <= 0) return null

  const months = getSortedMonths(filters.selectedMonths)
  let maxMk = ''
  let maxVal = 0
  months.forEach(mk => {
    const [y, m] = mk.split('-')
    const v = rows
      .filter(r => Number(r.year) === +y && Number(r.month) === +m)
      .reduce((a, r) => a + (r.cash || 0), 0)
    if (v > maxVal) {
      maxVal = v
      maxMk = mk
    }
  })

  const pct = (maxVal / totalCash) * 100
  if (pct <= 60 || months.length <= 1) return null
  const [y, m] = maxMk.split('-')
  return `⚠ ${MONTH_NAMES[+m - 1]} ${y} accounts for ${pct.toFixed(0)}% of total cash — your source data may have year-end accumulation rows in that month.`
}

export function formatTotals(cash: number, qty: number): { cash: string; qty: string } {
  return { cash: fmt(cash), qty: fmt(qty) }
}
