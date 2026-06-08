import { useState } from 'react'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { filterRowsByCompany } from '../lib/permissions'
import { computeDebtSummary, debtRowsForCompany } from '../lib/debtMetrics'
import { fmt } from '../lib/format'
import type { LogicalCompany } from '../types/dashboard'
import { DebtModal } from '../components/oversite/DebtModal'
import { OversiteDebtSummary } from '../components/oversite/OversiteDebtSummary'
import { StockAlertsPanel } from '../components/oversite/StockAlertsPanel'
import { computeStockAlerts } from '../lib/stockAlerts'
import {
  OVERSITE_COMPANIES,
  computeOpenOrders,
  computeOpenOrdersTop10,
  computeOrdersMtd,
  computeOrdersMtdTop10,
  computeOrdersToday,
  computeReturnsMtd,
  computeReturnsMtdTop10,
  computeSalesMtd,
  computeSalesMtdTop10,
  getOversiteDateContext,
} from '../lib/oversiteMetrics'
import { OversiteCollapsible } from '../components/oversite/OversiteCollapsible'
import { OversiteKpiRow, OversiteSection, SalesLyBars } from '../components/oversite/OversiteKpiRow'
import { OversiteTop10Table } from '../components/oversite/OversiteTop10Table'

export function OversitePage() {
  const { access } = useDashboardAccess()
  const { allRows, debtRows, debtLastUpdate, wmsStock, wmsNames, isLoading, error } = useDashboardData()
  const [debtModalCo, setDebtModalCo] = useState<LogicalCompany | null>(null)

  if (isLoading) return <p className="status-msg">Loading sales data…</p>
  if (error) return <p className="status-msg error">{(error as Error).message}</p>

  const ctx = getOversiteDateContext()
  const visibleCompanies = OVERSITE_COMPANIES.filter(c => access?.companies.includes(c.id))
  const companyRows = access ? filterRowsByCompany(access, allRows) : []

  return (
    <>
      <div className="ov-header">
        <h2>🏠 Oversite Dashboard</h2>
        <div className="ov-sub">
          Today: <b>{ctx.todayDisp}</b> · Month: <b>{ctx.monthLbl}</b>
        </div>
      </div>

      {visibleCompanies.length === 0 ? (
        <p className="ov-empty">No companies in your access scope.</p>
      ) : (
        <div className="ov-grid">
          {visibleCompanies.map(co => {
            const ordersToday = computeOrdersToday(companyRows, co.ordersTag, ctx.todayStr)
            const ordersMtd = computeOrdersMtd(companyRows, co.ordersTag, ctx.monthStart, ctx.todayStr)
            const openOrders = computeOpenOrders(companyRows, co.openOrdersTag)
            const openOrdersTop10 = computeOpenOrdersTop10(companyRows, co.openOrdersTag)
            const salesMtd = computeSalesMtd(companyRows, co.id, ctx.curYear, ctx.curMonth)
            const ordersTop10 = computeOrdersMtdTop10(companyRows, co.ordersTag, ctx.monthStart, ctx.todayStr)
            const salesTop10 = computeSalesMtdTop10(companyRows, co.id, ctx.curYear, ctx.curMonth)
            const returnsMtd = computeReturnsMtd(companyRows, co.returnsTag, ctx.curYear, ctx.curMonth)
            const returnsTop10 = computeReturnsMtdTop10(companyRows, co.returnsTag, ctx.curYear, ctx.curMonth)
            const companyDebt = debtRowsForCompany(debtRows, co.id)
            const debtSummary = computeDebtSummary(companyDebt)
            const stockAlerts = computeStockAlerts(companyRows, co.id, wmsStock, wmsNames)

            return (
              <div key={co.id} className="ov-col">
                <div className="ov-col-hdr" style={{ borderLeftColor: co.accentColor }}>
                  {co.label}
                </div>

                <OversiteSection title="📋 Orders Today (Doc 36)">
                  <OversiteKpiRow
                    kpis={[
                      { label: 'Clients', value: String(ordersToday.clients) },
                      { label: 'Qty', value: fmt(ordersToday.qty) },
                      { label: 'Cash', value: fmt(ordersToday.cash), tone: 'grn' },
                    ]}
                  />
                </OversiteSection>

                <OversiteSection title={`📋 Orders MTD (722) — ${ctx.monthLbl}`}>
                  <OversiteKpiRow
                    kpis={[
                      { label: 'Clients', value: String(ordersMtd.clients) },
                      { label: 'Qty', value: fmt(ordersMtd.qty) },
                      { label: 'Cash', value: fmt(ordersMtd.cash), tone: 'grn' },
                    ]}
                  />
                  <OversiteCollapsible label="📦 Top 10 Orders ▾">
                    <OversiteTop10Table items={ordersTop10} emptyLabel="No order items this month" />
                  </OversiteCollapsible>
                </OversiteSection>

                <OversiteSection title="📋 Open Orders (721)">
                  <OversiteKpiRow
                    kpis={[
                      { label: 'Clients', value: String(openOrders.clients) },
                      { label: 'Qty', value: fmt(openOrders.qty) },
                      { label: 'Cash', value: fmt(openOrders.cash), tone: 'grn' },
                    ]}
                  />
                  <OversiteCollapsible label="📦 Top 10 Open Orders ▾">
                    <OversiteTop10Table items={openOrdersTop10} emptyLabel="No open orders in export" />
                  </OversiteCollapsible>
                </OversiteSection>

                <OversiteSection title={`💰 Sales MTD — ${ctx.monthLbl}`}>
                  <OversiteKpiRow
                    kpis={[
                      { label: 'Cash', value: fmt(salesMtd.cash), tone: 'grn' },
                      { label: 'Qty', value: fmt(salesMtd.qty) },
                    ]}
                  />
                  <SalesLyBars
                    monthLbl={ctx.monthLbl}
                    lyMonthLbl={ctx.lyMonthLbl}
                    cash={salesMtd.cash}
                    lyCash={salesMtd.lyCash}
                    lyChangeCashPct={salesMtd.lyChangeCashPct}
                  />
                </OversiteSection>

                <OversiteSection title="🏆 Top 10 Items MTD">
                  <OversiteTop10Table items={salesTop10} emptyLabel="No sales data this month" />
                </OversiteSection>

                <OversiteSection title="↩️ Returns MTD">
                  <OversiteKpiRow
                    kpis={[
                      { label: 'Cash', value: fmt(returnsMtd.cash), tone: 'amber' },
                      { label: 'Qty', value: fmt(returnsMtd.qty) },
                    ]}
                  />
                  <OversiteCollapsible label="↩️ Top 10 Returns ▾">
                    <OversiteTop10Table items={returnsTop10} emptyLabel="No returns this month" />
                  </OversiteCollapsible>
                </OversiteSection>

                <OversiteSection
                  title={`💳 Open Debt${debtLastUpdate ? ` · Last Update: ${debtLastUpdate}` : ''}`}
                >
                  <OversiteDebtSummary summary={debtSummary} onOpenReport={() => setDebtModalCo(co.id)} />
                </OversiteSection>

                <StockAlertsPanel alerts={stockAlerts} />
              </div>
            )
          })}
        </div>
      )}

      {debtModalCo && (
        <DebtModal
          company={debtModalCo}
          debtData={debtRowsForCompany(debtRows, debtModalCo)}
          debtLastUpdate={debtLastUpdate}
          onClose={() => setDebtModalCo(null)}
        />
      )}
    </>
  )
}
