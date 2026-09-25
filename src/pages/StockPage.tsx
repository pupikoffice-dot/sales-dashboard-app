import { useEffect } from 'react'
import { SalesReportBody } from '../components/sales/SalesReportBody'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardFilters } from '../context/DashboardFiltersContext'
import { useLocale } from '../context/LocaleContext'

/** Warehouse stock report — WMS qty, open orders, last-month sales, cost & price. */
export function StockPage() {
  const f = useDashboardFilters()
  const { access } = useDashboardAccess()
  const { t } = useLocale()

  useEffect(() => {
    if (f.dateMode !== 'stock') f.setDateMode('stock')
  }, [f.dateMode, f.setDateMode])

  useEffect(() => {
    if (f.company && f.dateMode === 'stock' && !f.applied) {
      f.apply()
    }
  }, [f.company, f.dateMode, f.applied, f.apply])

  if (!f.company) {
    return (
      <div className="welcome">
        <div className="ic">📦</div>
        <h2>{t('nav.stock')}</h2>
        <p>{t('sales.pickCompany')}</p>
      </div>
    )
  }

  if (!access?.companies.includes(f.company)) {
    return (
      <div className="welcome">
        <div className="ic">📦</div>
        <h2>{t('nav.stock')}</h2>
        <p>{t('common.noAccess')}</p>
      </div>
    )
  }

  return <SalesReportBody />
}
