import { ItemsIndexView } from '../components/sales/ItemsIndexView'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardFilters } from '../context/DashboardFiltersContext'
import { useLocale } from '../context/LocaleContext'

/** Items index — active items (REP103 column I) with REP907 data and WMS stock. Opened from FILTER → Items. */
export function ItemsIndexPage() {
  const f = useDashboardFilters()
  const { access } = useDashboardAccess()
  const { t } = useLocale()

  if (access?.hiddenSidebar?.includes('date.items')) {
    return (
      <div className="welcome">
        <div className="ic">🗂</div>
        <h2>{t('filters.itemsIndex')}</h2>
        <p>{t('common.noAccess')}</p>
      </div>
    )
  }

  return <ItemsIndexView initialCompany={f.company && access?.companies.includes(f.company) ? f.company : null} />
}
