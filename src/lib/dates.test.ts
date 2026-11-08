import { describe, expect, it } from 'vitest'

import { fmtDate, fmtDateTime, fmtDatesInText, maskDmy, parseDmy } from './dates'

describe('fmtDate', () => {
  it('turns a date column into DD/MM/YYYY', () => {
    expect(fmtDate('2026-11-08')).toBe('08/11/2026')
    expect(fmtDate('2026-01-05')).toBe('05/01/2026')
  })
  it('turns a timestamp into the Israel date', () => {
    expect(fmtDate('2026-11-07T23:30:00Z')).toBe('08/11/2026') // 01:30 on the 8th in Israel (UTC+2)
  })
  it('is empty for missing input and passes unknown text through', () => {
    expect(fmtDate(null)).toBe('')
    expect(fmtDate('')).toBe('')
    expect(fmtDate('n/a')).toBe('n/a')
  })
})

describe('fmtDateTime', () => {
  it('gives DD/MM/YYYY HH:MM in Israel time', () => {
    expect(fmtDateTime('2026-11-08T08:05:00Z')).toBe('08/11/2026 10:05')
  })
})

describe('fmtDatesInText', () => {
  it('rewrites ISO dates inside a sentence', () => {
    expect(fmtDatesInText('newest date is 2026-11-04, 2 working days ago')).toBe('newest date is 04/11/2026, 2 working days ago')
    expect(fmtDatesInText(null)).toBe('')
  })
})

describe('parseDmy / maskDmy', () => {
  it('reads what a person types', () => {
    expect(parseDmy('08/11/2026')).toBe('2026-11-08')
    expect(parseDmy('8.1.2026')).toBe('2026-01-08')
    expect(parseDmy('08112026')).toBe('2026-11-08')
  })
  it('refuses dates that do not exist', () => {
    expect(parseDmy('31/02/2026')).toBeNull()
    expect(parseDmy('11/08/20')).toBeNull()
    expect(parseDmy('32/01/2026')).toBeNull()
  })
  it('inserts the slashes while typing', () => {
    expect(maskDmy('0811')).toBe('08/11')
    expect(maskDmy('08112026')).toBe('08/11/2026')
    expect(maskDmy('081120261234')).toBe('08/11/2026')
  })
})
