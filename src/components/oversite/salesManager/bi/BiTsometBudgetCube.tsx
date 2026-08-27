import { useMemo } from 'react'
import { useLocale } from '../../../../context/LocaleContext'
import { useTsometBudgetData } from '../../../../hooks/useTsometBudgetData'
import { fmt } from '../../../../lib/format'
import { buildTsometBudgetRows } from '../../../../lib/tsometBudget'
import {
  getOrdersMtdRows,
  getOversiteDateContext,
  resolveOrdersTag,
} from '../../../../lib/oversiteMetrics'
import type { SalesRow } from '../../../../types/dashboard'
import { BiCubeShell } from './BiCubeShell'

function formatReportDate(iso: string | null): string {
  if (!iso) return ''
  // Expect YYYY-MM-DD from Postgres date
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return iso
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

  const { rows: tableRows, reportDate } = useMemo(() => {
    const ctx = getOversiteDateContext()
    const ordersTag = resolveOrdersTag(rows, 'orders-mt')
    const ordersMtdRows = getOrdersMtdRows(rows, ordersTag, ctx.monthStart, ctx.todayStr)
    return buildTsometBudgetRows({
      budget,
      sales,
      ordersMtdRows,
      agents,
    })
  }, [budget, sales, rows, agents])

  const salesHeader = reportDate
    ? t('bi.tsometBudget.col.salesCashDated', { date: formatReportDate(reportDate) })
    : t('bi.tsometBudget.col.salesCash')

  return (
    <BiCubeShell title={t('bi.tsometBudget.title')} helpText={t('bi.tsometBudget.help')}>
      {isLoading ? (
        <p className="bi-cube-empty">{t('common.loading')}</p>
      ) : error ? (
        <p className="bi-cube-empty">{(error as Error).message}</p>
      ) : tableRows.length === 0 ? (
        <p className="bi-cube-empty">{t('bi.tsometBudget.empty')}</p>
      ) : (
        <div className="bi-table-wrap">
          <table className="bi-table">
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
              {tableRows.map(it => (
                <tr key={`${it.erpNumber}|${it.storeNumber}`}>
                  <td className="bi-mono">{it.erpNumber}</td>
                  <td className="bi-mono">{it.storeNumber}</td>
                  <td>{it.storeName}</td>
                  <td className="bi-num">{fmt(it.budgetCash)}</td>
                  <td className="bi-num">{fmt(it.ordersMtdCash)}</td>
                  <td className="bi-num">{fmt(it.openBudget)}</td>
                  <td className="bi-num">{fmt(it.salesCash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BiCubeShell>
  )
}
