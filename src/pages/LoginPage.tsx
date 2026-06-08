import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await signIn(login, password)
    setBusy(false)
    if (err) setError(err)
    else navigate('/')
  }

  return (
    <div className="login-shell">
      <form onSubmit={onSubmit} className="login-card">
        <h1>Sales Dashboard</h1>
        <p>Sign in to view your sales data</p>
        {error && <p className="login-error">{error}</p>}
        <input
          type="text"
          placeholder="Email or username"
          value={login}
          onChange={e => setLogin(e.target.value)}
          className="login-input"
          autoComplete="username"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="login-input"
          required
        />
        <button type="submit" disabled={busy} className="login-submit">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
