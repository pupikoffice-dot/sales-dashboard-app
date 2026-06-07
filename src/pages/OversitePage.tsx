import { useState } from 'react'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { computeDebtSummary, debtRowsForCompany } from '../lib/debtMetrics'
import { fmt } from '../lib/format'
import type { LogicalCompany } from '../types/dashboard'
import { DebtModal } from '../components/oversite/DebtModal'
import { OversiteDebtSummary } from '../components/oversite/OversiteDebtSummary'
import { StockAlertsPanel } from '../components/oversite/StockAlertsPanel'
import { computeStockAlerts } from '../lib/stockAlerts'
import {
  OVERSITE_COMPANIES,
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
  const { rows, debtRows, debtLastUpdate, wmsStock, wmsNames, isLoading, error } = useDashboardData()
  const [debtModalCo, setDebtModalCo] = useState<LogicalCompany | null>(null)

  if (isLoading) return <p className="text-sm text-slate-500">Loading sales data…</p>
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>

  const ctx = getOversiteDateContext()
  const visibleCompanies = OVERSITE_COMPANIES.filter(c => access?.companies.includes(c.id))

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">🏠 Oversite Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Today: <strong>{ctx.todayDisp}</strong> · Month: <strong>{ctx.monthLbl}</strong>
        </p>
      </header>

      {visibleCompanies.length === 0 ? (
        <p className="text-sm text-slate-500">No companies in your access scope.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {visibleCompanies.map(co => {
            const ordersToday = computeOrdersToday(rows, co.ordersTag, ctx.todayStr)
            const ordersMtd = computeOrdersMtd(rows, co.ordersTag, ctx.monthStart, ctx.todayStr)
            const salesMtd = computeSalesMtd(rows, co.id, ctx.curYear, ctx.curMonth)
            const ordersTop10 = computeOrdersMtdTop10(rows, co.ordersTag, ctx.monthStart, ctx.todayStr)
            const salesTop10 = computeSalesMtdTop10(rows, co.id, ctx.curYear, ctx.curMonth)
            const returnsMtd = computeReturnsMtd(rows, co.returnsTag, ctx.curYear, ctx.curMonth)
            const returnsTop10 = computeReturnsMtdTop10(rows, co.returnsTag, ctx.curYear, ctx.curMonth)
            const companyDebt = debtRowsForCompany(debtRows, co.id)
            const debtSummary = computeDebtSummary(companyDebt)
            const stockAlerts = computeStockAlerts(rows, co.id, wmsStock, wmsNames)

            return (
              <div key={co.id} className="space-y-3">
                <div className={`rounded-lg border border-slate-200 border-l-4 bg-white px-4 py-3 font-bold ${co.borderClass}`}>
                  {co.label}
                </div>

                <OversiteSection title="📋 Orders Today (Doc 36)">
                  <OversiteKpiRow
                    kpis={[
                      { label: 'Clients', value: String(ordersToday.clients) },
                      { label: 'Qty', value: fmt(ordersToday.qty) },
                      { label: 'Cash', value: fmt(ordersToday.cash), valueClass: 'text-emerald-600' },
                    ]}
                  />
                </OversiteSection>

                <OversiteSection title={`📋 Orders MTD — ${ctx.monthLbl}`}>
                  <OversiteKpiRow
                    kpis={[
                      { label: 'Clients', value: String(ordersMtd.clients) },
                      { label: 'Qty', value: fmt(ordersMtd.qty) },
                      { label: 'Cash', value: fmt(ordersMtd.cash), valueClass: 'text-emerald-600' },
                    ]}
                  />
                  <OversiteCollapsible label="📦 Top 10 Orders ▾">
                    <OversiteTop10Table items={ordersTop10} emptyLabel="No order items this month" />
                  </OversiteCollapsible>
                </OversiteSection>

                <OversiteSection title={`💰 Sales MTD — ${ctx.monthLbl}`}>
                  <OversiteKpiRow
                    kpis={[
                      { label: 'Cash', value: fmt(salesMtd.cash), valueClass: 'text-emerald-600' },
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
                      { label: 'Cash', value: fmt(returnsMtd.cash), valueClass: 'text-red-600' },
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
                  <OversiteDebtSummary
                    summary={debtSummary}
                    onOpenReport={() => setDebtModalCo(co.id)}
                  />
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

    </div>
  )
}
