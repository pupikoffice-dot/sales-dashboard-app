import { supabase } from './supabase'
import { OVERSIGHT_ALTERNATE_LAYOUT_IDS } from './oversightLayouts'

export async function fetchUserOversightLayoutGrants(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('dashboard_user_ui')
    .select('ui_module_id')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? [])
    .map(r => String((r as { ui_module_id: string }).ui_module_id))
    .filter(id =>
      OVERSIGHT_ALTERNATE_LAYOUT_IDS.includes(
        id as (typeof OVERSIGHT_ALTERNATE_LAYOUT_IDS)[number],
      ),
    )
}

/**
 * Replace alternate-layout grants only — does not touch suite mountable tiles
 * (best_sold_items / best_clients).
 */
export async function setUserOversightLayoutGrants(
  userId: string,
  layoutIds: string[],
): Promise<void> {
  const allow = new Set<string>(OVERSIGHT_ALTERNATE_LAYOUT_IDS)
  const next = [...new Set(layoutIds.map(String).filter(id => allow.has(id)))]

  const { error: delErr } = await supabase
    .from('dashboard_user_ui')
    .delete()
    .eq('user_id', userId)
    .in('ui_module_id', [...OVERSIGHT_ALTERNATE_LAYOUT_IDS])
  if (delErr) throw delErr

  if (next.length === 0) return
  const { error } = await supabase.from('dashboard_user_ui').insert(
    next.map(ui_module_id => ({ user_id: userId, ui_module_id })),
  )
  if (error) throw error
}
