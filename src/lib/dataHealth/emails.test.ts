import { describe, expect, it } from 'vitest'
import { alertEmail, categoryHeldEmail, resolvedEmail, summaryEmail, uncategorizedEmail, durationText } from '../../../supabase/functions/data-health-check/emails.ts'

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
  it('summary mentions the counts but carries no table (each company has its own mail)', () => {
    const e = summaryEmail({ statuses: [s], openCount: 0, unruled: [], dateLabel: 'Mon 02-Nov', url,
      uncategorized: [{ company: 'pupik', sku: 'A-1', name: 'Alpha', qty: 5 }, { company: 'mt', sku: 'B-2', name: 'Beta', qty: 3 }] })
    expect(e.text).toContain('2 items (mt 1, pupik 1)')
    expect(e.table).toBeUndefined()
  })
  it('one uncategorised mail per company, company in the subject and file name', () => {
    const e = uncategorizedEmail('mt', [{ company: 'mt', sku: 'B-2', name: 'Beta', qty: 3 }], '2026-11-03', url)
    expect(e.subject).toBe('[Dashboard data] [MONKEYTIME] In stock without a category: 1 item (2026-11-03)')
    expect(e.table?.filename).toBe('in_stock_no_category_mt_2026-11-03.xlsx')
    expect(e.table?.headers).toEqual(['SKU', 'Item name', 'Stock'])
    expect(e.table?.rows[0]).toEqual(['B-2', 'Beta', 3])
    expect(uncategorizedEmail('pupik', [], '2026-11-03', url).subject).toContain('[PUPIK]')
  })
  it('no-category alerts name the company in the subject', () => {
    const a = alertEmail({ ...s, check_key: 'content:nocat:mt', company: 'mt', reason: '2 item(s) newly in stock without a category' }, undefined, url, false)
    expect(a.subject).toBe('[Dashboard data] [MONKEYTIME] RED: 2 item(s) newly in stock without a category')
  })
  describe('html', () => {
    const sts = [
      { ...s, check_key: 'g-ok.xls', status: 'green' as const, reason: 'fresh', file_group: 'a_group' },
      { ...s, check_key: 'warn.xls', status: 'amber' as const, reason: 'getting old', file_group: 'b_group' },
      { ...s, check_key: 'bad<b>.xls', file_name: '855PUP.xls', status: 'red' as const, reason: 'is <script>x</script> & late', file_group: 'z_group' },
    ]
    const e = summaryEmail({ statuses: sts, openCount: 2, unruled: ['new&.xls'], dateLabel: 'Mon', url, rules: { '855PUP.xls': rule } })
    it('is a full responsive document with the page link', () => {
      expect(e.html).toMatch(/^<!DOCTYPE html>/); expect(e.html).toContain('width=device-width'); expect(e.html).toContain(`href="${url}"`)
      expect(e.html).not.toMatch(/<img|<link|@import|src=/)
    })
    it('escapes user text', () => {
      expect(e.html).not.toContain('<script>'); expect(e.html).toContain('&lt;script&gt;x&lt;/script&gt; &amp; late')
      expect(e.html).toContain('bad&lt;b&gt;.xls'); expect(e.html).toContain('new&amp;.xls')
      expect(alertEmail({ ...s, reason: '<i>x</i>' }, { fix_hint: '<u>', impact: '"q"' }, url, false).html).not.toMatch(/<i>x|<u>/)
    })
    it('shows the counts', () => { expect(e.html).toMatch(/>1<\/div>\s*<div[^>]*>red</); expect(e.html).toMatch(/>2<\/div>\s*<div[^>]*>open incidents</) })
    it('lists red before amber before green, with the fix on red', () => {
      const at = (x: string) => e.html.indexOf(x)
      expect(at('bad&lt;b')).toBeLessThan(at('warn.xls')); expect(at('warn.xls')).toBeLessThan(at('g-ok.xls'))
      expect(e.html).toContain('Run REP855&amp;854ALL.BAT')
      // the red group is listed before the green one in the group section too
      expect(e.html.lastIndexOf('z_group')).toBeLessThan(e.html.lastIndexOf('a_group'))
    })
    it('alert, resolved and no-category mails are HTML too', () => {
      expect(alertEmail(s, rule, url, true).html).toContain('STILL RED')
      expect(resolvedEmail('x&y', '2026-10-02T06:00:00Z', new Date('2026-10-03T06:00:00Z'), url).html).toContain('x&amp;y is OK again')
      const u = uncategorizedEmail('mt', [{ company: 'mt', sku: 'B<2', name: 'Beta', qty: 3 }], '2026-11-03', url)
      expect(u.html).toContain('MONKEYTIME'); expect(u.html).toContain('B&lt;2'); expect(u.table?.rows.length).toBe(1)
    })
  })
  it('category control: held-batch mail names the company and the numbers; summary carries the counts', () => {
    const e = categoryHeldEmail([{ id: 1, company: 'mt', newFlags: 562, newRestores: 35, threshold: 47, catalogItems: 956 }], url)
    expect(e.subject).toBe('[Dashboard data] Category control: batch held for approval (MONKEYTIME)')
    expect(e.text).toContain('35 automatic restores waiting (limit 47')
    expect(e.html).toContain('Category control')
    expect(e.html).toContain(url)
    const sum = summaryEmail({ statuses: [s], openCount: 0, unruled: [], dateLabel: 'Mon 02-Nov', url, categoryControl: { toDecide: 3, restorePending: 4, held: 1 } })
    expect(sum.text).toContain('Category control: 3 to decide, 4 restore pending, 1 held batch.')
    expect(sum.html).toContain('3 to decide')
    expect(summaryEmail({ statuses: [s], openCount: 0, unruled: [], dateLabel: 'x', url }).text).not.toContain('Category control')
  })
})
