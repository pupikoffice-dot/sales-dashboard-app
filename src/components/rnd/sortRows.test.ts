import { describe, expect, it } from 'vitest'
import { compareValues, sortRows } from './sortRows'

describe('sortRows', () => {
  const rows = [
    { name: 'b10', n: 5, last: '2026-03-01' },
    { name: 'b2', n: null as number | null, last: null as string | null },
    { name: 'a1', n: 30, last: '2026-10-01' },
  ]
  const acc = { name: (r: (typeof rows)[number]) => r.name, n: (r: (typeof rows)[number]) => r.n, last: (r: (typeof rows)[number]) => r.last }

  it('sorts numbers and keeps empty values last in both directions', () => {
    expect(sortRows(rows, acc, { key: 'n', dir: 'desc' }).map(r => r.name)).toEqual(['a1', 'b10', 'b2'])
    expect(sortRows(rows, acc, { key: 'n', dir: 'asc' }).map(r => r.name)).toEqual(['b10', 'a1', 'b2'])
  })
  it('sorts text with numbers in natural order and dates as text', () => {
    expect(sortRows(rows, acc, { key: 'name', dir: 'asc' }).map(r => r.name)).toEqual(['a1', 'b2', 'b10'])
    expect(sortRows(rows, acc, { key: 'last', dir: 'desc' }).map(r => r.name)).toEqual(['a1', 'b10', 'b2'])
  })
  it('leaves the order alone with no sort or an unknown column, and is stable on ties', () => {
    expect(sortRows(rows, acc, null)).toEqual(rows)
    expect(sortRows(rows, acc, { key: 'nope', dir: 'asc' })).toEqual(rows)
    const ties = [{ k: 1, id: 'x' }, { k: 1, id: 'y' }, { k: 0, id: 'z' }]
    expect(sortRows(ties, { k: r => r.k }, { key: 'k', dir: 'desc' }).map(r => r.id)).toEqual(['x', 'y', 'z'])
  })
  it('compares booleans and mixed empties', () => {
    expect(compareValues(true, false, 'desc')).toBeLessThan(0)
    expect(compareValues('', 3, 'asc')).toBeGreaterThan(0)
  })
})
