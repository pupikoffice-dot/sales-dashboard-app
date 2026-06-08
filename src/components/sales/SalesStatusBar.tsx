import type { DashboardFiltersState } from '../../context/DashboardFiltersContext'
import { useSalesReportUi } from '../../context/SalesReportUiContext'
import { exportAllFromReport } from '../../lib/csvExport'
import { fmt } from '../../lib/format'
import { companyLabel, getDateLabel, monthSkewWarning, sumRows } from '../../lib/salesMetrics'
import type { SalesRow } from '../../types/dashboard'

interface SalesStatusBarProps {
  filters: DashboardFiltersState
  rows: SalesRow[]
  viewLabel: string
  count: number
}

export function SalesStatusBar({ filters, rows, viewLabel, count }: SalesStatusBarProps) {
  const {
    searchQuery,
    setSearchQuery,
    toggleCollapseAll,
    collapseAllLabel,
    hasSections,
    reportChart,
    openChart,
  } = useSalesReportUi()
  const warn = monthSkewWarning(filters, rows)
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

  return (
    <>
      {warn && <div className="warn">{warn}</div>}
      <div className="sbar">
        <span>
          Company: <b>{filters.company ? companyLabel(filters.company) : '—'}</b>
        </span>
        <span>
          View: <b>{viewLabel}</b>
        </span>
        <span>
          Period: <b>{getDateLabel(filters)}</b>
        </span>
        {lastOrderLabel && (
          <span>
            Last Order: <b>{lastOrderLabel}</b>
          </span>
        )}
        <span>
          Records: <b>{count}</b>
        </span>
        <span>
          Cash: <b>{fmt(totals.cash)}</b>
        </span>
        <span>
          Qty: <b>{fmt(totals.qty)}</b>
        </span>
        <div className="sbar-actions">
          <input
            className="sbar-search"
            type="text"
            placeholder="🔍 Search…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {reportChart && (
            <button type="button" className="sbar-chart-btn" onClick={() => openChart(reportChart)}>
              📊 Chart
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
                📥 Export All
              </button>
              <button type="button" className="sbar-minimize-btn" onClick={toggleCollapseAll}>
                {collapseAllLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
