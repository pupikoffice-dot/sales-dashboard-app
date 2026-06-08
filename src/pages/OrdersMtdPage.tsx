import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { fmt } from '../lib/format'
import {
  OVERSITE_COMPANIES,
  computeOrdersMtd,
  computeOrdersMtdTop10,
  computeOrdersToday,
  getOversiteDateContext,
} from '../lib/oversiteMetrics'
import { OversiteCollapsible } from '../components/oversite/OversiteCollapsible'
import { OversiteKpiRow, OversiteSection } from '../components/oversite/OversiteKpiRow'
import { OversiteTop10Table } from '../components/oversite/OversiteTop10Table'

/** Orders MTD (722) — all orders this month per company. */
export function OrdersMtdPage() {
  const { access } = useDashboardAccess()
  const { rows, isLoading, error } = useDashboardData()

  if (isLoading) return <p className="status-msg">Loading orders data…</p>
  if (error) return <p className="status-msg error">{(error as Error).message}</p>

  const ctx = getOversiteDateContext()
  const visibleCompanies = OVERSITE_COMPANIES.filter(c => access?.companies.includes(c.id))

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
            const ordersToday = computeOrdersToday(rows, co.ordersTag, ctx.todayStr)
            const ordersMtd = computeOrdersMtd(rows, co.ordersTag, ctx.monthStart, ctx.todayStr)
            const ordersTop10 = computeOrdersMtdTop10(rows, co.ordersTag, ctx.monthStart, ctx.todayStr)

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

                <OversiteSection title={`📋 Orders MTD — ${ctx.monthLbl}`}>
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
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
