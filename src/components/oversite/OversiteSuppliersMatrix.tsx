import { useMemo, useState } from 'react'
import { useLocale } from '../../context/LocaleContext'
import { fmt, fmtCompact } from '../../lib/format'
import type { SupplierMonthlyMatrix } from '../../lib/supplierMetrics'

type SortKey = 'total' | 'last' | 'avg'

const CHART_MONTHS = 6
const TOP_N = 8
const COLORS = 10 // sup-c0..sup-c9

/**
 * Oversight suppliers block: an always-visible per-month-per-supplier stacked
 * chart (last 6 months, top suppliers + Other) on top, then the full matrix
 * table (12 months vs each supplier's monthly average) for the detail.
 *
 * Detail-table column order: Supplier | Avg | current month | prior months in
 * descending (newest -> oldest) order — so the two most important figures
 * (average, current month) sit right next to the name with no scrolling.
 */
export function OversiteSuppliersMatrix({ matrix }: { matrix: SupplierMonthlyMatrix | null }) {
  const { t } = useLocale()
  const [sortKey, setSortKey] = useState<SortKey>('total')

  const lastIdx = matrix ? matrix.months.length - 1 : 0

  // Column order for the detail table: current month first, then the rest of
  // the months newest -> oldest (reverse chronological).
  const colOrder = useMemo(() => {
    if (!matrix) return []
    const idxs = matrix.months.map((_, i) => i)
    return [lastIdx, ...idxs.filter(i => i !== lastIdx).reverse()]
  }, [matrix, lastIdx])

  // Chart: last 6 months, stacked by the top-N suppliers (by 6-month total) + Other.
  const chart = useMemo(() => {
    if (!matrix) return null
    const offset = Math.max(0, matrix.months.length - CHART_MONTHS)
    const months = matrix.months.slice(offset)
    const ranked = [...matrix.suppliers]
      .map(s => ({ supplier: s.supplier, tail: s.monthly.slice(offset), sum: s.monthly.slice(offset).reduce((a, b) => a + b, 0) }))
      .filter(s => s.sum > 0)
      .sort((a, b) => b.sum - a.sum)
    const top = ranked.slice(0, TOP_N)
    const monthTotals = matrix.monthTotals.slice(offset)
    const max = Math.max(...monthTotals, 1)
    const rows = months.map((m, i) => {
      const segs = top
        .map((s, ci) => ({ supplier: s.supplier, ci, value: s.tail[i] }))
        .filter(seg => seg.value > 0)
      const otherVal = monthTotals[i] - top.reduce((a, s) => a + s.tail[i], 0)
      return { ...m, segs, otherVal: otherVal > 0 ? otherVal : 0, total: monthTotals[i] }
    })
    return { months, top, rows, max }
  }, [matrix])

  const sorted = useMemo(() => {
    if (!matrix) return []
    const key = (s: (typeof matrix.suppliers)[number]) =>
      sortKey === 'last' ? s.monthly[lastIdx] : sortKey === 'avg' ? s.avg : s.total
    return [...matrix.suppliers].sort((a, b) => key(b) - key(a))
  }, [matrix, sortKey, lastIdx])

  if (!matrix || !chart) return <p className="ov-empty-inline">{t('oversite.noSupplierSales')}</p>

  const { months, monthTotals, grandAvg } = matrix
  const sortArrow = (k: SortKey) => (sortKey === k ? ' ↓' : '')

  return (
    <div className="ov-supplier-matrix">
      {/* Always-visible per-month-per-supplier stacked chart */}
      <div className="ov-supplier-legend">
        {chart.top.map((s, ci) => (
          <span key={s.supplier} className="ov-supplier-legend-item">
            <span className={`ov-supplier-swatch sup-c${ci % COLORS}`} />
            {s.supplier}
          </span>
        ))}
        <span className="ov-supplier-legend-item">
          <span className="ov-supplier-swatch sup-other" />
          {t('oversite.other')}
        </span>
      </div>
      <div className="ov-bar-chart">
        {chart.rows.map(row => (
          <div key={row.ym} className={`ov-bar-row${row.isCurrent ? ' ov-bar-row--current' : ''}`}>
            <span className="ov-bar-lbl">{row.label}</span>
            <div className="ov-bar-track ov-bar-track--stacked">
              {row.segs.map(seg => (
                <div
                  key={seg.supplier}
                  className={`ov-bar-fill sup-c${seg.ci % COLORS}`}
                  style={{ width: `${((seg.value / chart.max) * 100).toFixed(1)}%` }}
                  title={`${seg.supplier}: ${fmt(seg.value)}`}
                />
              ))}
              {row.otherVal > 0 && (
                <div
                  className="ov-bar-fill sup-other"
                  style={{ width: `${((row.otherVal / chart.max) * 100).toFixed(1)}%` }}
                  title={`${t('oversite.other')}: ${fmt(row.otherVal)}`}
                />
              )}
            </div>
            <span className="ov-bar-val">{fmt(row.total)}</span>
          </div>
        ))}
      </div>

      {/* Always-visible full 12-month matrix vs average. Column order: Supplier,
          Avg, Total, current month, then remaining months newest -> oldest. */}
      <div className="ov-supplier-detail-title">🔎 {t('oversite.supplierDetails')}</div>
      <div className="ov-supplier-matrix-scroll">
          <table>
            <thead>
              <tr>
                <th className="ov-sup-name">{t('oversite.supplier')}</th>
                <th
                  className="ov-sup-avg ov-sup-sortable"
                  role="button"
                  onClick={() => setSortKey('avg')}
                  title={t('oversite.sortDesc')}
                >
                  {t('oversite.avg')}{sortArrow('avg')}
                </th>
                <th
                  className="ov-sup-avg ov-sup-sortable"
                  role="button"
                  onClick={() => setSortKey('total')}
                  title={t('oversite.sortDesc')}
                >
                  {t('oversite.total')}{sortArrow('total')}
                </th>
                {colOrder.map(i => (
                  <th
                    key={months[i].ym}
                    className={`${months[i].isCurrent ? 'ov-sup-cur' : ''}${i === lastIdx ? ' ov-sup-sortable' : ''}`}
                    {...(i === lastIdx
                      ? { role: 'button', onClick: () => setSortKey('last'), title: t('oversite.sortDesc') }
                      : {})}
                  >
                    {months[i].label}
                    {i === lastIdx ? sortArrow('last') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => (
                <tr key={s.supplier}>
                  <td className="ov-sup-name" title={s.supplier}>{s.supplier}</td>
                  <td className="cr ov-sup-avg">{fmt(s.avg)}</td>
                  <td className="cr ov-sup-avg" title={fmt(s.total)}>{fmtCompact(s.total)}</td>
                  {colOrder.map(i => {
                    const v = s.monthly[i]
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
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="ov-sup-name">{t('oversite.total')}</td>
                <td className="cr ov-sup-avg">{fmt(grandAvg)}</td>
                <td className="cr ov-sup-avg" title={fmt(matrix.grandTotal)}>
                  {fmtCompact(matrix.grandTotal)}
                </td>
                {colOrder.map(i => (
                  <td key={months[i].ym} className={`cr${months[i].isCurrent ? ' ov-sup-cur' : ''}`}>
                    {fmt(monthTotals[i])}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      <div className="ov-supplier-matrix-note">{t('oversite.supplierMatrixNote')}</div>
    </div>
  )
}
