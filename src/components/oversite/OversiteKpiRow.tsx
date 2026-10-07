import type { ReactNode } from 'react'
import { useLocale } from '../../context/LocaleContext'
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
  sourceFile,
}: {
  title: string
  children: ReactNode
  /** Optional per-segment data-freshness line (super-admin only). */
  updatedAt?: string
  /** Optional raw source-file reference, shown as a hover tooltip (super-admin only). */
  sourceFile?: string
}) {
  return (
    <section className="ov-section" title={sourceFile ? `📁 ${sourceFile}` : undefined}>
      <h3 className="ov-section-title">
        {title}
        {sourceFile ? <span className="ov-section-file-icon"> 📁</span> : null}
      </h3>
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
  openOrdersCash = 0,
  lyCash,
  lyChangeCashPct,
  forecastCash = null,
  forecastLbl,
  forecastTitle,
  withOpenOrdersLbl,
}: {
  monthLbl: string
  lyMonthLbl: string
  cash: number
  deliveryCash?: number
  /** Report 721 — undelivered open orders, stacked as pipeline on top of billed + shipped. */
  openOrdersCash?: number
  lyCash: number
  lyChangeCashPct: number | null
  /** Projected month-end total from the historical intra-month pattern. */
  forecastCash?: number | null
  forecastLbl?: string
  forecastTitle?: string
  withOpenOrdersLbl?: string
}) {
  // Headline total stays invoices + delivery notes so the last-year delta keeps
  // comparing like with like; open orders are pipeline, shown as a second sum.
  const totalCash = cash + deliveryCash
  const totalWithOpenCash = totalCash + openOrdersCash
  const barMax = Math.max(totalWithOpenCash, lyCash, forecastCash ?? 0, 1)
  const { t } = useLocale()
  const sharePct = (v: number) => (totalWithOpenCash > 0 ? ` · ${((v / totalWithOpenCash) * 100).toFixed(1)}%` : '')
  const tipInvoiced = `${t('oversite.invoiced')}: ${fmt(cash)}${sharePct(cash)}`
  const tipDelivery = `${t('oversite.deliveryNotes')}: ${fmt(deliveryCash)}${sharePct(deliveryCash)}`
  const tipOpen = `${t('oversite.openOrders')}: ${fmt(openOrdersCash)}${sharePct(openOrdersCash)}`
  const tipTotal = `${monthLbl}: ${fmt(totalCash)}`
  const stacked = deliveryCash > 0 || openOrdersCash > 0
  const salesPct = (cash / barMax) * 100
  const deliveryPct = (deliveryCash / barMax) * 100
  const openOrdersPct = (openOrdersCash / barMax) * 100
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
        <div
          className={`ov-bar-track${stacked ? ' ov-bar-track--stacked' : ''}`}
          title={stacked ? undefined : tipTotal}
        >
          {salesPct > 0 && (
            <div className="ov-bar-fill grn" style={{ width: `${salesPct.toFixed(1)}%` }} title={tipInvoiced} />
          )}
          {deliveryPct > 0 && (
            <div className="ov-bar-fill delivery" style={{ width: `${deliveryPct.toFixed(1)}%` }} title={tipDelivery} />
          )}
          {openOrdersPct > 0 && (
            <div
              className="ov-bar-fill openorders"
              style={{ width: `${openOrdersPct.toFixed(1)}%` }}
              title={tipOpen}
            />
          )}
        </div>
        <span className="ov-bar-val">{fmt(totalCash)}</span>
        {delta}
      </div>
      {stacked && (
        <div className="ov-bar-legend" aria-label={t('oversite.barLegend')}>
          <span title={tipInvoiced}><i className="ov-bar-dot grn" />{t('oversite.invoiced')} <b>{fmt(cash)}</b></span>
          {deliveryCash > 0 && (
            <span title={tipDelivery}><i className="ov-bar-dot delivery" />{t('oversite.deliveryNotes')} <b>{fmt(deliveryCash)}</b></span>
          )}
          {openOrdersCash > 0 && (
            <span title={tipOpen}><i className="ov-bar-dot openorders" />{t('oversite.openOrders')} <b>{fmt(openOrdersCash)}</b></span>
          )}
        </div>
      )}
      {openOrdersCash > 0 && (
        <div className="ov-bar-total">
          <span className="ov-bar-total-lbl">{withOpenOrdersLbl}</span>
          <span className="ov-bar-total-val">{fmt(totalWithOpenCash)}</span>
        </div>
      )}
      {forecastCash != null && forecastCash > 0 && (
        <div className="ov-bar-row ov-bar-row--forecast" title={forecastTitle}>
          <span className="ov-bar-lbl">{forecastLbl || 'Projected'}</span>
          <div className="ov-bar-track">
            <div
              className="ov-bar-fill forecast"
              style={{ width: `${((forecastCash / barMax) * 100).toFixed(1)}%` }}
              title={`${forecastLbl || 'Projected'}: ${fmt(forecastCash)}`}
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
        <div className={`ov-bar-fill ${fillClass}`} style={{ width: `${widthPct.toFixed(1)}%` }} title={`${label}: ${value}`} />
      </div>
      <span className="ov-bar-val">{value}</span>
      {suffix}
    </div>
  )
}
