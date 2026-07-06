import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { DashboardAccessProvider } from './context/DashboardAccessContext'
import { DashboardFiltersProvider } from './context/DashboardFiltersContext'
import { LocaleProvider } from './context/LocaleContext'
import { queryClient } from './lib/queryClient'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocaleProvider>
          <DashboardAccessProvider>
            <DashboardFiltersProvider>
              <App />
            </DashboardFiltersProvider>
          </DashboardAccessProvider>
        </LocaleProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
