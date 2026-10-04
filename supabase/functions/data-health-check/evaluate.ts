// Pure evaluation for the data health monitor. No Deno or browser APIs: imported by the
// edge function and by vitest (src/lib/dataHealth/evaluate.test.ts).
export type Rule = {
  file_name: string; company: string | null; file_group: string; fix_hint: string; impact: string
  rule_kind: 'age' | 'nightly' | 'frozen'; max_age_hours: number | null
  eval_from: string | null; eval_to: string | null; active: boolean
  /** false = skip the rows-dropped check (row count varies by design, e.g. 891 month-scoped files) */
  rows_check?: boolean
}
export type Latest = {
  file_name: string; observed_at: string; modified_at: string | null
  rows_loaded: number | null; processed: boolean; history: number[]
}
export type SyncLog = { id: string; started_at: string; status: string }
export type Colour = 'green' | 'amber' | 'red' | 'grey'
export type Status = {
  check_key: string; file_name: string | null; file_group: string; company: string | null
  status: Colour; reason: string; modified_at: string | null; age_hours: number | null; rows_loaded: number | null
}
/** ignoreCalendar: test switch (data_health_settings.ignore_calendar) - skip the Saturday, hours and rule-window gates. */
export type EvalInput = { rules: Rule[]; latest: Latest[]; syncLogs: SyncLog[]; now: Date; ignoreCalendar?: boolean }

const TZ = 'Asia/Jerusalem'
const DAY_FROM = 7 * 60, DAY_TO = 22 * 60          // checker active window (local)
const SYNC_FROM = 8 * 60                            // sync-health window starts 08:00
const H = 3_600_000

export function localParts(d: Date): { weekday: string; minutes: number; date: string } {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]))
  return { weekday: p.weekday, minutes: Number(p.hour) * 60 + Number(p.minute), date: `${p.year}-${p.month}-${p.day}` }
}

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }

/**
 * Wall-clock hours between two instants, minus Saturday hours in between (no work on Saturday).
 * Exact (hour by hour) up to 14 days; beyond that 6/7 of wall time, which is precise enough for
 * the 7/14/30-day manual rules and keeps the edge function far inside its CPU budget.
 */
export function effectiveAgeHours(from: Date, to: Date): number {
  let hours = (to.getTime() - from.getTime()) / H
  if (hours > 14 * 24) return Math.max(0, (hours * 6) / 7)
  for (let t = from.getTime(); t < to.getTime(); t += H) {
    if (localParts(new Date(t)).weekday === 'Sat') hours -= Math.min(1, (to.getTime() - t) / H)
  }
  return Math.max(0, hours)
}

export const fmtAge = (h: number) => (h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`)

export function evaluate({ rules, latest, syncLogs, now, ignoreCalendar = false }: EvalInput): { statuses: Status[]; unruled: string[] } {
  const local = localParts(now)
  const ruled = new Set(rules.map(r => r.file_name.toLowerCase()))
  const unruled = latest.filter(l => l.processed && !ruled.has(l.file_name.toLowerCase())).map(l => l.file_name).sort()
  if (!ignoreCalendar && (local.weekday === 'Sat' || local.minutes < DAY_FROM || local.minutes > DAY_TO)) return { statuses: [], unruled }

  const byFile = new Map(latest.map(l => [l.file_name.toLowerCase(), l]))
  const out: Status[] = []

  for (const r of rules) {
    if (!r.active) continue
    if (!ignoreCalendar && r.eval_from && local.minutes < toMin(r.eval_from)) continue
    if (!ignoreCalendar && r.eval_to && local.minutes > toMin(r.eval_to)) continue
    const l = byFile.get(r.file_name.toLowerCase())
    const base = { check_key: r.file_name, file_name: r.file_name, file_group: r.file_group, company: r.company }
    if (!l || !l.modified_at) {
      out.push({ ...base, status: r.rule_kind === 'frozen' ? 'grey' : 'red', reason: `${r.file_name} was not found by the sync`,
        modified_at: null, age_hours: null, rows_loaded: null })
      continue
    }
    const mod = new Date(l.modified_at)
    const age = effectiveAgeHours(mod, now)
    const common = { modified_at: l.modified_at, age_hours: Math.round(age * 10) / 10, rows_loaded: l.rows_loaded }
    if (r.rule_kind === 'frozen') {
      out.push({ ...base, ...common, status: 'grey', reason: 'frozen (historical) - not checked' })
    } else if (r.rule_kind === 'nightly') {
      const fresh = localParts(mod).date === local.date
      out.push({ ...base, ...common, status: fresh ? 'green' : 'red',
        reason: fresh ? 'refreshed overnight' : `${r.file_name} was not refreshed overnight (last ${localParts(mod).date})` })
    } else {
      const limit = r.max_age_hours ?? 0
      const status: Colour = age > limit ? 'red' : age > 0.75 * limit ? 'amber' : 'green'
      out.push({ ...base, ...common, status,
        reason: status === 'green' ? `${fmtAge(age)} old` : `${r.file_name} is ${fmtAge(age)} old (limit ${fmtAge(limit)})` })
    }
    if (r.rule_kind !== 'frozen' && l.processed && l.rows_loaded !== null) {
      const hist = l.history ?? []
      const sorted = [...hist].sort((a, b) => a - b)
      const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
      let bad: string | null = null
      // 0 rows after a non-zero run is always an alarm (the sync skips a file it cannot read safely);
      // the proportional drop is skipped for files whose row count varies by design (rows_check=false).
      if (l.rows_loaded === 0 && (hist[0] ?? 0) > 0) bad = `${r.file_name} loaded 0 rows (previous run ${hist[0]}) - file skipped or empty`
      else if (r.rows_check !== false && hist.length >= 3 && l.rows_loaded < 0.7 * median) bad = `${r.file_name} loaded ${l.rows_loaded} rows, usually ${median}`
      out.push({ ...base, check_key: `rows:${r.file_name}`, status: bad ? 'red' : 'green', reason: bad ?? `${l.rows_loaded} rows`,
        modified_at: l.modified_at, age_hours: null, rows_loaded: l.rows_loaded })
    }
  }

  if (ignoreCalendar || local.minutes >= SYNC_FROM) {
    const sorted = [...syncLogs].sort((a, b) => b.started_at.localeCompare(a.started_at))
    const lastOk = sorted.find(s => s.status === 'success')
    const okAge = lastOk ? (now.getTime() - new Date(lastOk.started_at).getTime()) / H : Infinity
    out.push({ check_key: 'sync:no_success', file_name: null, file_group: 'sync', company: null,
      status: okAge > 2 ? 'red' : 'green', modified_at: lastOk?.started_at ?? null,
      age_hours: isFinite(okAge) ? Math.round(okAge * 10) / 10 : null, rows_loaded: null,
      reason: okAge > 2 ? `No successful sync for ${isFinite(okAge) ? fmtAge(okAge) : 'a long time'} - is smartpupik running?` : 'syncing normally' })
    const stuck = sorted.find(s => s.status === 'running'
      && (now.getTime() - new Date(s.started_at).getTime()) / H > 0.75
      && !sorted.some(o => o.status === 'success' && o.started_at > s.started_at))
    out.push({ check_key: 'sync:stuck', file_name: null, file_group: 'sync', company: null,
      status: stuck ? 'red' : 'green', modified_at: stuck?.started_at ?? null, age_hours: null, rows_loaded: null,
      reason: stuck ? `A sync started ${stuck.started_at} is still 'running' (interrupted?)` : 'no stuck sync' })
  }
  return { statuses: out, unruled }
}
