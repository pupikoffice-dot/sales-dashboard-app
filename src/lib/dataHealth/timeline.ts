// Pure helpers for the Data health page: incident bars per file and monthly totals.
export type IncidentRow = {
  id: number; check_key: string; opened_at: string; closed_at: string | null
  reason: string; acknowledged_at: string | null; notes: string | null
}
export type Segment = { startPct: number; endPct: number; open: boolean }

/** Incidents clipped to [from, to] as percentages of the window; open incidents run to `to`. */
export function redSegments(incidents: IncidentRow[], from: Date, to: Date): Segment[] {
  const span = to.getTime() - from.getTime()
  return incidents
    .map(i => {
      const s = Math.max(new Date(i.opened_at).getTime(), from.getTime())
      const e = Math.min(i.closed_at ? new Date(i.closed_at).getTime() : to.getTime(), to.getTime())
      return e > s ? { startPct: ((s - from.getTime()) / span) * 100, endPct: ((e - from.getTime()) / span) * 100, open: !i.closed_at } : null
    })
    .filter((x): x is Segment => x !== null)
    .sort((a, b) => a.startPct - b.startPct)
}

/** Incidents per month and group, with the average hours from open to close (closed ones only). */
export function monthlyStats(incidents: IncidentRow[], groupOf: (checkKey: string) => string) {
  const acc = new Map<string, { month: string; group: string; count: number; fixed: number[] }>()
  for (const i of incidents) {
    const month = i.opened_at.slice(0, 7), group = groupOf(i.check_key), k = `${month}|${group}`
    const row = acc.get(k) ?? { month, group, count: 0, fixed: [] }
    row.count++
    if (i.closed_at) row.fixed.push((new Date(i.closed_at).getTime() - new Date(i.opened_at).getTime()) / 3_600_000)
    acc.set(k, row)
  }
  return [...acc.values()]
    .map(r => ({ month: r.month, group: r.group, count: r.count,
      avgHoursToFix: r.fixed.length ? Math.round((r.fixed.reduce((a, b) => a + b, 0) / r.fixed.length) * 10) / 10 : null }))
    .sort((a, b) => b.month.localeCompare(a.month) || a.group.localeCompare(b.group))
}
