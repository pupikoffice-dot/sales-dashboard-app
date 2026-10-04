import { describe, expect, it } from 'vitest'
import { evaluate, effectiveAgeHours, localParts, type Rule, type Latest, type SyncLog } from '../../../supabase/functions/data-health-check/evaluate.ts'

// Israel is UTC+3 (IDT) on these dates. 2026-10-03 is a Saturday.
const at = (iso: string) => new Date(iso)
const rule = (p: Partial<Rule>): Rule => ({
  file_name: 'x.xls', company: 'pupik', file_group: 'p1', fix_hint: 'fix', impact: 'imp',
  rule_kind: 'age', max_age_hours: 4, eval_from: null, eval_to: null, active: true, ...p,
})
const obs = (p: Partial<Latest>): Latest => ({
  file_name: 'x.xls', observed_at: '2026-10-04T09:00:00Z', modified_at: '2026-10-04T09:00:00Z',
  rows_loaded: 100, processed: true, history: [100, 100, 100], ...p,
})
const okSync: SyncLog[] = [{ id: 's', started_at: '2026-10-04T09:50:00Z', status: 'success' }]
const byKey = (r: ReturnType<typeof evaluate>) => Object.fromEntries(r.statuses.map(s => [s.check_key, s]))

describe('localParts', () => {
  it('converts to Asia/Jerusalem', () => {
    const p = localParts(at('2026-10-04T07:30:00Z')) // Sunday 10:30 local
    expect(p).toMatchObject({ weekday: 'Sun', minutes: 630, date: '2026-10-04' })
  })
})

describe('effectiveAgeHours', () => {
  it('does not count Saturday', () => {
    // Fri 2026-10-02 19:00 local -> Sun 2026-10-04 07:00 local = 36 h wall, 12 h without Saturday
    expect(effectiveAgeHours(at('2026-10-02T16:00:00Z'), at('2026-10-04T04:00:00Z'))).toBeCloseTo(12, 0)
  })
  it('is fast and approximately right for long ages (frozen / manual files)', () => {
    const t0 = performance.now()
    const h = effectiveAgeHours(at('2024-10-18T14:00:00Z'), at('2026-10-04T10:00:00Z'))
    expect(performance.now() - t0).toBeLessThan(50)
    const wall = (at('2026-10-04T10:00:00Z').getTime() - at('2024-10-18T14:00:00Z').getTime()) / 3_600_000
    expect(h).toBeCloseTo(wall * 6 / 7, -1)
  })
})

describe('evaluate', () => {
  it('returns nothing on Saturday or outside 07:00-22:00', () => {
    expect(evaluate({ rules: [rule({})], latest: [obs({})], syncLogs: okSync, now: at('2026-10-03T09:00:00Z') }).statuses).toEqual([])
    expect(evaluate({ rules: [rule({})], latest: [obs({})], syncLogs: okSync, now: at('2026-10-04T20:00:00Z') }).statuses).toEqual([])
  })
  it('ignoreCalendar (test switch) evaluates on Saturday and outside rule windows', () => {
    const now = at('2026-10-03T09:00:00Z') // Saturday 12:00
    const res = evaluate({ rules: [rule({ eval_from: '13:00', eval_to: '14:00' })], latest: [obs({ modified_at: '2026-10-03T08:30:00Z' })], syncLogs: okSync, now, ignoreCalendar: true })
    expect(byKey(res)['x.xls'].status).toBe('green')
  })
  it('age rule: green, amber, red', () => {
    const now = at('2026-10-04T10:00:00Z') // Sun 13:00
    const r = (mod: string) => byKey(evaluate({ rules: [rule({})], latest: [obs({ modified_at: mod })], syncLogs: okSync, now }))['x.xls'].status
    expect(r('2026-10-04T09:00:00Z')).toBe('green') // 1 h
    expect(r('2026-10-04T06:30:00Z')).toBe('amber') // 3.5 h > 75 % of 4
    expect(r('2026-10-04T05:00:00Z')).toBe('red')   // 5 h
  })
  it('skips a rule outside its window', () => {
    const now = at('2026-10-04T05:00:00Z') // Sun 08:00, window 10:00-21:00
    const res = evaluate({ rules: [rule({ eval_from: '10:00', eval_to: '21:00' })], latest: [obs({ modified_at: '2026-10-02T10:00:00Z' })], syncLogs: okSync, now })
    expect(byKey(res)['x.xls']).toBeUndefined()
  })
  it('red when the file was never observed', () => {
    const res = evaluate({ rules: [rule({})], latest: [], syncLogs: okSync, now: at('2026-10-04T10:00:00Z') })
    expect(byKey(res)['x.xls']).toMatchObject({ status: 'red' })
  })
  it('nightly rule: red if not modified today after 04:30', () => {
    const nightly = rule({ rule_kind: 'nightly', max_age_hours: null, eval_from: '04:30', file_group: 'nightly_aski' })
    const early = at('2026-10-04T03:00:00Z') // Sun 06:00 local, before 07:00 -> skipped
    expect(evaluate({ rules: [nightly], latest: [obs({})], syncLogs: okSync, now: early }).statuses).toEqual([])
    const later = at('2026-10-04T05:00:00Z') // Sun 08:00
    const old = byKey(evaluate({ rules: [nightly], latest: [obs({ modified_at: '2026-10-02T00:36:00Z' })], syncLogs: okSync, now: later }))['x.xls']
    const fresh = byKey(evaluate({ rules: [nightly], latest: [obs({ modified_at: '2026-10-04T00:36:00Z' })], syncLogs: okSync, now: later }))['x.xls']
    expect(old.status).toBe('red'); expect(fresh.status).toBe('green')
  })
  it('frozen rule is grey', () => {
    const res = evaluate({ rules: [rule({ rule_kind: 'frozen', max_age_hours: null, file_group: 'frozen' })], latest: [obs({ modified_at: '2025-01-01T00:00:00Z' })], syncLogs: okSync, now: at('2026-10-04T10:00:00Z') })
    expect(byKey(res)['x.xls'].status).toBe('grey')
  })
  it('rows check: zero after non-zero, and under 70 % of the median (the 2026-10-03 722mt half load)', () => {
    const now = at('2026-10-04T10:00:00Z')
    const zero = byKey(evaluate({ rules: [rule({})], latest: [obs({ rows_loaded: 0, history: [38610] })], syncLogs: okSync, now }))['rows:x.xls']
    const half = byKey(evaluate({ rules: [rule({})], latest: [obs({ rows_loaded: 23500, history: [38610, 38600, 38590] })], syncLogs: okSync, now }))['rows:x.xls']
    const ok = byKey(evaluate({ rules: [rule({})], latest: [obs({ rows_loaded: 38600, history: [38610, 38600, 38590] })], syncLogs: okSync, now }))['rows:x.xls']
    expect(zero.status).toBe('red'); expect(half.status).toBe('red'); expect(ok.status).toBe('green')
  })
  it('rows_check=false skips only the "usually N rows" drop check (891: two months daily, full year weekly)', () => {
    const now = at('2026-10-04T10:00:00Z')
    const drop = byKey(evaluate({ rules: [rule({ rows_check: false })], latest: [obs({ rows_loaded: 5289, history: [35107, 35107, 35107] })], syncLogs: okSync, now }))
    expect(drop['rows:x.xls'].status).toBe('green')
    expect(drop['x.xls']).toBeDefined()
  })
  it('rows_check=false still alerts when a run loaded 0 rows after a non-zero run (file skipped by the sync)', () => {
    const now = at('2026-10-04T10:00:00Z')
    const res = byKey(evaluate({ rules: [rule({ rows_check: false })], latest: [obs({ rows_loaded: 0, history: [5289, 5289] })], syncLogs: okSync, now }))
    expect(res['rows:x.xls'].status).toBe('red')
  })
  it('sync health: no success in 2 h, stuck running, superseded running ignored', () => {
    const now = at('2026-10-04T10:00:00Z') // Sun 13:00
    const stale = byKey(evaluate({ rules: [], latest: [], syncLogs: [{ id: 'a', started_at: '2026-10-04T07:00:00Z', status: 'success' }], now }))
    expect(stale['sync:no_success'].status).toBe('red')
    const stuck = byKey(evaluate({ rules: [], latest: [], now, syncLogs: [
      { id: 'b', started_at: '2026-10-04T09:00:00Z', status: 'running' },
      { id: 'c', started_at: '2026-10-04T08:50:00Z', status: 'success' } ] }))
    expect(stuck['sync:stuck'].status).toBe('red')
    const superseded = byKey(evaluate({ rules: [], latest: [], now, syncLogs: [
      { id: 'd', started_at: '2026-10-04T09:30:00Z', status: 'success' },
      { id: 'e', started_at: '2026-10-04T08:45:00Z', status: 'running' } ] }))
    expect(superseded['sync:stuck'].status).toBe('green')
  })
  it('reports processed files without a rule as unruled', () => {
    const res = evaluate({ rules: [], latest: [obs({ file_name: 'new.xls' }), obs({ file_name: 'skip.xls', processed: false })], syncLogs: okSync, now: at('2026-10-04T10:00:00Z') })
    expect(res.unruled).toEqual(['new.xls'])
  })
})
