import { useStickyTableHeaders } from '../../hooks/useStickyTableHeaders'
import { useTableColumnFilters } from '../../hooks/useTableColumnFilters'

interface SalesReportStickySetupProps {
  /** Skip sticky headers and column filters when table count exceeds this threshold. */
  deferAboveTableCount?: number
}

/** Legacy DOM enhancements: sticky headers + column inline filters. */
export function SalesReportStickySetup({ deferAboveTableCount }: SalesReportStickySetupProps) {
  useStickyTableHeaders('sales-report', { deferAboveTableCount })
  useTableColumnFilters('sales-report', { deferAboveTableCount })
  return null
}
