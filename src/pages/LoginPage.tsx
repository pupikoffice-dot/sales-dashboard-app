import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'

export function LoginPage() {
  const { signIn } = useAuth()
  const { locale, setLocale, t } = useLocale()
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
        <div className="login-lang-row">
          <button
            type="button"
            className={`lang-btn${locale === 'en' ? ' active' : ''}`}
            onClick={() => setLocale('en')}
          >
            EN
          </button>
          <button
            type="button"
            className={`lang-btn${locale === 'he' ? ' active' : ''}`}
            onClick={() => setLocale('he')}
          >
            עב
          </button>
        </div>
        <h1>{t('login.title')}</h1>
        <p>{t('login.subtitle')}</p>
        {error && <p className="login-error">{error}</p>}
        <input
          type="text"
          placeholder={t('login.emailOrUsername')}
          value={login}
          onChange={e => setLogin(e.target.value)}
          className="login-input"
          autoComplete="username"
          required
        />
        <input
          type="password"
          placeholder={t('login.password')}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="login-input"
          required
        />
        <button type="submit" disabled={busy} className="login-submit">
          {busy ? t('login.signingIn') : t('login.signIn')}
        </button>
      </form>
    </div>
  )
}
