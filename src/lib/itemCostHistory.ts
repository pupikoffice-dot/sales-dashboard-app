import { supabase } from './supabase'

export interface ItemCostHistory {
  /** Cost in the item index (the latest supplier-invoice cost); null = none on file. */
  cost: number | null
  /** Past import costs of the same company, newest first. */
  history: Array<{ date: string; cost: number; qty: number; doc: string | null }>
}

/** Item index cost plus past import costs; null when the user may not see costs or the call fails (the page then shows nothing). */
export async function fetchItemCostHistory(company: string, sku: string): Promise<ItemCostHistory | null> {
  try {
    const { data, error } = await supabase.rpc('get_item_cost_history', { p_company: company, p_sku: sku })
    if (error || !data) return null
    return data as ItemCostHistory
  } catch {
    return null
  }
}
