import { describe, expect, it } from 'vitest'
import { evaluate, lastFridayAnchor, type Rule, type Latest, type JobResult } from '../../../supabase/functions/data-health-check/evaluate.ts'
import { digestEmail, resolvedDigestEmail } from '../../../supabase/functions/data-health-check/emails.ts'

// Israel is UTC+3 (IDT) until 2026-10-25, UTC+2 after. 2026-11-01 is a Sunday.
const at = (iso: string) => new Date(iso)
const rule = (p: Partial<Rule>): Rule => ({
  file_name: 'x.xls', company: 'pupik', file_group: 'p1', fix_hint: 'fix', impact: 'imp',
  rule_kind: 'age', max_age_hours: 4, eval_from: null, eval_to: null, active: true, ...p,
})
const obs = (p: Partial<Latest>): Latest => ({
  file_name: 'x.xls', observed_at: '2026-11-02T06:00:00Z', modified_at: '2026-11-02T06:00:00Z',
  rows_loaded: 100, processed: true, history: [100, 100, 100], ...p,
})
const byKey = (r: ReturnType<typeof evaluate>) => Object.fromEntries(r.statuses.map(s => [s.check_key, s]))

describe('nightly check waits for the sync to look at the folder', () => {
  const nightly = rule({ file_name: 'rep893mt.xls', rule_kind: 'nightly', max_age_hours: null, eval_from: '04:30', file_group: 'nightly_aski' })
  // Monday 2026-11-02: the file was written 03:00 local (01:00Z) but the sync has not seen it yet (old observation).
  const stale = obs({ file_name: 'rep893mt.xls', modified_at: '2026-11-01T01:00:00Z' })
  const lastNight = [{ id: 'a', started_at: '2026-11-01T20:40:00Z', status: 'success' }] // Sun 22:40 local
  it('07:30 local, only last night\'s sync has run: no verdict (was a false red)', () => {
    const r = evaluate({ rules: [nightly], latest: [stale], syncLogs: lastNight, now: at('2026-11-02T05:30:00Z') })
    expect(byKey(r)['rep893mt.xls']).toBeUndefined()
  })
  it('after the 07:40 sync has seen a stale file: red', () => {
    const syncs = [...lastNight, { id: 'b', started_at: '2026-11-02T05:40:00Z', status: 'success' }]
    expect(byKey(evaluate({ rules: [nightly], latest: [stale], syncLogs: syncs, now: at('2026-11-02T06:30:00Z') }))['rep893mt.xls'].status).toBe('red')
  })
  it('after the 07:40 sync has seen the fresh file: green', () => {
    const syncs = [{ id: 'b', started_at: '2026-11-02T05:40:00Z', status: 'success' }]
    const fresh = obs({ file_name: 'rep893mt.xls', modified_at: '2026-11-02T01:00:00Z' })
    expect(byKey(evaluate({ rules: [nightly], latest: [fresh], syncLogs: syncs, now: at('2026-11-02T06:30:00Z') }))['rep893mt.xls'].status).toBe('green')
  })
  it('a failed sync does not count as having looked', () => {
    const syncs = [{ id: 'b', started_at: '2026-11-02T05:40:00Z', status: 'failed' }]
    expect(byKey(evaluate({ rules: [nightly], latest: [stale], syncLogs: syncs, now: at('2026-11-02T06:30:00Z') }))['rep893mt.xls']).toBeUndefined()
  })
})

describe('coverage guard ignores files the sync no longer sees', () => {
  const l = obs({ file_name: '722pupik.xlsx', first_seen: '2026-10-04T16:31:00Z', observed_at: '2026-10-04T16:31:00Z' })
  const now = at('2026-11-04T09:00:00Z') // Wednesday midday local
  it('a one-off file seen once a month ago gives green (closes the old incident), not red', () => {
    const r = evaluate({ rules: [], latest: [l], syncLogs: [], now })
    expect(byKey(r)['coverage:722pupik.xlsx'].status).toBe('green')
    expect(r.unruled).toEqual([])
  })
  it('a file still loaded stays red after 3 days', () => {
    const r = evaluate({ rules: [], latest: [{ ...l, observed_at: '2026-11-04T08:00:00Z' }], syncLogs: [], now })
    expect(byKey(r)['coverage:722pupik.xlsx'].status).toBe('red')
    expect(r.unruled).toEqual(['722pupik.xlsx'])
  })
})

describe('debt aging job check (erp_job_results)', () => {
  const job = (task: string, startedAt: string, exit: number, extra: Partial<JobResult> = {}): JobResult => ({ task, started_at: startedAt, exit_code: exit, attempts: 1, ...extra })
  const run = (jobs: JobResult[], now: string, extra = {}) => byKey(evaluate({ rules: [], latest: [], syncLogs: [], now: at(now), jobs, ...extra }))
  // Friday 2026-10-30 23:00 local (UTC+2 after the clock change) = 21:00Z. Saturday 2026-10-31 07:00 local = 05:00Z.
  const oldOk = job('Aging-pupik', '2026-10-30T10:29:55Z', 0) // the attended run, Friday morning of the week before
  it('anchor is the latest Friday 22:00 local', () => {
    expect(lastFridayAnchor(at('2026-10-31T06:00:00Z'))?.toISOString()).toBe('2026-10-30T20:00:00.000Z')
  })
  it('no verdict before Saturday 07:00 and none without any recorded job (BETA)', () => {
    expect(run([oldOk], '2026-10-31T04:00:00Z')['job:Aging-pupik']).toBeUndefined()
    expect(run([], '2026-11-07T06:00:00Z')['job:Aging-pupik']).toBeUndefined()
  })
  it('Friday run failed: red on Saturday morning, with attempts and exit code', () => {
    const s = run([oldOk, job('Aging-pupik', '2026-10-30T21:00:00Z', 1)], '2026-10-31T05:30:00Z')['job:Aging-pupik']
    expect(s.status).toBe('red'); expect(s.reason).toContain('failed this week'); expect(s.reason).toContain('exit code 1')
    expect(s.file_group).toBe('debt'); expect(s.company).toBe('pupik')
  })
  it('export timeout counts as failed even with exit code 0', () => {
    expect(run([job('Aging-monkeytime', '2026-10-30T21:00:00Z', 0, { export_timeout: true }), job('Aging-monkeytime', '2026-10-01T21:00:00Z', 0)], '2026-10-31T05:30:00Z')['job:Aging-monkeytime'].status).toBe('red')
  })
  it('did not run at all this week (but ran before): red', () => {
    const s = run([oldOk], '2026-10-31T05:30:00Z')['job:Aging-pupik']
    expect(s.status).toBe('red'); expect(s.reason).toContain('did not run')
  })
  it('a retry on a later night that succeeds turns it green', () => {
    const jobs = [job('Aging-pupik', '2026-10-30T21:00:00Z', 1), job('Aging-pupik', '2026-10-31T21:00:00Z', 0)]
    expect(run(jobs, '2026-11-01T05:30:00Z')['job:Aging-pupik'].status).toBe('green')
  })
  it('success on Friday night is green, and pupik and monkeytime are independent', () => {
    const r = run([job('Aging-pupik', '2026-10-30T21:00:00Z', 0), job('Aging-monkeytime', '2026-10-30T21:20:00Z', 1)], '2026-10-31T05:30:00Z')
    expect(r['job:Aging-pupik'].status).toBe('green'); expect(r['job:Aging-monkeytime'].status).toBe('red')
  })
  it('after 22:00 on a normal weekday nothing new may open (gated), but Saturday 07:00+ may', () => {
    expect(run([oldOk], '2026-11-03T21:30:00Z')['job:Aging-pupik']).toBeUndefined() // Tue 23:30 local, week not ok
  })
})

describe('digest emails', () => {
  const st = (key: string, status: 'red' | 'amber' | 'green' = 'red', reason = `${key} is late`) => ({ check_key: key, file_name: key, file_group: 'p1', company: 'pupik', status, reason, modified_at: null, age_hours: 5, rows_loaded: null })
  const url = 'https://x.app/admin/data-health'
  it('a single incident is exactly the old alert', () => {
    const e = digestEmail([{ s: st('a.xls'), reminder: false }], url)
    expect(e.subject).toBe('[Dashboard data] RED: a.xls is late')
    expect(digestEmail([{ s: st('a.xls'), reminder: true }], url).subject).toBe('[Dashboard data] STILL RED: a.xls is late')
  })
  it('several incidents become one mail, new first, subject with count and first reason', () => {
    const e = digestEmail([{ s: st('z.xls'), reminder: true }, { s: st('b<i>.xls', 'red', 'b<i> is late'), reminder: false }, { s: st('a.xls'), reminder: false }], url)
    expect(e.subject).toBe('[Dashboard data] RED: 3 issues (2 new) - a.xls is late')
    expect(e.html.indexOf('a.xls')).toBeLessThan(e.html.indexOf('z.xls'))
    expect(e.html).not.toContain('<i>'); expect(e.html).toContain('b&lt;i&gt;'); expect(e.text).toContain('STILL RED: z.xls is late')
    expect(digestEmail([{ s: st('a.xls'), reminder: false }, { s: st('b.xls'), reminder: false }], url).subject).toBe('[Dashboard data] RED: 2 new issues - a.xls is late')
    expect(digestEmail([{ s: st('a.xls'), reminder: true }, { s: st('b.xls'), reminder: true }], url).subject).toBe('[Dashboard data] STILL RED: 2 issues - a.xls is late')
  })
  it('resolved digest: single is the old mail, several are one mail with the longest first', () => {
    const now = new Date('2026-11-04T10:00:00Z')
    expect(resolvedDigestEmail([{ checkKey: 'a.xls', openedAt: '2026-11-04T07:00:00Z' }], now, url).subject).toBe('[Dashboard data] OK again: a.xls (was red 3 h)')
    const e = resolvedDigestEmail([{ checkKey: 'a.xls', openedAt: '2026-11-04T07:00:00Z' }, { checkKey: 'b.xls', openedAt: '2026-11-02T10:00:00Z' }], now, url)
    expect(e.subject).toBe('[Dashboard data] OK again: 2 issues (b.xls +1 more, longest red 2 d 0 h)')
    expect(e.html.indexOf('b.xls')).toBeLessThan(e.html.indexOf('a.xls'))
  })
})
