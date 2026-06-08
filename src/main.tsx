import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { DashboardAccessProvider } from './context/DashboardAccessContext'
import { DashboardFiltersProvider } from './context/DashboardFiltersContext'
import App from './App'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DashboardAccessProvider>
          <DashboardFiltersProvider>
            <App />
          </DashboardFiltersProvider>
        </DashboardAccessProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
