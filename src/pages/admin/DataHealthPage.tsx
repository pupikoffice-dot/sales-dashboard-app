import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDataHealthIncidents, useDataHealthRules, useDataHealthStatuses } from '../../hooks/useDataHealth'
import { acknowledgeIncident, type StatusRow } from '../../lib/dataHealth/api'
import { monthlyStats, redSegments } from '../../lib/dataHealth/timeline'

// Data health monitor page (super-admin). Spec: docs/superpowers/specs/2026-10-03-data-health-monitor-design.md
const COLOUR: Record<StatusRow['status'], string> = { green: '#2e7d32', amber: '#ed8c00', red: '#c62828', grey: '#9e9e9e' }
const age = (h: number | null) => (h === null ? '-' : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d`)

export function DataHealthPage() {
  const [days, setDays] = useState(30)
  const statuses = useDataHealthStatuses()
  const rules = useDataHealthRules()
  const incidents = useDataHealthIncidents(days)
  const qc = useQueryClient()
  const ack = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string | null }) => acknowledgeIncident(id, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dataHealth'] }),
  })

  const ruleBy = useMemo(() => new Map((rules.data ?? []).map(r => [r.file_name, r])), [rules.data])
  const groups = useMemo(() => {
    const m = new Map<string, StatusRow[]>()
    for (const s of statuses.data ?? []) m.set(s.file_group, [...(m.get(s.file_group) ?? []), s])
    return [...m.entries()]
  }, [statuses.data])
  const groupByKey = useMemo(() => new Map((statuses.data ?? []).map(s => [s.check_key, s.file_group])), [statuses.data])
  const open = (incidents.data ?? []).filter(i => !i.closed_at)
  const to = new Date(), from = new Date(to.getTime() - days * 86_400_000)
  const stats = monthlyStats(incidents.data ?? [], k => groupByKey.get(k) ?? ruleBy.get(k)?.file_group ?? 'other')
  const lastEval = (statuses.data ?? []).reduce<string | null>((m, s) => (!m || s.evaluated_at > m ? s.evaluated_at : m), null)

  if (statuses.isLoading) return <p className="status-msg p-6">Loading…</p>
  if (statuses.error) return <p className="status-msg error p-6">Failed to load: {String(statuses.error)}</p>

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Data health</h1>
        <p className="text-sm text-gray-500">
          Checked every 30 min, Sun–Fri 07:00–22:00. Last check: {lastEval ? new Date(lastEval).toLocaleString() : 'not yet'}.
        </p>
      </div>

      <section>
        <h2 className="font-semibold mb-2">Open incidents ({open.length})</h2>
        {open.length === 0 && <p className="text-sm text-gray-500">None.</p>}
        <ul className="space-y-2">
          {open.map(i => (
            <li key={i.id} className="border rounded p-2 text-sm" style={{ borderLeft: `4px solid ${COLOUR.red}` }}>
              <div><span style={{ color: COLOUR.red }}>● red</span> <b>{i.check_key}</b> — {i.reason} (since {new Date(i.opened_at).toLocaleString()})</div>
              {ruleBy.get(i.check_key) && <div className="text-gray-600">How to fix: {ruleBy.get(i.check_key)!.fix_hint}</div>}
              {i.acknowledged_at
                ? <div className="text-gray-500">Acknowledged {new Date(i.acknowledged_at).toLocaleString()}{i.notes ? ` — ${i.notes}` : ''}</div>
                : <button type="button" className="nav-btn mt-1" disabled={ack.isPending}
                    onClick={() => ack.mutate({ id: i.id, notes: window.prompt('Note (optional)') || null })}>Acknowledge</button>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="font-semibold">Files</h2>
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="border rounded px-1 text-sm">
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
        {groups.length === 0 && <p className="text-sm text-gray-500">No checks yet (the checker runs Sun–Fri 07:00–22:00).</p>}
        {groups.map(([g, rows]) => (
          <div key={g} className="mb-4 overflow-x-auto">
            <h3 className="font-medium">{g}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th>Check</th><th>Status</th><th>Age</th><th>Reason</th><th>Producer / how to fix</th><th className="w-48">Last {days} days</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(s => {
                  const segs = redSegments((incidents.data ?? []).filter(i => i.check_key === s.check_key), from, to)
                  const r = ruleBy.get(s.file_name ?? '')
                  return (
                    <tr key={s.check_key} className="border-t align-top">
                      <td>{s.check_key}</td>
                      <td><span style={{ color: COLOUR[s.status] }}>● {s.status}</span></td>
                      <td>{age(s.age_hours)}</td>
                      <td>{s.reason}</td>
                      <td>{r ? `${r.producer} — ${r.fix_hint}` : ''}</td>
                      <td>
                        <div className="relative h-3 rounded" style={{ background: '#e8f5e9' }} title="red = incident">
                          {segs.map((x, n) => (
                            <div key={n} className="absolute h-3 rounded"
                              style={{ left: `${x.startPct}%`, width: `${Math.max(0.5, x.endPct - x.startPct)}%`, background: COLOUR.red, opacity: x.open ? 1 : 0.7 }} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Monthly totals</h2>
        {stats.length === 0 ? <p className="text-sm text-gray-500">No incidents in this period.</p> : (
          <table className="text-sm">
            <thead>
              <tr className="text-left text-gray-500"><th className="pr-4">Month</th><th className="pr-4">Group</th><th className="pr-4">Incidents</th><th>Avg hours to fix</th></tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={`${s.month}|${s.group}`}><td className="pr-4">{s.month}</td><td className="pr-4">{s.group}</td><td className="pr-4">{s.count}</td><td>{s.avgHoursToFix ?? '-'}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
