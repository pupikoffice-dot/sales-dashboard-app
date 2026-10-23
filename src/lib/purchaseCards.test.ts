import { describe, expect, it } from 'vitest'
import { daysSince, lastMonthKeys, monthsOfCover, returnRate } from './purchaseCards'

describe('purchase card helpers', () => {
  it('return rate is returned over sold, null when nothing sold', () => {
    expect(returnRate(200, 50)).toBe(0.25)
    expect(returnRate(0, 5)).toBeNull()
  })
  it('days since a date', () => {
    expect(daysSince('2026-10-01', new Date(2026, 9, 11))).toBe(10)
    expect(daysSince(null)).toBeNull()
    expect(daysSince('nonsense')).toBeNull()
  })
  it('months of cover uses the last three months pace', () => {
    expect(monthsOfCover(60, 90)).toBe(2)
    expect(monthsOfCover(10, 0)).toBeNull()
    expect(monthsOfCover(10, -3)).toBeNull()
  })
  it('lists the last n months across a year boundary, oldest first', () => {
    expect(lastMonthKeys(2026, 2, 4)).toEqual([
      { y: 2025, m: 11 },
      { y: 2025, m: 12 },
      { y: 2026, m: 1 },
      { y: 2026, m: 2 },
    ])
  })
})
