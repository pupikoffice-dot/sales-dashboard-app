/**
 * Gross margin companion RPCs. Each returns null when the user may not see item costs (decided in the database),
 * and also null when the call fails: the report then simply shows no margin, it never breaks.
 */
import { supabase } from './supabase'
import type { CostCover } from './grossMargin'

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  try {
    const { data, error } = await supabase.rpc(fn, args)
    if (error) return null
    return (data ?? null) as T | null
  } catch {
    return null
  }
}

export interface YearlyMargin {
  years: Array<CostCover & { year: number }>
  brands: Array<CostCover & { year: number; brand: string }>
}
export const fetchYearlyMargin = (company: string, asUser?: string | null) =>
  call<YearlyMargin>('get_yearly_margin', { p_company: company, p_as: asUser ?? null })

export interface YearlyDetailMargin {
  year: number
  months: Array<CostCover & { month: number }>
  brands: Array<CostCover & { month: number; brand: string }>
}
export const fetchYearlyDetailMargin = (company: string, year: number, asUser?: string | null) =>
  call<YearlyDetailMargin>('get_yearly_detail_margin', { p_company: company, p_year: year, p_as: asUser ?? null })

export interface MonthlyMargin {
  months: Array<CostCover & { year: number; month: number; net: number | null }>
}
export const fetchMonthlyMargin = (company: string, asUser?: string | null) =>
  call<MonthlyMargin>('get_monthly_margin', { p_company: company, p_as: asUser ?? null })

export interface ClientCardMargin {
  cost12: number | null
  covered12: number | null
  months: Array<CostCover & { y: number; m: number }>
  years: Array<CostCover & { y: number }>
  topItems: Array<CostCover & { sku: string }>
  topBrands: Array<CostCover & { brand: string }>
  stopped: Array<CostCover & { sku: string }>
}
export const fetchClientCardMargin = (company: string, clientId: string, asUser?: string | null) =>
  call<ClientCardMargin>('get_client_card_margin', { p_company: company, p_client_id: clientId, p_as: asUser ?? null })

export interface ItemCardMargin {
  cost12: number | null
  covered12: number | null
  unitCosts: Array<{ year: number; unitCost: number; basis: 'import' | 'current' }>
  months: Array<CostCover & { y: number; m: number }>
  topClients: Array<CostCover & { id: string }>
  stopped: Array<CostCover & { id: string }>
}
export const fetchItemCardMargin = (company: string, sku: string, asUser?: string | null) =>
  call<ItemCardMargin>('get_item_card_margin', { p_company: company, p_sku: sku, p_as: asUser ?? null })
