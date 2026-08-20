import { supabase } from './supabase'
import type { AppClass, AppGrant, ExplainRow, GrantKind } from '../types/permissions'
import type { AppUiModule, UiModuleRef } from '../types/uiModules'
import {
  mapGrantKeysToUiModules,
  UI_OVERSIGHT_GRANT_PREFIX,
} from './uiModules'

function mapClass(row: any): AppClass {
  return { id: row.id, label: row.label, description: row.description, sortOrder: row.sort_order, active: row.active }
}
function mapGrant(row: any): AppGrant {
  return { id: row.id, classId: row.class_id, userId: row.user_id, kind: row.kind, key: row.key, value: row.value, effect: row.effect }
}
function mapUiModule(row: any): AppUiModule {
  return {
    id: row.id,
    label: row.label,
    surface: row.surface,
    kind: row.kind,
    active: row.active !== false,
    sortOrder: row.sort_order ?? 100,
    description: row.description ?? null,
  }
}

export async function fetchClasses(): Promise<AppClass[]> {
  const { data, error } = await supabase.from('app_class').select('*').order('sort_order')
  if (error) throw error
  return (data ?? []).map(mapClass)
}

export async function fetchClassUserCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('app_user_class').select('class_id')
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data ?? []) counts[row.class_id] = (counts[row.class_id] ?? 0) + 1
  return counts
}

export async function fetchClassGrants(classId: string): Promise<AppGrant[]> {
  const { data, error } = await supabase.from('app_grant').select('*').eq('class_id', classId)
  if (error) throw error
  return (data ?? []).map(mapGrant)
}

export async function fetchUserGrants(userId: string): Promise<AppGrant[]> {
  const { data, error } = await supabase.from('app_grant').select('*').eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map(mapGrant)
}

export async function fetchUsersInClass(classId: string): Promise<{ userId: string; name: string }[]> {
  const { data, error } = await supabase
    .from('app_user_class')
    .select('user_id, user_profiles(name)')
    .eq('class_id', classId)
  if (error) throw error
  return (data ?? []).map((r: any) => ({ userId: r.user_id, name: r.user_profiles?.name ?? r.user_id }))
}

export async function upsertClass(cls: { id: string; label: string; description: string | null }): Promise<void> {
  const { error } = await supabase.from('app_class').upsert({ id: cls.id, label: cls.label, description: cls.description })
  if (error) throw error
}

export async function deleteClass(classId: string): Promise<void> {
  const { error } = await supabase.from('app_class').delete().eq('id', classId)
  if (error) throw error
}

export async function insertGrants(
  rows: { classId?: string; userId?: string; kind: GrantKind; key: string; value: string | null; effect: 'allow' | 'deny' }[],
): Promise<void> {
  if (!rows.length) return
  const { error } = await supabase.from('app_grant').insert(
    rows.map(r => ({ class_id: r.classId ?? null, user_id: r.userId ?? null, kind: r.kind, key: r.key, value: r.value, effect: r.effect })),
  )
  if (error) throw error
}

export async function deleteGrantsByIds(ids: number[]): Promise<void> {
  if (!ids.length) return
  const { error } = await supabase.from('app_grant').delete().in('id', ids)
  if (error) throw error
}

export async function setUserClass(userId: string, classId: string | null): Promise<void> {
  const { error: delErr } = await supabase.from('app_user_class').delete().eq('user_id', userId)
  if (delErr) throw delErr
  if (classId) {
    const { error } = await supabase.from('app_user_class').insert({ user_id: userId, class_id: classId })
    if (error) throw error
  }
}

export async function listKnownAgents(): Promise<string[]> {
  const { data, error } = await supabase.rpc('list_known_agents')
  if (error) throw error
  return data ?? []
}

export async function explainAccess(userId: string, kind: GrantKind, key: string): Promise<ExplainRow[]> {
  const { data, error } = await supabase.rpc('explain_access', { p_user_id: userId, p_kind: kind, p_key: key })
  if (error) throw error
  return (data ?? []).map((r: any) => ({ source: r.source, effect: r.effect, value: r.value, winning: r.winning }))
}

/** Full UI-module catalog (`app_ui_module`), ordered by sort_order. */
export async function fetchUiModules(): Promise<AppUiModule[]> {
  const { data, error } = await supabase
    .from('app_ui_module')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map(mapUiModule)
}

/**
 * Resolve Oversight UI modules for a user from their class grants.
 * Joins `app_user_class` → class `node` grants with key `ui.oversight.%`,
 * then maps onto catalog rows. Class-only (no per-user suite override in v1).
 */
export async function fetchUserUiModules(userId: string): Promise<UiModuleRef[]> {
  const { data: membership, error: membershipError } = await supabase
    .from('app_user_class')
    .select('class_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (membershipError) throw membershipError
  if (!membership?.class_id) return []

  const { data: grants, error: grantsError } = await supabase
    .from('app_grant')
    .select('key, effect')
    .eq('class_id', membership.class_id)
    .eq('kind', 'node')
    .like('key', `${UI_OVERSIGHT_GRANT_PREFIX}%`)
  if (grantsError) throw grantsError

  const allowKeys = (grants ?? [])
    .filter((g) => g.effect === 'allow')
    .map((g) => g.key as string)

  if (!allowKeys.length) return []

  const catalog = await fetchUiModules()
  return mapGrantKeysToUiModules(allowKeys, catalog)
}

/**
 * Agent monthly cash targets keyed by ERP agent id.
 * Missing agents are simply absent from the map (callers treat as 0 / —).
 */
export async function fetchSalesAgentTargets(
  year: number,
  month: number,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('sales_agent_targets')
    .select('agent_erp_id, target_cash')
    .eq('year', year)
    .eq('month', month)
  if (error) throw error

  const out: Record<string, number> = {}
  for (const row of data ?? []) {
    const id = row.agent_erp_id as string
    if (!id) continue
    out[id] = Number(row.target_cash) || 0
  }
  return out
}
