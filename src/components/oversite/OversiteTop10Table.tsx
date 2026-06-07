import { fmt } from '../../lib/format'
import type { Top10Item } from '../../lib/oversiteMetrics'

export function OversiteTop10Table({ items, emptyLabel }: { items: Top10Item[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-sm italic text-slate-500">{emptyLabel}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Item</th>
            <th className="py-2 pr-2 text-right">Cash</th>
            <th className="py-2 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.sku} className="border-b border-slate-100">
              <td className="py-1.5 pr-2 text-slate-400">{i + 1}</td>
              <td className="max-w-[200px] truncate py-1.5 pr-2" title={it.sku}>
                {it.name}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(it.cash)}</td>
              <td className="py-1.5 text-right tabular-nums text-slate-600">{fmt(it.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
