export function csvCell(text: string): string {
  const s = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function cleanCellText(el: Element): string {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('.si').forEach(e => e.remove())
  return clone.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

export function downloadCSV(csv: string, filename?: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `export_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function tableToCSV(
  table: HTMLTableElement,
  exportId = '',
  exportName = '',
  includeHeader = true,
): string {
  const lines: string[] = []
  const headerRow = table.querySelector('thead tr')

  if (headerRow && includeHeader) {
    const cells = [...headerRow.querySelectorAll('th')].map(th => csvCell(cleanCellText(th)))
    lines.push([csvCell('ID / SKU'), csvCell('Name'), ...cells].join(','))
  }

  table.querySelectorAll('tbody tr, tfoot tr').forEach(row => {
    const cells = [...row.querySelectorAll('td')].map(td => csvCell(cleanCellText(td)))
    if (!cells.length) return
    lines.push([csvCell(exportId), csvCell(exportName), ...cells].join(','))
  })

  return lines.join('\r\n')
}

export function exportAllFromReport(root: HTMLElement) {
  const sections = [...root.querySelectorAll('.section')].filter(
    sec => (sec as HTMLElement).offsetParent !== null,
  )

  if (!sections.length) return

  const lines: string[] = []
  let headerDone = false

  sections.forEach(sec => {
    const table = sec.querySelector('.tw table')
    if (!table) return
    const id = (sec as HTMLElement).dataset.exportId || ''
    const name = (sec as HTMLElement).dataset.exportName || ''
    const block = tableToCSV(table as HTMLTableElement, id, name, !headerDone)
    if (!block) return
    if (lines.length) lines.push('')
    lines.push(block)
    headerDone = true
  })

  if (!lines.length) return
  downloadCSV(lines.join('\r\n'))
}
