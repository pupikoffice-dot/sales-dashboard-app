import { useLocale } from '../../../context/LocaleContext'
import { fmt, fmtCompact, MONTH_NAMES } from '../../../lib/format'
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

/** Jan–current-month sales from report 891 (already net when summed). Vertical columns. */
export function SmYearNetSalesChart({ data }: { data: SmYearNetSales }) {
  const { t } = useLocale()
  const slots = monthSlots(data.year, data.throughMonth).map(s => ({
    ...s,
    cash: data.monthly[s.ym] || 0,
  }))
  const shown = Math.max(data.throughMonth, 1)
  const avg = data.total / shown
  const max = Math.max(...slots.map(s => Math.abs(s.cash)), 1)
  const stacked = data.agents.length > 1
  const aria = t('sm.cube.yearNetSales', { year: String(data.year) })

  return (
    <div className="sm-year-sales">
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
      <div className="sm-year-chart" role="img" aria-label={aria}>
        {slots.map(m => {
          const absCash = Math.abs(m.cash)
          const stackPct = Math.max((absCash / max) * 100, absCash > 0 ? 6 : 0)
          return (
            <div key={m.ym} className={`sm-year-col${m.isCurrent ? ' sm-year-col--current' : ''}`}>
              <div className="sm-year-val" title={fmt(m.cash)}>
                {m.cash !== 0 ? fmtCompact(m.cash) : '—'}
              </div>
              <div className="sm-year-plot">
                <div
                  className={`sm-year-stack${m.cash < 0 ? ' sm-year-stack--neg' : ''}`}
                  style={{ height: `${stackPct}%` }}
                >
                  {stacked
                    ? data.agents.map((agent, i) => {
                        const cash = (data.byAgent[agent] || {})[m.ym] || 0
                        if (cash === 0) return null
                        const pctOfMonth = absCash > 0 ? (Math.abs(cash) / absCash) * 100 : 0
                        return (
                          <div
                            key={agent || '__none'}
                            className={`sm-year-seg agent-c${i % AGENT_COLOR_COUNT}`}
                            style={{ flexGrow: pctOfMonth, flexBasis: 0 }}
                            title={`${t('oversite.debtAgent')} ${agent || '—'}: ${fmt(cash)}`}
                          />
                        )
                      })
                    : m.cash !== 0
                      ? (
                          <div
                            className={`sm-year-seg ${m.isCurrent ? 'grn' : 'receipt'}`}
                            title={fmt(m.cash)}
                          />
                        )
                      : null}
                </div>
              </div>
              <div className="sm-year-lbl">{m.label}</div>
            </div>
          )
        })}
      </div>
      <div className="ov-receipts-total">
        {t('sm.cube.yearNetSalesTotal', { year: String(data.year) })}: <b>{fmt(data.total)}</b>
        {' · '}
        {t('sm.cube.yearNetSalesAvg')}: <b>{fmt(avg)}</b>
        {' · '}
        {t('sm.cube.yearNetSalesHint')}
      </div>
    </div>
  )
}
