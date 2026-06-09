import { supabase } from './supabase'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

async function getEdgeFunctionToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not logged in')

  let accessToken = session.access_token
  const expiresAt = (session.expires_at ?? 0) * 1000
  if (expiresAt < Date.now() + 60_000) {
    const { data, error } = await supabase.auth.refreshSession()
    if (error) throw new Error('Session expired — sign in again')
    if (data.session?.access_token) accessToken = data.session.access_token
  }

  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) throw new Error('Session expired — sign in again')
  return accessToken
}

export async function callUserManagement(body: object) {
  const token = await getEdgeFunctionToken()

  const res = await fetch(`${url}/functions/v1/dashboard-user-management`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      apikey: anonKey,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  if (!res.ok) throw new Error(String(data.error ?? text.slice(0, 300)))
  return data
}
