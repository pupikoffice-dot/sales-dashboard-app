import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { DashboardAccessProvider } from './context/DashboardAccessContext'
import { DashboardFiltersProvider } from './context/DashboardFiltersContext'
import { LocaleProvider } from './context/LocaleContext'
import { ThemeProvider } from './context/ThemeContext'
import { SkinProvider } from './context/SkinContext'
import { applySkin, readStoredSkin } from './lib/skin'
import { PreviewProvider } from './context/PreviewContext'
import { queryClient } from './lib/queryClient'
import { applyTheme, readStoredTheme } from './lib/theme'
import App from './App'
import './index.css'

applyTheme(readStoredTheme())
applySkin(readStoredSkin()) // no flash of the wrong look before React mounts

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* PreviewProvider sits below AuthProvider (which owns the real
            isSuperAdmin) and above Locale/Access so both can follow the
            previewed user — see PreviewContext for why. */}
        <PreviewProvider>
          <ThemeProvider>
            <LocaleProvider>
            <DashboardAccessProvider>
              <SkinProvider>
              <DashboardFiltersProvider>
                <App />
              </DashboardFiltersProvider>
              </SkinProvider>
            </DashboardAccessProvider>
            </LocaleProvider>
          </ThemeProvider>
        </PreviewProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
