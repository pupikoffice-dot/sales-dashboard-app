import { Fragment, useMemo, useState } from 'react'
import { fmt } from '../../lib/format'
import type { Top10Item } from '../../lib/oversiteMetrics'
import type { SalesRow } from '../../types/dashboard'

interface ClientBreakdownRow {
  clientID: string
  clientName: string
  qty: number
  cash: number
}

function clientsForSku(rows: SalesRow[], sku: string): ClientBreakdownRow[] {
  const byClient = new Map<string, ClientBreakdownRow>()
  for (const r of rows) {
    if (String(r.itemSKU || '') !== sku) continue
    const id = String(r.clientID || '')
    let e = byClient.get(id)
    if (!e) {
      e = { clientID: id, clientName: r.clientName || id || '—', qty: 0, cash: 0 }
      byClient.set(id, e)
    }
    e.qty += Number(r.qty) || 0
    e.cash += Number(r.cash) || 0
  }
  return [...byClient.values()].sort((a, b) => b.cash - a.cash)
}

export function OversiteTop10Table({
  items,
  emptyLabel,
  showSku = false,
  detailRows,
}: {
  items: Top10Item[]
  emptyLabel: string
  showSku?: boolean
  /** When provided, item rows become clickable and expand to a per-client
      (qty/cash) breakdown computed from these already-scoped rows. */
  detailRows?: SalesRow[]
}) {
  const [expandedSku, setExpandedSku] = useState<string | null>(null)

  const expandedClients = useMemo(
    () => (detailRows && expandedSku ? clientsForSku(detailRows, expandedSku) : []),
    [detailRows, expandedSku],
  )

  if (items.length === 0) {
    return <p className="ov-empty">{emptyLabel}</p>
  }

  const expandable = !!detailRows
  const colCount = 4 + (showSku ? 1 : 0) + (expandable ? 1 : 0)

  return (
    <div className="tw">
      <table>
        <thead>
          <tr>
            {expandable && <th className="ov-order-expand-col" />}
            <th>#</th>
            {showSku && <th>SKU</th>}
            <th>Item</th>
            <th>Cash</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const isOpen = expandable && expandedSku === it.sku
            return (
              <Fragment key={it.sku}>
                <tr
                  className={expandable ? `ov-order-row${isOpen ? ' ov-order-row-open' : ''}` : undefined}
                  onClick={expandable ? () => setExpandedSku(isOpen ? null : it.sku) : undefined}
                >
                  {expandable && <td className="ov-order-expand-col cm">{isOpen ? '▴' : '▾'}</td>}
                  <td className="cm">{i + 1}</td>
                  {showSku && <td className="cm">{it.sku}</td>}
                  <td title={showSku ? undefined : it.sku}>{it.name}</td>
                  <td>{fmt(it.cash)}</td>
                  <td className="cm">{fmt(it.qty)}</td>
                </tr>
                {isOpen && (
                  <tr className="ov-order-detail-row">
                    <td colSpan={colCount}>
                      <div className="ov-order-detail">
                        <table>
                          <thead>
                            <tr>
                              <th>Client</th>
                              <th>Qty</th>
                              <th>Cash</th>
                            </tr>
                          </thead>
                          <tbody>
                            {expandedClients.map(c => (
                              <tr key={c.clientID || c.clientName}>
                                <td title={c.clientID || undefined}>{c.clientName}</td>
                                <td className="cm">{fmt(c.qty)}</td>
                                <td>{fmt(c.cash)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
