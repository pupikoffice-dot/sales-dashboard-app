import { useMemo, useState, type KeyboardEvent } from 'react'
import { useLocale } from '../../../../context/LocaleContext'
import { useTsometBudgetData } from '../../../../hooks/useTsometBudgetData'
import { fmt } from '../../../../lib/format'
import {
  buildTsometBudgetRows,
  isOpenBudgetLow,
  sumTsometBudgetRows,
  type TsometBudgetRow,
} from '../../../../lib/tsometBudget'
import {
  getOrdersMtdRows,
  getOversiteDateContext,
  groupSalesRowsByDoc,
  resolveOrdersTag,
} from '../../../../lib/oversiteMetrics'
import type { SalesRow } from '../../../../types/dashboard'
import { SmOpenOrdersReportModal } from '../SmOpenOrdersReportModal'
import { BiCubeShell } from './BiCubeShell'

function formatReportDate(iso: string | null): string {
  if (!iso) return ''
  // Expect YYYY-MM-DD from Postgres date
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return iso
}

function normErp(v: string): string {
  return String(v ?? '').trim()
}

export function BiTsometBudgetCube({
  rows,
  agents,
}: {
  /** Access-scoped sales rows (must include orders-mt / legacy tag). */
  rows: SalesRow[]
  agents: string[] | null
}) {
  const { t } = useLocale()
  const { budget, sales, isLoading, error } = useTsometBudgetData(true)
  const [selectedStore, setSelectedStore] = useState<TsometBudgetRow | null>(null)

  const ordersCtx = useMemo(() => {
    const ctx = getOversiteDateContext()
    const ordersTag = resolveOrdersTag(rows, 'orders-mt')
    const ordersMtdRows = getOrdersMtdRows(rows, ordersTag, ctx.monthStart, ctx.todayStr)
    return { ctx, ordersMtdRows }
  }, [rows])

  const { rows: tableRows, reportDate } = useMemo(
    () =>
      buildTsometBudgetRows({
        budget,
        sales,
        ordersMtdRows: ordersCtx.ordersMtdRows,
        agents,
      }),
    [budget, sales, ordersCtx.ordersMtdRows, agents],
  )

  const storeOrders = useMemo(() => {
    const erp = selectedStore ? normErp(selectedStore.erpNumber) : ''
    if (!erp) return []
    const matched = ordersCtx.ordersMtdRows.filter(r => normErp(String(r.clientID ?? '')) === erp)
    return groupSalesRowsByDoc(matched)
  }, [selectedStore, ordersCtx.ordersMtdRows])

  const salesHeader = reportDate
    ? t('bi.tsometBudget.col.salesCashDated', { date: formatReportDate(reportDate) })
    : t('bi.tsometBudget.col.salesCash')

  const totals = useMemo(() => sumTsometBudgetRows(tableRows), [tableRows])
  const totalsOpenLow = isOpenBudgetLow({
    budgetCash: totals.budgetCash,
    openBudget: totals.openBudget,
  })

  function openStoreOrders(row: TsometBudgetRow) {
    if (!normErp(row.erpNumber)) return
    setSelectedStore(row)
  }

  function onStoreRowKeyDown(e: KeyboardEvent, row: TsometBudgetRow) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openStoreOrders(row)
    }
  }

  const ordersModalTitle = selectedStore
    ? t('bi.tsometBudget.ordersModalTitle', {
        store: selectedStore.storeNumber,
        name: selectedStore.storeName,
        month: ordersCtx.ctx.monthLbl,
      })
    : ''

  return (
    <>
      <BiCubeShell title={t('bi.tsometBudget.title')} helpText={t('bi.tsometBudget.help')}>
        {isLoading ? (
          <p className="bi-cube-empty">{t('common.loading')}</p>
        ) : error ? (
          <p className="bi-cube-empty">{(error as Error).message}</p>
        ) : tableRows.length === 0 ? (
          <p className="bi-cube-empty">{t('bi.tsometBudget.empty')}</p>
        ) : (
          <>
            <div className="bi-tsomet-summary">
              <span className="bi-tsomet-summary-label">{t('bi.tsometBudget.totalOpenBudget')}</span>
              <span
                className={`bi-tsomet-summary-value${totalsOpenLow ? ' bi-tsomet-open--low' : ''}`}
              >
                {fmt(totals.openBudget)}
              </span>
            </div>
            <div className="bi-table-wrap bi-tsomet-table-wrap">
              <table className="bi-table bi-tsomet-table">
                <thead>
                  <tr>
                    <th>{t('bi.tsometBudget.col.erp')}</th>
                    <th>{t('bi.tsometBudget.col.storeNum')}</th>
                    <th>{t('bi.tsometBudget.col.storeName')}</th>
                    <th className="bi-num">{t('bi.tsometBudget.col.budget')}</th>
                    <th className="bi-num">{t('bi.tsometBudget.col.ordersMtd')}</th>
                    <th className="bi-num">{t('bi.tsometBudget.col.openBudget')}</th>
                    <th className="bi-num">{salesHeader}</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(it => {
                    const clickable = !!normErp(it.erpNumber)
                    return (
                      <tr
                        key={`${it.erpNumber}|${it.storeNumber}`}
                        className={clickable ? 'bi-tsomet-row--clickable' : undefined}
                        tabIndex={clickable ? 0 : undefined}
                        role={clickable ? 'button' : undefined}
                        aria-label={
                          clickable
                            ? t('bi.tsometBudget.openOrdersForStore', { store: it.storeName })
                            : undefined
                        }
                        onClick={clickable ? () => openStoreOrders(it) : undefined}
                        onKeyDown={clickable ? e => onStoreRowKeyDown(e, it) : undefined}
                      >
                        <td className="bi-mono">{it.erpNumber}</td>
                        <td className="bi-mono">{it.storeNumber}</td>
                        <td>{it.storeName}</td>
                        <td className="bi-num">{fmt(it.budgetCash)}</td>
                        <td className="bi-num">{fmt(it.ordersMtdCash)}</td>
                        <td
                          className={`bi-num${isOpenBudgetLow(it) ? ' bi-tsomet-open--low' : ''}`}
                        >
                          {fmt(it.openBudget)}
                        </td>
                        <td className="bi-num">{fmt(it.salesCash)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bi-tsomet-tfoot">
                    <td colSpan={3}>
                      <b>{t('bi.tsometBudget.totalRow')}</b>
                    </td>
                    <td className="bi-num">
                      <b>{fmt(totals.budgetCash)}</b>
                    </td>
                    <td className="bi-num">
                      <b>{fmt(totals.ordersMtdCash)}</b>
                    </td>
                    <td className={`bi-num${totalsOpenLow ? ' bi-tsomet-open--low' : ''}`}>
                      <b>{fmt(totals.openBudget)}</b>
                    </td>
                    <td className="bi-num">
                      <b>{fmt(totals.salesCash)}</b>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="bi-tsomet-cards-summary">
              <span>{t('bi.tsometBudget.totalOpenBudget')}</span>
              <strong className={totalsOpenLow ? 'bi-tsomet-open--low' : undefined}>
                {fmt(totals.openBudget)}
              </strong>
            </div>
            <ul className="bi-tsomet-cards" aria-label={t('bi.tsometBudget.title')}>
              {tableRows.map(it => {
                const clickable = !!normErp(it.erpNumber)
                return (
                  <li
                    key={`card-${it.erpNumber}|${it.storeNumber}`}
                    className={`bi-tsomet-card${clickable ? ' bi-tsomet-card--clickable' : ''}`}
                    tabIndex={clickable ? 0 : undefined}
                    role={clickable ? 'button' : undefined}
                    aria-label={
                      clickable
                        ? t('bi.tsometBudget.openOrdersForStore', { store: it.storeName })
                        : undefined
                    }
                    onClick={clickable ? () => openStoreOrders(it) : undefined}
                    onKeyDown={clickable ? e => onStoreRowKeyDown(e, it) : undefined}
                  >
                    <div className="bi-tsomet-card-title">
                      <span className="bi-mono">{it.storeNumber}</span>
                      <span>{it.storeName}</span>
                    </div>
                    <dl className="bi-tsomet-card-grid">
                      <div>
                        <dt>{t('bi.tsometBudget.col.erp')}</dt>
                        <dd className="bi-mono">{it.erpNumber}</dd>
                      </div>
                      <div>
                        <dt>{t('bi.tsometBudget.col.budget')}</dt>
                        <dd className="bi-num">{fmt(it.budgetCash)}</dd>
                      </div>
                      <div>
                        <dt>{t('bi.tsometBudget.col.ordersMtd')}</dt>
                        <dd className="bi-num">{fmt(it.ordersMtdCash)}</dd>
                      </div>
                      <div>
                        <dt>{t('bi.tsometBudget.col.openBudget')}</dt>
                        <dd className={`bi-num${isOpenBudgetLow(it) ? ' bi-tsomet-open--low' : ''}`}>
                          {fmt(it.openBudget)}
                        </dd>
                      </div>
                      <div className="bi-tsomet-card-sales">
                        <dt>{salesHeader}</dt>
                        <dd className="bi-num">{fmt(it.salesCash)}</dd>
                      </div>
                    </dl>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </BiCubeShell>

      {selectedStore ? (
        <SmOpenOrdersReportModal
          title={ordersModalTitle}
          orders={storeOrders}
          hintText={t('bi.tsometBudget.ordersModalHint')}
          emptyLabel={t('bi.tsometBudget.noOrdersMtd')}
          showOrderDate
          onClose={() => setSelectedStore(null)}
        />
      ) : null}
    </>
  )
}
