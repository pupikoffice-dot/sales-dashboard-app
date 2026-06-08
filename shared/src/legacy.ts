/**
 * IIFE bundle entry — exposed as window.DashboardShared for legacy HTML dashboards.
 * React app imports from individual modules via @dashboard/shared alias.
 */
export { fmt, fmt0, fmt2, MONTH_NAMES } from './format'
export {
  filterByDate,
  getDualMonthCols,
  getSortedMonths,
  sumMonthRows,
} from './salesDateFilter'
export type { DualMonthCol } from './salesDateFilter'
export {
  buildClientPie,
  buildItemPie,
  buildMonthlyBarFromRows,
} from './pieData'
export type { PieEntry } from './pieData'
export { sortTableDom } from './sortTableDom'
export {
  applyTableColumnFilters,
  attachAllTableColumnFilters,
  attachTableColumnFilters,
} from './tableColumnFilters'
export type { DateFilterInput, SalesRow } from './types'
