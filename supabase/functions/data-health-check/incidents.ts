// Pure incident bookkeeping for the data health monitor: which incidents to open, close or remind.
import type { Status } from './evaluate.ts'

export type OpenIncident = {
  id: number; check_key: string; opened_at: string; acknowledged_at: string | null
  last_notified_at: string | null; reason: string
}
export type Plan = { open: Status[]; close: OpenIncident[]; remind: OpenIncident[] }

const DAY = 86_400_000

export function planIncidents(statuses: Status[], openIncidents: OpenIncident[], now: Date): Plan {
  const byKey = new Map(openIncidents.map(i => [i.check_key, i]))
  const plan: Plan = { open: [], close: [], remind: [] }
  for (const s of statuses) {
    const inc = byKey.get(s.check_key)
    if (s.status === 'red') {
      if (!inc) plan.open.push(s)
      else if (!inc.acknowledged_at
        && (!inc.last_notified_at || now.getTime() - new Date(inc.last_notified_at).getTime() >= DAY)) plan.remind.push(inc)
    } else if (inc && s.status !== 'grey') {
      plan.close.push(inc)
    }
  }
  return plan
}
