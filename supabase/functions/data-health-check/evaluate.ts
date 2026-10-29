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
  /** when the sync first saw the file (coverage guard) */
  first_seen?: string | null
}
export type SyncLog = { id: string; started_at: string; status: string }
export type Colour = 'green' | 'amber' | 'red' | 'grey'
export type Status = {
  check_key: string; file_name: string | null; file_group: string; company: string | null
  status: Colour; reason: string; modified_at: string | null; age_hours: number | null; rows_loaded: number | null
}
/** One newest-date reading from data_health_content(): the newest date INSIDE a loaded table. */
export type ContentItem = { check_key: string; file_group: string; company: string | null; label: string; newest: string | null }
/** ignoreCalendar: test switch (data_health_settings.ignore_calendar) - skip the Saturday, hours and rule-window gates. */
export type EvalInput = { rules: Rule[]; latest: Latest[]; syncLogs: SyncLog[]; now: Date; ignoreCalendar?: boolean; content?: ContentItem[] }

const TZ = 'Asia/Jerusalem'
const DAY_FROM = 7 * 60, DAY_TO = 22 * 60          // checker active window (local)
const SYNC_FROM = 8 * 60                            // sync-health window starts 08:00
const CONTENT_FROM = 10 * 60, CONTENT_TO = 21 * 60  // content checks may OPEN incidents only in this window
const COVERAGE_AMBER_H = 24, COVERAGE_RED_H = 72   // a loaded file without a rule: amber after a day, red after three
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

/** Working days (Saturday excluded) after `newest` up to and including `today`; both 'YYYY-MM-DD'. */
export function workdayLag(newest: string, today: string): number {
  const parse = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd) }
  let n = 0
  for (let t = parse(newest) + 86_400_000; t <= parse(today); t += 86_400_000) if (new Date(t).getUTCDay() !== 6) n++
  return n
}

/**
 * Evaluate every rule. The checker ALWAYS evaluates (changed 2026-10-29): outside the working window (Saturday, before
 * 07:00 / after 22:00, outside a rule's own window) only GREEN results are written, so a refreshed file closes its
 * incident at any hour, while nothing new turns amber or red when nobody can act on it. `ignoreCalendar` removes the gate.
 */
export function evaluate({ rules, latest, syncLogs, now, ignoreCalendar = false, content = [] }: EvalInput): { statuses: Status[]; unruled: string[] } {
  const local = localParts(now)
  const ruled = new Set(rules.map(r => r.file_name.toLowerCase()))
  const unruledRows = latest.filter(l => l.processed && !ruled.has(l.file_name.toLowerCase()))
  const unruled = unruledRows.map(l => l.file_name).sort()
  const gatedNow = !ignoreCalendar && (local.weekday === 'Sat' || local.minutes < DAY_FROM || local.minutes > DAY_TO)

  const byFile = new Map(latest.map(l => [l.file_name.toLowerCase(), l]))
  const out: Status[] = []
  /** Record a result unless nobody can act now (gated) and it is not green. */
  const push = (s: Status, gated: boolean) => { if (!gated || s.status === 'green' || s.status === 'grey') out.push(s) }

  for (const r of rules) {
    if (!r.active) continue
    const beforeStart = !ignoreCalendar && !!r.eval_from && local.minutes < toMin(r.eval_from)
    const afterEnd = !ignoreCalendar && !!r.eval_to && local.minutes > toMin(r.eval_to)
    // A nightly file is not DUE before its start time: no verdict at all (a green would be yesterday's file).
    if (r.rule_kind === 'nightly' && beforeStart) continue
    const gated = gatedNow || beforeStart || afterEnd
    const l = byFile.get(r.file_name.toLowerCase())
    const base = { check_key: r.file_name, file_name: r.file_name, file_group: r.file_group, company: r.company }
    if (!l || !l.modified_at) {
      push({ ...base, status: r.rule_kind === 'frozen' ? 'grey' : 'red', reason: `${r.file_name} was not found by the sync`,
        modified_at: null, age_hours: null, rows_loaded: null }, gated)
      continue
    }
    const mod = new Date(l.modified_at)
    const age = effectiveAgeHours(mod, now)
    const common = { modified_at: l.modified_at, age_hours: Math.round(age * 10) / 10, rows_loaded: l.rows_loaded }
    if (r.rule_kind === 'frozen') {
      out.push({ ...base, ...common, status: 'grey', reason: 'frozen (historical) - not checked' })
    } else if (r.rule_kind === 'nightly') {
      const fresh = localParts(mod).date === local.date
      push({ ...base, ...common, status: fresh ? 'green' : 'red',
        reason: fresh ? 'refreshed overnight' : `${r.file_name} was not refreshed overnight (last ${localParts(mod).date})` }, gated)
    } else {
      const limit = r.max_age_hours ?? 0
      const status: Colour = age > limit ? 'red' : age > 0.75 * limit ? 'amber' : 'green'
      push({ ...base, ...common, status,
        reason: status === 'green' ? `${fmtAge(age)} old` : `${r.file_name} is ${fmtAge(age)} old (limit ${fmtAge(limit)})` }, gated)
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
      push({ ...base, check_key: `rows:${r.file_name}`, status: bad ? 'red' : 'green', reason: bad ?? `${l.rows_loaded} rows`,
        modified_at: l.modified_at, age_hours: null, rows_loaded: l.rows_loaded }, gated)
    }
  }

  // Coverage guard: a file the sync LOADS but nobody monitors. It cannot be missed silently any more.
  for (const l of unruledRows) {
    if (!l.first_seen) continue
    const h = (now.getTime() - new Date(l.first_seen).getTime()) / H
    if (h < COVERAGE_AMBER_H) continue
    push({ check_key: `coverage:${l.file_name}`, file_name: l.file_name, file_group: 'coverage', company: null,
      status: h >= COVERAGE_RED_H ? 'red' : 'amber',
      reason: `${l.file_name} is loaded by the sync but has no freshness rule - add one (or mark it frozen)`,
      modified_at: l.modified_at, age_hours: null, rows_loaded: l.rows_loaded }, gatedNow)
  }

  // Content freshness: the newest date INSIDE the loaded tables (a fresh file can still hold old data).
  for (const c of content) {
    const base = { check_key: c.check_key, file_name: null, file_group: c.file_group, company: c.company, modified_at: null, age_hours: null, rows_loaded: null }
    const gated = gatedNow || (!ignoreCalendar && (local.minutes < CONTENT_FROM || local.minutes > CONTENT_TO))
    if (!c.newest) { push({ ...base, status: 'red', reason: `${c.label}: nothing loaded` }, gated); continue }
    const lag = workdayLag(c.newest, local.date)
    // Yesterday's data at most is normal; two or more working days behind means a whole day is missing.
    const status: Colour = lag >= 2 ? 'red' : 'green'
    push({ ...base, status, reason: status === 'green' ? `${c.label}: newest ${c.newest}`
      : `${c.label}: newest date is ${c.newest}, ${lag} working days ago - a day of data is missing` }, gated)
  }

  const sortedSync = [...syncLogs].sort((a, b) => b.started_at.localeCompare(a.started_at))
  const lastOk = sortedSync.find(s => s.status === 'success')
  const okAge = lastOk ? (now.getTime() - new Date(lastOk.started_at).getTime()) / H : Infinity
  if (ignoreCalendar || local.minutes >= SYNC_FROM) {
    const syncGated = !ignoreCalendar && (local.weekday === 'Sat' || local.minutes > DAY_TO)
    push({ check_key: 'sync:no_success', file_name: null, file_group: 'sync', company: null,
      status: okAge > 2 ? 'red' : 'green', modified_at: lastOk?.started_at ?? null,
      age_hours: isFinite(okAge) ? Math.round(okAge * 10) / 10 : null, rows_loaded: null,
      reason: okAge > 2 ? `No successful sync for ${isFinite(okAge) ? fmtAge(okAge) : 'a long time'} - is smartpupik running?` : 'syncing normally' }, syncGated)
    const stuck = sortedSync.find(s => s.status === 'running'
      && (now.getTime() - new Date(s.started_at).getTime()) / H > 0.75
      && !sortedSync.some(o => o.status === 'success' && o.started_at > s.started_at))
    push({ check_key: 'sync:stuck', file_name: null, file_group: 'sync', company: null,
      status: stuck ? 'red' : 'green', modified_at: stuck?.started_at ?? null, age_hours: null, rows_loaded: null,
      reason: stuck ? `A sync started ${stuck.started_at} is still 'running' (interrupted?)` : 'no stuck sync' }, syncGated)
  } else if (lastOk && okAge <= 2) {
    // before 08:00 nothing new may open, but a sync that has since succeeded must close yesterday's incident
    out.push({ check_key: 'sync:no_success', file_name: null, file_group: 'sync', company: null, status: 'green',
      modified_at: lastOk.started_at, age_hours: Math.round(okAge * 10) / 10, rows_loaded: null, reason: 'syncing normally' })
  }
  return { statuses: out, unruled }
}
