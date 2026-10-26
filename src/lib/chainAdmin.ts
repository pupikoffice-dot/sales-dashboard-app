/** Admin -> Chains: the one place chains and their stores are maintained (super admin). */
import { supabase } from './supabase'

export interface AdminChain {
  id: string
  name: string
  /** store count per selling company */
  companies: Record<string, number>
}

export interface ChainStoreRow {
  id: string
  name: string | null
  city: string | null
  agent: string | null
  source: string
}

export interface StoreHit {
  id: string
  name: string | null
  city: string | null
  chain: string | null
}

export interface AddStoresResult {
  added?: number
  unknown?: string[]
  inOtherChain?: Array<{ id: string; chain: string }>
  error?: string
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data as T
}

export async function listChains(): Promise<AdminChain[]> {
  return (await call<AdminChain[] | null>('admin_list_chains', {})) ?? []
}

export function saveChain(id: string | null, name: string): Promise<{ id?: string; name?: string; error?: string }> {
  return call('admin_save_chain', { p_id: id, p_name: name })
}

export function deleteChain(id: string): Promise<{ ok?: boolean; error?: string }> {
  return call('admin_delete_chain', { p_id: id })
}

export async function chainStores(chainId: string, company: string): Promise<ChainStoreRow[]> {
  return (await call<ChainStoreRow[] | null>('admin_chain_stores', { p_chain_id: chainId, p_company: company })) ?? []
}

export function addChainStores(chainId: string, company: string, ids: string[], move: boolean): Promise<AddStoresResult> {
  return call('admin_add_chain_stores', { p_chain_id: chainId, p_company: company, p_ids: ids, p_move: move })
}

export function removeChainStore(company: string, clientId: string): Promise<{ ok?: boolean }> {
  return call('admin_remove_chain_store', { p_company: company, p_client_id: clientId })
}

export async function searchStores(company: string, query: string): Promise<StoreHit[]> {
  return (await call<StoreHit[] | null>('admin_search_stores', { p_company: company, p_query: query })) ?? []
}

/** Client numbers from pasted text: split on anything that is not a digit run, drop duplicates. */
export function parseClientNumbers(text: string): string[] {
  return [...new Set(text.split(/[^0-9A-Za-z]+/).map(s => s.trim()).filter(Boolean))]
}

/** One line for the result of an add: what happened and what was left out. */
export function addSummary(r: AddStoresResult): string {
  if (r.error) return r.error
  const parts = [`${r.added ?? 0} added`]
  if (r.unknown?.length) parts.push(`not found in this company: ${r.unknown.join(', ')}`)
  if (r.inOtherChain?.length) parts.push(`already in another chain (left as they are): ${r.inOtherChain.map(x => `${x.id} (${x.chain})`).join(', ')}`)
  return parts.join(' · ')
}
