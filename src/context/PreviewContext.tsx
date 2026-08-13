import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

/**
 * Super-admin "View as user" preview.
 *
 * Lets a super admin stay signed in as themselves while the whole app renders
 * as another user would see it, so per-user access changes can be verified
 * without the sign-out / sign-in round trip.
 *
 * Placement matters: this provider sits directly BENEATH AuthProvider and ABOVE
 * LocaleProvider/DashboardAccessProvider. AuthContext keeps owning the real,
 * server-computed `isSuperAdmin` and is left untouched — deriving an "effective"
 * flag there would need preview state, while preview eligibility needs the real
 * flag (a cycle). Everything below can read this context, which is what lets
 * both the locale (RTL) and the access object follow the previewed user.
 *
 * Safety: preview is a privilege REDUCTION. `effectiveIsSuperAdmin` can only be
 * true while previewing if the TARGET is themselves a super admin, and all data
 * still loads under the real session — we simply render a subset of it. The
 * target's access row is read through an RLS-protected select (see
 * DashboardAccessContext), so the "super admins only" guarantee lives in
 * Postgres, not in this UI.
 */

const STORAGE_KEY = 'dashboard-preview-user'

export interface PreviewUser {
  id: string
  name: string
  role: string
  login: string
}

interface PreviewContextValue {
  /** True while a preview is active. */
  isPreviewing: boolean
  previewUser: PreviewUser | null
  /** Role flag every UI gate should use (never exceeds the real flag). */
  effectiveIsSuperAdmin: boolean
  /** Whether this session may start a preview at all — real super admins only. */
  canPreview: boolean
  startPreview: (user: PreviewUser) => void
  stopPreview: () => void
}

const PreviewContext = createContext<PreviewContextValue | null>(null)

function readStoredPreviewId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function PreviewProvider({ children }: { children: ReactNode }) {
  const { session, isSuperAdmin } = useAuth()
  const [previewUser, setPreviewUser] = useState<PreviewUser | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(readStoredPreviewId)

  const canPreview = isSuperAdmin

  // Resolve a preview id (restored from sessionStorage after a refresh) into a
  // full user record. Only ever runs for real super admins; RLS on
  // user_profiles rejects the read for anyone else.
  useEffect(() => {
    let cancelled = false
    if (!pendingId || !canPreview || !session) return
    if (previewUser?.id === pendingId) return

    supabase
      .from('user_profiles')
      .select('id,name,role,username,email')
      .eq('id', pendingId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (!data) {
          // Unknown/unreadable user — drop the stale preview rather than
          // leaving the app in a half-previewing state.
          setPendingId(null)
          try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
          return
        }
        setPreviewUser({
          id: data.id as string,
          name: (data.name as string) || '',
          role: (data.role as string) || '',
          login: (data.username as string) || (data.email as string) || '',
        })
      })

    return () => {
      cancelled = true
    }
  }, [pendingId, canPreview, session, previewUser?.id])

  // Any loss of session or of super-admin standing ends the preview.
  useEffect(() => {
    if (!session || !canPreview) {
      setPreviewUser(null)
      setPendingId(null)
      try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    }
  }, [session, canPreview])

  const startPreview = useCallback(
    (user: PreviewUser) => {
      // Hard guard: never previewable by a non-super-admin, even if this were
      // called directly from the console.
      if (!isSuperAdmin) return
      setPreviewUser(user)
      setPendingId(user.id)
      try { sessionStorage.setItem(STORAGE_KEY, user.id) } catch { /* ignore */ }
    },
    [isSuperAdmin],
  )

  const stopPreview = useCallback(() => {
    setPreviewUser(null)
    setPendingId(null)
    try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  const value = useMemo<PreviewContextValue>(() => {
    const isPreviewing = canPreview && !!previewUser
    return {
      isPreviewing,
      previewUser: isPreviewing ? previewUser : null,
      // While previewing, only a target who is themselves a super admin keeps
      // super-admin capability. Otherwise the flag drops to false.
      effectiveIsSuperAdmin: isPreviewing
        ? previewUser!.role === 'super_admin'
        : isSuperAdmin,
      canPreview,
      startPreview,
      stopPreview,
    }
  }, [canPreview, previewUser, isSuperAdmin, startPreview, stopPreview])

  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>
}

export function usePreview() {
  const ctx = useContext(PreviewContext)
  if (!ctx) throw new Error('usePreview outside PreviewProvider')
  return ctx
}
