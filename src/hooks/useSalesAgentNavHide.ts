import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { usePreview } from '../context/PreviewContext'
import { useResolvedOversightMode } from './useResolvedOversightMode'
import { shouldHideNavForSalesAgentSuite } from '../lib/salesAgentNav'
import { supabase } from '../lib/supabase'

/** Whether the sidebar should be hidden for the current Sales Agent suite user. */
export function useSalesAgentNavHide(): boolean {
  const { isSuperAdmin, session } = useAuth()
  const { isPreviewing, previewUser } = usePreview()
  const oversightMode = useResolvedOversightMode()
  const { data: selfRole } = useQuery({
    queryKey: ['user-profile-role', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session!.user.id)
        .maybeSingle()
      if (error) throw error
      return (data?.role as string | undefined) ?? 'agent'
    },
    enabled: !!session?.user.id && !isPreviewing,
    staleTime: 5 * 60_000,
  })
  const effectiveRole = isPreviewing && previewUser ? previewUser.role : selfRole
  return shouldHideNavForSalesAgentSuite({
    isRealSuperAdmin: isSuperAdmin,
    role: effectiveRole,
    oversightMode,
  })
}
