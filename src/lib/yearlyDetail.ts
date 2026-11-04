/** R&D -> Yearly data: one company, one year: the year's totals and the same data month by month. */
import { supabase } from './supabase'

export interface YearlyDetail {
  year: number
  sales: Array<{ month: number; sold: number; returned: number; qtySold: number; qtyReturned: number }>
  receipts: Array<{ month: number; cash: number }>
  imports: Array<{ month: number; qty: number; value: number | null; docs: number }>
  /** distinct import documents over the whole year (not the sum of the months) */
  importDocs: number
  brandSales: Array<{ month: number; brand: string; net: number; returned: number; qty: number }>
  brandImports: Array<{ month: number; brand: string; qty: number; value: number | null }>
}

export async function fetchYearlyDetail(company: string, year: number, asUser?: string | null): Promise<YearlyDetail | null> {
  const { data, error } = await supabase.rpc('get_yearly_detail', { p_company: company, p_year: year, p_as: asUser ?? null })
  if (error) throw error
  return (data ?? null) as YearlyDetail | null
}

export interface MonthRow {
  /** 1-12; the year total row has month 0 */
  month: number
  net: number
  returned: number
  /** returns divided by revenue including them */
  rate: number | null
  /** net sales against the month before, as a share (null for January and where there is no base) */
  vsPrev: number | null
  receipts: number | null
  importQty: number | null
  importValue: number | null
  importDocs: number | null
}

const nz = (v: number | null | undefined) => Number(v ?? 0)

/** Always 12 rows. Months without receipts / imports stay null (not zero), as in the multi-year table. */
export function buildMonthRows(d: YearlyDetail): MonthRow[] {
  const sales = new Map(d.sales.map(s => [s.month, s]))
  const rec = new Map(d.receipts.map(r => [r.month, r.cash]))
  const imp = new Map(d.imports.map(i => [i.month, i]))
  const out: MonthRow[] = []
  for (let month = 1; month <= 12; month++) {
    const s = sales.get(month)
    const net = s ? nz(s.sold) - nz(s.returned) : 0
    const prev = month > 1 ? out[month - 2] : null
    const i = imp.get(month)
    out.push({
      month,
      net,
      returned: nz(s?.returned),
      rate: s && nz(s.sold) > 0 ? nz(s.returned) / nz(s.sold) : null,
      vsPrev: prev && prev.net !== 0 ? (net - prev.net) / Math.abs(prev.net) : null,
      receipts: rec.has(month) ? nz(rec.get(month)) : null,
      importQty: i ? nz(i.qty) : null,
      importValue: i ? (i.value ?? null) : null,
      importDocs: i ? nz(i.docs) : null,
    })
  }
  return out
}

/** The year total, computed from the same payload as the months (so tiles and table always agree). */
export function buildYearTotal(d: YearlyDetail): MonthRow {
  const sold = d.sales.reduce((a, s) => a + nz(s.sold), 0)
  const returned = d.sales.reduce((a, s) => a + nz(s.returned), 0)
  const hasImp = d.imports.length > 0
  const hasValue = d.imports.some(i => i.value != null)
  return {
    month: 0,
    net: sold - returned,
    returned,
    rate: sold > 0 ? returned / sold : null,
    vsPrev: null,
    receipts: d.receipts.length ? d.receipts.reduce((a, r) => a + nz(r.cash), 0) : null,
    importQty: hasImp ? d.imports.reduce((a, i) => a + nz(i.qty), 0) : null,
    importValue: hasValue ? d.imports.reduce((a, i) => a + nz(i.value), 0) : null,
    importDocs: hasImp ? nz(d.importDocs) : null,
  }
}

/** Years that can be picked: every year the multi-year overview has data for, newest first. */
export function pickableYears(o: {
  years: Array<{ year: number }>
  receipts: Array<{ year: number }>
  imports: Array<{ year: number }>
}): number[] {
  const s = new Set<number>()
  o.years.forEach(y => s.add(y.year))
  o.receipts.forEach(y => s.add(y.year))
  o.imports.forEach(y => s.add(y.year))
  return [...s].sort((a, b) => b - a)
}
