import { useQuery } from '@tanstack/react-query'
import { fetchUserSuiteUiGrants } from '../lib/suiteUiModulesApi'

export function useSuiteUiUserGrants(userId: string | undefined | null) {
  return useQuery({
    queryKey: ['suite-ui-user-grants', userId ?? ''],
    queryFn: () => fetchUserSuiteUiGrants(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  })
}
