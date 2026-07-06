import { QueryClient } from '@tanstack/react-query'

// Shared instance so AuthContext can clear it on sign-out — without this, a
// second user signing in in the same tab (e.g. an admin testing an
// agent-scoped trial account) reuses the previous user's cached dashboard
// data until staleTime/gcTime expire, leaking their full-company data.
export const queryClient = new QueryClient()
