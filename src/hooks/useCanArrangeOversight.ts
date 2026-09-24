import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { usePreview } from '../context/PreviewContext'
import { supabase } from '../lib/supabase'

/** Signed-in profile role — never the View-as target. */
export function useSignedInProfileRole() {
  const { session, isSuperAdmin } = useAuth()
  const q = useQuery({
    queryKey: ['signed-in-profile-role', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session!.user.id)
        .maybeSingle()
      if (error) throw error
      return (data?.role as string | undefined) ?? null
    },
    enabled: !!session?.user.id,
    staleTime: 5 * 60_000,
  })

  const role = q.data ?? null
  const canArrange = isSuperAdmin || role === 'admin'
  return { canArrange, isSuperAdmin, role, isLoading: q.isPending && !!session?.user.id }
}

/**
 * Class the Arrange mode will write.
 * Super admin: View-as target's class (or null if not previewing).
 * Admin: own class.
 */
export function useArrangeTargetClassId() {
  const { session, isSuperAdmin } = useAuth()
  const { isPreviewing, previewUser } = usePreview()
  const targetUserId =
    isSuperAdmin && isPreviewing && previewUser
      ? previewUser.id
      : !isSuperAdmin
        ? (session?.user.id ?? null)
        : null

  return useQuery({
    queryKey: ['arrange-target-class', targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_user_class')
        .select('class_id')
        .eq('user_id', targetUserId!)
        .maybeSingle()
      if (error) throw error
      return (data?.class_id as string | undefined) ?? null
    },
    enabled: !!targetUserId,
    staleTime: 60_000,
  })
}
