import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createTranslator, isAppLocale, localeDir, monthNamesForLocale } from '../i18n'
import type { AppLocale } from '../i18n/types'
import type { MessageKey } from '../i18n/types'
import { fetchProfileLocale } from '../lib/userLocale'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'dashboard-locale'

interface LocaleContextValue {
  locale: AppLocale
  dir: 'ltr' | 'rtl'
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  monthNames: string[]
  setLocale: (locale: AppLocale) => Promise<void>
  loading: boolean
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function readStoredLocale(): AppLocale {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && isAppLocale(v)) return v
  } catch { /* ignore */ }
  return 'en'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [locale, setLocaleState] = useState<AppLocale>(readStoredLocale)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!session?.user.id) {
        setLoading(false)
        return
      }
      setLoading(true)
      const profileLocale = await fetchProfileLocale(session.user.id)

      if (cancelled) return

      if (profileLocale) {
        setLocaleState(profileLocale)
        try {
          localStorage.setItem(STORAGE_KEY, profileLocale)
        } catch { /* ignore */ }
      } else {
        setLocaleState(readStoredLocale())
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [session?.user.id])

  useEffect(() => {
    const dir = localeDir(locale)
    document.documentElement.lang = locale
    document.documentElement.dir = dir
    document.body.dir = dir
  }, [locale])

  const setLocale = useCallback(
    async (next: AppLocale) => {
      setLocaleState(next)

      if (!session?.user.id) return

      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch { /* ignore */ }

      const { error } = await supabase
        .from('dashboard_user_access')
        .update({ locale: next, updated_at: new Date().toISOString() })
        .eq('user_id', session.user.id)

      if (error) {
        console.warn('Could not save locale to profile:', error.message)
      }
    },
    [session?.user.id],
  )

  const value = useMemo<LocaleContextValue>(() => {
    const t = createTranslator(locale)
    return {
      locale,
      dir: localeDir(locale),
      t,
      monthNames: monthNamesForLocale(locale),
      setLocale,
      loading,
    }
  }, [locale, setLocale, loading])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale outside LocaleProvider')
  return ctx
}
