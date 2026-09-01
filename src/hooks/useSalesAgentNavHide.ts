import { useAuth } from '../context/AuthContext'
import { useResolvedOversightMode } from './useResolvedOversightMode'
import { shouldHideNavForSalesAgentSuite } from '../lib/salesAgentNav'
import { useUserProfile } from './useUserProfile'

/** Whether the sidebar should be hidden for the current Sales Agent suite user. */
export function useSalesAgentNavHide(): boolean {
  const { isSuperAdmin } = useAuth()
  const { role } = useUserProfile()
  const oversightMode = useResolvedOversightMode()
  return shouldHideNavForSalesAgentSuite({
    isRealSuperAdmin: isSuperAdmin,
    role,
    oversightMode,
  })
}
