/**
 * Margin exceptions report: items with no cost and items with gross margin under 10%, per company, for one year.
 * The lists come from the database (get_margin_exceptions, which only answers users who may see item costs);
 * this file turns them into the Excel workbook.
 */
import { supabase } from './supabase'
import { downloadWorkbook, type WorkbookCell, type WorkbookSheet } from './spreadsheetExport'

export interface ExceptionItem { sku: string; name: string | null; qty: number | null; net: number | null; unitCost?: number }
/** shortCodes: no-cost items whose code is cut to 11 characters (the start of a longer known code); not in noCost. */
export interface ExceptionCompany { company: string; noCost: ExceptionItem[]; lowMargin: ExceptionItem[]; shortCodes?: ExceptionItem[] }
export interface MarginExceptions { year: number; asOf: string; companies: ExceptionCompany[] }

const NAMES: Record<string, string> = { pupik: 'Pupik', mt: 'Monkeytime', gold: 'Goldbug' }
const LIMIT = 0.1

/** null = not allowed to see item costs; a failed call throws. */
export async function fetchMarginExceptions(year?: number): Promise<MarginExceptions | null> {
  const { data, error } = await supabase.rpc('get_margin_exceptions', { p_year: year ?? null })
  if (error) throw new Error(error.message)
  return (data ?? null) as MarginExceptions | null
}

const round = (n: number, d = 0) => { const f = 10 ** d; return Math.round(n * f) / f }

export function buildExceptionSheets(r: MarginExceptions): WorkbookSheet[] {
  const co = (c: ExceptionCompany) => NAMES[c.company] ?? c.company
  const pct = LIMIT * 100
  const summary: WorkbookCell[][] = [
    [`Items without cost and items with gross margin under ${pct}% - ${r.year} (to ${r.asOf})`],
    ['Same cost basis as the dashboard gross margin: import cost of the year, else current cost. Net sales = sales minus returns. Grow sales are inside Pupik.'],
    [],
    ['Company', 'Items with no cost', 'Net sales of those items', `Items with margin under ${pct}%`, 'Net sales of those items'],
    ...r.companies.map(c => [
      co(c), c.noCost.length, round(c.noCost.reduce((a, x) => a + (x.net ?? 0), 0)),
      c.lowMargin.length, round(c.lowMargin.reduce((a, x) => a + (x.net ?? 0), 0)),
    ] as WorkbookCell[]),
    [],
    ['No cost: the item sold in the year but has no purchase cost on file, so its margin cannot be calculated. Fee, discount and advance codes (for example 104, 400, 455, 600) never carry a cost and appear here.'],
    ['Margin under limit: margin = net sales - quantity x unit cost, as % of net sales. Items sold below cost have a negative margin. Items whose returns exceeded sales appear only under No cost.'],
    ['Short codes: an item code cut to 11 characters by an old ERP export (the start of a longer code) is not a real no-cost item, so it is left out of the No cost list and shown on the Short codes sheet instead. Re-export the source file with the full item code to fix it.'],
  ]
  const noCost: WorkbookCell[][] = [['Company', 'Item code', 'Item name', 'Qty sold', 'Net sales', 'Unit cost']]
  const low: WorkbookCell[][] = [['Company', 'Item code', 'Item name', 'Qty sold', 'Net sales', 'Unit cost', 'Total cost', 'Margin', 'Margin %']]
  const shortSheet: WorkbookCell[][] = [['Company', 'Item code (cut to 11 characters)', 'Item name', 'Qty sold', 'Net sales']]
  for (const c of r.companies) {
    for (const x of c.shortCodes ?? []) shortSheet.push([co(c), x.sku, x.name ?? '', round(x.qty ?? 0, 2), round(x.net ?? 0)])
    for (const x of c.noCost) noCost.push([co(c), x.sku, x.name ?? '', round(x.qty ?? 0, 2), round(x.net ?? 0), null])
    for (const x of c.lowMargin) {
      const qty = x.qty ?? 0
      const net = x.net ?? 0
      const uc = x.unitCost ?? 0
      const total = qty * uc
      low.push([co(c), x.sku, x.name ?? '', round(qty, 2), round(net), round(uc, 2), round(total), round(net - total), net ? round((net - total) / net, 4) : null])
    }
  }
  const sheets: WorkbookSheet[] = [
    { name: 'Summary', rows: summary, widths: [16, 20, 24, 26, 24] },
    { name: 'No cost', rows: noCost, widths: [12, 18, 38, 12, 14, 12], headerFilter: true },
    { name: `Margin under ${pct}%`, rows: low, widths: [12, 18, 38, 12, 14, 12, 14, 14, 11], headerFilter: true },
  ]
  if (shortSheet.length > 1) sheets.push({ name: 'Short codes', rows: shortSheet, widths: [12, 30, 38, 12, 14], headerFilter: true })
  return sheets
}

export async function downloadMarginExceptions(year?: number): Promise<'ok' | 'denied'> {
  const r = await fetchMarginExceptions(year)
  if (!r) return 'denied'
  downloadWorkbook(buildExceptionSheets(r), `margin-and-no-cost-items-${r.year}-${r.asOf}.xlsx`)
  return 'ok'
}
