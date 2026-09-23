import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { usePreview } from '../context/PreviewContext'
import { fetchClassOversightLayout, fetchUserClassOversightLayout } from '../lib/oversightClassLayoutApi'

function useEffectiveUserId(): string | null {
  const { session } = useAuth()
  const { isPreviewing, previewUser } = usePreview()
  if (isPreviewing && previewUser) return previewUser.id
  return session?.user.id ?? null
}

/** Saved class look for the effective user (View-as honoured). Null = today's layout. */
export function useClassOversightLayout() {
  const userId = useEffectiveUserId()
  return useQuery({
    queryKey: ['class-oversight-layout', userId],
    queryFn: () => fetchUserClassOversightLayout(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  })
}

export function useClassOversightLayoutEditor(classId: string | null) {
  return useQuery({
    queryKey: ['class-oversight-layout-editor', classId],
    queryFn: () => fetchClassOversightLayout(classId!),
    enabled: !!classId,
    staleTime: 30_000,
  })
}
