import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SortableTh } from './SortableTh'
import { SalesReportUiProvider, useSalesReportUi } from '../../context/SalesReportUiContext'
import { fmt0 } from '../../lib/format'
import { companyLabel } from '../../lib/salesMetrics'
import { fetchStockHistory, filterStockHistory, isoDay, stockHistoryTotals } from '../../lib/stockHistory'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { SalesReportStickySetup } from './SalesReportStickySetup'
import { TableWithExport } from './TableWithExport'
import type { LogicalCompany } from '../../types/dashboard'

/** Companies that have a warehouse stock file, and so a stock history. */
const STOCK_COMPANIES: LogicalCompany[] = ['pupik', 'mt']

function StockHistoryContent({ initialCompany }: { initialCompany: LogicalCompany | null }) {
  const { searchQuery, setSearchQuery } = useSalesReportUi()
  const { access } = useDashboardAccess()
  const companies = useMemo(() => STOCK_COMPANIES.filter(c => access?.companies.includes(c)), [access?.companies])
  const [picked, setPicked] = useState<string | null>(initialCompany)
  const company =
    companies.length === 1 ? companies[0] : picked && companies.includes(picked as LogicalCompany) ? picked : companies[0]

  const yesterday = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return isoDay(d)
  }, [])
  const [from, setFrom] = useState(yesterday)
  const [to, setTo] = useState(yesterday)

  const q = useQuery({
    queryKey: ['stock-history', company, from, to],
    queryFn: () => fetchStockHistory(company as string, from, to),
    enabled: !!company && !!from && !!to && to >= from,
    staleTime: 5 * 60 * 1000,
  })
  const visible = useMemo(() => filterStockHistory(q.data?.rows ?? [], searchQuery), [q.data, searchQuery])
  const totals = useMemo(() => stockHistoryTotals(visible), [visible])
  const multiDay = from !== to
  const hasEstimate = visible.some(r => r.est)

  if (!company) return <div className="err">No stock history for your companies.</div>

  return (
    <div>
      <div className="sbar">
        <span>
          View: <b>Stock history</b>
        </span>
        <span>
          Items: <b className="accent2">{fmt0(new Set(visible.map(r => r.sku)).size)}</b>
        </span>
        <span title={multiDay ? 'Pieces at the start of the first day' : 'Pieces at the start of the day'}>
          Opening: <b className="accent2">{fmt0(totals.open)}</b>
        </span>
        <span title={multiDay ? 'Pieces at the end of the last day' : 'Pieces at the end of the day'}>
          Closing: <b className="accent2">{fmt0(totals.close)}</b>
        </span>
        <div className="sbar-actions">
          {companies.length > 1 ? (
            <select className="sbar-search" value={company} onChange={e => setPicked(e.target.value)} aria-label="Company">
              {companies.map(c => (
                <option key={c} value={c}>
                  {companyLabel(c)}
                </option>
              ))}
            </select>
          ) : (
            <b>{companyLabel(company as LogicalCompany)}</b>
          )}
          <label className="sbar-search" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            From
            <input type="date" value={from} min={q.data?.first ?? undefined} max={to} onChange={e => setFrom(e.target.value)} />
          </label>
          <label className="sbar-search" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            To
            <input type="date" value={to} min={from} max={isoDay(new Date())} onChange={e => setTo(e.target.value)} />
          </label>
          <input
            className="sbar-search"
            type="text"
            placeholder="🔍 Search SKU or name…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {q.isLoading ? (
        <div className="welcome">
          <div className="spin-wrap">
            <div className="spin" />
          </div>
          <p>Loading stock history…</p>
        </div>
      ) : q.error ? (
        <div className="err">Could not load the stock history: {(q.error as Error).message}</div>
      ) : !visible.length ? (
        <div className="err">
          No stock recorded for these days
          {q.data?.first ? ` (history runs from ${q.data.first} to ${q.data.last}).` : '.'}
        </div>
      ) : (
        <>
          {hasEstimate ? (
            <p className="sel-months-list" style={{ margin: '6px 0' }}>
              Days marked “rebuilt” are worked out from purchases and sales before the first real reading (13 Oct 2026), so they
              can be a few pieces off. Other days are the real warehouse readings.
            </p>
          ) : null}
          <TableWithExport exportName={`Stock history ${from}${multiDay ? `_${to}` : ''}`}>
            <div className="tw tw-sticky">
              <table>
                <thead>
                  <tr>
                    {multiDay && <SortableTh style={{ textAlign: 'left' }}>Day</SortableTh>}
                    <SortableTh style={{ textAlign: 'left' }}>SKU</SortableTh>
                    <SortableTh style={{ textAlign: 'left' }}>Item Name</SortableTh>
                    <SortableTh>Opening</SortableTh>
                    <SortableTh className="accent2">Closing</SortableTh>
                    <SortableTh>Change</SortableTh>
                    <SortableTh style={{ textAlign: 'left' }}>Source</SortableTh>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(r => {
                    const change = r.open != null ? r.close - r.open : null
                    return (
                      <tr key={`${r.day}|${r.sku}`}>
                        {multiDay && <td>{r.day}</td>}
                        <td>{r.sku}</td>
                        <td title={r.name}>{r.name}</td>
                        <td data-sv={r.open ?? ''}>{r.open != null ? fmt0(r.open) : '—'}</td>
                        <td data-sv={r.close} className="accent2">
                          {fmt0(r.close)}
                        </td>
                        <td data-sv={change ?? ''}>{change != null ? `${change > 0 ? '+' : ''}${fmt0(change)}` : '—'}</td>
                        <td>{r.est ? 'rebuilt' : 'reading'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </TableWithExport>
        </>
      )}
    </div>
  )
}

export function StockHistoryView(props: { initialCompany: LogicalCompany | null }) {
  return (
    <SalesReportUiProvider>
      <div id="sales-report">
        <SalesReportStickySetup />
        <StockHistoryContent {...props} />
      </div>
    </SalesReportUiProvider>
  )
}
