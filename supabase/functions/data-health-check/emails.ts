// Pure email composition for the data health monitor (alert, reminder, resolved, daily summary).
import type { Status } from './evaluate.ts'

export type Email = { subject: string; text: string; html: string }
const P = '[Dashboard data]'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const toHtml = (text: string) => `<pre style="font-family:Segoe UI,Arial,sans-serif;white-space:pre-wrap">${esc(text)}</pre>`
const mk = (subject: string, text: string): Email => ({ subject, text, html: toHtml(text) })

export function durationText(ms: number): string {
  const h = Math.round(ms / 3_600_000)
  return h < 24 ? `${h} h` : `${Math.floor(h / 24)} d ${h % 24} h`
}

export function alertEmail(s: Status, rule: { fix_hint: string; impact: string } | undefined, url: string, reminder: boolean): Email {
  const text = [
    s.reason,
    s.modified_at ? `Last modified: ${s.modified_at}` : '',
    rule ? `Affects: ${rule.impact}` : '',
    rule ? `How to fix: ${rule.fix_hint}` : '',
    `Group: ${s.file_group}`,
    `Details: ${url}`,
  ].filter(Boolean).join('\n')
  return mk(`${P} ${reminder ? 'STILL RED' : 'RED'}: ${s.reason}`, text)
}

export function resolvedEmail(checkKey: string, openedAt: string, now: Date, url: string): Email {
  const d = durationText(now.getTime() - new Date(openedAt).getTime())
  return mk(`${P} OK again: ${checkKey} (was red ${d})`, `${checkKey} is OK again after ${d}.\nDetails: ${url}`)
}

export type UncategorizedRow = { company: string; sku: string; name: string; qty: number }

export function summaryEmail(a: { statuses: Status[]; openCount: number; unruled: string[]; dateLabel: string; url: string; uncategorized?: UncategorizedRow[] }): Email {
  const n = (c: Status['status']) => a.statuses.filter(s => s.status === c).length
  const lines: string[] = [`Open incidents: ${a.openCount}`, '']
  const groups = [...new Set(a.statuses.map(s => s.file_group))].sort()
  for (const g of groups) {
    lines.push(`== ${g}`)
    for (const s of a.statuses.filter(x => x.file_group === g)) lines.push(`  ${s.status.toUpperCase().padEnd(5)} ${s.check_key}: ${s.reason}`)
  }
  if (a.unruled.length) lines.push('', `Loaded by the sync but not monitored (add a rule): ${a.unruled.join(', ')}`)
  const unc = a.uncategorized ?? []
  if (unc.length) {
    lines.push('', `== In stock without a category (REP103 column I): ${unc.length} items`)
    for (const r of unc) lines.push(`  ${r.company.padEnd(6)} ${r.sku}  ${r.name}  qty ${r.qty}`)
  }
  lines.push('', `Details: ${a.url}`)
  const subject = `${P} Daily status ${a.dateLabel}: ${n('red')} red, ${n('amber')} amber, ${n('green')} green`
  const text = lines.join('\n')
  if (!unc.length) return mk(subject, text)
  // The item list also goes out as a real table (pastes straight into Excel); the text part keeps the plain list.
  const cell = (s: string | number) => `<td style="border:1px solid #ccc;padding:2px 8px">${esc(String(s))}</td>`
  const rows = unc.map(r => `<tr>${cell(r.company)}${cell(r.sku)}${cell(r.name)}${cell(r.qty)}</tr>`).join('')
  const head = ['Company', 'SKU', 'Item name', 'Stock'].map(h => `<th style="border:1px solid #ccc;padding:2px 8px;background:#eee;text-align:left">${h}</th>`).join('')
  const statusText = lines.slice(0, lines.findIndex(l => l.startsWith('== In stock without a category'))).join('\n')
  const html = `${toHtml(statusText)}<h3 style="font-family:Segoe UI,Arial,sans-serif">In stock without a category (REP103 column I): ${unc.length} items</h3>`
    + `<table style="border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;font-size:13px"><tr>${head}</tr>${rows}</table>`
    + `<p style="font-family:Segoe UI,Arial,sans-serif">Details: ${esc(a.url)}</p>`
  return { subject, text, html }
}
