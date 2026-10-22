import { StockHistoryView } from '../components/sales/StockHistoryView'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardFilters } from '../context/DashboardFiltersContext'

/** Opening and closing stock per item and day, with export. Opened from Operations → Stock history. */
export function StockHistoryPage() {
  const f = useDashboardFilters()
  const { access } = useDashboardAccess()
  return <StockHistoryView initialCompany={f.company && access?.companies.includes(f.company) ? f.company : null} />
}
