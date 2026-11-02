import { describe, expect, it } from 'vitest'
import { alertEmail, resolvedEmail, summaryEmail, durationText } from '../../../supabase/functions/data-health-check/emails.ts'

const s = { check_key: '855PUP.xls', file_name: '855PUP.xls', file_group: 'manual_sales', company: 'pupik', status: 'red' as const, reason: '855PUP.xls is 9 days old (limit 7 days)', modified_at: null, age_hours: 216, rows_loaded: null }
const rule = { fix_hint: 'Run REP855&854ALL.BAT', impact: 'returns MTD' }
const url = 'https://example.app/admin/data-health'

describe('emails', () => {
  it('alert subject and body', () => {
    const e = alertEmail(s, rule, url, false)
    expect(e.subject).toBe('[Dashboard data] RED: 855PUP.xls is 9 days old (limit 7 days)')
    expect(e.text).toContain('Run REP855&854ALL.BAT'); expect(e.text).toContain('returns MTD'); expect(e.text).toContain(url)
    expect(e.html).toContain('REP855&amp;854ALL.BAT')
    expect(alertEmail(s, rule, url, true).subject).toMatch(/^\[Dashboard data\] STILL RED:/)
  })
  it('resolved subject with duration', () => {
    expect(resolvedEmail('855PUP.xls', '2026-10-02T06:00:00Z', new Date('2026-10-04T10:00:00Z'), url).subject)
      .toBe('[Dashboard data] OK again: 855PUP.xls (was red 2 d 4 h)')
  })
  it('duration text', () => { expect(durationText(3 * 3_600_000)).toBe('3 h'); expect(durationText(50 * 3_600_000)).toBe('2 d 2 h') })
  it('summary counts', () => {
    const e = summaryEmail({ statuses: [s, { ...s, check_key: 'a', status: 'green' }, { ...s, check_key: 'b', status: 'amber' }], openCount: 1, unruled: ['new.xls'], dateLabel: 'Sun 04-Oct', url })
    expect(e.subject).toBe('[Dashboard data] Daily status Sun 04-Oct: 1 red, 1 amber, 1 green')
    expect(e.text).toContain('new.xls')
  })
  it('summary lists the items without a category as text and as an html table', () => {
    const e = summaryEmail({ statuses: [s], openCount: 0, unruled: [], dateLabel: 'Mon 02-Nov', url,
      uncategorized: [{ company: 'pupik', sku: 'A-1', name: 'Alpha <b>', qty: 5 }, { company: 'mt', sku: 'B-2', name: 'Beta', qty: 3 }] })
    expect(e.text).toContain('In stock without a category (REP103 column I): 2 items')
    expect(e.text).toContain('pupik  A-1  Alpha <b>  qty 5')
    expect(e.html).toContain('<table')
    expect(e.html).toContain('Alpha &lt;b&gt;')
    expect(summaryEmail({ statuses: [s], openCount: 0, unruled: [], dateLabel: 'x', url }).html).not.toContain('<table')
  })
})
