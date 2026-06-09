import { isAppLocale } from '../i18n'
import type { AppLocale } from '../i18n/types'
import { supabase } from './supabase'

export async function fetchProfileLocale(userId: string): Promise<AppLocale | null> {
  const { data, error } = await supabase
    .from('dashboard_user_access')
    .select('locale')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data?.locale || !isAppLocale(data.locale)) return null
  return data.locale
}
