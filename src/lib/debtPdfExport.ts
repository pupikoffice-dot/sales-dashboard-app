import { debtMonths, debtRowTotal, type DebtRow } from './debtMetrics'

export interface DebtPdfFooter {
  totOld: number
  totM: number[]
  totGrand: number
}

export interface DebtPdfSection {
  title: string
  rows: DebtRow[]
  footer: DebtPdfFooter
}

export interface DebtPdfLabels {
  clientId: string
  clientName: string
  oldDebt: string
  total: string
  subtotal: string
  grandTotal: string
}

function monthAmount(row: DebtRow, label: string): number {
  const m = debtMonths(row.months).find(x => x.label === label)
  return m?.amount || 0
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatTimestamp(): string {
  const d = new Date()
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const year = d.getUTCFullYear()
  const hours = String(d.getUTCHours()).padStart(2, '0')
  const mins = String(d.getUTCMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${mins}`
}

function buildTableHtml(
  rows: DebtRow[],
  footer: DebtPdfFooter,
  mLabels: string[],
  labels: DebtPdfLabels,
  subtotalLabel: string,
): string {
  const head =
    `<tr><th>${escHtml(labels.clientId)}</th>` +
    `<th>${escHtml(labels.clientName)}</th>` +
    `<th class="num">${escHtml(labels.oldDebt)}</th>` +
    mLabels.map(l => `<th class="num">${escHtml(l)}</th>`).join('') +
    `<th class="num">${escHtml(labels.total)}</th></tr>`

  const body = rows
    .map(r => {
      const rowTot = debtRowTotal(r)
      return (
        `<tr><td>${escHtml(r.clientID)}</td>` +
        `<td>${escHtml(r.clientName)}</td>` +
        `<td class="num">${fmtNum(r.oldDebt || 0)}</td>` +
        mLabels.map(l => `<td class="num">${fmtNum(monthAmount(r, l))}</td>`).join('') +
        `<td class="num"><strong>${fmtNum(rowTot)}</strong></td></tr>`
      )
    })
    .join('')

  const foot =
    `<tr><td colspan="2">${escHtml(subtotalLabel)}</td>` +
    `<td class="num">${fmtNum(footer.totOld)}</td>` +
    footer.totM.map(v => `<td class="num">${fmtNum(v)}</td>`).join('') +
    `<td class="num"><strong>${fmtNum(footer.totGrand)}</strong></td></tr>`

  return `<table><thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table>`
}

function buildPrintDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escHtml(title)}</title>
<style>
  @page { size: landscape; margin: 10mm; }
  body { font-family: Arial, "Segoe UI", sans-serif; font-size: 10px; color: #111; margin: 0; padding: 12px; }
  h1 { font-size: 15px; margin: 0 0 4px; }
  .meta { font-size: 10px; color: #555; margin-bottom: 14px; }
  h2 { font-size: 12px; margin: 18px 0 6px; }
  h2:first-of-type { margin-top: 0; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 12px; page-break-inside: avoid; }
  th, td { border: 1px solid #bbb; padding: 3px 5px; vertical-align: top; }
  th { background: #eee; font-weight: 700; }
  td.num, th.num { text-align: left; direction: ltr; unicode-bidi: embed; }
  tfoot td { font-weight: 700; background: #f4f4f4; }
  .grand { margin-top: 8px; }
</style>
</head>
<body>
<h1>${escHtml(title)}</h1>
<div class="meta">${escHtml(formatTimestamp())}</div>
${bodyHtml}
</body>
</html>`
}

function printHtmlDocument(html: string, docTitle: string): void {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', docTitle)
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;pointer-events:none;'
  document.body.appendChild(iframe)

  const frameWin = iframe.contentWindow
  const frameDoc = frameWin?.document
  if (!frameDoc || !frameWin) {
    iframe.remove()
    window.alert('Could not open print preview.')
    return
  }

  frameDoc.open()
  frameDoc.write(html)
  frameDoc.close()

  const cleanup = () => {
    iframe.remove()
  }

  const triggerPrint = () => {
    try {
      frameWin.focus()
      frameWin.print()
    } catch {
      window.alert('Could not open print preview.')
      cleanup()
      return
    }
    frameWin.addEventListener('afterprint', cleanup, { once: true })
    window.setTimeout(cleanup, 60_000)
  }

  // Brief delay so layout/fonts settle before the print dialog opens.
  window.setTimeout(triggerPrint, 300)
}

export function exportDebtSectionsToPdf(
  docTitle: string,
  sections: DebtPdfSection[],
  mLabels: string[],
  labels: DebtPdfLabels,
  grandFooter?: DebtPdfFooter,
): void {
  if (!sections.length) return

  let body = sections
    .map(
      s =>
        `<h2>${escHtml(s.title)}</h2>` +
        buildTableHtml(s.rows, s.footer, mLabels, labels, labels.subtotal),
    )
    .join('')

  if (grandFooter && sections.length > 1) {
    body +=
      `<div class="grand"><h2>${escHtml(labels.grandTotal)}</h2>` +
      `<table><tfoot><tr>` +
      `<td colspan="2">${escHtml(labels.grandTotal)}</td>` +
      `<td class="num">${fmtNum(grandFooter.totOld)}</td>` +
      grandFooter.totM.map(v => `<td class="num">${fmtNum(v)}</td>`).join('') +
      `<td class="num"><strong>${fmtNum(grandFooter.totGrand)}</strong></td>` +
      `</tr></tfoot></table></div>`
  }

  printHtmlDocument(buildPrintDocument(docTitle, body), docTitle)
}

export function exportDebtAgentToPdf(
  docTitle: string,
  section: DebtPdfSection,
  mLabels: string[],
  labels: DebtPdfLabels,
): void {
  exportDebtSectionsToPdf(docTitle, [section], mLabels, labels)
}
