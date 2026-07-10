import type { ReactNode } from 'react'
import { fmt } from '../../lib/format'

interface Kpi {
  label: string
  value: string
  tone?: 'default' | 'grn' | 'amber'
}

export function OversiteKpiRow({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="ov-kpi-row">
      {kpis.map(k => (
        <div key={k.label} className="ov-kpi">
          <div className={`ov-kpi-val${k.tone && k.tone !== 'default' ? ` ${k.tone}` : ''}`}>{k.value}</div>
          <div className="ov-kpi-lbl">{k.label}</div>
        </div>
      ))}
    </div>
  )
}

export function OversiteSection({
  title,
  children,
  updatedAt,
}: {
  title: string
  children: ReactNode
  /** Optional per-segment data-freshness line (super-admin only). */
  updatedAt?: string
}) {
  return (
    <section className="ov-section">
      <h3 className="ov-section-title">{title}</h3>
      {updatedAt ? <div className="ov-section-synced">{updatedAt}</div> : null}
      {children}
    </section>
  )
}

export function SalesLyBars({
  monthLbl,
  lyMonthLbl,
  cash,
  deliveryCash = 0,
  lyCash,
  lyChangeCashPct,
  forecastCash = null,
  forecastLbl,
  forecastTitle,
}: {
  monthLbl: string
  lyMonthLbl: string
  cash: number
  deliveryCash?: number
  lyCash: number
  lyChangeCashPct: number | null
  /** Projected month-end total from the historical intra-month pattern. */
  forecastCash?: number | null
  forecastLbl?: string
  forecastTitle?: string
}) {
  const totalCash = cash + deliveryCash
  const barMax = Math.max(totalCash, lyCash, forecastCash ?? 0, 1)
  const salesPct = (cash / barMax) * 100
  const deliveryPct = (deliveryCash / barMax) * 100
  const lyPct = (lyCash / barMax) * 100
  const delta =
    lyChangeCashPct != null ? (
      <span className={`ov-bar-delta ${lyChangeCashPct >= 0 ? 'up' : 'down'}`}>
        {lyChangeCashPct >= 0 ? '▲' : '▼'}
        {Math.abs(lyChangeCashPct).toFixed(1)}%
      </span>
    ) : null

  return (
    <div className="ov-bar-chart">
      <div className="ov-bar-row">
        <span className="ov-bar-lbl">{monthLbl}</span>
        <div className={`ov-bar-track${deliveryCash > 0 ? ' ov-bar-track--stacked' : ''}`}>
          {salesPct > 0 && (
            <div className="ov-bar-fill grn" style={{ width: `${salesPct.toFixed(1)}%` }} />
          )}
          {deliveryPct > 0 && (
            <div className="ov-bar-fill delivery" style={{ width: `${deliveryPct.toFixed(1)}%` }} />
          )}
        </div>
        <span className="ov-bar-val">{fmt(totalCash)}</span>
        {delta}
      </div>
      {forecastCash != null && forecastCash > 0 && (
        <div className="ov-bar-row ov-bar-row--forecast" title={forecastTitle}>
          <span className="ov-bar-lbl">{forecastLbl || 'Projected'}</span>
          <div className="ov-bar-track">
            <div
              className="ov-bar-fill forecast"
              style={{ width: `${((forecastCash / barMax) * 100).toFixed(1)}%` }}
            />
          </div>
          <span className="ov-bar-val">{fmt(forecastCash)}</span>
          {lyCash > 0 && (
            <span className={`ov-bar-delta ${forecastCash >= lyCash ? 'up' : 'down'}`}>
              {forecastCash >= lyCash ? '▲' : '▼'}
              {Math.abs(((forecastCash - lyCash) / lyCash) * 100).toFixed(1)}%
            </span>
          )}
        </div>
      )}
      <BarRow label={lyMonthLbl} value={fmt(lyCash)} widthPct={lyPct} fillClass="muted" />
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
  fillClass: 'grn' | 'muted' | 'delivery'
  suffix?: ReactNode
}) {
  return (
    <div className="ov-bar-row">
      <span className="ov-bar-lbl">{label}</span>
      <div className="ov-bar-track">
        <div className={`ov-bar-fill ${fillClass}`} style={{ width: `${widthPct.toFixed(1)}%` }} />
      </div>
      <span className="ov-bar-val">{value}</span>
      {suffix}
    </div>
  )
}
