import { fmt } from '../../lib/format'
import type { Top10Item } from '../../lib/oversiteMetrics'

export function OversiteTop10Table({
  items,
  emptyLabel,
  showSku = false,
}: {
  items: Top10Item[]
  emptyLabel: string
  showSku?: boolean
}) {
  if (items.length === 0) {
    return <p className="ov-empty">{emptyLabel}</p>
  }

  return (
    <div className="tw">
      <table>
        <thead>
          <tr>
            <th>#</th>
            {showSku && <th>SKU</th>}
            <th>Item</th>
            <th>Cash</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.sku}>
              <td className="cm">{i + 1}</td>
              {showSku && <td className="cm">{it.sku}</td>}
              <td title={showSku ? undefined : it.sku}>{it.name}</td>
              <td>{fmt(it.cash)}</td>
              <td className="cm">{fmt(it.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
