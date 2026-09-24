import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { usePreview } from '../context/PreviewContext'
import { fetchUserClassOversightLayout } from '../lib/oversightClassLayoutApi'

function useEffectiveUserId(): string | null {
  const { session } = useAuth()
  const { isPreviewing, previewUser } = usePreview()
  if (isPreviewing && previewUser) return previewUser.id
  return session?.user.id ?? null
}

/**
 * Class look for the effective user (View-as honoured).
 * Null = no class. Use hasSavedRow to tell seed vs stored.
 */
export function useClassOversightLayout() {
  const userId = useEffectiveUserId()
  return useQuery({
    queryKey: ['class-oversight-layout', userId],
    queryFn: () => fetchUserClassOversightLayout(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  })
}
