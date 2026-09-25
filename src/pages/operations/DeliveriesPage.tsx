import { useMemo } from 'react'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useLocale } from '../../context/LocaleContext'
import { useOpsDeliveries } from '../../hooks/useOpsDeliveries'
import { monthNamesForLocale } from '../../i18n'
import { barPct, buildMonthlyDeliveryBlocks, type DeliveryMonth } from '../../lib/opsDeliveries'
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
  return (
    <div className="ops-chart">
      <div className="ops-chart-hdr">
        <span>{title}</span>
        <span className="ops-chart-total">
          {t('ops.total')}: <strong>{fmtQty(total)}</strong>
        </span>
      </div>
      <div className="ops-chart-plot" role="img" aria-label={title}>
        {months.map((m, i) => {
          const v = pick(m)
          const isCurrent = m.ym === currentYm
          const showYear = i === 0 || m.month === 0
          return (
            <div
              key={m.ym}
              className={`ops-chart-col${isCurrent ? ' is-current' : ''}`}
              title={`${monthNames[m.month]} ${m.year}: ${fmtQty(v)}${isCurrent ? ` (${t('ops.mtd')})` : ''}`}
            >
              <span className="ops-chart-val">{fmtQty(v)}</span>
              <div className="ops-chart-bar-wrap">
                <div
                  className={`ops-chart-bar ops-chart-bar--${variant}`}
                  style={{ height: `${barPct(v, max)}%` }}
                />
              </div>
              <span className="ops-chart-x">
                {monthNames[m.month]}
                <span className="ops-chart-yr">{showYear ? `'${String(m.year).slice(2)}` : '\u00a0'}</span>
              </span>
            </div>
          )
        })}
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
