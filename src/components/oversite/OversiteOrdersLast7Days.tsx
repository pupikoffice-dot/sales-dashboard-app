import { useLocale } from '../../context/LocaleContext'
import { agentColorClass } from '../../lib/agentColors'
import { fmt } from '../../lib/format'
import type { OrdersLast7DaysResult } from '../../lib/oversiteMetrics'

/**
 * Vertical stacked-block chart: last 7 calendar days of orders cash (₪),
 * agents stacked per day. Stable per-agent colors (same agent = same hue).
 */
export function OversiteOrdersLast7Days({ data }: { data: OrdersLast7DaysResult }) {
  const { t } = useLocale()
  const { days, agents } = data
  if (agents.length === 0 && days.every(d => d.total === 0)) {
    return (
      <div className="ov-orders7">
        <div className="ov-orders7-title">{t('oversite.ordersLast7Days')}</div>
        <div className="ov-orders7-empty">{t('oversite.ordersLast7DaysEmpty')}</div>
      </div>
    )
  }

  const max = Math.max(...days.map(d => d.total), 1)

  return (
    <div className="ov-orders7">
      <div className="ov-orders7-title">{t('oversite.ordersLast7Days')}</div>
      {agents.length > 0 && (
        <div className="ov-receipts-legend">
          {agents.map(a => (
            <span key={a} className="ov-receipts-legend-item">
              <span className={`ov-receipts-swatch ${agentColorClass(a)}`} />
              {t('oversite.debtAgent')} {a}
            </span>
          ))}
        </div>
      )}
      <div className="ov-orders7-chart" role="img" aria-label={t('oversite.ordersLast7Days')}>
        {days.map(day => {
          const stackPct = Math.max((day.total / max) * 100, day.total > 0 ? 6 : 0)
          return (
            <div key={day.date} className={`ov-orders7-col${day.isToday ? ' ov-orders7-col--today' : ''}`}>
              <div className="ov-orders7-val">{day.total > 0 ? fmt(day.total) : '—'}</div>
              <div className="ov-orders7-plot">
                <div className="ov-orders7-stack" style={{ height: `${stackPct}%` }}>
                  {agents.map(a => {
                    const cash = day.byAgent[a] || 0
                    if (cash <= 0) return null
                    const pctOfDay = day.total > 0 ? (cash / day.total) * 100 : 0
                    return (
                      <div
                        key={a}
                        className={`ov-orders7-seg ${agentColorClass(a)}`}
                        style={{ flexGrow: pctOfDay, flexBasis: 0 }}
                        title={`${t('oversite.debtAgent')} ${a}: ${fmt(cash)} · ${day.label}`}
                      />
                    )
                  })}
                </div>
              </div>
              <div className="ov-orders7-lbl">{day.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
