import { filterByDate as filterByDateShared } from '@dashboard/shared/salesDateFilter'
import type { DashboardFiltersState } from '../context/DashboardFiltersContext'
import type { SalesRow } from '../types/dashboard'

export {
  getDualMonthCols,
  getSortedMonths,
  sumMonthRows,
} from '@dashboard/shared/salesDateFilter'
export type { DualMonthCol } from '@dashboard/shared/salesDateFilter'

export function filterByDate(
  rows: SalesRow[],
  filters: Pick<DashboardFiltersState, 'dateMode' | 'dateFrom' | 'dateTo' | 'selectedMonths'>,
): SalesRow[] {
  return filterByDateShared(rows, filters)
}
