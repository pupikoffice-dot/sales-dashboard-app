import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SortableTh } from './SortableTh'
import { SalesReportUiProvider, useSalesReportUi } from '../../context/SalesReportUiContext'
import { fmt0, fmt2 } from '../../lib/format'
import { companyLabel } from '../../lib/salesMetrics'
import {
  fetchItemIndex,
  fetchUncategorizedStock,
  filterItemIndex,
  filterUncategorizedStock,
  maskItemIndexForPreview,
} from '../../lib/itemIndex'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { usePreview } from '../../context/PreviewContext'
import { SalesReportStickySetup } from './SalesReportStickySetup'
import { TableWithExport } from './TableWithExport'
import type { LogicalCompany } from '../../types/dashboard'

interface ItemsIndexViewProps {
  /** Company chosen in the sidebar (the page opens on it); the user can switch to others or "All". */
  initialCompany: LogicalCompany | null
}

function ItemsIndexContent({ initialCompany }: ItemsIndexViewProps) {
  const { searchQuery, setSearchQuery } = useSalesReportUi()
  const raw = useQuery({ queryKey: ['item-index'], queryFn: fetchItemIndex, staleTime: 30 * 60 * 1000 })
  const { access } = useDashboardAccess()
  const { isPreviewing, effectiveIsSuperAdmin } = usePreview()
  // "View as user": the fetch used the admin's session, so cut it down to the previewed user's access.
  const data = useMemo(
    () => (raw.data && isPreviewing && !effectiveIsSuperAdmin && access ? maskItemIndexForPreview(raw.data, access) : raw.data),
    [raw.data, isPreviewing, effectiveIsSuperAdmin, access],
  )
  const q = { isLoading: raw.isLoading, error: raw.error, data }
  const [company, setCompany] = useState<LogicalCompany | 'all'>(initialCompany ?? 'all')
  const [mode, setMode] = useState<'index' | 'nocat'>('index')

  // In stock but no category (REP103 column I). Reloaded every 10 min: the 103 export now runs twice a day.
  const nocatRaw = useQuery({ queryKey: ['uncategorized-stock'], queryFn: fetchUncategorizedStock, staleTime: 10 * 60 * 1000 })
  const nocat = useMemo(() => {
    const rows = nocatRaw.data ?? []
    if (isPreviewing && !effectiveIsSuperAdmin && access) {
      const co = new Set<string>(access.companies)
      return rows.filter(r => co.has(r.co))
    }
    return rows
  }, [nocatRaw.data, isPreviewing, effectiveIsSuperAdmin, access])
  const nocatVisible = useMemo(
    () => filterUncategorizedStock(nocat, company, searchQuery),
    [nocat, company, searchQuery],
  )

  const companies = useMemo(
    () => [...new Set((q.data?.rows ?? []).map(r => r.co))].sort(),
    [q.data],
  )
  const visible = useMemo(
    () => filterItemIndex(q.data?.rows ?? [], company, searchQuery),
    [q.data, company, searchQuery],
  )

  if (mode === 'nocat') {
    const cos = [...new Set(nocat.map(r => r.co))].sort()
    return (
      <div>
        <div className="sbar">
          <span>
            View: <b>In stock, no category</b>
          </span>
          <span>
            Items: <b className="accent2">{fmt0(nocatVisible.length)}</b>
          </span>
          <span>
            WMS Qty: <b className="accent2">{fmt0(nocatVisible.reduce((s, r) => s + r.wms, 0))}</b>
          </span>
          <div className="sbar-actions">
            <button type="button" className="sbar-search" onClick={() => setMode('index')}>
              ← Items index
            </button>
            <select
              className="sbar-search"
              value={company}
              onChange={e => setCompany(e.target.value as LogicalCompany | 'all')}
              aria-label="Company"
            >
              <option value="all">All companies</option>
              {cos.map(c => (
                <option key={c} value={c}>
                  {companyLabel(c)}
                </option>
              ))}
            </select>
            <input
              className="sbar-search"
              type="text"
              placeholder="🔍 Search SKU, name…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        {nocatRaw.isLoading ? (
          <div className="welcome">
            <div className="spin-wrap">
              <div className="spin" />
            </div>
          </div>
        ) : nocatRaw.error ? (
          <div className="err">Could not load the list: {(nocatRaw.error as Error).message}</div>
        ) : !nocatVisible.length ? (
          <div className="err">Every item in stock has a category.</div>
        ) : (
          // One table (and one CSV) per company: an item can have a category in one company and none in another.
          [...new Set(nocatVisible.map(r => r.co))].sort().map(co => {
            const rows = nocatVisible.filter(r => r.co === co)
            return (
          <div key={co}>
            <h3 style={{ margin: '14px 0 6px' }}>
              {companyLabel(co)} — {fmt0(rows.length)} item{rows.length === 1 ? '' : 's'} in stock without a category
            </h3>
          <TableWithExport exportName={`In stock without category - ${companyLabel(co)}`}>
            <div className="tw tw-sticky">
              <table>
                <thead>
                  <tr>
                    <SortableTh style={{ textAlign: 'left' }}>SKU</SortableTh>
                    <SortableTh style={{ textAlign: 'left' }}>Item Name</SortableTh>
                    <SortableTh style={{ textAlign: 'left' }}>Why</SortableTh>
                    <SortableTh>Wholesale P01</SortableTh>
                    <SortableTh className="accent2">WMS Stock</SortableTh>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={`${r.co}|${r.sku}`}>
                      <td>{r.sku}</td>
                      <td title={r.name}>{r.name}</td>
                      <td>{r.why === 'empty' ? 'Column I empty' : 'Not in the 103 export'}</td>
                      <td data-sv={r.p01 ?? ''}>{r.p01 != null ? fmt2(r.p01) : '—'}</td>
                      <td data-sv={r.wms} className="accent2">
                        {fmt0(r.wms)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableWithExport>
          </div>
            )
          })
        )}
      </div>
    )
  }

  if (q.isLoading) {
    return (
      <div className="welcome">
        <div className="spin-wrap">
          <div className="spin" />
        </div>
        <p>Loading items…</p>
      </div>
    )
  }
  if (q.error) return <div className="err">Could not load the items index: {(q.error as Error).message}</div>
  if (!q.data?.rows.length) return <div className="err">No items in the index for your companies.</div>

  const { showCost, showFob } = q.data
  const showCo = company === 'all'
  const totalWms = visible.reduce((s, r) => s + (r.wms ?? 0), 0)

  return (
    <div>
      <div className="sbar">
        <span>
          View: <b>Items index</b>
        </span>
        <span>
          Items: <b className="accent2">{fmt0(visible.length)}</b>
        </span>
        <span>
          WMS Qty: <b className="accent2">{fmt0(totalWms)}</b>
        </span>
        <div className="sbar-actions">
          <button type="button" className="sbar-search" onClick={() => setMode('nocat')}>
            In stock, no category
            {nocatRaw.data
              ? ` (${[...new Set(nocat.map(r => r.co))].sort().map(c => `${companyLabel(c)} ${fmt0(nocat.filter(r => r.co === c).length)}`).join(' · ')})`
              : ''}
          </button>
          <select
            className="sbar-search"
            value={company}
            onChange={e => setCompany(e.target.value as LogicalCompany | 'all')}
            aria-label="Company"
          >
            <option value="all">All companies</option>
            {companies.map(c => (
              <option key={c} value={c}>
                {companyLabel(c)}
              </option>
            ))}
          </select>
          <input
            className="sbar-search"
            type="text"
            placeholder="🔍 Search SKU, name, alt no., barcode…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {!visible.length ? (
        <div className="err">No items match.</div>
      ) : (
        <TableWithExport exportName="Items index">
          <div className="tw tw-sticky">
            <table>
              <thead>
                <tr>
                  {showCo && <SortableTh style={{ textAlign: 'left' }}>Company</SortableTh>}
                  <SortableTh style={{ textAlign: 'left' }}>SKU</SortableTh>
                  <SortableTh style={{ textAlign: 'left' }}>Item Name</SortableTh>
                  <SortableTh style={{ textAlign: 'left' }}>Alt. No.</SortableTh>
                  <SortableTh style={{ textAlign: 'left' }}>Barcode</SortableTh>
                  <SortableTh style={{ textAlign: 'left' }}>Category (103 I)</SortableTh>
                  <SortableTh>Wholesale P01</SortableTh>
                  {showCost && <SortableTh>Landed Cost</SortableTh>}
                  {showFob && <SortableTh>FOB</SortableTh>}
                  <SortableTh className="accent2">WMS Stock</SortableTh>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={`${r.co}|${r.sku}`}>
                    {showCo && <td>{companyLabel(r.co)}</td>}
                    <td>{r.sku}</td>
                    <td title={r.name}>{r.name}</td>
                    <td>{r.alt ?? ''}</td>
                    <td>{r.bc ?? ''}</td>
                    <td>{r.cat ?? ''}</td>
                    <td data-sv={r.p01 ?? ''}>{r.p01 != null ? fmt2(r.p01) : '—'}</td>
                    {showCost && <td data-sv={r.cost ?? ''}>{r.cost != null ? fmt2(r.cost) : '—'}</td>}
                    {showFob && <td data-sv={r.fob ?? ''}>{r.fob != null ? fmt2(r.fob) : '—'}</td>}
                    <td data-sv={r.wms ?? ''} className="accent2">
                      {r.wms != null ? fmt0(r.wms) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableWithExport>
      )}
    </div>
  )
}

export function ItemsIndexView(props: ItemsIndexViewProps) {
  return (
    <SalesReportUiProvider>
      <div id="sales-report">
        <SalesReportStickySetup />
        <ItemsIndexContent {...props} />
      </div>
    </SalesReportUiProvider>
  )
}
