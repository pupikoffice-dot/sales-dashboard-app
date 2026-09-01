import { useLocale } from '../../context/LocaleContext'
import { fmt } from '../../lib/format'

/** Receipts amounts arrive gross (column H of the 008 report, incl. 18% VAT). */
const VAT_RATE = 1.18
const MONTHS_SHOWN = 12

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Field-team agents whose receipts get their own confined chart. */
export const RECEIPTS_TEAM_AGENTS: Record<string, string[]> = {
  pupik: ['24', '25', '27'],
  mt: ['54', '55', '56', '57'],
}

/** Distinct color per agent position (CSS classes agent-c0..c5). */
const AGENT_COLOR_COUNT = 6

function rollingMonths(count = MONTHS_SHOWN): Array<{ ym: string; label: string; isCurrent: boolean }> {
  const now = new Date()
  const out = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({
      ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      isCurrent: i === 0,
    })
  }
  return out
}

/**
 * Receipts (008 collection report) — rolling 12 months of collected cash,
 * net of VAT, current month highlighted. With `byAgent`+`agents`, each month
 * bar is stacked per agent (distinct colors, legend on top) so agents can be
 * compared. Rendered only when data is present (the aux RPC returns receipts
 * to super-admins only).
 */
export function OversiteReceipts({
  monthly,
  byAgent,
  agents,
  currentMonthOnly = false,
}: {
  monthly: Record<string, number> | undefined
  /** Per-agent monthly gross maps — enables the stacked per-agent view. */
  byAgent?: Record<string, Record<string, number>>
  agents?: string[]
  /** Sales Agent suite: one bar for the current month only. */
  currentMonthOnly?: boolean
}) {
  const { t } = useLocale()
  if (!monthly || Object.keys(monthly).length === 0) return null

  const netForYm = (ym: string) => (monthly[ym] || 0) / VAT_RATE
  const avgMonths = rollingMonths(MONTHS_SHOWN)
  const displayMonths = rollingMonths(currentMonthOnly ? 1 : MONTHS_SHOWN).map(m => ({
    ...m,
    net: netForYm(m.ym),
  }))
  const monthlyAvg =
    avgMonths.reduce((s, m) => s + netForYm(m.ym), 0) / MONTHS_SHOWN
  const displayTotal = displayMonths.reduce((s, m) => s + m.net, 0)
  const max = Math.max(...displayMonths.map(m => m.net), monthlyAvg, 1)

  const stacked = !!byAgent && !!agents && agents.length > 0 && !currentMonthOnly

  // Per-agent 12-month totals + monthly averages for legend
  const agentTotals = stacked
    ? agents!.map(a => {
        const total = avgMonths.reduce(
          (s, m) => s + ((byAgent![a] || {})[m.ym] || 0) / VAT_RATE,
          0,
        )
        return { agent: a, total, avg: total / MONTHS_SHOWN }
      })
    : []

  return (
    <div className="ov-receipts">
      {stacked && (
        <div className="ov-receipts-legend">
          {agentTotals.map((at, i) => (
            <span key={at.agent} className="ov-receipts-legend-item">
              <span className={`ov-receipts-swatch agent-c${i % AGENT_COLOR_COUNT}`} />
              {t('oversite.debtAgent')} {at.agent}: <b>{fmt(at.total)}</b>
              <span className="ov-receipts-legend-avg">
                ({t('oversite.receiptsAvg')} {fmt(at.avg)})
              </span>
            </span>
          ))}
        </div>
      )}
      <div className="ov-bar-chart">
        {displayMonths.map(m => (
          <div key={m.ym}>
            <div className={`ov-bar-row${m.isCurrent ? ' ov-bar-row--current' : ''}`}>
              <span className="ov-bar-lbl">{m.label}</span>
              <div className="ov-bar-track ov-bar-track--stacked">
                {stacked
                  ? agents!.map((a, i) => {
                      const net = ((byAgent![a] || {})[m.ym] || 0) / VAT_RATE
                      if (net <= 0) return null
                      const pct = ((net / max) * 100).toFixed(1)
                      const showLabel = Number(pct) > 13 // amount fits only in wider segments
                      return (
                        <div
                          key={a}
                          className={`ov-bar-fill agent-c${i % AGENT_COLOR_COUNT}`}
                          style={{ width: `${pct}%` }}
                          title={`${t('oversite.debtAgent')} ${a}: ${fmt(net)}`}
                        >
                          {showLabel && <span className="ov-bar-label">{fmt(net)}</span>}
                        </div>
                      )
                    })
                  : m.net > 0 && (
                      <div
                        className={`ov-bar-fill ${m.isCurrent ? 'receipt-cur' : 'receipt'}`}
                        style={{ width: `${((m.net / max) * 100).toFixed(1)}%` }}
                      />
                    )}
              </div>
              <span className="ov-bar-val">{fmt(m.net)}</span>
            </div>
            {stacked && (
              <div className="ov-receipts-agents-line">
                {agents!.map((a, i) => {
                  const net = ((byAgent![a] || {})[m.ym] || 0) / VAT_RATE
                  if (net <= 0) return null
                  return (
                    <span key={a} className={`ov-receipts-agent-num agent-t${i % AGENT_COLOR_COUNT}`}>
                      {a}: {fmt(net)}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        ))}
        <div className="ov-bar-row ov-bar-row--receipt-avg">
          <span className="ov-bar-lbl">{t('oversite.receiptsAvg')}</span>
          <div className="ov-bar-track">
            <div
              className="ov-bar-fill receipt-avg"
              style={{ width: `${((monthlyAvg / max) * 100).toFixed(1)}%` }}
            />
          </div>
          <span className="ov-bar-val">{fmt(monthlyAvg)}</span>
        </div>
      </div>
      <div className="ov-receipts-total">
        {currentMonthOnly ? (
          <>
            {displayMonths[0]?.label}: <b>{fmt(displayTotal)}</b> · {t('oversite.receiptsAvg')}:{' '}
            <b>{fmt(monthlyAvg)}</b> · {t('oversite.receiptsNetNote')}
          </>
        ) : (
          <>
            {t('oversite.receiptsTotal12')}: <b>{fmt(displayTotal)}</b> · {t('oversite.receiptsAvg')}:{' '}
            <b>{fmt(monthlyAvg)}</b> · {t('oversite.receiptsNetNote')}
          </>
        )}
      </div>
    </div>
  )
}

/** Sum the given agents' monthly maps into one 'YYYY-MM' -> gross map. */
export function sumAgentMonthly(
  byAgent: Record<string, Record<string, number>> | undefined,
  agents: string[],
): Record<string, number> {
  const out: Record<string, number> = {}
  if (!byAgent) return out
  for (const agent of agents) {
    const months = byAgent[agent]
    if (!months) continue
    for (const [ym, v] of Object.entries(months)) {
      out[ym] = (out[ym] || 0) + (Number(v) || 0)
    }
  }
  return out
}
