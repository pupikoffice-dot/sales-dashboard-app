import { useMemo } from 'react'
import { useLocale } from '../../context/LocaleContext'
import { fmt } from '../../lib/format'
import { computePeriodMeters, type PeriodMeter } from '../../lib/periodMeters'
import type { SalesRow } from '../../types/dashboard'

/** Header meters: this year vs last year, this quarter vs the same quarter last year. */
export function PeriodMeters({
  rows,
  companies,
  todayStr,
}: {
  rows: SalesRow[]
  companies: readonly string[]
  todayStr: string
}) {
  const { t } = useLocale()
  const key = companies.join(',')
  const m = useMemo(
    () => computePeriodMeters(rows, new Set(key ? key.split(',') : []), todayStr),
    [rows, key, todayStr],
  )
  if (!companies.length) return null

  return (
    <section className="pm" aria-label={t('pm.aria')}>
      <Meter
        title={t('pm.year', { year: String(m.curYear) })}
        goalLbl={t('pm.goalYear', { year: String(m.curYear - 1) })}
        meter={m.year}
      />
      <Meter
        title={t('pm.quarter', { q: String(m.quarterNo), year: String(m.curYear) })}
        goalLbl={t('pm.goalQuarter', { q: String(m.quarterNo), year: String(m.curYear - 1) })}
        meter={m.quarter}
      />
    </section>
  )
}

function Meter({ title, goalLbl, meter }: { title: string; goalLbl: string; meter: PeriodMeter }) {
  const { t } = useLocale()
  const { pct, pacePct, gap, done, goal, lyToDate } = meter
  const reached = pct != null && pct >= 100
  const fill = pct == null ? 0 : Math.min(100, pct)
  const pace = pacePct == null ? null : Math.min(100, pacePct)
  const ahead = done >= lyToDate
  const tone = reached ? 'done' : ahead ? 'ahead' : 'behind'

  return (
    <div className={`pm-card pm-${tone}`}>
      <div className="pm-top">
        <span className="pm-title">{title}</span>
        <span className="pm-pct">{pct == null ? '—' : `${pct.toFixed(1)}%`}</span>
      </div>
      <div
        className="pm-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill)}
        title={t('pm.paceTitle', { amount: fmt(lyToDate) })}
      >
        <div className="pm-fill" style={{ width: `${fill}%` }} />
        {pace != null ? <div className="pm-pace" style={{ insetInlineStart: `${pace}%` }} /> : null}
      </div>
      <div className="pm-foot">
        <span>
          {fmt(done)} / {goalLbl} {fmt(goal)}
        </span>
        <b className={gap > 0 ? 'pm-gap' : 'pm-gap pm-gap--over'}>
          {gap > 0 ? t('pm.missing', { amount: fmt(gap) }) : t('pm.over', { amount: fmt(-gap) })}
        </b>
      </div>
    </div>
  )
}
