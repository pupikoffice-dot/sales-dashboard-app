import { describe, expect, it } from 'vitest'
import { itemsForUser, monitorStale, oldestUpdate, sourceLabel, summarise, unacknowledgedRed } from './notices'
import type { NoticeItem } from './api'

const item = (check_key: string, company: string | null, status: 'red' | 'amber' = 'red', modified_at: string | null = null): NoticeItem =>
  ({ check_key, file_group: 'p1', company, status, modified_at, age_hours: null })

describe('notices', () => {
  it('names sources in plain language', () => {
    expect(sourceLabel('rep891pupik.xls')).toBe('Sales')
    expect(sourceLabel('content:rep891mt:mt')).toBe('Sales')
    expect(sourceLabel('722mt.xls')).toBe('Orders')
    expect(sourceLabel('sync:no_success')).toBe('Data sync')
  })
  it('a user is told only about red sources of his own companies that feed his screens', () => {
    const items = [item('rep891pupik.xls', 'pupik'), item('rep891mt.xls', 'mt'), item('722pupik.xls', 'pupik', 'amber'),
      item('rep894gold.xls', 'gold'), item('rows:rep891pupik.xls', 'pupik'), item('sync:no_success', null)]
    expect(itemsForUser(items, ['pupik']).map(i => i.check_key)).toEqual(['rep891pupik.xls', 'sync:no_success'])
  })
  it('known-broken sources never reach users; acknowledged ones leave the admin count', () => {
    const dead = { ...item('rep891grow.xls', 'grow'), file_group: 'known_broken' }
    expect(itemsForUser([dead], ['grow'])).toEqual([])
    const acked = { ...item('rep891pupik.xls', 'pupik'), acknowledged: true }
    expect(itemsForUser([acked], ['pupik'])).toHaveLength(1)           // users still see real stale data
    expect(unacknowledgedRed([acked, item('722mt.xls', 'mt')]).map(i => i.check_key)).toEqual(['722mt.xls'])
  })
  it('summarises per source with companies', () => {
    const s = summarise([item('rep891pupik.xls', 'pupik'), item('rep891mt.xls', 'mt'), item('722pupik.xls', 'pupik')])
    expect(s).toBe('Sales (Pupik, Monkeytime), Orders (Pupik)')
  })
  it('oldest update is the earliest modified time', () => {
    expect(oldestUpdate([item('a', null, 'red', '2026-10-26T10:00:00Z'), item('b', null, 'red', '2026-10-25T10:00:00Z')])).toBe('2026-10-25T10:00:00Z')
    expect(oldestUpdate([item('a', null)])).toBeNull()
  })
  it('monitor stale: only in working hours and only after 2 h', () => {
    const now = new Date('2026-10-29T09:00:00Z') // Thu 12:00 local
    expect(monitorStale('2026-10-29T08:00:00Z', now)).toBe(false)
    expect(monitorStale('2026-10-29T05:00:00Z', now)).toBe(true)
    expect(monitorStale(null, now)).toBe(true)
    expect(monitorStale('2026-10-28T05:00:00Z', new Date('2026-10-31T09:00:00Z'))).toBe(false) // Saturday
    expect(monitorStale('2026-10-28T05:00:00Z', new Date('2026-10-29T03:00:00Z'))).toBe(false) // 06:00 local
  })
})
