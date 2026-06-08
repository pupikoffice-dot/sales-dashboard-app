import type { PieEntry } from './pieData'

function cleanThText(th: Element): string {
  const c = th.cloneNode(true) as Element
  c.querySelectorAll('.si').forEach(e => e.remove())
  return c.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

function cleanTdText(td: Element): string {
  const c = td.cloneNode(true) as Element
  c.querySelectorAll('.si').forEach(e => e.remove())
  return c.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

export function isMonthlyDualTable(table: HTMLTableElement): boolean {
  return table.classList.contains('tw-dual-months')
}

export function isCashSummaryBarTable(table: HTMLTableElement, wrapper: HTMLElement): boolean {
  return wrapper.dataset.barChart === '1'
}

export function extractPieFromTable(table: HTMLTableElement, sectionTitle?: string): PieEntry[] {
  const headers = [...table.querySelectorAll('thead th')]
  const cashColIdx = headers.findIndex(th => th.hasAttribute('data-pie-cash'))
  if (cashColIdx === -1) return []

  const qtyColIdx = headers.findIndex(th => th.hasAttribute('data-pie-qty'))
  const col0Hdr = cleanThText(headers[0] ?? document.createElement('th'))
  const isSkuTable = col0Hdr === 'SKU'

  const entries: PieEntry[] = []
  table.querySelectorAll('tbody tr').forEach(row => {
    const labelCell = row.cells[1]
    const valueCell = row.cells[cashColIdx]
    if (!labelCell || !valueCell) return
    const label = cleanTdText(labelCell)
    const value =
      valueCell.dataset.sv !== undefined && valueCell.dataset.sv !== ''
        ? Number(valueCell.dataset.sv)
        : 0
    const qtyCell = qtyColIdx >= 0 ? row.cells[qtyColIdx] : null
    const qty =
      qtyCell?.dataset.sv !== undefined && qtyCell.dataset.sv !== ''
        ? Number(qtyCell.dataset.sv)
        : 0
    if (label && value > 0) {
      const entry: PieEntry = { label, value, qty }
      if (isSkuTable && row.cells[0]) entry.sku = cleanTdText(row.cells[0])
      entries.push(entry)
    }
  })

  return entries
}

export function extractMonthBarFromDualTable(table: HTMLTableElement) {
  const ths = [...table.querySelectorAll('thead th')]
  const n = ths.length
  const months = ths.slice(2, n - 2).map(cleanThText)
  const cashVals: number[] = []
  const qtyVals: number[] = []

  table.querySelectorAll('tbody tr').forEach(row => {
    months.forEach((_, mi) => {
      const td = row.cells[mi + 2]
      if (!td) return
      const sv = td.dataset.sv !== undefined && td.dataset.sv !== '' ? Number(td.dataset.sv) : 0
      cashVals[mi] = (cashVals[mi] || 0) + sv
      const qtyText = td.textContent?.match(/\(([\d,]+)\)/)
      const q = qtyText ? parseFloat(qtyText[1].replace(/,/g, '')) : 0
      qtyVals[mi] = (qtyVals[mi] || 0) + (Number.isNaN(q) ? 0 : q)
    })
  })

  months.forEach((_, i) => {
    if (cashVals[i] == null) cashVals[i] = 0
    if (qtyVals[i] == null) qtyVals[i] = 0
  })

  return { months, cashVals, qtyVals }
}

export function extractMonthBarFromCashTable(table: HTMLTableElement) {
  const ths = [...table.querySelectorAll('thead th')]
  const months = ths.slice(1, -1).map(cleanThText)
  const bodyRows = [...table.querySelectorAll('tbody tr')]
  const cashRow = bodyRows.find(r => r.cells[0]?.textContent?.includes('Cash'))
  const qtyRow = bodyRows.find(r => r.cells[0]?.textContent?.includes('Qty'))
  const cashVals = cashRow
    ? [...cashRow.cells].slice(1, -1).map(td => parseFloat(td.textContent?.replace(/,/g, '') || '0') || 0)
    : months.map(() => 0)
  const qtyVals = qtyRow
    ? [...qtyRow.cells].slice(1, -1).map(td => parseFloat(td.textContent?.replace(/,/g, '') || '0') || 0)
    : months.map(() => 0)
  return { months, cashVals, qtyVals }
}

export function getTableChartTitle(wrapper: HTMLElement, exportName?: string): string {
  const section = wrapper.closest('.section')
  if (section) {
    const titleEl = section.querySelector('.section-title')
    if (titleEl) {
      const clone = titleEl.cloneNode(true) as Element
      clone.querySelectorAll('.collapse-icon, .si, .section-meta, .section-stock').forEach(el => el.remove())
      const t = clone.textContent?.trim().replace(/\s+/g, ' ')
      if (t) return t
    }
  }
  return exportName || 'Cash Distribution'
}
