import { describe, expect, it } from 'vitest'
import { changeLabel, changePct, daysSince, lastMonthKeys, monthsOfCover, rateWithoutReissue, returnRate, throughLabel } from './purchaseCards'

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
  it('rate without cancel-and-reissue removes the reissued amount from both sides', () => {
    expect(rateWithoutReissue(1000, 400, 100)).toBeCloseTo(300 / 900)
    expect(rateWithoutReissue(100, 50, 100)).toBeNull()
    expect(rateWithoutReissue(1000, 50, 80)).toBe(0)
  })
  it('change against last year', () => {
    expect(changePct(150, 100)).toBeCloseTo(0.5)
    expect(changePct(5, 0)).toBeNull()
    expect(changeLabel(150, 100)).toBe('+50%')
    expect(changeLabel(70, 100)).toBe('-30%')
    expect(changeLabel(5, 0)).toBe('new')
    expect(changeLabel(0, 0)).toBe('–')
    expect(changeLabel(0, 40)).toBe('-100%')
  })
  it('period label', () => {
    expect(throughLabel(9)).toBe('Jan–Sep')
    expect(throughLabel(1)).toBe('Jan')
  })
})
