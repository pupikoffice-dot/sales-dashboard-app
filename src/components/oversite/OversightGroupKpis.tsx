import { useLocale } from '../../context/LocaleContext'
import { fmt } from '../../lib/format'
import type { GroupKpi } from '../../lib/oversightGroupKpis'

/** Bento row of group totals above the company columns (Oversight, classic layout). */
export function OversightGroupKpis({
  kpis,
  scopeLabel,
  monthLbl,
}: {
  kpis: GroupKpi[]
  /** "All selected companies" or the single company's name. */
  scopeLabel: string
  monthLbl: string
}) {
  const { t } = useLocale()
  if (!kpis.length) return null

  const label = (k: GroupKpi): string => {
    switch (k.id) {
      case 'salesMtd': return t('oversite.salesMtd', { month: monthLbl })
      case 'ordersToday': return t('oversite.ordersToday')
      case 'ordersMtd': return t('oversite.ordersMtd', { month: monthLbl })
      case 'openOrders': return t('oversite.openOrders')
      case 'debt': return t('oversite.openDebt')
      case 'returns': return t('oversite.returnsMtd')
    }
  }
  const sub = (k: GroupKpi): string | null => {
    if (k.sub == null) return null
    if (k.id === 'openOrders') return `${fmt(k.sub)} ${t('oversite.qty')}`
    return `${fmt(k.sub)} ${t('oversite.clients')}`
  }
  const tone = (k: GroupKpi) => (k.id === 'returns' ? ' amber' : k.id === 'salesMtd' ? ' grn' : '')

  return (
    <section className="bento-kpis" aria-label={scopeLabel}>
      <div className="bento-kpis-scope">{scopeLabel}</div>
      <div className="bento-kpis-grid">
        {kpis.map(k => (
          <div key={k.id} className={`bento-kpi bento-kpi--${k.id}`}>
            <span className="bento-kpi-lbl">{label(k)}</span>
            <div className="bento-kpi-main">
              <span className={`bento-kpi-val${tone(k)}`}>{fmt(k.value)}</span>
              {k.lyPct != null ? (
                <span
                  className={`bento-kpi-delta ${k.lyPct >= 0 ? 'up' : 'down'}`}
                  title={t('oversite.vsLastYear')}
                >
                  {k.lyPct >= 0 ? '▲' : '▼'} {Math.abs(k.lyPct).toFixed(1)}%
                </span>
              ) : null}
            </div>
            <span className="bento-kpi-sub">{sub(k) ?? ''}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
