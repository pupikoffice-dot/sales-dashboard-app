import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  isSuperAdmin: boolean
  signIn: (login: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  // Which user the super-admin check has finished for. Until it matches the signed-in user,
  // `loading` stays true: otherwise admin routes are not registered yet on a direct link
  // (e.g. /admin/data-health from an email) and the catch-all redirects to the home page.
  const [adminCheckedFor, setAdminCheckedFor] = useState<string | null>(null)
  const lastUserId = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      lastUserId.current = data.session?.user.id ?? null
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      // Any change of user (sign-out, sign-in as someone else, token swap in
      // the same tab) must drop cached dashboard data — it was fetched under
      // the previous user's access grant and must never be shown to the next.
      const newUserId = s?.user.id ?? null
      if (newUserId !== lastUserId.current) {
        queryClient.clear()
        lastUserId.current = newUserId
      }
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null
  useEffect(() => {
    if (!userId) {
      setIsSuperAdmin(false)
      return
    }
    // Re-checked only when the user changes, not on every token refresh.
    let cancelled = false
    const done = (admin: boolean) => {
      if (cancelled) return
      setIsSuperAdmin(admin)
      setAdminCheckedFor(userId)
    }
    supabase.rpc('is_super_admin').then(({ data }) => done(!!data), () => done(false))
    return () => { cancelled = true }
  }, [userId])

  const adminPending = userId !== null && adminCheckedFor !== userId

  async function signIn(login: string, password: string) {
    let email = login.trim()
    if (!email.includes('@')) {
      const { data, error } = await supabase.rpc('resolve_dashboard_login', { p_login: email })
      if (error || !data) return { error: 'Invalid login or password' }
      email = data as string
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading: loading || adminPending, isSuperAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
