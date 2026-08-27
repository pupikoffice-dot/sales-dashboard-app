import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { DashboardAccessProvider } from './context/DashboardAccessContext'
import { DashboardFiltersProvider } from './context/DashboardFiltersContext'
import { LocaleProvider } from './context/LocaleContext'
import { PreviewProvider } from './context/PreviewContext'
import { queryClient } from './lib/queryClient'
import { supabaseConfigured } from './lib/supabase'
import App from './App'
import './index.css'

const rootEl = document.getElementById('root')!

if (!supabaseConfigured) {
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;padding:24px;text-align:center">
      <div style="max-width:36rem">
        <h1 style="font-size:1.25rem;margin:0 0 12px">Sales Dashboard failed to start</h1>
        <p style="margin:0;line-height:1.5;color:#94a3b8">
          This build is missing <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>.
          Redeploy with a Vercel remote production build (<code>vercel deploy --prod</code>),
          not a local <code>--prebuilt</code> package built without those env vars.
        </p>
      </div>
    </div>
  `
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* PreviewProvider sits below AuthProvider (which owns the real
              isSuperAdmin) and above Locale/Access so both can follow the
              previewed user — see PreviewContext for why. */}
          <PreviewProvider>
            <LocaleProvider>
              <DashboardAccessProvider>
                <DashboardFiltersProvider>
                  <App />
                </DashboardFiltersProvider>
              </DashboardAccessProvider>
            </LocaleProvider>
          </PreviewProvider>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}
