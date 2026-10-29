// Turns the late-source list into the sentences users and admins see in the app banner. Pure, unit tested.
import type { NoticeItem } from './api'

const COMPANY_NAME: Record<string, string> = { pupik: 'Pupik', mt: 'Monkeytime', grow: 'Grow', gold: 'Goldbug' }

/** Plain-language name of a source, from its check key. */
export function sourceLabel(checkKey: string): string {
  const k = checkKey.toLowerCase().replace(/^rows:/, '')
  if (k.startsWith('content:rep891') || k.startsWith('rep891')) return 'Sales'
  if (k.startsWith('content:722') || k.startsWith('722')) return 'Orders'
  if (k.startsWith('content:720') || k.startsWith('720')) return 'Open deliveries'
  if (k.startsWith('721')) return 'Open orders'
  if (k.startsWith('collectyear008')) return 'Receipts'
  if (k.startsWith('rep895')) return 'Purchases'
  if (k.startsWith('rep896')) return 'Stock moves'
  if (k.startsWith('sync:')) return 'Data sync'
  if (k.startsWith('coverage:')) return 'Monitoring coverage'
  return checkKey
}

/** Sources every user depends on: sales, orders, deliveries, receipts and the sync itself. */
const USER_VISIBLE = /^(content:|rep891|722|720|721|collectyear008|sync:)/i

/** Items a normal user should be told about: late (red) sources of his own companies that feed his screens.
 *  Sources the owner marked "known broken" (dead for months, e.g. Grow) are not a surprise to anyone, so they stay out. */
export function itemsForUser(items: NoticeItem[], companies: string[]): NoticeItem[] {
  return items.filter(i => i.status === 'red' && i.file_group !== 'known_broken' && USER_VISIBLE.test(i.check_key)
    && (i.company === null || companies.includes(i.company)))
}

/** What the admin bar and the menu badge count: red and not yet acknowledged by anyone. */
export const unacknowledgedRed = (items: NoticeItem[]): NoticeItem[] => items.filter(i => i.status === 'red' && !i.acknowledged)

/** "Sales (Pupik, Monkeytime), Orders (Pupik)" - one entry per source with the affected companies. */
export function summarise(items: NoticeItem[]): string {
  const by = new Map<string, Set<string>>()
  for (const i of items) {
    const label = sourceLabel(i.check_key)
    const set = by.get(label) ?? new Set<string>()
    if (i.company) set.add(COMPANY_NAME[i.company] ?? i.company)
    by.set(label, set)
  }
  return [...by.entries()].map(([l, cs]) => (cs.size ? `${l} (${[...cs].join(', ')})` : l)).join(', ')
}

/** The oldest "last updated" among the items. */
export function oldestUpdate(items: NoticeItem[]): string | null {
  const t = items.map(i => i.modified_at).filter((x): x is string => !!x).sort()
  return t[0] ?? null
}

/** True when the checker itself has not run for over 2 hours during Israeli working hours (Sun-Fri 08:00-22:00). */
export function monitorStale(lastRunAt: string | null, now: Date): boolean {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', weekday: 'short', hour: '2-digit', hourCycle: 'h23' })
  const p = Object.fromEntries(f.formatToParts(now).map(x => [x.type, x.value]))
  const hour = Number(p.hour)
  if (p.weekday === 'Sat' || hour < 8 || hour >= 22) return false
  if (!lastRunAt) return true
  return now.getTime() - new Date(lastRunAt).getTime() > 2 * 3_600_000
}
