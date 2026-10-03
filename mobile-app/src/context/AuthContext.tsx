import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { supabase } from '../lib/supabase'
import { getDeviceFingerprint, getDeviceMeta } from '../lib/deviceInfo'

type UserRole = 'super_admin' | 'admin' | 'manager' | 'agent'

interface Profile {
  id: string
  name: string
  role: UserRole
}

interface AuthContextValue {
  session: Session | null
  loading: boolean
  profile: Profile | null
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ])
}

async function registerDevice(userId: string) {
  try {
    const fingerprint = await withTimeout(getDeviceFingerprint(), 5000)
    const meta = getDeviceMeta()
    await withTimeout(
      supabase.from('agent_devices').upsert(
        { agent_id: userId, device_fingerprint: fingerprint, ...meta, last_seen_at: new Date().toISOString() },
        { onConflict: 'agent_id,device_fingerprint' }
      ),
      5000
    )
  } catch {
  }
}

async function updateLastSeen(userId: string) {
  try {
    const fingerprint = await withTimeout(getDeviceFingerprint(), 5000)
    await withTimeout(
      supabase.from('agent_devices').update({ last_seen_at: new Date().toISOString() })
        .eq('agent_id', userId).eq('device_fingerprint', fingerprint),
      5000
    )
  } catch {
  }
}

/**
 * Clear stale Supabase auth tokens from AsyncStorage when the app version changes.
 * This prevents the GoTrueClient from getting stuck trying to refresh an expired
 * token from a previous version, which blocks signInWithPassword().
 */
async function clearStaleSessionIfUpgraded(): Promise<void> {
  try {
    const currentVersion = Constants.expoConfig?.version ?? '0.0.0'
    const lastVersion = await AsyncStorage.getItem('app_version')
    if (lastVersion !== null && lastVersion !== currentVersion) {
      // App was upgraded — nuke old auth tokens directly from storage
      // (don't go through GoTrueClient which may already be stuck refreshing)
      const keys = await AsyncStorage.getAllKeys()
      const authKeys = keys.filter(k => k.startsWith('sb-'))
      if (authKeys.length > 0) {
        await AsyncStorage.multiRemove(authKeys)
      }
    }
    await AsyncStorage.setItem('app_version', currentVersion)
  } catch {
    // Non-critical — proceed with normal auth flow
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, name, role')
      .eq('id', userId)
      .maybeSingle()
    if (error || !data) {
      setProfile(null)
      return false
    }
    setProfile(data as Profile)
    return true
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      // Took too long — clear any stale session and show login
      supabase.auth.signOut().catch(() => {})
      setSession(null)
      setProfile(null)
      setLoading(false)
    }, 20000)

    // Clear stale tokens from previous app version before touching auth
    clearStaleSessionIfUpgraded().then(() =>
    withTimeout(supabase.auth.getSession(), 15000)).then(async ({ data }) => {
      if (data.session) {
        const ok = await withTimeout(loadProfile(data.session.user.id), 10000).catch(() => false)
        if (!ok) {
          await supabase.auth.signOut().catch(() => {})
          setSession(null)
          setProfile(null)
        } else {
          setSession(data.session)
          updateLastSeen(data.session.user.id) // fire and forget
        }
      } else {
        setSession(null)
      }
    }).catch(() => {
      // Token expired, revoked, or network error — force fresh login
      supabase.auth.signOut().catch(() => {})
      setSession(null)
      setProfile(null)
    }).finally(() => {
      clearTimeout(timeout)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (_event === 'TOKEN_REFRESHED' || _event === 'SIGNED_IN') {
        if (session) {
          const ok = await withTimeout(loadProfile(session.user.id), 5000).catch(() => false)
          if (!ok) {
            await supabase.auth.signOut().catch(() => {})
            setSession(null)
            setProfile(null)
            return
          }
          setSession(session)
        }
      } else if (_event === 'SIGNED_OUT' || _event === 'TOKEN_REFRESH_FAILED' as any) {
        setSession(null)
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    try {
      // Clear any stale auth tokens before signing in
      try {
        const keys = await AsyncStorage.getAllKeys()
        const authKeys = keys.filter(k => k.startsWith('sb-'))
        if (authKeys.length > 0) await AsyncStorage.multiRemove(authKeys)
      } catch {}

      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        45000
      )
      if (error) return { error: new Error(error.message) }
      if (data.user) {
        registerDevice(data.user.id) // fire and forget — don't block login
        const ok = await withTimeout(loadProfile(data.user.id), 10000).catch(() => false)
        if (!ok) {
          await supabase.auth.signOut().catch(() => {})
          setProfile(null)
          return { error: new Error('No profile found. Ask an admin to create your user.') }
        }
      }
      return { error: null }
    } catch (e) {
      return { error: new Error('Login failed — check internet and try again. (' + String(e) + ')') }
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ session, loading, profile, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
