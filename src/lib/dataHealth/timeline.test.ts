import { describe, expect, it } from 'vitest'
import { redSegments, monthlyStats, type IncidentRow } from './timeline'

const i = (p: Partial<IncidentRow>): IncidentRow => ({ id: 1, check_key: 'a', opened_at: '2026-10-01T00:00:00Z', closed_at: '2026-10-01T06:00:00Z', reason: 'r', acknowledged_at: null, notes: null, ...p })

describe('timeline', () => {
  it('clips incidents to the window and marks open ones until now', () => {
    const from = new Date('2026-10-01T03:00:00Z'), to = new Date('2026-10-02T00:00:00Z')
    const segs = redSegments([i({}), i({ id: 2, opened_at: '2026-10-01T20:00:00Z', closed_at: null })], from, to)
    const r = (x: number) => Math.round(x * 1000) / 1000
    expect(segs.map(s => ({ ...s, startPct: r(s.startPct), endPct: r(s.endPct) }))).toEqual([
      { startPct: 0, endPct: r(3 / 21 * 100), open: false },
      { startPct: r(17 / 21 * 100), endPct: 100, open: true },
    ])
  })
  it('monthly stats per group: count and average hours to fix', () => {
    const groupOf = (k: string) => (k === 'a' ? 'p1' : 'manual_sales')
    const s = monthlyStats([i({}), i({ id: 2, closed_at: '2026-10-01T02:00:00Z' }), i({ id: 3, check_key: 'b', closed_at: null })], groupOf)
    expect(s).toEqual([
      { month: '2026-10', group: 'manual_sales', count: 1, avgHoursToFix: null },
      { month: '2026-10', group: 'p1', count: 2, avgHoursToFix: 4 },
    ])
  })
})
