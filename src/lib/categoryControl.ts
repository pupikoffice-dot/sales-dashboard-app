import { supabase } from './supabase'
import { matchesSearch } from './salesSearch'

/**
 * Category control (items with no stock keep a category / items with stock lost theirs).
 * RPCs: get_category_control, category_control_decide(_bulk), category_control_undo, approve_held_batch
 * (migration 20261105120000_category_control.sql). Nothing here writes to the ERP.
 */

export type CcDecision = 'remove' | 'leave' | 'exempt'

export interface CcToDecide {
  co: string
  sku: string
  name: string
  /** Current category (REP103 column I). */
  cat: string | null
  flaggedAt: string | null
  /** Last time the item was seen with stock; null = not seen since tracking began. */
  lastStockAt: string | null
  wms: number
  lastCategory: string | null
  /** Supplier code from the price list (the closest thing to a brand the item index has); null when unknown. */
  supplier: string | null
}

export interface CcRestore {
  id: number
  co: string
  sku: string
  name: string
  to: string
  reason: string | null
  createdAt: string | null
  origin: string
  wms: number | null
}

export interface CcAction {
  id: number
  co: string
  sku: string
  name: string
  action: 'CLEAR' | 'RESTORE'
  from: string | null
  to: string
  reason: string | null
  origin: string
  createdAt: string | null
  decidedBy: string | null
}

export interface CcHistory {
  id: number
  co: string
  sku: string
  name: string
  action: 'CLEAR' | 'RESTORE'
  from: string | null
  to: string
  status: 'done' | 'failed' | 'cancelled'
  error: string | null
  attempts: number
  origin: string
  at: string | null
  decidedBy: string | null
}

export interface CcMark {
  id: number
  co: string
  sku: string
  name: string
  note: string | null
  createdAt: string | null
  by: string | null
}

export interface CcHeld {
  id: number
  co: string
  newFlags: number
  newRestores: number
  threshold: number
  catalogItems: number
  status: 'held' | 'approved'
}

export interface CategoryControlData {
  canWrite: boolean
  canApprove: boolean
  toDecide: CcToDecide[]
  restore: CcRestore[]
  pending: CcAction[]
  history: CcHistory[]
  presale: CcMark[]
  exempt: CcMark[]
  held: CcHeld[]
}

export const EMPTY_CATEGORY_CONTROL: CategoryControlData = {
  canWrite: false,
  canApprove: false,
  toDecide: [],
  restore: [],
  pending: [],
  history: [],
  presale: [],
  exempt: [],
  held: [],
}

const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : [])
const s = (v: unknown): string => (v == null ? '' : String(v))
const sn = (v: unknown): string | null => {
  const x = v == null ? '' : String(v).trim()
  return x === '' ? null : x
}
const n = (v: unknown): number => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

/** Normalise the RPC payload (missing keys become empty lists, numbers may arrive as strings). */
export function parseCategoryControl(data: unknown): CategoryControlData {
  if (!data || typeof data !== 'object') return EMPTY_CATEGORY_CONTROL
  const d = data as Record<string, unknown>
  const mark = (x: Record<string, unknown>): CcMark => ({
    id: n(x.id),
    co: s(x.co),
    sku: s(x.sku),
    name: s(x.name),
    note: sn(x.note),
    createdAt: sn(x.createdAt),
    by: sn(x.by),
  })
  return {
    canWrite: d.canWrite === true,
    canApprove: d.canApprove === true,
    toDecide: arr(d.toDecide).map(x => ({
      co: s(x.co),
      sku: s(x.sku),
      name: s(x.name),
      cat: sn(x.cat),
      flaggedAt: sn(x.flaggedAt),
      lastStockAt: sn(x.lastStockAt),
      wms: n(x.wms),
      lastCategory: sn(x.lcat),
      supplier: sn(x.sup),
    })),
    restore: arr(d.restore).map(x => ({
      id: n(x.id),
      co: s(x.co),
      sku: s(x.sku),
      name: s(x.name),
      to: s(x.to),
      reason: sn(x.reason),
      createdAt: sn(x.createdAt),
      origin: s(x.origin),
      wms: x.wms == null ? null : n(x.wms),
    })),
    pending: arr(d.pending).map(x => ({
      id: n(x.id),
      co: s(x.co),
      sku: s(x.sku),
      name: s(x.name),
      action: x.action === 'RESTORE' ? 'RESTORE' : 'CLEAR',
      from: sn(x.from),
      to: s(x.to),
      reason: sn(x.reason),
      origin: s(x.origin),
      createdAt: sn(x.createdAt),
      decidedBy: sn(x.decidedBy),
    })),
    history: arr(d.history).map(x => ({
      id: n(x.id),
      co: s(x.co),
      sku: s(x.sku),
      name: s(x.name),
      action: x.action === 'RESTORE' ? 'RESTORE' : 'CLEAR',
      from: sn(x.from),
      to: s(x.to),
      status: x.status === 'failed' ? 'failed' : x.status === 'cancelled' ? 'cancelled' : 'done',
      error: sn(x.error),
      attempts: n(x.attempts),
      origin: s(x.origin),
      at: sn(x.at),
      decidedBy: sn(x.decidedBy),
    })),
    presale: arr(d.presale).map(mark),
    exempt: arr(d.exempt).map(mark),
    held: arr(d.held).map(x => ({
      id: n(x.id),
      co: s(x.co),
      newFlags: n(x.newFlags),
      newRestores: n(x.newRestores),
      threshold: n(x.threshold),
      catalogItems: n(x.catalogItems),
      status: x.status === 'approved' ? 'approved' : 'held',
    })),
  }
}

export async function fetchCategoryControl(): Promise<CategoryControlData> {
  const { data, error } = await supabase.rpc('get_category_control', { p_company: null })
  if (error) throw error
  return parseCategoryControl(data)
}

/** Split a list into slices of at most `size` (bulk calls stay well inside the database statement timeout). */
export function chunk<T>(list: readonly T[], size: number): T[][] {
  const sz = Math.max(1, Math.floor(size) || 1)
  const out: T[][] = []
  for (let i = 0; i < list.length; i += sz) out.push(list.slice(i, i + sz))
  return out
}

export const DECIDE_CALL_SIZE = 200

export async function decideCategory(
  company: string,
  skus: string[],
  decision: CcDecision,
  note: string | null = null,
): Promise<{ done: number; skipped: number }> {
  let done = 0
  let skipped = 0
  for (const part of chunk(skus, DECIDE_CALL_SIZE)) {
    const { data, error } = await supabase.rpc('category_control_decide_bulk', {
      p_company: company,
      p_skus: part,
      p_decision: decision,
      p_note: note,
    })
    if (error) throw error
    const d = (data ?? {}) as { done?: unknown; skipped?: unknown }
    done += n(d.done)
    skipped += n(d.skipped)
  }
  return { done, skipped }
}

export async function undoCategory(company: string, sku: string, what: 'presale' | 'exempt' | 'action', ref: number | null = null): Promise<number> {
  const { data, error } = await supabase.rpc('category_control_undo', { p_company: company, p_sku: sku, p_what: what, p_ref: ref })
  if (error) throw error
  return n((data as { done?: unknown } | null)?.done)
}

export async function approveHeldBatch(id: number, note: string | null = null): Promise<number> {
  const { data, error } = await supabase.rpc('approve_held_batch', { p_batch_id: id, p_note: note })
  if (error) throw error
  return n((data as { done?: unknown } | null)?.done)
}

/** What a previewed ("view as") user would see: only their companies, and no write buttons unless they would have them. */
export function maskCategoryControlForPreview(d: CategoryControlData, companies: readonly string[]): CategoryControlData {
  const co = new Set(companies)
  const keep = <T extends { co: string }>(rows: T[]) => rows.filter(r => co.has(r.co))
  return {
    canWrite: false,
    canApprove: false,
    toDecide: keep(d.toDecide),
    restore: keep(d.restore),
    pending: keep(d.pending),
    history: keep(d.history),
    presale: keep(d.presale),
    exempt: keep(d.exempt),
    held: keep(d.held),
  }
}

/** Rows of one company ('all' = every company) matching the search on SKU, name and category. */
export function filterControlRows<T extends { co: string; sku: string; name: string }>(
  rows: readonly T[],
  company: string,
  query: string,
  extra: (r: T) => (string | null | undefined)[] = () => [],
): T[] {
  return rows.filter(r => (company === 'all' || r.co === company) && matchesSearch(query, r.sku, r.name, ...extra(r)))
}

/** Selection keys are 'company|sku'. */
export const selKey = (co: string, sku: string): string => `${co}|${sku}`

export function toggleKey(sel: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(sel)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

/** All visible rows selected -> clear them; otherwise select every visible row (rows hidden by a filter keep their state). */
export function toggleAllVisible(sel: ReadonlySet<string>, visibleKeys: readonly string[]): Set<string> {
  const next = new Set(sel)
  const all = visibleKeys.length > 0 && visibleKeys.every(k => next.has(k))
  for (const k of visibleKeys) {
    if (all) next.delete(k)
    else next.add(k)
  }
  return next
}

/** Selected keys grouped by company, ready for one bulk call per company. Keys of rows that are no longer listed are dropped. */
export function groupSelection(sel: ReadonlySet<string>, listed: readonly { co: string; sku: string }[]): Map<string, string[]> {
  const live = new Set(listed.map(r => selKey(r.co, r.sku)))
  const out = new Map<string, string[]>()
  for (const r of listed) {
    const k = selKey(r.co, r.sku)
    if (!sel.has(k) || !live.has(k)) continue
    const list = out.get(r.co) ?? []
    list.push(r.sku)
    out.set(r.co, list)
  }
  return out
}

/** 'DD/MM/YYYY' from an ISO timestamp; empty when missing or invalid. */
export function formatCcDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export interface CcCounts {
  toDecide: number
  restore: number
  pending: number
  held: number
}

export function controlCounts(d: CategoryControlData, company: string = 'all'): CcCounts {
  const f = <T extends { co: string }>(rows: T[]) => rows.filter(r => company === 'all' || r.co === company).length
  return { toDecide: f(d.toDecide), restore: f(d.restore), pending: f(d.pending), held: f(d.held) }
}

// ---------------------------------------------------------------- "to decide" list: filters, pages, selection

export interface DecideFilters {
  /** Free text over SKU, name, current and last category. */
  query: string
  /** Exact category ('' = any). */
  category: string
  /** Exact supplier code ('' = any). */
  supplier: string
  /** Last in stock between these local dates, 'YYYY-MM-DD' ('' = open end). Items with no known date never match once a bound is set. */
  stockFrom: string
  stockTo: string
}

export const EMPTY_DECIDE_FILTERS: DecideFilters = { query: '', category: '', supplier: '', stockFrom: '', stockTo: '' }

export const DECIDE_PAGE_SIZES = [50, 100, 250, 500] as const
export const DEFAULT_DECIDE_PAGE_SIZE = 100

/** Local 'YYYY-MM-DD' of an ISO timestamp ('' when missing or invalid). */
export function isoToLocalDay(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function filterToDecide(rows: readonly CcToDecide[], f: DecideFilters): CcToDecide[] {
  const hasDate = !!(f.stockFrom || f.stockTo)
  return rows.filter(r => {
    if (f.category && (r.cat ?? '') !== f.category) return false
    if (f.supplier && (r.supplier ?? '') !== f.supplier) return false
    if (hasDate) {
      const day = isoToLocalDay(r.lastStockAt)
      if (!day) return false
      if (f.stockFrom && day < f.stockFrom) return false
      if (f.stockTo && day > f.stockTo) return false
    }
    return matchesSearch(f.query, r.sku, r.name, r.cat, r.lastCategory)
  })
}

export const hasDecideFilters = (f: DecideFilters): boolean =>
  !!(f.query.trim() || f.category || f.supplier || f.stockFrom || f.stockTo)

/** Distinct non-empty values with their row counts, most frequent first (ties alphabetical). */
export function facetOptions(values: readonly (string | null | undefined)[]): { value: string; count: number }[] {
  const m = new Map<string, number>()
  for (const v of values) {
    const x = (v ?? '').trim()
    if (x) m.set(x, (m.get(x) ?? 0) + 1)
  }
  return [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

export interface PageInfo<T> {
  rows: T[]
  /** Clamped, 1-based. */
  page: number
  pages: number
  total: number
  /** 1-based index of the first and last row shown (0 when empty). */
  from: number
  to: number
}

export function paginate<T>(rows: readonly T[], page: number, size: number): PageInfo<T> {
  const sz = Math.max(1, Math.floor(size) || DEFAULT_DECIDE_PAGE_SIZE)
  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / sz))
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages)
  const start = (p - 1) * sz
  const slice = rows.slice(start, start + sz)
  return { rows: slice, page: p, pages, total, from: slice.length ? start + 1 : 0, to: start + slice.length }
}

/** Add every key (select the current page, or every filtered row). */
export function selectKeys(sel: ReadonlySet<string>, keys: readonly string[]): Set<string> {
  const next = new Set(sel)
  for (const k of keys) next.add(k)
  return next
}

/** How many of the keys are selected. */
export const countSelected = (sel: ReadonlySet<string>, keys: readonly string[]): number => keys.reduce((a, k) => a + (sel.has(k) ? 1 : 0), 0)

/** Header checkbox state for a set of keys. */
export function checkState(sel: ReadonlySet<string>, keys: readonly string[]): 'none' | 'some' | 'all' {
  const n = countSelected(sel, keys)
  return n === 0 ? 'none' : n === keys.length ? 'all' : 'some'
}
