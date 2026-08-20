import { useQuery } from '@tanstack/react-query'
import { fetchSalesAgentTargets } from '../lib/permissionsApi'

/**
 * Monthly agent cash targets from `sales_agent_targets`, keyed by ERP agent id.
 * Shared table — not user-scoped; suite UI scopes by class agent set.
 */
export function useSalesAgentTargets(year: number, month: number) {
  const valid = Number.isInteger(year) && month >= 1 && month <= 12

  return useQuery({
    queryKey: ['sales-agent-targets', year, month],
    queryFn: () => fetchSalesAgentTargets(year, month),
    enabled: valid,
    staleTime: 5 * 60_000,
  })
}
