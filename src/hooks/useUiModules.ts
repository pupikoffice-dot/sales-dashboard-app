import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { usePreview } from '../context/PreviewContext'
import { fetchUiModules, fetchUserUiModules } from '../lib/permissionsApi'

/** Effective user id for View-as: preview target, else signed-in user. */
function useEffectiveUserId(): string | null {
  const { session } = useAuth()
  const { isPreviewing, previewUser } = usePreview()
  if (isPreviewing && previewUser) return previewUser.id
  return session?.user.id ?? null
}

/** Full UI-module catalog (filter `active` at call site if needed). */
export function useUiModuleCatalog() {
  return useQuery({
    queryKey: ['ui-modules-catalog'],
    queryFn: fetchUiModules,
    staleTime: 5 * 60_000,
  })
}

/**
 * UI modules granted to the effective user via their class.
 * Honour View-as: while previewing, loads the target user's class grants.
 */
export function useUiModules() {
  const userId = useEffectiveUserId()

  return useQuery({
    queryKey: ['user-ui-modules', userId],
    queryFn: () => fetchUserUiModules(userId!),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  })
}
