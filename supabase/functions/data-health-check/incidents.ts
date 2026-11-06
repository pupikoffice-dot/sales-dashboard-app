// Pure incident bookkeeping for the data health monitor: which incidents to open, close or remind.
import type { Status } from './evaluate.ts'

export type OpenIncident = {
  id: number; check_key: string; opened_at: string; acknowledged_at: string | null
  last_notified_at: string | null; reason: string
}
export type ClosedIncident = { check_key: string; closed_at: string }
/** `quiet`: check keys in `open` that re-open within REOPEN_DAMP_H of their last close: the in-app incident is created, but no mail (flapping). */
export type Plan = { open: Status[]; close: OpenIncident[]; remind: OpenIncident[]; quiet: string[] }

export const REOPEN_DAMP_H = 6

const DAY = 86_400_000

export function planIncidents(statuses: Status[], openIncidents: OpenIncident[], now: Date, recentClosed: ClosedIncident[] = []): Plan {
  const byKey = new Map(openIncidents.map(i => [i.check_key, i]))
  const plan: Plan = { open: [], close: [], remind: [], quiet: [] }
  for (const s of statuses) {
    const inc = byKey.get(s.check_key)
    if (s.status === 'red') {
      if (!inc) {
        plan.open.push(s)
        const lastClose = Math.max(0, ...recentClosed.filter(c => c.check_key === s.check_key).map(c => new Date(c.closed_at).getTime()))
        if (lastClose && now.getTime() - lastClose < REOPEN_DAMP_H * 3_600_000) plan.quiet.push(s.check_key)
      }
      else if (!inc.acknowledged_at
        && (!inc.last_notified_at || now.getTime() - new Date(inc.last_notified_at).getTime() >= DAY)) plan.remind.push(inc)
    } else if (inc && s.status !== 'grey') {
      plan.close.push(inc)
    }
  }
  return plan
}
