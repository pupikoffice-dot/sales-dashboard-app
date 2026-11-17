import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useLocale } from '../../context/LocaleContext'
import { fmt } from '../../lib/format'
import { fetchMonthlyMargin } from '../../lib/grossMarginApi'
import { computeMarginMeters, computePeriodMeters, withGrow, type MarginMonth, type PeriodMeter } from '../../lib/periodMeters'
import type { SalesRow } from '../../types/dashboard'

/** Meters: this year vs last year, this quarter vs the same quarter last year; sales and (when allowed) gross margin. */
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
  const measured = useMemo(() => withGrow(companies), [companies])
  const key = measured.join(',')
  const inclGrow = measured.includes('grow') && !companies.includes('grow')
  const m = useMemo(
    () => computePeriodMeters(rows, new Set(key ? key.split(',') : []), todayStr),
    [rows, key, todayStr],
  )
  // Gross margin per month (the database returns null for users who may not see item costs: no margin meters then).
  const marginQs = useQueries({
    queries: (key ? key.split(',') : []).map(co => ({
      queryKey: ['monthly-margin', co, null],
      queryFn: () => fetchMonthlyMargin(co, null),
      staleTime: 10 * 60 * 1000,
    })),
  })
  const marginMonths = useMemo<MarginMonth[] | null>(() => {
    // Grow is an add-on to Pupik: if the user may not see its margin it is simply left out, the others still show.
    const needed = marginQs.filter((_, i) => !(inclGrow && measured[i] === 'grow'))
    if (!needed.length || needed.some(q => !q.data)) return null
    return marginQs.flatMap(q => q.data?.months ?? [])
  }, [marginQs, measured, inclGrow])
  const gm = useMemo(() => (marginMonths ? computeMarginMeters(marginMonths, todayStr) : null), [marginMonths, todayStr])
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
      {inclGrow ? <p className="pm-note">{t('pm.inclGrow')}</p> : null}
      {gm ? (
        <>
          <Meter
            title={t('pm.gmYear', { year: String(gm.curYear) })}
            goalLbl={t('pm.goalYear', { year: String(gm.curYear - 1) })}
            meter={gm.year}
          />
          <Meter
            title={t('pm.gmQuarter', { q: String(gm.quarterNo), year: String(gm.curYear) })}
            goalLbl={t('pm.goalQuarter', { q: String(gm.quarterNo), year: String(gm.curYear - 1) })}
            meter={gm.quarter}
          />
        </>
      ) : null}
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
