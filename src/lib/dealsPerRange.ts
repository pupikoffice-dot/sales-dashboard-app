import { supabase } from './supabase'

/** Invoice-total ranges, in the order shown (the database buckets are 1..8 in the same order). */
export const DEAL_RANGES: Array<{ bucket: number; label: string }> = [
  { bucket: 1, label: '0 - 500' },
  { bucket: 2, label: '501 - 1,000' },
  { bucket: 3, label: '1,001 - 2,000' },
  { bucket: 4, label: '2,001 - 3,000' },
  { bucket: 5, label: '3,001 - 5,000' },
  { bucket: 6, label: '5,001 - 8,000' },
  { bucket: 7, label: '8,001 - 12,000' },
  { bucket: 8, label: '12,001 +' },
]

export interface DealsPerRange {
  asOf: string
  /** the 12 full months before the current one, newest first, as YYYY-MM */
  months: string[]
  /** keys: month | quarter | d90 | d365, the same four one year earlier with a `_py` suffix, and m:YYYY-MM */
  counts: Array<{ bucket: number; key: string; n: number }>
  /** invoices per range and month (YYYY-MM), from 1 January of last year to today */
  trend: Array<{ bucket: number; ym: string; n: number }>
}

export interface DealRow {
  date: string
  docType: string
  docNum: string
  clientID: string | null
  clientName: string | null
  total: number
  lines: number
}
export interface DealsDetail {
  total: number
  rows: DealRow[]
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return (data ?? null) as T | null
}

/** null = no access to the Sales specifics page. */
export const fetchDealsPerRange = (company: string, asUser?: string | null) =>
  rpc<DealsPerRange>('get_deals_per_range', { p_company: company, p_as: asUser ?? null })

/** The invoices counted in one cell (bucket 1..8, period key: month | quarter | d90 | d365 | m:YYYY-MM). */
export const fetchDealsDetail = (company: string, bucket: number, period: string, asUser?: string | null) =>
  rpc<DealsDetail>('get_deals_detail', { p_company: company, p_bucket: bucket, p_period: period, p_as: asUser ?? null })

/** "2026-10" -> "10/26" */
export const monthLabel = (ym: string): string => `${ym.slice(5, 7)}/${ym.slice(2, 4)}`
