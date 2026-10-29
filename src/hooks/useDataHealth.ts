import { useQuery } from '@tanstack/react-query'
import { fetchIncidents, fetchNotices, fetchRules, fetchSendState, fetchStatuses } from '../lib/dataHealth/api'

/** Late sources for the banner (any signed-in user); polled every 2 minutes. */
export const useDataHealthNotices = () =>
  useQuery({ queryKey: ['dataHealth', 'notices'], queryFn: fetchNotices, refetchInterval: 120_000, staleTime: 60_000, retry: false })

/** Email state, for admins only (RLS): is the alert email configured and working? */
export const useDataHealthSendState = (enabled: boolean) =>
  useQuery({ queryKey: ['dataHealth', 'send'], queryFn: fetchSendState, refetchInterval: 120_000, enabled, retry: false })

export const useDataHealthStatuses = () =>
  useQuery({ queryKey: ['dataHealth', 'status'], queryFn: fetchStatuses, refetchInterval: 60_000 })

export const useDataHealthRules = () => useQuery({ queryKey: ['dataHealth', 'rules'], queryFn: fetchRules })

export const useDataHealthIncidents = (days: number) =>
  useQuery({ queryKey: ['dataHealth', 'incidents', days], queryFn: () => fetchIncidents(days), refetchInterval: 60_000 })
