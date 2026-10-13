import { StockBrandView } from '../components/sales/StockBrandView'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardFilters } from '../context/DashboardFiltersContext'

/** Current warehouse stock grouped by brand (the same brand naming the Sales page uses). Opened from Operations → Stock by brand. */
export function StockBrandPage() {
  const f = useDashboardFilters()
  const { access } = useDashboardAccess()
  return <StockBrandView initialCompany={f.company && access?.companies.includes(f.company) ? f.company : null} />
}
