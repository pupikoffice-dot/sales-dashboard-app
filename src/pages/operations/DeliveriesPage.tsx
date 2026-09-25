import { useMemo } from 'react'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useLocale } from '../../context/LocaleContext'
import { useOpsDeliveries } from '../../hooks/useOpsDeliveries'
import { monthNamesForLocale } from '../../i18n'
import {
  barPct,
  buildMonthlyDeliveryBlocks,
  deliverySeriesStats,
  type DeliveryMonth,
} from '../../lib/opsDeliveries'
import { companyLabel } from '../../lib/salesMetrics'

const MONTHS = 12

function fmtQty(n: number): string {
  return Math.round(n).toLocaleString()
}

function YearChart({
  title,
  months,
  pick,
  max,
  total,
  variant,
  monthNames,
  currentYm,
}: {
  title: string
  /** Oldest month first. */
  months: DeliveryMonth[]
  pick: (m: DeliveryMonth) => number
  max: number
  total: number
  variant: 'cartons' | 'pallets'
  monthNames: string[]
  currentYm: string
}) {
  const { t } = useLocale()
  const values = months.map(pick)
  const stats = deliverySeriesStats(months, values)
  const n = months.length
  const trendAt = (i: number) => (stats ? stats.intercept + stats.slope * i : 0)
  const scale = Math.max(
    max,
    stats?.avg ?? 0,
    stats ? trendAt(stats.fromIdx) : 0,
    stats ? trendAt(n - 1) : 0,
  )
  const xAt = (i: number) => ((i + 0.5) / n) * 100
  const yAt = (v: number) => 100 - Math.min(100, Math.max(0, (v / (scale || 1)) * 100))
  const slopeTxt = stats ? `${stats.slope >= 0 ? '▲ +' : '▼ '}${fmtQty(stats.slope)}` : ''

  return (
    <div className="ops-chart">
      <div className="ops-chart-hdr">
        <span>{title}</span>
      </div>
      <div className="ops-chart-stats">
        <span>
          {t('ops.total')}: <strong>{fmtQty(total)}</strong>
        </span>
        {stats && (
          <>
            <span title={t('ops.avgHint')}>
              <i className="ops-legend ops-legend--avg" aria-hidden />
              {t('ops.avgPerMonth')}: <strong>{fmtQty(stats.avg)}</strong>
            </span>
            <span title={t('ops.trendHint')}>
              <i className={`ops-legend ops-legend--trend-${variant}`} aria-hidden />
              {t('ops.trend')}:{' '}
              <strong className={stats.slope >= 0 ? 'ops-up' : 'ops-down'}>
                {slopeTxt} {t('ops.perMonth')}
              </strong>
            </span>
          </>
        )}
      </div>
      <div className="ops-chart-plot" dir="ltr" role="img" aria-label={title}>
        {months.map(m => {
          const v = pick(m)
          const isCurrent = m.ym === currentYm
          const pct = barPct(v, scale)
          return (
            <div
              key={m.ym}
              className={`ops-chart-col${isCurrent ? ' is-current' : ''}`}
              title={`${monthNames[m.month]} ${m.year}: ${fmtQty(v)}${isCurrent ? ` (${t('ops.mtd')})` : ''}`}
            >
              <span className="ops-chart-val" style={{ bottom: `calc(${pct}% + 2px)` }}>
                {fmtQty(v)}
              </span>
              <div className={`ops-chart-bar ops-chart-bar--${variant}`} style={{ height: `${pct}%` }} />
            </div>
          )
        })}
        {stats && (
          <svg className="ops-chart-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <line
              className="ops-avg-line"
              x1={xAt(stats.fromIdx)}
              x2={xAt(n - 1)}
              y1={yAt(stats.avg)}
              y2={yAt(stats.avg)}
              vectorEffect="non-scaling-stroke"
            />
            {stats.toIdx > stats.fromIdx && (
              <line
                className={`ops-trend-line ops-trend-line--${variant}`}
                x1={xAt(stats.fromIdx)}
                x2={xAt(n - 1)}
                y1={yAt(trendAt(stats.fromIdx))}
                y2={yAt(trendAt(n - 1))}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        )}
      </div>
      <div className="ops-chart-axis" dir="ltr">
        {months.map((m, i) => (
          <span key={m.ym} className={`ops-chart-x${m.ym === currentYm ? ' is-current' : ''}`}>
            {monthNames[m.month]}
            <span className="ops-chart-yr">{i === 0 || m.month === 0 ? `'${String(m.year).slice(2)}` : '\u00a0'}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Operations → Deliveries: yearly cartons (ZZ1) and pallets (ZZ2) charts per company, from rep893. */
export function DeliveriesPage() {
  const { access } = useDashboardAccess()
  const { t, locale } = useLocale()
  const { data: rows = [], isLoading, error } = useOpsDeliveries(MONTHS)
  const monthNames = monthNamesForLocale(locale)

  const blocks = useMemo(
    () => buildMonthlyDeliveryBlocks(rows, access?.companies ?? [], MONTHS),
    [rows, access?.companies],
  )

  return (
    <div className="ops-page">
      <div className="ops-page-hdr">
        <h2>🚚 {t('ops.deliveries.title')}</h2>
        <p>{t('ops.deliveries.subtitle', { months: MONTHS })}</p>
      </div>

      {isLoading && <p className="status-msg">{t('common.loading')}</p>}
      {error && <p className="status-msg error">{t('ops.loadError')}</p>}
      {!isLoading && !error && blocks.length === 0 && <p className="ov-empty">{t('ops.noData')}</p>}

      {blocks.map(b => {
        const chronological = [...b.months].reverse()
        const currentYm = b.months[0]?.ym ?? ''
        return (
          <section key={b.company} className="ops-co-block">
            <div className="ops-co-hdr">
              <h3>{companyLabel(b.company)}</h3>
            </div>
            <div className="ops-chart-grid">
              <YearChart
                title={t('ops.cartonsPerMonth')}
                months={chronological}
                pick={m => m.cartons}
                max={b.maxCartons}
                total={b.totalCartons}
                variant="cartons"
                monthNames={monthNames}
                currentYm={currentYm}
              />
              <YearChart
                title={t('ops.palletsPerMonth')}
                months={chronological}
                pick={m => m.pallets}
                max={b.maxPallets}
                total={b.totalPallets}
                variant="pallets"
                monthNames={monthNames}
                currentYm={currentYm}
              />
            </div>
          </section>
        )
      })}
    </div>
  )
}
