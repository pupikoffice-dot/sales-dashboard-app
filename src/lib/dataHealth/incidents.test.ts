import { describe, expect, it } from 'vitest'
import { planIncidents, type OpenIncident } from '../../../supabase/functions/data-health-check/incidents.ts'
import type { Status } from '../../../supabase/functions/data-health-check/evaluate.ts'

const st = (key: string, status: Status['status']): Status => ({ check_key: key, file_name: key, file_group: 'p1', company: null, status, reason: `${key} ${status}`, modified_at: null, age_hours: null, rows_loaded: null })
const inc = (p: Partial<OpenIncident>): OpenIncident => ({ id: 1, check_key: 'a', opened_at: '2026-10-04T05:00:00Z', acknowledged_at: null, last_notified_at: '2026-10-04T05:00:00Z', reason: 'r', ...p })
const now = new Date('2026-10-04T10:00:00Z')

describe('planIncidents', () => {
  it('opens on new red, ignores amber/green/grey', () => {
    const p = planIncidents([st('a', 'red'), st('b', 'amber'), st('c', 'green'), st('d', 'grey')], [], now)
    expect(p.open.map(s => s.check_key)).toEqual(['a']); expect(p.close).toEqual([]); expect(p.remind).toEqual([])
  })
  it('closes when an open incident is no longer red', () => {
    const p = planIncidents([st('a', 'green')], [inc({})], now)
    expect(p.close.map(i => i.id)).toEqual([1])
  })
  it('keeps open incidents for checks not evaluated this run', () => {
    expect(planIncidents([], [inc({})], now).close).toEqual([])
  })
  it('reminds after 24 h unless acknowledged', () => {
    const old = inc({ last_notified_at: '2026-10-03T09:00:00Z' })
    expect(planIncidents([st('a', 'red')], [old], now).remind.map(i => i.id)).toEqual([1])
    expect(planIncidents([st('a', 'red')], [{ ...old, acknowledged_at: '2026-10-03T10:00:00Z' }], now).remind).toEqual([])
    expect(planIncidents([st('a', 'red')], [inc({})], now).remind).toEqual([])
  })
  it('retries an alert that was never sent', () => {
    expect(planIncidents([st('a', 'red')], [inc({ last_notified_at: null })], now).remind.map(i => i.id)).toEqual([1])
  })
})
