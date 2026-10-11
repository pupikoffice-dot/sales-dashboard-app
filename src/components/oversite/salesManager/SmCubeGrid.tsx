import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { LogicalCompany } from '../../../types/dashboard'
import { useLocale } from '../../../context/LocaleContext'
import { fmt } from '../../../lib/format'
import { getOversiteDateContext } from '../../../lib/oversiteMetrics'
import { DeliveryNotesModal } from '../DeliveryNotesModal'
import { SalesLyBars } from '../OversiteKpiRow'
import { boardShowsCard, boardStyleAttrs, type OversightBoard } from '../../../lib/oversightClassLayout'
import type { OversightArrangeApi } from '../../../hooks/useOversightArrange'
import { ArrangeCardChrome } from '../OversightArrangeBar'
import { OversightFlowCards } from '../OversightFlowCards'
import { OversiteOrdersLast7Days } from '../OversiteOrdersLast7Days'
import { OversiteOrdersReportButton } from '../OversiteOrdersReportButton'
import { OversiteReceipts } from '../OversiteReceipts'
import type { SmSuiteKpis } from './smMetrics'
import { SmYearNetSalesChart } from './SmYearNetSalesChart'
import {
  SmTsometOpenBudgetCube,
  type SmTsometOpenBudgetCubeProps,
} from './SmTsometOpenBudgetCube'

export type SmTsometOpenBudgetKpiProps = Pick<
  SmTsometOpenBudgetCubeProps,
  'openBudget' | 'budgetCash' | 'isLoading'
>

export interface SmOrdersReportTarget {
  id: LogicalCompany
  label: string
}

/** Sales Agent suite: show this many missed item/client rows without scrolling. */
export const SALES_AGENT_BI_ROW_LIMIT = 30

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
  onOpenDebtReport?: () => void
  onOpenOpenOrdersReport?: () => void
  onOpenReturnsReport?: () => void
  onOpenReceiptsReport?: () => void
  /** Monkeytime Tsomet — total open budget for this agent window. */
  tsometOpenBudget?: SmTsometOpenBudgetKpiProps | null
  /** Compact BI tables nest under the 7-day orders chart. */
  biSlot?: ReactNode
  /** Sales Agent suite: hide the 7-day orders chart. */
  hideOrders7Days?: boolean
  /** Sales Agent suite: receipts cube shows current month only. */
  receiptsCurrentMonthOnly?: boolean
  /** Class suite feature: year graph from report 891. */
  showYearNetSales?: boolean
  /** Saved class suite board. Null = today's cube grid. */
  suiteBoard?: OversightBoard | null
  arrange?: OversightArrangeApi | null
  /** Admin grant: show 720 delivery inside Sales MTD (requires sales MTD module). */
  showDeliveryNotes?: boolean
  /** Company / window context for the delivery notes popup title. */
  deliveryContextLabel?: string
}

export function SmCubeGrid({
  kpis,
  goalCash,
  monthLbl,
  ordersReportCompanies = [],
  onOpenOrdersReport,
  onOpenDebtReport,
  onOpenOpenOrdersReport,
  onOpenReturnsReport,
  onOpenReceiptsReport,
  tsometOpenBudget,
  biSlot,
  hideOrders7Days = false,
  receiptsCurrentMonthOnly = false,
  showYearNetSales = false,
  suiteBoard = null,
  arrange = null,
  showDeliveryNotes = false,
  deliveryContextLabel,
}: SmCubeGridProps) {
  const { t } = useLocale()
  const dateCtx = useMemo(() => getOversiteDateContext(), [])
  const [deliveryOpen, setDeliveryOpen] = useState(false)
  const closeDelivery = useCallback(() => setDeliveryOpen(false), [])
  const {
    salesMtd,
    delivery720Mtd,
    delivery720MtdDocs,
    salesMtdCombinedLyPct,
    openOrders,
    returnsMtd,
    openDebt,
    ordersLast7Days,
    receipts,
    yearNetSales,
  } = kpis
  const goalDisplay = goalCash == null ? '—' : fmt(goalCash)
  const debtDisplay = openDebt ? fmt(openDebt.grandTotal) : '—'
  const multiCoReport = ordersReportCompanies.length > 1

  const goalPct =
    goalCash != null && goalCash > 0 ? Math.min(999, (salesMtd.cash / goalCash) * 100) : null
  const barPct = goalPct == null ? 0 : Math.min(100, Math.max(0, goalPct))
  const remaining =
    goalCash != null && goalCash > 0 ? Math.max(0, goalCash - salesMtd.cash) : null
  const overGoal = goalCash != null && goalCash > 0 && salesMtd.cash > goalCash

  const showTsomet = tsometOpenBudget != null
  const hideChart = suiteBoard ? false : hideOrders7Days
  const useSavedLook = suiteBoard != null

  const cubeNodes: Record<string, ReactNode> = {
    salesMtd: (
      <div className="sm-cube sm-cube--mtd">
        <div className="sm-cube-title">{t('sm.cube.salesMtdGoal', { month: monthLbl })}</div>
        <div className="sm-cube-val grn">{fmt(salesMtd.cash)}</div>
        <div className="sm-cube-sub">
          <span className="sm-cube-sub-lbl">{t('sm.cube.goal')}</span>
          <span className="sm-cube-sub-val">{goalDisplay}</span>
        </div>

        {goalCash != null && goalCash > 0 ? (
          <div className="sm-goal-progress" aria-label={t('sm.cube.goalProgress')}>
            <div className="sm-goal-track">
              <div
                className={`sm-goal-fill${overGoal ? ' sm-goal-fill--over' : ''}`}
                style={{ width: `${barPct}%` }}
              />
            </div>
            <div className="sm-goal-meta">
              <span className={overGoal ? 'sm-goal-pct over' : 'sm-goal-pct'}>
                {goalPct!.toFixed(0)}%
              </span>
              <span className="sm-goal-remain">
                {overGoal
                  ? t('sm.cube.goalOver', { amount: fmt(salesMtd.cash - goalCash) })
                  : t('sm.cube.goalRemaining', { amount: fmt(remaining ?? 0) })}
              </span>
            </div>
          </div>
        ) : goalCash == null ? (
          <div className="sm-goal-progress sm-goal-progress--empty">
            <div className="sm-goal-track" />
            <div className="sm-goal-meta">
              <span className="sm-goal-remain">{t('sm.cube.goalUnknown')}</span>
            </div>
          </div>
        ) : null}

        {showDeliveryNotes ? (
          <>
            <SalesLyBars
              monthLbl={monthLbl}
              lyMonthLbl={dateCtx.lyMonthLbl}
              cash={salesMtd.cash}
              deliveryCash={delivery720Mtd.cash}
              openOrdersCash={openOrders.cash}
              lyCash={salesMtd.lyCash}
              lyChangeCashPct={salesMtdCombinedLyPct}
              withOpenOrdersLbl={t('oversite.salesMtdWithOpenOrders')}
            />
            <button
              type="button"
              className="ov-toggle-btn"
              aria-haspopup="dialog"
              onClick={() => setDeliveryOpen(true)}
            >
              📄 {t('oversite.deliveryNotes')} · {fmt(delivery720Mtd.cash)}
            </button>
            {deliveryOpen ? (
              <DeliveryNotesModal
                title={
                  deliveryContextLabel
                    ? `${deliveryContextLabel} — ${t('oversite.deliveryNotes')}`
                    : t('oversite.deliveryNotes')
                }
                metrics={delivery720Mtd}
                docs={delivery720MtdDocs}
                onClose={closeDelivery}
              />
            ) : null}
          </>
        ) : salesMtd.lyChangeCashPct != null ? (
          <div className={`sm-cube-delta ${salesMtd.lyChangeCashPct >= 0 ? 'up' : 'down'}`}>
            {salesMtd.lyChangeCashPct >= 0 ? '▲' : '▼'}
            {Math.abs(salesMtd.lyChangeCashPct).toFixed(1)}%
          </div>
        ) : null}
      </div>
    ),
    openOrders: (
      <div className="sm-cube sm-cube--open">
        <div className="sm-cube-title">{t('sm.cube.openOrders')}</div>
        <div className="sm-cube-val grn">{fmt(openOrders.cash)}</div>
        <div className="sm-cube-meta">
          {t('oversite.clients')}: {openOrders.clients} · {t('oversite.qty')}: {fmt(openOrders.qty)}
        </div>
        {onOpenOpenOrdersReport ? (
          <button type="button" className="ov-debt-btn sm-cube-report-btn" onClick={onOpenOpenOrdersReport}>
            📋 {t('sm.cube.fullReport')}
          </button>
        ) : null}
      </div>
    ),
    returns: (
      <div className="sm-cube sm-cube--returns">
        <div className="sm-cube-title">{t('sm.cube.returns')}</div>
        <div className="sm-cube-val amber">{fmt(returnsMtd.cash)}</div>
        <div className="sm-cube-meta">
          {t('oversite.qty')}: {fmt(returnsMtd.qty)}
        </div>
        {onOpenReturnsReport ? (
          <button type="button" className="ov-debt-btn sm-cube-report-btn" onClick={onOpenReturnsReport}>
            📋 {t('sm.cube.fullReport')}
          </button>
        ) : null}
      </div>
    ),
    openDebt: (
      <div className="sm-cube sm-cube--debt">
        <div className="sm-cube-title">{t('sm.cube.openDebt')}</div>
        <div className="sm-cube-val">{debtDisplay}</div>
        {onOpenDebtReport ? (
          <button type="button" className="ov-debt-btn sm-cube-report-btn" onClick={onOpenDebtReport}>
            📋 {t('sm.cube.fullReport')}
          </button>
        ) : null}
      </div>
    ),
    ordersLast7: (
      <div
        className={`sm-cube sm-cube--orders${biSlot ? ' sm-cube--orders-with-bi' : ''}${hideChart ? ' sm-cube--orders-no-chart' : ''}`}
      >
        {!hideChart || (onOpenOrdersReport && ordersReportCompanies.length > 0) ? (
          <div className={`sm-orders-main${hideChart ? ' sm-orders-main--report-only' : ''}`}>
            {!hideChart ? <OversiteOrdersLast7Days data={ordersLast7Days} /> : null}
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
        ) : null}
        {biSlot ? <div className="sm-orders-bi">{biSlot}</div> : null}
      </div>
    ),
    receipts: (
      <div className="sm-cube sm-cube--receipts">
        <div className="sm-cube-title">{t('sm.cube.receipts')}</div>
        {Object.keys(receipts.monthly).length > 0 ? (
          <OversiteReceipts
            monthly={receipts.monthly}
            byAgent={receipts.byAgent}
            agents={receipts.agents}
            currentMonthOnly={receiptsCurrentMonthOnly}
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
    ),
  }
  if (showTsomet) {
    cubeNodes.tsometOpenBudget = (
      <SmTsometOpenBudgetCube
        openBudget={tsometOpenBudget.openBudget}
        budgetCash={tsometOpenBudget.budgetCash}
        isLoading={tsometOpenBudget.isLoading}
      />
    )
  }
  if (showYearNetSales) {
    cubeNodes.yearNetSales = (
      <div className="sm-cube sm-cube--year-sales">
        <div className="sm-cube-title">{t('sm.cube.yearNetSales', { year: String(yearNetSales.year) })}</div>
        <SmYearNetSalesChart data={yearNetSales} />
      </div>
    )
  }

  return (
    <div
      className={`sm-cube-grid${useSavedLook ? ' sm-cube-grid--flow' : ''}${showTsomet ? ' sm-cube-grid--tsomet' : ''}${showYearNetSales ? '' : ' sm-cube-grid--no-year-sales'}`}
      {...(useSavedLook ? boardStyleAttrs(suiteBoard.style) : {})}
    >
      {useSavedLook ? (
        <>
          <OversightFlowCards
            board={suiteBoard}
            nodes={cubeNodes}
            wrapNode={
              arrange?.arranging
                ? (id, node) => (
                    <ArrangeCardChrome arrange={arrange} cardId={id}>
                      {node}
                    </ArrangeCardChrome>
                  )
                : undefined
            }
          />
          {biSlot && !boardShowsCard(suiteBoard, 'ordersLast7') ? (
            <div className="ov-flow ov-flow--full">
              <div className="sm-cube sm-cube--orders sm-cube--orders-with-bi">
                <div className="sm-orders-bi">{biSlot}</div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {cubeNodes.salesMtd}
          {cubeNodes.openOrders}
          {cubeNodes.tsometOpenBudget}
          {cubeNodes.returns}
          {cubeNodes.openDebt}
          {cubeNodes.ordersLast7}
          {cubeNodes.receipts}
          {cubeNodes.yearNetSales}
        </>
      )}
    </div>
  )
}
