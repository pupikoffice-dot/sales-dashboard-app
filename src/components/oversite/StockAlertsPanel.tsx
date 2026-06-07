import { useState } from 'react'
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
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-[0.68rem] font-bold uppercase tracking-widest text-slate-500">
        📦 Stock Alerts{' '}
        <span
          className={`ml-1 rounded-full px-2 py-0.5 text-[0.67rem] text-white ${
            alertCount === 0 ? 'bg-slate-400' : 'bg-red-500'
          }`}
        >
          {alertCount}
        </span>
      </h3>
      <div className="mb-2 flex flex-wrap gap-1">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setTab(i)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              tab === i
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs[tab].content}
    </section>
  )
}

function SlowMoversTab({ alerts }: { alerts: StockAlertsResult }) {
  if (!alerts.slowMovers.length && !alerts.neverSold.length) {
    return <p className="text-sm italic text-slate-500">All stocked items sold in the last 30 days.</p>
  }
  return (
    <div className="space-y-4">
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
        <div>
          <p className="mb-2 text-xs font-bold text-slate-500">Never Sold (stock ≥10, top 10 by qty)</p>
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
    return <p className="text-sm italic text-slate-500">No at-risk client-item patterns detected.</p>
  }
  return (
    <div>
      <p className="mb-2 text-xs text-slate-500">
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
    return <p className="text-sm italic text-slate-500">No significant velocity drops detected (≥50% decline).</p>
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
            {headers.map(h => (
              <th key={h} className="py-2 pr-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100">
              {row.map((cell, j) => {
                const isLast = highlightLast && j === row.length - 1
                const isDrop = highlightDrop && j === 4
                return (
                  <td
                    key={j}
                    className={`py-1.5 pr-2 ${j === 1 ? 'text-xs text-slate-500' : ''} ${
                      isLast || isDrop ? 'font-bold text-amber-600' : ''
                    } ${isLast && cell.startsWith('+') ? 'text-red-600' : ''}`}
                    title={j === 0 ? row[1] : undefined}
                  >
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
