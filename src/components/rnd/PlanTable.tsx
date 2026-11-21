import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { passesFilter } from '../../lib/orderPlanning'
import { SortTh, useSortedRows, type SortValue } from './sortRows'
import './PlanTable.css'

export interface PlanCol<T> {
  key: string
  /** short heading (5 characters or fewer where possible) */
  label: string
  /** what the column sorts and filters on */
  get: (r: T) => SortValue
  /** what the cell shows (defaults to the raw value) */
  show?: (r: T) => ReactNode
  /** text column: sorts A to Z first and filters by "contains"; otherwise numbers (filter: >5, <=3, 5..20) */
  text?: boolean
  /** shown when the mouse rests on the heading: full name and what the column means */
  title?: string
  /** extra class on the cells (e.g. 'pt-name' to cut long names with an ellipsis) */
  cls?: string
}

/**
 * A table whose every heading sorts, with a filter box under each heading and a hover explanation on each heading.
 * Used for the supplier rows and the item rows below them, on both the Order recommendation and the Import stock cover pages.
 */
/** Small Excel icon button that sits on a brand (supplier) row; it does not open or close the row. */
export function ExcelIcon({ title, onClick, disabled }: { title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="pt-xl"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={e => {
        e.stopPropagation()
        onClick()
      }}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9.5 1.5H4a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V5.5z" />
        <path d="M9.5 1.5v4h4" />
        <path d="M5.8 8.2l2.4 3.6M8.2 8.2l-2.4 3.6" />
      </svg>
    </button>
  )
}

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
  onExport,
  exportLabel = 'Excel',
}: {
  rows: readonly T[]
  cols: Array<PlanCol<T>>
  rowKey: (r: T) => string
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  /** an extra first column (e.g. the "hide" checkbox) */
  lead?: { header: ReactNode; cell: (r: T) => ReactNode; title?: string }
  rowStyle?: (r: T) => React.CSSProperties | undefined
  filterPlaceholder?: string
  empty?: string
  /** rows that open to show more underneath (the items of a supplier) */
  expand?: (r: T) => ReactNode
  /** change `n` to open (or close) every row at once */
  openAll?: { n: number; open: boolean }
  /** adds an export button above the table; gets the rows as shown (filtered and sorted) */
  onExport?: (visible: T[]) => void
  exportLabel?: string
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
    <div className="plan-table">
      {onExport ? (
        <div style={{ textAlign: 'end', marginBottom: 4 }}>
          <button type="button" className="btn" onClick={() => onExport(sorted)} disabled={!sorted.length}>
            {exportLabel}
          </button>
        </div>
      ) : null}
      <div className="tw" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              {expand ? <th style={{ width: 20 }} /> : null}
              {lead ? <th title={lead.title}>{lead.header}</th> : null}
              {cols.map(c => (
                <SortTh key={c.key} label={c.label} k={c.key} sort={sort} onSort={onSort} left={c.text} title={c.title} />
              ))}
            </tr>
            <tr>
              {expand ? <th /> : null}
              {lead ? <th /> : null}
              {cols.map(c => (
                <th key={c.key} style={{ padding: '2px 2px' }}>
                  <input
                    type="text"
                    value={filters[c.key] ?? ''}
                    placeholder={filterPlaceholder}
                    aria-label={`${c.label} ${filterPlaceholder}`}
                    onChange={e => setFilters(f => ({ ...f, [c.key]: e.target.value }))}
                    className="pt-filter"
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
                        <td key={c.key} className={c.cls} style={c.text ? { textAlign: 'start' } : undefined}>
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
    </div>
  )
}
