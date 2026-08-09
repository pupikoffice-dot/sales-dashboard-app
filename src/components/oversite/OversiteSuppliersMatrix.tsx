import { useLocale } from '../../context/LocaleContext'
import { fmt } from '../../lib/format'
import type { SupplierMonthlyMatrix } from '../../lib/supplierMetrics'

/**
 * Monthly sales per supplier over the rolling 12 months, with each supplier's
 * monthly average alongside — cells above the supplier's own average are tinted
 * up, below are dimmed, so "this month vs the yearly average" reads at a glance.
 * Current month column is highlighted. Sorted by 12-month total, descending.
 */
export function OversiteSuppliersMatrix({ matrix }: { matrix: SupplierMonthlyMatrix | null }) {
  const { t } = useLocale()
  if (!matrix) return <p className="ov-empty-inline">{t('oversite.noSupplierSales')}</p>

  const { months, suppliers, monthTotals, grandAvg } = matrix

  return (
    <div className="ov-supplier-matrix">
      <table>
        <thead>
          <tr>
            <th className="ov-sup-name">{t('oversite.supplier')}</th>
            {months.map(m => (
              <th key={m.ym} className={m.isCurrent ? 'ov-sup-cur' : undefined}>{m.label}</th>
            ))}
            <th className="ov-sup-avg">{t('oversite.avg')}</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map(s => (
            <tr key={s.supplier}>
              <td className="ov-sup-name" title={s.supplier}>{s.supplier}</td>
              {s.monthly.map((v, i) => {
                const cls =
                  v > s.avg * 1.05 ? 'sup-above' : v < s.avg * 0.95 ? 'sup-below' : ''
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
