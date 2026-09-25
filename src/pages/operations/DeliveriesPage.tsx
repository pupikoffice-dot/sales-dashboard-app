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

function MonthCard({
  m,
  monthName,
  isCurrent,
  maxCartons,
  maxPallets,
}: {
  m: DeliveryMonth
  monthName: string
  isCurrent: boolean
  maxCartons: number
  maxPallets: number
}) {
  const { t } = useLocale()
  return (
    <div className={`ops-month-card${isCurrent ? ' is-current' : ''}`}>
      <div className="ops-month-hdr">
        <span>
          {monthName} {m.year}
        </span>
        {isCurrent && <span className="ops-mtd-tag">{t('ops.mtd')}</span>}
      </div>
      <div className="ops-graph">
        <div className="ops-graph-lbl">
          <span>{t('ops.cartons')}</span>
          <strong>{fmtQty(m.cartons)}</strong>
        </div>
        <div className="ops-bar-track">
          <div className="ops-bar ops-bar--cartons" style={{ width: `${barPct(m.cartons, maxCartons)}%` }} />
        </div>
      </div>
      <div className="ops-graph">
        <div className="ops-graph-lbl">
          <span>{t('ops.pallets')}</span>
          <strong>{fmtQty(m.pallets)}</strong>
        </div>
        <div className="ops-bar-track">
          <div className="ops-bar ops-bar--pallets" style={{ width: `${barPct(m.pallets, maxPallets)}%` }} />
        </div>
      </div>
    </div>
  )
}

/** Operations → Deliveries: monthly cartons (ZZ1) and pallets (ZZ2) from rep893, per company. */
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

      {blocks.map(b => (
        <section key={b.company} className="ops-co-block">
          <div className="ops-co-hdr">
            <h3>{companyLabel(b.company)}</h3>
            <div className="ops-co-totals">
              <span>
                {t('ops.cartons')}: <strong>{fmtQty(b.totalCartons)}</strong>
              </span>
              <span>
                {t('ops.pallets')}: <strong>{fmtQty(b.totalPallets)}</strong>
              </span>
            </div>
          </div>
          <div className="ops-month-grid">
            {b.months.map((m, i) => (
              <MonthCard
                key={m.ym}
                m={m}
                monthName={monthNames[m.month]}
                isCurrent={i === 0}
                maxCartons={b.maxCartons}
                maxPallets={b.maxPallets}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
