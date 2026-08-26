import { supabase } from './supabase'
import { mapBiModuleRow } from './biModules'
import type { AppBiConfig, AppBiModule } from '../types/biModules'

export async function fetchBiModules(): Promise<AppBiModule[]> {
  const { data, error } = await supabase
    .from('app_bi_module')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(r => mapBiModuleRow(r as Record<string, unknown>))
}

export async function fetchBiConfig(): Promise<AppBiConfig> {
  const { data, error } = await supabase.from('app_bi_config').select('*').eq('id', true).maybeSingle()
  if (error) throw error
  return {
    habitX: Number(data?.habit_x) || 3,
    habitY: Number(data?.habit_y) || 4,
    updatedAt: data?.updated_at as string | undefined,
  }
}

export async function upsertBiConfig(habitX: number, habitY: number): Promise<void> {
  const { error } = await supabase.from('app_bi_config').upsert({
    id: true,
    habit_x: habitX,
    habit_y: habitY,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function fetchUserBiGrants(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('dashboard_user_bi')
    .select('bi_module_id')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map(r => String((r as { bi_module_id: string }).bi_module_id))
}

/** Replace all BI grants for a user with the given active module ids. */
export async function setUserBiGrants(userId: string, moduleIds: string[]): Promise<void> {
  const { error: delErr } = await supabase.from('dashboard_user_bi').delete().eq('user_id', userId)
  if (delErr) throw delErr
  if (moduleIds.length === 0) return
  const { error } = await supabase.from('dashboard_user_bi').insert(
    moduleIds.map(bi_module_id => ({ user_id: userId, bi_module_id })),
  )
  if (error) throw error
}
