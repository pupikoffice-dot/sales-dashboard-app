import { useState } from 'react'
import { SalesReportBody } from '../components/sales/SalesReportBody'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardFilters } from '../context/DashboardFiltersContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { filterRowsByCompany } from '../lib/permissions'
import { computeDebtSummary, debtRowsForCompany } from '../lib/debtMetrics'
import { fmt, formatGeneratedDisplay } from '../lib/format'
import type { LogicalCompany } from '../types/dashboard'
import { DebtModal } from '../components/oversite/DebtModal'
import { OversiteDebtSummary } from '../components/oversite/OversiteDebtSummary'
import { OrdersTodayModal } from '../components/oversite/OrdersTodayModal'
import { OversiteOrdersReportButton } from '../components/oversite/OversiteOrdersReportButton'
import { StockAlertsPanel } from '../components/oversite/StockAlertsPanel'
import {
  OVERSITE_COMPANIES,
  computeDelivery720Mtd,
  computeDelivery720MtdTop10,
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
  resolveOpenOrdersTag,
  resolveOrdersTag,
} from '../lib/oversiteMetrics'
import { OversiteCollapsible } from '../components/oversite/OversiteCollapsible'
import { OversiteKpiRow, OversiteSection, SalesLyBars } from '../components/oversite/OversiteKpiRow'
import { OversiteTop10Table } from '../components/oversite/OversiteTop10Table'

export function OversitePage() {
  const { t } = useLocale()
  const { isSuperAdmin } = useAuth()
  const { access } = useDashboardAccess()
  const f = useDashboardFilters()
  const { allRows, debtRows, debtLastUpdate, wmsStock, wmsNames, isLoading, error, data: dashboardData } =
    useDashboardData()
  const [debtModalCo, setDebtModalCo] = useState<LogicalCompany | null>(null)
  const [ordersModal, setOrdersModal] = useState<{
    company: LogicalCompany
    companyLabel: string
    ordersTag: string
  } | null>(null)

  if (!isSuperAdmin && f.applied) {
    return <SalesReportBody />
  }

  if (isLoading) return <p className="status-msg">{t('common.loadingSalesData')}</p>
  if (error) return <p className="status-msg error">{(error as Error).message}</p>

  const ctx = getOversiteDateContext()
  const visibleCompanies = OVERSITE_COMPANIES.filter(c => access?.companies.includes(c.id))
  const companyRows = access ? filterRowsByCompany(access, allRows) : []
  const fileUpdatedAt = formatGeneratedDisplay(dashboardData?.generated)

  // Per-segment source-file freshness (super-admin only): when that ERP file last synced.
  const syncTimes = dashboardData?.syncTimes ?? {}
  const segUpdated = (companyId: string, seg: string): string | undefined => {
    if (!isSuperAdmin) return undefined
    const iso = syncTimes[companyId]?.[seg]
    if (!iso) return undefined
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return undefined
    // Explicit DD/MM/YYYY HH:MM 24-hour format in the viewer's local timezone
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    const stamp = `${day}/${month}/${year} ${hours}:${mins}`
    return `${t('oversite.synced')}: ${stamp}`
  }

  return (
    <>
      <div className="ov-header">
        <h2>🏠 {t('oversite.title')}</h2>
        <div className="ov-sub">
          {t('oversite.today')}: <b>{ctx.todayDisp}</b>
          {fileUpdatedAt ? (
            <>
              {' '}
              · {t('oversite.fileUpdated')}: <b>{fileUpdatedAt}</b>
            </>
          ) : null}{' '}
          · {t('oversite.month')}: <b>{ctx.monthLbl}</b>
        </div>
      </div>

      {visibleCompanies.length === 0 ? (
        <p className="ov-empty">{t('oversite.noCompanies')}</p>
      ) : (
        <div className={`ov-grid${visibleCompanies.length === 1 ? ' ov-grid--single-co' : ''}`}>
          {visibleCompanies.map(co => {
            const ordersTag = resolveOrdersTag(companyRows, co.ordersTag)
            const openOrdersTag = resolveOpenOrdersTag(companyRows, co.openOrdersTag)
            const ordersToday = computeOrdersToday(companyRows, ordersTag, ctx.todayStr)
            const ordersMtd = computeOrdersMtd(companyRows, ordersTag, ctx.monthStart, ctx.todayStr)
            const openOrders = computeOpenOrders(companyRows, openOrdersTag)
            const openOrdersTop10 = computeOpenOrdersTop10(companyRows, openOrdersTag)
            const delivery720Mtd = computeDelivery720Mtd(
              companyRows,
              co.delivery720Tag,
              ctx.monthStart,
              ctx.todayStr,
            )
            const delivery720MtdTop10 = computeDelivery720MtdTop10(
              companyRows,
              co.delivery720Tag,
              ctx.monthStart,
              ctx.todayStr,
            )
            const salesMtd = computeSalesMtd(companyRows, co.id, ctx.curYear, ctx.curMonth)
            const salesMtdCombinedCash = salesMtd.cash + delivery720Mtd.cash
            const salesMtdCombinedLyPct =
              salesMtd.lyCash > 0 ? ((salesMtdCombinedCash - salesMtd.lyCash) / salesMtd.lyCash) * 100 : null
            const ordersTop10 = computeOrdersMtdTop10(companyRows, ordersTag, ctx.monthStart, ctx.todayStr)
            const salesTop10 = computeSalesMtdTop10(companyRows, co.id, ctx.curYear, ctx.curMonth)
            const returnsMtd = computeReturnsMtd(companyRows, co.returnsTag, ctx.curYear, ctx.curMonth)
            const returnsTop10 = computeReturnsMtdTop10(companyRows, co.returnsTag, ctx.curYear, ctx.curMonth)
            const companyDebt = debtRowsForCompany(debtRows, co.id)
            const debtSummary = computeDebtSummary(companyDebt)
            return (
              <div
                key={co.id}
                className={`ov-col${visibleCompanies.length === 1 ? ' ov-col--sections-grid' : ''}`}
              >
                <div className="ov-col-hdr" style={{ borderLeftColor: co.accentColor }}>
                  {co.label}
                </div>

                <OversiteSection title={`📋 ${t('oversite.ordersToday')}`} updatedAt={segUpdated(co.id, 'orders')}>
                  <OversiteKpiRow
                    kpis={[
                      { label: t('oversite.clients'), value: String(ordersToday.clients) },
                      { label: t('oversite.qty'), value: fmt(ordersToday.qty) },
                      { label: t('oversite.cash'), value: fmt(ordersToday.cash), tone: 'grn' },
                    ]}
                  />
                  <OversiteOrdersReportButton
                    onClick={() =>
                      setOrdersModal({ company: co.id, companyLabel: co.label, ordersTag })
                    }
                  />
                </OversiteSection>

                <OversiteSection title={`📋 ${t('oversite.ordersMtd', { month: ctx.monthLbl })}`} updatedAt={segUpdated(co.id, 'orders')}>
                  <OversiteKpiRow
                    kpis={[
                      { label: t('oversite.clients'), value: String(ordersMtd.clients) },
                      { label: t('oversite.qty'), value: fmt(ordersMtd.qty) },
                      { label: t('oversite.cash'), value: fmt(ordersMtd.cash), tone: 'grn' },
                    ]}
                  />
                  <OversiteCollapsible label={`📦 ${t('oversite.top10Orders')} ▾`}>
                    <OversiteTop10Table
                      items={ordersTop10}
                      emptyLabel={t('oversite.noOrderItems')}
                      showSku
                    />
                  </OversiteCollapsible>
                </OversiteSection>

                <OversiteSection title={`📋 ${t('oversite.openOrders')}`} updatedAt={segUpdated(co.id, 'openorders')}>
                  <OversiteKpiRow
                    kpis={[
                      { label: t('oversite.clients'), value: String(openOrders.clients) },
                      { label: t('oversite.qty'), value: fmt(openOrders.qty) },
                      { label: t('oversite.cash'), value: fmt(openOrders.cash), tone: 'grn' },
                    ]}
                  />
                  <OversiteCollapsible label={`📦 ${t('oversite.top10OpenOrders')} ▾`}>
                    <OversiteTop10Table
                      items={openOrdersTop10}
                      emptyLabel={t('oversite.noOpenOrders')}
                      showSku
                    />
                  </OversiteCollapsible>
                </OversiteSection>

                <OversiteSection title={`💰 ${t('oversite.salesMtd', { month: ctx.monthLbl })}`} updatedAt={segUpdated(co.id, 'sales')}>
                  <OversiteKpiRow
                    kpis={[
                      { label: t('oversite.cash'), value: fmt(salesMtd.cash), tone: 'grn' },
                      { label: t('oversite.qty'), value: fmt(salesMtd.qty) },
                    ]}
                  />
                  <SalesLyBars
                    monthLbl={ctx.monthLbl}
                    lyMonthLbl={ctx.lyMonthLbl}
                    cash={salesMtd.cash}
                    deliveryCash={delivery720Mtd.cash}
                    lyCash={salesMtd.lyCash}
                    lyChangeCashPct={salesMtdCombinedLyPct}
                  />
                  <OversiteCollapsible label={`📄 ${t('oversite.deliveryNotes')} ▾`}>
                    <OversiteKpiRow
                      kpis={[
                        { label: t('oversite.clients'), value: String(delivery720Mtd.clients) },
                        { label: t('oversite.qty'), value: fmt(delivery720Mtd.qty) },
                        { label: t('oversite.cash'), value: fmt(delivery720Mtd.cash), tone: 'grn' },
                      ]}
                    />
                    <OversiteTop10Table
                      items={delivery720MtdTop10}
                      emptyLabel={t('oversite.noDeliveryNotes')}
                      showSku
                    />
                  </OversiteCollapsible>
                </OversiteSection>

                <OversiteSection title={`🏆 ${t('oversite.top10Items')}`} updatedAt={segUpdated(co.id, 'sales')}>
                  <OversiteTop10Table items={salesTop10} emptyLabel={t('oversite.noSales')} showSku />
                </OversiteSection>

                <OversiteSection title={`↩️ ${t('oversite.returnsMtd')}`} updatedAt={segUpdated(co.id, 'returns')}>
                  <OversiteKpiRow
                    kpis={[
                      { label: t('oversite.cash'), value: fmt(returnsMtd.cash), tone: 'amber' },
                      { label: t('oversite.qty'), value: fmt(returnsMtd.qty) },
                    ]}
                  />
                  <OversiteCollapsible label={`↩️ ${t('oversite.top10Returns')} ▾`}>
                    <OversiteTop10Table items={returnsTop10} emptyLabel={t('oversite.noReturns')} showSku />
                  </OversiteCollapsible>
                </OversiteSection>

                <OversiteSection
                  title={`💳 ${t('oversite.openDebt')}${debtLastUpdate ? ` · ${t('oversite.lastUpdate')}: ${debtLastUpdate}` : ''}`}
                  updatedAt={segUpdated(co.id, 'debt')}
                >
                  <OversiteDebtSummary summary={debtSummary} onOpenReport={() => setDebtModalCo(co.id)} />
                </OversiteSection>

                <StockAlertsPanel
                  company={co.id}
                  companyRows={companyRows}
                  wmsStock={wmsStock}
                  wmsNames={wmsNames}
                />
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

      {ordersModal && (
        <OrdersTodayModal
          company={ordersModal.company}
          companyLabel={ordersModal.companyLabel}
          ordersTag={ordersModal.ordersTag}
          companyRows={companyRows}
          todayStr={ctx.todayStr}
          todayDisp={ctx.todayDisp}
          onClose={() => setOrdersModal(null)}
        />
      )}
    </>
  )
}
