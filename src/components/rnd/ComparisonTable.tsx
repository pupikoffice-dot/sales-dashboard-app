import type { ReactNode } from 'react'
import { fmt0 } from '../../lib/format'
import { changeLabel } from '../../lib/purchaseCards'
import { SortTh, useSortedRows } from './sortRows'

export interface CmpRow {
  key: string
  /** what the first column shows (a link, a name) */
  label: ReactNode
  /** the same as text, used for sorting */
  text: string
  cy: number
  ly: number
}

/** This year against last year for the same months: the two amounts, the change and the change in %, all sortable. */
export function ComparisonTable({
  rows,
  head,
  cyLabel,
  lyLabel,
  empty,
}: {
  rows: CmpRow[]
  head: string
  cyLabel: string
  lyLabel: string
  empty: string
}) {
  const { sorted, sort, onSort } = useSortedRows(
    rows,
    {
      label: r => r.text,
      cy: r => r.cy,
      ly: r => r.ly,
      change: r => r.cy - r.ly,
      pct: r => (r.ly === 0 ? (r.cy > 0 ? Number.MAX_SAFE_INTEGER : 0) : (r.cy - r.ly) / Math.abs(r.ly)),
    },
    { key: 'cy', dir: 'desc' },
    ['label'],
  )
  if (!rows.length) return <p className="status-msg">{empty}</p>
  return (
    <div className="tw">
      <table>
        <thead>
          <tr>
            <SortTh label={head} k="label" left sort={sort} onSort={onSort} />
            <SortTh label={cyLabel} k="cy" sort={sort} onSort={onSort} />
            <SortTh label={lyLabel} k="ly" sort={sort} onSort={onSort} />
            <SortTh label="Change" k="change" sort={sort} onSort={onSort} />
            <SortTh label="Change %" k="pct" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => {
            const diff = r.cy - r.ly
            const colour = diff > 0 ? 'var(--grn)' : diff < 0 ? 'var(--red)' : undefined
            return (
              <tr key={r.key}>
                <td style={{ textAlign: 'left' }}>{r.label}</td>
                <td>{fmt0(r.cy)}</td>
                <td>{fmt0(r.ly)}</td>
                <td style={{ color: colour }}>{diff > 0 ? '+' : ''}{fmt0(diff)}</td>
                <td style={{ color: colour }}>{changeLabel(r.cy, r.ly)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
