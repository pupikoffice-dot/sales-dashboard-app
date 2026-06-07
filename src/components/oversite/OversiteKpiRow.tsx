import type { ReactNode } from 'react'
import { fmt } from '../../lib/format'

interface Kpi {
  label: string
  value: string
  valueClass?: string
}

export function OversiteKpiRow({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {kpis.map(k => (
        <div
          key={k.label}
          className="flex-1 min-w-[78px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center"
        >
          <div className={`text-lg font-bold ${k.valueClass ?? 'text-slate-900'}`}>{k.value}</div>
          <div className="mt-0.5 text-[0.67rem] uppercase tracking-wide text-slate-500">{k.label}</div>
        </div>
      ))}
    </div>
  )
}

export function OversiteSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-[0.68rem] font-bold uppercase tracking-widest text-slate-500">{title}</h3>
      {children}
    </section>
  )
}

export function SalesLyBars({
  monthLbl,
  lyMonthLbl,
  cash,
  lyCash,
  lyChangeCashPct,
}: {
  monthLbl: string
  lyMonthLbl: string
  cash: number
  lyCash: number
  lyChangeCashPct: number | null
}) {
  const barMax = Math.max(cash, lyCash, 1)
  const curPct = (cash / barMax) * 100
  const lyPct = (lyCash / barMax) * 100
  const delta =
    lyChangeCashPct != null ? (
      <span className={`text-xs font-semibold ${lyChangeCashPct >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
        {lyChangeCashPct >= 0 ? '▲' : '▼'}
        {Math.abs(lyChangeCashPct).toFixed(1)}%
      </span>
    ) : null

  return (
    <div className="mt-3 space-y-2">
      <BarRow label={monthLbl} value={fmt(cash)} widthPct={curPct} fillClass="bg-emerald-500" suffix={delta} />
      <BarRow label={lyMonthLbl} value={fmt(lyCash)} widthPct={lyPct} fillClass="bg-slate-400" />
    </div>
  )
}

function BarRow({
  label,
  value,
  widthPct,
  fillClass,
  suffix,
}: {
  label: string
  value: string
  widthPct: number
  fillClass: string
  suffix?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 shrink-0 text-xs text-slate-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
        <div className={`h-full rounded ${fillClass}`} style={{ width: `${widthPct.toFixed(1)}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right font-semibold tabular-nums">{value}</span>
      {suffix}
    </div>
  )
}
