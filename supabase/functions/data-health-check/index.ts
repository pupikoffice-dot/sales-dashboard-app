// data-health-check: started every 30 min by pg_cron (migration 20261003130200_data_health_cron.sql).
// Loads rules + latest observations, evaluates, writes source_file_status, manages incidents,
// sends email via Resend, sends the daily summary once per working day, prunes old observations.
// Spec: docs/superpowers/specs/2026-10-03-data-health-monitor-design.md
import { createClient } from 'npm:@supabase/supabase-js@2'
import { evaluate, localParts, type Rule, type Latest, type SyncLog, type Status, type ContentItem } from './evaluate.ts'
import { planIncidents, type OpenIncident } from './incidents.ts'
import { alertEmail, resolvedEmail, summaryEmail, type Email } from './emails.ts'

// Email links: production (OMEGA) project -> production site, otherwise the beta site. DATA_HEALTH_PAGE_URL overrides.
const IS_OMEGA = (Deno.env.get('SUPABASE_URL') ?? '').includes('hzgpkkbqhmtwqhkcntcc')
const PAGE_URL = Deno.env.get('DATA_HEALTH_PAGE_URL')
  ?? (IS_OMEGA ? 'https://sales-dashboard-app-omega.vercel.app/admin/data-health' : 'https://pupik-sales-dashboard-beta.vercel.app/admin/data-health')

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
  const { statuses, unruled } = evaluate({ rules, latest: latestQ.data as Latest[], syncLogs: syncQ.data as SyncLog[], now, ignoreCalendar, content })
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
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: settings.from_address, to: settings.recipients, subject: e.subject, text: e.text, html: e.html }),
    })
    if (!r.ok) { sendError = `resend ${r.status}: ${(await r.text()).slice(0, 300)}`; if (log.length < 5) log.push(sendError) } else sendOk = true
    return r.ok
  }
  const ruleFor = (s: Status) => ruleByKey.get(s.file_name ?? '')

  const plan = planIncidents(statuses, openQ.data as OpenIncident[], now)
  for (const s of plan.open) {
    const ins = await sb.from('data_health_incidents').insert({ check_key: s.check_key, reason: s.reason }).select('id').single()
    if (ins.error) { log.push(ins.error.message); continue }
    if (await send(alertEmail(s, ruleFor(s), PAGE_URL, false)))
      await sb.from('data_health_incidents').update({ last_notified_at: now.toISOString() }).eq('id', ins.data.id)
  }
  const byKey = new Map(statuses.map(s => [s.check_key, s]))
  for (const i of plan.remind) {
    const s = byKey.get(i.check_key)!
    if (await send(alertEmail(s, ruleFor(s), PAGE_URL, i.last_notified_at !== null)))
      await sb.from('data_health_incidents').update({ last_notified_at: now.toISOString() }).eq('id', i.id)
  }
  for (const i of plan.close) {
    await sb.from('data_health_incidents').update({ closed_at: now.toISOString() }).eq('id', i.id)
    await send(resolvedEmail(i.check_key, i.opened_at, now, PAGE_URL))
  }

  // Daily summary: first run on a working day at/after summary_time.
  const local = localParts(now)
  const [sh, sm] = settings.summary_time.split(':').map(Number)
  let summarySent = false
  if ((ignoreCalendar || local.weekday !== 'Sat') && local.minutes >= sh * 60 + sm && settings.last_summary_date !== local.date) {
    const all = await sb.from('source_file_status').select('*').order('file_group')
    const open = await sb.from('data_health_incidents').select('id', { count: 'exact', head: true }).is('closed_at', null)
    const label = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', weekday: 'short', day: '2-digit', month: 'short' }).format(now)
    summarySent = await send(summaryEmail({ statuses: (all.data ?? []) as Status[], openCount: open.count ?? 0, unruled, dateLabel: label, url: PAGE_URL }))
    if (summarySent) await sb.from('data_health_settings').update({ last_summary_date: local.date }).eq('id', true)
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
