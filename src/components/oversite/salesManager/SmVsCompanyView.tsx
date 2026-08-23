import { useMemo, type ReactNode } from 'react'
import { useLocale } from '../../../context/LocaleContext'
import { OversiteOrdersLast7Days } from '../OversiteOrdersLast7Days'
import { OversiteOrdersReportButton } from '../OversiteOrdersReportButton'
import { OversiteReceipts } from '../OversiteReceipts'
import type { LogicalCompany } from '../../../types/dashboard'
import type { SmOrdersReportTarget } from './SmCubeGrid'
import type { SmVsCompanySeries } from './smMetrics'
import { SmVsPivotChart } from './SmVsPivotChart'

export interface SmVsCompanyViewProps {
  series: SmVsCompanySeries
  monthLbl: string
  ordersReportCompanies?: SmOrdersReportTarget[]
  onOpenOrdersReport?: (companyId: LogicalCompany) => void
  onOpenDebtReport?: () => void
  onOpenOpenOrdersReport?: () => void
  onOpenReturnsReport?: () => void
  onOpenReceiptsReport?: () => void
  biBlock?: ReactNode
}

/** Vs mode: comparison cubes — agents pivoted in one chart per KPI. */
export function SmVsCompanyView({
  series,
  monthLbl,
  ordersReportCompanies = [],
  onOpenOrdersReport,
  onOpenDebtReport,
  onOpenOpenOrdersReport,
  onOpenReturnsReport,
  onOpenReceiptsReport,
  biBlock,
}: SmVsCompanyViewProps) {
  const { t } = useLocale()
  const agents = series.agents
  const receipts = series.receipts

  const salesBars = useMemo(
    () =>
      agents.map(a => {
        const ofGoal =
          a.goalCash != null && a.goalCash > 0
            ? Math.min(999, (a.salesMtdCash / a.goalCash) * 100)
            : null
        return {
          agentId: a.agentId,
          value: a.salesMtdCash,
          marker: a.goalCash,
          caption:
            ofGoal != null
              ? t('sm.vs.goalPct', { pct: ofGoal.toFixed(0) })
              : a.goalCash == null
                ? t('sm.vs.goalMissing')
                : undefined,
        }
      }),
    [agents, t],
  )

  const openBars = useMemo(
    () => agents.map(a => ({ agentId: a.agentId, value: a.openOrdersCash })),
    [agents],
  )
  const returnsBars = useMemo(
    () => agents.map(a => ({ agentId: a.agentId, value: a.returnsCash })),
    [agents],
  )
  const debtBars = useMemo(
    () => agents.map(a => ({ agentId: a.agentId, value: a.openDebtCash })),
    [agents],
  )
  const orders7Bars = useMemo(
    () => agents.map(a => ({ agentId: a.agentId, value: a.orders7Cash })),
    [agents],
  )

  if (agents.length === 0) {
    return <p className="ov-empty">{t('sm.vs.noAgents')}</p>
  }

  return (
    <div className="sm-vs-company">
    <div className="sm-vs-grid">
      <div className="sm-cube sm-cube--vs-mtd">
        <div className="sm-cube-title">{t('sm.cube.salesMtdGoal', { month: monthLbl })}</div>
        <SmVsPivotChart
          bars={salesBars}
          emptyLabel={t('sm.vs.noAgents')}
          ariaLabel={t('sm.cube.salesMtdGoal', { month: monthLbl })}
        />
      </div>

      <div className="sm-cube sm-cube--vs-open">
        <div className="sm-cube-title">{t('sm.cube.openOrders')}</div>
        <SmVsPivotChart
          bars={openBars}
          emptyLabel={t('oversite.noOpenOrders')}
          ariaLabel={t('sm.cube.openOrders')}
        />
        {onOpenOpenOrdersReport ? (
          <button type="button" className="ov-debt-btn sm-cube-report-btn" onClick={onOpenOpenOrdersReport}>
            📋 {t('sm.cube.fullReport')}
          </button>
        ) : null}
      </div>

      <div className="sm-cube sm-cube--vs-returns">
        <div className="sm-cube-title">{t('sm.cube.returns')}</div>
        <SmVsPivotChart
          bars={returnsBars}
          emptyLabel={t('oversite.noReturns')}
          ariaLabel={t('sm.cube.returns')}
        />
        {onOpenReturnsReport ? (
          <button type="button" className="ov-debt-btn sm-cube-report-btn" onClick={onOpenReturnsReport}>
            📋 {t('sm.cube.fullReport')}
          </button>
        ) : null}
      </div>

      <div className="sm-cube sm-cube--vs-debt">
        <div className="sm-cube-title">{t('sm.cube.openDebt')}</div>
        <SmVsPivotChart
          bars={debtBars}
          emptyLabel={t('sm.vs.noAgents')}
          ariaLabel={t('sm.cube.openDebt')}
        />
        {onOpenDebtReport ? (
          <button type="button" className="ov-debt-btn sm-cube-report-btn" onClick={onOpenDebtReport}>
            📋 {t('sm.cube.fullReport')}
          </button>
        ) : null}
      </div>

      <div className={`sm-cube sm-cube--vs-orders7${biBlock ? ' sm-cube--orders-with-bi' : ''}`}>
        <div className="sm-orders-main">
          <div className="sm-cube-title">{t('oversite.ordersLast7Days')}</div>
          <SmVsPivotChart
            bars={orders7Bars}
            emptyLabel={t('oversite.ordersLast7DaysEmpty')}
            ariaLabel={t('oversite.ordersLast7Days')}
          />
          <OversiteOrdersLast7Days data={series.ordersLast7Days} />
          {onOpenOrdersReport && ordersReportCompanies.length > 0 ? (
            <div className="sm-orders-report">
              {ordersReportCompanies.map(co => (
                <div key={co.id} className="sm-orders-report-row">
                  <OversiteOrdersReportButton onClick={() => onOpenOrdersReport(co.id)} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {biBlock ? <div className="sm-orders-bi">{biBlock}</div> : null}
      </div>

      <div className="sm-cube sm-cube--vs-receipts">
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
        {onOpenReceiptsReport && Object.keys(receipts.monthly).length > 0 ? (
          <button type="button" className="ov-debt-btn sm-cube-report-btn" onClick={onOpenReceiptsReport}>
            📋 {t('sm.cube.fullReport')}
          </button>
        ) : null}
      </div>
    </div>
    </div>
  )
}
