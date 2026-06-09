import { SalesReportBody } from '../components/sales/SalesReportBody'
import { useDashboardFilters } from '../context/DashboardFiltersContext'
import { useLocale } from '../context/LocaleContext'

export function SalesPage() {
  const f = useDashboardFilters()
  const { t } = useLocale()

  const title = f.dateMode === 'openorders' ? t('sales.openOrdersTitle') : t('sales.title')
  const icon = f.dateMode === 'openorders' ? '📋' : '📊'

  if (!f.company) {
    return (
      <div className="welcome">
        <div className="ic">{icon}</div>
        <h2>{title}</h2>
        <p>{t('sales.pickCompany')}</p>
      </div>
    )
  }

  if (!f.applied) {
    return (
      <div className="welcome">
        <div className="ic">{icon}</div>
        <h2>{title}</h2>
        <p>{t('sales.clickApply')}</p>
      </div>
    )
  }

  return <SalesReportBody />
}
