export type SortDir = 'asc' | 'desc' | null

export function compareSortValues(a: string | number, b: string | number, asc: boolean): number {
  const an = typeof a === 'number' ? a : parseFloat(String(a).replace(/,/g, ''))
  const bn = typeof b === 'number' ? b : parseFloat(String(b).replace(/,/g, ''))
  if (!Number.isNaN(an) && !Number.isNaN(bn)) return asc ? an - bn : bn - an
  const at = String(a)
  const bt = String(b)
  return asc ? at.localeCompare(bt) : bt.localeCompare(at)
}

export function applySort<T>(
  rows: T[],
  sortCol: number | null,
  sortAsc: boolean,
  getter: (row: T, col: number) => string | number,
): T[] {
  if (sortCol === null) return rows
  return [...rows].sort((a, b) =>
    compareSortValues(getter(a, sortCol), getter(b, sortCol), sortAsc),
  )
}
