import { useState, type CSSProperties } from 'react'
import { fmt, fmtDateIso } from '../../lib/format'
import type { StockAlertsResult } from '../../lib/stockAlerts'

export function StockAlertsPanel({ alerts }: { alerts: StockAlertsResult }) {
  const [tab, setTab] = useState(0)
  const smCount = alerts.slowMovers.length + alerts.neverSold.length
  const alertCount = smCount + alerts.clientAlerts.length + alerts.velocityDrops.length

  const tabs = [
    { label: `Slow Movers (${smCount})`, content: <SlowMoversTab alerts={alerts} /> },
    { label: `Client Alerts (${alerts.clientAlerts.length})`, content: <ClientAlertsTab alerts={alerts} /> },
    { label: `Velocity Drop (${alerts.velocityDrops.length})`, content: <VelocityTab alerts={alerts} /> },
  ]

  return (
    <section className="ov-section">
      <h3 className="ov-section-title">
        📦 Stock Alerts{' '}
        <span className={`ov-badge${alertCount === 0 ? ' ov-badge-zero' : ''}`}>{alertCount}</span>
      </h3>
      <div className="ov-tab-btns">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            className={`ov-tab-btn${tab === i ? ' active' : ''}`}
            onClick={() => setTab(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="ov-tab-panel">{tabs[tab].content}</div>
    </section>
  )
}

function SlowMoversTab({ alerts }: { alerts: StockAlertsResult }) {
  if (!alerts.slowMovers.length && !alerts.neverSold.length) {
    return <p className="ov-empty">All stocked items sold in the last 30 days.</p>
  }
  return (
    <div>
      {alerts.slowMovers.length > 0 && (
        <AlertTable
          headers={['Item', 'SKU', 'Stock', 'Last Sale', 'Days']}
          rows={alerts.slowMovers.map(r => [
            r.name,
            r.sku,
            fmt(r.qty),
            r.lastDate ? fmtDateIso(r.lastDate) : '—',
            r.daysGap === 9999 ? '—' : String(r.daysGap),
          ])}
          highlightLast
        />
      )}
      {alerts.neverSold.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>
            Never Sold (stock ≥10, top 10 by qty)
          </p>
          <AlertTable
            headers={['Item', 'SKU', 'Stock']}
            rows={alerts.neverSold.map(r => [r.name, r.sku, fmt(r.qty)])}
          />
        </div>
      )}
    </div>
  )
}

function ClientAlertsTab({ alerts }: { alerts: StockAlertsResult }) {
  if (!alerts.clientAlerts.length) {
    return <p className="ov-empty">No at-risk client-item patterns detected.</p>
  }
  return (
    <div>
      <p style={{ fontSize: '0.71rem', color: 'var(--muted)', marginBottom: 8 }}>
        {alerts.clientAlerts.length} at-risk pairs (showing top 20) — dynamic interval method
      </p>
      <AlertTable
        headers={['Client', 'Item', 'Agent', 'Last Buy', 'Avg Days', 'Overdue']}
        rows={alerts.clientAlerts.map(r => [
          r.clientName,
          r.skuName,
          r.agent,
          fmtDateIso(r.lastDate),
          `${r.avgInt}d`,
          `+${r.daysOverdue}d`,
        ])}
        highlightLast
      />
    </div>
  )
}

function VelocityTab({ alerts }: { alerts: StockAlertsResult }) {
  if (!alerts.velocityDrops.length) {
    return <p className="ov-empty">No significant velocity drops detected (≥50% decline).</p>
  }
  return (
    <AlertTable
      headers={['Item', 'Stock', 'Base/Mo', 'Last 30d', 'Drop%', 'Category']}
      rows={alerts.velocityDrops.map(r => [
        r.name,
        fmt(r.qty),
        String(r.baseAvg),
        String(r.recent),
        `${r.dropPct}%`,
        r.cat,
      ])}
      highlightDrop
    />
  )
}

function AlertTable({
  headers,
  rows,
  highlightLast,
  highlightDrop,
}: {
  headers: string[]
  rows: string[][]
  highlightLast?: boolean
  highlightDrop?: boolean
}) {
  return (
    <div className="tw">
      <table>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => {
                const isLast = highlightLast && j === row.length - 1
                const isDrop = highlightDrop && j === 4
                const style: CSSProperties = {}
                if (j === 1) style.fontSize = '0.71rem'
                if (isLast || isDrop) {
                  style.fontWeight = 700
                  style.color = isLast && cell.startsWith('+') ? 'var(--amber)' : 'var(--amber)'
                }
                return (
                  <td key={j} style={style} title={j === 0 ? row[1] : undefined}>
                    {cell}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
