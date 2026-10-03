export type UserRole = 'super_admin' | 'admin' | 'manager' | 'agent'

/** Minimal agent row for dropdowns (assign client, etc.). */
export interface AgentSummary {
  id: string
  name: string
  email: string
  /** ERP agent code; matches clients.erp_agent_id / sales_lines.agent_erp_id when set. */
  agent_erp_id?: string | null
}

export interface UserProfile {
  id: string
  email: string
  name: string
  username?: string | null
  role: UserRole
  parent_id: string | null
  active: boolean
  created_at: string
  /** ERP companies this user may see (RLS). Omitted on older rows until migration runs. */
  allowed_companies?: string[] | null
  /** Last password set via admin create/update (not readable from Supabase Auth). */
  password_display?: string | null
  /** ERP agent code as on Excel exports; matches sales_lines.agent_erp_id for 720 open-delivery visibility. */
  agent_erp_id?: string | null
}

export interface Client {
  id: string
  erp_client_id: string
  name: string
  company: string
  assigned_agent_id: string | null
  /** Agent code from ERP client export; sync maps to assigned_agent_id via profile.agent_erp_id. */
  erp_agent_id?: string | null
  phone: string | null
  email: string | null
  region: string | null
  active: boolean
  updated_at: string
}

export interface SyncLog {
  id: string
  started_at: string
  finished_at: string | null
  status: 'running' | 'success' | 'failed'
  rows_updated: number | null
  error_message: string | null
  triggered_by: 'cron' | 'admin' | 'agent'
}

export interface AgentDevice {
  id: string
  agent_id: string
  device_fingerprint: string
  device_model: string | null
  android_version: string | null
  app_version: string | null
  registered_at: string
  last_seen_at: string
  revoked: boolean
  revoked_at: string | null
  agent?: UserProfile
}

export interface AppSetting {
  key: string
  value: string
}

export interface QueryUsage {
  agent_id: string
  agent_name: string
  query_count: number
  provider: string
}
