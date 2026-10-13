import type { SalesRow } from '../types/dashboard'

/**
 * Column-by-column sales page as sent by get_dashboard_sales_range_v2.
 * Text columns hold indexes into `dict` (null = the value was null); numeric
 * columns hold the values. Several times smaller than an array of row objects
 * and much faster to parse on phones.
 */
export interface CompactSalesPage {
  v: 2
  n: number
  dict: string[]
  company: Array<number | null>
  date: Array<number | null>
  year: Array<number | null>
  month: Array<number | null>
  agent: Array<number | null>
  clientID: Array<number | null>
  clientName: Array<number | null>
  docNum: Array<number | null>
  itemSKU: Array<number | null>
  itemName: Array<number | null>
  qty: Array<number | null>
  cash: Array<number | null>
  tabletCat: Array<number | null>
  groupCat: Array<number | null>
  supplier: Array<number | null>
}

const TEXT_COLS = [
  'company', 'date', 'agent', 'clientID', 'clientName', 'docNum',
  'itemSKU', 'itemName', 'tabletCat', 'groupCat', 'supplier',
] as const
const NUM_COLS = ['year', 'month', 'qty', 'cash'] as const

/** Back to the exact row objects the v1 RPC returned (nulls kept as null). */
export function decodeSalesPage(p: CompactSalesPage): SalesRow[] {
  const n = p.n ?? 0
  const d = p.dict ?? []
  const s = (col: Array<number | null> | undefined, i: number): string | null => {
    const k = col?.[i]
    return k == null ? null : d[k]
  }
  const out: SalesRow[] = new Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = {
      company: s(p.company, i) as string,
      date: s(p.date, i) as string,
      year: p.year?.[i] as number,
      month: p.month?.[i] as number,
      agent: s(p.agent, i) as string,
      clientID: s(p.clientID, i) as string,
      clientName: s(p.clientName, i) as string,
      docNum: s(p.docNum, i) as string,
      itemSKU: s(p.itemSKU, i) as string,
      itemName: s(p.itemName, i) as string,
      qty: p.qty?.[i] as number,
      cash: p.cash?.[i] as number,
      tabletCat: s(p.tabletCat, i) as string,
      groupCat: s(p.groupCat, i) as string,
      supplier: s(p.supplier, i) as string,
    }
  }
  return out
}

/** Row objects to a compact page (used when only the v1 RPC is available, so the device cache has one shape). */
export function encodeSalesRows(rows: SalesRow[]): CompactSalesPage {
  const dict: string[] = []
  const index = new Map<string, number>()
  const key = (v: unknown): number | null => {
    if (v == null) return null
    const str = String(v)
    let k = index.get(str)
    if (k === undefined) {
      k = dict.length
      dict.push(str)
      index.set(str, k)
    }
    return k
  }
  const page = { v: 2, n: rows.length, dict } as CompactSalesPage
  for (const c of TEXT_COLS) page[c] = rows.map(r => key(r[c]))
  for (const c of NUM_COLS) page[c] = rows.map(r => (r[c] == null ? null : Number(r[c])))
  return page
}
