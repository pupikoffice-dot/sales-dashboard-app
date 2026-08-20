import type { LogicalCompany } from '../../../types/dashboard'
import { useLocale } from '../../../context/LocaleContext'
import { fmt } from '../../../lib/format'
import { OversiteOrdersLast7Days } from '../OversiteOrdersLast7Days'
import { OversiteOrdersReportButton } from '../OversiteOrdersReportButton'
import { OversiteReceipts } from '../OversiteReceipts'
import type { SmSuiteKpis } from './smMetrics'

export interface SmOrdersReportTarget {
  id: LogicalCompany
  label: string
}

export interface SmCubeGridProps {
  kpis: SmSuiteKpis
  /**
   * Monthly cash goal for this window.
   * `null` = missing target or still loading → display em dash.
   * Number (including 0) = show formatted goal (All window uses sumGoals once settled).
   */
  goalCash: number | null
  monthLbl: string
  /** Allowed companies for full Orders report (from access.companies). */
  ordersReportCompanies?: SmOrdersReportTarget[]
  onOpenOrdersReport?: (companyId: LogicalCompany) => void
}

export function SmCubeGrid({
  kpis,
  goalCash,
  monthLbl,
  ordersReportCompanies = [],
  onOpenOrdersReport,
}: SmCubeGridProps) {
  const { t } = useLocale()
  const { salesMtd, openOrders, returnsMtd, openDebt, ordersLast7Days, receipts } = kpis
  const goalDisplay = goalCash == null ? '—' : fmt(goalCash)
  const debtDisplay = openDebt ? fmt(openDebt.grandTotal) : '—'
  const multiCoReport = ordersReportCompanies.length > 1

  return (
    <div className="sm-cube-grid">
      <div className="sm-cube sm-cube--mtd">
        <div className="sm-cube-title">{t('sm.cube.salesMtdGoal', { month: monthLbl })}</div>
        <div className="sm-cube-val grn">{fmt(salesMtd.cash)}</div>
        <div className="sm-cube-sub">
          <span className="sm-cube-sub-lbl">{t('sm.cube.goal')}</span>
          <span className="sm-cube-sub-val">{goalDisplay}</span>
        </div>
        {salesMtd.lyChangeCashPct != null && (
          <div className={`sm-cube-delta ${salesMtd.lyChangeCashPct >= 0 ? 'up' : 'down'}`}>
            {salesMtd.lyChangeCashPct >= 0 ? '▲' : '▼'}
            {Math.abs(salesMtd.lyChangeCashPct).toFixed(1)}%
          </div>
        )}
      </div>

      <div className="sm-cube sm-cube--open">
        <div className="sm-cube-title">{t('sm.cube.openOrders')}</div>
        <div className="sm-cube-val grn">{fmt(openOrders.cash)}</div>
        <div className="sm-cube-meta">
          {t('oversite.clients')}: {openOrders.clients} · {t('oversite.qty')}: {fmt(openOrders.qty)}
        </div>
      </div>

      <div className="sm-cube sm-cube--returns">
        <div className="sm-cube-title">{t('sm.cube.returns')}</div>
        <div className="sm-cube-val amber">{fmt(returnsMtd.cash)}</div>
        <div className="sm-cube-meta">
          {t('oversite.qty')}: {fmt(returnsMtd.qty)}
        </div>
      </div>

      <div className="sm-cube sm-cube--debt">
        <div className="sm-cube-title">{t('sm.cube.openDebt')}</div>
        <div className="sm-cube-val">{debtDisplay}</div>
      </div>

      <div className="sm-cube sm-cube--orders">
        <OversiteOrdersLast7Days data={ordersLast7Days} />
        {onOpenOrdersReport && ordersReportCompanies.length > 0 ? (
          <div className="sm-orders-report">
            {ordersReportCompanies.map(co => (
              <div key={co.id} className="sm-orders-report-row">
                {multiCoReport ? <span className="sm-orders-report-co">{co.label}</span> : null}
                <OversiteOrdersReportButton onClick={() => onOpenOrdersReport(co.id)} />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="sm-cube sm-cube--receipts">
        <div className="sm-cube-title">{t('sm.cube.receipts')}</div>
        {Object.keys(receipts.monthly).length > 0 ? (
          <OversiteReceipts
            monthly={receipts.monthly}
            byAgent={receipts.byAgent}
            agents={receipts.agents}
          />
        ) : (
          <div className="sm-cube-empty">{t('sm.cube.receiptsEmpty')}</div>
        )}
      </div>
    </div>
  )
}
