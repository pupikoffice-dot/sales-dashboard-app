import { useQuery } from '@tanstack/react-query'
import { useLocale } from '../../context/LocaleContext'
import { usePreview } from '../../context/PreviewContext'
import { displayLoginId } from '../../lib/loginIdentifier'
import { supabase } from '../../lib/supabase'

interface ProfileRow {
  id: string
  email: string
  username: string | null
  name: string
  role: string
  active: boolean
}

/**
 * Super-admin "View as…" picker. Rendered in the header only for real super
 * admins (`canPreview`); selecting a user re-renders the whole app as they
 * would see it, without signing out.
 *
 * Shares the ['admin-users'] query key with the admin Users page so saving
 * access changes there also refreshes this list.
 */
export function ViewAsSwitcher() {
  const { canPreview, isPreviewing, previewUser, startPreview, stopPreview } = usePreview()
  const { t } = useLocale()

  const { data: users } = useQuery({
    queryKey: ['admin-users-picker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id,email,username,name,role,active')
        .order('name')
      if (error) throw error
      return (data ?? []) as ProfileRow[]
    },
    enabled: canPreview,
    staleTime: 60_000,
  })

  if (!canPreview) return null

  return (
    <select
      className="view-as-select"
      value={isPreviewing ? previewUser?.id ?? '' : ''}
      title={t('preview.viewAs')}
      aria-label={t('preview.viewAs')}
      onChange={e => {
        const id = e.target.value
        if (!id) {
          stopPreview()
          return
        }
        const u = (users ?? []).find(x => x.id === id)
        if (!u) return
        startPreview({
          id: u.id,
          name: u.name || displayLoginId(u),
          role: u.role,
          login: displayLoginId(u),
        })
      }}
    >
      <option value="">👁 {t('preview.viewAs')}</option>
      {(users ?? []).map(u => (
        <option key={u.id} value={u.id}>
          {u.name || displayLoginId(u)}
          {u.role === 'super_admin' ? ' ★' : ''}
          {u.active === false ? ` (${t('preview.inactive')})` : ''}
        </option>
      ))}
    </select>
  )
}
