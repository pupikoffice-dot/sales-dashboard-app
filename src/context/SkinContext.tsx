import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { useDashboardAccess } from './DashboardAccessContext'
import { supabase } from '../lib/supabase'
import {
  allowedSkins,
  applySkin,
  effectiveSkin,
  isAppSkin,
  readStoredSkin,
  SKIN_STORAGE_KEY,
  type AppSkin,
} from '../lib/skin'

interface SkinContextValue {
  /** The skin actually shown (saved choice, unless an admin has since hidden it). */
  skin: AppSkin
  /** Skins this user may pick. */
  available: AppSkin[]
  setSkin: (skin: AppSkin) => void
}

const SkinContext = createContext<SkinContextValue | null>(null)

/**
 * Per-user look. The choice is kept in localStorage (instant, works signed out) and in
 * dashboard_user_prefs so it follows the user to other browsers. It is the signed-in user's own
 * choice: previewing another user ("View as") does not change it.
 */
export function SkinProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const { access } = useDashboardAccess()
  const userId = session?.user.id
  const [saved, setSaved] = useState<AppSkin>(readStoredSkin)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('dashboard_user_prefs')
      .select('skin')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data || !isAppSkin(data.skin)) return
        setSaved(data.skin)
        try {
          localStorage.setItem(SKIN_STORAGE_KEY, data.skin)
        } catch {
          /* ignore */
        }
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const hidden = access?.hiddenSidebar
  const skin = effectiveSkin(saved, hidden)
  const available = useMemo(() => allowedSkins(hidden), [hidden])

  useEffect(() => {
    applySkin(skin)
  }, [skin])

  const setSkin = useCallback(
    (next: AppSkin) => {
      setSaved(next)
      try {
        localStorage.setItem(SKIN_STORAGE_KEY, next)
      } catch {
        /* ignore */
      }
      if (!userId) return
      supabase
        .from('dashboard_user_prefs')
        .upsert({ user_id: userId, skin: next, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.warn('Could not save skin:', error.message)
        })
    },
    [userId],
  )

  const value = useMemo<SkinContextValue>(() => ({ skin, available, setSkin }), [skin, available, setSkin])
  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>
}

export function useSkin() {
  const ctx = useContext(SkinContext)
  if (!ctx) throw new Error('useSkin outside SkinProvider')
  return ctx
}
