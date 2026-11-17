import { describe, expect, it } from 'vitest'
import { computePeriodMeters } from './periodMeters'
import type { SalesRow } from '../types/dashboard'

const row = (company: string, date: string, cash: number): SalesRow =>
  ({ company, date, year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)), cash }) as unknown as SalesRow

describe('computePeriodMeters', () => {
  const rows = [
    // last year: Q4 = 100 (Oct) + 100 (Nov 10) + 100 (Nov 25) + 200 (Dec); Q1 = 300
    row('pupik', '2025-01-15', 300),
    row('pupik', '2025-10-05', 100),
    row('pupik', '2025-11-10', 100),
    row('pupik', '2025-11-25', 100),
    row('pupik', '2025-12-20', 200),
    // another company, must be ignored
    row('mt', '2025-11-10', 9999),
    // this year
    row('pupik', '2026-01-10', 400),
    row('pupik', '2026-10-02', 150),
    row('pupik', '2026-11-12', 50),
  ]
  const m = computePeriodMeters(rows, new Set(['pupik']), '2026-11-16')

  it('year: goal is last year in full, done is this year so far', () => {
    expect(m.year.goal).toBe(800)
    expect(m.year.done).toBe(600)
    expect(m.year.pct).toBe(75)
    expect(m.year.gap).toBe(200)
  })
  it('year pace marker is last year up to the same day (Nov 16)', () => {
    expect(m.year.lyToDate).toBe(500) // Jan 300 + Oct 100 + Nov 10 100; Nov 25 and Dec are after the 16th
    expect(m.year.pacePct).toBe(62.5)
  })
  it('quarter: only the current quarter (Oct-Dec)', () => {
    expect(m.quarterNo).toBe(4)
    expect(m.quarter.goal).toBe(500)
    expect(m.quarter.done).toBe(200)
    expect(m.quarter.pct).toBe(40)
    expect(m.quarter.gap).toBe(300)
    expect(m.quarter.lyToDate).toBe(200)
  })
  it('gap goes negative once the goal is passed; no goal gives null pct', () => {
    const over = computePeriodMeters([row('pupik', '2025-02-01', 100), row('pupik', '2026-02-01', 130)], new Set(['pupik']), '2026-11-16')
    expect(over.year.gap).toBe(-30)
    const none = computePeriodMeters([row('pupik', '2026-02-01', 130)], new Set(['pupik']), '2026-11-16')
    expect(none.year.pct).toBeNull()
  })
})
