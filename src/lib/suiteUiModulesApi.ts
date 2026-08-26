import { supabase } from './supabase'
import { SUITE_MOUNTABLE_UI_MODULE_IDS } from './suiteUiModules'

export async function fetchUserSuiteUiGrants(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('dashboard_user_ui')
    .select('ui_module_id')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? [])
    .map(r => String((r as { ui_module_id: string }).ui_module_id))
    .filter(id => SUITE_MOUNTABLE_UI_MODULE_IDS.includes(id as (typeof SUITE_MOUNTABLE_UI_MODULE_IDS)[number]))
}

/**
 * Replace allowlist UI-module grants only — does not delete unrelated future keys.
 */
export async function setUserSuiteUiGrants(userId: string, moduleIds: string[]): Promise<void> {
  const allow = new Set(SUITE_MOUNTABLE_UI_MODULE_IDS)
  const next = [...new Set(moduleIds.map(String).filter(id => allow.has(id as (typeof SUITE_MOUNTABLE_UI_MODULE_IDS)[number])))]

  const { error: delErr } = await supabase
    .from('dashboard_user_ui')
    .delete()
    .eq('user_id', userId)
    .in('ui_module_id', [...SUITE_MOUNTABLE_UI_MODULE_IDS])
  if (delErr) throw delErr

  if (next.length === 0) return
  const { error } = await supabase.from('dashboard_user_ui').insert(
    next.map(ui_module_id => ({ user_id: userId, ui_module_id })),
  )
  if (error) throw error
}
