import * as XLSX from 'xlsx'
import { isMonthlyDualTable } from './tablePieExtract'

function cleanCellText(el: Element): string {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('.si').forEach(e => e.remove())
  return clone.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

function cellNumber(td: HTMLTableCellElement | undefined): number {
  if (!td) return 0
  if (td.dataset.sv !== undefined && td.dataset.sv !== '') return Number(td.dataset.sv) || 0
  const n = Number(cleanCellText(td).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function dualMonthCellMetrics(td: HTMLTableCellElement): {
  cashCur: number
  qtyCur: number
  cashPrev: number
  qtyPrev: number
} {
  return {
    cashCur: Number(td.dataset.cashCur ?? td.dataset.sv ?? 0) || 0,
    qtyCur: Number(td.dataset.qtyCur ?? 0) || 0,
    cashPrev: Number(td.dataset.cashPrev ?? 0) || 0,
    qtyPrev: Number(td.dataset.qtyPrev ?? 0) || 0,
  }
}

function tableHasCashAndQty(table: HTMLTableElement): boolean {
  if (isMonthlyDualTable(table)) return true
  const headers = [...table.querySelectorAll('thead th')]
  const cashIdx = headers.findIndex(th => th.hasAttribute('data-pie-cash'))
  const qtyIdx = headers.findIndex(th => th.hasAttribute('data-pie-qty'))
  return cashIdx >= 0 && qtyIdx >= 0
}

function buildDualMonthSheets(
  table: HTMLTableElement,
  exportId: string,
  exportName: string,
): { cash: string[][]; qty: string[][] } {
  const headerRow = table.querySelector('thead tr')
  if (!headerRow) return { cash: [], qty: [] }

  const headers = [...headerRow.querySelectorAll('th')]
  const monthStart = 2
  const monthEnd = headers.findIndex(th => th.hasAttribute('data-pie-cash'))
  const monthHeaders = headers.slice(monthStart, monthEnd).map(cleanCellText)
  const idLabel = cleanCellText(headers[0] ?? document.createElement('th'))
  const nameLabel = cleanCellText(headers[1] ?? document.createElement('th'))
  const prefix = ['ID / SKU', 'Name']

  const cashHeader = [
    ...prefix,
    idLabel,
    nameLabel,
    ...monthHeaders.flatMap(h => [`${h} Cash`, `${h} Cash (prev)`]),
    cleanCellText(headers[monthEnd] ?? document.createElement('th')),
  ]
  const qtyHeader = [
    ...prefix,
    idLabel,
    nameLabel,
    ...monthHeaders.flatMap(h => [`${h} Qty`, `${h} Qty (prev)`]),
    cleanCellText(headers[monthEnd + 1] ?? document.createElement('th')),
  ]

  const cashRows: string[][] = [cashHeader]
  const qtyRows: string[][] = [qtyHeader]

  table.querySelectorAll<HTMLTableRowElement>('tbody tr, tfoot tr').forEach(row => {
    const cells = [...row.querySelectorAll('td')]
    if (!cells.length) return
    const sku = cleanCellText(cells[0] ?? document.createElement('td'))
    const name = cleanCellText(cells[1] ?? document.createElement('td'))
    const rowPrefix = [exportId, exportName]
    const cashVals: string[] = []
    const qtyVals: string[] = []
    for (let i = monthStart; i < monthEnd; i++) {
      const m = dualMonthCellMetrics(cells[i] as HTMLTableCellElement)
      cashVals.push(String(m.cashCur), String(m.cashPrev))
      qtyVals.push(String(m.qtyCur), String(m.qtyPrev))
    }
    const totalCash = cellNumber(cells[monthEnd] as HTMLTableCellElement)
    const totalQty = cellNumber(cells[monthEnd + 1] as HTMLTableCellElement)
    cashRows.push([...rowPrefix, sku, name, ...cashVals, String(totalCash)])
    qtyRows.push([...rowPrefix, sku, name, ...qtyVals, String(totalQty)])
  })

  return { cash: cashRows, qty: qtyRows }
}

function buildSplitMetricSheets(
  table: HTMLTableElement,
  exportId: string,
  exportName: string,
): { cash: string[][]; qty: string[][] } {
  const headerRow = table.querySelector('thead tr')
  if (!headerRow) return { cash: [], qty: [] }

  const headers = [...headerRow.querySelectorAll('th')]
  const cashIdx = headers.findIndex(th => th.hasAttribute('data-pie-cash'))
  const qtyIdx = headers.findIndex(th => th.hasAttribute('data-pie-qty'))
  if (cashIdx < 0 || qtyIdx < 0) return { cash: [], qty: [] }

  const sharedIdx = [0, 1]
  const cashOnly = [...sharedIdx, cashIdx]
  const qtyOnly = [...sharedIdx, qtyIdx]
  for (let i = 0; i < headers.length; i++) {
    if (i === cashIdx || i === qtyIdx || i <= 1) continue
    cashOnly.push(i)
  }

  const prefix = ['ID / SKU', 'Name']
  const cashHeader = [...prefix, ...cashOnly.map(i => cleanCellText(headers[i] ?? document.createElement('th')))]
  const qtyHeader = [...prefix, ...qtyOnly.map(i => cleanCellText(headers[i] ?? document.createElement('th')))]

  const cashRows: string[][] = [cashHeader]
  const qtyRows: string[][] = [qtyHeader]

  table.querySelectorAll<HTMLTableRowElement>('tbody tr, tfoot tr').forEach(row => {
    const cells = [...row.querySelectorAll('td')]
    if (!cells.length) return
    const cashLine = [...[exportId, exportName], ...cashOnly.map(i => cleanCellText(cells[i] ?? document.createElement('td')))]
    const qtyLine = [...[exportId, exportName], ...qtyOnly.map(i => cleanCellText(cells[i] ?? document.createElement('td')))]
    cashRows.push(cashLine)
    qtyRows.push(qtyLine)
  })

  return { cash: cashRows, qty: qtyRows }
}

export function downloadWorkbook(
  sheets: Array<{ name: string; rows: string[][] }>,
  filename: string,
): void {
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    if (!sheet.rows.length) continue
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name.slice(0, 31))
  }
  if (!wb.SheetNames.length) return
  XLSX.writeFile(wb, filename)
}

export function downloadSplitCashQtyTable(
  table: HTMLTableElement,
  exportId = '',
  exportName = '',
  filename?: string,
): boolean {
  if (!tableHasCashAndQty(table)) return false

  const sheets = isMonthlyDualTable(table)
    ? buildDualMonthSheets(table, exportId, exportName)
    : buildSplitMetricSheets(table, exportId, exportName)

  const base =
    filename?.replace(/\.(csv|xlsx)$/i, '') ||
    exportName.replace(/\s+/g, '_') ||
    `export_${new Date().toISOString().slice(0, 10)}`

  downloadWorkbook(
    [
      { name: 'Cash', rows: sheets.cash },
      { name: 'Qty', rows: sheets.qty },
    ],
    `${base}.xlsx`,
  )
  return true
}
