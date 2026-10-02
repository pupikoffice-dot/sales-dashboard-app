import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { UserRole } from '../lib/types'

const ROLE_RANK: Record<UserRole, number> = {
  agent: 0, manager: 1, admin: 2, super_admin: 3,
}

/** Web console is for manager, admin, and super_admin only. */
const MIN_CONSOLE_ROLE: UserRole = 'manager'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = await signIn(email.trim(), password)
      if (err) {
        setError(err.message)
        return
      }
      const { data: myRole, error: roleErr } = await supabase.rpc('get_my_role')
      if (roleErr || !myRole) {
        await supabase.auth.signOut()
        setError('Could not verify your account role. Try again or contact support.')
        return
      }
      const r = myRole as UserRole
      if (ROLE_RANK[r] < ROLE_RANK[MIN_CONSOLE_ROLE]) {
        await supabase.auth.signOut()
        setError(
          'Agent accounts use the Sales mobile app, not this web console. Sign in on the phone app with the same email and password.',
        )
        return
      }
      navigate('/admin')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#001a4d] to-[#003080] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Sales Console</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to your admin account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'} required
                value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2 text-sm transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
