import { useMemo, useState } from 'react'
import { useLocale } from '../../context/LocaleContext'
import { fmt } from '../../lib/format'
import type { SupplierMonthlyMatrix } from '../../lib/supplierMetrics'

type SortKey = 'total' | 'last' | 'avg'

/**
 * Monthly sales per supplier over the rolling 12 months, with each supplier's
 * monthly average alongside — cells above the supplier's own average are tinted
 * up, below are dimmed. Sortable (desc) by 12-month total (default), the current
 * month, or the average. A top-10 chart of the last 6 months sits above.
 */
export function OversiteSuppliersMatrix({ matrix }: { matrix: SupplierMonthlyMatrix | null }) {
  const { t } = useLocale()
  const [sortKey, setSortKey] = useState<SortKey>('total')

  const lastIdx = matrix ? matrix.months.length - 1 : 0

  const sorted = useMemo(() => {
    if (!matrix) return []
    const key = (s: (typeof matrix.suppliers)[number]) =>
      sortKey === 'last' ? s.monthly[lastIdx] : sortKey === 'avg' ? s.avg : s.total
    return [...matrix.suppliers].sort((a, b) => key(b) - key(a))
  }, [matrix, sortKey, lastIdx])

  // Top 10 suppliers by last-6-months sales, for the chart above the table.
  const top6mo = useMemo(() => {
    if (!matrix) return []
    const from = Math.max(0, matrix.months.length - 6)
    return matrix.suppliers
      .map(s => ({ supplier: s.supplier, sum: s.monthly.slice(from).reduce((a, b) => a + b, 0) }))
      .filter(s => s.sum > 0)
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 10)
  }, [matrix])

  if (!matrix) return <p className="ov-empty-inline">{t('oversite.noSupplierSales')}</p>

  const { months, monthTotals, grandAvg } = matrix
  const chartMax = Math.max(...top6mo.map(s => s.sum), 1)
  const sortArrow = (k: SortKey) => (sortKey === k ? ' ↓' : '')

  return (
    <div className="ov-supplier-matrix">
      {top6mo.length > 0 && (
        <div className="ov-supplier-chart">
          <div className="ov-supplier-chart-title">{t('oversite.top10Suppliers6m')}</div>
          <div className="ov-bar-chart">
            {top6mo.map(s => (
              <div key={s.supplier} className="ov-bar-row">
                <span className="ov-bar-lbl" title={s.supplier}>{s.supplier}</span>
                <div className="ov-bar-track">
                  <div
                    className="ov-bar-fill supplier"
                    style={{ width: `${((s.sum / chartMax) * 100).toFixed(1)}%` }}
                  />
                </div>
                <span className="ov-bar-val">{fmt(s.sum)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th className="ov-sup-name">{t('oversite.supplier')}</th>
            {months.map((m, i) => (
              <th
                key={m.ym}
                className={`${m.isCurrent ? 'ov-sup-cur' : ''}${i === lastIdx ? ' ov-sup-sortable' : ''}`}
                {...(i === lastIdx
                  ? { role: 'button', onClick: () => setSortKey('last'), title: t('oversite.sortDesc') }
                  : {})}
              >
                {m.label}
                {i === lastIdx ? sortArrow('last') : ''}
              </th>
            ))}
            <th
              className="ov-sup-avg ov-sup-sortable"
              role="button"
              onClick={() => setSortKey('avg')}
              title={t('oversite.sortDesc')}
            >
              {t('oversite.avg')}{sortArrow('avg')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(s => (
            <tr key={s.supplier}>
              <td className="ov-sup-name" title={s.supplier}>{s.supplier}</td>
              {s.monthly.map((v, i) => {
                const cls = v > s.avg * 1.05 ? 'sup-above' : v < s.avg * 0.95 ? 'sup-below' : ''
                return (
                  <td
                    key={months[i].ym}
                    className={`cr ${cls}${months[i].isCurrent ? ' ov-sup-cur' : ''}`}
                  >
                    {v ? fmt(v) : '—'}
                  </td>
                )
              })}
              <td className="cr ov-sup-avg">{fmt(s.avg)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="ov-sup-name">{t('oversite.total')}</td>
            {monthTotals.map((v, i) => (
              <td key={months[i].ym} className={`cr${months[i].isCurrent ? ' ov-sup-cur' : ''}`}>
                {fmt(v)}
              </td>
            ))}
            <td className="cr ov-sup-avg">{fmt(grandAvg)}</td>
          </tr>
        </tfoot>
      </table>
      <div className="ov-supplier-matrix-note">{t('oversite.supplierMatrixNote')}</div>
    </div>
  )
}
