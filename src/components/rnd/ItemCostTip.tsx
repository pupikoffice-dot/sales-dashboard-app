import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchItemCostHistory } from '../../lib/itemCostHistory'
import { fmt0, fmt2, fmtDateIso } from '../../lib/format'
import { useLocale } from '../../context/LocaleContext'
import './ItemCostTip.css'

/** Wraps a cost figure; resting the mouse on it (or focusing it) shows that company's past import costs: date, unit cost, qty. */
export function ItemCostTip({ company, sku, eager, children }: { company: string; sku: string; eager?: boolean; children: ReactNode }) {
  const { t } = useLocale()
  const [seen, setSeen] = useState(false)
  const q = useQuery({
    queryKey: ['item-cost-hist', company, sku],
    queryFn: () => fetchItemCostHistory(company, sku),
    enabled: !!company && !!sku && (eager || seen),
    staleTime: 5 * 60 * 1000,
  })
  const rows = q.data?.history ?? []
  return (
    <span className="ict" tabIndex={0} onMouseEnter={() => setSeen(true)} onFocus={() => setSeen(true)}>
      {children}
      <span className="ict-pop" role="tooltip">
        <strong>{t('ic.tip.title')}</strong>
        {q.isLoading ? (
          <span className="ict-note">{t('ic.tip.loading')}</span>
        ) : rows.length ? (
          <table>
            <thead>
              <tr>
                <th>{t('ic.tip.date')}</th>
                <th>{t('ic.tip.cost')}</th>
                <th>{t('ic.tip.qty')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.date}|${r.doc}|${i}`}>
                  <td>{fmtDateIso(r.date)}</td>
                  <td>{fmt2(r.cost)}</td>
                  <td>{fmt0(r.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <span className="ict-note">{t('ic.tip.none')}</span>
        )}
      </span>
    </span>
  )
}
