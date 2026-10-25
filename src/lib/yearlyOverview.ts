/** R&D -> Yearly data: one company, year by year (sales, returns, receivables, imports, brand sales, brand imports). */
import { supabase } from './supabase'

export interface YearlyOverview {
  years: Array<{ year: number; sold: number; returned: number; qtySold: number; qtyReturned: number }>
  receipts: Array<{ year: number; cash: number }>
  imports: Array<{ year: number; qty: number; value: number | null; docs: number }>
  brandSales: Array<{ year: number; brand: string; net: number; returned: number; qty: number }>
  brandImports: Array<{ year: number; brand: string; qty: number; value: number | null }>
}

export async function fetchYearlyOverview(company: string, asUser?: string | null): Promise<YearlyOverview | null> {
  const { data, error } = await supabase.rpc('get_yearly_overview', { p_company: company, p_as: asUser ?? null })
  if (error) throw error
  return (data ?? null) as YearlyOverview | null
}

export interface YearRow {
  year: number
  net: number
  returned: number
  /** returns divided by revenue including them (document 14 over revenue + returns) */
  rate: number | null
  /** net sales against the year before, as a share (null for the first year) */
  vsPrev: number | null
  receipts: number | null
  importQty: number | null
  importValue: number | null
}

/** One row per year that has anything, oldest first. Missing receipts / imports stay null (not zero). */
export function buildYearRows(o: YearlyOverview): YearRow[] {
  const years = new Set<number>()
  o.years.forEach(y => years.add(y.year))
  o.receipts.forEach(r => years.add(r.year))
  o.imports.forEach(i => years.add(i.year))
  const sales = new Map(o.years.map(y => [y.year, y]))
  const rec = new Map(o.receipts.map(r => [r.year, r.cash]))
  const imp = new Map(o.imports.map(i => [i.year, i]))
  const out: YearRow[] = []
  for (const year of [...years].sort((a, b) => a - b)) {
    const s = sales.get(year)
    const net = s ? s.sold - s.returned : 0
    const prev = out.length && out[out.length - 1].year === year - 1 ? out[out.length - 1] : null
    out.push({
      year,
      net,
      returned: s?.returned ?? 0,
      rate: s && s.sold > 0 ? s.returned / s.sold : null,
      vsPrev: prev && prev.net !== 0 ? (net - prev.net) / Math.abs(prev.net) : null,
      receipts: rec.has(year) ? (rec.get(year) as number) : null,
      importQty: imp.has(year) ? (imp.get(year)!.qty as number) : null,
      importValue: imp.has(year) ? (imp.get(year)!.value ?? null) : null,
    })
  }
  return out
}

export interface BrandMatrixRow {
  brand: string
  total: number
  /** the amount per year */
  byYear: Record<number, number>
}

/** Brand x year matrix from (year, brand, value) rows; sorted by total, "Other" last. */
export function buildBrandMatrix(
  rows: ReadonlyArray<{ year: number; brand: string; value: number | null | undefined }>,
): { years: number[]; rows: BrandMatrixRow[] } {
  const years = [...new Set(rows.map(r => r.year))].sort((a, b) => a - b)
  const by = new Map<string, BrandMatrixRow>()
  for (const r of rows) {
    const v = Number(r.value ?? 0)
    let row = by.get(r.brand)
    if (!row) by.set(r.brand, (row = { brand: r.brand, total: 0, byYear: {} }))
    row.byYear[r.year] = (row.byYear[r.year] ?? 0) + v
    row.total += v
  }
  const list = [...by.values()].sort((a, b) => (a.brand === 'Other' ? 1 : b.brand === 'Other' ? -1 : b.total - a.total))
  return { years, rows: list }
}
