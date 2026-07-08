import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { filterRows } from '../lib/permissions'
import { fmt } from '../lib/format'
import {
  OVERSITE_COMPANIES,
  computeAgentBreakdown,
  computeOrdersMtd,
  computeOrdersMtdTop10,
  computeOrdersToday,
  getOrdersMtdRows,
  getOrdersTodayRows,
  getOversiteDateContext,
  resolveOrdersTag,
} from '../lib/oversiteMetrics'
import { OversiteAgentBreakdown } from '../components/oversite/OversiteAgentBreakdown'
import { OversiteCollapsible } from '../components/oversite/OversiteCollapsible'
import { OversiteKpiRow, OversiteSection } from '../components/oversite/OversiteKpiRow'
import { OversiteTop10Table } from '../components/oversite/OversiteTop10Table'

/** Orders MTD (722) — all orders this month per company. */
export function OrdersMtdPage() {
  const { access } = useDashboardAccess()
  const { allRows, isLoading, error } = useDashboardData()

  if (isLoading) return <p className="status-msg">Loading orders data…</p>
  if (error) return <p className="status-msg error">{(error as Error).message}</p>

  const ctx = getOversiteDateContext()
  const visibleCompanies = OVERSITE_COMPANIES.filter(c => access?.companies.includes(c.id))
  const companyRows = access ? filterRows(access, allRows) : []

  return (
    <>
      <div className="ov-header">
        <h2>📋 Orders MTD</h2>
        <div className="ov-sub">
          Report 722 — all orders this month · Today: <b>{ctx.todayDisp}</b> · Month: <b>{ctx.monthLbl}</b>
        </div>
      </div>

      {visibleCompanies.length === 0 ? (
        <p className="ov-empty">No companies in your access scope.</p>
      ) : (
        <div className="ov-grid">
          {visibleCompanies.map(co => {
            const ordersTag = resolveOrdersTag(companyRows, co.ordersTag)
            const ordersToday = computeOrdersToday(companyRows, ordersTag, ctx.todayStr)
            const ordersMtd = computeOrdersMtd(companyRows, ordersTag, ctx.monthStart, ctx.todayStr)
            const ordersTop10 = computeOrdersMtdTop10(companyRows, ordersTag, ctx.monthStart, ctx.todayStr)
            const ordersTodayByAgent = computeAgentBreakdown(
              getOrdersTodayRows(companyRows, ordersTag, ctx.todayStr),
            )
            const ordersMtdByAgent = computeAgentBreakdown(
              getOrdersMtdRows(companyRows, ordersTag, ctx.monthStart, ctx.todayStr),
            )

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
                  <OversiteAgentBreakdown rows={ordersTodayByAgent} />
                </OversiteSection>

                <OversiteSection title={`📋 Orders MTD — ${ctx.monthLbl}`}>
                  <OversiteKpiRow
                    kpis={[
                      { label: 'Clients', value: String(ordersMtd.clients) },
                      { label: 'Qty', value: fmt(ordersMtd.qty) },
                      { label: 'Cash', value: fmt(ordersMtd.cash), tone: 'grn' },
                    ]}
                  />
                  <OversiteAgentBreakdown rows={ordersMtdByAgent} />
                  <OversiteCollapsible label="📦 Top 10 Items Ordered ▾">
                    <OversiteTop10Table
                      items={ordersTop10}
                      emptyLabel="No order items this month"
                      showSku
                    />
                  </OversiteCollapsible>
                </OversiteSection>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
