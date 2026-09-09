import { useQuery } from '@tanstack/react-query'
import { fetchIntercompanyIdentities } from '../lib/intercompanyApi'

/**
 * Linked cross-company accounts for the signed-in user. Returns an empty list
 * for the overwhelming majority of users, who hold a single identity.
 */
export function useIntercompanyIdentities(userId: string | undefined | null) {
  return useQuery({
    queryKey: ['intercompany-identities', userId ?? ''],
    queryFn: fetchIntercompanyIdentities,
    enabled: !!userId,
    staleTime: 60_000,
    refetchOnMount: 'always',
  })
}
