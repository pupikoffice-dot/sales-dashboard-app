import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ChartConfiguration } from 'chart.js'
import { HubChart, cssVar } from '../oversite/hub/HubChart'
import { Kpi, useDebounced } from './PurchaseSearch'
import { SortTh, useSortedRows } from './sortRows'
import { downloadCSV } from '../../lib/csvExport'
import { useLocale } from '../../context/LocaleContext'
import { fmt0 } from '../../lib/format'
import { fmtPct } from '../../lib/grossMargin'
import {
  fetchClientItemSales,
  itemSalesCsv,
  itemSalesLineMargin,
  itemSalesLineMarginPct,
  pricePoints,
  queryReady,
  summarizeItemSales,
  MIN_QUERY_LENGTH,
  type ItemSalesLine,
} from '../../lib/clientItemSales'
import { DateField } from '../DateField'
import { fmtDate } from '../../lib/dates'

const price = (v: number | null) => (v == null ? '—' : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const MAX_SERIES = 6

/** Client card section "Search sales": the lines one client bought for an item, with the price paid over time. */
export function ClientItemSales({ company, clientId, asUser }: { company: string; clientId: string; asUser: string | null }) {
  const { t } = useLocale()
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
  // Margin columns only when the database says the user may see item costs.
  const showM = !!res.data?.margin
  const costedLines = useMemo(() => rows.filter(r => !r.isReturn && r.unitCost != null).length, [rows])
  const soldLines = useMemo(() => rows.filter(r => !r.isReturn).length, [rows])
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
      margin: r => itemSalesLineMargin(r),
      marginPct: r => itemSalesLineMarginPct(r),
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
      if (r.isReturn || r.qty <= 0 || r.price == null || r.price <= 0 || !r.date) continue
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
        labels: dates.map(d => fmtDate(d)),
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
          placeholder={t('pc.cis.placeholder')}
          aria-label={t('pc.cis.aria')}
          onChange={e => setQuery(e.target.value)}
          style={{ minWidth: 240, flex: '1 1 240px' }}
        />
        <label className="sbar-search" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {t('pc.cis.from')}
          <DateField value={from} max={to || undefined} onChange={setFrom} />
        </label>
        <label className="sbar-search" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {t('pc.cis.to')}
          <DateField value={to} min={from || undefined} onChange={setTo} />
        </label>
        {from || to ? (
          <button type="button" className="chip" onClick={() => { setFrom(''); setTo('') }}>
            {t('pc.cis.allDates')}
          </button>
        ) : null}
      </div>

      {!ready ? (
        <p className="status-msg">{t('pc.cis.typeMore', { n: MIN_QUERY_LENGTH })}</p>
      ) : res.isLoading ? (
        <p className="status-msg">{t('pc.searching')}</p>
      ) : res.error ? (
        <p className="status-msg error">{(res.error as Error).message}</p>
      ) : !rows.length ? (
        <p className="status-msg">{t('pc.cis.noLines', { q, dates: from || to ? t('pc.cis.inDates') : '' })}</p>
      ) : (
        <>
          <div className="hub-grid" style={{ marginBottom: 12 }}>
            <Kpi label={t('pc.cis.piecesSold')} value={fmt0(summary.qty)} note={t('pc.cis.linesNote', { lines: summary.lines, items: skuCount > 1 ? t('pc.cis.itemsNote', { n: skuCount }) : '' })} />
            <Kpi
              label={t('pc.cis.totalAmount')}
              value={fmt0(summary.amount)}
              note={summary.creditAmount > 0 ? t('pc.cis.creditNote', { amount: fmt0(summary.creditAmount), qty: fmt0(summary.creditQty) }) : undefined}
              hint={t('pc.cis.totalHint')}
            />
            <Kpi
              label={t('pc.cis.avgPrice')}
              value={price(summary.avgPrice)}
              note={t('pc.cis.minMax', { min: price(summary.minPrice), max: price(summary.maxPrice) })}
              hint={t('pc.cis.avgHint')}
            />
            {showM ? (
              <Kpi
                label={t('gm.sales.kpi')}
                value={summary.margin.margin == null ? '—' : fmt0(summary.margin.margin)}
                note={summary.margin.margin == null ? t('gm.coverageNone') : t('gm.sales.kpiNote', { pct: fmtPct(summary.margin.pct), n: costedLines, total: soldLines })}
                hint={t('gm.hint')}
              />
            ) : null}
            <Kpi
              label={t('pc.cis.invoices')}
              value={fmt0(summary.invoices)}
              note={summary.firstDate ? `${fmtDate(summary.firstDate)} → ${fmtDate(summary.lastDate)}` : undefined}
              hint={t('pc.cis.firstLast')}
            />
          </div>
          {skuCount > 1 ? <p className="sel-months-list" style={{ margin: '0 0 8px' }}>{t('pc.cis.matchesMany', { n: skuCount })}</p> : null}
          {cut > 0 ? (
            <p className="status-msg">{t('pc.cis.showingNewest', { n: fmt0(rows.length), total: fmt0(res.data!.total) })}</p>
          ) : null}

          {chart ? (
            <section className="hub-card" style={{ marginBottom: 12 }}>
              <div className="hub-card-hdr"><h3>{t('pc.cis.priceOverTime')}</h3></div>
              <HubChart config={chart} height={200} label={t('pc.cis.priceOverTime')} minWidth={480} />
            </section>
          ) : null}

          <div className="dl-bar">
            <button type="button" className="dl-btn" onClick={() => downloadCSV(itemSalesCsv(sorted, showM), `sales_${clientId.replace(/\W+/g, '_')}_${q.replace(/\W+/g, '_')}.csv`)}>
              {t('pc.cis.exportCsv')}
            </button>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <SortTh label={t('pc.col.date')} k="date" left sort={sort} onSort={onSort} />
                  <SortTh label={t('pc.col.document')} k="doc" left sort={sort} onSort={onSort} />
                  <SortTh label={t('pc.col.type')} k="type" left sort={sort} onSort={onSort} />
                  {isChain ? <SortTh label={t('pc.col.store')} k="client" left sort={sort} onSort={onSort} /> : null}
                  <SortTh label={t('pc.cis.sku')} k="sku" left sort={sort} onSort={onSort} />
                  <SortTh label={t('pc.col.item')} k="name" left sort={sort} onSort={onSort} />
                  <SortTh label={t('pc.cis.qty')} k="qty" sort={sort} onSort={onSort} />
                  <SortTh label={t('pc.cis.unitPrice')} k="price" sort={sort} onSort={onSort} />
                  <SortTh label={t('pc.cis.lineTotal')} k="cash" sort={sort} onSort={onSort} />
                  {showM ? <SortTh label={t('gm.sales.lineMargin')} k="margin" sort={sort} onSort={onSort} title={t('gm.hint')} /> : null}
                  {showM ? <SortTh label={t('gm.col.marginPct')} k="marginPct" sort={sort} onSort={onSort} title={t('gm.hint')} /> : null}
                  <SortTh label={t('pc.cis.discount')} k="discount" sort={sort} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={`${r.docType}/${r.docNum}/${r.sku}/${i}`} style={r.isReturn ? { opacity: 0.75 } : undefined}>
                    <td style={{ textAlign: 'left' }}>{fmtDate(r.date)}</td>
                    <td style={{ textAlign: 'left' }}>{r.docNum || '—'}</td>
                    <td style={{ textAlign: 'left' }} title={r.isReturn ? t('pc.cis.returnTitle') : undefined}>
                      {r.docType || '—'}{r.isReturn ? t('pc.cis.returnWord') : ''}
                    </td>
                    {isChain ? <td style={{ textAlign: 'left' }}>{r.clientID}</td> : null}
                    <td style={{ textAlign: 'left' }}>
                      <Link to={`/rnd/item?co=${company}&sku=${encodeURIComponent(r.sku)}`}>{r.sku}</Link>
                    </td>
                    <td style={{ textAlign: 'left' }} title={r.name}>{r.name}</td>
                    <td>{fmt0(r.qty)}</td>
                    <td>{price(r.price)}</td>
                    <td>{fmt0(r.cash)}</td>
                    {showM ? <td>{itemSalesLineMargin(r) == null ? '—' : fmt0(itemSalesLineMargin(r) as number)}</td> : null}
                    {showM ? <td>{fmtPct(itemSalesLineMarginPct(r))}</td> : null}
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
