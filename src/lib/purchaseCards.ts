/** Purchase insights (R&D): client card and item card. Data comes from the get_*_card / search_purchase_* functions. */
import { supabase } from './supabase'

export interface ClientHit {
  id: string
  name: string | null
  city: string | null
  /** the agent who owns the client now */
  agent: string | null
  cash12: number | null
  last: string | null
}

export interface ItemHit {
  sku: string
  name: string
  qty12: number | null
  cash12: number | null
  clients12: number | null
}

export interface MonthCash {
  y: number
  m: number
  cash: number
  qty: number
}

export interface ClientCardItem {
  sku: string
  name: string
  qty: number | null
  cash: number | null
  months: number
  last: string | null
}

export interface ClientCard {
  client: {
    id: string
    name: string | null
    city: string | null
    region: string | null
    agent: string | null
    active: boolean | null
    chain: string | null
    intergroup: boolean
  }
  first: string | null
  last: string | null
  docs12: number
  sold12: number
  returned12: number
  months: MonthCash[]
  years: Array<{ y: number; sold: number; returned: number; qty: number }>
  topItems: ClientCardItem[]
  topBrands: Array<{ brand: string; cash: number }>
  stopped: ClientCardItem[]
}

export interface ItemCardClient {
  id: string
  name: string
  qty: number | null
  cash: number | null
  months: number
  last: string | null
}

export interface ItemCard {
  /** true when the figures cover only the user's own clients (agent-limited user) */
  scoped: boolean
  item: { sku: string; name: string; barcode: string | null; brand: string }
  stock: number
  sold12: number
  returned12: number
  sold3: number
  clients12: number
  first: string | null
  last: string | null
  months: Array<{ y: number; m: number; sold: number; returned: number; cash: number }>
  topClients: ItemCardClient[]
  stopped: ItemCardClient[]
  moves: Array<{ date: string; kind: string; qty: number; doc: string | null }>
  stockDaily: Array<{ day: string; qty: number; est: boolean }>
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return (data ?? null) as T | null
}

/**
 * `asUser` is the user being previewed ("View as"): the database honours it only for a super admin, so the owner sees
 * exactly what that user (an agent, a sales manager) would get.
 */
export async function searchClients(company: string, query: string, asUser?: string | null): Promise<ClientHit[]> {
  return (await rpc<ClientHit[]>('search_purchase_clients', { p_company: company, p_query: query, p_as: asUser ?? null })) ?? []
}

export async function searchItems(company: string, query: string, asUser?: string | null): Promise<ItemHit[]> {
  return (await rpc<ItemHit[]>('search_purchase_items', { p_company: company, p_query: query, p_as: asUser ?? null })) ?? []
}

export function fetchClientCard(company: string, clientId: string, asUser?: string | null): Promise<ClientCard | null> {
  return rpc<ClientCard>('get_client_card', { p_company: company, p_client_id: clientId, p_as: asUser ?? null })
}

export interface CreditCheck {
  credits12: number
  /** credit lines followed within 30 days by an invoice line of the same item and quantity (cancelled and invoiced again) */
  reissued12: number
  /** credit lines reversing a whole invoice line (same item and quantity) from the 90 days before, not reissued */
  reverses12: number
  /** the rest: partial quantity, an older invoice, or a price credit */
  other12: number
  creditLines12: number
  /** credit cash left out because its reason says it is not a real return (damaged, not supplied...) */
  excluded12: number
  /** credit cash whose return reason is known (from the 855 returns report) */
  withReason12: number
  reasons: Array<{ code: string; text: string; counts: boolean; cash: number; lines: number }>
}

/** Return invoices (document 14) of the last 12 months, sorted by what the same client did with the same item (see get_client_credit_check). */
export function fetchCreditCheck(company: string, clientId: string, asUser?: string | null): Promise<CreditCheck | null> {
  return rpc<CreditCheck>('get_client_credit_check', { p_company: company, p_client_id: clientId, p_as: asUser ?? null })
}

export function fetchItemCard(company: string, sku: string, asUser?: string | null): Promise<ItemCard | null> {
  return rpc<ItemCard>('get_item_card', { p_company: company, p_sku: sku, p_as: asUser ?? null })
}

/** Credit notes as a share of what was invoiced, 0-1 (null when nothing was invoiced). */
export function returnRate(sold: number, returned: number): number | null {
  return sold > 0 ? returned / sold : null
}

/**
 * Credit-note rate without the cancel-and-reissue pairs: the reissued credits come off the credits, and the same amount
 * off the invoiced cash (the new invoice that replaced them). Null when nothing is left to divide.
 */
export function rateWithoutReissue(sold: number, credits: number, reissued: number): number | null {
  const base = sold - reissued
  return base > 0 ? Math.max(0, credits - reissued) / base : null
}

/** Whole days between an ISO date and `today` (null when the date is missing). */
export function daysSince(iso: string | null | undefined, today = new Date()): number | null {
  if (!iso) return null
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((t.getTime() - d.getTime()) / 86_400_000)
}

/** How many months the stock lasts at the pace of the last three months; null when nothing sold recently. */
export function monthsOfCover(stock: number, sold3: number): number | null {
  const perMonth = sold3 / 3
  return perMonth > 0 ? stock / perMonth : null
}

/** Month labels for a chart: the last `n` calendar months ending at (year, month), oldest first. */
export function lastMonthKeys(endYear: number, endMonth: number, n: number): Array<{ y: number; m: number }> {
  const out: Array<{ y: number; m: number }> = []
  let y = endYear
  let m = endMonth
  for (let i = 0; i < n; i++) {
    out.unshift({ y, m })
    m -= 1
    if (m === 0) {
      m = 12
      y -= 1
    }
  }
  return out
}

export const MOVE_LABEL: Record<string, string> = {
  import: 'Import (B8)',
  local_purchase: 'Local purchase (76)',
  return_in: 'Return to stock',
}
