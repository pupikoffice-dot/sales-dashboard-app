import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { passesFilter } from '../../lib/orderPlanning'
import { SortTh, useSortedRows, type SortValue } from './sortRows'

export interface PlanCol<T> {
  key: string
  label: string
  /** what the column sorts and filters on */
  get: (r: T) => SortValue
  /** what the cell shows (defaults to the raw value) */
  show?: (r: T) => ReactNode
  /** text column: sorts A to Z first and filters by "contains"; otherwise numbers (filter: >5, <=3, 5..20) */
  text?: boolean
  title?: string
}

/**
 * A table whose every heading sorts, with a filter box under each heading. Used for the item rows below a supplier,
 * on both the Order recommendation and the Import stock cover pages.
 */
export function PlanTable<T>({
  rows,
  cols,
  rowKey,
  initialSort,
  lead,
  rowStyle,
  filterPlaceholder = 'filter',
  empty,
  expand,
  openAll,
}: {
  rows: readonly T[]
  cols: Array<PlanCol<T>>
  rowKey: (r: T) => string
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  /** an extra first column (e.g. the "hide" checkbox) */
  lead?: { header: ReactNode; cell: (r: T) => ReactNode }
  rowStyle?: (r: T) => React.CSSProperties | undefined
  filterPlaceholder?: string
  empty?: string
  /** rows that open to show more underneath (the items of a supplier) */
  expand?: (r: T) => ReactNode
  /** change `n` to open (or close) every row at once */
  openAll?: { n: number; open: boolean }
}) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<Record<string, string>>({})
  const accessors = useMemo(() => Object.fromEntries(cols.map(c => [c.key, c.get])), [cols])
  const filtered = useMemo(
    () => rows.filter(r => cols.every(c => passesFilter(c.get(r), filters[c.key] ?? '', !!c.text))),
    [rows, cols, filters],
  )
  const { sorted, sort, onSort } = useSortedRows(
    filtered,
    accessors,
    initialSort ?? null,
    cols.filter(c => c.text).map(c => c.key),
  )
  useEffect(() => {
    if (!openAll || !openAll.n) return
    setOpenKeys(openAll.open ? new Set(rows.map(rowKey)) : new Set())
  }, [openAll?.n]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (k: string) =>
    setOpenKeys(prev => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  const colCount = cols.length + (lead ? 1 : 0) + (expand ? 1 : 0)
  const anyFilter = Object.values(filters).some(v => v.trim())

  return (
    <div className="tw" style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            {expand ? <th style={{ width: 24 }} /> : null}
            {lead ? <th>{lead.header}</th> : null}
            {cols.map(c => (
              <SortTh key={c.key} label={c.label} k={c.key} sort={sort} onSort={onSort} left={c.text} title={c.title} />
            ))}
          </tr>
          <tr>
            {expand ? <th /> : null}
            {lead ? <th /> : null}
            {cols.map(c => (
              <th key={c.key} style={{ padding: '2px 4px' }}>
                <input
                  type="text"
                  value={filters[c.key] ?? ''}
                  placeholder={filterPlaceholder}
                  aria-label={`${c.label} ${filterPlaceholder}`}
                  onChange={e => setFilters(f => ({ ...f, [c.key]: e.target.value }))}
                  style={{ width: '100%', minWidth: 56, boxSizing: 'border-box', fontSize: '0.8em' }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => {
            const k = rowKey(r)
            const isOpen = openKeys.has(k)
            return (
              <Fragment key={k}>
                <tr
                  style={{ ...(expand ? { cursor: 'pointer', fontWeight: 600 } : null), ...rowStyle?.(r) }}
                  onClick={expand ? () => toggle(k) : undefined}
                  aria-expanded={expand ? isOpen : undefined}
                >
                  {expand ? <td aria-hidden="true">{isOpen ? '▾' : '▸'}</td> : null}
                  {lead ? <td onClick={e => e.stopPropagation()}>{lead.cell(r)}</td> : null}
                  {cols.map(c => {
                    const v = c.get(r)
                    return (
                      <td key={c.key} style={c.text ? { textAlign: 'start' } : undefined}>
                        {c.show ? c.show(r) : v === null || v === undefined || v === '' ? '—' : String(v)}
                      </td>
                    )
                  })}
                </tr>
                {expand && isOpen ? (
                  <tr>
                    <td colSpan={colCount} style={{ padding: 0, background: 'var(--surface-2, rgba(127,127,127,0.06))' }}>
                      <div style={{ padding: '6px 8px 10px' }}>{expand(r)}</div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
          {!sorted.length ? (
            <tr>
              <td colSpan={colCount} style={{ textAlign: 'center', opacity: 0.7 }}>
                {anyFilter ? '—' : (empty ?? '—')}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
