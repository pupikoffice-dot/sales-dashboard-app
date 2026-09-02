import { useQuery } from '@tanstack/react-query'
import { fetchUserOversightLayoutGrants } from '../lib/oversightLayoutsApi'

export function useOversightLayoutGrants(userId: string | undefined | null) {
  return useQuery({
    queryKey: ['oversight-layout-grants', userId ?? ''],
    queryFn: () => fetchUserOversightLayoutGrants(userId!),
    enabled: !!userId,
    staleTime: 60_000,
    refetchOnMount: 'always',
  })
}
