import { filterByDate as filterByDateShared } from '@dashboard/shared/salesDateFilter'
import type { DashboardFiltersState } from '../context/DashboardFiltersContext'
import type { SalesRow } from '../types/dashboard'

export {
  getDualMonthCols,
  getSortedMonths,
  sumMonthRows,
} from '@dashboard/shared/salesDateFilter'
export type { DualMonthCol } from '@dashboard/shared/salesDateFilter'

/** Years that company has sales for. Falls back to the current dashboard span when nothing is loaded yet. */
export function yearsInCompanySales(
  rows: readonly { company?: string; year?: number | string | null }[],
  company: string | null,
): number[] {
  const years = new Set<number>()
  if (company) {
    for (const row of rows) {
      if (row.company !== company) continue
      const year = Number(row.year)
      if (year >= 2000 && year <= 2100) years.add(year)
    }
  }
  const list = [...years].sort((a, b) => a - b)
  return list.length ? list : [2025, 2026]
}

export function filterByDate(
  rows: SalesRow[],
  filters: Pick<DashboardFiltersState, 'dateMode' | 'dateFrom' | 'dateTo' | 'selectedMonths'>,
): SalesRow[] {
  return filterByDateShared(rows, filters)
}
