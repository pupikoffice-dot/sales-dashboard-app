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

interface MonthEntry {
  ym: string
  label: string
  net: number
  isCurrent: boolean
}

/**
 * Receipts (008 collection report) — rolling 12 months of collected cash,
 * net of VAT, as a horizontal bar list with the current month highlighted.
 * Rendered only when data is present (the aux RPC returns receipts to
 * super-admins only).
 */
export function OversiteReceipts({ monthly }: { monthly: Record<string, number> | undefined }) {
  const { t } = useLocale()
  if (!monthly || Object.keys(monthly).length === 0) return null

  const now = new Date()
  const months: MonthEntry[] = []
  for (let i = MONTHS_SHOWN - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({
      ym,
      label: `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      net: (monthly[ym] || 0) / VAT_RATE,
      isCurrent: i === 0,
    })
  }

  const max = Math.max(...months.map(m => m.net), 1)
  const total = months.reduce((s, m) => s + m.net, 0)
  const avg = total / months.length

  return (
    <div className="ov-receipts">
      <div className="ov-bar-chart">
        {months.map(m => (
          <div key={m.ym} className={`ov-bar-row${m.isCurrent ? ' ov-bar-row--current' : ''}`}>
            <span className="ov-bar-lbl">{m.label}</span>
            <div className="ov-bar-track">
              <div
                className={`ov-bar-fill ${m.isCurrent ? 'receipt-cur' : 'receipt'}`}
                style={{ width: `${((m.net / max) * 100).toFixed(1)}%` }}
              />
            </div>
            <span className="ov-bar-val">{fmt(m.net)}</span>
          </div>
        ))}
        <div className="ov-bar-row ov-bar-row--receipt-avg">
          <span className="ov-bar-lbl">{t('oversite.receiptsAvg')}</span>
          <div className="ov-bar-track">
            <div
              className="ov-bar-fill receipt-avg"
              style={{ width: `${((avg / max) * 100).toFixed(1)}%` }}
            />
          </div>
          <span className="ov-bar-val">{fmt(avg)}</span>
        </div>
      </div>
      <div className="ov-receipts-total">
        {t('oversite.receiptsTotal12')}: <b>{fmt(total)}</b> · {t('oversite.receiptsAvg')}:{' '}
        <b>{fmt(avg)}</b> · {t('oversite.receiptsNetNote')}
      </div>
    </div>
  )
}
