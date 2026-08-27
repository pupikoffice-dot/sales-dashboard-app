import { supabase } from './supabase'
import type { TsometBudgetStore, TsometSalesStore } from './tsometBudget'

export async function fetchTsometStoreBudget(): Promise<TsometBudgetStore[]> {
  const { data, error } = await supabase
    .from('tsomet_store_budget')
    .select('store_number, store_name, budget_cash, erp_number, agent_number')
  if (error) throw error
  return (data ?? []).map(r => ({
    store_number: String((r as { store_number: string }).store_number ?? ''),
    store_name: String((r as { store_name: string }).store_name ?? ''),
    budget_cash: Number((r as { budget_cash: number }).budget_cash) || 0,
    erp_number: String((r as { erp_number: string }).erp_number ?? ''),
    agent_number: String((r as { agent_number: string }).agent_number ?? ''),
  }))
}

export async function fetchTsometStoreSales(): Promise<TsometSalesStore[]> {
  const { data, error } = await supabase
    .from('tsomet_store_sales')
    .select('store_number, qty, cash, report_date')
  if (error) throw error
  return (data ?? []).map(r => {
    const row = r as {
      store_number: string
      qty: number
      cash: number
      report_date: string | null
    }
    return {
      store_number: String(row.store_number ?? ''),
      qty: Number(row.qty) || 0,
      cash: Number(row.cash) || 0,
      report_date: row.report_date ? String(row.report_date) : null,
    }
  })
}
