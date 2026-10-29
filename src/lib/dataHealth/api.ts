// Data health page: reads (admin / super-admin RLS), the acknowledge RPC, and the notices RPC for every signed-in user.
import { supabase } from '../supabase'
import type { IncidentRow } from './timeline'

export type StatusRow = {
  check_key: string; file_name: string | null; file_group: string; company: string | null
  status: 'green' | 'amber' | 'red' | 'grey'; reason: string; modified_at: string | null
  age_hours: number | null; rows_loaded: number | null; evaluated_at: string
}
export type RuleRow = { file_name: string; file_group: string; producer: string; fix_hint: string; impact: string }

export async function fetchStatuses(): Promise<StatusRow[]> {
  const { data, error } = await supabase.from('source_file_status').select('*').order('file_group').order('check_key')
  if (error) throw error
  return data as StatusRow[]
}

export async function fetchRules(): Promise<RuleRow[]> {
  const { data, error } = await supabase.from('source_files').select('file_name, file_group, producer, fix_hint, impact')
  if (error) throw error
  return data as RuleRow[]
}

export async function fetchIncidents(sinceDays: number): Promise<IncidentRow[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString()
  const { data, error } = await supabase.from('data_health_incidents')
    .select('id, check_key, opened_at, closed_at, reason, acknowledged_at, notes')
    .or(`closed_at.is.null,opened_at.gte.${since}`).order('opened_at', { ascending: false }).limit(2000)
  if (error) throw error
  return data as IncidentRow[]
}

/** What every signed-in user may know: which sources are late (no reasons, no file paths). */
export type NoticeItem = {
  check_key: string; file_group: string; company: string | null; status: 'red' | 'amber'
  modified_at: string | null; age_hours: number | null
  /** an admin has acknowledged the open incident (known and being handled) */
  acknowledged?: boolean
}
export type Notices = { last_run_at: string | null; items: NoticeItem[] }

export async function fetchNotices(): Promise<Notices> {
  const { data, error } = await supabase.rpc('data_health_notices')
  if (error) throw error
  const d = (data ?? {}) as Partial<Notices>
  return { last_run_at: d.last_run_at ?? null, items: d.items ?? [] }
}

export type SendState = { last_send_at: string | null; last_send_error: string | null; enabled: boolean; recipients: string[] }

export async function fetchSendState(): Promise<SendState | null> {
  const { data, error } = await supabase.from('data_health_settings').select('last_send_at, last_send_error, enabled, recipients').eq('id', true).maybeSingle()
  if (error) throw error
  return data as SendState | null
}

export async function acknowledgeIncident(id: number, notes: string | null): Promise<void> {
  const { error } = await supabase.rpc('data_health_ack', { p_incident_id: id, p_notes: notes })
  if (error) throw error
}
