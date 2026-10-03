import { useQuery } from '@tanstack/react-query'
import { fetchIncidents, fetchRules, fetchStatuses } from '../lib/dataHealth/api'

export const useDataHealthStatuses = () =>
  useQuery({ queryKey: ['dataHealth', 'status'], queryFn: fetchStatuses, refetchInterval: 60_000 })

export const useDataHealthRules = () => useQuery({ queryKey: ['dataHealth', 'rules'], queryFn: fetchRules })

export const useDataHealthIncidents = (days: number) =>
  useQuery({ queryKey: ['dataHealth', 'incidents', days], queryFn: () => fetchIncidents(days), refetchInterval: 60_000 })
