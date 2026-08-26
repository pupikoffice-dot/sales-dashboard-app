import { useQuery } from '@tanstack/react-query'
import { fetchUserBiGrants } from '../lib/biModulesApi'

export function useBiUserGrants(userId: string | undefined | null) {
  return useQuery({
    queryKey: ['bi-user-grants', userId ?? ''],
    queryFn: () => fetchUserBiGrants(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  })
}
