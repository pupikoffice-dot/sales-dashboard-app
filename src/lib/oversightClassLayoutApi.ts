import {
  parseClassLayout,
  suiteKindFromGrantKeys,
  type ClassOversightLayout,
  type SuiteKind,
} from './oversightClassLayout'
import { supabase } from './supabase'
import { UI_OVERSIGHT_GRANT_PREFIX } from './uiModules'

export interface ClassOversightLayoutRow {
  classId: string
  layout: ClassOversightLayout
  suiteKind: SuiteKind
}

async function suiteKindForClass(classId: string): Promise<SuiteKind> {
  const { data, error } = await supabase
    .from('app_grant')
    .select('key')
    .eq('class_id', classId)
    .eq('kind', 'node')
    .like('key', `${UI_OVERSIGHT_GRANT_PREFIX}%`)
  if (error) throw error
  return suiteKindFromGrantKeys((data ?? []).map(r => String((r as { key: string }).key)))
}

export async function fetchClassOversightLayout(classId: string): Promise<ClassOversightLayoutRow | null> {
  const { data, error } = await supabase
    .from('class_oversight_layout')
    .select('class_id, layout')
    .eq('class_id', classId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const suiteKind = await suiteKindForClass(classId)
  return {
    classId,
    suiteKind,
    layout: parseClassLayout((data as { layout: unknown }).layout, suiteKind),
  }
}

/** Layout for the user's class, or null when they have no class / no saved look. */
export async function fetchUserClassOversightLayout(userId: string): Promise<ClassOversightLayoutRow | null> {
  const { data: membership, error: membershipError } = await supabase
    .from('app_user_class')
    .select('class_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (membershipError) throw membershipError
  if (!membership?.class_id) return null
  return fetchClassOversightLayout(membership.class_id as string)
}

export async function upsertClassOversightLayout(
  classId: string,
  layout: ClassOversightLayout,
): Promise<void> {
  const { error } = await supabase.from('class_oversight_layout').upsert({
    class_id: classId,
    layout,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
