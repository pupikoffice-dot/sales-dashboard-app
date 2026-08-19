import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { DashboardAccessProvider } from './context/DashboardAccessContext'
import { DashboardFiltersProvider } from './context/DashboardFiltersContext'
import { LocaleProvider } from './context/LocaleContext'
import { PreviewProvider } from './context/PreviewContext'
import { queryClient } from './lib/queryClient'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
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
