import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { usePreview } from '../context/PreviewContext'
import { supabase } from '../lib/supabase'

export interface EffectiveUserProfile {
  name: string
  role: string | undefined
}

/** Signed-in user profile; while previewing, returns the View-as target. */
export function useUserProfile(): EffectiveUserProfile {
  const { session } = useAuth()
  const { isPreviewing, previewUser } = usePreview()
  const { data } = useQuery({
    queryKey: ['user-profile', session?.user.id],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from('user_profiles')
        .select('name, role, username')
        .eq('id', session!.user.id)
        .maybeSingle()
      if (error) throw error
      return row
    },
    enabled: !!session?.user.id && !isPreviewing,
    staleTime: 5 * 60_000,
  })

  if (isPreviewing && previewUser) {
    return {
      name: previewUser.name.trim() || previewUser.login,
      role: previewUser.role,
    }
  }

  const name =
    (data?.name as string | undefined)?.trim() ||
    (data?.username as string | undefined)?.trim() ||
    session?.user.email?.split('@')[0] ||
    ''

  return {
    name,
    role: (data?.role as string | undefined) ?? undefined,
  }
}
