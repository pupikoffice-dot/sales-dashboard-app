import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ChartConfiguration } from 'chart.js'
import { HubChart, cssVar } from '../oversite/hub/HubChart'
import { Kpi, useDebounced } from './PurchaseSearch'
import { SortTh, useSortedRows } from './sortRows'
import { downloadCSV } from '../../lib/csvExport'
import { fmt0 } from '../../lib/format'
import {
  fetchClientItemSales,
  itemSalesCsv,
  pricePoints,
  queryReady,
  summarizeItemSales,
  MIN_QUERY_LENGTH,
  type ItemSalesLine,
} from '../../lib/clientItemSales'

const price = (v: number | null) => (v == null ? '—' : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const MAX_SERIES = 6

/** Client card section "Search sales": the lines one client bought for an item, with the price paid over time. */
export function ClientItemSales({ company, clientId, asUser }: { company: string; clientId: string; asUser: string | null }) {
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const q = useDebounced(query.trim())
  const ready = queryReady(q)

  const res = useQuery({
    queryKey: ['client-item-sales', company, clientId, q, from, to, asUser],
    queryFn: () => fetchClientItemSales(company, clientId, q, from || null, to || null, asUser),
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  })
  const rows = useMemo(() => res.data?.rows ?? [], [res.data])
  const summary = useMemo(() => summarizeItemSales(rows), [rows])
  const isChain = clientId.startsWith('chain:')

  const { sorted, sort, onSort } = useSortedRows<ItemSalesLine>(
    rows,
    {
      date: r => r.date,
      doc: r => r.docNum,
      type: r => r.docType,
      sku: r => r.sku,
      name: r => r.name,
      client: r => r.clientID,
      qty: r => r.qty,
      price: r => r.price,
      cash: r => r.cash,
      discount: r => r.discountPct ?? r.discountCash,
    },
    { key: 'date', dir: 'desc' },
    ['sku', 'name', 'doc', 'type', 'client'],
  )

  const chart = useMemo<ChartConfiguration | null>(() => {
    const pts = pricePoints(rows)
    if (pts.length < 2) return null
    const bySku = new Map<string, Map<string, { sum: number; n: number }>>()
    for (const r of rows) {
      if (r.isReturn || r.price == null || r.price <= 0 || !r.date) continue
      const m = bySku.get(r.sku) ?? new Map()
      const cur = m.get(r.date) ?? { sum: 0, n: 0 }
      cur.sum += r.price
      cur.n += 1
      m.set(r.date, cur)
      bySku.set(r.sku, m)
    }
    const skus = [...bySku.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, MAX_SERIES)
    const dates = [...new Set(pts.map(p => p.date))]
    const muted = cssVar('--muted')
    const grid = cssVar('--bdr-s', '#2d3449')
    return {
      type: 'line',
      data: {
        labels: dates,
        datasets: skus.map(([sku, byDate], i) => ({
          label: sku,
          data: dates.map(d => {
            const c = byDate.get(d)
            return c ? Math.round((c.sum / c.n) * 100) / 100 : null
          }),
          borderColor: cssVar(`--chart-c${i}`),
          backgroundColor: cssVar(`--chart-c${i}`),
          borderWidth: 2,
          pointRadius: 3,
          spanGaps: true,
          tension: 0,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: skus.length > 1, labels: { color: muted } } },
        scales: {
          x: { ticks: { color: muted, maxRotation: 0, autoSkipPadding: 24 }, grid: { display: false } },
          y: { ticks: { color: muted }, grid: { color: grid } },
        },
      },
    }
  }, [rows])

  const cut = res.data ? res.data.total - rows.length : 0
  const skuCount = useMemo(() => new Set(rows.map(r => r.sku)).size, [rows])

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input
          className="sbar-search"
          type="text"
          value={query}
          placeholder="🔍 SKU or part of the item name…"
          aria-label="Search this client's sales by SKU or item name"
          onChange={e => setQuery(e.target.value)}
          style={{ minWidth: 240, flex: '1 1 240px' }}
        />
        <label className="sbar-search" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          From
          <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className="sbar-search" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          To
          <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
        </label>
        {from || to ? (
          <button type="button" className="chip" onClick={() => { setFrom(''); setTo('') }}>
            All dates
          </button>
        ) : null}
      </div>

      {!ready ? (
        <p className="status-msg">Type at least {MIN_QUERY_LENGTH} characters of a SKU or item name to see what this client paid. Without dates, every year you can see is searched.</p>
      ) : res.isLoading ? (
        <p className="status-msg">Searching…</p>
      ) : res.error ? (
        <p className="status-msg error">{(res.error as Error).message}</p>
      ) : !rows.length ? (
        <p className="status-msg">This client has no sales lines matching “{q}”{from || to ? ' in these dates' : ''}.</p>
      ) : (
        <>
          <div className="hub-grid" style={{ marginBottom: 12 }}>
            <Kpi label="Pieces sold" value={fmt0(summary.qty)} note={`${summary.lines} lines${skuCount > 1 ? ` · ${skuCount} items` : ''}`} />
            <Kpi
              label="Total amount"
              value={fmt0(summary.amount)}
              note={summary.creditAmount > 0 ? `credits not included: ${fmt0(summary.creditAmount)} (${fmt0(summary.creditQty)} pcs)` : undefined}
              hint="Invoiced lines only. Credit invoice lines (document 14) are listed in the table but kept out of these figures."
            />
            <Kpi
              label="Average price paid"
              value={price(summary.avgPrice)}
              note={`min ${price(summary.minPrice)} · max ${price(summary.maxPrice)}`}
              hint="Total amount divided by pieces. Min and max are the lowest and highest unit price on a single line."
            />
            <Kpi
              label="Invoices"
              value={fmt0(summary.invoices)}
              note={summary.firstDate ? `${summary.firstDate} → ${summary.lastDate}` : undefined}
              hint="First and last purchase date"
            />
          </div>
          {skuCount > 1 ? <p className="sel-months-list" style={{ margin: '0 0 8px' }}>The search matches {skuCount} different items, so the figures above add them together.</p> : null}
          {cut > 0 ? (
            <p className="status-msg">Showing the newest {fmt0(rows.length)} of {fmt0(res.data!.total)} lines. Narrow the search or the dates to see the rest.</p>
          ) : null}

          {chart ? (
            <section className="hub-card" style={{ marginBottom: 12 }}>
              <div className="hub-card-hdr"><h3>Unit price paid over time</h3></div>
              <HubChart config={chart} height={200} label="Unit price paid over time" minWidth={480} />
            </section>
          ) : null}

          <div className="dl-bar">
            <button type="button" className="dl-btn" onClick={() => downloadCSV(itemSalesCsv(sorted), `sales_${clientId.replace(/\W+/g, '_')}_${q.replace(/\W+/g, '_')}.csv`)}>
              📥 Export CSV
            </button>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <SortTh label="Date" k="date" left sort={sort} onSort={onSort} />
                  <SortTh label="Document" k="doc" left sort={sort} onSort={onSort} />
                  <SortTh label="Type" k="type" left sort={sort} onSort={onSort} />
                  {isChain ? <SortTh label="Store" k="client" left sort={sort} onSort={onSort} /> : null}
                  <SortTh label="SKU" k="sku" left sort={sort} onSort={onSort} />
                  <SortTh label="Item" k="name" left sort={sort} onSort={onSort} />
                  <SortTh label="Qty" k="qty" sort={sort} onSort={onSort} />
                  <SortTh label="Unit price" k="price" sort={sort} onSort={onSort} />
                  <SortTh label="Line total" k="cash" sort={sort} onSort={onSort} />
                  <SortTh label="Discount" k="discount" sort={sort} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={`${r.docType}/${r.docNum}/${r.sku}/${i}`} style={r.isReturn ? { opacity: 0.75 } : undefined}>
                    <td style={{ textAlign: 'left' }}>{r.date}</td>
                    <td style={{ textAlign: 'left' }}>{r.docNum || '—'}</td>
                    <td style={{ textAlign: 'left' }} title={r.isReturn ? 'Credit invoice (return)' : undefined}>
                      {r.docType || '—'}{r.isReturn ? ' · credit' : ''}
                    </td>
                    {isChain ? <td style={{ textAlign: 'left' }}>{r.clientID}</td> : null}
                    <td style={{ textAlign: 'left' }}>
                      <Link to={`/rnd/item?co=${company}&sku=${encodeURIComponent(r.sku)}`}>{r.sku}</Link>
                    </td>
                    <td style={{ textAlign: 'left' }} title={r.name}>{r.name}</td>
                    <td>{fmt0(r.qty)}</td>
                    <td>{price(r.price)}</td>
                    <td>{fmt0(r.cash)}</td>
                    <td>
                      {r.discountPct != null && r.discountPct !== 0
                        ? `${r.discountPct.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
                        : r.discountCash != null && r.discountCash !== 0
                          ? fmt0(r.discountCash)
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
