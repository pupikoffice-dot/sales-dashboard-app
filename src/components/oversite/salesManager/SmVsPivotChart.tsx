import { useLocale } from '../../../context/LocaleContext'
import { fmt } from '../../../lib/format'

const AGENT_COLOR_COUNT = 6

export interface SmVsPivotBar {
  agentId: string
  value: number
  /** Optional second value (e.g. goal) drawn as a marker on the column. */
  marker?: number | null
  /** Short caption under the value (e.g. % of goal). */
  caption?: string
}

function agentColorIdx(agentId: string): number {
  const n = Number(String(agentId).trim())
  return Number.isFinite(n) ? Math.floor(Math.abs(n)) % AGENT_COLOR_COUNT : 0
}

/**
 * One chart: agents as side-by-side columns so who is ahead is obvious.
 */
export function SmVsPivotChart({
  bars,
  emptyLabel,
  ariaLabel,
}: {
  bars: SmVsPivotBar[]
  emptyLabel: string
  ariaLabel: string
}) {
  const { t } = useLocale()
  if (bars.length === 0) {
    return <p className="ov-empty">{emptyLabel}</p>
  }

  const PLOT_H = 120
  const max = Math.max(...bars.map(b => Math.max(Math.abs(b.value), Math.abs(b.marker ?? 0))), 1)

  return (
    <div className="sm-vs-pivot" role="img" aria-label={ariaLabel}>
      <div className="sm-vs-pivot-legend">
        {bars.map(b => {
          const c = agentColorIdx(b.agentId)
          return (
            <span key={b.agentId} className="sm-vs-pivot-legend-item">
              <span className={`ov-receipts-swatch agent-c${c}`} />
              {t('oversite.debtAgent')} {b.agentId}
            </span>
          )
        })}
      </div>
      <div className="sm-vs-pivot-chart">
        {bars.map(b => {
          const c = agentColorIdx(b.agentId)
          const pct = Math.abs(b.value) / max
          const barPx = b.value === 0 ? 0 : Math.max(Math.round(pct * PLOT_H), 4)
          const markerPct =
            b.marker != null && b.marker > 0 ? Math.min(100, (b.marker / max) * 100) : null
          return (
            <div key={b.agentId} className="sm-vs-pivot-col">
              <div className="sm-vs-pivot-val" title={fmt(b.value)}>
                {fmt(b.value)}
              </div>
              {b.caption ? <div className="sm-vs-pivot-cap">{b.caption}</div> : null}
              <div className="sm-vs-pivot-plot" style={{ height: PLOT_H }}>
                {markerPct != null ? (
                  <span
                    className="sm-vs-pivot-goal"
                    style={{ bottom: `${markerPct}%` }}
                    title={fmt(b.marker!)}
                  />
                ) : null}
                <div
                  className={`sm-vs-pivot-bar agent-c${c}${b.value < 0 ? ' sm-vs-pivot-bar--neg' : ''}`}
                  style={{ height: barPx }}
                />
              </div>
              <div className={`sm-vs-pivot-lbl agent-t${c}`}>{b.agentId}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
