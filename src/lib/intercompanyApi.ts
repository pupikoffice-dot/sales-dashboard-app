import { supabase } from './supabase'
import type { LogicalCompany } from '../types/dashboard'

/**
 * One of the dashboard accounts belonging to the signed-in person. Someone who
 * holds two ERP agent identities in two companies (e.g. agent 25 in Pupik and
 * agent 57 in Monkeytime) has one of these per account, and switches between
 * them rather than seeing both at once — see the intercompany_user_link
 * migration for why merging the two scopes would over-share.
 */
export interface IntercompanyIdentity {
  userId: string
  name: string
  username: string | null
  agentErpId: string | null
  companies: LogicalCompany[]
  /** The account actually signed in, as opposed to a linked one. */
  isSelf: boolean
  isActive: boolean
}

interface IdentityRow {
  user_id: string
  name: string | null
  username: string | null
  agent_erp_id: string | null
  companies: string[] | null
  is_self: boolean
  is_active: boolean
}

/**
 * Identities the signed-in user may switch between, own account included.
 * Empty when they have no links, which is how the UI decides to show nothing.
 */
export async function fetchIntercompanyIdentities(): Promise<IntercompanyIdentity[]> {
  const { data, error } = await supabase.rpc('get_intercompany_identities')
  if (error) throw error
  return ((data ?? []) as IdentityRow[]).map(r => ({
    userId: String(r.user_id),
    name: r.name ?? '',
    username: r.username,
    agentErpId: r.agent_erp_id,
    companies: (r.companies ?? []).map(c => String(c).toLowerCase() as LogicalCompany),
    isSelf: r.is_self === true,
    isActive: r.is_active === true,
  }))
}

/**
 * Switch the signed-in user to a linked identity; null returns them to their
 * own account. The server validates the link, so a caller cannot switch to an
 * account they were not linked to.
 */
export async function setActiveIntercompanyIdentity(userId: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_active_intercompany_identity', { p_user_id: userId })
  if (error) throw error
}

/** Accounts linked to this user. Super admin only (RLS enforces it). */
export async function fetchUserLinks(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('dashboard_user_link')
    .select('linked_user_id')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map(r => String((r as { linked_user_id: string }).linked_user_id))
}

/**
 * Replace a user's links. Pairs are written in both directions so either login
 * can switch to the other, and severed pairs also drop any active switch that
 * pointed at them.
 */
export async function setUserLinks(userId: string, linkedIds: string[]): Promise<void> {
  const next = [...new Set(linkedIds.filter(id => id && id !== userId))]
  const prev = await fetchUserLinks(userId)
  const removed = prev.filter(id => !next.includes(id))
  const added = next.filter(id => !prev.includes(id))

  if (removed.length) {
    const { error: fwdErr } = await supabase
      .from('dashboard_user_link')
      .delete()
      .eq('user_id', userId)
      .in('linked_user_id', removed)
    if (fwdErr) throw fwdErr

    const { error: revErr } = await supabase
      .from('dashboard_user_link')
      .delete()
      .eq('linked_user_id', userId)
      .in('user_id', removed)
    if (revErr) throw revErr

    // Leaving these behind is harmless (get_dashboard_access re-checks the
    // link) but it would strand the user on a scope they can no longer reach.
    const { error: actFwdErr } = await supabase
      .from('dashboard_user_link_active')
      .delete()
      .eq('user_id', userId)
      .in('active_as_user_id', removed)
    if (actFwdErr) throw actFwdErr

    const { error: actRevErr } = await supabase
      .from('dashboard_user_link_active')
      .delete()
      .in('user_id', removed)
      .eq('active_as_user_id', userId)
    if (actRevErr) throw actRevErr
  }

  if (added.length) {
    const rows = added.flatMap(other => [
      { user_id: userId, linked_user_id: other },
      { user_id: other, linked_user_id: userId },
    ])
    const { error } = await supabase
      .from('dashboard_user_link')
      .upsert(rows, { onConflict: 'user_id,linked_user_id', ignoreDuplicates: true })
    if (error) throw error
  }
}
