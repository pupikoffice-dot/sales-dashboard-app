import { describe, expect, it } from 'vitest'
import { defaultYears, yearFingerprint, type YearInfo } from './loadFromSupabase'

describe('year scoped loading helpers', () => {
  it('downloads this year and last year by default', () => {
    expect(defaultYears(new Date('2026-10-22T10:00:00Z'))).toEqual([2026, 2025])
    expect(defaultYears(new Date('2027-01-02T10:00:00Z'))).toEqual([2027, 2026])
  })

  it('fingerprint changes when a company\'s rows or sync time for that year change, and ignores other years', () => {
    const infos: YearInfo[] = [
      { company: 'pupik', year: 2022, rows: 100, synced: 'a' },
      { company: 'mt', year: 2022, rows: 50, synced: 'b' },
      { company: 'pupik', year: 2023, rows: 7, synced: 'c' },
    ]
    const base = yearFingerprint(infos, 2022)
    expect(base).toBe(yearFingerprint([...infos].reverse(), 2022))
    expect(yearFingerprint([{ ...infos[0], rows: 101 }, infos[1], infos[2]], 2022)).not.toBe(base)
    expect(yearFingerprint([infos[0], infos[1], { ...infos[2], rows: 8 }], 2022)).toBe(base)
    expect(yearFingerprint(infos, 2019)).toBe('')
  })
})
