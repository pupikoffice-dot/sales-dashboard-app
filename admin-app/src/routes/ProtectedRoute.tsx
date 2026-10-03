import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../lib/types'

interface Props {
  children: React.ReactNode
  minRole?: UserRole
}

const ROLE_RANK: Record<UserRole, number> = {
  agent: 0, manager: 1, admin: 2, super_admin: 3,
}

export function ProtectedRoute({ children, minRole = 'manager' }: Props) {
  const { session, loading, role, roleLoading } = useAuth()

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
