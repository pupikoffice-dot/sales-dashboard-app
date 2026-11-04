// data-health-check: started every 30 min by pg_cron (migration 20261003130200_data_health_cron.sql).
// Loads rules + latest observations, evaluates, writes source_file_status, manages incidents,
// sends email via Resend, sends the daily summary once per working day, prunes old observations.
// Spec: docs/superpowers/specs/2026-10-03-data-health-monitor-design.md
import { createClient } from 'npm:@supabase/supabase-js@2'
import { evaluate, localParts, JOB_CHECKS, type JobResult, type Rule, type Latest, type SyncLog, type Status, type ContentItem } from './evaluate.ts'
import { planIncidents, REOPEN_DAMP_H, type ClosedIncident, type OpenIncident } from './incidents.ts'
import { alertEmail, digestEmail, resolvedDigestEmail, summaryEmail, uncategorizedEmail, type Email, type EmailTable, type UncategorizedRow } from './emails.ts'

// Email links: production (OMEGA) project -> production site, otherwise the beta site. DATA_HEALTH_PAGE_URL overrides.
const IS_OMEGA = (Deno.env.get('SUPABASE_URL') ?? '').includes('hzgpkkbqhmtwqhkcntcc')
const PAGE_URL = Deno.env.get('DATA_HEALTH_PAGE_URL')
  ?? (IS_OMEGA ? 'https://sales-dashboard-app-omega.vercel.app/admin/data-health' : 'https://pupik-sales-dashboard-beta.vercel.app/admin/data-health')

/** The email's table as an .xlsx file, base64 (Resend attachment format). */
async function xlsxBase64(t: EmailTable): Promise<string> {
  // loaded on demand: if the library cannot load, only the attachment is lost, never the monitor itself
  const XLSX = await import('npm:xlsx@0.18.5')
  const ws = XLSX.utils.aoa_to_sheet([t.headers, ...t.rows])
  ws['!cols'] = t.headers.map((h, i) => ({ wch: Math.min(60, Math.max(h.length, ...t.rows.map(r => String(r[i] ?? '').length)) + 2) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, t.sheet)
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async () => {
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const now = new Date()
  const log: string[] = []

  const [rulesQ, latestQ, syncQ, openQ, setQ, contentQ] = await Promise.all([
    sb.from('source_files').select('*'),
    sb.rpc('data_health_latest'),
    sb.from('sync_logs').select('id, started_at, status').order('started_at', { ascending: false }).limit(50),
    sb.from('data_health_incidents').select('id, check_key, opened_at, acknowledged_at, last_notified_at, reason').is('closed_at', null),
    sb.from('data_health_settings').select('*').eq('id', true).single(),
    sb.rpc('data_health_content'), // newest date inside the loaded tables; optional (older databases lack it)
  ])
  for (const q of [rulesQ, latestQ, syncQ, openQ, setQ]) if (q.error) return json({ error: q.error.message }, 500)
  const rules = rulesQ.data as Rule[]
  const settings = setQ.data as {
    recipients: string[]; from_address: string; summary_time: string; enabled: boolean; last_summary_date: string | null
    ignore_calendar: boolean
  }
  const ruleByKey = new Map(rules.map(r => [r.file_name, r]))
  const ignoreCalendar = settings.ignore_calendar === true // test switch, set only via SQL

  const content: ContentItem[] = contentQ.error ? [] : ((contentQ.data ?? []) as ContentItem[])
  if (contentQ.error) log.push(`content checks unavailable: ${contentQ.error.message}`)
  // ERP job results of the weekly debt aging robot (optional: the table may be empty or missing on older databases)
  const jobsQ = await sb.from('erp_job_results').select('task, started_at, exit_code, export_timeout, attempts')
    .in('task', JOB_CHECKS.map(j => j.task)).gte('started_at', new Date(now.getTime() - 21 * 86_400_000).toISOString())
  if (jobsQ.error) log.push(`job results unavailable: ${jobsQ.error.message}`)
  const jobs = jobsQ.error ? [] : ((jobsQ.data ?? []) as JobResult[])
  const { statuses, unruled } = evaluate({ rules, latest: latestQ.data as Latest[], syncLogs: syncQ.data as SyncLog[], now, ignoreCalendar, content, jobs })
  if (statuses.length) {
    const up = await sb.from('source_file_status').upsert(statuses.map(s => ({ ...s, evaluated_at: now.toISOString() })))
    if (up.error) return json({ error: up.error.message }, 500)
  }

  // Every email attempt is remembered (data_health_settings.last_send_*): a missing key or a refused send must never be silent again.
  let sendError: string | null = null, sendTried = false, sendOk = false
  const send = async (e: Email): Promise<boolean> => {
    if (!settings.enabled || !settings.recipients.length) return false
    sendTried = true
    const key = Deno.env.get('RESEND_API_KEY')
    if (!key) { sendError = 'RESEND_API_KEY is not set - alerts are shown in the app only'; if (log.length < 5) log.push(sendError); return false }
    // An attachment that cannot be built must never stop the mail (or the run): send the mail without it and say so.
    let att: { filename: string; content: string } | null = null
    if (e.table) {
      try { att = { filename: e.table.filename, content: await xlsxBase64(e.table) } }
      catch (err) { if (log.length < 5) log.push(`excel attachment failed: ${(err as Error).message}`) }
    }
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: settings.from_address, to: settings.recipients, subject: e.subject, text: e.text, html: e.html,
        ...(att ? { attachments: [att] } : {}) }),
    })
    if (!r.ok) { sendError = `resend ${r.status}: ${(await r.text()).slice(0, 300)}`; if (log.length < 5) log.push(sendError) } else sendOk = true
    return r.ok
  }
  const ruleFor = (s: Status) => ruleByKey.get(s.file_name ?? '')

  // Orphan 'running' sync rows (older than 6 h) are marked failed. Optional: older databases lack the function.
  const cleanQ = await sb.rpc('sync_stuck_cleanup')
  if (cleanQ.error) log.push(`sync cleanup unavailable: ${cleanQ.error.message}`)
  // Recently closed incidents: a check that re-opens within REOPEN_DAMP_H of its close is opened without a mail (flapping).
  const closedQ = await sb.from('data_health_incidents').select('check_key, closed_at')
    .not('closed_at', 'is', null).gte('closed_at', new Date(now.getTime() - REOPEN_DAMP_H * 3_600_000).toISOString())
  if (closedQ.error) log.push(`recent closed incidents unavailable: ${closedQ.error.message}`)
  const recentClosed = closedQ.error ? [] : ((closedQ.data ?? []) as ClosedIncident[])
  const plan = planIncidents(statuses, openQ.data as OpenIncident[], now, recentClosed)
  const quiet = new Set(plan.quiet)
  // Everything that opens, is reminded or closes in this run goes into ONE mail each (alert digest, resolved digest). The per-company
  // 'no category' alerts stay single mails: their subject carries the company so each owner's mail rule can route them.
  const isNocat = (k: string) => k.startsWith('content:nocat:')
  const opened: { s: Status; id: number; reminder: boolean }[] = []
  for (const s of plan.open) {
    // quiet re-open: mark as notified now so the 'never sent' retry does not mail it; the 24 h reminder logic applies as usual
    const ins = await sb.from('data_health_incidents')
      .insert({ check_key: s.check_key, reason: s.reason, ...(quiet.has(s.check_key) ? { last_notified_at: now.toISOString() } : {}) }).select('id').single()
    if (ins.error) { log.push(ins.error.message); continue }
    if (quiet.has(s.check_key)) { log.push(`re-opened quietly (closed < ${REOPEN_DAMP_H} h ago): ${s.check_key}`); continue }
    opened.push({ s, id: ins.data.id, reminder: false })
  }
  const byKey = new Map(statuses.map(s => [s.check_key, s]))
  for (const i of plan.remind) opened.push({ s: byKey.get(i.check_key)!, id: i.id, reminder: i.last_notified_at !== null })
  const notifyIds = async (ids: number[]) => { if (ids.length) await sb.from('data_health_incidents').update({ last_notified_at: now.toISOString() }).in('id', ids) }
  const digestItems = opened.filter(o => !isNocat(o.s.check_key))
  if (digestItems.length && await send(digestEmail(digestItems.map(o => ({ s: o.s, rule: ruleFor(o.s), reminder: o.reminder })), PAGE_URL)))
    await notifyIds(digestItems.map(o => o.id))
  for (const o of opened.filter(o => isNocat(o.s.check_key)))
    if (await send(alertEmail(o.s, ruleFor(o.s), PAGE_URL, o.reminder))) await notifyIds([o.id])
  for (const i of plan.close) await sb.from('data_health_incidents').update({ closed_at: now.toISOString() }).eq('id', i.id)
  if (plan.close.length) await send(resolvedDigestEmail(plan.close.map(i => ({ checkKey: i.check_key, openedAt: i.opened_at })), now, PAGE_URL))

  // Daily summary: first run on a working day at/after summary_time.
  const local = localParts(now)
  const [sh, sm] = settings.summary_time.split(':').map(Number)
  let summarySent = false
  if ((ignoreCalendar || local.weekday !== 'Sat') && local.minutes >= sh * 60 + sm && settings.last_summary_date !== local.date) {
    const all = await sb.from('source_file_status').select('*').order('file_group')
    const open = await sb.from('data_health_incidents').select('id', { count: 'exact', head: true }).is('closed_at', null)
    const label = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', weekday: 'short', day: '2-digit', month: 'short' }).format(now)
    // In-stock items without a category (optional: older databases lack the function); listed in full in the morning mail.
    const unc = await sb.rpc('data_health_uncategorized')
    if (unc.error) log.push(`uncategorized list unavailable: ${unc.error.message}`)
    summarySent = await send(summaryEmail({ statuses: (all.data ?? []) as Status[], openCount: open.count ?? 0, unruled, dateLabel: label, url: PAGE_URL, isoDate: local.date,
      rules: Object.fromEntries(rules.map(r => [r.file_name, { fix_hint: r.fix_hint, impact: r.impact }])),
      uncategorized: unc.error ? [] : ((unc.data ?? []) as UncategorizedRow[]) }))
    if (summarySent) {
      await sb.from('data_health_settings').update({ last_summary_date: local.date }).eq('id', true)
      // One mail per company (different people handle each), same recipients, company named in the subject.
      const uncRows = unc.error ? [] : ((unc.data ?? []) as UncategorizedRow[])
      for (const co of [...new Set(uncRows.map(r => r.company))].sort())
        await send(uncategorizedEmail(co, uncRows.filter(r => r.company === co), local.date, PAGE_URL))
    }
    await sb.from('source_file_observations').delete().lt('observed_at', new Date(now.getTime() - 365 * 86_400_000).toISOString())
  }

  // Heartbeat + outcome of the email attempts of this run (the app shows "monitor stopped" / "email not working" from these).
  await sb.from('data_health_settings').update({
    last_run_at: now.toISOString(),
    ...(sendTried ? { last_send_at: now.toISOString(), last_send_error: sendOk ? null : sendError } : {}),
  }).eq('id', true)

  return json({ evaluated: statuses.length, opened: plan.open.length, reminded: plan.remind.length,
    closed: plan.close.length, summarySent, unruled, log })
})
