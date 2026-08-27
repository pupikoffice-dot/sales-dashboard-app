import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

/** True when the production/dev bundle was built without Supabase Vite env. */
export const supabaseConfigured = Boolean(url && anonKey)

if (!supabaseConfigured) {
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Do not deploy with `vercel deploy --prebuilt` from a local build that used empty ' +
      '.vercel/.env.production.local — use `vercel deploy --prod` (remote build) instead.',
  )
}

/**
 * Only construct a client when env is present. Calling createClient('') throws and
 * blanks the whole app (empty #root) — that was the recurring post-deploy blank screen.
 */
export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(url, anonKey)
  : (null as unknown as SupabaseClient)
