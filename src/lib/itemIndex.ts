import { supabase } from './supabase'
import { matchesSearch } from './salesSearch'
import type { LogicalCompany } from '../types/dashboard'

/** One row of the Items index (RPC get_item_index; see migration 20261005100000_item_index.sql). */
export interface ItemIndexRow {
  co: LogicalCompany
  sku: string
  name: string
  alt: string | null
  bc: string | null
  /** REP103 column I — only items with a value here are in the index. */
  cat: string | null
  p01: number | null
  /** Landed cost (REP907 E) — null when hidden for this user or not allowed. */
  cost: number | null
  /** FOB price (REP907 K / MT P11) — null when hidden for this user or not allowed. */
  fob: number | null
  /** WMS stock (summed per SKU); null when the item is not in the WMS file. */
  wms: number | null
}

export interface ItemIndex {
  rows: ItemIndexRow[]
  showCost: boolean
  showFob: boolean
}

const EMPTY: ItemIndex = { rows: [], showCost: false, showFob: false }

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Normalise the RPC payload (numbers may arrive as strings; missing keys become null). */
export function parseItemIndex(data: unknown): ItemIndex {
  if (!data || typeof data !== 'object') return EMPTY
  const d = data as { rows?: unknown; showCost?: unknown; showFob?: unknown }
  const rows = Array.isArray(d.rows) ? d.rows : []
  return {
    showCost: d.showCost === true,
    showFob: d.showFob === true,
    rows: rows.map(r => {
      const x = r as Record<string, unknown>
      return {
        co: String(x.co ?? '') as LogicalCompany,
        sku: String(x.sku ?? ''),
        name: String(x.name ?? ''),
        alt: x.alt == null ? null : String(x.alt),
        bc: x.bc == null ? null : String(x.bc),
        cat: x.cat == null ? null : String(x.cat),
        p01: num(x.p01),
        cost: num(x.cost),
        fob: num(x.fob),
        wms: num(x.wms),
      }
    }),
  }
}

export async function fetchItemIndex(): Promise<ItemIndex> {
  const { data, error } = await supabase.rpc('get_item_index')
  if (error) throw error
  return parseItemIndex(data)
}

/** Rows of one company ('all' = every company), matching the search on SKU, name, alternate no., barcode, category. */
export function filterItemIndex(rows: ItemIndexRow[], company: LogicalCompany | 'all', query: string): ItemIndexRow[] {
  return rows.filter(
    r => (company === 'all' || r.co === company) && matchesSearch(query, r.sku, r.name, r.alt, r.bc, r.cat),
  )
}
