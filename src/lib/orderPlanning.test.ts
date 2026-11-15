import { describe, expect, it } from 'vitest'
import { groupBySupplier, passesFilter } from './orderPlanning'

describe('passesFilter', () => {
  it('passes everything when the filter is empty', () => {
    expect(passesFilter(5, '', false)).toBe(true)
    expect(passesFilter(null, '  ', false)).toBe(true)
  })
  it('matches text anywhere, any case', () => {
    expect(passesFilter('Vtech ELP', 'tech', true)).toBe(true)
    expect(passesFilter('Vtech ELP', 'razor', true)).toBe(false)
  })
  it('compares numbers', () => {
    expect(passesFilter(12, '>10', false)).toBe(true)
    expect(passesFilter(10, '>10', false)).toBe(false)
    expect(passesFilter(10, '>=10', false)).toBe(true)
    expect(passesFilter(3, '<=3', false)).toBe(true)
    expect(passesFilter(7, '5..10', false)).toBe(true)
    expect(passesFilter(11, '5..10', false)).toBe(false)
    expect(passesFilter(7, '7', false)).toBe(true)
  })
  it('hides empty numbers when a numeric filter is set', () => {
    expect(passesFilter(null, '>1', false)).toBe(false)
  })
  it('treats date strings as text', () => {
    expect(passesFilter('2026-12-03', '2026-12', false)).toBe(true)
  })
})

describe('groupBySupplier', () => {
  it('keeps first-seen order and groups rows', () => {
    const rows = [
      { supplier: 'B', internal: false, n: 1 },
      { supplier: 'A', internal: true, n: 2 },
      { supplier: 'B', internal: false, n: 3 },
    ]
    const g = groupBySupplier(rows)
    expect(g.map(x => x.supplier)).toEqual(['B', 'A'])
    expect(g[0].rows.map(r => r.n)).toEqual([1, 3])
    expect(g[1].internal).toBe(true)
  })
})
