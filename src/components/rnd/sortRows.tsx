import { useMemo, useState, type CSSProperties } from 'react'

export type SortDir = 'asc' | 'desc'
export type SortValue = string | number | boolean | null | undefined

export interface SortState {
  key: string
  dir: SortDir
}

/** Compare two cells: empty values go last in either direction, numbers numerically, text with numbers in order. */
export function compareValues(a: SortValue, b: SortValue, dir: SortDir): number {
  const empty = (v: SortValue) => v === null || v === undefined || v === ''
  if (empty(a) && empty(b)) return 0
  if (empty(a)) return 1
  if (empty(b)) return -1
  let c: number
  if (typeof a === 'number' && typeof b === 'number') c = a - b
  else if (typeof a === 'boolean' && typeof b === 'boolean') c = Number(a) - Number(b)
  else c = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
  return dir === 'asc' ? c : -c
}

/** Sort rows by a column. `accessors` says what each column key sorts on. A click on the same header flips the direction. */
export function sortRows<T>(rows: readonly T[], accessors: Record<string, (r: T) => SortValue>, sort: SortState | null): T[] {
  if (!sort || !accessors[sort.key]) return [...rows]
  const get = accessors[sort.key]
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => compareValues(get(x.r), get(y.r), sort.dir) || x.i - y.i)
    .map(x => x.r)
}

/** Click state for one table: which column and which way (text columns start A to Z, number columns biggest first). */
export function useSortedRows<T>(
  rows: readonly T[] | undefined,
  accessors: Record<string, (r: T) => SortValue>,
  initial: SortState | null = null,
  textKeys: readonly string[] = [],
) {
  const [sort, setSort] = useState<SortState | null>(initial)
  const sorted = useMemo(() => sortRows(rows ?? [], accessors, sort), [rows, sort]) // eslint-disable-line react-hooks/exhaustive-deps
  const onSort = (key: string) =>
    setSort(prev =>
      prev?.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: textKeys.includes(key) ? 'asc' : 'desc' },
    )
  return { sorted, sort, onSort }
}

/** A table heading you can click to sort: shows ↕ when idle and ↑ / ↓ on the sorted column. */
export function SortTh({
  label,
  k,
  sort,
  onSort,
  left,
  title,
}: {
  label: string
  k: string
  sort: SortState | null
  onSort: (key: string) => void
  left?: boolean
  title?: string
}) {
  const active = sort?.key === k
  const style: CSSProperties = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...(left ? { textAlign: 'left' } : null) }
  return (
    <th
      style={style}
      title={title}
      aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={() => onSort(k)}
    >
      {label}
      <span style={{ opacity: active ? 1 : 0.4 }}> {active ? (sort!.dir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </th>
  )
}
