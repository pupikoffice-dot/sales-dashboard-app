import { useStickyTableHeaders } from '../../hooks/useStickyTableHeaders'
import { useTableColumnFilters } from '../../hooks/useTableColumnFilters'

/** Legacy DOM enhancements: sticky headers + column inline filters. */
export function SalesReportStickySetup() {
  useStickyTableHeaders('sales-report')
  useTableColumnFilters('sales-report')
  return null
}
