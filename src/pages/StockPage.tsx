import { useEffect } from 'react'
import { SalesReportBody } from '../components/sales/SalesReportBody'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardFilters } from '../context/DashboardFiltersContext'
import { useLocale } from '../context/LocaleContext'
import { companyLabel } from '../lib/salesMetrics'
import type { LogicalCompany } from '../types/dashboard'

const COMPANY_ORDER: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']

/** Warehouse stock report — WMS qty, open orders, last-month sales, cost & price. The company is chosen on this page. */
export function StockPage() {
  const f = useDashboardFilters()
  const { access } = useDashboardAccess()
  const { t } = useLocale()
  const allowed = COMPANY_ORDER.filter(c => access?.companies.includes(c) && !access?.hiddenSidebar?.includes(`company.${c}`))

  useEffect(() => {
    if (f.dateMode !== 'stock') f.setDateMode('stock')
  }, [f.dateMode, f.setDateMode])

  // A single company needs no choice.
  useEffect(() => {
    if (!f.company && allowed.length === 1) f.setCompany(allowed[0])
  }, [f.company, allowed.join(',')])

  useEffect(() => {
    if (f.company && f.dateMode === 'stock' && !f.applied) {
      f.apply()
    }
  }, [f.company, f.dateMode, f.applied, f.apply])

  const chooser = (
    <div className="sbar">
      <span>
        {t('filters.company')}:
      </span>
      {allowed.length === 1 ? (
        <b>{companyLabel(allowed[0])}</b>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {allowed.map(c => (
            <button
              key={c}
              type="button"
              className={`btn${f.company === c ? ' active' : ''}`}
              onClick={() => f.setCompany(c)}
            >
              {companyLabel(c)}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  if (!f.company) {
    return (
      <>
        {chooser}
        <div className="welcome">
          <div className="ic">📦</div>
          <h2>{t('nav.stock')}</h2>
          <p>{t('stock.pickCompanyHere')}</p>
        </div>
      </>
    )
  }

  if (!access?.companies.includes(f.company)) {
    return (
      <>
        {chooser}
        <div className="welcome">
          <div className="ic">📦</div>
          <h2>{t('nav.stock')}</h2>
          <p>{t('common.noAccess')}</p>
        </div>
      </>
    )
  }

  return (
    <>
      {chooser}
      <SalesReportBody />
    </>
  )
}
