// Pure email composition for the data health monitor (alert, reminder, resolved, daily summary).
// Every mail has a plain-text body (`text`) and a responsive HTML body (`html`): table layout, inline CSS only,
// no images and no web fonts, so it renders the same in Outlook, Gmail and on phones.
import type { Status } from './evaluate.ts'

/** A table to send as an Excel attachment (the edge function turns it into an .xlsx; this file stays free of libraries). */
export type EmailTable = { filename: string; sheet: string; headers: string[]; rows: (string | number)[][] }
export type Email = { subject: string; text: string; html: string; table?: EmailTable }
export type FixRule = { fix_hint: string; impact: string }
const P = '[Dashboard data]'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escA = (s: string) => esc(s).replace(/"/g, '&quot;')

// ---- HTML building blocks ----
const FONT = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
type Tone = 'red' | 'amber' | 'green' | 'grey'
const TONES: Record<Tone, { solid: string; soft: string; text: string; label: string }> = {
  red: { solid: '#c62828', soft: '#fdecea', text: '#8e1b1b', label: 'RED' },
  amber: { solid: '#e08a00', soft: '#fff4de', text: '#8a5300', label: 'AMBER' },
  green: { solid: '#2e7d32', soft: '#e8f5e9', text: '#1b5e20', label: 'OK' },
  grey: { solid: '#78909c', soft: '#eceff1', text: '#37474f', label: 'N/A' },
}
const chip = (t: Tone, label = TONES[t].label) =>
  `<span style="display:inline-block;background:${TONES[t].solid};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:.5px;line-height:1;padding:4px 8px;border-radius:10px;">${esc(label)}</span>`
const button = (url: string, label: string, tone: Tone) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td align="center" bgcolor="${TONES[tone].solid}" style="border-radius:6px;"><a href="${escA(url)}" target="_blank" style="display:inline-block;${FONT}font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;">${esc(label)}</a></td></tr></table>`

/** The shared frame: grey canvas, centred 640px card, coloured header band, button, footer. */
function frame(o: { tone: Tone; title: string; sub?: string; preheader: string; body: string; url: string; footnote?: string }): string {
  const t = TONES[o.tone]
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(o.title)}</title>
<style>@media only screen and (max-width:480px){.px{padding-left:14px!important;padding-right:14px!important}.tilen{font-size:24px!important}.ttl{font-size:19px!important}}</style></head>
<body style="margin:0;padding:0;background:#eef1f4;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#eef1f4;">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef1f4;"><tr><td align="center" style="padding:16px 8px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:8px;border:1px solid #d9dee3;">
<tr><td class="px" bgcolor="${t.solid}" style="background:${t.solid};border-radius:8px 8px 0 0;padding:20px 24px;${FONT}">
<div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#ffffff;opacity:.85;text-transform:uppercase;">Dashboard data health</div>
<div class="ttl" style="font-size:22px;font-weight:700;line-height:1.25;color:#ffffff;margin-top:6px;word-wrap:break-word;">${esc(o.title)}</div>
${o.sub ? `<div style="font-size:14px;color:#ffffff;margin-top:6px;opacity:.9;">${esc(o.sub)}</div>` : ''}</td></tr>
${o.body}
<tr><td class="px" align="center" style="padding:20px 24px 24px;">${button(o.url, 'Open the Data Health page', o.tone === 'green' ? 'green' : o.tone === 'red' ? 'red' : 'grey')}</td></tr>
<tr><td class="px" style="border-top:1px solid #e3e7eb;padding:14px 24px;${FONT}font-size:12px;line-height:1.5;color:#78858f;">${o.footnote ? `${esc(o.footnote)}<br>` : ''}Sent automatically by the data health monitor. If the button does not work, open: <a href="${escA(o.url)}" style="color:#546e7a;word-break:break-all;">${esc(o.url)}</a></td></tr>
</table></td></tr></table></body></html>`
}

const block = (inner: string, pad = '16px 24px 0') =>
  `<tr><td class="px" style="padding:${pad};${FONT}font-size:14px;line-height:1.5;color:#1f2933;">${inner}</td></tr>`
const kv = (k: string, v: string) =>
  `<tr><td valign="top" style="padding:3px 12px 3px 0;color:#78858f;font-size:13px;white-space:nowrap;">${esc(k)}</td><td valign="top" style="padding:3px 0;font-size:14px;color:#1f2933;">${v}</td></tr>`
const kvTable = (rows: string[]) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows.join('')}</table>`

function tiles(items: { n: number; label: string; tone: Tone }[]): string {
  const w = Math.floor(100 / items.length)
  const cells = items.map((it, i) => {
    const on = it.n > 0, t = TONES[on ? it.tone : 'grey']
    return `<td width="${w}%" align="center" valign="top" style="padding:12px 4px;background:${on ? t.soft : '#f4f6f8'};border-top:4px solid ${on ? t.solid : '#cfd6dc'};${i ? 'border-left:6px solid #ffffff;' : ''}${FONT}">
<div class="tilen" style="font-size:30px;font-weight:700;line-height:1.1;color:${on ? t.solid : '#78858f'};">${it.n}</div>
<div style="font-size:12px;color:${on ? t.text : '#78858f'};margin-top:2px;">${esc(it.label)}</div></td>`
  }).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>`
}

/** One check as a row: coloured left edge, chip, name, reason, fix. Red/amber rows get the full treatment, green rows stay compact. */
function checkRow(s: Status, rule?: FixRule): string {
  const tone = s.status as Tone, t = TONES[tone], full = s.status === 'red' || s.status === 'amber'
  const fix = full && rule
    ? `<div style="margin-top:6px;font-size:13px;color:#1f2933;"><b style="color:${t.text};">How to fix:</b> ${esc(rule.fix_hint)}</div>${rule.impact ? `<div style="margin-top:2px;font-size:13px;color:#52606d;"><b>Affects:</b> ${esc(rule.impact)}</div>` : ''}`
    : ''
  return `<tr><td style="padding:0 0 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${full ? t.soft : '#f7f9fa'};border-left:5px solid ${t.solid};border-radius:4px;"><tr>
<td style="padding:${full ? '9px 12px' : '6px 12px'};${FONT}">
<div style="font-size:${full ? 14 : 13}px;line-height:1.4;">${chip(tone)} <b style="color:#1f2933;word-break:break-all;">${esc(s.check_key)}</b></div>
<div style="font-size:13px;line-height:1.45;color:${full ? t.text : '#52606d'};margin-top:3px;">${esc(s.reason)}</div>${fix}</td></tr></table></td></tr>`
}

const RANK: Record<Status['status'], number> = { red: 0, amber: 1, green: 2, grey: 3 }
const byBad = (a: Status, b: Status) => RANK[a.status] - RANK[b.status] || a.check_key.localeCompare(b.check_key)
const mk = (subject: string, text: string, html: string): Email => ({ subject, text, html })

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
  // The no-category alerts go to one mailbox per company's owner: the company is in the subject so a mail rule can route them.
  const tag = s.check_key.startsWith('content:nocat:') ? ` [${companyName(s.check_key.slice('content:nocat:'.length))}]` : ''
  const tone: Tone = s.status
  const body = block(`<div style="margin-bottom:10px;">${chip(tone, reminder ? 'STILL RED' : TONES[tone].label)} <span style="color:#78858f;font-size:13px;">${esc(s.check_key)}</span></div>
<div style="font-size:17px;font-weight:600;line-height:1.4;color:${TONES[tone].text};">${esc(s.reason)}</div>`)
    + (rule ? block(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f8;border-radius:6px;"><tr><td style="padding:12px 14px;${FONT}font-size:14px;line-height:1.5;color:#1f2933;">
<div style="font-size:12px;font-weight:700;letter-spacing:.5px;color:#78858f;text-transform:uppercase;">How to fix</div><div style="margin:2px 0 10px;">${esc(rule.fix_hint)}</div>
<div style="font-size:12px;font-weight:700;letter-spacing:.5px;color:#78858f;text-transform:uppercase;">What it affects</div><div style="margin-top:2px;">${esc(rule.impact)}</div></td></tr></table>`) : '')
    + block(kvTable([kv('Group', esc(s.file_group)), ...(s.modified_at ? [kv('Last modified', esc(s.modified_at))] : [])]), '14px 24px 0')
  const title = `${reminder ? 'Still red' : 'Needs attention'}${tag ? ` -${tag}` : ''}`
  const html = frame({ tone, title, sub: s.check_key, preheader: s.reason, body, url,
    footnote: reminder ? 'This is a reminder: the problem is still open.' : undefined })
  return mk(`${P}${tag} ${reminder ? 'STILL RED' : 'RED'}: ${s.reason}`, text, html)
}

/** One incident of an alert digest: a new red, or a reminder of one that is still red. */
export type DigestItem = { s: Status; rule?: FixRule; reminder: boolean }

/**
 * ONE mail for everything that opened or needs a reminder in the same run (red first, new before reminders).
 * A single item is exactly today's alertEmail (same subject and body).
 */
export function digestEmail(items: DigestItem[], url: string): Email {
  if (items.length === 1) return alertEmail(items[0].s, items[0].rule, url, items[0].reminder)
  const sorted = [...items].sort((a, b) => RANK[a.s.status] - RANK[b.s.status] || Number(a.reminder) - Number(b.reminder) || a.s.check_key.localeCompare(b.s.check_key))
  const n = sorted.length, fresh = sorted.filter(i => !i.reminder).length
  const head = fresh === n ? `RED: ${n} new issues` : fresh === 0 ? `STILL RED: ${n} issues` : `RED: ${n} issues (${fresh} new)`
  const subject = `${P} ${head} - ${sorted[0].s.reason}`
  const text = sorted.map(i => [`${i.reminder ? 'STILL RED' : 'RED'}: ${i.s.reason}`,
    i.rule ? `  How to fix: ${i.rule.fix_hint}` : '', i.rule ? `  Affects: ${i.rule.impact}` : '', `  Group: ${i.s.file_group}`].filter(Boolean).join('\n'))
    .concat('', `Details: ${url}`).join('\n')
  const rows = sorted.map(i => checkRow(i.s, i.rule).replace('</b></div>', `</b>${i.reminder ? ' <span style="color:#78858f;font-size:12px;">(reminder)</span>' : ''}</div>`)).join('')
  const body = block(tiles([{ n: fresh, label: 'new', tone: 'red' }, { n: n - fresh, label: 'still red', tone: 'amber' }]))
    + block(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`, '16px 24px 0')
  const html = frame({ tone: 'red', title: `${n} issues need attention`, sub: fresh === n ? 'All new in this check' : `${fresh} new, ${n - fresh} reminders`, preheader: sorted[0].s.reason, body, url })
  return mk(subject, text, html)
}

/** ONE mail for every incident that closed in the same run. A single one is exactly today's resolvedEmail. */
export function resolvedDigestEmail(items: { checkKey: string; openedAt: string }[], now: Date, url: string): Email {
  if (items.length === 1) return resolvedEmail(items[0].checkKey, items[0].openedAt, now, url)
  const ms = (o: string) => now.getTime() - new Date(o).getTime()
  const sorted = [...items].sort((a, b) => ms(b.openedAt) - ms(a.openedAt))
  const n = sorted.length
  const text = sorted.map(i => `${i.checkKey} is OK again after ${durationText(ms(i.openedAt))}.`).concat('', `Details: ${url}`).join('\n')
  const rows = sorted.map(i => `<tr><td style="padding:0 0 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f9fa;border-left:5px solid ${TONES.green.solid};border-radius:4px;"><tr><td style="padding:8px 12px;${FONT}font-size:13px;">${chip('green', 'OK')} <b style="word-break:break-all;">${esc(i.checkKey)}</b><div style="color:#52606d;margin-top:2px;">was red for ${esc(durationText(ms(i.openedAt)))}</div></td></tr></table></td></tr>`).join('')
  const body = block(tiles([{ n, label: 'back to normal', tone: 'green' }]))
    + block(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`, '16px 24px 0')
  const html = frame({ tone: 'green', title: `${n} issues are OK again`, sub: `Longest was red for ${durationText(ms(sorted[0].openedAt))}`, preheader: `${n} checks are back to normal.`, body, url })
  return mk(`${P} OK again: ${n} issues (${sorted[0].checkKey} +${n - 1} more, longest red ${durationText(ms(sorted[0].openedAt))})`, text, html)
}

export const companyName = (c: string) => (c === 'mt' ? 'MONKEYTIME' : c.toUpperCase())

/** One mail per company (each is handled by a different person); the company is in the subject for mail rules. */
export function uncategorizedEmail(company: string, rows: UncategorizedRow[], isoDate: string, url: string): Email {
  const name = companyName(company)
  const text = [
    `${name}: ${rows.length} item${rows.length === 1 ? '' : 's'} in stock without a category (REP103 column I).`,
    'The full list is attached as an Excel file.',
    '', `Details: ${url}`,
  ].join('\n')
  const preview = rows.slice(0, 8)
  const list = preview.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;border:1px solid #e3e7eb;border-radius:6px;">
<tr style="background:#f4f6f8;"><td style="padding:6px 10px;font-size:12px;font-weight:700;color:#78858f;">SKU</td><td style="padding:6px 10px;font-size:12px;font-weight:700;color:#78858f;">Item</td><td align="right" style="padding:6px 10px;font-size:12px;font-weight:700;color:#78858f;">Stock</td></tr>
${preview.map(r => `<tr><td valign="top" style="padding:6px 10px;border-top:1px solid #eef1f4;font-size:13px;word-break:break-all;">${esc(r.sku)}</td><td valign="top" style="padding:6px 10px;border-top:1px solid #eef1f4;font-size:13px;">${esc(r.name)}</td><td align="right" valign="top" style="padding:6px 10px;border-top:1px solid #eef1f4;font-size:13px;">${esc(String(r.qty))}</td></tr>`).join('')}
${rows.length > preview.length ? `<tr><td colspan="3" style="padding:6px 10px;border-top:1px solid #eef1f4;font-size:12px;color:#78858f;">... and ${rows.length - preview.length} more in the attachment</td></tr>` : ''}</table>`
    : ''
  const body = block(tiles([{ n: rows.length, label: `item${rows.length === 1 ? '' : 's'} in stock without a category`, tone: 'amber' }]))
    + block(`<div>Give these items a category (REP103 column I). The <b>full list is attached as an Excel file</b>.</div>${list}`, '14px 24px 0')
  const html = frame({ tone: 'amber', title: `${name}: ${rows.length} item${rows.length === 1 ? '' : 's'} without a category`, sub: isoDate,
    preheader: `${rows.length} in-stock items need a category. Excel list attached.`, body, url })
  return {
    ...mk(`${P} [${name}] In stock without a category: ${rows.length} item${rows.length === 1 ? '' : 's'} (${isoDate})`, text, html),
    table: {
      filename: `in_stock_no_category_${company}_${isoDate}.xlsx`, sheet: 'No category',
      headers: ['SKU', 'Item name', 'Stock'],
      rows: rows.map(r => [r.sku, r.name, r.qty]),
    },
  }
}

export function resolvedEmail(checkKey: string, openedAt: string, now: Date, url: string): Email {
  const d = durationText(now.getTime() - new Date(openedAt).getTime())
  const body = block(`<div style="margin-bottom:10px;">${chip('green', 'RESOLVED')}</div>
<div style="font-size:17px;font-weight:600;line-height:1.4;color:${TONES.green.text};word-break:break-all;">${esc(checkKey)} is OK again</div>`)
    + block(kvTable([kv('Was red for', `<b>${esc(d)}</b>`), kv('Opened', esc(openedAt))]), '12px 24px 0')
  const html = frame({ tone: 'green', title: 'Back to normal', sub: checkKey, preheader: `${checkKey} is OK again after ${d}.`, body, url })
  return mk(`${P} OK again: ${checkKey} (was red ${d})`, `${checkKey} is OK again after ${d}.\nDetails: ${url}`, html)
}

export type UncategorizedRow = { company: string; sku: string; name: string; qty: number }

export function summaryEmail(a: { statuses: Status[]; openCount: number; unruled: string[]; dateLabel: string; url: string; uncategorized?: UncategorizedRow[]; isoDate?: string;
  /** optional: fix hints by file name, so red/amber rows can say how to fix them */ rules?: Record<string, FixRule> }): Email {
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
    lines.push('', `In stock without a category (REP103 column I): ${unc.length} items (${per}) - each company's list is sent in its own email.`)
  }
  lines.push('', `Details: ${a.url}`)
  const [red, amber, green] = [n('red'), n('amber'), n('green')]
  const subject = `${P} Daily status ${a.dateLabel}: ${red} red, ${amber} amber, ${green} green`

  // ---- HTML: tiles, then the red/amber items first (with reason + fix), then every group ----
  const tone: Tone = red ? 'red' : amber ? 'amber' : 'green'
  const headline = red ? `${red} problem${red === 1 ? '' : 's'} need attention` : amber ? `${amber} warning${amber === 1 ? '' : 's'}, nothing red` : 'Everything is OK'
  const fixFor = (s: Status) => (s.file_name && a.rules ? a.rules[s.file_name] : undefined)
  const bad = a.statuses.filter(s => s.status === 'red' || s.status === 'amber').sort(byBad)
  const groupRank = (g: string) => Math.min(...a.statuses.filter(s => s.file_group === g).map(s => RANK[s.status]))
  const ordered = [...groups].sort((x, y) => groupRank(x) - groupRank(y) || x.localeCompare(y))
  let body = block(tiles([
    { n: red, label: 'red', tone: 'red' }, { n: amber, label: 'amber', tone: 'amber' },
    { n: green, label: 'green', tone: 'green' }, { n: a.openCount, label: 'open incidents', tone: 'grey' },
  ]))
  if (bad.length) {
    body += block(`<div style="font-size:15px;font-weight:700;margin-bottom:8px;">Needs attention first</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${bad.map(s => checkRow(s, fixFor(s))).join('')}</table>`, '20px 24px 0')
  }
  body += block(`<div style="font-size:15px;font-weight:700;margin-bottom:4px;">All checks by group</div>`, '18px 24px 0')
  for (const g of ordered) {
    const items = a.statuses.filter(x => x.file_group === g).sort(byBad)
    const worst = items[0].status as Tone, cnt = (c: Status['status']) => items.filter(x => x.status === c).length
    const sum = [cnt('red') ? `${cnt('red')} red` : '', cnt('amber') ? `${cnt('amber')} amber` : '', cnt('green') ? `${cnt('green')} ok` : '', cnt('grey') ? `${cnt('grey')} n/a` : ''].filter(Boolean).join(' / ')
    body += block(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 6px;"><tr>
<td style="font-size:13px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${TONES[worst].text};border-bottom:2px solid ${TONES[worst].solid};padding:4px 0;">${esc(g)}</td>
<td align="right" style="font-size:12px;color:#78858f;border-bottom:2px solid ${TONES[worst].solid};padding:4px 0;">${esc(sum)}</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items.map(s => checkRow(s)).join('')}</table>`, '6px 24px 0')  // the fix is already shown once, in "Needs attention first"
  }
  if (a.unruled.length) body += block(`<div style="background:#eceff1;border-radius:6px;padding:10px 12px;font-size:13px;"><b>Loaded by the sync but not monitored</b> (add a rule): ${esc(a.unruled.join(', '))}</div>`, '16px 24px 0')
  if (unc.length) {
    const per = [...new Set(unc.map(r => r.company))].sort().map(c => `${esc(companyName(c))} ${unc.filter(r => r.company === c).length}`).join(', ')
    body += block(`<div style="background:${TONES.amber.soft};border-left:5px solid ${TONES.amber.solid};border-radius:4px;padding:10px 12px;font-size:13px;"><b>${unc.length} item${unc.length === 1 ? '' : 's'} in stock without a category</b> (${per}). Each company's list is sent in its own email.</div>`, '16px 24px 0')
  }
  const html = frame({ tone, title: headline, sub: `Daily status - ${a.dateLabel}`, preheader: `${red} red, ${amber} amber, ${green} green. ${a.openCount} open incident${a.openCount === 1 ? '' : 's'}.`, body, url: a.url })
  return mk(subject, lines.join('\n'), html)
}
