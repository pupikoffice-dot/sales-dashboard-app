// Pure email composition for the data health monitor (alert, reminder, resolved, daily summary).
import type { Status } from './evaluate.ts'

/** A table to send as an Excel attachment (the edge function turns it into an .xlsx; this file stays free of libraries). */
export type EmailTable = { filename: string; sheet: string; headers: string[]; rows: (string | number)[][] }
export type Email = { subject: string; text: string; html: string; table?: EmailTable }
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

export function summaryEmail(a: { statuses: Status[]; openCount: number; unruled: string[]; dateLabel: string; url: string; uncategorized?: UncategorizedRow[]; isoDate?: string }): Email {
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
    const per = [...new Set(unc.map(r => r.company))].sort().map(c => `${c} ${unc.filter(r => r.company === c).length}`).join(', ')
    lines.push('', `In stock without a category (REP103 column I): ${unc.length} items (${per}) - the full list is attached as an Excel file.`)
  }
  lines.push('', `Details: ${a.url}`)
  const subject = `${P} Daily status ${a.dateLabel}: ${n('red')} red, ${n('amber')} amber, ${n('green')} green`
  const email = mk(subject, lines.join('\n'))
  if (!unc.length) return email
  return {
    ...email,
    table: {
      filename: `in_stock_no_category_${a.isoDate ?? 'today'}.xlsx`, sheet: 'No category',
      headers: ['Company', 'SKU', 'Item name', 'Stock'],
      rows: unc.map(r => [r.company, r.sku, r.name, r.qty]),
    },
  }
}
