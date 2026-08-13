import type { DashboardFiltersState } from '../../context/DashboardFiltersContext'
import { useLocale } from '../../context/LocaleContext'
import { useSalesReportUi } from '../../context/SalesReportUiContext'
import { exportAllFromReport } from '../../lib/csvExport'
import { fmt } from '../../lib/format'
import { companyLabel, getDateLabel, monthSkewWarning, sumRows } from '../../lib/salesMetrics'
import type { SalesRow } from '../../types/dashboard'
import { SalesLegend } from './SalesLegend'

interface SalesStatusBarProps {
  filters: DashboardFiltersState
  rows: SalesRow[]
  viewLabel: string
  count: number
}

export function SalesStatusBar({ filters, rows, viewLabel, count }: SalesStatusBarProps) {
  const { t, monthNames } = useLocale()
  const {
    searchQuery,
    setSearchQuery,
    toggleCollapseAll,
    collapseAllLabel,
    hasSections,
    reportChart,
    openChart,
  } = useSalesReportUi()
  const skew = monthSkewWarning(filters, rows)
  const totals = sumRows(rows)
  const lastOrder =
    filters.dateMode === 'openorders' && rows.length
      ? rows.reduce((mx, r) => (r.date && r.date > mx ? r.date : mx), '')
      : ''

  let lastOrderLabel = ''
  if (lastOrder) {
    const [y, mo, d] = lastOrder.split('-')
    lastOrderLabel = `${d}/${mo}/${y}`
  }

  let periodLabel = getDateLabel(filters, monthNames)
  if (filters.dateMode === 'openorders') periodLabel = t('sales.periodOpenOrders')
  if (filters.dateMode === 'stock') periodLabel = t('sales.periodStock')

  return (
    <>
      {skew && (
        <div className="warn">
          {t('sales.skewWarning', {
            month: monthNames[skew.month - 1],
            year: String(skew.year),
            pct: skew.pct.toFixed(0),
            concentration: skew.concentrationPct.toFixed(0),
          })}
        </div>
      )}
      <div className="sbar">
        <span>
          {t('sales.company')}: <b>{filters.company ? companyLabel(filters.company) : '—'}</b>
        </span>
        <span>
          {t('sales.view')}: <b>{viewLabel}</b>
        </span>
        <span>
          {t('sales.period')}: <b>{periodLabel}</b>
        </span>
        {lastOrderLabel && (
          <span>
            {t('sales.lastOrder')}: <b>{lastOrderLabel}</b>
          </span>
        )}
        <span>
          {t('sales.records')}: <b>{count}</b>
        </span>
        <span>
          {t('sales.cash')}: <b>{fmt(totals.cash)}</b>
        </span>
        <span>
          {t('sales.qty')}: <b>{fmt(totals.qty)}</b>
        </span>
        <div className="sbar-actions">
          <input
            className="sbar-search"
            type="text"
            placeholder={`🔍 ${t('sales.search')}`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {reportChart && (
            <button type="button" className="sbar-chart-btn" onClick={() => openChart(reportChart)}>
              📊 {t('sales.chart')}
            </button>
          )}
          {hasSections && (
            <>
              <button
                type="button"
                className="dl-btn"
                onClick={() => {
                  const root = document.getElementById('sales-report')
                  if (root) exportAllFromReport(root)
                }}
              >
                📥 {t('sales.exportAll')}
              </button>
              <button type="button" className="sbar-minimize-btn" onClick={toggleCollapseAll}>
                {collapseAllLabel}
              </button>
            </>
          )}
        </div>
      </div>
      {/* Sibling of .sbar rather than inside its flex row, so the panel can take
          full width without fighting the wrapping action buttons. */}
      <SalesLegend filters={filters} />
    </>
  )
}
