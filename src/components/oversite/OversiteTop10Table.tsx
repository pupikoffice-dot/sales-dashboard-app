import { fmt } from '../../lib/format'
import type { Top10Item } from '../../lib/oversiteMetrics'

export function OversiteTop10Table({ items, emptyLabel }: { items: Top10Item[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="ov-empty">{emptyLabel}</p>
  }

  return (
    <div className="tw">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>Cash</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.sku}>
              <td className="cm">{i + 1}</td>
              <td title={it.sku}>{it.name}</td>
              <td>{fmt(it.cash)}</td>
              <td className="cm">{fmt(it.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
