import { useLocale } from '../../../context/LocaleContext'
import { fmt, MONTH_NAMES } from '../../../lib/format'
import type { SmYearNetSales } from './smMetrics'

const AGENT_COLOR_COUNT = 6

function monthSlots(year: number, throughMonth: number): Array<{ ym: string; label: string; isCurrent: boolean }> {
  const out = []
  for (let m = 1; m <= throughMonth; m++) {
    out.push({
      ym: `${year}-${String(m).padStart(2, '0')}`,
      label: MONTH_NAMES[m - 1],
      isCurrent: m === throughMonth,
    })
  }
  return out
}

/** Jan–current-month sales from report 891 (already net when summed). */
export function SmYearNetSalesChart({ data }: { data: SmYearNetSales }) {
  const { t } = useLocale()
  const slots = monthSlots(data.year, data.throughMonth).map(s => ({
    ...s,
    cash: data.monthly[s.ym] || 0,
  }))
  const shown = Math.max(data.throughMonth, 1)
  const avg = data.total / shown
  const max = Math.max(...slots.map(s => Math.abs(s.cash)), Math.abs(avg), 1)
  const stacked = data.agents.length > 1

  return (
    <div className="ov-receipts sm-year-sales">
      {stacked ? (
        <div className="ov-receipts-legend">
          {data.agents.map((agent, i) => {
            const total = slots.reduce((s, m) => s + ((data.byAgent[agent] || {})[m.ym] || 0), 0)
            return (
              <span key={agent || '__none'} className="ov-receipts-legend-item">
                <span className={`ov-receipts-swatch agent-c${i % AGENT_COLOR_COUNT}`} />
                {t('oversite.debtAgent')} {agent || '—'}: <b>{fmt(total)}</b>
              </span>
            )
          })}
        </div>
      ) : null}
      <div className="ov-bar-chart">
        {slots.map(m => (
          <div key={m.ym} className={`ov-bar-row${m.isCurrent ? ' ov-bar-row--current' : ''}`}>
            <span className="ov-bar-lbl">{m.label}</span>
            <div className={`ov-bar-track${stacked ? ' ov-bar-track--stacked' : ''}`}>
              {stacked
                ? data.agents.map((agent, i) => {
                    const cash = (data.byAgent[agent] || {})[m.ym] || 0
                    if (cash === 0) return null
                    const pct = ((Math.abs(cash) / max) * 100).toFixed(1)
                    return (
                      <div
                        key={agent || '__none'}
                        className={`ov-bar-fill agent-c${i % AGENT_COLOR_COUNT}`}
                        style={{ width: `${pct}%` }}
                        title={`${t('oversite.debtAgent')} ${agent || '—'}: ${fmt(cash)}`}
                      />
                    )
                  })
                : m.cash !== 0 && (
                    <div
                      className={`ov-bar-fill ${m.isCurrent ? 'grn' : 'receipt'}`}
                      style={{ width: `${((Math.abs(m.cash) / max) * 100).toFixed(1)}%` }}
                    />
                  )}
            </div>
            <span className="ov-bar-val">{fmt(m.cash)}</span>
          </div>
        ))}
        <div className="ov-bar-row ov-bar-row--receipt-avg">
          <span className="ov-bar-lbl">{t('sm.cube.yearNetSalesAvg')}</span>
          <div className="ov-bar-track">
            <div
              className="ov-bar-fill receipt-avg"
              style={{ width: `${((Math.abs(avg) / max) * 100).toFixed(1)}%` }}
            />
          </div>
          <span className="ov-bar-val">{fmt(avg)}</span>
        </div>
      </div>
      <div className="ov-receipts-total">
        {t('sm.cube.yearNetSalesTotal', { year: String(data.year) })}: <b>{fmt(data.total)}</b>
        {' · '}
        {t('sm.cube.yearNetSalesHint')}
      </div>
    </div>
  )
}
