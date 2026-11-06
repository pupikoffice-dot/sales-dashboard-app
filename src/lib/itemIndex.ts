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
  /** Last non-empty category this item ever had (item_category_last); null when never seen with one. */
  lastCategory: string | null
  /** ISO timestamp of the last REP103 load that had the item with lastCategory. */
  lastCategorySeenAt: string | null
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

/** Non-empty trimmed string or null. */
function str(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** ISO timestamp -> 'DD/MM/YYYY' (local date); empty string when missing or invalid. */
export function formatCategorySeenDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/** 'Toys (05/11/2026)'; the category alone when the date is unknown; empty string when there is no last category. */
export function formatLastCategory(cat: string | null | undefined, seenAt: string | null | undefined): string {
  if (!cat) return ''
  const d = formatCategorySeenDate(seenAt)
  return d ? `${cat} (${d})` : cat
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
        lastCategory: str(x.lcat),
        lastCategorySeenAt: str(x.lcatAt),
      }
    }),
  }
}

export async function fetchItemIndex(): Promise<ItemIndex> {
  const { data, error } = await supabase.rpc('get_item_index')
  if (error) throw error
  return parseItemIndex(data)
}

/** One in-stock item with no category (RPC get_uncategorized_stock; migration 20261102100000_uncategorized_stock.sql). */
export interface UncategorizedStockRow {
  co: LogicalCompany
  sku: string
  name: string
  p01: number | null
  wms: number
  /** no_row = item not in the latest REP103 load; empty = in the load but column I is empty. */
  why: 'no_row' | 'empty'
  /** Last known category (item_category_last) and the date it was seen; null when none is on record. */
  lastCategory: string | null
  lastCategorySeenAt: string | null
}

export function parseUncategorizedStock(data: unknown): UncategorizedStockRow[] {
  const rows = data && typeof data === 'object' ? (data as { rows?: unknown }).rows : null
  if (!Array.isArray(rows)) return []
  return rows.map(r => {
    const x = r as Record<string, unknown>
    return {
      co: String(x.co ?? '') as LogicalCompany,
      sku: String(x.sku ?? ''),
      name: String(x.name ?? ''),
      p01: num(x.p01),
      wms: num(x.wms) ?? 0,
      why: x.why === 'empty' ? 'empty' : 'no_row',
      lastCategory: str(x.lcat),
      lastCategorySeenAt: str(x.lcatAt),
    }
  })
}

export async function fetchUncategorizedStock(): Promise<UncategorizedStockRow[]> {
  const { data, error } = await supabase.rpc('get_uncategorized_stock')
  if (error) throw error
  return parseUncategorizedStock(data)
}

/** Rows of one company ('all' = every company), matching the search on SKU and name. */
export function filterUncategorizedStock(
  rows: UncategorizedStockRow[],
  company: LogicalCompany | 'all',
  query: string,
): UncategorizedStockRow[] {
  return rows.filter(r => (company === 'all' || r.co === company) && matchesSearch(query, r.sku, r.name))
}

/** What a previewed user may see (the preview target's access, not the signed-in admin's). */
export interface PreviewScope {
  companies: readonly string[]
  showItemCost: boolean
  hiddenSidebar?: readonly string[] | null
}

/**
 * "View as user": the data was fetched with the admin's own session, so it holds every company and all cost
 * columns. Cut it down to what the previewed user would get from the database itself.
 */
export function maskItemIndexForPreview(idx: ItemIndex, scope: PreviewScope): ItemIndex {
  const hidden = new Set(scope.hiddenSidebar ?? [])
  if (hidden.has('date.items')) return EMPTY
  const co = new Set(scope.companies)
  const showCost = idx.showCost && scope.showItemCost && !hidden.has('items.col.cost')
  const showFob = idx.showFob && scope.showItemCost && !hidden.has('items.col.fob')
  return {
    showCost,
    showFob,
    rows: idx.rows
      .filter(r => co.has(r.co))
      .map(r => ({ ...r, cost: showCost ? r.cost : null, fob: showFob ? r.fob : null })),
  }
}

/** Rows of one company ('all' = every company), matching the search on SKU, name, alternate no., barcode, category. */
export function filterItemIndex(rows: ItemIndexRow[], company: LogicalCompany | 'all', query: string): ItemIndexRow[] {
  return rows.filter(
    r => (company === 'all' || r.co === company) && matchesSearch(query, r.sku, r.name, r.alt, r.bc, r.cat),
  )
}
