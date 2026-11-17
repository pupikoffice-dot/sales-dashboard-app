import { useMemo, type CSSProperties } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useLocale } from '../../context/LocaleContext'
import { fmt } from '../../lib/format'
import { fetchMonthlyMargin } from '../../lib/grossMarginApi'
import {
  computeMarginMeters,
  computePeriodMeters,
  withGrow,
  type MarginMonth,
  type PeriodMeter,
  type PeriodMeters as PeriodMetersData,
} from '../../lib/periodMeters'
import type { SalesRow } from '../../types/dashboard'

const CO_NAME: Record<string, string> = { pupik: 'Pupik', mt: 'Monkeytime', gold: 'Goldbug', grow: 'Grow' }

type Pick = 'year' | 'quarter'

/** The same meter measured on the base companies and on Grow alone, so the bar can show both. */
interface Split {
  base: PeriodMeter
  grow: PeriodMeter
  baseLbl: string
  growLbl: string
}

/**
 * Meters: this year vs last year, this quarter vs the same quarter last year; sales and (when allowed) gross margin.
 * Where Grow is counted with Pupik, the bar is drawn in two colours (Pupik part, Grow part) with both numbers and the sum.
 */
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
  const baseCos = useMemo(() => measured.filter(c => c !== 'grow'), [measured])
  const baseLbl = baseCos.map(c => CO_NAME[c] ?? c).join(' + ')

  const m = useMemo(
    () => computePeriodMeters(rows, new Set(key ? key.split(',') : []), todayStr),
    [rows, key, todayStr],
  )
  const salesBase = useMemo(
    () => (inclGrow ? computePeriodMeters(rows, new Set(baseCos), todayStr) : null),
    [rows, baseCos, inclGrow, todayStr],
  )
  const salesGrow = useMemo(
    () => (inclGrow ? computePeriodMeters(rows, new Set(['grow']), todayStr) : null),
    [rows, inclGrow, todayStr],
  )

  // Gross margin per month (the database returns null for users who may not see item costs: no margin meters then).
  const marginQs = useQueries({
    queries: measured.map(co => ({
      queryKey: ['monthly-margin', co, null],
      queryFn: () => fetchMonthlyMargin(co, null),
      staleTime: 10 * 60 * 1000,
    })),
  })
  const marginParts = useMemo(() => {
    // Grow is an add-on to Pupik: if the user may not see its margin it is simply left out, the others still show.
    const base: MarginMonth[] = []
    const grow: MarginMonth[] = []
    let growOk = false
    for (let i = 0; i < measured.length; i++) {
      const data = marginQs[i]?.data
      if (measured[i] === 'grow' && inclGrow) {
        if (data) {
          grow.push(...data.months)
          growOk = true
        }
        continue
      }
      if (!data) return null
      base.push(...data.months)
    }
    return base.length ? { base, grow, growOk } : null
  }, [marginQs, measured, inclGrow])
  const gm = useMemo(
    () => (marginParts ? computeMarginMeters([...marginParts.base, ...marginParts.grow], todayStr) : null),
    [marginParts, todayStr],
  )
  const splitOk = !!marginParts && inclGrow && marginParts.growOk
  const gmBase = useMemo(
    () => (splitOk && marginParts ? computeMarginMeters(marginParts.base, todayStr) : null),
    [splitOk, marginParts, todayStr],
  )
  const gmGrow = useMemo(
    () => (splitOk && marginParts ? computeMarginMeters(marginParts.grow, todayStr) : null),
    [splitOk, marginParts, todayStr],
  )
  if (!companies.length) return null

  const card = (
    d: PeriodMetersData,
    pick: Pick,
    title: string,
    b: PeriodMetersData | null,
    g: PeriodMetersData | null,
  ) => (
    <Meter
      title={title}
      goalLbl={
        pick === 'year'
          ? t('pm.goalYear', { year: String(d.curYear - 1) })
          : t('pm.goalQuarter', { q: String(d.quarterNo), year: String(d.curYear - 1) })
      }
      doneYear={d.curYear}
      goalYear={d.curYear - 1}
      meter={d[pick]}
      split={b && g ? { base: b[pick], grow: g[pick], baseLbl, growLbl: CO_NAME.grow } : undefined}
    />
  )

  return (
    <div className="pm-wrap">
    <section className="pm" aria-label={t('pm.aria')}>
      {card(m, 'year', t('pm.year', { year: String(m.curYear) }), salesBase, salesGrow)}
      {card(m, 'quarter', t('pm.quarter', { q: String(m.quarterNo), year: String(m.curYear) }), salesBase, salesGrow)}
      {gm ? (
        <>
          {card(gm, 'year', t('pm.gmYear', { year: String(gm.curYear) }), gmBase, gmGrow)}
          {card(gm, 'quarter', t('pm.gmQuarter', { q: String(gm.quarterNo), year: String(gm.curYear) }), gmBase, gmGrow)}
        </>
      ) : null}
    </section>
    {inclGrow ? <p className="pm-note">{t('pm.inclGrow')}</p> : null}
    </div>
  )
}

function Meter({
  title,
  goalLbl,
  doneYear,
  goalYear,
  meter,
  split,
}: {
  title: string
  goalLbl: string
  doneYear: number
  goalYear: number
  meter: PeriodMeter
  split?: Split
}) {
  const { t } = useLocale()
  const { pct, pacePct, gap, done, goal, lyToDate } = meter
  const reached = pct != null && pct >= 100
  const fill = pct == null ? 0 : Math.min(100, pct)
  const pace = pacePct == null ? null : Math.min(100, pacePct)
  const ahead = done >= lyToDate
  const tone = reached ? 'done' : ahead ? 'ahead' : 'behind'

  // Two-colour bar: the filled part is split by what each sold this year, the track by what each sold last year.
  const doneSum = split ? Math.max(0, split.base.done) + Math.max(0, split.grow.done) : 0
  const baseFill = split && doneSum > 0 ? (fill * Math.max(0, split.base.done)) / doneSum : fill
  const growFill = split && doneSum > 0 ? fill - baseFill : 0
  const goalSum = split ? Math.max(0, split.base.goal) + Math.max(0, split.grow.goal) : 0
  const baseGoalShare = split && goalSum > 0 ? (Math.max(0, split.base.goal) / goalSum) * 100 : 50

  return (
    <div className={`pm-card pm-${tone}`}>
      <div className="pm-top">
        <span className="pm-title">{title}</span>
        <span className="pm-pct">{pct == null ? '—' : `${pct.toFixed(1)}%`}</span>
      </div>
      <div
        className={`pm-bar${split ? ' pm-bar--split' : ''}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill)}
        title={t('pm.paceTitle', { amount: fmt(lyToDate) })}
        style={split ? ({ ['--pm-split' as string]: `${baseGoalShare}%` } as CSSProperties) : undefined}
      >
        {split ? (
          <>
            <div className="pm-fill pm-fill--base" style={{ width: `${baseFill}%` }} />
            <div className="pm-fill pm-fill--grow" style={{ width: `${growFill}%`, insetInlineStart: `${baseFill}%` }} />
          </>
        ) : (
          <div className="pm-fill" style={{ width: `${fill}%` }} />
        )}
        {pace != null ? <div className="pm-pace" style={{ insetInlineStart: `${pace}%` }} /> : null}
      </div>
      {split ? (
        <div className="pm-parts">
          <div>
            <b>{doneYear}</b> <i className="pm-dot pm-dot--base" />
            {split.baseLbl} {fmt(split.base.done)} + <i className="pm-dot pm-dot--grow" />
            {split.growLbl} {fmt(split.grow.done)} = <b>{fmt(done)}</b>
          </div>
          <div>
            <b>{goalYear}</b> <i className="pm-dot pm-dot--base" />
            {split.baseLbl} {fmt(split.base.goal)} + <i className="pm-dot pm-dot--grow" />
            {split.growLbl} {fmt(split.grow.goal)} = <b>{fmt(goal)}</b>
          </div>
        </div>
      ) : null}
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
