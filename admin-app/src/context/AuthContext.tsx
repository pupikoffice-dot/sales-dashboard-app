import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UserRole } from '../lib/types'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  role: UserRole | null
  roleLoading: boolean
  signIn: (email: string, password: string) => ReturnType<typeof supabase.auth.signInWithPassword>
  signOut: () => ReturnType<typeof supabase.auth.signOut>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ROLE_FETCH_MS = 10_000

async function fetchRoleWithTimeout(): Promise<UserRole | null> {
  const rpc = supabase.rpc('get_my_role').then(({ data, error }) => {
    if (error) {
      console.warn('[Auth] get_my_role:', error.message, error.code)
      return null
    }
    return (data as UserRole) ?? null
  })
  const timeout = new Promise<null>(resolve => {
    setTimeout(() => resolve(null), ROLE_FETCH_MS)
  })
  try {
    return await Promise.race([rpc, timeout])
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]       = useState<Session | null>(null)
  const [loading, setLoading]       = useState(true)
  const [role, setRole]             = useState<UserRole | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function applySession(next: Session | null) {
      if (!mounted) return
      setSession(next)
      if (next) {
        setRoleLoading(true)
        try {
          const r = await fetchRoleWithTimeout()
          if (mounted) setRole(r)
        } finally {
          if (mounted) setRoleLoading(false)
        }
      } else {
        setRole(null)
        setRoleLoading(false)
      }
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        return applySession(data.session)
      })
      .catch(() => {
        if (!mounted) return
        setSession(null)
        setRole(null)
        setRoleLoading(false)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'TOKEN_REFRESHED' && nextSession) {
        setSession(nextSession)
        return
      }
      void applySession(nextSession)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{
      session, loading, role, roleLoading,
      signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
      signOut: () => supabase.auth.signOut(),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
