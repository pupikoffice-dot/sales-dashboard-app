// R&D > Expenses: reads and writes go through super-admin-only database functions (the tables have no policies).
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { ExpenseData } from './calc'

export async function fetchExpenseData(): Promise<ExpenseData | null> {
  const { data, error } = await supabase.rpc('get_expense_data')
  if (error) throw error
  return (data as ExpenseData | null) ?? null // null: not a super admin
}

export async function setExpenseCardCategory(company: string, card: string, category: string): Promise<void> {
  const { error } = await supabase.rpc('set_expense_card_category', { p_company: company, p_card: card, p_category: category })
  if (error) throw error
}

/** Add (code = null) or rename a category. */
export async function saveExpenseCategory(code: string | null, label: string): Promise<void> {
  const { error } = await supabase.rpc('save_expense_category', { p_code: code, p_label: label })
  if (error) throw error
}

export async function moveExpenseCategory(code: string, dir: -1 | 1): Promise<void> {
  const { error } = await supabase.rpc('move_expense_category', { p_code: code, p_dir: dir })
  if (error) throw error
}

export async function deleteExpenseCategory(code: string): Promise<void> {
  const { error } = await supabase.rpc('delete_expense_category', { p_code: code })
  if (error) throw error
}

export async function setExpenseCardCategory2(company: string, card: string, category2: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_expense_card_category2', { p_company: company, p_card: card, p_category2: category2 })
  if (error) throw error
}

/** Category 2: add (code = null) or rename. */
export async function saveExpenseCategory2(code: string | null, label: string): Promise<void> {
  const { error } = await supabase.rpc('save_expense_category2', { p_code: code, p_label: label })
  if (error) throw error
}

export async function moveExpenseCategory2(code: string, dir: -1 | 1): Promise<void> {
  const { error } = await supabase.rpc('move_expense_category2', { p_code: code, p_dir: dir })
  if (error) throw error
}

export async function deleteExpenseCategory2(code: string): Promise<void> {
  const { error } = await supabase.rpc('delete_expense_category2', { p_code: code })
  if (error) throw error
}

export const useExpenseData = () =>
  useQuery({ queryKey: ['expenses', 'data'], queryFn: fetchExpenseData, staleTime: 5 * 60_000, retry: false })
